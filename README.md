# Deepchain

**Find the hidden suppliers that can break your supply chain.**

Type in a product or a stock ticker. Deepchain maps your suppliers' suppliers, shows you where each link came from, and warns you when one of them runs into trouble.

- **Live app:** https://deepchain-production.up.railway.app (sign up, or use the demo login in our submission)
- Built at SearchHack 2026 on **Telem** and **Tavily**

## Why

Everyone watches NVIDIA, Micron and TSMC. The shortages that stop production usually start further down: a Japanese film maker, a Korean bonding-machine maker, a substrate plant. Supplier databases are hand-curated and lag the news. Deepchain builds the map live, with a source for every link, and keeps watching the weak spots.

**Who it's for:** procurement teams at hardware companies, and investors holding chip stocks.

## How it uses Telem and Tavily

| Step | What happens | API |
|---|---|---|
| 1. Search | Filings and teardown questions are auto-routed to the best engines (Exa, Perplexity, You, Linkup, Brave…) | Telem `POST /v1/search` (`auto_routing`) |
| 1. News | This month's supply-chain news, full article text | Tavily search (news, last month) |
| 2. Read | Pages turned into clean markdown | Telem `POST /v1/fetch` |
| 3. Leads | The AI names likely chokepoint suppliers; one targeted search per lead | Telem `POST /v1/search` |
| 4. Verify | The AI extracts who supplies whom **with a quote**; code keeps a link only if the quote is on the page | (no API: exact-match check) |
| 5. Pulse | This week's headlines for every supplier on the map | Tavily search (news, last week) |
| Watch | A monitor agent per chokepoint: its own plan and criteria, daily checks, plain-English steering, real spend | Telem Monitors (`/v1/monitors`, `/agent`, `/agent/ticks`, `/agent/objects`, `/agent/chat`) |
| Check now | One-click news check: AI grades each article, code re-checks the quote and the publish date | Tavily search (advanced depth) |

A supplier turns red only when an event is **about that supplier**, reports a **real production impact** (quote found on the page), comes from a **credible source**, and was published **in the last 30 days**. The problem then propagates to everything downstream.

## Run it locally

```bash
cp .env.example .env.local   # fill in TELEM_API_KEY, TELEM_BASE_URL, TAVILY_API_KEY, ANTHROPIC_API_KEY, AUTH_SECRET, ALLOW_SIGNUP=true
npm install
npm run dev                  # http://localhost:3000
npm test                     # unit tests (graph propagation, quote checks, graph assembly)
```

## Stack

Next.js 15 (App Router, TypeScript), Tailwind CSS, Claude for extraction and grading, file-based storage in `data/` (a persistent volume on Railway). Design and architecture decisions are logged in [Decision.md](Decision.md).
