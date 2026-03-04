#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerDomainAnalyticsTools } from "./tools/domain-analytics.js";
import { registerKeywordResearchTools } from "./tools/keyword-research.js";
import { registerBacklinksTools } from "./tools/backlinks.js";
import { registerGapAnalysisTools } from "./tools/gap-analysis.js";
import { registerPositionTrackingTools } from "./tools/position-tracking.js";
import { registerTrafficAnalyticsTools } from "./tools/traffic-analytics.js";
import { registerSiteAuditTools } from "./tools/site-audit.js";

// Initialize MCP Server
const server = new McpServer({
  name: "semrush-mcp-server",
  version: "2.0.0",
});

// Register all tool groups (7 grouped tools, 36 actions)
registerDomainAnalyticsTools(server);     // semrush_domain (9 actions)
registerKeywordResearchTools(server);     // semrush_keyword (8 actions)
registerBacklinksTools(server);           // semrush_backlinks (7 actions)
registerGapAnalysisTools(server);         // semrush_gap (3 actions)
registerPositionTrackingTools(server);    // semrush_tracking (2 actions)
registerTrafficAnalyticsTools(server);    // semrush_traffic (3 actions)
registerSiteAuditTools(server);           // semrush_audit (2 actions)

// Start server with stdio transport
async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SEMrush MCP Server v2.0.0 started (stdio) — 7 tools, 34 actions");
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
