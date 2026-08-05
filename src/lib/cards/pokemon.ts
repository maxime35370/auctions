/**
 * 🃏 Lot de cartes Pokémon — identification et valeur de marché.
 *
 * L'utilisateur saisit les numéros visibles sur les photos du lot
 * (« Dracaufeu 4/102 », « 025/198 »…). Chaque carte est identifiée via
 * l'API publique pokemontcg.io (CORS ouvert, prix Cardmarket en euros).
 *
 * ⚠ Exception assumée au principe « pas d'API » : enrichissement OPTIONNEL
 * d'une catégorie — jamais le socle. Si l'API est injoignable, la saisie
 * manuelle des prix reste possible partout ailleurs dans l'application.
 * L'OCR des photos est prévu en étape suivante (cahier des charges).
 */

// ---------------------------------------------------------------------------
// Parsing des lignes saisies (fonctions pures, testées)
// ---------------------------------------------------------------------------

export interface CardQuery {
  /** Texte d'origine (pour l'affichage). */
  raw: string;
  /** Nom éventuel saisi avant le numéro. */
  name?: string;
  /** Numéro dans la collection (ex. « 4 », « 025 »). */
  number: string;
  /** Taille imprimée de la collection (ex. 102, 198). */
  printedTotal: number;
}

/**
 * Parse « Dracaufeu 4/102 », « 025/198 », « Pikachu 58 / 102 »…
 * Une ligne sans numéro/total est ignorée (renvoyée dans `invalid`).
 */
export function parseCardLines(text: string): {
  queries: CardQuery[];
  invalid: string[];
} {
  const queries: CardQuery[] = [];
  const invalid: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = line.match(/^(.*?)\s*(\d{1,3})\s*\/\s*(\d{1,3})\s*$/);
    if (!m) {
      invalid.push(line);
      continue;
    }
    const name = m[1].trim() || undefined;
    // Les numéros à zéros initiaux (« 025 ») correspondent à « 25 » dans l'API.
    const number = String(Number(m[2]));
    const printedTotal = Number(m[3]);
    if (printedTotal < 1 || printedTotal > 999) {
      invalid.push(line);
      continue;
    }
    queries.push({ raw: line, name, number, printedTotal });
  }
  return { queries, invalid };
}

// ---------------------------------------------------------------------------
// API pokemontcg.io
// ---------------------------------------------------------------------------

/** Réponse minimale de l'API (les champs qu'on utilise). */
export interface ApiCard {
  name: string;
  number: string;
  rarity?: string;
  images?: { small?: string };
  set?: { name?: string; series?: string; printedTotal?: number; total?: number };
  cardmarket?: {
    prices?: { averageSellPrice?: number; trendPrice?: number };
  };
}

export interface IdentifiedCard {
  query: CardQuery;
  /** Carte retenue (première correspondance), ou null si introuvable. */
  card: ApiCard | null;
  /** Nombre de correspondances (— la confiance baisse si ambigu). */
  matchCount: number;
  /** Prix moyen de vente Cardmarket, en €. */
  avgSell?: number;
  trend?: number;
}

/** Construit l'URL de recherche pour une carte. */
export function buildSearchUrl(q: CardQuery): string {
  const query = `number:${q.number} (set.printedTotal:${q.printedTotal} OR set.total:${q.printedTotal})`;
  return `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&pageSize=10&orderBy=-set.releaseDate`;
}

/** Choisit la meilleure correspondance (le nom saisi aide à trancher). */
export function pickMatch(q: CardQuery, cards: ApiCard[]): { card: ApiCard | null; matchCount: number } {
  if (cards.length === 0) return { card: null, matchCount: 0 };
  if (q.name) {
    const norm = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const byName = cards.find((c) => norm(c.name).includes(norm(q.name!)));
    if (byName) return { card: byName, matchCount: cards.length };
  }
  return { card: cards[0], matchCount: cards.length };
}

export function toIdentified(q: CardQuery, cards: ApiCard[]): IdentifiedCard {
  const { card, matchCount } = pickMatch(q, cards);
  return {
    query: q,
    card,
    matchCount,
    avgSell: card?.cardmarket?.prices?.averageSellPrice,
    trend: card?.cardmarket?.prices?.trendPrice,
  };
}

/** Interroge l'API carte par carte (séquentiel : respect du rate-limit). */
export async function identifyCards(
  queries: CardQuery[],
  onProgress?: (done: number, total: number) => void
): Promise<IdentifiedCard[]> {
  const results: IdentifiedCard[] = [];
  for (const [i, q] of queries.entries()) {
    try {
      const res = await fetch(buildSearchUrl(q), {
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      results.push(toIdentified(q, json.data ?? []));
    } catch {
      results.push({ query: q, card: null, matchCount: 0 });
    }
    onProgress?.(i + 1, queries.length);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Résumé du lot
// ---------------------------------------------------------------------------

/** Seuil « carte à forte valeur ». */
export const HIGH_VALUE_THRESHOLD = 20;

/** Lisibilité des photos, déclarée par l'utilisateur (OCR automatique : à venir). */
export type PhotoQuality = "bonnes" | "moyennes" | "floues";

export interface LotOptions {
  /** Cartes visibles mais illisibles sur les photos (non identifiables). */
  unreadableCount?: number;
  /** Valeur prudente par carte illisible, en € (raisonnement « scénario prudent »). */
  prudentValue?: number;
  photoQuality?: PhotoQuality;
}

/** Mode de confiance — le logiciel reconnaît ses limites, comme un expert. */
export type LotMode = "precis" | "fourchette" | "imprecis";

export interface LotSummary {
  cardCount: number;
  identified: number;
  priced: number;
  /** Valeur des cartes identifiées et cotées (la partie PROUVÉE). */
  provenValue: number;
  /** Estimation prudente des cartes illisibles (n × valeur prudente). */
  prudentUnknownValue: number;
  /** Total prudent = prouvé + prudent (jamais d'optimisme sur l'illisible). */
  totalValue: number;
  /** Cartes ≥ 20 € — à vérifier une par une sur les photos. */
  highValue: IdentifiedCard[];
  /** Confiance 0-100, plafonnée par la lisibilité des photos. */
  confidence: number;
  mode: LotMode;
  /** Message honnête affiché à l'utilisateur. */
  modeMessage: string;
  /** Prix de revente suggérés pour le LOT (décote lot vs vente à l'unité). */
  resaleFast: number;
  resaleNormal: number;
  resaleOptimized: number;
}

/** Plafond de confiance selon la lisibilité déclarée des photos. */
const PHOTO_QUALITY_CAP: Record<PhotoQuality, number> = {
  bonnes: 100,
  moyennes: 70,
  floues: 35,
};

/**
 * Résumé du lot — volontairement PRUDENT :
 *  - seules les cartes identifiées et cotées comptent en « prouvé » ;
 *  - les cartes illisibles valent leur valeur prudente saisie (ex. 12 × 10 €),
 *    jamais plus — si une carte à 180 € s'y cache, tant mieux : non payée ;
 *  - la confiance est plafonnée par la lisibilité des photos, et le mode
 *    l'annonce : 🟢 précis / 🟡 fourchette large / 🔴 « je ne peux pas
 *    estimer précisément ce lot ».
 * Décotes de revente : rapide 70 %, normal 85 %, optimisé 100 % (à l'unité).
 */
export function summarizeLot(
  cards: IdentifiedCard[],
  options: LotOptions = {}
): LotSummary {
  const round = (n: number) => Math.round(n * 100) / 100;
  const unreadable = Math.max(0, options.unreadableCount ?? 0);
  const prudentValue = Math.max(0, options.prudentValue ?? 0);

  const identified = cards.filter((c) => c.card !== null);
  const priced = identified.filter((c) => c.avgSell !== undefined);
  const provenValue = round(priced.reduce((s, c) => s + (c.avgSell ?? 0), 0));
  const prudentUnknownValue = round(unreadable * prudentValue);
  const totalValue = round(provenValue + prudentUnknownValue);

  // Confiance : identification × prix disponibles, les illisibles comptent
  // au dénominateur, l'ambiguïté pénalise, la qualité photo plafonne.
  const totalCards = cards.length + unreadable;
  const idRate = totalCards ? identified.length / totalCards : 0;
  const priceRate = identified.length ? priced.length / identified.length : 0;
  const ambiguous = identified.filter((c) => c.matchCount > 1).length;
  const ambiguityPenalty = identified.length
    ? (ambiguous / identified.length) * 15
    : 0;
  let confidence = Math.max(
    0,
    Math.round(idRate * 60 + priceRate * 40 - ambiguityPenalty)
  );
  confidence = Math.min(
    confidence,
    PHOTO_QUALITY_CAP[options.photoQuality ?? "bonnes"]
  );

  const mode: LotMode =
    confidence >= 75 ? "precis" : confidence >= 40 ? "fourchette" : "imprecis";
  const modeMessage =
    mode === "precis"
      ? "🟢 Confiance élevée — références lisibles, estimation précise."
      : mode === "fourchette"
        ? "🟡 Confiance moyenne — une partie du lot est incertaine : traitez le total comme une fourchette large et vérifiez les cartes clés."
        : "🔴 Confiance faible — je ne peux pas estimer précisément ce lot. L'estimation est volontairement prudente : n'enchérissez que sur la valeur prouvée.";

  return {
    cardCount: totalCards,
    identified: identified.length,
    priced: priced.length,
    provenValue,
    prudentUnknownValue,
    totalValue,
    highValue: priced
      .filter((c) => (c.avgSell ?? 0) >= HIGH_VALUE_THRESHOLD)
      .sort((a, b) => (b.avgSell ?? 0) - (a.avgSell ?? 0)),
    confidence,
    mode,
    modeMessage,
    resaleFast: round(totalValue * 0.7),
    resaleNormal: round(totalValue * 0.85),
    resaleOptimized: round(totalValue),
  };
}
