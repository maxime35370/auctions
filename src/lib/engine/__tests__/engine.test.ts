import { describe, expect, it } from "vitest";
import { analyzeAuction, emptyAuctionInput, type AuctionInput } from "..";
import { computeCosts, computeMaxBudget } from "../costs";
import { verdictFromScore } from "../scoring";

/** Cas de référence : lot photo en bon état, bien documenté. */
const baseInput: AuctionInput = {
  currentPrice: 300,
  buyerFeePct: 20, // frais acheteur 20 %
  vatPct: 0,
  travelCost: 30,
  shippingCost: 0,
  condition: "bon",
  category: "photo",
  refurbHours: 1,
  resaleFast: 550,
  resaleNormal: 650,
  resaleOptimized: 750,
};

describe("computeCosts — coût total réel", () => {
  it("additionne marteau + frais + TVA + déplacement + livraison", () => {
    const costs = computeCosts(baseInput);
    // 300 + 60 (20 %) + 0 + 30 + 0
    expect(costs.buyerFee).toBe(60);
    expect(costs.vat).toBe(0);
    expect(costs.totalCost).toBe(390);
  });

  it("applique la TVA sur (marteau + frais)", () => {
    const costs = computeCosts({ ...baseInput, vatPct: 20 });
    // TVA = (300 + 60) × 20 % = 72
    expect(costs.vat).toBe(72);
    expect(costs.totalCost).toBe(462);
  });
});

describe("computeMaxBudget — budget maximal conseillé", () => {
  it("préserve exactement le ROI cible de 30 % au budget max", () => {
    const maxBid = computeMaxBudget(baseInput);
    // Vérification par ré-injection : au prix max, ROI ≈ 30 %
    const atMax = analyzeAuction({ ...baseInput, currentPrice: maxBid });
    expect(atMax.roi).toBeGreaterThan(29.5);
    expect(atMax.roi).toBeLessThan(30.5);
  });

  it("ne renvoie jamais un budget négatif", () => {
    const maxBid = computeMaxBudget({
      ...baseInput,
      resaleNormal: 10,
      travelCost: 500,
    });
    expect(maxBid).toBe(0);
  });
});

describe("analyzeAuction — analyse complète", () => {
  it("calcule marge, bénéfice net et ROI sur le scénario normal", () => {
    const a = analyzeAuction(baseInput);
    expect(a.totalCost).toBe(390);
    expect(a.netProfit).toBe(260); // 650 − 390
    expect(a.potentialMargin).toBe(260);
    expect(a.roi).toBeCloseTo(66.67, 1);
  });

  it("produit les trois scénarios de revente", () => {
    const a = analyzeAuction(baseInput);
    expect(a.scenarios.map((s) => s.kind)).toEqual([
      "rapide",
      "normal",
      "optimise",
    ]);
    const rapide = a.scenarios[0];
    expect(rapide.netProfit).toBe(160); // 550 − 390
    expect(rapide.roi).toBeCloseTo(41.03, 1);
  });

  it("donne un score élevé à une affaire très rentable et sûre", () => {
    const a = analyzeAuction(baseInput);
    expect(a.score).toBeGreaterThanOrEqual(70);
    expect(a.stars).toBeGreaterThanOrEqual(4);
  });

  it("donne un score faible à une affaire perdante", () => {
    const a = analyzeAuction({
      ...baseInput,
      resaleFast: 200,
      resaleNormal: 250,
      resaleOptimized: 300,
      condition: "epave",
      refurbHours: 25,
    });
    expect(a.score).toBeLessThan(50);
    expect(a.verdict).toBe("a-eviter");
  });

  it("reste stable avec un formulaire vide (pas de NaN)", () => {
    const a = analyzeAuction(emptyAuctionInput());
    expect(Number.isFinite(a.totalCost)).toBe(true);
    expect(Number.isFinite(a.roi)).toBe(true);
    expect(Number.isFinite(a.score)).toBe(true);
  });
});

describe("verdictFromScore", () => {
  it("classe les scores dans les bons verdicts", () => {
    expect(verdictFromScore(85).verdict).toBe("pepite");
    expect(verdictFromScore(70).verdict).toBe("bonne-affaire");
    expect(verdictFromScore(55).verdict).toBe("correct");
    expect(verdictFromScore(30).verdict).toBe("a-eviter");
  });
});
