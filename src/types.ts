// ===== Configuration =====

export interface SemrushConfig {
  apiKey: string;
  defaultDatabase: string;
  maxResultsPerCall: number;
  cacheTtlSeconds: number;
  rateLimit: number;
}

// ===== Audit Log =====

export interface AuditLogEntry {
  timestamp: string;
  tool: string;
  endpoint: string;
  params: Record<string, unknown>;
  status: "success" | "error";
  duration_ms: number;
  error?: string;
}

// ===== Cache =====

export interface CacheEntry {
  data: Record<string, string>[];
  expiry: number;
}
