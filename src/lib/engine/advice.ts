/**
 * Conseils annexes : explication du score, plateformes de revente,
 * checklist de vérifications par catégorie.
 *
 * Ces tables sont des heuristiques initiales ; en V2 elles seront enrichies
 * par l'historique réel des ventes et par l'utilisateur.
 */

import type {
  PlatformAdvice,
  ScoreCriterion,
  ScoreExplanation,
} from "./types";

// ---------------------------------------------------------------------------
// Explication du score (✔ points forts / ❌ points faibles)
// ---------------------------------------------------------------------------

/** Libellés par critère : [si bon (≥ 70), si faible (< 40)]. */
const CRITERION_MESSAGES: Record<
  ScoreCriterion["key"],
  { good: string; bad: string }
> = {
  rentabilite: { good: "Très bonne marge", bad: "Marge trop faible" },
  faciliteRevente: { good: "Revente facile", bad: "Revente lente à prévoir" },
  popularite: { good: "Objet recherché, forte demande", bad: "Demande limitée" },
  remiseEnEtat: { good: "Peu de travail à prévoir", bad: "Beaucoup de temps de travail" },
  risque: { good: "Peu de risques", bad: "Risque élevé (état ou frais fixes)" },
  confiance: { good: "Informations complètes", bad: "Informations incomplètes — score peu fiable" },
};

/** Traduit les notes des critères en phrases lisibles. */
export function explainScore(criteria: ScoreCriterion[]): ScoreExplanation {
  const positives: string[] = [];
  const negatives: string[] = [];
  for (const c of criteria) {
    const msg = CRITERION_MESSAGES[c.key];
    if (c.value >= 70) positives.push(msg.good);
    else if (c.value < 40) negatives.push(msg.bad);
  }
  return { positives, negatives };
}

// ---------------------------------------------------------------------------
// Plateformes de revente conseillées par catégorie
// ---------------------------------------------------------------------------

const DEFAULT_PLATFORMS: PlatformAdvice[] = [
  { name: "Leboncoin", stars: 4, reason: "Large audience, remise en main propre sans frais" },
  { name: "Facebook Marketplace", stars: 3, reason: "Rapide et local, mais négociation agressive" },
  { name: "eBay", stars: 3, reason: "Audience mondiale, frais et litiges à prévoir" },
];

const PLATFORMS_BY_CATEGORY: Record<string, PlatformAdvice[]> = {
  photo: [
    { name: "Forums photo spécialisés", stars: 5, reason: "Acheteurs connaisseurs, prix soutenus" },
    { name: "Leboncoin", stars: 4, reason: "Forte demande en matériel photo d'occasion" },
    { name: "eBay", stars: 4, reason: "Bon prix à l'international pour les objectifs cotés" },
    { name: "MPB / reprise pro", stars: 3, reason: "Vente immédiate mais prix inférieur" },
  ],
  informatique: [
    { name: "Leboncoin", stars: 5, reason: "Très forte demande (SBC, NAS, composants)" },
    { name: "Forums spécialisés", stars: 4, reason: "Acheteurs avertis, transactions sereines" },
    { name: "eBay", stars: 4, reason: "Bon débouché pour pièces et lots" },
    { name: "Facebook Marketplace", stars: 3, reason: "Rapide en local" },
  ],
  "audio-video": [
    { name: "Leboncoin", stars: 4, reason: "Demande régulière hifi/vidéo" },
    { name: "Forums audiophiles", stars: 5, reason: "Prix premium pour le matériel coté" },
    { name: "eBay", stars: 3, reason: "International, mais expédition délicate" },
  ],
  "horlogerie-bijoux": [
    { name: "Chrono24 / plateformes spécialisées", stars: 5, reason: "Acheteurs sérieux, prix de marché" },
    { name: "eBay", stars: 4, reason: "Large audience, authentification possible" },
    { name: "Leboncoin", stars: 2, reason: "Méfiance des acheteurs sur ce segment" },
  ],
  mobilier: [
    { name: "Leboncoin", stars: 5, reason: "Le réflexe n°1 pour le mobilier d'occasion" },
    { name: "Facebook Marketplace", stars: 4, reason: "Très efficace en local, sans expédition" },
    { name: "Selency", stars: 4, reason: "Prix premium pour le vintage / design" },
  ],
  outillage: [
    { name: "Leboncoin", stars: 5, reason: "Demande constante des artisans et bricoleurs" },
    { name: "Facebook Marketplace", stars: 4, reason: "Vente rapide en local" },
  ],
};

/** Plateformes conseillées pour une catégorie (triées par pertinence). */
export function recommendPlatforms(category: string): PlatformAdvice[] {
  return [...(PLATFORMS_BY_CATEGORY[category] ?? DEFAULT_PLATFORMS)].sort(
    (a, b) => b.stars - a.stars
  );
}

// ---------------------------------------------------------------------------
// Checklist de vérifications par catégorie
// ---------------------------------------------------------------------------

const COMMON_CHECKS = ["Photos détaillées de l'annonce examinées", "Accessoires listés présents"];

const CHECKS_BY_CATEGORY: Record<string, string[]> = {
  photo: [
    "Absence de champignons / poussière dans les optiques",
    "Autofocus fonctionnel",
    "Bagues (zoom, mise au point) fluides",
    "Nombre de déclenchements (boîtiers)",
    "Pare-soleil et bouchons présents",
  ],
  informatique: [
    "Alimentation / chargeur présent",
    "Démarrage vérifié (ou vendu HS annoncé)",
    "Ports USB / réseau non endommagés",
    "Licence / clé d'activation incluse",
    "Disques effacés ou présents",
    "Câbles fournis",
  ],
  "audio-video": [
    "Toutes les sorties audio testées",
    "Télécommande présente",
    "Membranes des haut-parleurs intactes",
    "Câbles d'alimentation fournis",
  ],
  electromenager: [
    "Appareil testé en fonctionnement",
    "Joints et bacs complets",
    "Notice / accessoires présents",
  ],
  outillage: [
    "Batterie(s) et chargeur présents",
    "État des charbons / moteur",
    "Coffret et accessoires complets",
  ],
  "horlogerie-bijoux": [
    "Authenticité / poinçons vérifiés",
    "Papiers et boîte d'origine",
    "Mouvement fonctionnel",
  ],
  vehicules: [
    "Carte grise / papiers en règle",
    "Contrôle technique",
    "Démarrage et essai possibles",
  ],
};

/** Points à vérifier avant d'enchérir, selon la catégorie. */
export function checklistFor(category: string): string[] {
  return [...(CHECKS_BY_CATEGORY[category] ?? []), ...COMMON_CHECKS];
}
