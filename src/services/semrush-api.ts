import {
  loadConfig,
  RateLimiter,
  ResponseCache,
  auditLog,
} from "../utils/governance.js";
import {
  SEMRUSH_ANALYTICS_BASE_URL,
  SEMRUSH_BACKLINKS_BASE_URL,
  SEMRUSH_TRENDS_BASE_URL,
  COLUMN_LABELS,
} from "../constants.js";
import type { SemrushConfig } from "../types.js";

let instance: SemrushApiClient | null = null;

class SemrushApiClient {
  private config: SemrushConfig;
  private rateLimiter: RateLimiter;
  private cache: ResponseCache;

  constructor() {
    this.config = loadConfig();
    this.rateLimiter = new RateLimiter(this.config.rateLimit);
    this.cache = new ResponseCache();
    console.error(
      `[semrush-mcp] Config loaded — db=${this.config.defaultDatabase}, maxResults=${this.config.maxResultsPerCall}, cacheTTL=${this.config.cacheTtlSeconds}s`
    );
  }

  get defaultDatabase(): string {
    return this.config.defaultDatabase;
  }

  get maxResults(): number {
    return this.config.maxResultsPerCall;
  }

  // ===== Analytics API (CSV response) =====

  async analyticsRequest(
    type: string,
    params: Record<string, string>
  ): Promise<Record<string, string>[]> {
    const queryParams: Record<string, string> = {
      type,
      key: this.config.apiKey,
      ...params,
    };

    const cacheKey = this.cache.buildKey(type, params);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.error(`[semrush-mcp] Cache HIT: ${type}`);
      return cached;
    }

    const url = `${SEMRUSH_ANALYTICS_BASE_URL}?${new URLSearchParams(queryParams).toString()}`;
    const start = Date.now();

    try {
      await this.rateLimiter.acquire();
      const response = await fetch(url);
      const text = await response.text();
      const duration = Date.now() - start;

      // SEMrush error responses start with "ERROR"
      if (text.startsWith("ERROR")) {
        auditLog({
          timestamp: new Date().toISOString(),
          tool: type,
          endpoint: SEMRUSH_ANALYTICS_BASE_URL,
          params: this.stripKey(params),
          status: "error",
          duration_ms: duration,
          error: text.trim(),
        });
        throw new Error(`SEMrush API: ${text.trim()}`);
      }

      const results = this.parseCsv(text);

      auditLog({
        timestamp: new Date().toISOString(),
        tool: type,
        endpoint: SEMRUSH_ANALYTICS_BASE_URL,
        params: this.stripKey(params),
        status: "success",
        duration_ms: duration,
      });

      this.cache.set(cacheKey, results, this.config.cacheTtlSeconds);
      return results;
    } catch (error: unknown) {
      const duration = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);

      // Only log if not already logged above
      if (!message.startsWith("SEMrush API:")) {
        auditLog({
          timestamp: new Date().toISOString(),
          tool: type,
          endpoint: SEMRUSH_ANALYTICS_BASE_URL,
          params: this.stripKey(params),
          status: "error",
          duration_ms: duration,
          error: message,
        });
      }
      throw error;
    }
  }

  // ===== Backlinks API (CSV response, different base URL) =====

  async backlinksRequest(
    type: string,
    params: Record<string, string>
  ): Promise<Record<string, string>[]> {
    const queryParams: Record<string, string> = {
      type,
      key: this.config.apiKey,
      ...params,
    };

    const cacheKey = this.cache.buildKey(type, params);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.error(`[semrush-mcp] Cache HIT: ${type}`);
      return cached;
    }

    const url = `${SEMRUSH_BACKLINKS_BASE_URL}?${new URLSearchParams(queryParams).toString()}`;
    const start = Date.now();

    try {
      await this.rateLimiter.acquire();
      const response = await fetch(url);
      const text = await response.text();
      const duration = Date.now() - start;

      if (text.startsWith("ERROR")) {
        auditLog({
          timestamp: new Date().toISOString(),
          tool: type,
          endpoint: SEMRUSH_BACKLINKS_BASE_URL,
          params: this.stripKey(params),
          status: "error",
          duration_ms: duration,
          error: text.trim(),
        });
        throw new Error(`SEMrush Backlinks API: ${text.trim()}`);
      }

      const results = this.parseCsv(text);

      auditLog({
        timestamp: new Date().toISOString(),
        tool: type,
        endpoint: SEMRUSH_BACKLINKS_BASE_URL,
        params: this.stripKey(params),
        status: "success",
        duration_ms: duration,
      });

      this.cache.set(cacheKey, results, this.config.cacheTtlSeconds);
      return results;
    } catch (error: unknown) {
      const duration = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);

      if (!message.startsWith("SEMrush Backlinks API:")) {
        auditLog({
          timestamp: new Date().toISOString(),
          tool: type,
          endpoint: SEMRUSH_BACKLINKS_BASE_URL,
          params: this.stripKey(params),
          status: "error",
          duration_ms: duration,
          error: message,
        });
      }
      throw error;
    }
  }

  // ===== Trends API (JSON response) =====

  async trendsRequest(
    endpoint: string,
    params: Record<string, string>
  ): Promise<Record<string, string>[]> {
    const queryParams: Record<string, string> = {
      key: this.config.apiKey,
      ...params,
    };

    const cacheKey = this.cache.buildKey(`trends/${endpoint}`, params);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.error(`[semrush-mcp] Cache HIT: trends/${endpoint}`);
      return cached;
    }

    const url = `${SEMRUSH_TRENDS_BASE_URL}${endpoint}?${new URLSearchParams(queryParams).toString()}`;
    const start = Date.now();

    try {
      await this.rateLimiter.acquire();
      const response = await fetch(url);
      const duration = Date.now() - start;

      if (!response.ok) {
        const text = await response.text();
        auditLog({
          timestamp: new Date().toISOString(),
          tool: `trends/${endpoint}`,
          endpoint: `${SEMRUSH_TRENDS_BASE_URL}${endpoint}`,
          params: this.stripKey(params),
          status: "error",
          duration_ms: duration,
          error: `HTTP ${response.status}: ${text}`,
        });
        throw new Error(`SEMrush Trends API HTTP ${response.status}: ${text}`);
      }

      const json = await response.json() as Record<string, string>[] | Record<string, unknown>;

      // Trends API may return { data: [...] } or plain array
      let results: Record<string, string>[];
      if (Array.isArray(json)) {
        results = json as Record<string, string>[];
      } else if (
        json &&
        typeof json === "object" &&
        "data" in json &&
        Array.isArray((json as Record<string, unknown>).data)
      ) {
        results = (json as Record<string, unknown>).data as Record<string, string>[];
      } else {
        // Wrap single object in array
        results = [json as Record<string, string>];
      }

      auditLog({
        timestamp: new Date().toISOString(),
        tool: `trends/${endpoint}`,
        endpoint: `${SEMRUSH_TRENDS_BASE_URL}${endpoint}`,
        params: this.stripKey(params),
        status: "success",
        duration_ms: duration,
      });

      this.cache.set(cacheKey, results, this.config.cacheTtlSeconds);
      return results;
    } catch (error: unknown) {
      const duration = Date.now() - start;
      const message = error instanceof Error ? error.message : String(error);

      if (!message.startsWith("SEMrush Trends API")) {
        auditLog({
          timestamp: new Date().toISOString(),
          tool: `trends/${endpoint}`,
          endpoint: `${SEMRUSH_TRENDS_BASE_URL}${endpoint}`,
          params: this.stripKey(params),
          status: "error",
          duration_ms: duration,
          error: message,
        });
      }
      throw error;
    }
  }

  // ===== CSV Parser =====

  private parseCsv(csv: string): Record<string, string>[] {
    const lines = csv.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(";").map((h) => {
      const trimmed = h.trim();
      return COLUMN_LABELS[trimmed] ?? trimmed;
    });

    return lines.slice(1).map((line) => {
      const values = line.split(";");
      const row: Record<string, string> = {};
      headers.forEach((header, i) => {
        row[header] = values[i]?.trim() ?? "";
      });
      return row;
    });
  }

  // ===== Helpers =====

  private stripKey(params: Record<string, string>): Record<string, unknown> {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      if (k !== "key") clean[k] = v;
    }
    return clean;
  }
}

// Singleton accessor
export function getSemrushClient(): SemrushApiClient {
  if (!instance) {
    instance = new SemrushApiClient();
  }
  return instance;
}
