/**
 * Notation d'une enchère : 6 critères sur 100, pondérés, → score global /100.
 *
 * | Critère             | Poids | Source                                        |
 * |---------------------|-------|-----------------------------------------------|
 * | Rentabilité         | 35 %  | ROI du scénario normal                        |
 * | Facilité de revente | 15 %  | proximité revente rapide / revente normale    |
 * | Popularité          | 10 %  | catégorie (table interne, apprentissage en V2)|
 * | Remise en état      | 10 %  | heures de travail estimées                    |
 * | Risque              | 20 %  | état du lot + part des frais fixes            |
 * | Confiance           | 10 %  | complétude des informations saisies           |
 *
 * En V2, la popularité et la facilité de revente seront progressivement
 * alimentées par l'historique réel des ventes (base Item / Auction) au lieu
 * des heuristiques ci-dessous — l'interface `ScoreCriterion` ne changera pas.
 */

import type {
  AuctionAnalysis,
  AuctionInput,
  Condition,
  ScoreCriterion,
} from "./types";

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

/** Popularité par catégorie (heuristique initiale, 0–100). */
const CATEGORY_POPULARITY: Record<string, number> = {
  photo: 85,
  informatique: 90,
  "audio-video": 75,
  electromenager: 55,
  outillage: 70,
  mobilier: 45,
  "horlogerie-bijoux": 80,
  "art-collection": 50,
  vehicules: 65,
  autre: 50,
};

/** Risque intrinsèque lié à l'état (0 = aucun risque, 100 = très risqué). */
const CONDITION_RISK: Record<Condition, number> = {
  neuf: 5,
  "tres-bon": 15,
  bon: 25,
  moyen: 45,
  "a-reparer": 70,
  epave: 90,
};

/** Rentabilité : 0 % ROI → 0 pts, 30 % → 60 pts, 60 % → 85 pts, ≥100 % → 100 pts. */
export function scoreProfitability(roiPct: number): number {
  if (roiPct <= 0) return 0;
  if (roiPct <= 30) return clamp((roiPct / 30) * 60);
  if (roiPct <= 60) return clamp(60 + ((roiPct - 30) / 30) * 25);
  return clamp(85 + ((roiPct - 60) / 40) * 15);
}

/**
 * Facilité de revente : si le prix « rapide » est proche du prix « normal »,
 * l'objet se vend vite sans sacrifier la marge.
 */
export function scoreLiquidity(input: AuctionInput): number {
  if (input.resaleNormal <= 0) return 0;
  return clamp((input.resaleFast / input.resaleNormal) * 100);
}

/** Popularité de la catégorie. */
export function scorePopularity(category: string): number {
  return CATEGORY_POPULARITY[category] ?? 50;
}

/** Remise en état : 0 h → 100 pts, décroissance linéaire jusqu'à 20 h → 0 pt. */
export function scoreRefurb(refurbHours: number): number {
  return clamp(100 - (refurbHours / 20) * 100);
}

/**
 * Risque (noté inversé : 100 = peu risqué).
 * Combine l'état du lot et le poids des frais fixes (déplacement + livraison)
 * dans le coût total : des frais fixes élevés sont perdus si le lot déçoit.
 */
export function scoreRisk(input: AuctionInput, totalCost: number): number {
  const conditionRisk = CONDITION_RISK[input.condition] ?? 40;
  const fixedShare =
    totalCost > 0 ? (input.travelCost + input.shippingCost) / totalCost : 0;
  const fixedRisk = clamp(fixedShare * 200); // 50 % de frais fixes → risque max
  return clamp(100 - (conditionRisk * 0.7 + fixedRisk * 0.3));
}

/** Confiance : proportion d'informations réellement renseignées. */
export function scoreConfidence(input: AuctionInput): number {
  const signals = [
    input.currentPrice > 0,
    input.buyerFeePct > 0,
    input.resaleFast > 0,
    input.resaleNormal > 0,
    input.resaleOptimized > 0,
    input.category !== "autre",
    input.condition !== undefined,
  ];
  const filled = signals.filter(Boolean).length;
  return clamp((filled / signals.length) * 100);
}

/** Construit les 6 critères pondérés puis le score global. */
export function computeScore(
  input: AuctionInput,
  roiPct: number,
  totalCost: number
): { score: number; stars: number; criteria: ScoreCriterion[] } {
  const criteria: ScoreCriterion[] = [
    { key: "rentabilite", label: "Rentabilité", weight: 0.35, value: Math.round(scoreProfitability(roiPct)) },
    { key: "faciliteRevente", label: "Facilité de revente", weight: 0.15, value: Math.round(scoreLiquidity(input)) },
    { key: "popularite", label: "Popularité", weight: 0.1, value: Math.round(scorePopularity(input.category)) },
    { key: "remiseEnEtat", label: "Remise en état", weight: 0.1, value: Math.round(scoreRefurb(input.refurbHours)) },
    { key: "risque", label: "Risque maîtrisé", weight: 0.2, value: Math.round(scoreRisk(input, totalCost)) },
    { key: "confiance", label: "Confiance", weight: 0.1, value: Math.round(scoreConfidence(input)) },
  ];

  const score = Math.round(
    criteria.reduce((sum, c) => sum + c.value * c.weight, 0)
  );
  const stars = Math.max(1, Math.min(5, Math.round(score / 20)));

  return { score, stars, criteria };
}

/** Verdict lisible à partir du score. */
export function verdictFromScore(score: number): {
  verdict: AuctionAnalysis["verdict"];
  verdictLabel: string;
} {
  if (score >= 80) return { verdict: "pepite", verdictLabel: "💎 Pépite" };
  if (score >= 65) return { verdict: "bonne-affaire", verdictLabel: "✅ Bonne affaire" };
  if (score >= 50) return { verdict: "correct", verdictLabel: "🟡 Correct" };
  return { verdict: "a-eviter", verdictLabel: "🔴 À éviter" };
}
