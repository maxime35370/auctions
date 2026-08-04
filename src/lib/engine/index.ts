/**
 * Point d'entrée du moteur d'analyse.
 *
 * `analyzeAuction(input)` est LA fonction centrale de l'application : elle est
 * appelée par l'API (persistance) et par le formulaire (aperçu en direct).
 * Toute évolution des règles métier se fait ici ou dans costs.ts / scoring.ts,
 * jamais dans les composants React.
 */

import { computeCosts, computeMaxBudget, computeScenarios } from "./costs";
import { computeScore, verdictFromScore } from "./scoring";
import type { AuctionAnalysis, AuctionInput } from "./types";

export * from "./types";
export { TARGET_ROI } from "./costs";

/** Analyse complète d'une enchère à partir des données saisies. */
export function analyzeAuction(input: AuctionInput): AuctionAnalysis {
  const { totalCost, ...costBreakdown } = computeCosts(input);
  const scenarios = computeScenarios(input, totalCost);
  const normal = scenarios.find((s) => s.kind === "normal")!;

  const maxBudget = computeMaxBudget(input);
  const { score, stars, criteria } = computeScore(input, normal.roi, totalCost);
  const { verdict, verdictLabel } = verdictFromScore(score);

  return {
    totalCost,
    costBreakdown,
    maxBudget,
    potentialMargin: normal.netProfit,
    netProfit: normal.netProfit,
    roi: normal.roi,
    scenarios,
    score,
    stars,
    criteria,
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
    refurbHours: 0,
    resaleFast: 0,
    resaleNormal: 0,
    resaleOptimized: 0,
  };
}
