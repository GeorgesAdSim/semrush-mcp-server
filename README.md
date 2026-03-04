# @adsim/semrush-mcp-server

[![npm version](https://img.shields.io/npm/v/@adsim/semrush-mcp-server.svg)](https://www.npmjs.com/package/@adsim/semrush-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@adsim/semrush-mcp-server.svg)](https://www.npmjs.com/package/@adsim/semrush-mcp-server)
[![node version](https://img.shields.io/node/v/@adsim/semrush-mcp-server.svg)](https://nodejs.org)
[![license](https://img.shields.io/npm/l/@adsim/semrush-mcp-server.svg)](https://github.com/GeorgesAdSim/semrush-mcp-server/blob/main/LICENSE)

SEMrush MCP Server for Claude — **10 tools, 40 actions**. Full access to SEMrush SEO analytics from Claude Code and Claude Desktop.

---

## Install

```bash
npm install -g @adsim/semrush-mcp-server
```

Requires Node.js >= 18 and a [SEMrush API key](https://www.semrush.com/api/).

---

## Quick Start

### Claude Code

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "semrush": {
      "type": "stdio",
      "command": "semrush-mcp-server",
      "env": {
        "SEMRUSH_API_KEY": "your_api_key",
        "SEMRUSH_DEFAULT_DATABASE": "fr"
      }
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "semrush": {
      "command": "semrush-mcp-server",
      "env": {
        "SEMRUSH_API_KEY": "your_api_key",
        "SEMRUSH_DEFAULT_DATABASE": "fr"
      }
    }
  }
}
```

Restart your client. 10 tools (40 actions) are now available.

---

## Tools

| Tool | Actions | Description |
|------|---------|-------------|
| `semrush_domain` | 9 | Domain analytics (organic, paid, competitors, history) |
| `semrush_keyword` | 8 | Keyword research (volume, difficulty, SERP, questions, bulk) |
| `semrush_backlinks` | 7 | Backlink profiles (overview, anchors, TLD, geo) |
| `semrush_gap` | 3 | Gap analysis (keyword gap, backlink gap, content gap) |
| `semrush_traffic` | 3 | Traffic analytics (summary, sources, top pages) |
| `semrush_recommend` | 3 | AI recommendations (quick wins, traffic growth, competitor) |
| `semrush_tracking` | 2 | Position tracking (current + history) |
| `semrush_audit` | 2 | Site audit (issues + pages) |
| `semrush_credits` | 2 | Account management (balance + usage stats) |
| `semrush_enrich_cluster` | 1 | Keyword cluster enrichment with scoring |

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

### `semrush_recommend` — AI Recommendations (3 actions)

| Action | Description |
|--------|-------------|
| `quick_wins` | Keywords in positions 11-30 with traffic potential |
| `increase_traffic` | Comprehensive traffic growth plan |
| `beat_competitor` | Head-to-head competitive analysis with action plan |

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

### `semrush_enrich_cluster` — Cluster Enrichment (1 action)

Accepts a keyword array and returns enriched data with:
- Search volume, CPC, keyword difficulty per keyword
- `cluster_score` (0-100) and `cluster_grade` (A-D)
- `opportunity_score` for prioritization
- Optional: current positions when `target_domain` provided

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

## Example Queries

```
"Give me an overview of nike.com"
"Top organic keywords for lequipe.fr"
"Who ranks for 'credit immobilier' in France?"
"Backlink audit of my-domain.com"
"Quick wins for my-site.com — keywords close to page 1"
"Compare my-site.com vs competitor.com"
"Enrich this cluster: seo, backlinks, netlinking"
"Keyword gap between my-site.com and competitor.com"
```

---

## Built-in Governance

- **Rate limiter** — token bucket, 10 req/sec (configurable)
- **Response cache** — differentiated TTL per endpoint category (30min to 24h)
- **Quota management** — per-user daily budgets with action-based cost tracking
- **Audit trail** — JSON logs on stderr (tool, endpoint, params, status, duration)
- **French summaries** — automatic human-readable analysis in French

---

## Supported Databases

71 regional databases: `us`, `uk`, `ca`, `fr`, `de`, `es`, `it`, `nl`, `be`, `ch`, `at`, `dk`, `no`, `se`, `fi`, `pl`, `ie`, `pt`, `hu`, `cz`, `sk`, `ro`, `bg`, `gr`, `hr`, `si`, `lt`, `lv`, `ee`, `cy`, `mt`, `rs`, `ua`, `jp`, `in`, `au`, `sg`, `hk`, `kr`, `my`, `ph`, `th`, `tw`, `id`, `vn`, `il`, `tr`, `za`, `ng`, `ke`, `br`, `ar`, `mx`, `co`, `cl`, `pe`, `ec`, `ve`, `bo`, `py`, `uy`, `cr`, `gt`, `pa`, `do`, `sv`, `hn`, `ni`, `pr`, `tt`, `jm`

---

## Development

```bash
npm run dev           # Watch mode
npm run build         # Build
npm test              # Run tests (71 tests)
npm run test:coverage # Coverage report
npm run release       # Bump version + changelog + tag
```

---

## Tech Stack

- TypeScript 5.7 (strict) + Zod validation
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) ^1.12.0
- [Vitest](https://vitest.dev) — 71 tests across 6 suites
- Node.js built-in `fetch` — zero external HTTP dependency
- stdio transport

---

## License

MIT — [Georges Cordewiener](https://adsim.be) / [AdSim](https://adsim.be)

[Full documentation on GitHub](https://github.com/GeorgesAdSim/semrush-mcp-server)
