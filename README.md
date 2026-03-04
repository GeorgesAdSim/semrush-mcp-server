# SEMrush MCP Server

A comprehensive Model Context Protocol (MCP) server for the SEMrush API. Gives AI assistants like Claude full access to SEMrush's SEO analytics — domain analysis, keyword research, backlink intelligence, gap analysis, traffic analytics, and AI-powered recommendations.

Built for agencies and SEO professionals who want to query SEMrush data directly from their AI workflow.

---

## Features

**10 grouped tools, 40 actions** — optimized for minimal context window usage:

| Tool | Actions | Description |
|------|---------|-------------|
| `semrush_domain` | 9 | Domain analytics (organic, paid, competitors, history) |
| `semrush_keyword` | 8 | Keyword research (volume, difficulty, SERP, questions, bulk) |
| `semrush_backlinks` | 7 | Backlink profiles (overview, anchors, TLD, geo) |
| `semrush_gap` | 3 | Gap analysis (keyword gap, backlink gap, content gap) |
| `semrush_traffic` | 3 | Traffic analytics via Trends API (summary, sources, top pages) |
| `semrush_tracking` | 2 | Position tracking (current + history) |
| `semrush_audit` | 2 | Site audit (issues + pages) |
| `semrush_credits` | 2 | Account management (balance + usage stats) |
| `semrush_recommend` | 3 | AI-powered recommendations (quick wins, traffic growth, competitor analysis) |
| `semrush_enrich_cluster` | 1 | Keyword cluster enrichment with scoring |

**Built-in governance:**
- Rate limiter (token bucket, 10 req/sec)
- In-memory response cache with differentiated TTL per endpoint category
- Quota management for multi-tenant usage
- JSON audit trail on stderr (zero credentials leaked)
- Automatic French-language summaries for key analyses
- Configurable defaults via environment variables

---

## Tools Reference

Each tool uses an `action` parameter to select the analysis type. This grouped design keeps the context window lean (10 tool definitions instead of 40).

### `semrush_domain` — Domain Analytics (9 actions)

| Action | Description |
|--------|-------------|
| `organic` | Organic keywords, positions, traffic estimates |
| `adwords` | Paid search (Google Ads) keywords |
| `overview` | Overview across all SEMrush databases |
| `overview_single` | Detailed overview for a single database |
| `history` | Historical ranking data over time |
| `competitors` | Organic search competitors |
| `paid_competitors` | Paid search (Google Ads) competitors |
| `url_organic` | Organic keywords for a specific URL |
| `url_adwords` | Paid keywords for a specific URL |

### `semrush_keyword` — Keyword Research (8 actions)

| Action | Description |
|--------|-------------|
| `overview` | Search volume, CPC, competition, trends |
| `related` | Related keyword variations |
| `questions` | Question-based keywords (PAA, featured snippets) |
| `difficulty` | Difficulty index (batch up to 100, semicolon-separated) |
| `organic_results` | Domains ranking in Google's top 100 |
| `ad_results` | Domains bidding on a keyword in Google Ads |
| `broad_match` | Broad match variations and long-tail alternatives |
| `bulk_overview` | Batch keyword analysis (up to 100 keywords) |

### `semrush_backlinks` — Backlinks Analysis (7 actions)

| Action | Description |
|--------|-------------|
| `overview` | Total backlinks, referring domains, follow/nofollow |
| `list` | Individual backlinks with source URLs and anchors |
| `refdomains` | Referring domains with authority scores |
| `anchors` | Anchor text distribution |
| `tld` | Distribution by TLD (.com, .fr, .edu, .gov...) |
| `geo` | Geographic distribution of backlinks by country |
| `pages` | Pages that attract the most backlinks |

### `semrush_gap` — Gap Analysis (3 actions)

| Action | Description |
|--------|-------------|
| `keyword_gap` | Keywords your competitor ranks for but you don't |
| `backlink_gap` | Domains linking to competitors but not to you |
| `content_gap` | Content topics missing from your domain |

### `semrush_traffic` — Traffic Analytics (3 actions)

| Action | Description |
|--------|-------------|
| `domain_traffic` | Traffic summary (visits, bounce rate, duration) |
| `top_pages` | Most visited pages |
| `traffic_sources` | Traffic source breakdown |

### `semrush_tracking` — Position Tracking (2 actions)

| Action | Description |
|--------|-------------|
| `get_positions` | Current keyword positions |
| `get_history` | Historical position data |

### `semrush_audit` — Site Audit (2 actions)

| Action | Description |
|--------|-------------|
| `get_issues` | Technical SEO issues found |
| `get_pages` | Audited pages with scores |

### `semrush_credits` — Account Management (2 actions)

| Action | Description |
|--------|-------------|
| `balance` | Remaining API units |
| `usage_stats` | Session statistics (calls, errors, success rate) |

### `semrush_recommend` — AI Recommendations (3 actions)

| Action | Description |
|--------|-------------|
| `quick_wins` | Keywords in positions 11-30 with traffic potential |
| `increase_traffic` | Comprehensive traffic growth plan |
| `beat_competitor` | Head-to-head competitive analysis with action plan |

### `semrush_enrich_cluster` — Cluster Enrichment (1 action)

Accepts a keyword array and returns enriched data with:
- Search volume, CPC, keyword difficulty per keyword
- `cluster_score` (0-100) and `cluster_grade` (A-D)
- `opportunity_score` for prioritization
- Optional: current positions when `target_domain` provided

---

## Installation

### Prerequisites

- Node.js >= 18
- A SEMrush API key ([get one here](https://www.semrush.com/api/))

### Setup

```bash
git clone https://github.com/adsimbe/semrush-mcp-server.git
cd semrush-mcp-server
npm install
npm run build
```

### Configuration

Create a `.env` file at the project root:

```bash
# Required
SEMRUSH_API_KEY=your_api_key_here

# Optional (defaults shown)
SEMRUSH_DEFAULT_DATABASE=fr
SEMRUSH_MAX_RESULTS_PER_CALL=100
SEMRUSH_CACHE_TTL=3600
SEMRUSH_RATE_LIMIT=10
```

---

## Usage with Claude Code

Add to your `~/.claude.json`:

```json
{
  "mcpServers": {
    "semrush": {
      "type": "stdio",
      "command": "node",
      "args": ["path/to/semrush-mcp-server/dist/index.js"],
      "env": {
        "SEMRUSH_API_KEY": "your_api_key",
        "SEMRUSH_DEFAULT_DATABASE": "fr"
      }
    }
  }
}
```

Restart Claude Code. The 10 tools (40 actions) are now available.

---

## Usage with Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "semrush": {
      "command": "node",
      "args": ["path/to/semrush-mcp-server/dist/index.js"],
      "env": {
        "SEMRUSH_API_KEY": "your_api_key",
        "SEMRUSH_DEFAULT_DATABASE": "fr"
      }
    }
  }
}
```

---

## Multi-tenant Usage

The server includes a `QuotaManager` for multi-tenant deployments. Each user gets a configurable daily API unit budget. Costs are tracked per action based on `ACTION_COSTS`:

| Category | Cost per call | Examples |
|----------|--------------|---------|
| Keywords | 1 unit | `phrase_all`, `phrase_related`, `phrase_kdi` |
| Backlinks | 5 units | `backlinks_overview`, `backlinks_refdomains` |
| Domain | 10 units | `domain_organic`, `domain_ranks` |
| Gap analysis | 20 units | `gap_keyword`, `gap_backlink` |
| Cluster enrichment | 25 units | `cluster_enrich` |
| Recommendations | 30 units | `recommend` (orchestrates multiple API calls) |

Usage tracking is available via `semrush_credits` with `action: "usage_stats"`.

---

## Supported Databases

71 regional databases covering all major markets:

| Region | Databases |
|--------|-----------|
| North America | `us`, `ca`, `mx`, `pr` |
| Europe | `uk`, `fr`, `de`, `es`, `it`, `nl`, `be`, `ch`, `at`, `dk`, `no`, `se`, `fi`, `pl`, `ie`, `pt`, `hu`, `cz`, `sk`, `ro`, `bg`, `gr`, `hr`, `si`, `lt`, `lv`, `ee`, `cy`, `mt`, `rs`, `ua` |
| Asia-Pacific | `jp`, `in`, `au`, `sg`, `hk`, `kr`, `my`, `ph`, `th`, `tw`, `id`, `vn` |
| Middle East | `il`, `tr` |
| Africa | `za`, `ng`, `ke` |
| South America | `br`, `ar`, `co`, `cl`, `pe`, `ec`, `ve`, `bo`, `py`, `uy` |
| Central America & Caribbean | `cr`, `gt`, `pa`, `do`, `sv`, `hn`, `ni`, `tt`, `jm` |

Full list exported as `VALID_DATABASES` from `src/constants.ts`.

---

## Example Queries

Once connected, ask Claude things like:

```
"Give me an overview of nike.com"
"What are the top organic keywords for lequipe.fr?"
"Who ranks in the top 10 for 'credit immobilier' in France?"
"What questions do people ask about 'panneau solaire'?"
"Full backlink audit of my-domain.com: overview, top anchors, referring domains"
"Find quick wins for my-site.com — keywords close to page 1"
"Compare my-site.com vs competitor.com — who's winning?"
"Enrich this keyword cluster: seo, backlinks, netlinking, audit seo"
"What's the keyword gap between my-site.com and competitor.com?"
```

---

## Architecture

```
src/
├── index.ts                      # Server entry point (McpServer + StdioServerTransport)
├── types.ts                      # TypeScript interfaces
├── constants.ts                  # API URLs, export columns, databases, costs, TTLs
├── tools/
│   ├── domain-analytics.ts       # semrush_domain (9 actions)
│   ├── keyword-research.ts       # semrush_keyword (8 actions)
│   ├── backlinks.ts              # semrush_backlinks (7 actions)
│   ├── gap-analysis.ts           # semrush_gap (3 actions)
│   ├── traffic-analytics.ts      # semrush_traffic (3 actions)
│   ├── position-tracking.ts      # semrush_tracking (2 actions)
│   ├── site-audit.ts             # semrush_audit (2 actions)
│   ├── account.ts                # semrush_credits (2 actions)
│   ├── recommender.ts            # semrush_recommend (3 actions)
│   └── cluster-enrichment.ts     # semrush_enrich_cluster (1 action)
├── services/
│   └── semrush-api.ts            # Singleton API client (fetch, CSV/JSON parse, rate limit, cache)
├── utils/
│   ├── governance.ts             # QuotaManager, RateLimiter, ResponseCache, audit logger
│   └── summaries.ts              # French-language summary builder
└── __tests__/                    # Vitest test suites (69 tests)
```

### Key design decisions

- **Grouped tools**: 10 tools with `action` parameter instead of 40 individual tools — minimizes context window usage
- **Modular registration**: Each category is a separate file with its own `registerXxxTools(server)` function
- **CSV parser**: Analytics API returns semicolon-separated CSV — parsed and mapped to friendly column names
- **Singleton API client**: One instance, lazy-initialized, shared across all tools
- **Token bucket rate limiter**: Client-side enforcement of SEMrush's 10 req/sec limit
- **In-memory cache**: Differentiated TTL per endpoint category (30min for positions, 24h for domain overview)
- **Quota management**: Per-user daily budgets with action-based cost tracking
- **Audit trail**: Every API call logged to stderr as JSON (tool, endpoint, params, status, duration) — no credentials
- **French summaries**: Automatic human-readable analysis in French for domain, keyword, and backlink results

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SEMRUSH_API_KEY` | Yes | — | Your SEMrush API key |
| `SEMRUSH_DEFAULT_DATABASE` | No | `fr` | Default regional database |
| `SEMRUSH_MAX_RESULTS_PER_CALL` | No | `100` | Max results per API call |
| `SEMRUSH_CACHE_TTL` | No | `3600` | Cache duration in seconds |
| `SEMRUSH_RATE_LIMIT` | No | `10` | Max requests per second |

---

## Development

```bash
# Watch mode (recompiles on save)
npm run dev

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run directly
npm start
```

---

## Tech Stack

- TypeScript 5.7 (strict mode)
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) ^1.12.0
- [Zod](https://zod.dev) ^3.24.0 for input validation
- [Vitest](https://vitest.dev) for testing (69 tests across 6 suites)
- Node.js built-in `fetch` (no external HTTP dependency)
- stdio transport

---

## License

MIT

---

## Author

**Georges Cordewiener** — [AdSim](https://adsim.be)

Built for the SEO community. Contributions welcome.
