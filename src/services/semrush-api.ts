import {
  loadConfig,
  RateLimiter,
  ResponseCache,
  auditLog,
  getCacheTTL,
} from "../utils/governance.js";
import {
  SEMRUSH_ANALYTICS_BASE_URL,
  SEMRUSH_BACKLINKS_BASE_URL,
  SEMRUSH_TRENDS_BASE_URL,
  COLUMN_LABELS,
} from "../constants.js";
import type { SemrushConfig } from "../types.js";

// ===== Retry with Exponential Backoff =====

async function fetchWithRetry(
  url: string,
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      // Retry on 429 (rate limit) or 5xx (server error)
      if (response.status === 429 || response.status >= 500) {
        if (attempt < maxRetries) {
          const waitMs = 1000 * Math.pow(2, attempt);
          auditLog({
            timestamp: new Date().toISOString(),
            tool: "fetchWithRetry",
            endpoint: url.split("?")[0],
            params: { attempt: String(attempt + 1), wait_ms: String(waitMs) },
            status: "retry",
            duration_ms: 0,
            error: `HTTP ${response.status} — retrying in ${waitMs}ms`,
          });
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
      }
      return response;
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        const waitMs = 1000 * Math.pow(2, attempt);
        auditLog({
          timestamp: new Date().toISOString(),
          tool: "fetchWithRetry",
          endpoint: url.split("?")[0],
          params: { attempt: String(attempt + 1), wait_ms: String(waitMs) },
          status: "retry",
          duration_ms: 0,
          error: lastError.message,
        });
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }
  throw lastError ?? new Error("fetchWithRetry: all retries exhausted");
}

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
      const response = await fetchWithRetry(url);
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

      this.cache.set(cacheKey, results, getCacheTTL(type, this.config.cacheTtlSeconds));
      this.trackCall(type, false);
      return results;
    } catch (error: unknown) {
      this.trackCall(type, true);
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
      const response = await fetchWithRetry(url);
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

      this.cache.set(cacheKey, results, getCacheTTL(type, this.config.cacheTtlSeconds));
      this.trackCall(type, false);
      return results;
    } catch (error: unknown) {
      this.trackCall(type, true);
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
      const response = await fetchWithRetry(url);
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

      this.cache.set(cacheKey, results, getCacheTTL(`trends/${endpoint}`, this.config.cacheTtlSeconds));
      this.trackCall(`trends/${endpoint}`, false);
      return results;
    } catch (error: unknown) {
      this.trackCall(`trends/${endpoint}`, true);
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

  // ===== API Units & Session Stats =====

  private sessionStats = {
    calls: 0,
    errors: 0,
    endpoints: new Map<string, number>(),
    startedAt: new Date().toISOString(),
  };

  private trackCall(endpoint: string, isError: boolean): void {
    this.sessionStats.calls++;
    if (isError) this.sessionStats.errors++;
    this.sessionStats.endpoints.set(
      endpoint,
      (this.sessionStats.endpoints.get(endpoint) ?? 0) + 1
    );
  }

  async getApiUnits(): Promise<number> {
    const url = `https://www.semrush.com/users/countapiunits.html?key=${this.config.apiKey}`;
    await this.rateLimiter.acquire();
    const response = await fetchWithRetry(url);
    const text = await response.text();
    const units = parseFloat(text.trim());
    if (isNaN(units)) {
      throw new Error(`Impossible de lire le solde API: ${text.trim()}`);
    }
    return units;
  }

  getSessionStats(): Record<string, unknown> {
    const endpointBreakdown: Record<string, number> = {};
    for (const [ep, count] of this.sessionStats.endpoints) {
      endpointBreakdown[ep] = count;
    }
    return {
      session_started: this.sessionStats.startedAt,
      total_calls: this.sessionStats.calls,
      total_errors: this.sessionStats.errors,
      success_rate:
        this.sessionStats.calls > 0
          ? `${Math.round(((this.sessionStats.calls - this.sessionStats.errors) / this.sessionStats.calls) * 100)}%`
          : "N/A",
      endpoints: endpointBreakdown,
    };
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
