"use client";

import type { BuildEvent } from "@/lib/assemble";

const mono = "font-mono";
const STEP_LABEL = {
  search: "1 · Search filings, teardowns and news",
  fetch: "2 · Read the pages",
  leads: "3 · Find likely chokepoints, search each one",
  extract: "4 · Pull out who supplies whom, check every quote",
  pulse: "5 · Tavily news pulse for every supplier",
} as const;

export default function BuildLog({ target, events, error }: { target: string; events: BuildEvent[]; error: string | null }) {
  const status: Record<string, string> = {};
  for (const e of events) if (e.type === "step") status[e.step] = e.status;
  const done = events.find((e) => e.type === "graph");
  const verified = events.filter((e) => e.type === "edge" && e.verdict === "verified").length;
  const rejected = events.filter((e) => e.type === "edge" && e.verdict === "rejected").length;

  return (
    <aside aria-label="Build log" className="flex min-w-0 flex-[36_1_360px] flex-col bg-card lg:h-full">
      <div className="min-h-0 flex-1 overflow-auto px-5 py-5" aria-live="polite">
        <p className={`${mono} text-[11px] tracking-[0.04em] text-muted`}>SEARCHING</p>
        <h2 className="mt-1 text-lg font-semibold">{target}</h2>

        <ol className="mt-4 flex flex-col gap-5">
          {(Object.keys(STEP_LABEL) as (keyof typeof STEP_LABEL)[]).map((step) => (
            <li key={step} className={`flex flex-col gap-2 ${status[step] ? "" : "opacity-50"}`}>
              <div className="flex items-center justify-between gap-2 text-[13px] font-semibold">
                <span>{STEP_LABEL[step]}</span>
                <StepStatus s={status[step]} />
              </div>
              <div className={`${mono} flex flex-col gap-1 text-[11px]`}>
                {stepRows(step, events)}
              </div>
            </li>
          ))}
        </ol>

        {error && (
          <p role="alert" className="mt-5 rounded-md border border-risk-line bg-risk-tint px-3 py-2 text-[13px] text-risk-ink">
            {error}
          </p>
        )}
        {done && done.type === "graph" && (
          <p className="mt-5 rounded-md border border-amber-line bg-amber-tint px-3 py-2 text-[13px] text-amber-ink">
            Done in {(done.stats.ms / 1000).toFixed(0)}s · {verified} links confirmed · {rejected} thrown out · {done.stats.pages} pages from{" "}
            {done.stats.providers.length} sources · {done.stats.tavilyCredits} Tavily credits
          </p>
        )}
      </div>
    </aside>
  );
}

function StepStatus({ s }: { s?: string }) {
  if (s === "running")
    return (
      <span className={`${mono} flex items-center gap-1.5 text-[11px] text-amber-ink`}>
        <span className="pulse h-1.5 w-1.5 rounded-full bg-amber" />
        RUNNING
      </span>
    );
  if (s === "done") return <span className={`${mono} text-[11px] text-amber-ink`}>DONE</span>;
  if (s === "failed") return <span className={`${mono} text-[11px] text-risk-ink`}>FAILED</span>;
  return <span className={`${mono} text-[11px] text-muted`}>QUEUED</span>;
}

const Pill = ({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) => (
  <span className={`rounded-full border px-1.5 ${strong ? "border-amber bg-amber text-ink" : "border-line text-muted"}`}>{children}</span>
);

function stepRows(step: keyof typeof STEP_LABEL, events: BuildEvent[]) {
  const seedSearches = events.filter((e) => e.type === "search").slice(0, 3);
  if (step === "search")
    return seedSearches.map((e) =>
      e.type === "search" ? (
        <div key={e.label} className="flex flex-wrap items-center gap-1.5">
          <span className="w-28 shrink-0 text-ink-2">{e.label}</span>
          {e.providers.map((p) => (
            <Pill key={p} strong={p === "tavily"}>{p}</Pill>
          ))}
          <span className="text-muted">{e.hits} hits · {e.latencyMs}ms</span>
        </div>
      ) : null,
    );
  if (step === "fetch")
    return events
      .filter((e) => e.type === "fetch" && e.label === "Seed pages")
      .map((e) => (e.type === "fetch" ? <FetchRow key={e.label} e={e} /> : null));
  if (step === "leads") {
    const leads = events.find((e) => e.type === "leads");
    const leadSearches = events.filter((e) => e.type === "search").slice(3);
    return (
      <>
        {leads?.type === "leads" &&
          leads.leads.map((l) => {
            const name = l.split(" · ")[0];
            const s = leadSearches.find((e) => e.type === "search" && e.label === name);
            return (
              <div key={l} className="flex items-center justify-between gap-2">
                <span className="truncate text-ink-2">{name}</span>
                <span className="shrink-0 text-muted">{s?.type === "search" ? `${s.providers.length} providers · ${s.hits} hits` : "searching…"}</span>
              </div>
            );
          })}
        {events
          .filter((e) => e.type === "fetch" && e.label === "Lead pages")
          .map((e) => (e.type === "fetch" ? <FetchRow key={e.label} e={e} /> : null))}
      </>
    );
  }
  if (step === "pulse")
    return events
      .filter((e) => e.type === "pulse")
      .map((e, i) =>
        e.type === "pulse" ? (
          <div key={i} className="flex justify-between gap-2">
            <span className="truncate text-ink-2">{e.name}</span>
            <span className="shrink-0 text-muted">{e.count < 0 ? "unavailable" : `${e.count} headline${e.count === 1 ? "" : "s"} this week`}</span>
          </div>
        ) : null,
      );
  return events
    .filter((e) => e.type === "edge")
    .map((e, i) =>
      e.type === "edge" ? (
        <div
          key={i}
          className={`flex justify-between gap-2 rounded-md border px-2 py-1 ${e.verdict === "verified" ? "border-line" : "border-risk-line bg-risk-tint"}`}
        >
          <span className="truncate">{e.from} → {e.to}</span>
          <span className={`shrink-0 ${e.verdict === "verified" ? "text-amber-ink" : "text-risk-ink"}`}>
            {e.verdict === "verified" ? "✓ found on page" : `✕ ${e.reason}`}
          </span>
        </div>
      ) : null,
    );
}

function FetchRow({ e }: { e: Extract<BuildEvent, { type: "fetch" }> }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-28 shrink-0 text-ink-2">{e.label}</span>
      <span className="text-muted">
        {e.ok} ok{e.failed ? ` · ${e.failed} failed` : ""} · {Math.round(e.chars / 1000)}k chars md · {(e.latencyMs / 1000).toFixed(1)}s
      </span>
      {e.providers.map((p) => (
        <Pill key={p}>{p}</Pill>
      ))}
    </div>
  );
}
