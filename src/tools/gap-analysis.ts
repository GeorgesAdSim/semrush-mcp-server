import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSemrushClient } from "../services/semrush-api.js";
import { EXPORT_COLUMNS } from "../constants.js";

export function registerGapAnalysisTools(server: McpServer): void {
  server.registerTool(
    "semrush_gap",
    {
      title: "SEMrush Gap Analysis",
      description: `Competitive gap analysis combining multiple SEMrush endpoints. Available actions:

- keyword_gap: Find keywords where competitors rank top 20 but you don't. Returns opportunities sorted by volume with opportunity_score.
- backlink_gap: Find referring domains linking to competitors but not to you. Returns missing domains sorted by authority with priority level.
- content_gap: Compare top organic URLs across competitors to find topics you're missing. Returns topic clusters with opportunity counts.`,
      inputSchema: {
        action: z
          .enum(["keyword_gap", "backlink_gap", "content_gap"])
          .describe("Gap analysis type"),
        domains: z
          .array(z.string())
          .min(2)
          .max(5)
          .describe(
            "Domains to compare. First domain is the TARGET, rest are competitors."
          ),
        database: z
          .string()
          .default("fr")
          .describe("SEMrush database code"),
        limit: z
          .number()
          .min(1)
          .max(1000)
          .default(100)
          .describe("Max keywords/domains to analyze per domain"),
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
        const target = params.domains[0];
        const competitors = params.domains.slice(1);
        let text: string;

        switch (params.action) {
          case "keyword_gap": {
            // 1. Get organic keywords for target (top N by volume)
            const targetKws = await client.analyticsRequest("domain_organic", {
              domain: target,
              database: params.database,
              display_limit: String(params.limit),
              display_sort: "nq_desc",
              export_columns: EXPORT_COLUMNS.domain_organic,
            });

            const targetKeywordSet = new Set(
              targetKws.map((r) => r.keyword?.toLowerCase())
            );

            // 2. Get organic keywords for each competitor
            const competitorKwArrays = await Promise.all(
              competitors.map((comp) =>
                client.analyticsRequest("domain_organic", {
                  domain: comp,
                  database: params.database,
                  display_limit: String(params.limit),
                  display_sort: "nq_desc",
                  export_columns: EXPORT_COLUMNS.domain_organic,
                })
              )
            );

            // 3. Find keywords where competitors rank top 20 but target doesn't
            const gapKeywords = new Map<
              string,
              { keyword: string; volume: number; cpc: string; competitors: string[] }
            >();

            for (let i = 0; i < competitors.length; i++) {
              for (const row of competitorKwArrays[i]) {
                const kw = row.keyword?.toLowerCase();
                const pos = parseInt(row.position ?? "999");
                if (kw && pos <= 20 && !targetKeywordSet.has(kw)) {
                  const existing = gapKeywords.get(kw);
                  if (existing) {
                    existing.competitors.push(competitors[i]);
                  } else {
                    gapKeywords.set(kw, {
                      keyword: row.keyword,
                      volume: parseInt(row.search_volume ?? "0"),
                      cpc: row.cpc ?? "0",
                      competitors: [competitors[i]],
                    });
                  }
                }
              }
            }

            // 4. Get KD for gap keywords (batch up to 100)
            const gapKwList = Array.from(gapKeywords.keys()).slice(0, 100);
            let kdMap = new Map<string, number>();

            if (gapKwList.length > 0) {
              const kdResults = await client.analyticsRequest("phrase_kdi", {
                phrase: gapKwList.join(";"),
                database: params.database,
                export_columns: EXPORT_COLUMNS.phrase_kdi,
              });
              kdMap = new Map(
                kdResults.map((r) => [
                  r.keyword?.toLowerCase(),
                  parseInt(r.keyword_difficulty ?? "50"),
                ])
              );
            }

            // 5. Build results with opportunity_score
            const results = Array.from(gapKeywords.values())
              .map((g) => {
                const kd = kdMap.get(g.keyword.toLowerCase()) ?? 50;
                return {
                  keyword: g.keyword,
                  search_volume: g.volume,
                  cpc: g.cpc,
                  keyword_difficulty: kd,
                  opportunity_score: Math.round((g.volume / (kd + 1)) * 100) / 100,
                  found_in_competitors: g.competitors,
                };
              })
              .sort((a, b) => b.opportunity_score - a.opportunity_score);

            text = [
              `## Keyword Gap — ${target} vs ${competitors.join(", ")}`,
              `Database: ${params.database} | Opportunities: ${results.length}`,
              "",
              results.length === 0
                ? "No keyword gaps found."
                : "```json\n" + JSON.stringify(results.slice(0, params.limit), null, 2) + "\n```",
            ].join("\n");
            break;
          }

          case "backlink_gap": {
            // 1. Get referring domains for target
            const targetRefDomains = await client.backlinksRequest(
              "backlinks_refdomains",
              {
                target,
                target_type: "root_domain",
                display_limit: String(params.limit),
                export_columns: EXPORT_COLUMNS.backlinks_refdomains,
              }
            );

            const targetDomainSet = new Set(
              targetRefDomains.map((r) => r.domain?.toLowerCase())
            );

            // 2. Get referring domains for each competitor
            const competitorRefArrays = await Promise.all(
              competitors.map((comp) =>
                client.backlinksRequest("backlinks_refdomains", {
                  target: comp,
                  target_type: "root_domain",
                  display_limit: String(params.limit),
                  export_columns: EXPORT_COLUMNS.backlinks_refdomains,
                })
              )
            );

            // 3. Find domains in competitors but not in target
            const missingDomains = new Map<
              string,
              {
                domain: string;
                domain_score: number;
                backlinks_num: number;
                found_in: string[];
              }
            >();

            for (let i = 0; i < competitors.length; i++) {
              for (const row of competitorRefArrays[i]) {
                const dom = row.domain?.toLowerCase();
                if (dom && !targetDomainSet.has(dom)) {
                  const existing = missingDomains.get(dom);
                  if (existing) {
                    existing.found_in.push(competitors[i]);
                  } else {
                    missingDomains.set(dom, {
                      domain: row.domain,
                      domain_score: parseInt(row.domain_score ?? "0"),
                      backlinks_num: parseInt(row.backlinks_num ?? "0"),
                      found_in: [competitors[i]],
                    });
                  }
                }
              }
            }

            // 4. Sort by authority and assign priority
            const results = Array.from(missingDomains.values())
              .sort((a, b) => b.domain_score - a.domain_score)
              .map((d) => ({
                ...d,
                priority:
                  d.domain_score >= 60
                    ? "high"
                    : d.domain_score >= 30
                      ? "medium"
                      : "low",
              }));

            text = [
              `## Backlink Gap — ${target} vs ${competitors.join(", ")}`,
              `Missing referring domains: ${results.length}`,
              "",
              results.length === 0
                ? "No backlink gaps found."
                : "```json\n" + JSON.stringify(results.slice(0, params.limit), null, 2) + "\n```",
            ].join("\n");
            break;
          }

          case "content_gap": {
            // 1. Get top organic keywords per domain (target + competitors)
            const allDomainKws = await Promise.all(
              params.domains.map((dom) =>
                client.analyticsRequest("domain_organic", {
                  domain: dom,
                  database: params.database,
                  display_limit: String(params.limit),
                  display_sort: "tr_desc",
                  export_columns: EXPORT_COLUMNS.domain_organic,
                })
              )
            );

            // 2. Extract URL-level topics for each domain
            const domainTopics = params.domains.map((dom, i) => {
              const urls = new Map<string, string[]>();
              for (const row of allDomainKws[i]) {
                const url = row.url ?? "";
                const kw = row.keyword ?? "";
                if (url && kw) {
                  const existing = urls.get(url);
                  if (existing) {
                    existing.push(kw);
                  } else {
                    urls.set(url, [kw]);
                  }
                }
              }
              return urls;
            });

            // 3. Cluster by keyword root (first 2 words)
            function getRoot(keyword: string): string {
              return keyword.toLowerCase().split(/\s+/).slice(0, 2).join(" ");
            }

            const targetRoots = new Set<string>();
            for (const kws of domainTopics[0].values()) {
              for (const kw of kws) {
                targetRoots.add(getRoot(kw));
              }
            }

            // 4. Find topics in competitors but not in target
            const missingTopics = new Map<
              string,
              {
                topic_root: string;
                keywords: string[];
                total_volume: number;
                found_in: string[];
              }
            >();

            for (let i = 1; i < params.domains.length; i++) {
              for (const kws of domainTopics[i].values()) {
                for (const kw of kws) {
                  const root = getRoot(kw);
                  if (!targetRoots.has(root)) {
                    const existing = missingTopics.get(root);
                    const vol = parseInt(
                      allDomainKws[i].find(
                        (r) => r.keyword?.toLowerCase() === kw.toLowerCase()
                      )?.search_volume ?? "0"
                    );
                    if (existing) {
                      if (!existing.keywords.includes(kw)) {
                        existing.keywords.push(kw);
                        existing.total_volume += vol;
                      }
                      if (!existing.found_in.includes(params.domains[i])) {
                        existing.found_in.push(params.domains[i]);
                      }
                    } else {
                      missingTopics.set(root, {
                        topic_root: root,
                        keywords: [kw],
                        total_volume: vol,
                        found_in: [params.domains[i]],
                      });
                    }
                  }
                }
              }
            }

            const results = Array.from(missingTopics.values())
              .sort((a, b) => b.total_volume - a.total_volume)
              .slice(0, params.limit);

            const summary = {
              target,
              competitors,
              total_missing_topics: results.length,
              total_missing_keywords: results.reduce(
                (sum, t) => sum + t.keywords.length,
                0
              ),
              top_opportunities: results.slice(0, 5).map((t) => t.topic_root),
            };

            text = [
              `## Content Gap — ${target} vs ${competitors.join(", ")}`,
              `Database: ${params.database}`,
              "",
              "### Summary",
              "```json\n" + JSON.stringify(summary, null, 2) + "\n```",
              "",
              "### Missing Topics",
              results.length === 0
                ? "No content gaps found."
                : "```json\n" + JSON.stringify(results, null, 2) + "\n```",
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
