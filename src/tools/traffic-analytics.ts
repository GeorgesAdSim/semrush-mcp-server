import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSemrushClient } from "../services/semrush-api.js";
import { EXPORT_COLUMNS } from "../constants.js";

export function registerTrafficAnalyticsTools(server: McpServer): void {
  server.registerTool(
    "semrush_traffic",
    {
      title: "SEMrush Traffic Estimations",
      description: `Traffic estimations using SEMrush Analytics API (no Trends subscription needed). Available actions:

- domain_traffic: Monthly organic/paid traffic estimates, cost, and keyword counts across all databases or a single one.
- top_pages: Pages generating the most estimated organic traffic (via top organic keywords and their URLs).
- traffic_sources: Breakdown of organic vs paid search traffic with keyword counts and cost estimates.`,
      inputSchema: {
        action: z
          .enum(["domain_traffic", "top_pages", "traffic_sources"])
          .describe("Traffic analysis type"),
        domain: z.string().min(3).describe("Domain to analyze"),
        database: z
          .string()
          .default("fr")
          .describe("SEMrush database code (e.g., 'fr', 'us', 'be')"),
        limit: z
          .number()
          .min(1)
          .max(1000)
          .default(50)
          .describe("Number of results"),
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
        let text: string;

        switch (params.action) {
          case "domain_traffic": {
            // Get overview across all databases
            const allDb = await client.analyticsRequest("domain_ranks", {
              domain: params.domain,
              export_columns: EXPORT_COLUMNS.domain_ranks,
            });

            // Get detailed single-database overview
            const singleDb = await client.analyticsRequest("domain_rank", {
              domain: params.domain,
              database: params.database,
              export_columns: EXPORT_COLUMNS.domain_rank,
            });

            // Get history for YoY comparison (last 13 months)
            const history = await client.analyticsRequest(
              "domain_rank_history",
              {
                domain: params.domain,
                database: params.database,
                display_limit: "13",
                export_columns: EXPORT_COLUMNS.domain_rank_history,
              }
            );

            // Calculate YoY change if we have enough history
            let yoyChange: Record<string, string | number> | null = null;
            if (history.length >= 13) {
              const current = history[0];
              const yearAgo = history[12];
              const curTraffic = parseInt(current.organic_traffic ?? "0");
              const prevTraffic = parseInt(yearAgo.organic_traffic ?? "0");
              yoyChange = {
                current_month: current.date ?? "",
                year_ago_month: yearAgo.date ?? "",
                organic_traffic_current: curTraffic,
                organic_traffic_year_ago: prevTraffic,
                yoy_change_percent:
                  prevTraffic > 0
                    ? Math.round(
                        ((curTraffic - prevTraffic) / prevTraffic) * 10000
                      ) / 100
                    : 0,
              };
            }

            text = [
              `## Traffic Estimations — ${params.domain}`,
              "",
              `### All Databases`,
              "```json\n" + JSON.stringify(allDb, null, 2) + "\n```",
              "",
              `### ${params.database.toUpperCase()} — Detailed`,
              "```json\n" + JSON.stringify(singleDb, null, 2) + "\n```",
              ...(yoyChange
                ? [
                    "",
                    "### Year-over-Year Change",
                    "```json\n" +
                      JSON.stringify(yoyChange, null, 2) +
                      "\n```",
                  ]
                : []),
            ].join("\n");
            break;
          }

          case "top_pages": {
            // Get organic keywords sorted by traffic, grouped by URL
            const results = await client.analyticsRequest("domain_organic", {
              domain: params.domain,
              database: params.database,
              display_limit: String(params.limit * 3), // Over-fetch to group
              display_sort: "tr_desc",
              export_columns: EXPORT_COLUMNS.domain_organic,
            });

            // Group by URL and sum estimated traffic
            const urlMap = new Map<
              string,
              {
                url: string;
                keywords_count: number;
                total_traffic_share: number;
                total_traffic_cost: number;
                top_keywords: string[];
              }
            >();

            for (const row of results) {
              const url = row.url ?? "";
              if (!url) continue;
              const existing = urlMap.get(url);
              const trafficPct = parseFloat(row.traffic_percent ?? "0");
              const trafficCost = parseFloat(row.traffic_cost ?? "0");

              if (existing) {
                existing.keywords_count++;
                existing.total_traffic_share += trafficPct;
                existing.total_traffic_cost += trafficCost;
                if (existing.top_keywords.length < 3) {
                  existing.top_keywords.push(row.keyword ?? "");
                }
              } else {
                urlMap.set(url, {
                  url,
                  keywords_count: 1,
                  total_traffic_share: trafficPct,
                  total_traffic_cost: trafficCost,
                  top_keywords: [row.keyword ?? ""],
                });
              }
            }

            const pages = Array.from(urlMap.values())
              .sort((a, b) => b.total_traffic_share - a.total_traffic_share)
              .slice(0, params.limit)
              .map((p) => ({
                ...p,
                total_traffic_share:
                  Math.round(p.total_traffic_share * 100) / 100,
                total_traffic_cost:
                  Math.round(p.total_traffic_cost * 100) / 100,
              }));

            text = [
              `## Top Pages — ${params.domain} (${params.database})`,
              `Pages: ${pages.length}`,
              "",
              pages.length === 0
                ? "No data found."
                : "```json\n" + JSON.stringify(pages, null, 2) + "\n```",
            ].join("\n");
            break;
          }

          case "traffic_sources": {
            // Get organic overview
            const organic = await client.analyticsRequest("domain_rank", {
              domain: params.domain,
              database: params.database,
              export_columns: EXPORT_COLUMNS.domain_rank,
            });

            const data = organic[0] ?? {};

            const breakdown = {
              domain: params.domain,
              database: params.database,
              organic: {
                keywords: parseInt(data.organic_keywords ?? "0"),
                traffic: parseInt(data.organic_traffic ?? "0"),
                cost: parseFloat(data.organic_cost ?? "0"),
              },
              paid: {
                keywords: parseInt(data.adwords_keywords ?? "0"),
                traffic: parseInt(data.adwords_traffic ?? "0"),
                cost: parseFloat(data.adwords_cost ?? "0"),
              },
              total_estimated_traffic:
                parseInt(data.organic_traffic ?? "0") +
                parseInt(data.adwords_traffic ?? "0"),
              organic_share_percent: 0,
              paid_share_percent: 0,
            };

            if (breakdown.total_estimated_traffic > 0) {
              breakdown.organic_share_percent =
                Math.round(
                  (breakdown.organic.traffic /
                    breakdown.total_estimated_traffic) *
                    10000
                ) / 100;
              breakdown.paid_share_percent =
                Math.round(
                  (breakdown.paid.traffic / breakdown.total_estimated_traffic) *
                    10000
                ) / 100;
            }

            text = [
              `## Traffic Sources — ${params.domain} (${params.database})`,
              "",
              "```json\n" + JSON.stringify(breakdown, null, 2) + "\n```",
            ].join("\n");
            break;
          }
        }

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
