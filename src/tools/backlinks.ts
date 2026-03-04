import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSemrushClient } from "../services/semrush-api.js";
import { EXPORT_COLUMNS } from "../constants.js";
import { summarizeBacklinksOverview, summarizeRefdomains } from "../utils/summaries.js";

export function registerBacklinksTools(server: McpServer): void {
  server.registerTool(
    "semrush_backlinks",
    {
      title: "SEMrush Backlinks Analysis",
      description: `Analyze backlink profiles for any domain or URL. Available actions:

- overview: Summary with total backlinks, referring domains, follow/nofollow counts
- list: Individual backlinks with source URLs, anchors, page scores
- refdomains: Referring domains with authority scores and backlink counts
- anchors: Anchor text distribution (essential for netlinking audits)
- tld: Distribution by TLD (.com, .fr, .edu, .gov...)
- geo: Geographic distribution of backlinks by country
- pages: Pages that attract the most backlinks`,
      inputSchema: {
        action: z
          .enum(["overview", "list", "refdomains", "anchors", "tld", "geo", "pages"])
          .describe("Backlink analysis type"),
        target: z
          .string()
          .min(3)
          .describe(
            "Domain or URL to analyze (e.g., 'example.com' or 'https://example.com/page')"
          ),
        target_type: z
          .enum(["root_domain", "domain", "url"])
          .default("root_domain")
          .describe(
            "Target type: root_domain (entire site), domain (subdomain), url (exact page)"
          ),
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
          .describe("Pagination offset"),
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
            results = await client.backlinksRequest("backlinks_overview", {
              target: params.target,
              target_type: params.target_type,
              export_columns: EXPORT_COLUMNS.backlinks_overview,
            });
            title = `Backlinks Overview — ${params.target}`;
            break;
          }
          case "list": {
            results = await client.backlinksRequest("backlinks", {
              target: params.target,
              target_type: params.target_type,
              display_limit: String(params.limit),
              display_offset: String(params.offset),
              export_columns: EXPORT_COLUMNS.backlinks,
            });
            title = `Backlinks — ${params.target}`;
            break;
          }
          case "refdomains": {
            results = await client.backlinksRequest("backlinks_refdomains", {
              target: params.target,
              target_type: params.target_type,
              display_limit: String(params.limit),
              display_offset: String(params.offset),
              export_columns: EXPORT_COLUMNS.backlinks_refdomains,
            });
            title = `Referring Domains — ${params.target}`;
            break;
          }
          case "anchors": {
            results = await client.backlinksRequest("backlinks_anchors", {
              target: params.target,
              target_type: params.target_type,
              display_limit: String(params.limit),
              display_offset: String(params.offset),
              export_columns: EXPORT_COLUMNS.backlinks_anchors,
            });
            title = `Anchor Distribution — ${params.target}`;
            break;
          }
          case "tld": {
            results = await client.backlinksRequest("backlinks_tld", {
              target: params.target,
              target_type: params.target_type,
              display_limit: String(params.limit),
              export_columns: EXPORT_COLUMNS.backlinks_tld,
            });
            title = `TLD Distribution — ${params.target}`;
            break;
          }
          case "geo": {
            results = await client.backlinksRequest("backlinks_geo", {
              target: params.target,
              target_type: params.target_type,
              display_limit: String(params.limit),
              export_columns: EXPORT_COLUMNS.backlinks_geo,
            });
            title = `Backlinks Geo Distribution — ${params.target}`;
            break;
          }
          case "pages": {
            results = await client.backlinksRequest("backlinks_pages", {
              target: params.target,
              target_type: params.target_type,
              display_limit: String(params.limit),
              display_offset: String(params.offset),
              export_columns: EXPORT_COLUMNS.backlinks_pages,
            });
            title = `Most Linked Pages — ${params.target}`;
            break;
          }
        }

        // Build French summary
        let summary = "";
        switch (params.action) {
          case "overview":
            summary = summarizeBacklinksOverview(params.target, results);
            break;
          case "refdomains":
            summary = summarizeRefdomains(params.target, results);
            break;
          case "anchors":
            summary = results.length > 0
              ? `${results.length} ancres distinctes trouvées pour ${params.target}. Ancre principale : "${results[0]?.anchor ?? "?"}".`
              : `Aucune ancre trouvée pour ${params.target}.`;
            break;
          default:
            summary = results.length > 0
              ? `${results.length} résultats backlinks pour ${params.target}.`
              : `Aucun résultat pour ${params.target}.`;
        }

        const text = [
          `## ${title}`,
          "",
          summary,
          "",
          `Type: ${params.target_type} | Results: ${results.length}`,
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
