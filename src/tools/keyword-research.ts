import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSemrushClient } from "../services/semrush-api.js";
import { EXPORT_COLUMNS } from "../constants.js";

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
- broad_match: Broad match keyword variations and long-tail alternatives`,
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
          ])
          .describe("Research type to perform"),
        keyword: z
          .string()
          .min(1)
          .describe(
            "Keyword to analyze. For 'difficulty' action: semicolon-separated list (e.g., 'seo;backlinks;netlinking')"
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
        }

        const text = [
          `## ${title}`,
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
