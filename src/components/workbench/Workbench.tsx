"use client";

import { useEffect, useMemo, useState } from "react";
import type { BuildEvent } from "@/lib/assemble";
import {
  CARD_W, downstream, edgeKey, edgePath, layout, propagate,
  type GEdge, type GNode, type Graph, type Status,
} from "@/lib/graph";
import type { TickEvent, TickResult } from "@/lib/tick";
import BuildLog from "./BuildLog";
import MonitorPanel, { type MonitorState } from "./MonitorPanel";

type Build = { target: string; events: BuildEvent[]; error: string | null; running: boolean };

// Suggestions are just search shortcuts: clicking one runs a live search. The fixed keys keep each one's monitors attached.
const SUGGESTIONS = [
  { label: "MU · HBM3E", target: "Micron HBM3E memory", key: "MU-HBM3E" },
  { label: "NVDA · Blackwell", target: "NVIDIA Blackwell on CoWoS-L", key: "NVDA-COWOS-L" },
  { label: "INTC · Xeon", target: "Intel Xeon server CPUs (Granite Rapids)", key: "INTC-XEON" },
  { label: "DELL · AI servers", target: "Dell PowerEdge AI servers", key: "DELL-AI-SERVERS" },
  { label: "ASML · High-NA EUV", target: "ASML High-NA EUV lithography", key: "ASML-HIGHNA" },
];

const TIER_LABEL = ["TARGET", "TIER 1 · FACTORY", "TIER 2 · COMPONENTS & TOOLS", "TIER 3 · MATERIALS"];

const LOOK: Record<Status, { card: string; dot: string; text: string; label: string }> = {
  nominal: { card: "border-line bg-card", dot: "bg-[#8A857A]", text: "text-muted", label: "NOMINAL" },
  watch: { card: "border-[#E8A79B] bg-[#FDF4F2]", dot: "bg-[#DB7766]", text: "text-risk-ink", label: "WATCH" },
  breach: { card: "border-risk bg-risk-tint border-[1.5px]", dot: "bg-risk", text: "text-risk-ink", label: "PROBLEM" },
  contagion: { card: "border-risk border-dashed border-[1.5px] bg-card", dot: "bg-risk", text: "text-risk-ink", label: "AT RISK" },
  atrisk: { card: "border-risk border-dashed border-[1.5px] bg-card", dot: "bg-risk", text: "text-risk-ink", label: "AT RISK" },
  target: { card: "border-amber bg-amber-tint", dot: "bg-amber", text: "text-amber-ink", label: "TARGET" },
};

const EMPTY: Graph = { key: "", label: "", title: "", source: "live", nodes: [], edges: [] };
const mono = "font-mono";
// Demo-only "Simulate a problem here" control. Hidden from the UI; flip to true to bring it back.
const SHOW_SIMULATE = false;
const keyOf = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export default function Workbench({ recent, email, signOut }: { recent: Graph[]; email: string; signOut: () => Promise<void> }) {
  const [graphs, setGraphs] = useState(recent);
  const [key, setKey] = useState<string | null>(null);
  const graph = graphs.find((g) => g.key === key) ?? null;
  const g = graph ?? EMPTY;
  const [query, setQuery] = useState("");
  const [build, setBuild] = useState<Build | null>(null);
  const [telemQueries, setTelemQueries] = useState(0);
  const [credits, setCredits] = useState(0);

  const [selectedId, setSelectedId] = useState<string>("");
  const [simulated, setSimulated] = useState<string[]>([]);
  const [ticks, setTicks] = useState<Record<string, TickResult>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [tickError, setTickError] = useState<string | null>(null);

  // Telem monitors attached to the open graph, keyed by node id.
  const [mons, setMons] = useState<Record<string, MonitorState>>({});
  const [monBusy, setMonBusy] = useState<{ nodeId: string; action: string } | null>(null);
  const [monError, setMonError] = useState<{ nodeId: string; msg: string } | null>(null);
  const [monReload, setMonReload] = useState(0);
  const liveMons = Object.entries(mons).filter((e): e is [string, Extract<MonitorState, { id: string }>] => !!e[1] && !("error" in e[1]));
  const monActive = liveMons.some(([, v]) => v.agentStatus === "compiling" || !!v.runningJob);
  const pollMs = monActive ? 5000 : 30000;

  useEffect(() => {
    if (!g.key) return;
    let stopped = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/monitors?graphKey=${encodeURIComponent(g.key)}`, { cache: "no-store" });
        if (r.ok && !stopped) setMons(await r.json());
      } catch {
        // keep showing the last known state; the next poll retries
      }
    };
    load();
    const t = setInterval(load, pollMs);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [g.key, pollMs, monReload]);

  function open(next: Graph) {
    setKey(next.key);
    setSelectedId(defaultSelection(next));
    setSimulated([]);
    setTickError(null);
    setMons({});
    setMonError(null);
  }

  async function search(target: string, fixedKey?: string, label?: string) {
    const t = target.trim();
    if (t.length < 2 || build?.running) return;
    setQuery(t);
    setBuild({ target: t, events: [], error: null, running: true });
    const push = (e: BuildEvent) => setBuild((b) => (b ? { ...b, events: [...b.events, e] } : b));
    const adopt = (next: Graph) => {
      setGraphs((gs) => [next, ...gs.filter((x) => x.key !== next.key)]);
      open(next);
    };
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: t, key: fixedKey ?? keyOf(t), label: label ?? t.slice(0, 28) }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? `Request failed (${res.status})`);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines.filter(Boolean)) {
          const e = JSON.parse(line) as BuildEvent;
          push(e);
          if (e.type === "search" && e.label !== "Live news") setTelemQueries((n) => n + 1);
          if (e.type === "graph") {
            setCredits((c) => c + e.stats.tavilyCredits);
            adopt(e.graph);
          }
          if (e.type === "error") {
            if (e.cached) adopt(e.cached);
            setBuild((b) => b && { ...b, error: e.cached ? `${e.message}. Showing your last result for this search.` : e.message });
          }
        }
      }
    } catch (err) {
      setBuild((b) => b && { ...b, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setBuild((b) => b && { ...b, running: false });
    }
  }

  async function monitorAction(nodeId: string, action: "create" | "tick" | "steer" | "stop", message?: string) {
    setMonBusy({ nodeId, action });
    setMonError(null);
    try {
      const res = await fetch("/api/monitors", {
        method: action === "stop" ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graphKey: g.key, nodeId, action, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      if (action === "create") setMons((m) => ({ ...m, [nodeId]: data }));
      if (action === "stop")
        setMons((m) => {
          const next = { ...m };
          delete next[nodeId];
          return next;
        });
      setMonReload((n) => n + 1);
    } catch (e) {
      setMonError({ nodeId, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setMonBusy(null);
    }
  }

  async function monitorAllSuggested() {
    for (const n of g.nodes.filter((x) => x.monitored && x.tier > 0 && !mons[x.id])) await monitorAction(n.id, "create");
  }

  async function runTick(nodeId: string) {
    setRunning(nodeId);
    setTickError(null);
    try {
      const res = await fetch("/api/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ graphKey: g.key, nodeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      const r = data as TickResult;
      setTicks((t) => ({ ...t, [`${r.graphKey}:${r.nodeId}`]: r }));
      if (r.source === "live") setCredits((c) => c + r.credits);
      if (r.breached) setSimulated((b) => (b.includes(nodeId) ? b : [...b, nodeId]));
    } catch (e) {
      setTickError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
    }
  }

  const { pos, width, height } = useMemo(() => layout(g), [g]);
  // A supplier breaches when a news check or its Telem monitor confirms a problem (or the user simulates one).
  const monitorBreached = liveMons.filter(([, v]) => v.counts.qualified > 0).map(([id]) => id).sort().join(",");
  const allBreached = useMemo(
    () => [...new Set([...simulated, ...(monitorBreached ? monitorBreached.split(",") : [])])],
    [simulated, monitorBreached],
  );
  const { status, hotEdges, blast } = useMemo(() => propagate(g, allBreached), [g, allBreached]);
  const selected = g.nodes.find((n) => n.id === selectedId) ?? g.nodes[0];
  const monitors = liveMons.length;
  const telemSpend = liveMons.reduce((s, [, v]) => s + v.spendUsd, 0);
  const suggestedLeft = g.nodes.filter((n) => n.monitored && n.tier > 0 && !mons[n.id]).length;
  const busy = !!build?.running || running !== null;
  const touchesSelected = (e: GEdge) => !!selected && (e.from === selected.id || e.to === selected.id);

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink lg:h-screen">
      {/* Command bar */}
      <header className="flex min-h-14 flex-wrap items-center gap-3 bg-ink px-4 py-2.5 text-paper">
        <button
          onClick={() => setKey(null)}
          aria-label="Back to search"
          className="flex items-center gap-2 rounded font-mono text-[13px] font-semibold tracking-[0.08em] text-white focus-visible:outline focus-visible:outline-amber"
        >
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[2px] bg-amber" />
          DEEPCHAIN
        </button>
        <div aria-hidden="true" className="h-5 w-px bg-ink-line" />
        {(graph || build) && (
          <>
            <SearchForm query={query} setQuery={setQuery} onSearch={(t) => search(t)} disabled={busy} compact />
            <nav aria-label="Suggested searches" className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-on-ink">Try</span>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => search(s.target, s.key, s.label)}
                  disabled={busy}
                  className={`${mono} h-7 rounded-full border px-2.5 text-xs transition-colors disabled:cursor-wait disabled:opacity-60 ${
                    graph?.key === s.key ? "border-amber text-amber" : "border-ink-line text-[#E6E3DC] hover:border-amber hover:text-amber"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </nav>
          </>
        )}
        <div className="flex-1" />
        <div className={`${mono} flex flex-wrap items-center gap-4 text-xs text-muted-on-ink`}>
          <span>MONITORS <b className="font-semibold text-paper">{monitors}</b></span>
          <span>
            TELEM <b className="font-semibold text-paper">{monitors ? `$${telemSpend.toFixed(2)}` : telemQueries ? `${telemQueries} q` : "—"}</b>
          </span>
          <span>TAVILY <b className="font-semibold text-paper">{credits ? `${credits} cr` : "—"}</b></span>
          <span className="hidden xl:inline">{email}</span>
          <form action={signOut}>
            <button className="h-7 rounded-md border border-ink-line px-2.5 text-paper hover:border-paper">Sign out</button>
          </form>
        </div>
      </header>

      {!graph && !build && (
        <EmptyState
          query={query}
          setQuery={setQuery}
          onSearch={(t) => search(t)}
          onSuggest={(s) => search(s.target, s.key, s.label)}
          recent={graphs}
          onOpen={open}
        />
      )}

      {(graph || build) && (
        <div className="flex min-h-0 flex-1 flex-wrap">
          <main className="flex min-w-0 flex-[64_1_600px] flex-col border-r border-line lg:h-full">
            {!graph ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
                <span aria-hidden="true" className="pulse h-2.5 w-2.5 rounded-full bg-amber" />
                <p className="text-lg font-semibold">Mapping {build?.target}…</p>
                <p className="max-w-sm text-sm text-muted">
                  Searching filings, teardowns and this month&apos;s news, then checking every link against its source. This takes about a minute.
                </p>
              </div>
            ) : (
              <>
                {allBreached.length > 0 && (
                  <div role="status" className="flex flex-wrap items-center gap-3 border-b border-risk-line bg-risk-tint px-6 py-2.5 text-[13px] text-[#6E1E12]">
                    <span className={`${mono} rounded-[3px] bg-risk-ink px-1.5 py-0.5 text-[11px] font-semibold text-white`}>PROBLEM</span>
                    <span>
                      <b className="font-semibold">{allBreached.map((id) => nameOf(g, id)).join(", ")}</b> → affects {blast.length - allBreached.length}{" "}
                      downstream {blast.length - allBreached.length === 1 ? "company or product" : "companies and products"}
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap items-baseline justify-between gap-2 px-6 pt-4">
                  <h1 className="text-[15px] font-semibold">{g.title}</h1>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-xs text-muted">
                      {g.nodes.length - 1} suppliers · {g.edges.length} links, each with a source · Updated {fmtUTC(g.builtAt)}
                    </p>
                    <button
                      onClick={() => search(g.title, g.key, g.label)}
                      disabled={busy}
                      className={`${mono} h-7 rounded-md border border-ink px-2.5 text-[11px] tracking-[0.04em] transition-colors hover:bg-ink hover:text-paper disabled:cursor-wait disabled:opacity-50`}
                    >
                      {build?.running ? "SEARCHING…" : "SEARCH AGAIN"}
                    </button>
                    {suggestedLeft > 0 && monitors < 4 && (
                      <button
                        onClick={monitorAllSuggested}
                        disabled={!!monBusy}
                        className={`${mono} h-7 rounded-md border border-amber bg-amber px-2.5 text-[11px] tracking-[0.04em] text-ink transition-transform hover:-translate-y-px disabled:cursor-wait disabled:opacity-60`}
                      >
                        {monBusy?.action === "create" ? "STARTING MONITORS…" : `MONITOR ${suggestedLeft} SUGGESTED`}
                      </button>
                    )}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-auto p-6">
                  <div className={`relative mx-auto transition-opacity ${build?.running ? "opacity-50" : ""}`} style={{ width, height }}>
                    {TIER_LABEL.map((t, tier) => (
                      <div
                        key={t}
                        className={`${mono} absolute top-0 text-[11px] tracking-[0.04em] text-amber-ink`}
                        style={{ left: [720, 480, 240, 0][tier], width: CARD_W }}
                      >
                        {t}
                      </div>
                    ))}

                    <svg aria-hidden="true" width={width} height={height} className="absolute left-0 top-0" fill="none">
                      {g.edges.map((e) => {
                        const hot = hotEdges.has(edgeKey(e));
                        const sel = !hot && touchesSelected(e);
                        return (
                          <path
                            key={edgeKey(e)}
                            d={edgePath(g, pos, e)}
                            stroke={hot ? "#C2341F" : sel ? "#C98A1B" : "#D6D2C8"}
                            strokeWidth={hot || sel ? 2 : 1.5}
                            className={hot ? "flow" : undefined}
                            style={{ transition: "stroke 0.3s" }}
                          />
                        );
                      })}
                    </svg>

                    {g.nodes.map((n) => {
                      const s = status[n.id];
                      const look = LOOK[s];
                      const p = pos[n.id];
                      const isSel = n.id === selected?.id;
                      return (
                        <button
                          key={n.id}
                          onClick={() => {
                            setSelectedId(n.id);
                            if (build && !build.running) setBuild(null);
                          }}
                          aria-pressed={isSel}
                          aria-label={`${n.name}, ${n.role}, ${look.label.toLowerCase()}`}
                          className={`absolute flex flex-col gap-1 rounded-md border px-3 py-2.5 text-left transition-[box-shadow,background-color,border-color] duration-300 ${look.card} ${
                            isSel ? "shadow-[0_0_0_2px_#C98A1B]" : "hover:shadow-[0_0_0_1px_#D6D2C8]"
                          } ${s === "nominal" && allBreached.length ? "opacity-70" : ""}`}
                          style={{ left: p.x, top: p.y, width: CARD_W, height: p.h }}
                        >
                          <span className="flex items-center justify-between gap-1.5">
                            <span className="truncate text-[13px] font-semibold">{n.name}</span>
                            {n.country && (
                              <span className={`${mono} rounded-[3px] border border-line bg-card px-1 text-[10px] text-muted`}>{n.country}</span>
                            )}
                          </span>
                          <span className="truncate text-xs text-muted">{n.role}</span>
                          <span className={`${mono} mt-auto flex items-center gap-1.5 whitespace-nowrap text-[10px]`}>
                            <span className={`h-[7px] w-[7px] rounded-full ${look.dot}`} />
                            <span className={`${look.text} tracking-[0.04em]`}>{look.label}</span>
                            {n.spof && <span className="rounded-[3px] bg-ink px-1 py-px text-paper">SPOF</span>}
                            {liveMons.some(([id]) => id === n.id) && (
                              <span className="rounded-[3px] border border-amber bg-amber px-1 text-ink">MON</span>
                            )}
                            {newsItems(n).length > 0 && <span className="ml-auto whitespace-nowrap text-muted">{newsItems(n).length} NEWS</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className={`${mono} flex flex-wrap items-center gap-4 border-t border-line bg-card px-6 py-3 text-[11px] text-muted`}>
                  <Legend dot="bg-[#8A857A]" label="NOMINAL" />
                  <Legend dot="bg-risk" label="PROBLEM / AT RISK" />
                  <span><span className="rounded-[3px] bg-ink px-1 py-px text-paper">SPOF</span> single source</span>
                  <span><span className="rounded-[3px] border border-amber bg-amber px-1 text-ink">MON</span> Telem monitor running</span>
                  <span>NEWS = this week&apos;s headlines (Tavily)</span>
                </div>
              </>
            )}
          </main>

          {build ? (
            <BuildLog target={build.target} events={build.events} error={build.error} />
          ) : (
            selected && (
              <Inspector
                graph={g}
                node={selected}
                status={status[selected.id]}
                breached={allBreached}
                simulated={simulated}
                blast={blast}
                onToggleSimulated={() =>
                  setSimulated((b) => (b.includes(selected.id) ? b.filter((x) => x !== selected.id) : [...b, selected.id]))
                }
                onClear={() => setSimulated([])}
                onSelect={setSelectedId}
                tick={ticks[`${g.key}:${selected.id}`]}
                isRunning={running === selected.id}
                anyRunning={running !== null}
                tickError={tickError}
                onRunTick={() => runTick(selected.id)}
                monitorSlot={
                  <MonitorPanel
                    monitor={mons[selected.id]}
                    suggested={!!selected.monitored}
                    busy={monBusy?.nodeId === selected.id ? monBusy.action : monBusy ? "other" : null}
                    error={monError?.nodeId === selected.id ? monError.msg : null}
                    canCreate={monitors < 4}
                    onCreate={() => monitorAction(selected.id, "create")}
                    onTick={() => monitorAction(selected.id, "tick")}
                    onSteer={(msg) => monitorAction(selected.id, "steer", msg)}
                    onStop={() => monitorAction(selected.id, "stop")}
                  />
                }
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function SearchForm({
  query, setQuery, onSearch, disabled, compact = false,
}: {
  query: string;
  setQuery: (q: string) => void;
  onSearch: (q: string) => void;
  disabled: boolean;
  compact?: boolean;
}) {
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(query);
      }}
      className={`flex gap-2 ${compact ? "" : "w-full"}`}
    >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Product, part or stock ticker"
        placeholder={compact ? "Search a product or ticker…" : "e.g. Apple Vision Pro, TSLA 4680 cell, Micron HBM3E"}
        maxLength={120}
        disabled={disabled}
        className={
          compact
            ? "h-9 w-72 rounded-md border border-ink-line bg-ink-2 px-3 text-sm text-paper placeholder:text-muted-on-ink focus:border-amber focus:outline-none disabled:cursor-wait disabled:opacity-60"
            : "h-12 min-w-0 flex-1 rounded-md border border-line-strong bg-card px-4 text-base text-ink placeholder:text-muted focus:border-ink focus:outline-none focus:ring-2 focus:ring-amber/40"
        }
      />
      {!compact && (
        <button
          disabled={disabled || query.trim().length < 2}
          className="h-12 rounded-md bg-ink px-5 font-medium text-paper transition-colors hover:bg-ink-2 disabled:opacity-50"
        >
          Trace
        </button>
      )}
    </form>
  );
}

function EmptyState({
  query, setQuery, onSearch, onSuggest, recent, onOpen,
}: {
  query: string;
  setQuery: (q: string) => void;
  onSearch: (q: string) => void;
  onSuggest: (s: (typeof SUGGESTIONS)[number]) => void;
  recent: Graph[];
  onOpen: (g: Graph) => void;
}) {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-16 sm:py-24">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">What do you want to trace?</h1>
          <p className="mt-2 text-muted">
            Type a product, a part or a stock ticker. We&apos;ll map its suppliers&apos; suppliers and check each one for trouble.
          </p>
        </div>
        <SearchForm query={query} setQuery={setQuery} onSearch={onSearch} disabled={false} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted">Try one:</span>
          {SUGGESTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => onSuggest(s)}
              className={`${mono} h-8 rounded-full border border-line-strong bg-card px-3 text-xs transition-colors hover:border-amber hover:text-amber-ink`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {recent.length > 0 && (
          <section aria-label="Recent searches" className="mt-6">
            <h2 className="text-sm font-semibold">Recent searches</h2>
            <ul className="mt-3 flex flex-col divide-y divide-line rounded-lg border border-line bg-card">
              {recent.map((r) => (
                <li key={r.key}>
                  <button onClick={() => onOpen(r)} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-paper">
                    <span>
                      <span className="block text-sm font-medium">{r.title}</span>
                      <span className="block text-xs text-muted">
                        {r.nodes.length - 1} suppliers · {r.edges.length} sourced links
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{fmtUTC(r.builtAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function Inspector({
  graph, node, status, breached, blast, onToggleSimulated, onClear, onSelect,
  tick, isRunning, anyRunning, tickError, onRunTick, simulated, monitorSlot,
}: {
  graph: Graph;
  node: GNode;
  status: Status;
  breached: string[];
  blast: string[];
  onToggleSimulated: () => void;
  onClear: () => void;
  onSelect: (id: string) => void;
  tick?: TickResult;
  isRunning: boolean;
  anyRunning: boolean;
  tickError: string | null;
  simulated: string[];
  monitorSlot: React.ReactNode;
  onRunTick: () => void;
}) {
  const down = downstream(graph, node.id);
  const links = graph.edges.filter((e) => e.from === node.id || e.to === node.id);
  const isSimulated = simulated.includes(node.id);

  return (
    <aside aria-label="Supplier details" className="flex min-w-0 flex-[36_1_360px] flex-col bg-card lg:h-full">
      <div className="min-h-0 flex-1 overflow-auto">
        <section className="flex flex-col gap-2 border-b border-line px-5 pb-4 pt-5">
          <p className={`${mono} text-[11px] tracking-[0.04em] text-muted`}>{TIER_LABEL[node.tier]}</p>
          <h2 className="text-xl font-semibold">{node.name}</h2>
          <div className={`${mono} flex flex-wrap gap-1.5 text-[11px]`}>
            {node.ticker && <Chip>{node.ticker}</Chip>}
            {node.country && <Chip>{node.country}</Chip>}
            {node.spof && <span className="rounded-[3px] bg-ink px-1.5 py-px text-paper">SPOF</span>}
            {status !== "nominal" && status !== "target" && (
              <span className="rounded-[3px] bg-risk-ink px-1.5 py-px text-white">{LOOK[status].label}</span>
            )}
            {node.tier > 0 && <Chip>{down.length} DOWNSTREAM</Chip>}
          </div>
          <p className="text-[13px] leading-relaxed text-[#47443D]">{node.role}</p>
        </section>

        {node.tier > 0 && node.news && <NewsPulse items={newsItems(node)} />}

        {node.tier > 0 && (
          <section className="flex flex-col gap-3 border-b border-line px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`${mono} text-xs font-semibold text-muted`}>NEWS CHECK</span>
              <span className="text-[11px] text-muted">Tavily search, read by AI</span>
            </div>
            <button
              onClick={onRunTick}
              disabled={anyRunning}
              className="flex h-11 items-center justify-center gap-2.5 rounded-md border border-amber bg-amber font-medium text-ink transition-transform hover:-translate-y-px disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {isRunning ? (
                <>
                  <span aria-hidden="true" className="pulse h-1.5 w-1.5 rounded-full bg-ink" />
                  Reading this month&apos;s news…
                </>
              ) : (
                "Check for problems now"
              )}
            </button>
            {tickError && (
              <p role="alert" className="rounded-md border border-risk-line bg-risk-tint px-3 py-2 text-[13px] text-risk-ink">
                {tickError}
              </p>
            )}
            {SHOW_SIMULATE && (
            <div className="flex gap-2">
              <button
                onClick={onToggleSimulated}
                className="h-8 flex-1 rounded-md border border-line text-xs text-muted transition-colors hover:border-risk hover:text-risk-ink"
              >
                {isSimulated ? "Undo simulated problem" : "Simulate a problem here (demo)"}
              </button>
              {simulated.length > 0 && (
                <button onClick={onClear} className="h-8 rounded-md border border-line px-3 text-xs hover:border-ink">
                  Clear
                </button>
              )}
            </div>
            )}
          </section>
        )}

        {tick && <TickPanel tick={tick} />}

        {node.tier > 0 && monitorSlot}

        {breached.length > 0 && (
          <section className="flex flex-col gap-2.5 border-b border-line px-5 py-4">
            <p className={`${mono} text-[11px] tracking-[0.04em] text-muted`}>WHAT&apos;S AFFECTED</p>
            <ol className="flex flex-col gap-1.5 text-[13px]">
              {blast.map((id) => (
                <li key={id}>
                  <button onClick={() => onSelect(id)} className="flex items-center gap-2 hover:underline">
                    <span className="h-2 w-2 rounded-full bg-risk" />
                    {nameOf(graph, id)}
                    <span className={`${mono} text-[10px] text-risk-ink`}>{breached.includes(id) ? "PROBLEM" : "DOWNSTREAM"}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="flex flex-col gap-3 px-5 py-4">
          <p className={`${mono} text-[11px] tracking-[0.04em] text-muted`}>WHY IT&apos;S ON THE MAP</p>
          {links.map((e) => (
            <div key={edgeKey(e)} className="flex flex-col gap-2">
              <p className="text-xs font-medium">
                {nameOf(graph, e.from)} → {nameOf(graph, e.to)}
              </p>
              {e.evidence ? (
                <>
                  <blockquote className="border-l-2 border-line-strong pl-3 text-[13px] leading-relaxed text-[#2E2C27]">{e.evidence.quote}</blockquote>
                  <div className={`${mono} flex flex-wrap items-center gap-2 text-[11px] text-muted`}>
                    <a href={e.evidence.url} target="_blank" rel="noreferrer" className="no-underline hover:text-ink">
                      {hostOf(e.evidence.url)} ↗
                    </a>
                    {e.evidence.verified && <span className="text-amber-ink">✓ found on the page</span>}
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted">No source recorded.</p>
              )}
            </div>
          ))}
        </section>
      </div>
    </aside>
  );
}

// Tavily sometimes returns its own company-profile pages; they aren't news. (Graphs built before the server-side filter still have them.)
const newsItems = (n: GNode) => (n.news?.items ?? []).filter((i) => !/(^|\.)tavily\.com$/.test(hostOf(i.url)));

function NewsPulse({ items }: { items: NonNullable<GNode["news"]>["items"] }) {
  return (
    <section aria-label="This week's news" className="flex flex-col gap-2 border-b border-line px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`${mono} text-xs font-semibold text-muted`}>THIS WEEK&apos;S NEWS</span>
        <span className="text-[11px] text-muted">via Tavily · {items.length} headline{items.length === 1 ? "" : "s"}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[13px] text-muted">Nothing new this week.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.slice(0, 4).map((i) => (
            <li key={i.url} className="flex items-baseline justify-between gap-3 text-[13px]">
              <a href={i.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-ink no-underline hover:underline">
                {i.title}
              </a>
              <span className={`${mono} shrink-0 text-[11px] text-muted`}>{hostOf(i.url)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TickPanel({ tick }: { tick: TickResult }) {
  const qualified = tick.events.filter((e) => e.qualified).length;
  const time = new Date(tick.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <section className="flex flex-col gap-3 border-b border-line px-5 py-4">
      <div className="flex flex-wrap justify-between gap-2 text-xs">
        <span className={`font-semibold ${qualified ? "text-risk-ink" : "text-ink"}`}>
          {qualified ? `${qualified} confirmed problem${qualified === 1 ? "" : "s"}` : "No confirmed problems"}
        </span>
        <span className="text-muted">
          {tick.candidates} articles read · {time}
        </span>
      </div>
      {tick.events.length === 0 && <p className="text-[13px] text-muted">No news about this supplier in the last month.</p>}
      {tick.events.map((e) => (
        <EventCard key={e.url} e={e} />
      ))}
    </section>
  );
}

function EventCard({ e }: { e: TickEvent }) {
  const checks: [string, boolean][] = [
    ["About this supplier", e.about],
    ["Real production impact", e.impact.met && e.impact.verified],
    ["Trustworthy source", e.credible.met],
    ["Last 30 days", e.recent.met],
  ];
  return (
    <article className={`flex flex-col gap-1.5 rounded-md border p-3 ${e.qualified ? "border-risk-line bg-risk-tint" : "border-line bg-card"}`}>
      <p className="text-[13px] font-medium leading-snug">{e.headline}</p>
      <p className="text-xs leading-relaxed">
        {checks.map(([label, met]) => (
          <span key={label} className={`mr-2 inline-block ${met ? "text-amber-ink" : "text-muted"}`}>
            {met ? "✓" : "✕"} {label}
          </span>
        ))}
      </p>
      {e.impact.quote && e.impact.verified && (
        <p className="border-l-2 border-line-strong pl-2.5 text-xs leading-relaxed text-[#47443D]">{e.impact.quote}</p>
      )}
      <a href={e.url} target="_blank" rel="noreferrer" className={`${mono} w-fit text-[11px] text-muted no-underline hover:text-ink`}>
        {hostOf(e.url)} ↗{e.recent.days !== null && ` · ${e.recent.days === 0 ? "today" : `${e.recent.days}d ago`}`}
      </a>
    </article>
  );
}

// Same output on server and client (toLocaleString differs by runtime locale/timezone → hydration mismatch).
function fmtUTC(iso?: string) {
  const d = new Date(iso ?? "");
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.toUTCString().slice(8, 11)} ${d.getUTCDate()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

function defaultSelection(g: Graph) {
  return (g.nodes.find((n) => n.spof && n.tier > 0) ?? g.nodes.find((n) => n.tier > 0) ?? g.nodes[0])?.id ?? "";
}
const nameOf = (g: Graph, id: string) => g.nodes.find((n) => n.id === id)?.name ?? id;
function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
const Chip = ({ children }: { children: React.ReactNode }) => <span className="rounded-[3px] border border-line px-1.5 py-px">{children}</span>;
const Legend = ({ dot, label }: { dot: string; label: string }) => (
  <span className="flex items-center gap-1.5">
    <span className={`h-2 w-2 rounded-full ${dot}`} />
    {label}
  </span>
);
