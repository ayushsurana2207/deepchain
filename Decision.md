# Decision log

## 2026-11-14 — Stack: Next.js App Router + TypeScript, Claude for extraction
**Decision:** Build as a single Next.js (App Router, TypeScript) app. Claude API handles supplier/edge extraction and per-criterion risk verdicts via structured JSON output.
**Why:** One deployable for UI + API routes; user has Claude API credits; Claude is reliable at strict JSON.
**Alternatives considered:** Separate Python backend (extra process to run during a solo hackathon); other LLMs (no credits).

## 2026-11-14 — Telem for discovery + fetch + background monitors; Tavily direct for Live Tick
**Decision:** Graph discovery uses one Telem `/v1/search` call with 3 batched queries (auto-routing; live-news query pinned to Tavily), then Telem `/v1/fetch` for clean markdown. Critical SPOF nodes get Telem monitors (`frequency: 1d`, `ttl: 7d`, max 5 per graph) read via `/agent/changes`. "Run Live Tick" calls Tavily search (news, last 7d) + extract directly.
**Why:** Telem docs only document search, fetch, and monitors with an `/agent/changes` feed; there is no on-demand tick, `/agent/chat`, per-criterion verdicts, `spend_usd` or `source_health`, and the fastest monitor frequency is 1h. Tavily direct gives a seconds-fast check with relative time ranges and spends Tavily credits (8k) instead of Telem dollars ($50).
**Alternatives considered:** Telem monitors as the Live Tick (no on-demand trigger, ≥1h cadence); everything through Telem (burns the $50 budget on repeated demo clicks).

## 2026-11-14 — Verdicts and "steering" are ours, not Telem's
**Decision:** Claude grades each risk event against our criteria (direct production impact, primary/trade source, published ≤30 days) with a supporting quote; a node breaches when an event meets all criteria. "Steer" edits our own criteria/query; a materially new query creates a new monitor (Telem monitor queries are immutable).
**Why:** Telem has no per-criterion verdict or plan-chat endpoints.
**Alternatives considered:** Spec's `/agent/chat` steering (does not exist).

## 2026-11-14 — Quotes must match source text exactly
**Decision:** An extracted node/edge enters the graph only if its quote is an exact (whitespace-normalized) substring of the fetched page content; rejects are shown in the build log.
**Why:** Makes the "no hallucinations" claim checkable and demoable.
**Alternatives considered:** Trusting LLM-provided quotes (unverifiable).

## 2026-11-14 — Live first, cache fallback
**Decision:** Every external call goes live with an 8s timeout; responses are written to `data/store.json` keyed by request; on failure the cached response is served. UI labels each panel LIVE or CACHED.
**Why:** Venue Wi-Fi/rate limits; new scenarios become cached automatically after first use.
**Alternatives considered:** Cache-only demo (can't handle new targets); live-only (fragile on stage).

## 2026-11-14 — Hand-rolled graph layout, no node-canvas library
**Decision:** Fixed 4-column absolute layout with an SVG overlay of Bezier connectors; breach paths animate as red dashes.
**Why:** Deterministic layout that never breaks; matches mockups; no dependency.
**Alternatives considered:** React Flow / Cytoscape (heavier, layout surprises).

## 2026-11-14 — Two-color palette: cobalt blue + red
**Decision:** Neutral zinc base plus exactly two accents. Cobalt blue (#2563EB, text #1D4ED8, navy top bar #0B1739) means interaction, selection, monitors, and verified evidence. Red (#DC2626, text #B91C1C) means risk only; "watch" is a light red tint, breach/contagion is full red.
**Why:** Pure monochrome mocks read too plain; limiting to two hues keeps the institutional look and makes red unambiguous as "risk".
**Alternatives considered:** Green for verified + amber for watch (four hues, noisier; red/green also hard for color-blind viewers).

## 2026-11-14 — Palette revised: terminal amber + signal red (supersedes "Two-color palette: cobalt blue + red")
**Decision:** Warm paper canvas #F7F6F2, borders #E6E3DC, ink #1C1B18 text and top bar, muted #5C5850. Amber #C98A1B (text #8A5A00) for live / selected / monitor / primary action / verified. Signal red #C2341F (text #A12A18) for risk only.
**Why:** User found the cobalt blue read as generic "AI SaaS". Amber on ink gives a finance-terminal feel and stays two-hue.
**Alternatives considered:** Drafting green + vermilion; ink-only + red (both offered, user picked amber).
