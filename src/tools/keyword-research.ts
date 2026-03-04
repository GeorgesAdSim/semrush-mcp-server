import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSemrushClient } from "../services/semrush-api.js";
import { EXPORT_COLUMNS } from "../constants.js";
import { summarizeKeywordOverview, summarizeKeywordRelated, summarizeKeywordDifficulty } from "../utils/summaries.js";

export function registerKeywordResearchTools(server: McpServer): void {
  server.registerTool(
    "semrush_keyword",
    {
      title: "SEMrush Keyword Research",
      description: `Research keywords for SEO and paid search. Available actions:

- overview: Search volume, CPC, competition, trends for a keyword
- related: Related keyword variations for a seed keyword
- questions: Question-based keywords (People Also Ask, featured snippets)
- difficulty: Keyword difficulty index (batch up to 100 keywords separated by semicolons)
- organic_results: Domains ranking in Google's top 100 for a keyword
- ad_results: Domains bidding on a keyword in Google Ads
- broad_match: Broad match keyword variations and long-tail alternatives
- bulk_overview: Batch analysis of up to 100 keywords at once (volume, KD, CPC, trend)`,
      inputSchema: {
        action: z
          .enum([
            "overview",
            "related",
            "questions",
            "difficulty",
            "organic_results",
            "ad_results",
            "broad_match",
            "bulk_overview",
          ])
          .describe("Research type to perform"),
        keyword: z
          .string()
          .min(1)
          .describe(
            "Keyword to analyze. For 'difficulty' and 'bulk_overview': semicolon-separated list (e.g., 'seo;backlinks;netlinking')"
          ),
        keywords: z
          .array(z.string())
          .max(100)
          .optional()
          .describe(
            "Array of keywords for 'bulk_overview' action (max 100). Alternative to semicolon-separated keyword string."
          ),
        database: z
          .string()
          .default("fr")
          .describe("SEMrush database code (e.g., 'fr', 'us', 'be')"),
        limit: z
          .number()
          .min(1)
          .max(10000)
          .default(50)
          .describe("Number of results to return"),
        sort: z
          .string()
          .default("nq_desc")
          .describe("Sort order (e.g., 'nq_desc', 'cp_desc', 'co_desc')"),
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
          case "overview": {
            results = await client.analyticsRequest("phrase_all", {
              phrase: params.keyword,
              database: params.database,
              export_columns: EXPORT_COLUMNS.phrase_all,
            });
            title = `Keyword Overview — "${params.keyword}" (${params.database})`;
            break;
          }
          case "related": {
            results = await client.analyticsRequest("phrase_related", {
              phrase: params.keyword,
              database: params.database,
              display_limit: String(params.limit),
              display_sort: params.sort,
              export_columns: EXPORT_COLUMNS.phrase_related,
            });
            title = `Related Keywords — "${params.keyword}" (${params.database})`;
            break;
          }
          case "questions": {
            results = await client.analyticsRequest("phrase_questions", {
              phrase: params.keyword,
              database: params.database,
              display_limit: String(params.limit),
              export_columns: EXPORT_COLUMNS.phrase_questions,
            });
            title = `Keyword Questions — "${params.keyword}" (${params.database})`;
            break;
          }
          case "difficulty": {
            results = await client.analyticsRequest("phrase_kdi", {
              phrase: params.keyword,
              database: params.database,
              export_columns: EXPORT_COLUMNS.phrase_kdi,
            });
            title = `Keyword Difficulty (${params.database})`;
            break;
          }
          case "organic_results": {
            results = await client.analyticsRequest("phrase_organic", {
              phrase: params.keyword,
              database: params.database,
              display_limit: String(params.limit),
              export_columns: EXPORT_COLUMNS.phrase_organic,
            });
            title = `Organic SERP — "${params.keyword}" (${params.database})`;
            break;
          }
          case "ad_results": {
            results = await client.analyticsRequest("phrase_adwords", {
              phrase: params.keyword,
              database: params.database,
              display_limit: String(params.limit),
              export_columns: EXPORT_COLUMNS.phrase_adwords,
            });
            title = `Paid SERP — "${params.keyword}" (${params.database})`;
            break;
          }
          case "broad_match": {
            results = await client.analyticsRequest("phrase_fullsearch", {
              phrase: params.keyword,
              database: params.database,
              display_limit: String(params.limit),
              display_sort: params.sort,
              export_columns: EXPORT_COLUMNS.phrase_fullsearch,
            });
            title = `Broad Match — "${params.keyword}" (${params.database})`;
            break;
          }
          case "bulk_overview": {
            // Accept either keywords[] array or semicolon-separated keyword string
            const kwList = params.keywords?.length
              ? params.keywords.join(";")
              : params.keyword;

            // Get volume + CPC + competition via phrase_all
            const overviewResults = await client.analyticsRequest("phrase_all", {
              phrase: kwList,
              database: params.database,
              export_columns: EXPORT_COLUMNS.phrase_all,
            });

            // Get KD for same keywords
            const kdResults = await client.analyticsRequest("phrase_kdi", {
              phrase: kwList,
              database: params.database,
              export_columns: EXPORT_COLUMNS.phrase_kdi,
            });

            // Merge KD into overview by keyword
            const kdMap = new Map(
              kdResults.map((r) => [r.keyword?.toLowerCase(), r.keyword_difficulty])
            );
            results = overviewResults.map((r) => ({
              ...r,
              keyword_difficulty: kdMap.get(r.keyword?.toLowerCase()) ?? "N/A",
            }));
            title = `Bulk Keyword Overview (${params.database})`;
            break;
          }
        }

        // Build French summary
        let summary = "";
        switch (params.action) {
          case "overview":
            summary = summarizeKeywordOverview(params.keyword, params.database, results);
            break;
          case "related":
          case "broad_match":
            summary = summarizeKeywordRelated(params.keyword, params.database, results);
            break;
          case "difficulty":
            summary = summarizeKeywordDifficulty(results);
            break;
          case "questions":
            summary = results.length > 0
              ? `${results.length} questions trouvées pour "${params.keyword}" en ${params.database.toUpperCase()}.`
              : `Aucune question trouvée pour "${params.keyword}".`;
            break;
          default:
            summary = results.length > 0
              ? `${results.length} résultats pour "${params.keyword}" (${params.database}).`
              : `Aucun résultat pour "${params.keyword}".`;
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
