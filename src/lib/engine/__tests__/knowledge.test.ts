import { describe, expect, it } from "vitest";
import {
  accessoryBonus,
  adjustSuggestions,
  computeConfidence,
  computeTrend,
  marketIndex,
  matchesTitle,
  productStats,
  type ObservationInput,
} from "../knowledge";

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
