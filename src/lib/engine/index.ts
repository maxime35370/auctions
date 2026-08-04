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
import { checklistFor, explainScore, recommendPlatforms } from "./advice";
import type { AuctionAnalysis, AuctionInput } from "./types";

export * from "./types";
export * from "./knowledge";
export { TARGET_ROI } from "./costs";
export { checklistFor, recommendPlatforms } from "./advice";

/** Analyse complète d'une enchère à partir des données saisies. */
export function analyzeAuction(input: AuctionInput): AuctionAnalysis {
  const { totalCost, ...costBreakdown } = computeCosts(input);
  const scenarios = computeScenarios(input, totalCost);
  const normal = scenarios.find((s) => s.kind === "normal")!;
  const totalTimeHours = totalTime(input);

  const maxBudget = computeMaxBudget(input);
  const { score, stars, criteria } = computeScore(
    input,
    normal.roi,
    totalCost,
    totalTimeHours
  );
  const { verdict, verdictLabel } = verdictFromScore(score);
  const strategy = recommendStrategy(input, scenarios);
  const bestProfit = Math.max(...scenarios.map((s) => s.netProfit));

  return {
    totalCost,
    costBreakdown,
    maxBudget,
    potentialMargin: normal.netProfit,
    netProfit: normal.netProfit,
    roi: normal.roi,
    scenarios,
    totalTimeHours,
    meetsMinProfit: bestProfit >= input.minProfitTarget,
    strategy,
    score,
    stars,
    criteria,
    explanation: explainScore(criteria),
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
    vatPct: 0,
    travelCost: 0,
    shippingCost: 0,
    condition: "bon",
    category: "autre",
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
