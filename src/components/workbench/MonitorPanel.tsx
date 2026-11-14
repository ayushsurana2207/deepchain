"use client";

import { useState } from "react";
import type { MonitorView } from "@/lib/monitors";

const mono = "font-mono";
const STOP_REASON: Record<string, string> = {
  budget_estimate: "it would have gone over the monitor's budget cap",
  budget: "it hit the monitor's budget cap",
  deadline: "it ran out of time",
};

export type MonitorState = MonitorView | { error: string } | undefined;

function rel(iso: string | null) {
  if (!iso) return "—";
  const ms = Date.parse(iso) - Date.now();
  const h = Math.round(Math.abs(ms) / 3_600_000);
  const m = Math.round(Math.abs(ms) / 60_000);
  const span = h >= 48 ? `${Math.round(h / 24)}d` : h >= 1 ? `${h}h` : `${m}m`;
  return ms >= 0 ? `in ${span}` : `${span} ago`;
}

const host = (u: string | null) => {
  try {
    return u ? new URL(u).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
};

export default function MonitorPanel({
  monitor, suggested, busy, error, canCreate, onCreate, onTick, onSteer, onStop,
}: {
  monitor: MonitorState;
  suggested: boolean;
  busy: string | null; // "create" | "tick" | "steer" | "stop"
  error: string | null;
  canCreate: boolean;
  onCreate: () => void;
  onTick: () => void;
  onSteer: (message: string) => void;
  onStop: () => void;
}) {
  const [draft, setDraft] = useState("");

  const header = (label: string, tone: "on" | "off" | "warn", right?: React.ReactNode) => (
    <div className={`${mono} flex flex-wrap items-center justify-between gap-2 text-xs`}>
      <span className={`flex items-center gap-2 font-semibold ${tone === "on" ? "text-amber-ink" : tone === "warn" ? "text-risk-ink" : "text-muted"}`}>
        <span className={`h-[7px] w-[7px] rounded-full ${tone === "on" ? "bg-amber" : tone === "warn" ? "bg-risk" : "bg-line-strong"} ${busy ? "pulse" : ""}`} />
        {label}
      </span>
      {right}
    </div>
  );
  const errorBox = error && (
    <p role="alert" className="rounded-md border border-risk-line bg-risk-tint px-3 py-2 text-[13px] text-risk-ink">{error}</p>
  );

  if (!monitor) {
    return (
      <section aria-label="Telem monitor" className="flex flex-col gap-3 border-b border-line px-5 py-4">
        {header("TELEM MONITOR · OFF", "off", suggested && <span className="rounded-[3px] border border-amber-line bg-amber-tint px-1.5 text-[10px] text-amber-ink">SUGGESTED</span>)}
        <p className="text-[13px] leading-relaxed text-muted">
          Have Telem watch this supplier every day for a week. It writes its own search plan, checks each article it finds against clear
          criteria, and flags anything that qualifies.
        </p>
        <button
          onClick={onCreate}
          disabled={!!busy || !canCreate}
          className="h-10 rounded-md border border-ink bg-ink text-[13px] font-medium text-paper transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "create" ? "Starting monitor…" : canCreate ? "Start monitor" : "Monitor limit reached for this graph"}
        </button>
        {errorBox}
      </section>
    );
  }

  if ("error" in monitor) {
    return (
      <section aria-label="Telem monitor" className="flex flex-col gap-3 border-b border-line px-5 py-4">
        {header("TELEM MONITOR · UNREACHABLE", "warn")}
        <p className="text-[13px] text-muted">{monitor.error}</p>
      </section>
    );
  }

  const m = monitor;
  const compiling = m.agentStatus === "compiling";
  const running = !!m.runningJob;
  const label = compiling ? "BUILDING PLAN…" : m.status !== "active" ? `MONITOR ${m.status.toUpperCase()}` : `MONITOR ACTIVE · PLAN v${m.specVersion}`;
  const hard = m.criteria.filter((c) => c.hard);
  const soft = m.criteria.filter((c) => !c.hard);
  const groups = groupFindings(m);

  return (
    <section aria-label="Telem monitor" className="flex flex-col gap-3 border-b border-line px-5 py-4">
      {header(label, m.counts.qualified ? "warn" : "on", <span className="text-[11px] text-muted">${m.spendUsd.toFixed(2)} spent</span>)}

      <dl className={`${mono} grid grid-cols-3 gap-2 text-[11px]`}>
        <div>
          <dt className="text-muted">NEXT CHECK</dt>
          <dd>{running ? "running now" : compiling ? "after plan" : rel(m.nextTickAt)}</dd>
        </div>
        <div>
          <dt className="text-muted">LAST CHECK</dt>
          <dd>{m.lastTick?.finishedAt ? rel(m.lastTick.finishedAt) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted">ENDS</dt>
          <dd>{rel(m.expiresAt)}</dd>
        </div>
      </dl>

      {!running && m.lastTick?.stopReason && m.lastTick.stopReason !== "done" && (
        <p className="rounded-md border border-risk-line bg-risk-tint px-3 py-2 text-[13px] text-risk-ink">
          The last check stopped early ({STOP_REASON[m.lastTick.stopReason] ?? m.lastTick.stopReason.replace(/_/g, " ")}).
        </p>
      )}

      {(compiling || running) && (
        <p className="flex items-center gap-2 rounded-md border border-amber-line bg-amber-tint px-3 py-2 text-[13px] text-amber-ink">
          <span aria-hidden="true" className="pulse h-1.5 w-1.5 rounded-full bg-amber" />
          {compiling
            ? "Telem is writing a watch plan for this supplier. This takes a minute or two."
            : m.runningJob?.kind === "chat"
              ? "Updating the watch plan…"
              : "Checking sources now…"}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={onTick}
          disabled={!!busy || compiling || running}
          className="h-10 flex-1 rounded-md border border-ink bg-ink text-[13px] font-medium text-paper transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "tick" ? "Starting check…" : "Run monitor check now"}
        </button>
        <button
          onClick={() => window.confirm("Stop this monitor? Telem stops checking and its findings are removed.") && onStop()}
          disabled={!!busy}
          className="h-10 rounded-md border border-line px-3 text-[13px] hover:border-risk hover:text-risk-ink disabled:opacity-50"
        >
          {busy === "stop" ? "Stopping…" : "Stop"}
        </button>
      </div>
      {errorBox}

      <Summary m={m} groups={groups} />

      {m.criteria.length > 0 && (
        <p className="text-[13px] leading-relaxed text-ink-2">
          <span className="text-muted">Looks for articles that match: </span>
          {hard.map((c) => c.name).join(" · ")}
          {soft.length > 0 && <span className="text-muted">. Ideally also: {soft.map((c) => c.name).join(" · ")}</span>}
        </p>
      )}

      {groups.confirmed.length > 0 && (
        <FindingList title="Confirmed problems" tone="risk" items={groups.confirmed} criteria={m.criteria} />
      )}
      {groups.worth.length > 0 && <FindingList title="Worth a look" tone="amber" items={groups.worth} criteria={m.criteria} />}

      {groups.other.length > 0 && (
        <details className="group rounded-md border border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[13px] text-muted hover:text-ink">
            <span>Other articles it checked ({groups.other.length})</span>
            <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
          </summary>
          <ul className="flex flex-col border-t border-line">
            {groups.other.map((o) => (
              <li key={o.url ?? o.name} className="flex items-baseline justify-between gap-3 border-b border-line px-3 py-2 text-[13px] last:border-b-0">
                <span className="line-clamp-1 text-ink-2">{clean(o.name)}</span>
                {o.url && (
                  <a href={o.url} target="_blank" rel="noreferrer" className={`${mono} shrink-0 text-[11px] text-muted no-underline hover:text-ink`}>
                    {host(o.url)} ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="group rounded-md border border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-[13px] text-muted hover:text-ink">
          <span>Change what it watches</span>
          <span aria-hidden="true" className="transition-transform group-open:rotate-90">›</span>
        </summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim().length >= 3) {
              onSteer(draft.trim());
              setDraft("");
            }
          }}
          className="flex flex-col gap-2 border-t border-line p-3"
        >
          <label htmlFor="steer" className="text-xs text-muted">
            Tell it in plain words. It rewrites its own search plan.
          </label>
          <div className="flex gap-1.5">
            <input
              id="steer"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={500}
              placeholder="e.g. Also watch Korean export licensing news"
              disabled={!!busy || compiling || running}
              className="h-9 min-w-0 flex-1 rounded-md border border-line-strong px-2.5 text-[13px] focus:border-ink focus:outline-none disabled:opacity-60"
            />
            <button
              disabled={!!busy || compiling || running || draft.trim().length < 3}
              className="h-9 rounded-md border border-line px-3 text-[13px] hover:border-ink disabled:opacity-50"
            >
              {busy === "steer" ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </details>

      {m.sources.length > 0 && (
        <p className="text-[11px] leading-relaxed text-muted">
          Searching {m.sources.length} source{m.sources.length === 1 ? "" : "s"}: {m.sources.map((s) => s.step.replace(/_/g, " ")).join(", ")}
        </p>
      )}
    </section>
  );
}

type Finding = MonitorView["objects"][number];
type Criterion = MonitorView["criteria"][number];
type Groups = { confirmed: Finding[]; worth: Finding[]; other: Finding[] };

const clean = (s: string) => s.replace(/^\[[^\]]+\]\s*/, "").replace(/\s*\.\.\.$|\s*…$/, "");
const yesCount = (o: Finding) => Object.values(o.criteria).filter((v) => v?.verdict === "yes").length;

/** Confirmed = Telem qualified it. Worth a look = meets 2+ criteria and wasn't ruled out. Everything else is background. */
function groupFindings(m: MonitorView): Groups {
  const g: Groups = { confirmed: [], worth: [], other: [] };
  for (const o of m.objects) {
    if (o.status === "qualified") g.confirmed.push(o);
    else if (o.status !== "rejected" && yesCount(o) >= 2) g.worth.push(o);
    else g.other.push(o);
  }
  g.worth.sort((a, b) => yesCount(b) - yesCount(a));
  return g;
}

function Summary({ m, groups }: { m: MonitorView; groups: Groups }) {
  const n = m.counts.qualified;
  const checked = m.counts.objects;
  return (
    <div className={`rounded-md border px-3 py-2.5 ${n ? "border-risk-line bg-risk-tint" : "border-line bg-paper"}`}>
      <p className={`text-[15px] font-semibold ${n ? "text-risk-ink" : "text-ink"}`}>
        {checked === 0 ? "No articles checked yet" : n ? `${n} confirmed problem${n === 1 ? "" : "s"}` : "No confirmed problems"}
      </p>
      {checked > 0 && (
        <p className="mt-0.5 text-xs text-muted">
          {checked} articles checked · {groups.worth.length} worth a look · {m.counts.rejected} ruled out
        </p>
      )}
    </div>
  );
}

function FindingList({ title, tone, items, criteria }: { title: string; tone: "risk" | "amber"; items: Finding[]; criteria: Criterion[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className={`text-[13px] font-semibold ${tone === "risk" ? "text-risk-ink" : "text-ink"}`}>
        {title} <span className="font-normal text-muted">({items.length})</span>
      </p>
      {items.map((o) => {
        const met = criteria.filter((c) => o.criteria[c.id]?.verdict === "yes");
        const open = criteria.filter((c) => c.hard && o.criteria[c.id]?.verdict !== "yes");
        // Prefer the quote that proves the most specific criterion met (the last one), not the "is it about the supplier" one.
        const proof = [...met].reverse().map((c) => o.criteria[c.id]).find((v) => v?.quote);
        return (
          <article key={o.url ?? o.name} className={`flex flex-col gap-1.5 rounded-md border p-3 ${tone === "risk" ? "border-risk-line bg-risk-tint" : "border-line bg-card"}`}>
            <p className="text-[13px] font-medium leading-snug">{clean(o.name)}</p>
            <p className="text-xs leading-relaxed">
              {met.map((c) => (
                <span key={c.id} className="mr-2 inline-block text-amber-ink">✓ {c.name}</span>
              ))}
              {open.map((c) => (
                <span key={c.id} className="mr-2 inline-block text-muted">? {c.name}</span>
              ))}
            </p>
            {proof?.quote && <p className="border-l-2 border-line-strong pl-2.5 text-xs leading-relaxed text-[#47443D]">{proof.quote}</p>}
            {o.url && (
              <a href={o.url} target="_blank" rel="noreferrer" className={`${mono} w-fit text-[11px] text-muted no-underline hover:text-ink`}>
                {host(o.url)} ↗
              </a>
            )}
          </article>
        );
      })}
    </div>
  );
}
