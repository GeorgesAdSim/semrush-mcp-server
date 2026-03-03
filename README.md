# SEMrush MCP Server

A comprehensive Model Context Protocol (MCP) server for the SEMrush Analytics API. Gives AI assistants like Claude full access to SEMrush's SEO analytics — domain analysis, keyword research, and backlink intelligence.

Built for agencies and SEO professionals who want to query SEMrush data directly from their AI workflow.

---

## Features

**3 grouped tools, 23 actions** — optimized for minimal context window usage:

| Tool | Actions | Description |
|------|---------|-------------|
| `semrush_domain` | 9 | Domain analytics (organic, paid, competitors, history) |
| `semrush_keyword` | 7 | Keyword research (volume, difficulty, SERP, questions) |
| `semrush_backlinks` | 7 | Backlink profiles (overview, anchors, TLD, geo) |

**Built-in governance:**
- Rate limiter (token bucket, 10 req/sec)
- In-memory response cache with configurable TTL
- JSON audit trail on stderr (zero credentials leaked)
- Configurable defaults via environment variables

---

## Tools Reference

Each tool uses an `action` parameter to select the analysis type. This grouped design keeps the context window lean (3 tool definitions instead of 23).

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

### `semrush_keyword` — Keyword Research (7 actions)

| Action | Description |
|--------|-------------|
| `overview` | Search volume, CPC, competition, trends |
| `related` | Related keyword variations |
| `questions` | Question-based keywords (PAA, featured snippets) |
| `difficulty` | Difficulty index (batch up to 100, semicolon-separated) |
| `organic_results` | Domains ranking in Google's top 100 |
| `ad_results` | Domains bidding on a keyword in Google Ads |
| `broad_match` | Broad match variations and long-tail alternatives |

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

Restart Claude Code. The 3 tools (23 actions) are now available.

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

## Example Queries

Once connected, ask Claude things like:

```
"Give me an overview of nike.com"
"What are the top organic keywords for lequipe.fr?"
"Who ranks in the top 10 for 'credit immobilier' in France?"
"What questions do people ask about 'panneau solaire'?"
"Full backlink audit of my-domain.com: overview, top anchors, referring domains"
"Find keyword opportunities: related keywords to 'agence seo' with low difficulty"
```

---

## Architecture

```
src/
├── index.ts                  # Server entry point (McpServer + StdioServerTransport)
├── types.ts                  # TypeScript interfaces
├── constants.ts              # API URLs, export columns, label mappings
├── tools/
│   ├── domain-analytics.ts   # semrush_domain (9 actions)
│   ├── keyword-research.ts   # semrush_keyword (7 actions)
│   └── backlinks.ts          # semrush_backlinks (7 actions)
├── services/
│   └── semrush-api.ts        # Singleton API client (fetch, CSV/JSON parse, rate limit, cache)
└── utils/
    └── governance.ts         # Rate limiter, audit logger, config loader, response cache
```

### Key design decisions

- **Grouped tools**: 3 tools with `action` parameter instead of 23 individual tools — minimizes context window usage
- **Modular registration**: Each category is a separate file with its own `registerXxxTools(server)` function
- **CSV parser**: Analytics API returns semicolon-separated CSV — parsed and mapped to friendly column names
- **Singleton API client**: One instance, lazy-initialized, shared across all tools
- **Token bucket rate limiter**: Client-side enforcement of SEMrush's 10 req/sec limit
- **In-memory cache**: Prevents redundant API calls within the TTL window
- **Audit trail**: Every API call logged to stderr as JSON (tool, endpoint, params, status, duration) — no credentials

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SEMRUSH_API_KEY` | Yes | — | Your SEMrush API key |
| `SEMRUSH_DEFAULT_DATABASE` | No | `fr` | Default regional database |
| `SEMRUSH_MAX_RESULTS_PER_CALL` | No | `100` | Max results per API call |
| `SEMRUSH_CACHE_TTL` | No | `3600` | Cache duration in seconds |
| `SEMRUSH_RATE_LIMIT` | No | `10` | Max requests per second |

### Supported databases

`fr`, `be`, `us`, `uk`, `de`, `es`, `it`, `nl`, `pt`, `ca`, `au`, `br`, `jp`, `in`, `ru`, `se`, `ch`, `at`, `dk`, `no`, `fi`, `pl`, `ie`, `sg`, `hk` and [50+ more](https://www.semrush.com/kb/api-databases).

---

## Development

```bash
# Watch mode (recompiles on save)
npm run dev

# Build
npm run build

# Run directly
npm start
```

---

## Tech Stack

- TypeScript 5.7 (strict mode)
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) ^1.12.0
- [Zod](https://zod.dev) ^3.24.0 for input validation
- Node.js built-in `fetch` (no external HTTP dependency)
- stdio transport

---

## License

MIT

---

## Author

**Georges Cordewiener** — [AdSim](https://adsim.be)

Built for the SEO community. Contributions welcome.
