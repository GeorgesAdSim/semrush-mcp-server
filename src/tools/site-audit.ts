import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSemrushClient } from "../services/semrush-api.js";
import { EXPORT_COLUMNS } from "../constants.js";

export function registerSiteAuditTools(server: McpServer): void {
  server.registerTool(
    "semrush_audit",
    {
      title: "SEMrush SEO Audit",
      description: `Basic SEO audit using SEMrush Analytics data. Available actions:

- get_issues: Analyze a domain's organic keywords and URLs to detect common SEO issues (missing opportunities, thin content, cannibalization, position drops).
- get_pages: Audit individual pages — keyword coverage, positions, traffic share, and potential issues per URL.`,
      inputSchema: {
        action: z
          .enum(["get_issues", "get_pages"])
          .describe("Audit type"),
        domain: z.string().min(3).describe("Domain to audit"),
        database: z
          .string()
          .default("fr")
          .describe("SEMrush database code"),
        limit: z
          .number()
          .min(1)
          .max(500)
          .default(200)
          .describe("Number of keywords/pages to analyze"),
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
          case "get_issues": {
            // Get organic keywords
            const keywords = await client.analyticsRequest("domain_organic", {
              domain: params.domain,
              database: params.database,
              display_limit: String(params.limit),
              display_sort: "nq_desc",
              export_columns: EXPORT_COLUMNS.domain_organic,
            });

            // Analyze issues
            const issues: {
              category: string;
              severity: "error" | "warning" | "notice";
              count: number;
              details: string[];
            }[] = [];

            // 1. Position drops (previous_position better than current)
            const drops = keywords.filter((r) => {
              const pos = parseInt(r.position ?? "0");
              const prev = parseInt(r.previous_position ?? "0");
              return prev > 0 && pos > prev && pos - prev >= 3;
            });
            if (drops.length > 0) {
              issues.push({
                category: "Position Drops",
                severity: "warning",
                count: drops.length,
                details: drops.slice(0, 10).map(
                  (r) =>
                    `"${r.keyword}" dropped from #${r.previous_position} to #${r.position}`
                ),
              });
            }

            // 2. Keywords stuck on page 2-3 (positions 11-30) — low-hanging fruit
            const almostRanking = keywords.filter((r) => {
              const pos = parseInt(r.position ?? "0");
              return pos >= 11 && pos <= 30;
            });
            if (almostRanking.length > 0) {
              issues.push({
                category: "Low-Hanging Fruit (Page 2-3)",
                severity: "notice",
                count: almostRanking.length,
                details: almostRanking
                  .sort(
                    (a, b) =>
                      parseInt(b.search_volume ?? "0") -
                      parseInt(a.search_volume ?? "0")
                  )
                  .slice(0, 10)
                  .map(
                    (r) =>
                      `"${r.keyword}" at #${r.position} (${r.search_volume} vol/mo)`
                  ),
              });
            }

            // 3. Keyword cannibalization (same keyword, multiple URLs)
            const kwUrlMap = new Map<string, string[]>();
            for (const row of keywords) {
              const kw = row.keyword?.toLowerCase() ?? "";
              const url = row.url ?? "";
              if (kw && url) {
                const existing = kwUrlMap.get(kw);
                if (existing) {
                  if (!existing.includes(url)) existing.push(url);
                } else {
                  kwUrlMap.set(kw, [url]);
                }
              }
            }
            const cannibalized = Array.from(kwUrlMap.entries()).filter(
              ([, urls]) => urls.length > 1
            );
            if (cannibalized.length > 0) {
              issues.push({
                category: "Keyword Cannibalization",
                severity: "error",
                count: cannibalized.length,
                details: cannibalized.slice(0, 10).map(
                  ([kw, urls]) => `"${kw}" → ${urls.length} URLs competing`
                ),
              });
            }

            // 4. High-volume keywords with low positions (missed opportunities)
            const missed = keywords.filter((r) => {
              const vol = parseInt(r.search_volume ?? "0");
              const pos = parseInt(r.position ?? "0");
              return vol >= 500 && pos > 20;
            });
            if (missed.length > 0) {
              issues.push({
                category: "Missed Opportunities (High Volume, Low Rank)",
                severity: "warning",
                count: missed.length,
                details: missed.slice(0, 10).map(
                  (r) =>
                    `"${r.keyword}" — ${r.search_volume} vol/mo but position #${r.position}`
                ),
              });
            }

            // 5. Thin pages (URLs with only 1 keyword)
            const urlKwCount = new Map<string, number>();
            for (const row of keywords) {
              const url = row.url ?? "";
              urlKwCount.set(url, (urlKwCount.get(url) ?? 0) + 1);
            }
            const thinPages = Array.from(urlKwCount.entries()).filter(
              ([, count]) => count === 1
            );
            if (thinPages.length > 0) {
              issues.push({
                category: "Potential Thin Content (1 keyword per page)",
                severity: "notice",
                count: thinPages.length,
                details: thinPages.slice(0, 10).map(([url]) => url),
              });
            }

            const summary = {
              domain: params.domain,
              database: params.database,
              keywords_analyzed: keywords.length,
              total_issues: issues.reduce((s, i) => s + i.count, 0),
              by_severity: {
                errors: issues
                  .filter((i) => i.severity === "error")
                  .reduce((s, i) => s + i.count, 0),
                warnings: issues
                  .filter((i) => i.severity === "warning")
                  .reduce((s, i) => s + i.count, 0),
                notices: issues
                  .filter((i) => i.severity === "notice")
                  .reduce((s, i) => s + i.count, 0),
              },
            };

            text = [
              `## SEO Audit — ${params.domain} (${params.database})`,
              "",
              "### Summary",
              "```json\n" + JSON.stringify(summary, null, 2) + "\n```",
              "",
              "### Issues",
              "```json\n" + JSON.stringify(issues, null, 2) + "\n```",
            ].join("\n");
            break;
          }

          case "get_pages": {
            // Get organic keywords grouped by URL
            const keywords = await client.analyticsRequest("domain_organic", {
              domain: params.domain,
              database: params.database,
              display_limit: String(params.limit * 2),
              display_sort: "tr_desc",
              export_columns: EXPORT_COLUMNS.domain_organic,
            });

            // Group by URL
            const pageMap = new Map<
              string,
              {
                url: string;
                keywords_count: number;
                total_traffic_share: number;
                best_position: number;
                worst_position: number;
                top_keywords: { keyword: string; position: number; volume: number }[];
                issues: string[];
              }
            >();

            for (const row of keywords) {
              const url = row.url ?? "";
              if (!url) continue;
              const pos = parseInt(row.position ?? "999");
              const prevPos = parseInt(row.previous_position ?? "0");
              const vol = parseInt(row.search_volume ?? "0");
              const traffic = parseFloat(row.traffic_percent ?? "0");

              const existing = pageMap.get(url);
              if (existing) {
                existing.keywords_count++;
                existing.total_traffic_share += traffic;
                existing.best_position = Math.min(existing.best_position, pos);
                existing.worst_position = Math.max(existing.worst_position, pos);
                if (existing.top_keywords.length < 5) {
                  existing.top_keywords.push({
                    keyword: row.keyword ?? "",
                    position: pos,
                    volume: vol,
                  });
                }
                // Check for drops
                if (prevPos > 0 && pos > prevPos + 5) {
                  existing.issues.push(
                    `"${row.keyword}" dropped ${pos - prevPos} positions`
                  );
                }
              } else {
                const issues: string[] = [];
                if (prevPos > 0 && pos > prevPos + 5) {
                  issues.push(
                    `"${row.keyword}" dropped ${pos - prevPos} positions`
                  );
                }
                pageMap.set(url, {
                  url,
                  keywords_count: 1,
                  total_traffic_share: traffic,
                  best_position: pos,
                  worst_position: pos,
                  top_keywords: [
                    { keyword: row.keyword ?? "", position: pos, volume: vol },
                  ],
                  issues,
                });
              }
            }

            const pages = Array.from(pageMap.values())
              .sort((a, b) => b.total_traffic_share - a.total_traffic_share)
              .slice(0, params.limit)
              .map((p) => ({
                ...p,
                total_traffic_share:
                  Math.round(p.total_traffic_share * 100) / 100,
              }));

            text = [
              `## Page Audit — ${params.domain} (${params.database})`,
              `Pages analyzed: ${pages.length}`,
              "",
              pages.length === 0
                ? "No pages found."
                : "```json\n" + JSON.stringify(pages, null, 2) + "\n```",
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
