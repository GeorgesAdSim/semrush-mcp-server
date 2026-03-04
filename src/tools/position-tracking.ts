import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSemrushClient } from "../services/semrush-api.js";
import { EXPORT_COLUMNS } from "../constants.js";

export function registerPositionTrackingTools(server: McpServer): void {
  server.registerTool(
    "semrush_tracking",
    {
      title: "SEMrush Position Tracking",
      description: `Track keyword positions over time. Available actions:

- get_positions: Current positions for a domain on specific keywords. Shows position, delta vs previous, and trend (up/down/stable).
- get_history: Historical ranking data for a domain over time. Shows month-by-month organic keywords, traffic, and rank changes.`,
      inputSchema: {
        action: z
          .enum(["get_positions", "get_history"])
          .describe("Tracking type"),
        domain: z.string().min(3).describe("Domain to track"),
        keywords: z
          .array(z.string())
          .optional()
          .describe(
            "Keywords to track (for get_positions). If omitted, returns top organic keywords."
          ),
        database: z
          .string()
          .default("fr")
          .describe("SEMrush database code"),
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
          case "get_positions": {
            // Get current organic positions
            const results = await client.analyticsRequest("domain_organic", {
              domain: params.domain,
              database: params.database,
              display_limit: String(params.limit),
              display_sort: "nq_desc",
              export_columns: EXPORT_COLUMNS.domain_organic,
            });

            // Filter by requested keywords if provided
            let filtered = results;
            if (params.keywords?.length) {
              const kwSet = new Set(
                params.keywords.map((k) => k.toLowerCase())
              );
              filtered = results.filter((r) =>
                kwSet.has(r.keyword?.toLowerCase())
              );
            }

            // Add trend indicator
            const enriched = filtered.map((r) => {
              const pos = parseInt(r.position ?? "0");
              const prev = parseInt(r.previous_position ?? "0");
              let trend = "stable";
              if (prev > 0 && pos < prev) trend = "up";
              else if (prev > 0 && pos > prev) trend = "down";
              return {
                ...r,
                delta: prev > 0 ? prev - pos : 0,
                trend,
              };
            });

            text = [
              `## Position Tracking — ${params.domain}`,
              `Database: ${params.database} | Keywords: ${enriched.length}`,
              "",
              enriched.length === 0
                ? "No positions found."
                : "```json\n" +
                  JSON.stringify(enriched, null, 2) +
                  "\n```",
            ].join("\n");
            break;
          }

          case "get_history": {
            // Get historical rank data
            const results = await client.analyticsRequest(
              "domain_rank_history",
              {
                domain: params.domain,
                database: params.database,
                display_limit: String(params.limit),
                export_columns: EXPORT_COLUMNS.domain_rank_history,
              }
            );

            // Add month-over-month deltas
            const enriched = results.map((r, i) => {
              const currentKw = parseInt(r.organic_keywords ?? "0");
              const prevKw =
                i + 1 < results.length
                  ? parseInt(results[i + 1].organic_keywords ?? "0")
                  : currentKw;
              const currentRk = parseInt(r.rank ?? "0");
              const prevRk =
                i + 1 < results.length
                  ? parseInt(results[i + 1].rank ?? "0")
                  : currentRk;
              return {
                ...r,
                keywords_delta: currentKw - prevKw,
                rank_delta: prevRk - currentRk, // positive = improved
                trend:
                  currentKw > prevKw
                    ? "up"
                    : currentKw < prevKw
                      ? "down"
                      : "stable",
              };
            });

            text = [
              `## Position History — ${params.domain}`,
              `Database: ${params.database} | Months: ${enriched.length}`,
              "",
              enriched.length === 0
                ? "No history found."
                : "```json\n" +
                  JSON.stringify(enriched, null, 2) +
                  "\n```",
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
