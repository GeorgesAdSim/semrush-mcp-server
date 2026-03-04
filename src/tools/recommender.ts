import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSemrushClient } from "../services/semrush-api.js";
import { EXPORT_COLUMNS } from "../constants.js";

export function registerRecommenderTools(server: McpServer): void {
  server.registerTool(
    "semrush_recommend",
    {
      title: "SEMrush Recommender",
      description: `Meta-tool that orchestrates multiple SEMrush queries to produce actionable SEO recommendations. Available objectives:

- quick_wins: Find keywords on pages 2-3 (positions 11-30) with high volume. Quick improvements for fast traffic gains.
- increase_traffic: Comprehensive audit — current traffic, keyword gaps, missed opportunities, and prioritized action plan.
- beat_competitor: Head-to-head analysis against a competitor — keyword gaps, backlink gaps, and content opportunities.

Each objective runs 3-5 internal API calls and returns a structured recommendation with priority actions.`,
      inputSchema: {
        objective: z
          .enum(["quick_wins", "increase_traffic", "beat_competitor"])
          .describe("Recommendation objective"),
        domain: z
          .string()
          .min(3)
          .describe("Your domain to analyze"),
        competitor: z
          .string()
          .optional()
          .describe(
            "Competitor domain (required for 'beat_competitor' objective)"
          ),
        database: z
          .string()
          .default("fr")
          .describe("SEMrush database code"),
        limit: z
          .number()
          .min(1)
          .max(500)
          .default(100)
          .describe("Analysis depth (keywords to analyze per query)"),
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

        switch (params.objective) {
          case "quick_wins": {
            // Get organic keywords sorted by volume
            const keywords = await client.analyticsRequest("domain_organic", {
              domain: params.domain,
              database: params.database,
              display_limit: String(params.limit * 2),
              display_sort: "nq_desc",
              export_columns: EXPORT_COLUMNS.domain_organic,
            });

            // Filter positions 11-30 (page 2-3)
            const quickWins = keywords
              .filter((r) => {
                const pos = parseInt(r.position ?? "0");
                return pos >= 11 && pos <= 30;
              })
              .map((r) => {
                const pos = parseInt(r.position ?? "0");
                const vol = parseInt(r.search_volume ?? "0");
                const prev = parseInt(r.previous_position ?? "0");
                return {
                  keyword: r.keyword ?? "",
                  position: pos,
                  search_volume: vol,
                  url: r.url ?? "",
                  cpc: r.cpc ?? "0",
                  trend: prev > 0 && pos < prev ? "improving" : prev > 0 && pos > prev ? "declining" : "stable",
                  effort: pos <= 15 ? "low" : pos <= 20 ? "medium" : "high",
                  estimated_traffic_gain: Math.round(vol * (0.3 / pos) * 10) / 10,
                };
              })
              .sort((a, b) => b.estimated_traffic_gain - a.estimated_traffic_gain);

            const summary = {
              domain: params.domain,
              database: params.database,
              total_quick_wins: quickWins.length,
              by_effort: {
                low: quickWins.filter((q) => q.effort === "low").length,
                medium: quickWins.filter((q) => q.effort === "medium").length,
                high: quickWins.filter((q) => q.effort === "high").length,
              },
              total_potential_traffic: Math.round(
                quickWins.reduce((s, q) => s + q.estimated_traffic_gain, 0)
              ),
              top_5_actions: quickWins.slice(0, 5).map((q) => ({
                keyword: q.keyword,
                action: `Optimiser "${q.url}" pour "${q.keyword}" (position ${q.position} → top 10)`,
                effort: q.effort,
                potential_traffic: q.estimated_traffic_gain,
              })),
            };

            text = [
              `## Quick Wins — ${params.domain}`,
              "",
              "### Résumé",
              "```json\n" + JSON.stringify(summary, null, 2) + "\n```",
              "",
              "### Opportunités",
              quickWins.length === 0
                ? "Aucun quick win trouvé."
                : "```json\n" + JSON.stringify(quickWins.slice(0, params.limit), null, 2) + "\n```",
            ].join("\n");
            break;
          }

          case "increase_traffic": {
            // 1. Current overview
            const overview = await client.analyticsRequest("domain_rank", {
              domain: params.domain,
              database: params.database,
              export_columns: EXPORT_COLUMNS.domain_rank,
            });

            // 2. Current organic keywords
            const keywords = await client.analyticsRequest("domain_organic", {
              domain: params.domain,
              database: params.database,
              display_limit: String(params.limit),
              display_sort: "nq_desc",
              export_columns: EXPORT_COLUMNS.domain_organic,
            });

            // 3. Top competitors
            const competitors = await client.analyticsRequest(
              "domain_organic_organic",
              {
                domain: params.domain,
                database: params.database,
                display_limit: "5",
                export_columns: EXPORT_COLUMNS.domain_organic_organic,
              }
            );

            // Analysis
            const data = overview[0] ?? {};
            const currentTraffic = parseInt(data.organic_traffic ?? "0");
            const currentKws = parseInt(data.organic_keywords ?? "0");

            // Quick wins (page 2-3)
            const page2_3 = keywords.filter((r) => {
              const pos = parseInt(r.position ?? "0");
              return pos >= 11 && pos <= 30;
            });

            // Declining keywords
            const declining = keywords.filter((r) => {
              const pos = parseInt(r.position ?? "0");
              const prev = parseInt(r.previous_position ?? "0");
              return prev > 0 && pos > prev + 3;
            });

            // High volume keywords with poor ranking
            const missed = keywords.filter((r) => {
              const vol = parseInt(r.search_volume ?? "0");
              const pos = parseInt(r.position ?? "0");
              return vol >= 500 && pos > 20;
            });

            const recommendations = [];

            if (page2_3.length > 0) {
              recommendations.push({
                priority: 1,
                action: "Quick Wins — Optimiser les mots-clés en page 2-3",
                impact: "high",
                keywords_count: page2_3.length,
                top_keywords: page2_3
                  .sort(
                    (a, b) =>
                      parseInt(b.search_volume ?? "0") -
                      parseInt(a.search_volume ?? "0")
                  )
                  .slice(0, 5)
                  .map((r) => `${r.keyword} (#${r.position}, ${r.search_volume} vol)`),
              });
            }

            if (declining.length > 0) {
              recommendations.push({
                priority: 2,
                action: "Récupérer les positions perdues",
                impact: "medium",
                keywords_count: declining.length,
                top_keywords: declining
                  .slice(0, 5)
                  .map(
                    (r) =>
                      `${r.keyword} (${r.previous_position} → ${r.position})`
                  ),
              });
            }

            if (missed.length > 0) {
              recommendations.push({
                priority: 3,
                action: "Créer du contenu pour les mots-clés à fort volume",
                impact: "high",
                keywords_count: missed.length,
                top_keywords: missed
                  .slice(0, 5)
                  .map((r) => `${r.keyword} (${r.search_volume} vol, #${r.position})`),
              });
            }

            if (competitors.length > 0) {
              recommendations.push({
                priority: 4,
                action: "Analyser les concurrents et combler les gaps",
                impact: "medium",
                top_competitors: competitors
                  .slice(0, 3)
                  .map((c) => `${c.domain} (${c.common_keywords} mots-clés communs)`),
              });
            }

            const plan = {
              domain: params.domain,
              database: params.database,
              current_state: {
                organic_traffic: currentTraffic,
                organic_keywords: currentKws,
                organic_cost: data.organic_cost ?? "0",
              },
              opportunities: {
                quick_wins: page2_3.length,
                declining_positions: declining.length,
                missed_high_volume: missed.length,
                top_competitors: competitors.length,
              },
              recommendations,
            };

            text = [
              `## Plan d'augmentation du trafic — ${params.domain}`,
              "",
              "```json\n" + JSON.stringify(plan, null, 2) + "\n```",
            ].join("\n");
            break;
          }

          case "beat_competitor": {
            if (!params.competitor) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: "Error: Le paramètre 'competitor' est requis pour l'objectif 'beat_competitor'.",
                  },
                ],
                isError: true,
              };
            }

            // 1. Overview comparison
            const [myOverview, compOverview] = await Promise.all([
              client.analyticsRequest("domain_rank", {
                domain: params.domain,
                database: params.database,
                export_columns: EXPORT_COLUMNS.domain_rank,
              }),
              client.analyticsRequest("domain_rank", {
                domain: params.competitor,
                database: params.database,
                export_columns: EXPORT_COLUMNS.domain_rank,
              }),
            ]);

            // 2. Keyword gap
            const [myKws, compKws] = await Promise.all([
              client.analyticsRequest("domain_organic", {
                domain: params.domain,
                database: params.database,
                display_limit: String(params.limit),
                display_sort: "nq_desc",
                export_columns: EXPORT_COLUMNS.domain_organic,
              }),
              client.analyticsRequest("domain_organic", {
                domain: params.competitor,
                database: params.database,
                display_limit: String(params.limit),
                display_sort: "nq_desc",
                export_columns: EXPORT_COLUMNS.domain_organic,
              }),
            ]);

            // 3. Backlink comparison
            const [myBl, compBl] = await Promise.all([
              client.backlinksRequest("backlinks_overview", {
                target: params.domain,
                target_type: "root_domain",
                export_columns: EXPORT_COLUMNS.backlinks_overview,
              }),
              client.backlinksRequest("backlinks_overview", {
                target: params.competitor,
                target_type: "root_domain",
                export_columns: EXPORT_COLUMNS.backlinks_overview,
              }),
            ]);

            const myData = myOverview[0] ?? {};
            const compData = compOverview[0] ?? {};
            const myBlData = myBl[0] ?? {};
            const compBlData = compBl[0] ?? {};

            // Find keyword gaps
            const myKwSet = new Set(myKws.map((r) => r.keyword?.toLowerCase()));
            const gapKeywords = compKws
              .filter((r) => {
                const kw = r.keyword?.toLowerCase();
                const pos = parseInt(r.position ?? "999");
                return kw && !myKwSet.has(kw) && pos <= 20;
              })
              .map((r) => ({
                keyword: r.keyword,
                competitor_position: parseInt(r.position ?? "0"),
                search_volume: parseInt(r.search_volume ?? "0"),
              }))
              .sort((a, b) => b.search_volume - a.search_volume);

            // Find keywords where competitor ranks better
            const betterKeywords = compKws
              .filter((r) => {
                const kw = r.keyword?.toLowerCase();
                const compPos = parseInt(r.position ?? "999");
                const myRow = myKws.find(
                  (m) => m.keyword?.toLowerCase() === kw
                );
                if (!myRow) return false;
                const myPos = parseInt(myRow.position ?? "999");
                return compPos < myPos && compPos <= 10;
              })
              .map((r) => {
                const myRow = myKws.find(
                  (m) => m.keyword?.toLowerCase() === r.keyword?.toLowerCase()
                );
                return {
                  keyword: r.keyword,
                  your_position: parseInt(myRow?.position ?? "0"),
                  competitor_position: parseInt(r.position ?? "0"),
                  search_volume: parseInt(r.search_volume ?? "0"),
                  gap: parseInt(myRow?.position ?? "0") - parseInt(r.position ?? "0"),
                };
              })
              .sort((a, b) => b.search_volume - a.search_volume);

            const comparison = {
              you: {
                domain: params.domain,
                organic_keywords: parseInt(myData.organic_keywords ?? "0"),
                organic_traffic: parseInt(myData.organic_traffic ?? "0"),
                total_backlinks: parseInt(myBlData.total ?? "0"),
                referring_domains: parseInt(myBlData.domains_num ?? "0"),
              },
              competitor: {
                domain: params.competitor,
                organic_keywords: parseInt(compData.organic_keywords ?? "0"),
                organic_traffic: parseInt(compData.organic_traffic ?? "0"),
                total_backlinks: parseInt(compBlData.total ?? "0"),
                referring_domains: parseInt(compBlData.domains_num ?? "0"),
              },
            };

            const actions = [];

            if (gapKeywords.length > 0) {
              actions.push({
                priority: 1,
                action: "Créer du contenu pour les mots-clés du concurrent",
                impact: "high",
                count: gapKeywords.length,
                top_5: gapKeywords.slice(0, 5).map(
                  (g) => `"${g.keyword}" (${g.search_volume} vol, concurrent #${g.competitor_position})`
                ),
              });
            }

            if (betterKeywords.length > 0) {
              actions.push({
                priority: 2,
                action: "Améliorer le positionnement sur les mots-clés partagés",
                impact: "medium",
                count: betterKeywords.length,
                top_5: betterKeywords.slice(0, 5).map(
                  (b) => `"${b.keyword}" (vous #${b.your_position} vs #${b.competitor_position}, gap: ${b.gap})`
                ),
              });
            }

            const blGap =
              parseInt(compBlData.domains_num ?? "0") -
              parseInt(myBlData.domains_num ?? "0");
            if (blGap > 0) {
              actions.push({
                priority: 3,
                action: "Combler le gap de backlinks",
                impact: "high",
                detail: `Vous avez ${myBlData.domains_num} domaines référents vs ${compBlData.domains_num} pour le concurrent (gap: ${blGap})`,
              });
            }

            text = [
              `## Beat Competitor — ${params.domain} vs ${params.competitor}`,
              "",
              "### Comparaison",
              "```json\n" + JSON.stringify(comparison, null, 2) + "\n```",
              "",
              "### Plan d'action",
              "```json\n" + JSON.stringify(actions, null, 2) + "\n```",
              "",
              "### Keyword Gaps (mots-clés du concurrent que vous n'avez pas)",
              gapKeywords.length === 0
                ? "Aucun gap trouvé."
                : "```json\n" + JSON.stringify(gapKeywords.slice(0, 20), null, 2) + "\n```",
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
