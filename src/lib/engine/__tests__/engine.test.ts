import { describe, expect, it } from "vitest";
import { analyzeAuction, emptyAuctionInput, type AuctionInput } from "..";
import { computeCosts, computeMaxBudget, totalTime } from "../costs";
import { verdictFromScore } from "../scoring";
import { recommendStrategy } from "../strategy";
import { checklistFor, explainScore, recommendPlatforms } from "../advice";

/** Cas de référence : lot photo en bon état, bien documenté. */
const baseInput: AuctionInput = {
  ...emptyAuctionInput(),
  currentPrice: 300,
  buyerFeePct: 20, // frais acheteur 20 %
  travelCost: 30,
  condition: "bon",
  category: "photo",
  refurbHours: 1,
  minProfitTarget: 100,
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

  it("la facture complète : marteau + acheteur + plateforme + livraison = 399 €", () => {
    const costs = computeCosts({
      ...baseInput,
      currentPrice: 300,
      buyerFeePct: 24,
      platformFeePct: 1.8,
      travelCost: 0,
      shippingCost: 21.6,
    });
    expect(costs.buyerFee).toBe(72); // 💼 300 × 24 %
    expect(costs.platformFee).toBe(5.4); // 🌐 300 × 1,8 %
    expect(costs.shippingCost).toBe(21.6); // 📦
    expect(costs.totalCost).toBe(399); // 💰
  });

  it("le budget max reste exact avec les frais plateforme", () => {
    const input = { ...baseInput, platformFeePct: 1.8 };
    const maxBid = computeMaxBudget(input);
    const atMax = analyzeAuction({ ...input, currentPrice: maxBid });
    expect(atMax.roi).toBeGreaterThan(29.5);
    expect(atMax.roi).toBeLessThan(30.5);
  });
});

describe("computeMaxBudget — budget maximal conseillé", () => {
  it("préserve exactement le ROI cible de 30 % au budget max", () => {
    const maxBid = computeMaxBudget(baseInput);
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
    expect(a.roi).toBeCloseTo(66.67, 1);
  });

  it("distingue gain brut et gain réel (commissions + consommables)", () => {
    const a = analyzeAuction({
      ...baseInput,
      sellingFeePct: 10, // commission plateforme
      sellingMiscCost: 15, // essence, cartons…
    });
    const normal = a.scenarios.find((s) => s.kind === "normal")!;
    expect(normal.grossProfit).toBe(260); // 650 − 390
    expect(normal.netProfit).toBe(180); // 650×0,9 − 390 − 15
  });

  it("produit les trois scénarios avec délai et probabilité", () => {
    const a = analyzeAuction(baseInput);
    expect(a.scenarios.map((s) => s.kind)).toEqual(["rapide", "normal", "optimise"]);
    const rapide = a.scenarios[0];
    expect(rapide.netProfit).toBe(160); // 550 − 390
    expect(rapide.probability).toBeGreaterThan(0);
    expect(rapide.timeEstimate).toContain("semaine");
  });

  it("somme la décomposition du temps", () => {
    const t = totalTime({
      refurbHours: 1,
      cleaningHours: 0.5,
      photoHours: 0.5,
      listingHours: 0.25,
      packingHours: 0.5,
      savHours: 1,
    });
    expect(t).toBe(3.75);
    const a = analyzeAuction({ ...baseInput, cleaningHours: 2 });
    expect(a.totalTimeHours).toBe(3);
  });

  it("signale un gain sous l'objectif minimum", () => {
    const ok = analyzeAuction(baseInput);
    expect(ok.meetsMinProfit).toBe(true);
    const weak = analyzeAuction({ ...baseInput, minProfitTarget: 500 });
    expect(weak.meetsMinProfit).toBe(false);
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

describe("origine du lot — pénalités mécaniques", () => {
  it("« Retour client » : risque pénalisé, budget max réduit de 15 %", () => {
    const clean = analyzeAuction(baseInput);
    const risky = analyzeAuction({ ...baseInput, lotOrigin: "retour-client" });

    const riskClean = clean.criteria.find((c) => c.key === "risque")!.value;
    const riskRisky = risky.criteria.find((c) => c.key === "risque")!.value;
    expect(riskRisky).toBe(riskClean - 18); // +18 de risque

    expect(risky.maxBudget).toBeCloseTo(clean.maxBudget * 0.85, 1); // −15 %
    expect(risky.explanation.negatives.join(" ")).toContain("Retour client");
    expect(risky.score).toBeLessThan(clean.score);
  });

  it("« Retour SAV » : le plus pénalisé (budget −25 %)", () => {
    const clean = analyzeAuction(baseInput);
    const sav = analyzeAuction({ ...baseInput, lotOrigin: "retour-sav" });
    expect(sav.maxBudget).toBeCloseTo(clean.maxBudget * 0.75, 1);
  });

  it("la confiance de recommandation baisse avec l'origine (−12 retour client)", async () => {
    const { recommendationConfidence } = await import("../knowledge");
    const base = recommendationConfidence(100, 90);
    const penalized = recommendationConfidence(100, 90, 12);
    expect(penalized.value).toBe(base.value - 12);
    expect(penalized.basis).toContain("origine du lot risquée");
  });
});

describe("⏱ bénéfice par heure investie", () => {
  it("100 € en 2 h vaut mieux que 30 € en 15 h — et l'analyse le montre", () => {
    const quick = analyzeAuction({
      ...baseInput,
      refurbHours: 1,
      cleaningHours: 0.5,
      photoHours: 0.25,
      listingHours: 0.25,
    });
    // bénéfice normal 260 € / 2 h = 130 €/h
    expect(quick.totalTimeHours).toBe(2);
    expect(quick.hourlyProfit).toBe(130);

    const slow = analyzeAuction({ ...baseInput, refurbHours: 15 });
    expect(slow.hourlyProfit).toBeLessThan(quick.hourlyProfit!);
  });

  it("pas de division par zéro sans temps saisi", () => {
    const a = analyzeAuction({ ...baseInput, refurbHours: 0 });
    expect(a.hourlyProfit).toBeUndefined();
  });
});

describe("recommendStrategy — stratégie conseillée", () => {
  it("déconseille l'achat quand aucun scénario n'est rentable", () => {
    const a = analyzeAuction({
      ...baseInput,
      resaleFast: 100,
      resaleNormal: 150,
      resaleOptimized: 200,
    });
    expect(a.strategy.kind).toBeNull();
    expect(a.strategy.title).toContain("Ne pas acheter");
  });

  it("recommande la vente rapide quand elle conserve ≥ 80 % du meilleur gain", () => {
    // rapide 160, optimisé 360 → 44 % : pas rapide. Rapprochons les prix.
    const a = analyzeAuction({
      ...baseInput,
      resaleFast: 640,
      resaleNormal: 650,
      resaleOptimized: 660,
    });
    expect(a.strategy.kind).toBe("rapide");
    expect(a.strategy.gain).toBe(250);
  });

  it("recommande la vente optimisée quand le supplément le justifie", () => {
    const a = analyzeAuction({
      ...baseInput,
      resaleFast: 500,
      resaleNormal: 600,
      resaleOptimized: 800, // +190 € vs rapide (110), ratio > 1,25
    });
    expect(a.strategy.kind).toBe("optimise");
  });

  it("expose gain, délai et probabilité", () => {
    const s = recommendStrategy(baseInput, analyzeAuction(baseInput).scenarios);
    expect(s.gain).toBeGreaterThan(0);
    expect(s.probability).toBeGreaterThan(0);
    expect(s.timeEstimate.length).toBeGreaterThan(0);
  });
});

describe("advice — explications, plateformes, checklist", () => {
  it("explique le score en points forts / faibles", () => {
    const a = analyzeAuction(baseInput);
    const e = explainScore(a.criteria);
    expect(e.positives.length).toBeGreaterThan(0);
    // Affaire perdante → négatifs présents
    const bad = analyzeAuction({
      ...baseInput,
      resaleFast: 100,
      resaleNormal: 150,
      resaleOptimized: 180,
    });
    expect(explainScore(bad.criteria).negatives.length).toBeGreaterThan(0);
  });

  it("recommande des plateformes triées par pertinence", () => {
    const p = recommendPlatforms("photo");
    expect(p.length).toBeGreaterThan(2);
    expect(p[0].stars).toBeGreaterThanOrEqual(p[p.length - 1].stars);
    // catégorie inconnue → liste par défaut
    expect(recommendPlatforms("xyz").length).toBeGreaterThan(0);
  });

  it("fournit une checklist par catégorie", () => {
    expect(checklistFor("informatique")).toContain("Alimentation / chargeur présent");
    expect(checklistFor("autre").length).toBeGreaterThan(0);
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
