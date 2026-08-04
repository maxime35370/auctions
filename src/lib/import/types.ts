/**
 * Format commun de l'import d'annonces.
 *
 * Tous les connecteurs (Interencheres, Agorastore, démo, presse-papiers…)
 * retournent le même objet `StandardAuctionData` : le reste de l'application
 * n'a jamais besoin de savoir d'où viennent les données. Ajouter un site
 * demain = écrire un connecteur, sans toucher au reste.
 */

/** Données extraites d'une annonce, format commun à tous les connecteurs. */
export interface StandardAuctionData {
  title?: string;
  description?: string;
  /** Catégorie brute du site (sera convertie vers nos catégories internes). */
  rawCategory?: string;
  photos?: string[];
  /** Prix actuel de l'enchère, en €. */
  currentPrice?: number;
  /** Frais acheteur, en % (si trouvés). */
  buyerFeePct?: number;
  /** Coût de livraison, en € (si trouvé). */
  shippingCost?: number;
  location?: string;
  /** Maison de vente / vendeur. */
  auctionHouse?: string;
  /** Date de fin (YYYY-MM-DD). */
  endDate?: string;
  /** État brut annoncé (« occasion », « neuf », « pour pièces »…). */
  rawCondition?: string;
  /** URL d'origine. */
  sourceUrl?: string;
}

/** Une étape du déroulé d'import, affichée à l'utilisateur en temps réel. */
export interface ImportStep {
  /** Icône ou emoji de l'étape. */
  icon: string;
  label: string;
  status: "pending" | "ok" | "warn" | "error";
}

/** Callback de progression : le connecteur raconte ce qu'il fait. */
export type ProgressReporter = (step: ImportStep) => void;

/** Résultat d'un import. */
export interface ImportResult {
  data: StandardAuctionData;
  /** Nombre de champs réellement extraits (pour juger la qualité). */
  fieldsFound: number;
}

/** Contexte fourni à un connecteur pour l'extraction. */
export interface ExtractContext {
  url: string;
  /** HTML de la page si déjà acquis (mode presse-papiers), sinon undefined. */
  html?: string;
  report: ProgressReporter;
}

/**
 * Un connecteur = un site.
 * `matches` décide si l'URL le concerne ; `extract` produit le format commun
 * en racontant sa progression via `ctx.report`.
 */
export interface Connector {
  id: string;
  /** Nom affiché (« Interencheres », « Démo »…). */
  name: string;
  matches(url: string): boolean;
  extract(ctx: ExtractContext): Promise<ImportResult>;
}

/** Compte les champs non vides d'un résultat d'extraction. */
export function countFields(data: StandardAuctionData): number {
  return Object.values(data).filter(
    (v) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)
  ).length;
}
