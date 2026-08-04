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

/** Décomposition du temps de travail d'une revente (en heures). */
export interface TimeBreakdown {
  /** Remise en état / réparation. */
  refurbHours: number;
  /** Nettoyage. */
  cleaningHours: number;
  /** Photos. */
  photoHours: number;
  /** Rédaction et publication de l'annonce. */
  listingHours: number;
  /** Emballage / remise en main propre. */
  packingHours: number;
  /** SAV, questions des acheteurs, litiges. */
  savHours: number;
}

/** Données d'entrée d'une analyse (saisie utilisateur). */
export interface AuctionInput extends TimeBreakdown {
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
  /** Gain minimum en dessous duquel l'opération ne vaut pas le déplacement, en €. */
  minProfitTarget: number;
  /** Commission de la plateforme de revente, en % du prix de vente. */
  sellingFeePct: number;
  /** Frais de revente fixes (essence, cartons, papier bulle, scotch…), en €. */
  sellingMiscCost: number;
  /** Prix de revente estimés selon trois scénarios, en €. */
  resaleFast: number;
  resaleNormal: number;
  resaleOptimized: number;
}

/** Détail d'un scénario de revente. */
export interface ResaleScenario {
  kind: "rapide" | "normal" | "optimise";
  label: string;
  /** Prix de revente estimé. */
  price: number;
  /** Gain brut = prix de revente − coût total réel. */
  grossProfit: number;
  /** Gain réel = gain brut − commission plateforme − frais de revente fixes. */
  netProfit: number;
  /** ROI = gain réel / coût total réel, en %. */
  roi: number;
  /** Délai de vente indicatif. */
  timeEstimate: string;
  /** Probabilité de vendre à ce prix (%) — heuristique ou mesurée. */
  probability: number;
  /** Provenance de la probabilité (absent = heuristique). */
  probabilityProvenance?: "mesure" | "estime" | "heuristique";
}

/** Conseil de stratégie produit par le moteur. */
export interface StrategyAdvice {
  /** Scénario recommandé — ou null si l'achat est déconseillé. */
  kind: ResaleScenario["kind"] | null;
  title: string;
  /** Explication en une ou deux phrases. */
  reason: string;
  gain: number;
  timeEstimate: string;
  probability: number;
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
  /** Provenance de la note (absent = heuristique). */
  provenance?: "mesure" | "estime" | "heuristique";
}

/**
 * Contexte de connaissances injecté dans l'analyse quand un produit est lié :
 * les valeurs mesurées remplacent automatiquement les heuristiques.
 */
export interface KnowledgeContext {
  /** Popularité mesurée (volume réel d'observations sur 12 mois). */
  popularity?: { score: number; provenance: "mesure" | "estime" };
  /** Probabilités mesurées des scénarios (délais réels de mes ventes). */
  probabilities?: {
    provenance: "mesure" | "estime";
    rapidePct: number;
    normalPct: number;
    optimisePct: number;
  };
}

/** Explication lisible du score : points forts et points faibles. */
export interface ScoreExplanation {
  positives: string[];
  negatives: string[];
}

/** Plateforme de revente conseillée. */
export interface PlatformAdvice {
  name: string;
  /** Pertinence de 1 à 5 (affichée en étoiles). */
  stars: number;
  reason: string;
}

/** Résultat complet d'une analyse. */
export interface AuctionAnalysis {
  /** Coût total réel : marteau + frais + TVA + déplacement + livraison. */
  totalCost: number;
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
  scenarios: ResaleScenario[];
  /** Temps total estimé (somme de la décomposition), en heures. */
  totalTimeHours: number;
  /** Le meilleur gain atteint-il le gain minimum visé ? */
  meetsMinProfit: boolean;
  /** Stratégie recommandée. */
  strategy: StrategyAdvice;
  /** Score global sur 100. */
  score: number;
  /** Nombre d'étoiles (1 à 5). */
  stars: number;
  criteria: ScoreCriterion[];
  /** Points forts / points faibles expliquant la note. */
  explanation: ScoreExplanation;
  /** Plateformes de revente conseillées pour la catégorie. */
  platforms: PlatformAdvice[];
  verdict: "pepite" | "bonne-affaire" | "correct" | "a-eviter";
  verdictLabel: string;
}
