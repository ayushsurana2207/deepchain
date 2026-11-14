import { z } from "zod";
import type { GEdge, GNode, Graph, Tier } from "./graph";
import { quoteInText } from "./verify.ts";

export type BuildEvent =
  | { type: "step"; step: "search" | "fetch" | "leads" | "extract" | "pulse"; status: "running" | "done" | "failed"; detail?: string }
  | { type: "search"; label: string; query: string; providers: string[]; hits: number; latencyMs: number }
  | { type: "fetch"; label: string; ok: number; failed: number; chars: number; providers: string[]; latencyMs: number }
  | { type: "leads"; leads: string[] }
  | { type: "pulse"; name: string; count: number }
  | { type: "edge"; from: string; to: string; verdict: "verified" | "rejected"; reason?: string }
  | { type: "graph"; graph: Graph; stats: BuildStats }
  | { type: "error"; message: string; cached?: Graph };

export type BuildStats = {
  providers: string[];
  pages: number;
  chars: number;
  verifiedEdges: number;
  rejectedEdges: number;
  tavilyCredits: number;
  ms: number;
};

const MAX_PER_TIER = 5; // the 4-column layout fits ~5 cards per column

export const Extraction = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      tier: z.number().int(),
      country: z.string(),
      role: z.string(),
      ticker: z.string(),
      spof: z.boolean(),
      spof_quote: z.string(),
      spof_page_id: z.number().int(),
    }),
  ),
  edges: z.array(z.object({ from: z.string(), to: z.string(), page_id: z.number().int(), quote: z.string() })),
});

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/** Pure: turns raw extraction into a verified graph. Exported for tests. */
export function assemble(
  target: string,
  key: string,
  label: string,
  out: z.infer<typeof Extraction>,
  pages: { url: string; content: string; title?: string }[],
  emit: (e: BuildEvent) => void = () => {},
): Graph {
  const nodes = new Map<string, GNode>();
  for (const n of out.nodes) {
    if (n.tier < 1 || n.tier > 3 || !n.name.trim()) continue;
    const id = slug(n.id || n.name) || slug(n.name);
    if (!id || id === "target" || nodes.has(id)) continue;
    const spofPage = pages[n.spof_page_id];
    nodes.set(id, {
      id,
      name: n.name.trim(),
      tier: n.tier as Tier,
      country: n.country.toUpperCase().slice(0, 2),
      role: n.role.slice(0, 40),
      ticker: n.ticker || undefined,
      spof: n.spof && !!spofPage && quoteInText(n.spof_quote, spofPage.content),
    });
  }
  const idOf = (raw: string) => (raw === "target" ? "target" : slug(raw));
  const tierOf = (id: string) => (id === "target" ? 0 : nodes.get(id)?.tier);

  const edges: GEdge[] = [];
  for (const e of out.edges) {
    const from = idOf(e.from), to = idOf(e.to);
    const page = pages[e.page_id];
    const label = `${nodes.get(from)?.name ?? e.from} → ${to === "target" ? target : nodes.get(to)?.name ?? e.to}`;
    let reason: string | undefined;
    if (!nodes.has(from) || tierOf(to) === undefined) reason = "unknown node";
    else if ((tierOf(from) ?? 0) <= (tierOf(to) ?? 0)) reason = "tier order";
    else if (!page) reason = "no such page";
    else if (!quoteInText(e.quote, page.content)) reason = "quote not in source";
    else if (edges.some((x) => x.from === from && x.to === to)) reason = "duplicate";
    if (reason) {
      emit({ type: "edge", from: label.split(" → ")[0], to: label.split(" → ")[1], verdict: "rejected", reason });
      continue;
    }
    edges.push({ from, to, evidence: { quote: e.quote.trim(), url: page!.url, verified: true } });
    emit({ type: "edge", from: label.split(" → ")[0], to: label.split(" → ")[1], verdict: "verified" });
  }

  // Keep only nodes that reach the target through verified edges.
  const reaches = new Set<string>(["target"]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const e of edges) {
      if (reaches.has(e.to) && !reaches.has(e.from)) {
        reaches.add(e.from);
        changed = true;
      }
    }
  }
  const kept = [...nodes.values()].filter((n) => reaches.has(n.id));
  const perTier: Record<number, number> = {};
  const final = kept.filter((n) => (perTier[n.tier] = (perTier[n.tier] ?? 0) + 1) <= MAX_PER_TIER);
  const finalIds = new Set(["target", ...final.map((n) => n.id)]);
  // Seed monitors on SPOFs first, then remaining tier-2/3 nodes, max 4.
  const monitorIds = new Set(
    [...final.filter((n) => n.spof && n.tier >= 2), ...final.filter((n) => !n.spof && n.tier >= 2)].slice(0, 4).map((n) => n.id),
  );

  return {
    key,
    label,
    title: target,
    source: "live",
    builtAt: new Date().toISOString(),
    nodes: [
      ...final.map((n) => ({ ...n, monitored: monitorIds.has(n.id) })),
      { id: "target", name: label, tier: 0, country: "", role: target },
    ],
    edges: edges.filter((e) => finalIds.has(e.from) && finalIds.has(e.to)),
  };
}
