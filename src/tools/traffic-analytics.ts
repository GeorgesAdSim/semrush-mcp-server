import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSemrushClient } from "../services/semrush-api.js";

export function registerTrafficAnalyticsTools(server: McpServer): void {
  server.registerTool(
    "semrush_traffic",
    {
      title: "SEMrush Traffic Analytics (Trends API)",
      description: `Analyze website traffic using SEMrush Trends API. Available actions:

- summary: Total visits, desktop/mobile split, bounce rate, visit duration
- sources: Traffic sources breakdown (direct, search, social, referral, etc.)
- destinations: Where users go after visiting the domain
- geo: Geographic distribution of traffic by country
- audience: Audience overlap between multiple domains (max 5)
- top_pages: Most visited pages on a domain
- daily: Day-by-day traffic data
- subdomains: Traffic breakdown by subdomain
- demographics: Age and gender distribution of visitors
- rank: Global traffic rank position`,
      inputSchema: {
        action: z
          .enum([
            "summary",
            "sources",
            "destinations",
            "geo",
            "audience",
            "top_pages",
            "daily",
            "subdomains",
            "demographics",
            "rank",
          ])
          .describe("Traffic analysis type"),
        domain: z
          .string()
          .min(3)
          .describe(
            "Domain(s) to analyze. For 'summary' and 'audience': comma-separated (e.g., 'site1.com,site2.com')"
          ),
        country: z
          .string()
          .default("fr")
          .describe("Country code (e.g., 'fr', 'us', 'be')"),
        display_date: z
          .string()
          .optional()
          .describe("Month in YYYY-MM-01 format (default: latest available)"),
        limit: z
          .number()
          .min(1)
          .max(1000)
          .default(50)
          .describe("Number of results to return"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const client = getSemrushClient();
        let results: Record<string, string>[];
        let title: string;

        const baseParams: Record<string, string> = {
          targets: params.domain,
          country: params.country,
        };
        if (params.display_date) {
          baseParams.display_date = params.display_date;
        }

        switch (params.action) {
          case "summary": {
            results = await client.trendsRequest("summary", baseParams);
            title = `Traffic Summary — ${params.domain}`;
            break;
          }
          case "sources": {
            results = await client.trendsRequest("traffic_sources", baseParams);
            title = `Traffic Sources — ${params.domain}`;
            break;
          }
          case "destinations": {
            results = await client.trendsRequest("traffic_destinations", {
              ...baseParams,
              display_limit: String(params.limit),
            });
            title = `Traffic Destinations — ${params.domain}`;
            break;
          }
          case "geo": {
            results = await client.trendsRequest("geo_distribution", {
              ...baseParams,
              display_limit: String(params.limit),
            });
            title = `Geo Distribution — ${params.domain}`;
            break;
          }
          case "audience": {
            results = await client.trendsRequest("audience_insights", {
              ...baseParams,
              display_limit: String(params.limit),
            });
            title = `Audience Insights — ${params.domain}`;
            break;
          }
          case "top_pages": {
            results = await client.trendsRequest("top_pages", {
              ...baseParams,
              display_limit: String(params.limit),
            });
            title = `Top Pages — ${params.domain}`;
            break;
          }
          case "daily": {
            results = await client.trendsRequest("daily_traffic", {
              ...baseParams,
              display_limit: String(params.limit),
            });
            title = `Daily Traffic — ${params.domain}`;
            break;
          }
          case "subdomains": {
            results = await client.trendsRequest("subdomains", {
              ...baseParams,
              display_limit: String(params.limit),
            });
            title = `Subdomains Traffic — ${params.domain}`;
            break;
          }
          case "demographics": {
            results = await client.trendsRequest("age_sex_distribution", baseParams);
            title = `Demographics — ${params.domain}`;
            break;
          }
          case "rank": {
            results = await client.trendsRequest("traffic_rank", baseParams);
            title = `Traffic Rank — ${params.domain}`;
            break;
          }
        }

        const text = [
          `## ${title}`,
          `Country: ${params.country} | Results: ${results.length}`,
          "",
          results.length === 0
            ? "No data found."
            : "```json\n" + JSON.stringify(results, null, 2) + "\n```",
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text" as const, text: `Error: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}
