/**
 * French-language summary builder for SEMrush tool responses.
 * Generates concise, actionable summaries in French.
 */

// ===== Domain Summaries =====

export function summarizeDomainOrganic(
  domain: string,
  db: string,
  results: Record<string, string>[]
): string {
  if (results.length === 0) return `Aucun mot-clé organique trouvé pour ${domain} (${db}).`;
  const top3 = results.slice(0, 3).map((r) => `"${r.keyword}" (#${r.position})`).join(", ");
  const avgPos = Math.round(
    results.reduce((s, r) => s + parseInt(r.position ?? "0"), 0) / results.length
  );
  return `**${domain}** possède ${results.length} mots-clés organiques en ${db.toUpperCase()}. Position moyenne : ${avgPos}. Top 3 : ${top3}.`;
}

export function summarizeDomainOverview(
  domain: string,
  results: Record<string, string>[]
): string {
  if (results.length === 0) return `Aucune donnée trouvée pour ${domain}.`;
  const totalKws = results.reduce((s, r) => s + parseInt(r.organic_keywords ?? "0"), 0);
  const totalTraffic = results.reduce((s, r) => s + parseInt(r.organic_traffic ?? "0"), 0);
  const dbCount = results.length;
  return `**${domain}** est présent dans ${dbCount} bases de données SEMrush. Total : ${totalKws.toLocaleString()} mots-clés organiques, ~${totalTraffic.toLocaleString()} visites/mois estimées.`;
}

export function summarizeDomainCompetitors(
  domain: string,
  db: string,
  results: Record<string, string>[]
): string {
  if (results.length === 0) return `Aucun concurrent organique trouvé pour ${domain} (${db}).`;
  const top3 = results.slice(0, 3).map((r) => `${r.domain} (${r.common_keywords} mots-clés communs)`).join(", ");
  return `**${domain}** a ${results.length} concurrents organiques en ${db.toUpperCase()}. Principaux : ${top3}.`;
}

// ===== Keyword Summaries =====

export function summarizeKeywordOverview(
  keyword: string,
  db: string,
  results: Record<string, string>[]
): string {
  if (results.length === 0) return `Aucune donnée pour "${keyword}" (${db}).`;
  const r = results[0];
  return `**"${keyword}"** en ${db.toUpperCase()} : ${r.search_volume ?? "?"} recherches/mois, CPC ${r.cpc ?? "?"}€, compétition ${r.competition ?? "?"}.`;
}

export function summarizeKeywordRelated(
  keyword: string,
  db: string,
  results: Record<string, string>[]
): string {
  if (results.length === 0) return `Aucun mot-clé apparenté pour "${keyword}" (${db}).`;
  const totalVol = results.reduce((s, r) => s + parseInt(r.search_volume ?? "0"), 0);
  const top3 = results.slice(0, 3).map((r) => `"${r.keyword}" (${r.search_volume} vol)`).join(", ");
  return `${results.length} mots-clés apparentés à "${keyword}" trouvés. Volume cumulé : ${totalVol.toLocaleString()}. Top 3 : ${top3}.`;
}

export function summarizeKeywordDifficulty(
  results: Record<string, string>[]
): string {
  if (results.length === 0) return "Aucune donnée de difficulté.";
  const easy = results.filter((r) => parseInt(r.keyword_difficulty ?? "100") < 40);
  const hard = results.filter((r) => parseInt(r.keyword_difficulty ?? "0") >= 70);
  return `${results.length} mots-clés analysés. ${easy.length} faciles (KD < 40), ${hard.length} difficiles (KD ≥ 70).`;
}

// ===== Backlinks Summaries =====

export function summarizeBacklinksOverview(
  target: string,
  results: Record<string, string>[]
): string {
  if (results.length === 0) return `Aucune donnée backlinks pour ${target}.`;
  const r = results[0];
  const total = parseInt(r.total ?? "0");
  const domains = parseInt(r.domains_num ?? "0");
  const follow = parseInt(r.follows_num ?? "0");
  const nofollow = parseInt(r.nofollows_num ?? "0");
  const followPct = total > 0 ? Math.round((follow / total) * 100) : 0;
  return `**${target}** : ${total.toLocaleString()} backlinks depuis ${domains.toLocaleString()} domaines référents. ${followPct}% follow, ${100 - followPct}% nofollow.`;
}

export function summarizeRefdomains(
  target: string,
  results: Record<string, string>[]
): string {
  if (results.length === 0) return `Aucun domaine référent trouvé pour ${target}.`;
  const avgScore = Math.round(
    results.reduce((s, r) => s + parseInt(r.domain_score ?? "0"), 0) / results.length
  );
  const top3 = results.slice(0, 3).map((r) => `${r.domain} (score: ${r.domain_score})`).join(", ");
  return `${results.length} domaines référents pour **${target}**. Score moyen : ${avgScore}/100. Top 3 : ${top3}.`;
}

// ===== Gap Summaries =====

export function summarizeKeywordGap(
  target: string,
  competitors: string[],
  gapCount: number,
  topOpportunities: { keyword: string; search_volume: number }[]
): string {
  if (gapCount === 0) return `Aucun gap de mots-clés trouvé entre ${target} et ${competitors.join(", ")}.`;
  const top3 = topOpportunities.slice(0, 3).map((o) => `"${o.keyword}" (${o.search_volume} vol)`).join(", ");
  return `${gapCount} mots-clés trouvés chez ${competitors.join(", ")} mais absents de **${target}**. Meilleures opportunités : ${top3}.`;
}

export function summarizeBacklinkGap(
  target: string,
  competitors: string[],
  missingCount: number,
  highPriority: number
): string {
  if (missingCount === 0) return `Aucun gap de backlinks trouvé.`;
  return `${missingCount} domaines référents trouvés chez ${competitors.join(", ")} mais absents de **${target}**. ${highPriority} sont haute priorité (score ≥ 60).`;
}

// ===== Generic =====

export function summarizeResults(
  action: string,
  domain: string,
  db: string,
  results: Record<string, string>[]
): string {
  switch (action) {
    case "organic":
    case "domain_organic":
      return summarizeDomainOrganic(domain, db, results);
    case "overview":
    case "domain_ranks":
      return summarizeDomainOverview(domain, results);
    case "competitors":
    case "domain_organic_organic":
      return summarizeDomainCompetitors(domain, db, results);
    case "overview_kw":
    case "phrase_all":
      return summarizeKeywordOverview(domain, db, results);
    case "related":
    case "phrase_related":
      return summarizeKeywordRelated(domain, db, results);
    case "difficulty":
    case "phrase_kdi":
      return summarizeKeywordDifficulty(results);
    default:
      if (results.length === 0) return "Aucun résultat trouvé.";
      return `${results.length} résultats trouvés pour ${domain} (${db}).`;
  }
}
