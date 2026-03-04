import { createHash } from "node:crypto";
import type { SemrushConfig, AuditLogEntry } from "../types.js";
import { DEFAULT_CONFIG } from "../constants.js";

// ===== TTL by Action Category =====

const TTL_BY_ACTION: Record<string, number> = {
  // Domain overview & history — stable data, long cache
  domain_ranks: 86400,
  domain_rank: 86400,
  domain_rank_history: 86400,
  // Backlinks — semi-stable
  backlinks_overview: 43200,
  backlinks: 43200,
  backlinks_refdomains: 43200,
  backlinks_anchors: 43200,
  backlinks_tld: 43200,
  backlinks_geo: 43200,
  backlinks_pages: 43200,
  // Keyword overview — moderate cache
  phrase_all: 3600,
  phrase_related: 3600,
  phrase_questions: 3600,
  phrase_kdi: 3600,
  phrase_fullsearch: 3600,
  // Positions & real-time — short cache
  phrase_organic: 1800,
  phrase_adwords: 1800,
  domain_organic: 1800,
  domain_adwords: 1800,
  url_organic: 1800,
  url_adwords: 1800,
};

export function getCacheTTL(action: string, fallback: number = 3600): number {
  return TTL_BY_ACTION[action] ?? fallback;
}

// ===== Config Loader =====

export function loadConfig(): SemrushConfig {
  const apiKey = process.env.SEMRUSH_API_KEY;
  if (!apiKey) {
    console.error("SEMRUSH_API_KEY environment variable is required.");
    process.exit(1);
  }
  return {
    apiKey,
    defaultDatabase:
      process.env.SEMRUSH_DEFAULT_DATABASE ?? DEFAULT_CONFIG.defaultDatabase,
    maxResultsPerCall:
      parseInt(process.env.SEMRUSH_MAX_RESULTS_PER_CALL ?? "") ||
      DEFAULT_CONFIG.maxResultsPerCall,
    cacheTtlSeconds:
      parseInt(process.env.SEMRUSH_CACHE_TTL ?? "") ||
      DEFAULT_CONFIG.cacheTtlSeconds,
    rateLimit:
      parseInt(process.env.SEMRUSH_RATE_LIMIT ?? "") ||
      DEFAULT_CONFIG.rateLimit,
  };
}

// ===== Rate Limiter (Token Bucket) =====

export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per ms
  private lastRefill: number;
  private readonly queue: Array<() => void> = [];

  constructor(requestsPerSecond: number) {
    this.maxTokens = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.refillRate = requestsPerSecond / 1000;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    // Wait until a token is available
    return new Promise<void>((resolve) => {
      const check = (): void => {
        this.refill();
        if (this.tokens >= 1) {
          this.tokens -= 1;
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      setTimeout(check, 100);
    });
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// ===== Audit Logger =====

export function auditLog(entry: AuditLogEntry): void {
  console.error(JSON.stringify(entry));
}

// ===== In-Memory Cache =====

export class ResponseCache {
  private cache = new Map<string, { data: Record<string, string>[]; expiry: number }>();

  get(key: string): Record<string, string>[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: Record<string, string>[], ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlSeconds * 1000,
    });
  }

  buildKey(endpoint: string, params: Record<string, string>): string {
    const sorted = Object.keys(params)
      .filter((k) => k !== "key")
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");
    const hash = createHash("sha256").update(`${endpoint}?${sorted}`).digest("hex").slice(0, 16);
    return `${endpoint}:${hash}`;
  }
}
