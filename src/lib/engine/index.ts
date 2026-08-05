/**
 * Point d'entrée du moteur d'analyse.
 *
 * `analyzeAuction(input)` est LA fonction centrale de l'application : elle est
 * appelée par le stockage (persistance) et par le formulaire (aperçu en
 * direct). Toute évolution des règles métier se fait dans les modules de ce
 * dossier, jamais dans les composants React.
 */

import { computeCosts, computeMaxBudget, computeScenarios, totalTime } from "./costs";
import { computeScore, verdictFromScore } from "./scoring";
import { recommendStrategy } from "./strategy";
import { checklistFor, explainScore, lotOriginMeta, recommendPlatforms } from "./advice";
import type { AuctionAnalysis, AuctionInput } from "./types";

export * from "./types";
export * from "./knowledge";
export { TARGET_ROI } from "./costs";
export { checklistFor, LOT_ORIGINS, lotOriginMeta, recommendPlatforms } from "./advice";

/**
 * Analyse complète d'une enchère à partir des données saisies.
 * Le contexte de connaissances (produit lié) fait passer les heuristiques en
 * valeurs mesurées : popularité réelle, probabilités réelles des scénarios.
 */
export function analyzeAuction(
  input: AuctionInput,
  knowledge?: import("./types").KnowledgeContext
): AuctionAnalysis {
  const { totalCost, ...costBreakdown } = computeCosts(input);
  const scenarios = computeScenarios(input, totalCost, knowledge?.probabilities);
  const normal = scenarios.find((s) => s.kind === "normal")!;
  const totalTimeHours = totalTime(input);

  const maxBudget = computeMaxBudget(input);
  const { score, stars, criteria } = computeScore(
    input,
    normal.roi,
    totalCost,
    totalTimeHours,
    knowledge?.popularity
  );
  const { verdict, verdictLabel } = verdictFromScore(score);
  const strategy = recommendStrategy(input, scenarios);
  const bestProfit = Math.max(...scenarios.map((s) => s.netProfit));

  // L'origine du lot est expliquée dans les points faibles (pénalités
  // mécaniques : risque, budget max, confiance).
  const explanation = explainScore(criteria);
  const origin = lotOriginMeta(input.lotOrigin);
  if (origin) {
    explanation.negatives.unshift(
      `Origine « ${origin.label} » : ${origin.note} — risque +${origin.riskPenalty}, budget max réduit de ${origin.budgetReductionPct} %`
    );
  }

  // ⏱ Bénéfice par heure investie : 100 € en 2 h ≠ 30 € en 15 h.
  const hourlyProfit =
    totalTimeHours > 0
      ? Math.round((normal.netProfit / totalTimeHours) * 10) / 10
      : undefined;

  return {
    totalCost,
    costBreakdown,
    maxBudget,
    potentialMargin: normal.netProfit,
    netProfit: normal.netProfit,
    roi: normal.roi,
    scenarios,
    totalTimeHours,
    hourlyProfit,
    meetsMinProfit: bestProfit >= input.minProfitTarget,
    strategy,
    score,
    stars,
    criteria,
    explanation,
    platforms: recommendPlatforms(input.category),
    verdict,
    verdictLabel,
  };
}

/** Valeurs par défaut d'un formulaire d'analyse vierge. */
export function emptyAuctionInput(): AuctionInput {
  return {
    currentPrice: 0,
    buyerFeePct: 0,
    platformFeePct: 0,
    vatPct: 0,
    travelCost: 0,
    shippingCost: 0,
    condition: "bon",
    category: "autre",
    lotOrigin: "",
    minProfitTarget: 100,
    sellingFeePct: 0,
    sellingMiscCost: 0,
    refurbHours: 0,
    cleaningHours: 0,
    photoHours: 0,
    listingHours: 0,
    packingHours: 0,
    savHours: 0,
    resaleFast: 0,
    resaleNormal: 0,
    resaleOptimized: 0,
  };
}

/** Génère la checklist de vérifications initiale d'une enchère. */
export function defaultChecklist(category: string): { label: string; done: boolean }[] {
  return checklistFor(category).map((label) => ({ label, done: false }));
}
