// Supplier graph model, layout and contagion propagation. Pure functions: no I/O.

export type Tier = 0 | 1 | 2 | 3; // 3 = raw & chem … 0 = target asset

export type Evidence = { quote: string; url: string; verified: boolean };

export type GNode = {
  id: string;
  name: string;
  tier: Tier;
  country: string; // ISO-2
  role: string;
  ticker?: string;
  spof?: boolean;
  monitored?: boolean;
  /** Tavily news pulse: this week's headlines about the supplier, captured when the graph was built. */
  news?: { count: number; items: { title: string; url: string; published: string | null }[]; at: string };
};

export type GEdge = { from: string; to: string; evidence?: Evidence }; // from = upstream supplier

export type Graph = {
  key: string; // e.g. "MU-HBM3E"
  label: string; // e.g. "MU · HBM3E"
  title: string; // e.g. "MU · HBM3E 12-Hi"
  source: "live" | "cached" | "sample";
  builtAt?: string;
  nodes: GNode[];
  edges: GEdge[];
};

export type Status = "nominal" | "watch" | "breach" | "contagion" | "atrisk" | "target";

/** BFS downstream from breached nodes. Every reachable node becomes contagion (the target becomes "atrisk"). */
export function propagate(graph: Graph, breached: Iterable<string>, watched: Iterable<string> = []) {
  const status: Record<string, Status> = {};
  for (const n of graph.nodes) status[n.id] = n.tier === 0 ? "target" : "nominal";
  for (const id of watched) if (status[id] === "nominal") status[id] = "watch";

  const tierOf = Object.fromEntries(graph.nodes.map((n) => [n.id, n.tier]));
  const hotEdges = new Set<string>();
  const queue: string[] = [];
  const seen = new Set<string>();
  for (const id of breached) {
    if (!(id in status)) continue;
    status[id] = "breach";
    queue.push(id);
    seen.add(id);
  }
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of graph.edges) {
      if (e.from !== cur) continue;
      hotEdges.add(edgeKey(e));
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      if (status[e.to] !== "breach") status[e.to] = tierOf[e.to] === 0 ? "atrisk" : "contagion";
      queue.push(e.to);
    }
  }
  return { status, hotEdges, blast: [...seen] };
}

export const edgeKey = (e: { from: string; to: string }) => `${e.from}->${e.to}`;

/** Ids of every node downstream of `id` (not including itself). */
export function downstream(graph: Graph, id: string): string[] {
  return propagate(graph, [id]).blast.filter((x) => x !== id);
}

// Layout: 4 fixed columns, nodes stacked and centred per column.
export const CARD_W = 170;
export const CARD_H = 80;
const COL_X = [720, 480, 240, 0]; // indexed by tier
const ROW = 104;
const HEAD = 40;

export function layout(graph: Graph) {
  const byTier: GNode[][] = [[], [], [], []];
  for (const n of graph.nodes) byTier[n.tier].push(n);
  const maxRows = Math.max(1, ...byTier.map((t) => t.length));
  const pos: Record<string, { x: number; y: number; h: number }> = {};
  byTier.forEach((nodes, tier) => {
    const offset = ((maxRows - nodes.length) * ROW) / 2;
    nodes.forEach((n, i) => {
      const h = tier === 0 ? 100 : CARD_H;
      pos[n.id] = { x: COL_X[tier], y: HEAD + offset + i * ROW - (h - CARD_H) / 2, h };
    });
  });
  return { pos, width: COL_X[0] + CARD_W, height: HEAD + maxRows * ROW };
}

export function edgePath(graph: Graph, pos: ReturnType<typeof layout>["pos"], e: GEdge) {
  const a = pos[e.from], b = pos[e.to];
  if (!a || !b) return "";
  const x1 = a.x + CARD_W, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2, mx = (x1 + x2) / 2;
  return `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
}
