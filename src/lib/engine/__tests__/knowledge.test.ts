import { describe, expect, it } from "vitest";
import {
  accessoryBonus,
  adjustSuggestions,
  averageSaleDelay,
  computeConfidence,
  computeTrend,
  dataMaturity,
  explainRecommendation,
  marketIndex,
  matchesTitle,
  explainOpportunity,
  measuredPopularity,
  measuredProbabilities,
  myVsMarket,
  opportunityVerdict,
  opportunityZones,
  recommendationConfidence,
  platformStats,
  priceStability,
  productStats,
  provenanceFor,
  type ObservationInput,
} from "../knowledge";
import { analyzeAuction, emptyAuctionInput } from "..";

const NOW = new Date("2026-08-01");

const obs = (date: string, price: number, kind: ObservationInput["kind"] = "vente") => ({
  date,
  price,
  kind,
});

describe("productStats", () => {
  it("reste honnête sans données : confiance 0, produit inconnu", () => {
    const s = productStats([], NOW);
    expect(s.count).toBe(0);
    expect(s.confidence).toBe(0);
    expect(s.confidenceReasons[0]).toContain("inconnu");
    expect(s.suggestedNormal).toBeUndefined();
  });

  it("calcule moyenne, min, max, médiane et dernières observations", () => {
    const s = productStats(
      [
        obs("2026-05-01", 1200),
        obs("2026-06-01", 1300),
        obs("2026-07-01", 1250),
        obs("2026-07-15", 880, "enchere"),
      ],
      NOW
    );
    expect(s.count).toBe(4);
    expect(s.min).toBe(880);
    expect(s.max).toBe(1300);
    expect(s.lastSale?.price).toBe(1250);
    expect(s.lastAuction?.price).toBe(880);
    expect(s.typicalAuctionPrice).toBe(880);
  });

  it("suggère rapide/normal/premium depuis les percentiles des ventes", () => {
    const s = productStats(
      [
        obs("2026-05-01", 1000),
        obs("2026-05-20", 1100),
        obs("2026-06-10", 1200),
        obs("2026-07-01", 1300),
        obs("2026-07-20", 1400),
      ],
      NOW
    );
    expect(s.suggestedFast).toBe(1100); // p25
    expect(s.suggestedNormal).toBe(1200); // médiane
    expect(s.suggestedPremium).toBe(1300); // p75
  });
});

describe("computeTrend — indice de marché", () => {
  it("détecte une hausse entre les deux fenêtres de 6 mois", () => {
    const t = computeTrend(
      [
        obs("2025-09-01", 100), // fenêtre précédente
        obs("2025-10-01", 100),
        obs("2026-05-01", 108), // fenêtre récente
        obs("2026-06-01", 108),
      ],
      NOW
    );
    expect(t).toBe(8);
  });

  it("renvoie undefined si une fenêtre manque de données", () => {
    expect(computeTrend([obs("2026-06-01", 100)], NOW)).toBeUndefined();
  });

  it("marketIndex trie les catégories par tendance", () => {
    const idx = marketIndex(
      new Map([
        ["nas", [obs("2025-09-01", 100), obs("2025-10-01", 100), obs("2026-06-01", 100), obs("2026-07-01", 100)]],
        ["imprimantes-3d", [obs("2025-09-01", 200), obs("2025-10-01", 200), obs("2026-06-01", 172), obs("2026-07-01", 172)]],
      ]),
      NOW
    );
    expect(idx[0].key).toBe("nas");
    expect(idx[0].trendPct).toBe(0); // stable
    expect(idx[1].trendPct).toBe(-14);
  });
});

describe("computeConfidence — indice de confiance justifié", () => {
  it("monte avec le volume, la fraîcheur et la stabilité", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      obs(`2026-0${(i % 6) + 1}-15`, 1000 + (i % 5) * 20)
    );
    const { confidence, reasons } = computeConfidence(many, NOW);
    expect(confidence).toBeGreaterThanOrEqual(90);
    expect(reasons.join(" ")).toContain("20 observations");
  });

  it("pénalise les données anciennes et dispersées", () => {
    const { confidence, reasons } = computeConfidence(
      [obs("2023-01-01", 100), obs("2023-02-01", 900), obs("2023-03-01", 400)],
      NOW
    );
    expect(confidence).toBeLessThan(50);
    expect(reasons.join(" ")).toContain("anciennes");
  });
});

describe("opportunityZones — 🎯 prix d'opportunité", () => {
  const auctions = [800, 850, 900, 950, 1000, 1050, 1100, 1150, 1200].map(
    (price, i) => obs(`2026-0${(i % 6) + 1}-10`, price, "enchere")
  );

  it("calcule les zones sur les adjudications quand il y en a assez", () => {
    const zones = opportunityZones(auctions)!;
    expect(zones.basis).toBe("adjudications");
    expect(zones.opportunityPrice).toBeLessThan(zones.fairPrice);
    expect(zones.opportunityPrice).toBeCloseTo(860, 0); // p15 de 800→1200
  });

  it("positionne un prix d'achat dans les zones", () => {
    const zones = opportunityZones(auctions)!;
    expect(opportunityVerdict(820, zones).level).toBe("excellent");
    expect(opportunityVerdict(940, zones).level).toBe("interessant"); // p15=860 < 940 ≤ p40=960
    expect(opportunityVerdict(1300, zones).level).toBe("faible");
  });

  it("renvoie undefined avec moins de 3 observations", () => {
    expect(opportunityZones([obs("2026-01-01", 100)])).toBeUndefined();
  });
});

describe("priceStability — écart-type et stabilité", () => {
  it("qualifie un marché stable", () => {
    const s = priceStability([
      obs("2026-01-01", 100),
      obs("2026-02-01", 102),
      obs("2026-03-01", 98),
    ])!;
    expect(s.label).toBe("stable");
    expect(s.cvPct).toBeLessThan(15);
  });

  it("qualifie un marché très variable", () => {
    const s = priceStability([
      obs("2026-01-01", 100),
      obs("2026-02-01", 300),
      obs("2026-03-01", 60),
    ])!;
    expect(s.label).toBe("tres-variable");
  });
});

describe("myVsMarket — mes performances contre le marché", () => {
  it("« je revends 12 % plus cher que la moyenne »", () => {
    const r = myVsMarket([
      { ...obs("2026-05-01", 1120), source: "moi" },
      { ...obs("2026-03-01", 1000), source: "leboncoin" },
      { ...obs("2026-04-01", 1000), source: "ebay" },
    ])!;
    expect(r.diffPct).toBe(12);
    expect(r.mySaleCount).toBe(1);
  });

  it("undefined sans ventes personnelles ou marché insuffisant", () => {
    expect(myVsMarket([{ ...obs("2026-05-01", 1120), source: "moi" }])).toBeUndefined();
  });
});

describe("averageSaleDelay — ⚡ temps moyen de revente", () => {
  it("mesure le délai adjudication → vente de mes transactions", () => {
    const r = averageSaleDelay([
      { ...obs("2026-05-01", 900, "enchere"), auctionId: "a1", source: "moi" },
      { ...obs("2026-05-05", 1300, "vente"), auctionId: "a1", source: "moi" },
      { ...obs("2026-06-01", 900, "enchere"), auctionId: "a2", source: "moi" },
      { ...obs("2026-06-09", 1250, "vente"), auctionId: "a2", source: "moi" },
    ])!;
    expect(r.avgDays).toBe(6); // (4 + 8) / 2
    expect(r.count).toBe(2);
  });

  it("undefined sans paire complète", () => {
    expect(
      averageSaleDelay([{ ...obs("2026-05-01", 900, "enchere"), auctionId: "a1" }])
    ).toBeUndefined();
  });
});

describe("graduation — heuristique → estimé → mesuré", () => {
  it("provenanceFor applique les seuils 10 et 30", () => {
    expect(provenanceFor(5)).toBe("heuristique");
    expect(provenanceFor(10)).toBe("estime");
    expect(provenanceFor(30)).toBe("mesure");
  });

  it("dataMaturity combine observations, ventes et transactions", () => {
    const many = [
      ...Array.from({ length: 40 }, (_, i) => obs(`2026-0${(i % 6) + 1}-10`, 100)),
      { ...obs("2026-07-01", 90, "enchere"), auctionId: "a1" },
      { ...obs("2026-07-05", 130, "vente"), auctionId: "a1" },
    ];
    const m = dataMaturity(many);
    expect(m.observations).toBe(42);
    expect(m.myTransactions).toBe(1);
    expect(m.score).toBeGreaterThanOrEqual(70);
    expect(m.level).toBe("fiable");
    expect(dataMaturity([obs("2026-01-01", 100)]).level).toBe("insuffisant");
  });

  it("measuredPopularity remplace la table quand l'échantillon suffit", () => {
    const few = [obs("2026-06-01", 100)];
    expect(measuredPopularity(few, NOW).provenance).toBe("heuristique");
    const many = Array.from({ length: 50 }, (_, i) =>
      obs(`2026-0${(i % 6) + 1}-15`, 100)
    );
    const p = measuredPopularity(many, NOW);
    expect(p.provenance).toBe("mesure");
    expect(p.score).toBe(95); // 50 obs sur 12 mois → plafond
  });

  it("measuredProbabilities : « 38 des 42 vendus en < 10 jours »", () => {
    const sales = Array.from({ length: 42 }, (_, i) => {
      const days = i < 38 ? 5 : 20; // 38 rapides, 4 plus lents
      return [
        { ...obs("2026-05-01", 900, "enchere" as const), auctionId: `a${i}` },
        { ...obs(`2026-05-${String(1 + days).padStart(2, "0")}`, 1300, "vente" as const), auctionId: `a${i}` },
      ];
    }).flat();
    const p = measuredProbabilities(sales)!;
    expect(p.sampleSize).toBe(42);
    expect(p.provenance).toBe("mesure");
    expect(p.rapidePct).toBeCloseTo(90.5, 0);
  });

  it("les probabilités mesurées remplacent les heuristiques dans l'analyse", () => {
    const a = analyzeAuction(
      { ...emptyAuctionInput(), currentPrice: 100, resaleFast: 200, resaleNormal: 220, resaleOptimized: 240 },
      {
        popularity: { score: 92, provenance: "mesure" },
        probabilities: { provenance: "mesure", rapidePct: 90.5, normalPct: 97, optimisePct: 100 },
      }
    );
    const rapide = a.scenarios.find((s) => s.kind === "rapide")!;
    expect(rapide.probability).toBe(90.5);
    expect(rapide.probabilityProvenance).toBe("mesure");
    const pop = a.criteria.find((c) => c.key === "popularite")!;
    expect(pop.value).toBe(92);
    expect(pop.provenance).toBe("mesure");
  });

  it("sans contexte, la popularité reste heuristique (et le dit)", () => {
    const a = analyzeAuction({ ...emptyAuctionInput(), category: "photo" });
    const pop = a.criteria.find((c) => c.key === "popularite")!;
    expect(pop.provenance).toBe("heuristique");
    expect(pop.value).toBe(85);
  });

  it("platformStats compare les plateformes sur données réelles", () => {
    const p = platformStats([
      { ...obs("2026-05-01", 1300), source: "ebay" },
      { ...obs("2026-05-02", 1480), source: "ebay" },
      { ...obs("2026-05-03", 1250), source: "leboncoin" },
      { ...obs("2026-05-04", 1390), source: "leboncoin" },
      { ...obs("2026-05-05", 1000), source: "moi" }, // exclu
    ]);
    expect(p).toHaveLength(2);
    expect(p[0].source).toBe("ebay"); // prix moyen le plus haut d'abord
    expect(p[0].avg).toBe(1390);
  });

  it("explainRecommendation ne cite que des faits mesurés", () => {
    const observations = Array.from({ length: 20 }, (_, i) =>
      obs(`2026-0${(i % 6) + 1}-10`, 1300 + (i % 3) * 20)
    );
    const stats = productStats(observations, NOW);
    const r = explainRecommendation({
      currentPrice: 1100, // ~15 % sous la médiane
      stats,
      zones: opportunityZones(observations),
      stability: priceStability(observations),
    });
    expect(r.positives.join(" ")).toContain("sous la médiane");
    expect(r.positives.join(" ")).toContain("20 fois");
    expect(r.positives.join(" ")).toContain("stables");
  });
});

describe("recommendationConfidence — distincte du score de l'affaire", () => {
  it("excellent objet, données faibles → confiance basse", () => {
    const r = recommendationConfidence(100); // saisie complète, aucun produit
    expect(r.value).toBeLessThanOrEqual(40);
    expect(r.basis).toContain("estimations");
  });

  it("données produit solides → confiance haute", () => {
    const r = recommendationConfidence(100, 95);
    expect(r.value).toBeGreaterThanOrEqual(90);
    expect(r.basis).toContain("observations réelles");
  });

  it("données produit moyennes + saisie incomplète → confiance dégradée", () => {
    const r = recommendationConfidence(30, 50);
    expect(r.value).toBe(46); // 50×0,8 + 30×0,2
  });
});

describe("explainOpportunity — « Pourquoi ce seuil ? »", () => {
  it("explique avec des faits mesurés", () => {
    const observations = Array.from({ length: 20 }, (_, i) =>
      obs(`2026-0${(i % 6) + 1}-10`, 1200 + i * 20)
    );
    const zones = opportunityZones(observations)!;
    const reasons = explainOpportunity({
      zones,
      observations,
      trendPct: 8,
      performance: {
        myAvgSale: 1404,
        marketMedianSale: 1300,
        diffPct: 8,
        mySaleCount: 3,
        marketSaleCount: 17,
      },
      saleDelay: { avgDays: 6, count: 4 },
    });
    const all = reasons.join(" | ");
    expect(all).toMatch(/\d+ % des prix observés sont au-dessus/);
    expect(all).toContain("Les prix montent (+8 %");
    expect(all).toContain("8 % au-dessus de la médiane");
    expect(all).toContain("6 jours");
  });
});

describe("accessoryBonus — équipements avec plus-value", () => {
  const ACCESSORIES = [
    { label: "Alimentation officielle", delta: 10 },
    { label: "Boîtier", delta: 10 },
    { label: "Carte SD", delta: 10 },
    { label: "Refroidissement actif", delta: 8 },
  ];

  it("additionne la plus-value des équipements cochés uniquement", () => {
    expect(accessoryBonus(ACCESSORIES, [])).toBe(0);
    expect(accessoryBonus(ACCESSORIES, ["Boîtier", "Carte SD"])).toBe(20);
    expect(accessoryBonus(ACCESSORIES, ["Inexistant"])).toBe(0);
  });

  it("ajuste les prix suggérés du produit", () => {
    const stats = productStats(
      [obs("2026-05-01", 100), obs("2026-06-01", 100), obs("2026-07-01", 100)],
      NOW
    );
    const adjusted = adjustSuggestions(stats, 38);
    expect(adjusted.suggestedNormal).toBe(138);
    expect(adjusted.suggestedFast).toBe(138);
  });

  it("laisse undefined quand il n'y a pas de suggestion", () => {
    const adjusted = adjustSuggestions(productStats([], NOW), 20);
    expect(adjusted.suggestedNormal).toBeUndefined();
  });
});

describe("matchesTitle — liaison produit ↔ annonce", () => {
  it("reconnaît un produit dans un titre d'annonce", () => {
    expect(
      matchesTitle("Objectif Canon EF 100-400mm L IS II USM très bon état", "Canon 100-400 II")
    ).toBe(true);
    expect(matchesTitle("Nikon 70-200 f/2.8", "Canon 100-400 II")).toBe(false);
  });

  it("fonctionne via les alias", () => {
    expect(
      matchesTitle("Synology DS920+ 4 baies", "NAS Synology DS920 Plus", ["DS920"])
    ).toBe(true);
  });
});
