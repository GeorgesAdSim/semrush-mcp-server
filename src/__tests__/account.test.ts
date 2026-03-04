import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// vi.mock factory is hoisted — no external variable references allowed
vi.mock("../services/semrush-api.js", () => {
  const getApiUnits = vi.fn();
  const getSessionStats = vi.fn();
  return {
    getSemrushClient: vi.fn(() => ({ getApiUnits, getSessionStats })),
  };
});

import { getSemrushClient } from "../services/semrush-api.js";
import { registerAccountTools } from "../tools/account.js";

type Handler = (params: Record<string, unknown>) => Promise<{
  content: { type: string; text: string }[];
  isError?: boolean;
}>;

describe("semrush_credits tool", () => {
  let handler: Handler;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockServer = {
      registerTool: vi.fn((_n: string, _c: unknown, fn: unknown) => {
        handler = fn as Handler;
      }),
    };
    registerAccountTools(mockServer as unknown as McpServer);
  });

  it("should register the tool", () => {
    expect(handler).toBeDefined();
  });

  describe("action: balance", () => {
    it("should return balance without warning when >= 1000", async () => {
      const client = getSemrushClient() as { getApiUnits: ReturnType<typeof vi.fn> };
      client.getApiUnits.mockResolvedValue(50000);
      const result = await handler({ action: "balance" });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("50,000");
      expect(result.content[0].text).not.toContain("ATTENTION");
    });

    it("should return balance with warning when < 1000", async () => {
      const client = getSemrushClient() as { getApiUnits: ReturnType<typeof vi.fn> };
      client.getApiUnits.mockResolvedValue(500);
      const result = await handler({ action: "balance" });
      expect(result.content[0].text).toContain("500");
      expect(result.content[0].text).toContain("ATTENTION");
    });

    it("should handle API error gracefully", async () => {
      const client = getSemrushClient() as { getApiUnits: ReturnType<typeof vi.fn> };
      client.getApiUnits.mockRejectedValue(new Error("Network error"));
      const result = await handler({ action: "balance" });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Network error");
    });
  });

  describe("action: usage_stats", () => {
    it("should return session stats as JSON", async () => {
      const client = getSemrushClient() as { getSessionStats: ReturnType<typeof vi.fn> };
      client.getSessionStats.mockReturnValue({
        session_started: "2025-01-01T00:00:00.000Z",
        total_calls: 42,
        total_errors: 2,
        success_rate: "95%",
        endpoints: { domain_organic: 20, phrase_all: 22 },
      });
      const result = await handler({ action: "usage_stats" });
      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("42");
      expect(result.content[0].text).toContain("95%");
    });
  });
});
