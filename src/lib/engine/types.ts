/**
 * Types du moteur d'analyse d'enchères.
 *
 * Le moteur (src/lib/engine) est volontairement indépendant du framework et de
 * la base de données : ce sont des fonctions pures, testées unitairement, qui
 * pourront être réutilisées telles quelles (API, CLI, mobile, workers…).
 */

/** État physique du lot, du meilleur au pire. */
export type Condition =
  | "neuf"
  | "tres-bon"
  | "bon"
  | "moyen"
  | "a-reparer"
  | "epave";

export const CONDITIONS: { value: Condition; label: string }[] = [
  { value: "neuf", label: "Neuf" },
  { value: "tres-bon", label: "Très bon état" },
  { value: "bon", label: "Bon état" },
  { value: "moyen", label: "État moyen" },
  { value: "a-reparer", label: "À réparer" },
  { value: "epave", label: "Épave / pour pièces" },
];

/** Catégories connues — extensible sans migration (stockées en texte). */
export const CATEGORIES = [
  "photo",
  "informatique",
  "audio-video",
  "electromenager",
  "outillage",
  "mobilier",
  "horlogerie-bijoux",
  "art-collection",
  "vehicules",
  "autre",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  photo: "Photo",
  informatique: "Informatique",
  "audio-video": "Audio / Vidéo",
  electromenager: "Électroménager",
  outillage: "Outillage",
  mobilier: "Mobilier",
  "horlogerie-bijoux": "Horlogerie / Bijoux",
  "art-collection": "Art / Collection",
  vehicules: "Véhicules",
  autre: "Autre",
};

/** Données d'entrée d'une analyse (saisie utilisateur). */
export interface AuctionInput {
  /** Prix actuel de l'enchère (prix marteau envisagé), en €. */
  currentPrice: number;
  /** Frais acheteur, en % du prix marteau. */
  buyerFeePct: number;
  /** TVA, en % — appliquée sur (prix marteau + frais acheteur). */
  vatPct: number;
  /** Coût estimé du déplacement, en €. */
  travelCost: number;
  /** Coût de livraison, en €. */
  shippingCost: number;
  condition: Condition;
  category: string;
  /** Temps de remise en état estimé, en heures. */
  refurbHours: number;
  /** Prix de revente estimés selon trois scénarios, en €. */
  resaleFast: number;
  resaleNormal: number;
  resaleOptimized: number;
}

/** Détail d'un scénario de revente. */
export interface ResaleScenario {
  /** Identifiant du scénario. */
  kind: "rapide" | "normal" | "optimise";
  label: string;
  /** Prix de revente estimé. */
  price: number;
  /** Bénéfice net = prix de revente − coût total réel. */
  netProfit: number;
  /** ROI = bénéfice net / coût total réel, en %. */
  roi: number;
}

/** Un critère de notation (0–100) avec son poids dans le score global. */
export interface ScoreCriterion {
  key:
    | "rentabilite"
    | "faciliteRevente"
    | "popularite"
    | "remiseEnEtat"
    | "risque"
    | "confiance";
  label: string;
  /** Note du critère, 0–100 (100 = excellent). */
  value: number;
  /** Poids du critère dans le score global (somme des poids = 1). */
  weight: number;
}

/** Résultat complet d'une analyse. */
export interface AuctionAnalysis {
  /** Coût total réel : marteau + frais + TVA + déplacement + livraison. */
  totalCost: number;
  /** Détail du coût total. */
  costBreakdown: {
    hammerPrice: number;
    buyerFee: number;
    vat: number;
    travelCost: number;
    shippingCost: number;
  };
  /** Budget maximal conseillé (prix marteau) pour préserver le ROI cible. */
  maxBudget: number;
  /** Marge potentielle = revente normale − coût total. */
  potentialMargin: number;
  /** Bénéfice net du scénario normal. */
  netProfit: number;
  /** ROI du scénario normal, en %. */
  roi: number;
  /** Les trois scénarios de revente. */
  scenarios: ResaleScenario[];
  /** Score global sur 100. */
  score: number;
  /** Nombre d'étoiles (1 à 5). */
  stars: number;
  /** Détail des critères de notation. */
  criteria: ScoreCriterion[];
  /** Verdict lisible. */
  verdict: "pepite" | "bonne-affaire" | "correct" | "a-eviter";
  verdictLabel: string;
}
