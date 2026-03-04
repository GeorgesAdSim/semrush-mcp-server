// SEMrush API base URLs
export const SEMRUSH_ANALYTICS_BASE_URL = "https://api.semrush.com/";
export const SEMRUSH_BACKLINKS_BASE_URL = "https://api.semrush.com/analytics/v1/";
export const SEMRUSH_TRENDS_BASE_URL = "https://api.semrush.com/analytics/ta/api/v3/";

// Default configuration
export const DEFAULT_CONFIG = {
  defaultDatabase: "fr",
  maxResultsPerCall: 100,
  cacheTtlSeconds: 3600,
  rateLimit: 10,
} as const;

// Export column mappings per endpoint type
export const EXPORT_COLUMNS: Record<string, string> = {
  // Domain reports
  domain_organic: "Ph,Po,Pp,Nq,Cp,Ur,Tr,Tc,Co,Nr,Td",
  domain_adwords: "Ph,Po,Pp,Nq,Cp,Vu,Tr,Tc,Co,Nr,Td",
  domain_organic_organic: "Dn,Np,Or,Ot,Oc,Ad",
  domain_adwords_adwords: "Dn,Np,Ad,At,Ac,Or",
  domain_ranks: "Db,Or,Ot,Oc,Ad,At,Ac",
  domain_rank: "Dn,Rk,Or,Ot,Oc,Ad,At,Ac",
  domain_rank_history: "Dt,Rk,Or,Ot,Oc,Ad,At,Ac",

  // Keyword / phrase reports
  phrase_all: "Ph,Nq,Cp,Co,Nr,Td",
  phrase_related: "Ph,Nq,Cp,Co,Nr,Td,Rr",
  phrase_organic: "Dn,Ur,Fp,Fk",
  phrase_adwords: "Dn,Ur,Vu,Fk,Fp,Tt,Ds",
  phrase_questions: "Ph,Nq,Cp,Co,Nr,Td",
  phrase_kdi: "Ph,Kd",

  // Backlinks reports
  backlinks_overview:
    "total,domains_num,urls_num,ips_num,follows_num,nofollows_num,texts_num,images_num,forms_num,frames_num",
  backlinks:
    "page_score,source_url,source_title,target_url,anchor,external_num,internal_num,first_seen,last_seen",
  backlinks_refdomains:
    "domain,domain_score,backlinks_num,first_seen,last_seen",
  backlinks_anchors:
    "anchor,domains_num,backlinks_num,first_seen,last_seen",
  backlinks_tld:
    "zone,domains_num,backlinks_num",
  backlinks_geo:
    "country,domains_num,backlinks_num",
  backlinks_pages:
    "source_url,source_title,external_num,internal_num,last_seen",

  // URL-level reports
  url_organic: "Ph,Po,Pp,Nq,Cp,Tr,Tc,Co,Nr,Td",
  url_adwords: "Ph,Po,Pp,Nq,Cp,Vu,Tr,Tc,Co,Nr,Td",

  // Keyword broad match
  phrase_fullsearch: "Ph,Nq,Cp,Co,Nr,Td",
};

// Valid SEMrush databases (50+)
export const VALID_DATABASES = [
  "us", "uk", "ca", "au", "de", "fr", "es", "it", "br", "ar",
  "be", "ch", "dk", "fi", "hk", "ie", "il", "mx", "nl", "no",
  "pl", "se", "sg", "tr", "jp", "in", "hu", "za", "at", "bg",
  "cy", "cz", "ee", "gr", "hr", "lt", "lv", "mt", "pt", "ro",
  "rs", "si", "sk", "ua", "vn", "kr", "my", "ph", "th", "tw",
  "id", "ng", "ke", "co", "cl", "pe", "ec", "ve", "bo", "py",
  "uy", "cr", "gt", "pa", "do", "sv", "hn", "ni", "pr", "tt", "jm",
] as const;

export type SemrushDatabase = (typeof VALID_DATABASES)[number];

// Action cost for quota management
export const ACTION_COSTS: Record<string, number> = {
  // Domain
  domain_organic: 10, domain_adwords: 10, domain_ranks: 10, domain_rank: 10,
  domain_rank_history: 10, domain_organic_organic: 10, domain_adwords_adwords: 10,
  url_organic: 10, url_adwords: 10,
  // Keywords
  phrase_all: 1, phrase_related: 1, phrase_questions: 1, phrase_kdi: 1,
  phrase_organic: 1, phrase_adwords: 1, phrase_fullsearch: 1,
  // Backlinks
  backlinks_overview: 5, backlinks: 5, backlinks_refdomains: 5,
  backlinks_anchors: 5, backlinks_tld: 5, backlinks_geo: 5, backlinks_pages: 5,
  // Computed
  gap_keyword: 20, gap_backlink: 20, gap_content: 20,
  cluster_enrich: 25, recommend: 30,
};

// TTL by action category (seconds) — determines cache duration per endpoint type
export const TTL_BY_ACTION: Record<string, number> = {
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

// Column header short-code to friendly name mapping
export const COLUMN_LABELS: Record<string, string> = {
  // Domain / general
  Ph: "keyword",
  Po: "position",
  Pp: "previous_position",
  Nq: "search_volume",
  Cp: "cpc",
  Ur: "url",
  Tr: "traffic_percent",
  Tc: "traffic_cost",
  Co: "competition",
  Nr: "number_of_results",
  Td: "trends",
  Dn: "domain",
  Np: "common_keywords",
  Or: "organic_keywords",
  Ot: "organic_traffic",
  Oc: "organic_cost",
  Ad: "adwords_keywords",
  At: "adwords_traffic",
  Ac: "adwords_cost",
  Db: "database",
  Rk: "rank",
  Dt: "date",
  Rr: "related_relevance",
  Fp: "first_position",
  Fk: "first_keyword",
  Kd: "keyword_difficulty",
  Vu: "visible_url",
  Tt: "title",
  Ds: "description",
};
