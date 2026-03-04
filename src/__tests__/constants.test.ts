import { describe, it, expect } from "vitest";
import {
  SEMRUSH_ANALYTICS_BASE_URL,
  SEMRUSH_BACKLINKS_BASE_URL,
  VALID_DATABASES,
  ACTION_COSTS,
  EXPORT_COLUMNS,
  COLUMN_LABELS,
  DEFAULT_CONFIG,
  TTL_BY_ACTION,
} from "../constants.js";

describe("Constants", () => {
  describe("API URLs", () => {
    it("should have correct analytics base URL", () => {
      expect(SEMRUSH_ANALYTICS_BASE_URL).toBe("https://api.semrush.com/");
    });

    it("should have correct backlinks base URL (different from analytics)", () => {
      expect(SEMRUSH_BACKLINKS_BASE_URL).toBe(
        "https://api.semrush.com/analytics/v1/"
      );
      expect(SEMRUSH_BACKLINKS_BASE_URL).not.toBe(SEMRUSH_ANALYTICS_BASE_URL);
    });
  });

  describe("VALID_DATABASES", () => {
    it("should contain 70+ database codes", () => {
      expect(VALID_DATABASES.length).toBeGreaterThanOrEqual(70);
    });

    it("should include key markets", () => {
      const expected = ["us", "uk", "fr", "de", "be", "ca", "au", "nl", "es", "it", "br", "jp"];
      for (const db of expected) {
        expect(VALID_DATABASES).toContain(db);
      }
    });

    it("should only contain lowercase 2-letter codes", () => {
      for (const db of VALID_DATABASES) {
        expect(db).toMatch(/^[a-z]{2}$/);
      }
    });
  });

  describe("ACTION_COSTS", () => {
    it("should have costs for all major actions", () => {
      expect(ACTION_COSTS.domain_organic).toBeDefined();
      expect(ACTION_COSTS.phrase_all).toBeDefined();
      expect(ACTION_COSTS.backlinks_overview).toBeDefined();
    });

    it("should have higher costs for computed/orchestration actions", () => {
      expect(ACTION_COSTS.gap_keyword).toBeGreaterThan(ACTION_COSTS.phrase_all);
      expect(ACTION_COSTS.cluster_enrich).toBeGreaterThan(
        ACTION_COSTS.domain_organic
      );
      expect(ACTION_COSTS.recommend).toBeGreaterThan(
        ACTION_COSTS.cluster_enrich
      );
    });

    it("should have all costs as positive numbers", () => {
      for (const [, cost] of Object.entries(ACTION_COSTS)) {
        expect(cost).toBeGreaterThan(0);
      }
    });
  });

  describe("EXPORT_COLUMNS", () => {
    it("should have columns for all endpoint types", () => {
      const requiredEndpoints = [
        "domain_organic",
        "domain_adwords",
        "domain_ranks",
        "domain_rank",
        "phrase_all",
        "phrase_related",
        "phrase_organic",
        "phrase_kdi",
        "backlinks_overview",
        "backlinks",
        "backlinks_refdomains",
        "backlinks_anchors",
      ];
      for (const ep of requiredEndpoints) {
        expect(EXPORT_COLUMNS[ep]).toBeDefined();
        expect(EXPORT_COLUMNS[ep].length).toBeGreaterThan(0);
      }
    });
  });

  describe("COLUMN_LABELS", () => {
    it("should map all common short codes", () => {
      expect(COLUMN_LABELS.Ph).toBe("keyword");
      expect(COLUMN_LABELS.Po).toBe("position");
      expect(COLUMN_LABELS.Nq).toBe("search_volume");
      expect(COLUMN_LABELS.Cp).toBe("cpc");
      expect(COLUMN_LABELS.Kd).toBe("keyword_difficulty");
      expect(COLUMN_LABELS.Dn).toBe("domain");
    });
  });

  describe("DEFAULT_CONFIG", () => {
    it("should have sensible defaults", () => {
      expect(DEFAULT_CONFIG.defaultDatabase).toBe("fr");
      expect(DEFAULT_CONFIG.maxResultsPerCall).toBe(100);
      expect(DEFAULT_CONFIG.cacheTtlSeconds).toBe(3600);
      expect(DEFAULT_CONFIG.rateLimit).toBe(10);
    });
  });

  describe("TTL_BY_ACTION", () => {
    it("should have TTL for all major endpoint categories", () => {
      expect(TTL_BY_ACTION.domain_ranks).toBe(86400);
      expect(TTL_BY_ACTION.backlinks_overview).toBe(43200);
      expect(TTL_BY_ACTION.phrase_all).toBe(3600);
      expect(TTL_BY_ACTION.domain_organic).toBe(1800);
    });

    it("should have longer TTL for stable data than volatile data", () => {
      expect(TTL_BY_ACTION.domain_ranks).toBeGreaterThan(TTL_BY_ACTION.backlinks_overview);
      expect(TTL_BY_ACTION.backlinks_overview).toBeGreaterThan(TTL_BY_ACTION.phrase_all);
      expect(TTL_BY_ACTION.phrase_all).toBeGreaterThan(TTL_BY_ACTION.domain_organic);
    });
  });
});
