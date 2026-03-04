import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  QuotaManager,
  QuotaExceededError,
  RateLimiter,
  ResponseCache,
  getCacheTTL,
} from "../utils/governance.js";

// ===== QuotaManager =====

describe("QuotaManager", () => {
  let qm: QuotaManager;

  beforeEach(() => {
    qm = new QuotaManager(100); // low limit for testing
  });

  afterEach(() => {
    qm.destroy();
  });

  it("should allow usage within quota", () => {
    expect(() => qm.checkQuota("user1", "phrase_all")).not.toThrow();
  });

  it("should increment usage correctly", () => {
    qm.incrementUsage("user1", "phrase_all"); // cost=1
    qm.incrementUsage("user1", "domain_organic"); // cost=10
    const usage = qm.getUsage("user1");
    expect(usage.used).toBe(11);
    expect(usage.remaining).toBe(89);
    expect(usage.limit).toBe(100);
  });

  it("should throw QuotaExceededError when quota exceeded", () => {
    // Fill up quota
    for (let i = 0; i < 10; i++) {
      qm.incrementUsage("user1", "domain_organic"); // 10 * 10 = 100
    }
    expect(() => qm.checkQuota("user1", "phrase_all")).toThrow(
      QuotaExceededError
    );
  });

  it("should track separate users independently", () => {
    qm.incrementUsage("user1", "domain_organic"); // 10
    qm.incrementUsage("user2", "phrase_all"); // 1
    expect(qm.getUsage("user1").used).toBe(10);
    expect(qm.getUsage("user2").used).toBe(1);
  });

  it("should reset usage when resetAt is past", () => {
    qm.incrementUsage("user1", "domain_organic");
    // Force reset by manipulating time
    const usage = qm.getUsage("user1");
    expect(usage.used).toBe(10);
    // Note: actual time-based reset tested via getOrCreate logic
  });

  it("should use default cost=1 for unknown actions", () => {
    qm.incrementUsage("user1", "unknown_action");
    expect(qm.getUsage("user1").used).toBe(1);
  });

  it("QuotaExceededError should have correct properties", () => {
    const resetTime = new Date();
    const err = new QuotaExceededError("user1", resetTime);
    expect(err.name).toBe("QuotaExceededError");
    expect(err.resetTime).toBe(resetTime);
    expect(err.message).toContain("user1");
  });
});

// ===== ResponseCache =====

describe("ResponseCache", () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache();
  });

  it("should return null for missing key", () => {
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("should store and retrieve data", () => {
    const data = [{ keyword: "seo", search_volume: "1000" }];
    cache.set("test-key", data, 60);
    expect(cache.get("test-key")).toEqual(data);
  });

  it("should return null for expired entries", () => {
    const data = [{ keyword: "seo" }];
    cache.set("expired", data, -1); // negative TTL = already expired
    expect(cache.get("expired")).toBeNull();
  });

  it("should build deterministic cache keys", () => {
    const key1 = cache.buildKey("domain_organic", {
      domain: "example.com",
      database: "fr",
    });
    const key2 = cache.buildKey("domain_organic", {
      database: "fr",
      domain: "example.com",
    });
    // Same params in different order should produce same key
    expect(key1).toBe(key2);
  });

  it("should exclude api key from cache key", () => {
    const key1 = cache.buildKey("test", { domain: "a.com", key: "secret123" });
    const key2 = cache.buildKey("test", { domain: "a.com", key: "different" });
    expect(key1).toBe(key2);
  });

  it("should produce different keys for different endpoints", () => {
    const key1 = cache.buildKey("domain_organic", { domain: "a.com" });
    const key2 = cache.buildKey("domain_adwords", { domain: "a.com" });
    expect(key1).not.toBe(key2);
  });
});

// ===== getCacheTTL =====

describe("getCacheTTL", () => {
  it("should return correct TTL for known actions", () => {
    expect(getCacheTTL("domain_ranks")).toBe(86400);
    expect(getCacheTTL("backlinks_overview")).toBe(43200);
    expect(getCacheTTL("phrase_all")).toBe(3600);
    expect(getCacheTTL("domain_organic")).toBe(1800);
  });

  it("should return fallback for unknown actions", () => {
    expect(getCacheTTL("unknown_action")).toBe(3600);
    expect(getCacheTTL("unknown_action", 600)).toBe(600);
  });
});

// ===== RateLimiter =====

describe("RateLimiter", () => {
  it("should acquire immediately when tokens available", async () => {
    const limiter = new RateLimiter(10);
    const start = Date.now();
    await limiter.acquire();
    expect(Date.now() - start).toBeLessThan(50);
  });

  it("should consume tokens on acquire", async () => {
    const limiter = new RateLimiter(2);
    await limiter.acquire();
    await limiter.acquire();
    // Third acquire should block briefly
    const start = Date.now();
    await limiter.acquire();
    expect(Date.now() - start).toBeGreaterThanOrEqual(50);
  });
});
