import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSemrushClient } from "../services/semrush-api.js";
import { EXPORT_COLUMNS } from "../constants.js";

export function registerClusterEnrichmentTools(server: McpServer): void {
  server.registerTool(
    "semrush_enrich_cluster",
    {
      title: "SEMrush Cluster Enrichment",
      description: `Enrich a keyword cluster with SEMrush data. Accepts a list of keywords, fetches volume/CPC/competition/KD for each, and computes a cluster_score.

Input: array of keywords (max 100) or semicolon-separated string.
Output: enriched keywords + cluster summary with weighted score.

cluster_score = average of: volume_normalized * 0.4 + (100 - KD) * 0.4 + CPC_normalized * 0.2

Use this to prioritize which keyword clusters to target first.`,
      inputSchema: {
        keywords: z
          .array(z.string())
          .min(1)
          .max(100)
          .describe("Keywords in the cluster (max 100)"),
        cluster_name: z
          .string()
          .optional()
          .describe("Optional name for this cluster"),
        database: z
          .string()
          .default("fr")
          .describe("SEMrush database code"),
        target_domain: z
          .string()
          .optional()
          .describe(
            "Optional: your domain. If provided, shows current positions for each keyword."
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
        const kwList = params.keywords.join(";");

        // 1. Get volume/CPC/competition via phrase_all
        const overviewResults = await client.analyticsRequest("phrase_all", {
          phrase: kwList,
          database: params.database,
          export_columns: EXPORT_COLUMNS.phrase_all,
        });

        // 2. Get KD for all keywords
        const kdResults = await client.analyticsRequest("phrase_kdi", {
          phrase: kwList,
          database: params.database,
          export_columns: EXPORT_COLUMNS.phrase_kdi,
        });

        const kdMap = new Map(
          kdResults.map((r) => [
            r.keyword?.toLowerCase(),
            parseInt(r.keyword_difficulty ?? "50"),
          ])
        );

        // 3. Optionally get current positions for target domain
        let posMap = new Map<string, { position: number; url: string }>();
        if (params.target_domain) {
          const domainKws = await client.analyticsRequest("domain_organic", {
            domain: params.target_domain,
            database: params.database,
            display_limit: "500",
            display_sort: "nq_desc",
            export_columns: EXPORT_COLUMNS.domain_organic,
          });
          for (const row of domainKws) {
            const kw = row.keyword?.toLowerCase() ?? "";
            if (kw) {
              posMap.set(kw, {
                position: parseInt(row.position ?? "0"),
                url: row.url ?? "",
              });
            }
          }
        }

        // 4. Enrich each keyword
        const enriched = overviewResults.map((r) => {
          const kw = r.keyword?.toLowerCase() ?? "";
          const vol = parseInt(r.search_volume ?? "0");
          const cpc = parseFloat(r.cpc ?? "0");
          const kd = kdMap.get(kw) ?? 50;
          const currentPos = posMap.get(kw);

          return {
            keyword: r.keyword ?? "",
            search_volume: vol,
            cpc,
            competition: parseFloat(r.competition ?? "0"),
            keyword_difficulty: kd,
            trends: r.trends ?? "",
            ...(currentPos
              ? {
                  current_position: currentPos.position,
                  ranking_url: currentPos.url,
                }
              : {}),
          };
        });

        // 5. Compute cluster score
        const volumes = enriched.map((e) => e.search_volume);
        const cpcs = enriched.map((e) => e.cpc);
        const maxVol = Math.max(...volumes, 1);
        const maxCpc = Math.max(...cpcs, 0.01);

        const scores = enriched.map((e) => {
          const volNorm = (e.search_volume / maxVol) * 100;
          const kdScore = 100 - e.keyword_difficulty;
          const cpcNorm = (e.cpc / maxCpc) * 100;
          return volNorm * 0.4 + kdScore * 0.4 + cpcNorm * 0.2;
        });

        const clusterScore =
          scores.length > 0
            ? Math.round(
                (scores.reduce((a, b) => a + b, 0) / scores.length) * 100
              ) / 100
            : 0;

        const totalVolume = volumes.reduce((a, b) => a + b, 0);
        const avgKd =
          enriched.length > 0
            ? Math.round(
                enriched.reduce((s, e) => s + e.keyword_difficulty, 0) /
                  enriched.length
              )
            : 0;
        const avgCpc =
          enriched.length > 0
            ? Math.round(
                (enriched.reduce((s, e) => s + e.cpc, 0) / enriched.length) *
                  100
              ) / 100
            : 0;

        // Sort by individual keyword opportunity (volume / (KD+1))
        const sorted = enriched
          .map((e, i) => ({
            ...e,
            opportunity_score:
              Math.round(
                (e.search_volume / (e.keyword_difficulty + 1)) * 100
              ) / 100,
            _score: scores[i],
          }))
          .sort((a, b) => b.opportunity_score - a.opportunity_score);

        const summary = {
          cluster_name: params.cluster_name ?? "unnamed",
          database: params.database,
          keywords_count: sorted.length,
          cluster_score: clusterScore,
          cluster_grade:
            clusterScore >= 70
              ? "A — Excellent"
              : clusterScore >= 50
                ? "B — Bon"
                : clusterScore >= 30
                  ? "C — Moyen"
                  : "D — Faible",
          total_volume: totalVolume,
          avg_keyword_difficulty: avgKd,
          avg_cpc: avgCpc,
          ...(params.target_domain
            ? {
                target_domain: params.target_domain,
                keywords_ranked: sorted.filter(
                  (s) => "current_position" in s
                ).length,
                keywords_top10: sorted.filter(
                  (s) =>
                    "current_position" in s &&
                    (s as Record<string, unknown>).current_position !== undefined &&
                    ((s as Record<string, unknown>).current_position as number) <= 10
                ).length,
              }
            : {}),
        };

        const text = [
          `## Cluster Enrichment — ${summary.cluster_name}`,
          "",
          "### Summary",
          "```json\n" + JSON.stringify(summary, null, 2) + "\n```",
          "",
          "### Keywords",
          "```json\n" + JSON.stringify(sorted, null, 2) + "\n```",
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
