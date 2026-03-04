import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

vi.mock("../services/semrush-api.js", () => {
  const analyticsRequest = vi.fn();
  return {
    getSemrushClient: vi.fn(() => ({ analyticsRequest })),
  };
});

import { getSemrushClient } from "../services/semrush-api.js";
import { registerClusterEnrichmentTools } from "../tools/cluster-enrichment.js";

// Fixtures
const PHRASE_ALL_FIXTURE = [
  { keyword: "seo", search_volume: "5000", cpc: "2.5", competition: "0.8", trends: "1,1,1,1" },
  { keyword: "backlinks", search_volume: "3000", cpc: "1.8", competition: "0.6", trends: "0.9,1,1,1" },
  { keyword: "netlinking", search_volume: "1000", cpc: "1.2", competition: "0.4", trends: "1,1,0.9,1" },
];
const PHRASE_KDI_FIXTURE = [
  { keyword: "seo", keyword_difficulty: "60" },
  { keyword: "backlinks", keyword_difficulty: "45" },
  { keyword: "netlinking", keyword_difficulty: "30" },
];
const DOMAIN_ORGANIC_FIXTURE = [
  { keyword: "seo", position: "8", url: "https://example.com/seo" },
  { keyword: "backlinks", position: "15", url: "https://example.com/backlinks" },
];

type Handler = (params: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

describe("semrush_enrich_cluster tool", () => {
  let handler: Handler;
  let mockAnalytics: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    const client = getSemrushClient() as { analyticsRequest: ReturnType<typeof vi.fn> };
    mockAnalytics = client.analyticsRequest;

    const mockServer = {
      registerTool: vi.fn((_n: string, _c: unknown, fn: unknown) => {
        handler = fn as Handler;
      }),
    };
    registerClusterEnrichmentTools(mockServer as unknown as McpServer);
  });

  it("should enrich keywords with volume, KD, and cluster_score", async () => {
    mockAnalytics
      .mockResolvedValueOnce(PHRASE_ALL_FIXTURE)
      .mockResolvedValueOnce(PHRASE_KDI_FIXTURE);

    const result = await handler({
      keywords: ["seo", "backlinks", "netlinking"],
      database: "fr",
    });

    expect(result.isError).toBeUndefined();
    const text = result.content[0].text;
    expect(text).toContain("Cluster Enrichment");
    expect(text).toContain("cluster_score");
    expect(text).toContain("cluster_grade");
    expect(text).toContain("opportunity_score");

    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/g);
    expect(jsonMatch).toHaveLength(2);

    expect(mockAnalytics).toHaveBeenCalledTimes(2);
    expect(mockAnalytics).toHaveBeenCalledWith(
      "phrase_all",
      expect.objectContaining({ phrase: "seo;backlinks;netlinking" })
    );
  });

  it("should include current positions when target_domain provided", async () => {
    mockAnalytics
      .mockResolvedValueOnce(PHRASE_ALL_FIXTURE)
      .mockResolvedValueOnce(PHRASE_KDI_FIXTURE)
      .mockResolvedValueOnce(DOMAIN_ORGANIC_FIXTURE);

    const result = await handler({
      keywords: ["seo", "backlinks", "netlinking"],
      database: "fr",
      target_domain: "example.com",
    });

    const text = result.content[0].text;
    expect(text).toContain("current_position");
    expect(text).toContain("ranking_url");
    expect(text).toContain("keywords_ranked");
    expect(mockAnalytics).toHaveBeenCalledTimes(3);
  });

  it("should use cluster_name when provided", async () => {
    mockAnalytics
      .mockResolvedValueOnce(PHRASE_ALL_FIXTURE)
      .mockResolvedValueOnce(PHRASE_KDI_FIXTURE);

    const result = await handler({
      keywords: ["seo"],
      database: "fr",
      cluster_name: "SEO Cluster",
    });

    expect(result.content[0].text).toContain("SEO Cluster");
  });

  it("should handle API errors gracefully", async () => {
    mockAnalytics.mockRejectedValue(new Error("SEMrush API: ERROR 50"));
    const result = await handler({ keywords: ["seo"], database: "fr" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("ERROR 50");
  });

  it("should handle empty results", async () => {
    mockAnalytics.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const result = await handler({ keywords: ["xyz"], database: "fr" });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('"keywords_count": 0');
  });
});
