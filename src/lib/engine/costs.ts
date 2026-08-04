/**
 * Calculs de coûts et de rentabilité.
 *
 * Règles métier :
 *  - Frais acheteur  = prix marteau × buyerFeePct %
 *  - TVA             = (prix marteau + frais acheteur) × vatPct %
 *  - Coût total réel = prix marteau + frais + TVA + déplacement + livraison
 *  - Bénéfice net    = prix de revente − coût total réel
 *  - ROI             = bénéfice net / coût total réel
 *  - Budget max      = prix marteau maximal qui préserve encore le ROI cible
 *                      sur le scénario de revente « normal »
 */

import type { AuctionInput, ResaleScenario } from "./types";

/** ROI cible utilisé pour le budget maximal conseillé (30 % par défaut). */
export const TARGET_ROI = 0.3;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Multiplicateur frais + TVA appliqué au prix marteau. */
function feeMultiplier(input: Pick<AuctionInput, "buyerFeePct" | "vatPct">): number {
  return (1 + input.buyerFeePct / 100) * (1 + input.vatPct / 100);
}

/** Décompose le coût total réel d'une enchère. */
export function computeCosts(input: AuctionInput) {
  const hammerPrice = input.currentPrice;
  const buyerFee = hammerPrice * (input.buyerFeePct / 100);
  const vat = (hammerPrice + buyerFee) * (input.vatPct / 100);
  const totalCost =
    hammerPrice + buyerFee + vat + input.travelCost + input.shippingCost;

  return {
    hammerPrice: round2(hammerPrice),
    buyerFee: round2(buyerFee),
    vat: round2(vat),
    travelCost: round2(input.travelCost),
    shippingCost: round2(input.shippingCost),
    totalCost: round2(totalCost),
  };
}

/**
 * Budget maximal conseillé (prix marteau).
 *
 * On cherche le prix marteau B tel que le coût total obtenu laisse encore le
 * ROI cible sur la revente « normale » :
 *
 *   revente / (1 + ROI cible) = B × (1+frais)(1+TVA) + déplacement + livraison
 *
 * d'où : B = (revente / (1 + ROI cible) − frais fixes) / multiplicateur
 */
export function computeMaxBudget(input: AuctionInput, targetRoi = TARGET_ROI): number {
  const fixedCosts = input.travelCost + input.shippingCost;
  const maxTotalCost = input.resaleNormal / (1 + targetRoi);
  const maxBid = (maxTotalCost - fixedCosts) / feeMultiplier(input);
  return round2(Math.max(0, maxBid));
}

/** Construit les trois scénarios de revente avec bénéfice net et ROI. */
export function computeScenarios(
  input: AuctionInput,
  totalCost: number
): ResaleScenario[] {
  const make = (
    kind: ResaleScenario["kind"],
    label: string,
    price: number
  ): ResaleScenario => {
    const netProfit = round2(price - totalCost);
    const roi = totalCost > 0 ? round2((netProfit / totalCost) * 100) : 0;
    return { kind, label, price: round2(price), netProfit, roi };
  };

  return [
    make("rapide", "Revente rapide", input.resaleFast),
    make("normal", "Revente normale", input.resaleNormal),
    make("optimise", "Revente optimisée", input.resaleOptimized),
  ];
}
