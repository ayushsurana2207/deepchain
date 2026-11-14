export type TavilyResult = {
  url: string;
  title: string;
  content: string;
  raw_content?: string | null;
  published_date?: string | null;
};

export type TavilyNews = { results: TavilyResult[]; credits: number; latencyMs: number };

type NewsOpts = { timeRange?: "day" | "week" | "month"; max?: number; raw?: boolean; deep?: boolean };

/** Recent news search (Tavily, called directly). Throws on HTTP errors or after `timeoutMs`. */
export async function searchNews(query: string, opts: NewsOpts = {}, timeoutMs = 8000): Promise<TavilyNews> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY is not set");
  const started = Date.now();
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      topic: "news",
      time_range: opts.timeRange ?? "month",
      max_results: opts.max ?? 6,
      include_raw_content: opts.raw === false ? false : "text",
      search_depth: opts.deep ? "advanced" : "basic",
      include_usage: true,
    }),
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return { results: data.results ?? [], credits: data.usage?.credits ?? 0, latencyMs: Date.now() - started };
}
