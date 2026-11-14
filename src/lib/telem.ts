// Telem router client (hackathon server: TELEM_BASE_URL=https://hack.telem.ai/api).
// Response shape: each provider's results live in preprocessor_runs[].output_payload.

const base = () => process.env.TELEM_BASE_URL ?? "https://router.telem.ai";

async function call(path: string, body: unknown, timeoutMs: number) {
  const key = process.env.TELEM_API_KEY;
  if (!key) throw new Error("TELEM_API_KEY is not set");
  const res = await fetch(`${base()}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Telem ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export type SearchHit = { url: string; title: string; summary: string; provider: string; rank: number };
export type SearchResult = { query: string; providers: string[]; hits: SearchHit[]; latencyMs: number };

type Run = { preprocessor_name: string; status: string; output_payload?: Record<string, unknown> | null };

export async function telemSearch(query: string, opts: { providers?: string[]; num?: number } = {}, timeoutMs = 8000): Promise<SearchResult> {
  const started = Date.now();
  const search: Record<string, unknown> = { num_results: opts.num ?? 5 };
  if (opts.providers) search.providers = { include: opts.providers };
  else search.auto_routing = "accuracy";
  const data = await call("/v1/search", { user_input: { query }, search }, timeoutMs);

  const runs: Run[] = data.preprocessor_runs ?? [];
  const hits: SearchHit[] = [];
  for (const run of runs) {
    if (run.status !== "succeeded") continue;
    const results = (run.output_payload?.results as Record<string, unknown>[] | undefined) ?? [];
    for (const r of results) {
      if (typeof r.url !== "string") continue;
      hits.push({
        url: r.url,
        title: String(r.title ?? ""),
        summary: String(r.summary ?? ""),
        provider: run.preprocessor_name,
        rank: Number(r.rank ?? 99),
      });
    }
  }
  return { query, providers: runs.filter((r) => r.status === "succeeded").map((r) => r.preprocessor_name), hits, latencyMs: Date.now() - started };
}

export type FetchedPage = { url: string; title: string; content: string; provider: string; latencyMs: number };
export type FetchResult = { pages: FetchedPage[]; failed: { url: string; error: string }[]; latencyMs: number };

/** Fetch up to 5 URLs as markdown (Telem's per-call limit). */
export async function telemFetch(urls: string[], timeoutMs = 15000): Promise<FetchResult> {
  const started = Date.now();
  const data = await call("/v1/fetch", { urls: urls.slice(0, 5), options: { tier: "default" } }, timeoutMs);
  const pages: FetchedPage[] = [];
  const failed: { url: string; error: string }[] = [];
  for (const run of (data.preprocessor_runs ?? []) as Run[]) {
    for (const r of (run.output_payload?.fetched_results as Record<string, unknown>[] | undefined) ?? []) {
      const content = typeof r.content === "string" ? r.content : "";
      if (r.status === "succeeded" && content) {
        pages.push({
          url: String(r.canonical_url ?? r.url),
          title: String(r.title ?? ""),
          content,
          provider: String(r.provider ?? run.preprocessor_name),
          latencyMs: Number(r.latency_ms ?? 0),
        });
      } else {
        failed.push({ url: String(r.url), error: String(r.error ?? "no content") });
      }
    }
  }
  return { pages, failed, latencyMs: Date.now() - started };
}
