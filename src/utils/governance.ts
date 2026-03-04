import { createHash } from "node:crypto";
import type { SemrushConfig, AuditLogEntry } from "../types.js";
import { DEFAULT_CONFIG, ACTION_COSTS, TTL_BY_ACTION } from "../constants.js";

// ===== Quota Management (Multi-tenant) =====

export class QuotaExceededError extends Error {
  public resetTime: Date;
  constructor(userId: string, resetTime: Date) {
    super(
      `Quota dépassé pour l'utilisateur ${userId}. Reset à ${resetTime.toISOString()}`
    );
    this.name = "QuotaExceededError";
    this.resetTime = resetTime;
  }
}

/** Interface for future Supabase/DB backend */
export interface QuotaBackend {
  getUsage(userId: string): Promise<number>;
  getLimit(userId: string): Promise<number>;
  incrementUsage(userId: string, cost: number): Promise<void>;
  reset(userId: string): Promise<void>;
}

export class QuotaManager {
  private usage = new Map<string, { used: number; resetAt: number }>();
  private defaultDailyLimit: number;
  private resetInterval: ReturnType<typeof setInterval>;

  constructor(dailyLimit: number = 10000) {
    this.defaultDailyLimit = dailyLimit;
    // Reset all quotas daily at midnight
    this.resetInterval = setInterval(() => this.resetAll(), 86400 * 1000);
  }

  checkQuota(userId: string, action: string): void {
    const cost = ACTION_COSTS[action] ?? 1;
    const entry = this.getOrCreate(userId);
    if (entry.used + cost > this.defaultDailyLimit) {
      throw new QuotaExceededError(userId, new Date(entry.resetAt));
    }
  }

  incrementUsage(userId: string, action: string): void {
    const cost = ACTION_COSTS[action] ?? 1;
    const entry = this.getOrCreate(userId);
    entry.used += cost;
  }

  getUsage(userId: string): { used: number; limit: number; remaining: number; resetAt: string } {
    const entry = this.getOrCreate(userId);
    return {
      used: entry.used,
      limit: this.defaultDailyLimit,
      remaining: Math.max(0, this.defaultDailyLimit - entry.used),
      resetAt: new Date(entry.resetAt).toISOString(),
    };
  }

  private getOrCreate(userId: string): { used: number; resetAt: number } {
    let entry = this.usage.get(userId);
    if (!entry || Date.now() > entry.resetAt) {
      entry = {
        used: 0,
        resetAt: this.getNextMidnight(),
      };
      this.usage.set(userId, entry);
    }
    return entry;
  }

  private getNextMidnight(): number {
    const d = new Date();
    d.setHours(24, 0, 0, 0);
    return d.getTime();
  }

  private resetAll(): void {
    this.usage.clear();
  }

  destroy(): void {
    clearInterval(this.resetInterval);
  }
}

// ===== TTL by Action Category (imported from constants) =====

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
