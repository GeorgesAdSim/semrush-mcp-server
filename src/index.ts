#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerDomainAnalyticsTools } from "./tools/domain-analytics.js";
import { registerKeywordResearchTools } from "./tools/keyword-research.js";
import { registerBacklinksTools } from "./tools/backlinks.js";

// Initialize MCP Server
const server = new McpServer({
  name: "semrush-mcp-server",
  version: "1.2.0",
});

// Register all tool groups (3 grouped tools, 23 actions)
registerDomainAnalyticsTools(server);     // semrush_domain (9 actions)
registerKeywordResearchTools(server);     // semrush_keyword (7 actions)
registerBacklinksTools(server);           // semrush_backlinks (7 actions)

// Start server with stdio transport
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SEMrush MCP Server v1.2.0 started (stdio) — 3 tools, 23 actions");
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
