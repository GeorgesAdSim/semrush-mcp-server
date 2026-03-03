import type { SemrushConfig, AuditLogEntry } from "../types.js";
import { DEFAULT_CONFIG } from "../constants.js";

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
      .filter((k) => k !== "key") // never include API key in cache key
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");
    return `${endpoint}?${sorted}`;
  }
}
