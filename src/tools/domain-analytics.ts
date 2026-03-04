import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSemrushClient } from "../services/semrush-api.js";
import { EXPORT_COLUMNS, VALID_DATABASES } from "../constants.js";
import { summarizeDomainOrganic, summarizeDomainOverview, summarizeDomainCompetitors } from "../utils/summaries.js";

export function registerDomainAnalyticsTools(server: McpServer): void {
  server.registerTool(
    "semrush_domain",
    {
      title: "SEMrush Domain Analytics",
      description: `Analyze a domain's SEO performance. Available actions:

- organic: Get organic keywords, positions, traffic estimates
- adwords: Get paid search (Google Ads) keywords
- overview: Get overview across ALL SEMrush databases
- overview_single: Get detailed overview for ONE database
- history: Get historical ranking data over time
- competitors: Get organic search competitors
- paid_competitors: Get paid search (Google Ads) competitors
- url_organic: Get organic keywords for a specific URL (not just domain)
- url_adwords: Get paid keywords for a specific URL`,
      inputSchema: {
        action: z
          .enum([
            "organic",
            "adwords",
            "overview",
            "overview_single",
            "history",
            "competitors",
            "paid_competitors",
            "url_organic",
            "url_adwords",
          ])
          .describe("Analysis type to perform"),
        domain: z
          .string()
          .min(3)
          .regex(
            /^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/,
            "Format de domaine invalide (ex: example.com, sans http://)"
          )
          .describe("Domain to analyze (e.g., 'example.com')"),
        database: z
          .string()
          .default("fr")
          .describe(`SEMrush database code. Valides: ${VALID_DATABASES.slice(0, 15).join(", ")}...`),
        limit: z
          .number()
          .min(1)
          .max(10000)
          .default(50)
          .describe("Number of results to return"),
        offset: z
          .number()
          .min(0)
          .default(0)
          .describe("Results offset for pagination"),
        sort: z
          .string()
          .default("tr_desc")
          .describe(
            "Sort order (e.g., 'tr_desc', 'po_asc', 'nq_desc')"
          ),
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

        switch (params.action) {
          case "organic": {
            results = await client.analyticsRequest("domain_organic", {
              domain: params.domain,
              database: params.database,
              display_limit: String(params.limit),
              display_offset: String(params.offset),
              display_sort: params.sort,
              export_columns: EXPORT_COLUMNS.domain_organic,
            });
            title = `Organic Keywords — ${params.domain} (${params.database})`;
            break;
          }
          case "adwords": {
            results = await client.analyticsRequest("domain_adwords", {
              domain: params.domain,
              database: params.database,
              display_limit: String(params.limit),
              display_offset: String(params.offset),
              display_sort: params.sort,
              export_columns: EXPORT_COLUMNS.domain_adwords,
            });
            title = `Paid Keywords — ${params.domain} (${params.database})`;
            break;
          }
          case "overview": {
            results = await client.analyticsRequest("domain_ranks", {
              domain: params.domain,
              export_columns: EXPORT_COLUMNS.domain_ranks,
            });
            title = `Domain Overview — ${params.domain} (all databases)`;
            break;
          }
          case "overview_single": {
            results = await client.analyticsRequest("domain_rank", {
              domain: params.domain,
              database: params.database,
              export_columns: EXPORT_COLUMNS.domain_rank,
            });
            title = `Domain Overview — ${params.domain} (${params.database})`;
            break;
          }
          case "history": {
            results = await client.analyticsRequest("domain_rank_history", {
              domain: params.domain,
              database: params.database,
              display_limit: String(params.limit),
              export_columns: EXPORT_COLUMNS.domain_rank_history,
            });
            title = `Domain History — ${params.domain} (${params.database})`;
            break;
          }
          case "competitors": {
            results = await client.analyticsRequest("domain_organic_organic", {
              domain: params.domain,
              database: params.database,
              display_limit: String(params.limit),
              export_columns: EXPORT_COLUMNS.domain_organic_organic,
            });
            title = `Organic Competitors — ${params.domain} (${params.database})`;
            break;
          }
          case "paid_competitors": {
            results = await client.analyticsRequest("domain_adwords_adwords", {
              domain: params.domain,
              database: params.database,
              display_limit: String(params.limit),
              export_columns: EXPORT_COLUMNS.domain_adwords_adwords,
            });
            title = `Paid Competitors — ${params.domain} (${params.database})`;
            break;
          }
          case "url_organic": {
            results = await client.analyticsRequest("url_organic", {
              url: params.domain,
              database: params.database,
              display_limit: String(params.limit),
              display_offset: String(params.offset),
              display_sort: params.sort,
              export_columns: EXPORT_COLUMNS.url_organic,
            });
            title = `URL Organic Keywords — ${params.domain} (${params.database})`;
            break;
          }
          case "url_adwords": {
            results = await client.analyticsRequest("url_adwords", {
              url: params.domain,
              database: params.database,
              display_limit: String(params.limit),
              display_offset: String(params.offset),
              export_columns: EXPORT_COLUMNS.url_adwords,
            });
            title = `URL Paid Keywords — ${params.domain} (${params.database})`;
            break;
          }
        }

        // Build French summary based on action
        let summary = "";
        switch (params.action) {
          case "organic":
          case "adwords":
          case "url_organic":
          case "url_adwords":
            summary = summarizeDomainOrganic(params.domain, params.database, results);
            break;
          case "overview":
            summary = summarizeDomainOverview(params.domain, results);
            break;
          case "competitors":
          case "paid_competitors":
            summary = summarizeDomainCompetitors(params.domain, params.database, results);
            break;
          default:
            summary = results.length > 0
              ? `${results.length} résultats trouvés pour ${params.domain} (${params.database}).`
              : `Aucun résultat pour ${params.domain}.`;
        }

        const text = [
          `## ${title}`,
          "",
          summary,
          "",
          `Results: ${results.length}`,
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
