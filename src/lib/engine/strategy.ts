/**
 * Recommandation de stratégie de revente.
 *
 * Délais et probabilités sont pour l'instant des heuristiques documentées ;
 * en V2 ils seront progressivement remplacés par les statistiques réelles de
 * l'historique des ventes (l'interface StrategyAdvice ne changera pas).
 *
 * Règle de choix (documentée pour rester prévisible) :
 *  1. tous les scénarios perdants → achat déconseillé ;
 *  2. la revente rapide conserve ≥ 80 % du meilleur gain → rapide
 *     (presque autant de gain, beaucoup plus vite, moins d'incertitude) ;
 *  3. la revente optimisée rapporte ≥ 25 % et ≥ 100 € de plus que la rapide
 *     → optimisée (le supplément justifie l'attente) ;
 *  4. sinon → normale (meilleur équilibre gain / délai).
 */

import type { AuctionInput, ResaleScenario, StrategyAdvice } from "./types";

/** Délai et probabilité indicatifs par scénario. */
export const SCENARIO_META: Record<
  ResaleScenario["kind"],
  { timeEstimate: string; probability: number }
> = {
  rapide: { timeEstimate: "≈ 1 semaine", probability: 90 },
  normal: { timeEstimate: "≈ 1 mois", probability: 75 },
  optimise: { timeEstimate: "≈ 2 à 3 mois", probability: 55 },
};

export function recommendStrategy(
  input: AuctionInput,
  scenarios: ResaleScenario[]
): StrategyAdvice {
  const rapide = scenarios.find((s) => s.kind === "rapide")!;
  const optimise = scenarios.find((s) => s.kind === "optimise")!;
  const normal = scenarios.find((s) => s.kind === "normal")!;

  const best = [...scenarios].sort((a, b) => b.netProfit - a.netProfit)[0];

  // 1. Aucune issue rentable → ne pas acheter à ce prix.
  if (best.netProfit <= 0) {
    return {
      kind: null,
      title: "Ne pas acheter à ce prix",
      reason:
        "Aucun scénario de revente ne dégage de bénéfice au prix actuel. Attendez une baisse ou passez votre tour.",
      gain: best.netProfit,
      timeEstimate: "—",
      probability: 0,
    };
  }

  const pick = (s: ResaleScenario, reason: string): StrategyAdvice => ({
    kind: s.kind,
    title:
      s.kind === "rapide"
        ? "Revendre rapidement"
        : s.kind === "optimise"
          ? "Viser la revente optimisée"
          : "Revente au prix normal",
    reason,
    gain: s.netProfit,
    timeEstimate: s.timeEstimate,
    probability: s.probability,
  });

  // 2. La vente rapide capte presque tout le gain → autant vendre vite.
  if (rapide.netProfit > 0 && rapide.netProfit >= best.netProfit * 0.8) {
    return pick(
      rapide,
      "La vente rapide conserve l'essentiel du gain : argent récupéré vite, risque d'invendu minimal."
    );
  }

  // 3. Le supplément de la vente optimisée justifie l'attente.
  const bonus = optimise.netProfit - rapide.netProfit;
  if (bonus >= 100 && optimise.netProfit >= rapide.netProfit * 1.25) {
    return pick(
      optimise,
      `Patienter rapporte ${Math.round(bonus)} € de plus que la vente rapide : le supplément justifie le délai.`
    );
  }

  // 4. Équilibre par défaut.
  return pick(
    normal,
    "Meilleur équilibre entre gain et délai : prix du marché, sans brader ni immobiliser le capital trop longtemps."
  );
}
