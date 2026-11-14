// Telem Monitor Agents (hackathon server). Every run is billed to the Telem account, so monitors are only
// created on an explicit user click, capped per graph, and given budget caps on creation.

const base = () => process.env.TELEM_BASE_URL ?? "https://router.telem.ai";

async function tm<T>(path: string, init: { method?: string; body?: unknown } = {}, timeoutMs = 15000): Promise<T> {
  const key = process.env.TELEM_API_KEY;
  if (!key) throw new Error("TELEM_API_KEY is not set");
  const res = await fetch(`${base()}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 200);
    try {
      const j = JSON.parse(text);
      msg = j.error?.message ?? j.detail ?? msg;
    } catch {}
    throw new MonitorError(res.status, String(msg));
  }
  return JSON.parse(text) as T;
}

export class MonitorError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Generous guard against a runaway agent, not a spending limit (a $0.25/tick cap made Telem skip checks with stop_reason "budget_estimate").
export const BUDGET = { daily_budget_usd: 5, tick_budget_usd: 2, chat_budget_usd: 1 };
export const MAX_MONITORS_PER_GRAPH = 4;

export type Verdict = { verdict: string; quote: string | null; url: string | null };
export type MonitorView = {
  id: string;
  query: string;
  status: string; // active | paused | ended
  agentStatus: string; // compiling | ready | paused | failed
  specVersion: number;
  criteria: { id: string; name: string; hard: boolean; text: string }[];
  counts: { objects: number; qualified: number; candidates: number; rejected: number; unclear: number; alerts_24h: number };
  spendUsd: number;
  budget: Record<string, number> | null;
  nextTickAt: string | null;
  expiresAt: string | null;
  runningJob: { id: string; kind: string } | null;
  lastTick: { tick: number; finishedAt: string | null; usd: number; newObjects: number; alerts: number; stopReason: string | null } | null;
  sources: { step: string; rows: number; status: string }[];
  objects: { name: string; status: string; url: string | null; criteria: Record<string, Verdict> }[];
  suggestions: string[];
};

type AgentRaw = {
  status: string;
  spec_version: number;
  spec: { criteria?: { id: string; name: string; hard?: boolean; text: string }[] } | null;
  counts: MonitorView["counts"];
  ticks: { tick: number; finished_at: string | null; usd: number; new_objects: number; alerts: number; stop_reason: string | null }[];
  next_tick_at: string | null;
  spend_usd: number;
  budget: Record<string, number> | null;
  source_health: { step: string; rows: number; status: string }[];
  running_job: { id: string; kind: string } | null;
  suggested_prompts: string[];
};
type MonitorRaw = { id: string; query: string; status: string; expires_at: string | null };
type ObjectRaw = { name: string; status: string; urls: string[]; criteria: Record<string, Verdict> };

export async function createMonitor(query: string): Promise<string> {
  const m = await tm<MonitorRaw>("/v1/monitors", {
    method: "POST",
    body: { query, options: { frequency: "1d" }, ttl: "7d", agent: true },
  });
  try {
    await tm(`/v1/monitors/${m.id}/agent`, { method: "PATCH", body: { budget: BUDGET } });
  } catch (e) {
    // A monitor without a budget cap must not keep running: remove it and surface the error.
    await tm(`/v1/monitors/${m.id}`, { method: "DELETE" }).catch(() => {});
    throw e;
  }
  return m.id;
}

export async function getMonitorView(id: string): Promise<MonitorView> {
  const [m, a, o] = await Promise.all([
    tm<MonitorRaw>(`/v1/monitors/${id}`),
    tm<AgentRaw>(`/v1/monitors/${id}/agent`),
    tm<{ objects: ObjectRaw[] }>(`/v1/monitors/${id}/agent/objects?limit=25`).catch(() => ({ objects: [] })),
  ]);
  // Telem lists ticks oldest first; the latest is the highest tick number.
  const t = a.ticks.reduce<AgentRaw["ticks"][number] | undefined>((x, y) => (!x || y.tick > x.tick ? y : x), undefined);
  return {
    id,
    query: m.query,
    status: m.status,
    agentStatus: a.status,
    specVersion: a.spec_version,
    criteria: (a.spec?.criteria ?? []).map((c) => ({ id: c.id, name: c.name, hard: !!c.hard, text: c.text })),
    counts: a.counts,
    spendUsd: a.spend_usd,
    budget: a.budget,
    nextTickAt: a.next_tick_at,
    expiresAt: m.expires_at,
    runningJob: a.running_job ? { id: a.running_job.id, kind: a.running_job.kind } : null,
    lastTick: t ? { tick: t.tick, finishedAt: t.finished_at, usd: t.usd, newObjects: t.new_objects, alerts: t.alerts, stopReason: t.stop_reason } : null,
    sources: a.source_health.map((s) => ({ step: s.step, rows: s.rows, status: s.status })),
    objects: o.objects.map((x) => ({ name: x.name, status: x.status, url: x.urls[0] ?? null, criteria: x.criteria })),
    suggestions: a.suggested_prompts ?? [],
  };
}

export async function runTickNow(id: string) {
  return tm<{ job_id: string }>(`/v1/monitors/${id}/agent/ticks`, { method: "POST" });
}

export async function steer(id: string, message: string) {
  return tm<{ job_id: string; message_id: string }>(`/v1/monitors/${id}/agent/chat`, { method: "POST", body: { message } });
}

export async function getJob(id: string, jobId: string) {
  return tm<{ id: string; kind: string; status: string; usd: number; error: string | null }>(`/v1/monitors/${id}/agent/jobs/${jobId}`);
}

export async function deleteMonitor(id: string) {
  await tm(`/v1/monitors/${id}`, { method: "DELETE" });
}
