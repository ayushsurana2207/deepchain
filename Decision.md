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

## 2026-11-14 — Auth: built-in email + password, no auth library
**Decision:** Sign-up/sign-in via Next.js server actions. Passwords hashed with Node `scrypt` (per-user salt, timing-safe compare); session is an HMAC-SHA256-signed `userId.expiry` value in an httpOnly, SameSite=Lax cookie (Secure in production), 7-day expiry. Users stored in `data/users.json` (gitignored). `/app` checks the session on the server and redirects to `/signin` if missing. Secret from `AUTH_SECRET`, else generated once into `data/.auth-secret`.
**Why:** Solo hackathon build: zero external setup (no OAuth apps, no hosted auth keys), no new dependencies, still safe for a demo.
**Alternatives considered:** Auth.js / Clerk (OAuth app or account setup, more moving parts for a one-day demo); no auth (user asked for sign-in/sign-up). Upgrade path: swap the JSON file for a DB and add login rate limiting before real users.

## 2026-11-14 — Workbench runs on labelled sample graphs until keys are configured
**Decision:** Three hand-written scenario graphs (`src/data/seeds.ts`, `source: "sample"`, no evidence) drive the workbench UI. A "SAMPLE" badge and "No cited source yet" placeholders make this explicit. In sample mode only, a "Simulate breach" button exercises the real propagation code. Run Live Tick and custom targets stay disabled until API keys exist. ASML seed lists actual ASML suppliers (Zeiss, Trumpf, VDL, Schott); Tokyo Ohka Kogyo from the original spec was left out because photoresist is consumed by chipmakers, not supplied to ASML.
**Why:** No `.env.local` yet; lets UI + propagation be built and tested independently of the APIs, and gives an honest offline fallback.
**Alternatives considered:** Fabricated quotes/sources in seeds (would undermine the "every edge has a receipt" claim); blocking on keys (stalls the build).

## 2026-11-14 — Propagation = BFS downstream; tests via node:test, no test framework
**Decision:** `propagate()` marks breached nodes, BFS over `from → to` edges marks reachable nodes contagion (target: at risk), returns hot edges. Unit tests use Node 24's built-in `node:test` with native TS type-stripping (`npm test`), which needs `allowImportingTsExtensions` in tsconfig.
**Why:** Zero added dependencies; propagation is the core logic and must be correct.
**Alternatives considered:** Vitest/Jest (extra dependency for 7 tests).

## 2026-11-14 — Live Tick: Tavily news → Claude grading → deterministic checks
**Decision:** `POST /api/tick` (signed-in users only) searches Tavily news (last month, raw text, 1 credit), then `claude-opus-5-5` (effort medium, structured output via `betaZodOutputFormat`, server-side refusal fallbacks `fallbacks: "default"`) grades each article: about-supplier, production impact + verbatim quote, credible source. The server then re-checks what it can itself: the quote must appear in the article text (`quoteInText`), and recency (≤30 days) comes from Tavily's `published_date`, not the model. An event qualifies only if all pass; any qualified event breaches the node and propagates. Result cached in `data/store.json`; on any live failure the last cached result is served (labelled CACHED), else a 502 with a readable message. Article text sent to Claude is capped at 6,000 chars each.
**Why:** The model judges meaning; code checks facts it can verify, so a hallucinated quote or stale article can't trip a breach. Tavily is ~1 credit per click, cheap for repeated demo use.
**Alternatives considered:** Telem monitor ticks (no on-demand trigger; key currently rejected); letting Claude judge recency (dates are in the data); tool-use JSON instead of structured outputs (forced tool_choice is a 400 on Opus 5.5).

## 2026-11-14 — Telem hackathon server + two-hop discovery with verified quotes
**Decision:** Telem calls go to `TELEM_BASE_URL=https://hack.telem.ai/api` (hackathon keys are rejected by router.telem.ai). Results are read from `preprocessor_runs[].output_payload` (`results` for search, `fetched_results` for fetch). Discovery (`POST /api/discover`, NDJSON stream) runs: 3 seed searches (filings, BOM/teardown auto-routed; live bottlenecks pinned to Tavily) → fetch ≤10 pages → Claude (effort low) proposes ≤8 supplier *leads* (may use its own knowledge) → one targeted Telem search per lead → fetch ≤16 more pages → Claude (effort medium, streamed) extracts nodes/edges with quotes → `assemble()` keeps only edges whose quote is found in the cited page, tier order holds, and the node reaches the target; SPOF flags also need a verified quote. Graph cached as `graph:<KEY>`; the workbench loads cached live graphs over samples; failures fall back to the cached graph.
**Why:** One-hop extraction from generic pages produced 1 edge (pages rarely state "X supplies Y"); leads + targeted search raised it to 4–9 verified edges while keeping every edge source-backed. Letting the model propose leads from its own knowledge is safe because nothing enters the graph without an exact quote.
**Alternatives considered:** Loosening quote matching (would admit hallucinations); dropping the 2nd hop (graphs too thin to demo); "% boilerplate stripped" metric (hackathon fetch returns no raw HTML, so it can't be measured honestly; show pages/chars/latency instead).

## 2026-11-14 — Landing page: features, use cases, contact form saved locally
**Decision:** Landing page reorganized into hero → problem → features (6) → how it works → use cases (4, examples taken from real verified live runs) → evidence (a real verified quote from the NVDA graph) → contact form → CTA. Contact form is a server action with server-side validation, a hidden honeypot field for bots, and storage in `data/contacts.json` (gitignored). The form remounts with the submitted values after an error, because React 19's form reset otherwise clears the `<select>`.
**Why:** User wanted the page to explain product, features and use cases and let people get in touch. No email/CRM account exists yet, so submissions are stored locally rather than sent anywhere.
**Alternatives considered:** `mailto:` link (no address to publish; loses structured fields); third-party form service (new account + dependency for a demo).

## 2026-11-14 — Simpler hero and plain-language copy
**Decision:** Hero headline states what the product does ("Find the hidden suppliers that can break your supply chain"); the old hook moves to the small line above it. Hero animation is now a 7-card NVIDIA Blackwell chain (Ajinomoto ABF film → Ibiden/Unimicron substrates → TSMC packaging → NVIDIA) labelled "Example alert", with plain column names (Materials / Components / Factory / Product) and one caption per step. All landing, sign-in and contact copy rewritten in plain, second-person language; unverifiable promises (reply times) removed.
**Why:** The old hero needed supply-chain jargon ("tiers") to parse, and the 10-card graph with crossing lines and abbreviations was hard to read. NVIDIA is a name every visitor knows, and every link in that chain is a real supply relationship in adjacent columns, so no lines cross.
**Alternatives considered:** Keeping the MU HBM3E chain (its real links skip columns, forcing crossing lines; less familiar name).

## 2026-11-14 — Telem Monitor Agents in the app (supersedes "Verdicts and steering are ours, not Telem's" for monitors)
**Decision:** The hackathon server's OpenAPI (`https://hack.telem.ai/api/openapi.json`) exposes the full agent surface the original spec described: `/agent` (spec, criteria, counts, ticks, `spend_usd`, `source_health`), `/agent/ticks` (run now), `/agent/objects` (per-criterion verdicts with quote + URL), `/agent/chat` (plan steering, bumps `spec_version`), jobs and budgets. The workbench now lets a signed-in user start (`daily`, `ttl 7d`), run, steer and stop a Telem monitor per supplier, shows plan version, criteria, findings, sources and real spend, and polls every 5s while a monitor is building or checking (30s otherwise). Monitors are linked to graph nodes in `data/store.json` (`monitor:<graph>:<node>`), max 4 per graph, created only on a user click ("Start monitor" / "Monitor N suggested"). A node with ≥1 qualified object is treated as breached and propagates downstream. The quick Tavily "Live Tick" stays as a separate one-off news check.
**Why:** The user's spec assumed these endpoints; they exist on the hackathon server even though the public docs omit them. Real verdicts, steering and spend make the demo honest and sponsor-native.
**Alternatives considered:** Auto-creating monitors for every suggested node on graph build (spends without intent); tight budget caps ($0.25/tick) — rejected after they made Telem skip checks with `stop_reason: "budget_estimate"`; caps are now a generous runaway guard ($5/day, $2/tick, $1/chat) and the panel explains any early stop.

## 2026-11-14 — Search-first workbench, no sample graphs; Tavily used directly in discovery (supersedes "Workbench runs on labelled sample graphs")
**Decision:** Removed the hand-written sample graphs (`src/data/seeds.ts`). The workbench opens on a search screen with three suggestion chips (MU · HBM3E, NVDA · Blackwell, ASML · High-NA EUV) that run a real live search, plus "Recent searches" built from previously searched graphs. No "cached / sample / live" labels; graphs show "Updated <time>" and "Search again". Discovery now calls Tavily directly for the live-news seed search (news, last month, full text reused as page content) and adds step 5, a Tavily news pulse (this week's headlines per supplier, stored on each node and shown on cards and in the details panel). "Simulate a problem here (demo)" works on any graph for showing knock-on effects. Fallback to the last saved result on failure is kept, worded as "your last result for this search".
**Why:** Preset graphs looked hardcoded; users should see every map come from a search. Tavily was only used via Telem's router (billed to Telem) and the one-off news check, so it was invisible.
**Alternatives considered:** Keeping samples behind a toggle (still reads as fake); routing all news through Telem (hides the Tavily integration and its credits).

## 2026-11-14 — Hosting on Railway with a shared demo login
**Decision:** Deploy to Railway (`railway up` from the local folder, no GitHub repo needed) with a persistent volume mounted at `/app/data`. Public sign-up is off in production (`ALLOW_SIGNUP` unset); judges use one shared login from `DEMO_EMAIL` / `DEMO_PASSWORD`, created on first sign-in. A fresh disk starts from `seed/store.json` (previous searches, monitor links, news checks; no user accounts). `AUTH_SECRET` set as an env var.
**Why:** The app stores users, searches and monitor links as files, so it needs a disk that survives restarts (rules out serverless hosts like Vercel). Every search spends Telem/Tavily/Claude credits, so access is limited to people given the login.
**Alternatives considered:** Render (persistent disk needs paid plan + dashboard setup), Fly.io (CLI + card required), a tunnel to the laptop (URL dies when the laptop sleeps), open sign-up or invite codes (anyone could spend credits / more moving parts).

## 2026-11-14 — Public sign-up re-enabled on the hosted app; sharper news check; new sample searches
**Decision:** `ALLOW_SIGNUP=true` on Railway so judges can create their own accounts (demo login still works). The one-click news check now searches `"<supplier> disruption OR halt OR strike OR shortage OR delay OR outage"` with Tavily's advanced depth and 10 results. Sample searches now include INTC · Xeon and DELL · AI servers alongside MU, NVDA and ASML. News-pulse headlines must mention the supplier by name; Tavily company-profile pages are dropped.
**Why:** User asked for open sign-up and has ample credits. The old query mostly surfaced aggregators, which the credibility check rejected, so real disruptions (e.g. Micron's Taoyuan fab halt, reported by Bloomberg) never qualified; the new query reliably finds established press. Intel (substrate shortage, capacity shortfall) and Dell (memory shortage) show real, current breaches.
**Alternatives considered:** Loosening the credibility check (would admit aggregator noise); keeping sign-up closed (judges asked to try it themselves).
