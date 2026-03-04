import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

vi.mock("../services/semrush-api.js", () => {
  const analyticsRequest = vi.fn();
  const backlinksRequest = vi.fn();
  return {
    getSemrushClient: vi.fn(() => ({ analyticsRequest, backlinksRequest })),
  };
});

import { getSemrushClient } from "../services/semrush-api.js";
import { registerRecommenderTools } from "../tools/recommender.js";

// Fixtures
const ORGANIC_KEYWORDS = [
  { keyword: "seo agency", position: "12", search_volume: "3000", previous_position: "10", url: "/seo", cpc: "2.5" },
  { keyword: "web design", position: "5", search_volume: "5000", previous_position: "3", url: "/design", cpc: "3.0" },
  { keyword: "backlink tool", position: "25", search_volume: "2000", previous_position: "0", url: "/tools", cpc: "1.5" },
  { keyword: "seo audit", position: "8", search_volume: "1500", previous_position: "15", url: "/audit", cpc: "2.0" },
  { keyword: "lost keyword", position: "45", search_volume: "800", previous_position: "10", url: "/lost", cpc: "1.0" },
];
const DOMAIN_RANK = [{ organic_keywords: "5000", organic_traffic: "25000", organic_cost: "50000" }];
const COMPETITORS = [
  { domain: "competitor1.com", common_keywords: "500" },
  { domain: "competitor2.com", common_keywords: "300" },
];
const BL_OVERVIEW = [{ total: "50000", domains_num: "1200" }];

type Handler = (params: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

describe("semrush_recommend tool", () => {
  let handler: Handler;
  let mockAnalytics: ReturnType<typeof vi.fn>;
  let mockBacklinks: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    const client = getSemrushClient() as {
      analyticsRequest: ReturnType<typeof vi.fn>;
      backlinksRequest: ReturnType<typeof vi.fn>;
    };
    mockAnalytics = client.analyticsRequest;
    mockBacklinks = client.backlinksRequest;

    const mockServer = {
      registerTool: vi.fn((_n: string, _c: unknown, fn: unknown) => {
        handler = fn as Handler;
      }),
    };
    registerRecommenderTools(mockServer as unknown as McpServer);
  });

  describe("quick_wins", () => {
    it("should find keywords in positions 11-30", async () => {
      mockAnalytics.mockResolvedValueOnce(ORGANIC_KEYWORDS);
      const result = await handler({
        objective: "quick_wins",
        domain: "example.com",
        database: "fr",
        limit: 100,
      });
      expect(result.isError).toBeUndefined();
      const text = result.content[0].text;
      expect(text).toContain("Quick Wins");
      expect(text).toContain("seo agency");
      expect(text).toContain("backlink tool");
    });

    it("should classify effort levels correctly", async () => {
      mockAnalytics.mockResolvedValueOnce([
        { keyword: "easy", position: "12", search_volume: "1000", previous_position: "0", url: "/a", cpc: "1" },
        { keyword: "medium", position: "18", search_volume: "1000", previous_position: "0", url: "/b", cpc: "1" },
        { keyword: "hard", position: "28", search_volume: "1000", previous_position: "0", url: "/c", cpc: "1" },
      ]);
      const result = await handler({ objective: "quick_wins", domain: "a.com", database: "fr", limit: 100 });
      const text = result.content[0].text;
      expect(text).toContain('"effort": "low"');
      expect(text).toContain('"effort": "medium"');
      expect(text).toContain('"effort": "high"');
    });
  });

  describe("increase_traffic", () => {
    it("should produce a comprehensive traffic plan", async () => {
      mockAnalytics
        .mockResolvedValueOnce(DOMAIN_RANK)
        .mockResolvedValueOnce(ORGANIC_KEYWORDS)
        .mockResolvedValueOnce(COMPETITORS);
      const result = await handler({ objective: "increase_traffic", domain: "example.com", database: "fr", limit: 100 });
      expect(result.isError).toBeUndefined();
      const text = result.content[0].text;
      expect(text).toContain("Plan d'augmentation du trafic");
      expect(text).toContain("current_state");
      expect(text).toContain("recommendations");
    });

    it("should detect declining keywords", async () => {
      mockAnalytics
        .mockResolvedValueOnce(DOMAIN_RANK)
        .mockResolvedValueOnce([
          { keyword: "dropped", position: "30", search_volume: "1000", previous_position: "10", url: "/x", cpc: "1" },
        ])
        .mockResolvedValueOnce([]);
      const result = await handler({ objective: "increase_traffic", domain: "example.com", database: "fr", limit: 100 });
      expect(result.content[0].text).toContain("positions perdues");
    });
  });

  describe("beat_competitor", () => {
    it("should require competitor parameter", async () => {
      const result = await handler({ objective: "beat_competitor", domain: "a.com", database: "fr", limit: 100 });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("competitor");
    });

    it("should produce comparison and action plan", async () => {
      mockAnalytics
        .mockResolvedValueOnce(DOMAIN_RANK)
        .mockResolvedValueOnce([{ organic_keywords: "8000", organic_traffic: "40000" }])
        .mockResolvedValueOnce([{ keyword: "seo", position: "5", search_volume: "5000" }])
        .mockResolvedValueOnce([
          { keyword: "seo", position: "3", search_volume: "5000" },
          { keyword: "backlinks", position: "8", search_volume: "3000" },
        ]);
      mockBacklinks
        .mockResolvedValueOnce(BL_OVERVIEW)
        .mockResolvedValueOnce([{ total: "80000", domains_num: "2500" }]);

      const result = await handler({
        objective: "beat_competitor",
        domain: "example.com",
        competitor: "competitor.com",
        database: "fr",
        limit: 100,
      });
      expect(result.isError).toBeUndefined();
      const text = result.content[0].text;
      expect(text).toContain("Beat Competitor");
      expect(text).toContain("Comparaison");
      expect(text).toContain("Plan d'action");
    });

    it("should handle API errors gracefully", async () => {
      mockAnalytics.mockRejectedValue(new Error("API timeout"));
      const result = await handler({
        objective: "beat_competitor",
        domain: "a.com",
        competitor: "b.com",
        database: "fr",
        limit: 100,
      });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("API timeout");
    });
  });
});
