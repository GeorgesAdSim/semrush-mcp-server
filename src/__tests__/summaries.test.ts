import { describe, it, expect } from "vitest";
import {
  summarizeDomainOrganic,
  summarizeDomainOverview,
  summarizeDomainCompetitors,
  summarizeKeywordOverview,
  summarizeKeywordRelated,
  summarizeKeywordDifficulty,
  summarizeBacklinksOverview,
  summarizeRefdomains,
  summarizeKeywordGap,
  summarizeBacklinkGap,
  summarizeResults,
} from "../utils/summaries.js";

// ===== Domain Summaries =====

describe("summarizeDomainOrganic", () => {
  it("should return empty message for no results", () => {
    expect(summarizeDomainOrganic("example.com", "fr", [])).toContain(
      "Aucun mot-clé organique"
    );
  });

  it("should include domain, count, avg position, and top 3", () => {
    const results = [
      { keyword: "seo", position: "5" },
      { keyword: "référencement", position: "10" },
      { keyword: "netlinking", position: "15" },
    ];
    const summary = summarizeDomainOrganic("example.com", "fr", results);
    expect(summary).toContain("**example.com**");
    expect(summary).toContain("3 mots-clés organiques");
    expect(summary).toContain("FR");
    expect(summary).toContain("Position moyenne : 10");
    expect(summary).toContain('"seo" (#5)');
  });
});

describe("summarizeDomainOverview", () => {
  it("should return empty message for no results", () => {
    expect(summarizeDomainOverview("example.com", [])).toContain("Aucune donnée");
  });

  it("should sum keywords and traffic across databases", () => {
    const results = [
      { organic_keywords: "1000", organic_traffic: "5000" },
      { organic_keywords: "2000", organic_traffic: "3000" },
    ];
    const summary = summarizeDomainOverview("example.com", results);
    expect(summary).toContain("2 bases de données");
    expect(summary).toContain("3,000"); // toLocaleString
  });
});

describe("summarizeDomainCompetitors", () => {
  it("should return empty message for no results", () => {
    expect(summarizeDomainCompetitors("example.com", "fr", [])).toContain(
      "Aucun concurrent"
    );
  });

  it("should list top competitors with common keywords", () => {
    const results = [
      { domain: "competitor1.com", common_keywords: "500" },
      { domain: "competitor2.com", common_keywords: "300" },
    ];
    const summary = summarizeDomainCompetitors("example.com", "fr", results);
    expect(summary).toContain("2 concurrents organiques");
    expect(summary).toContain("competitor1.com (500 mots-clés communs)");
  });
});

// ===== Keyword Summaries =====

describe("summarizeKeywordOverview", () => {
  it("should return empty message for no results", () => {
    expect(summarizeKeywordOverview("seo", "fr", [])).toContain("Aucune donnée");
  });

  it("should show volume, CPC, competition", () => {
    const results = [{ search_volume: "5000", cpc: "1.5", competition: "0.8" }];
    const summary = summarizeKeywordOverview("seo", "fr", results);
    expect(summary).toContain('"seo"');
    expect(summary).toContain("5000 recherches/mois");
    expect(summary).toContain("CPC 1.5€");
    expect(summary).toContain("compétition 0.8");
  });
});

describe("summarizeKeywordRelated", () => {
  it("should return empty message for no results", () => {
    expect(summarizeKeywordRelated("seo", "fr", [])).toContain(
      "Aucun mot-clé apparenté"
    );
  });

  it("should show count, total volume, top 3", () => {
    const results = [
      { keyword: "seo agency", search_volume: "1000" },
      { keyword: "seo tools", search_volume: "2000" },
    ];
    const summary = summarizeKeywordRelated("seo", "fr", results);
    expect(summary).toContain("2 mots-clés apparentés");
    expect(summary).toContain("3,000"); // toLocaleString of 3000
  });
});

describe("summarizeKeywordDifficulty", () => {
  it("should return empty message for no results", () => {
    expect(summarizeKeywordDifficulty([])).toContain("Aucune donnée");
  });

  it("should count easy and hard keywords", () => {
    const results = [
      { keyword_difficulty: "20" }, // easy
      { keyword_difficulty: "35" }, // easy
      { keyword_difficulty: "55" }, // medium
      { keyword_difficulty: "80" }, // hard
    ];
    const summary = summarizeKeywordDifficulty(results);
    expect(summary).toContain("4 mots-clés analysés");
    expect(summary).toContain("2 faciles");
    expect(summary).toContain("1 difficiles");
  });
});

// ===== Backlinks Summaries =====

describe("summarizeBacklinksOverview", () => {
  it("should return empty message for no results", () => {
    expect(summarizeBacklinksOverview("example.com", [])).toContain(
      "Aucune donnée"
    );
  });

  it("should show total, domains, follow percentage", () => {
    const results = [
      {
        total: "10000",
        domains_num: "500",
        follows_num: "7000",
        nofollows_num: "3000",
      },
    ];
    const summary = summarizeBacklinksOverview("example.com", results);
    expect(summary).toContain("10,000 backlinks");
    expect(summary).toContain("500 domaines");
    expect(summary).toContain("70% follow");
    expect(summary).toContain("30% nofollow");
  });
});

describe("summarizeRefdomains", () => {
  it("should return empty message for no results", () => {
    expect(summarizeRefdomains("example.com", [])).toContain(
      "Aucun domaine référent"
    );
  });

  it("should show count, avg score, top 3", () => {
    const results = [
      { domain: "blog.fr", domain_score: "60" },
      { domain: "news.fr", domain_score: "80" },
    ];
    const summary = summarizeRefdomains("example.com", results);
    expect(summary).toContain("2 domaines référents");
    expect(summary).toContain("Score moyen : 70");
    expect(summary).toContain("blog.fr (score: 60)");
  });
});

// ===== Gap Summaries =====

describe("summarizeKeywordGap", () => {
  it("should return empty message for 0 gaps", () => {
    expect(summarizeKeywordGap("a.com", ["b.com"], 0, [])).toContain(
      "Aucun gap"
    );
  });

  it("should show gap count and top opportunities", () => {
    const top = [
      { keyword: "seo", search_volume: 5000 },
      { keyword: "backlinks", search_volume: 3000 },
    ];
    const summary = summarizeKeywordGap("a.com", ["b.com"], 10, top);
    expect(summary).toContain("10 mots-clés");
    expect(summary).toContain('"seo" (5000 vol)');
  });
});

describe("summarizeBacklinkGap", () => {
  it("should return empty message for 0 gaps", () => {
    expect(summarizeBacklinkGap("a.com", ["b.com"], 0, 0)).toContain(
      "Aucun gap"
    );
  });

  it("should show count and high priority", () => {
    const summary = summarizeBacklinkGap("a.com", ["b.com"], 50, 15);
    expect(summary).toContain("50 domaines");
    expect(summary).toContain("15 sont haute priorité");
  });
});

// ===== summarizeResults (generic dispatcher) =====

describe("summarizeResults", () => {
  it("should dispatch to domain organic summary", () => {
    const results = [{ keyword: "seo", position: "5" }];
    const summary = summarizeResults("organic", "example.com", "fr", results);
    expect(summary).toContain("mots-clés organiques");
  });

  it("should dispatch to keyword overview summary", () => {
    const results = [{ search_volume: "5000", cpc: "1.5", competition: "0.8" }];
    const summary = summarizeResults("phrase_all", "seo", "fr", results);
    expect(summary).toContain("recherches/mois");
  });

  it("should return generic fallback for unknown action", () => {
    const results = [{ data: "something" }];
    const summary = summarizeResults("unknown", "domain.com", "us", results);
    expect(summary).toContain("1 résultats");
  });

  it("should handle empty results for unknown action", () => {
    const summary = summarizeResults("unknown", "domain.com", "us", []);
    expect(summary).toContain("Aucun résultat");
  });
});
