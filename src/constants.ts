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
