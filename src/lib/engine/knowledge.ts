/**
 * Base de connaissances — statistiques calculées sur les ventes observées.
 *
 * Principe fondateur : rien n'est inventé. Chaque chiffre (prix suggérés,
 * indice de confiance, tendance) est dérivé des observations réellement
 * enregistrées. Peu de données → faible confiance, affichée comme telle.
 *
 * Fonctions pures : elles reçoivent les observations en paramètre et ne
 * savent pas d'où elles viennent (localStorage aujourd'hui, API demain).
 */

/** Une vente / enchère / annonce observée pour un produit. */
export interface ObservationInput {
  /** Date (YYYY-MM-DD). */
  date: string;
  /** Prix observé, en €. */
  price: number;
  /** vente = prix de vente conclu ; enchere = adjudication ; annonce = prix affiché. */
  kind: "vente" | "enchere" | "annonce";
}

/** Statistiques d'un produit, calculées depuis ses observations. */
export interface ProductStats {
  count: number;
  avg?: number;
  min?: number;
  max?: number;
  median?: number;
  /** Dernière observation (toutes catégories). */
  last?: ObservationInput;
  /** Dernière vente conclue. */
  lastSale?: ObservationInput;
  /** Dernière adjudication observée. */
  lastAuction?: ObservationInput;
  /** Prix de revente suggérés : p25 / p50 / p75 des ventes conclues. */
  suggestedFast?: number;
  suggestedNormal?: number;
  suggestedPremium?: number;
  /** Prix d'adjudication médian — repère de budget d'enchère. */
  typicalAuctionPrice?: number;
  /** Tendance : variation % entre les 6 derniers mois et les 6 précédents. */
  trendPct?: number;
  /** Indice de confiance 0–100, avec ses justifications. */
  confidence: number;
  confidenceReasons: string[];
}

const round = (n: number) => Math.round(n * 100) / 100;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return round(sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo));
}

const DAY = 86_400_000;

/**
 * Tendance : moyenne des `windowDays` derniers jours comparée à la moyenne
 * des `windowDays` précédents. Chaque fenêtre doit contenir ≥ 2 observations.
 * `now` est injecté pour rester testable.
 */
export function computeTrend(
  observations: ObservationInput[],
  now: Date,
  windowDays = 182
): number | undefined {
  const recentStart = now.getTime() - windowDays * DAY;
  const previousStart = now.getTime() - 2 * windowDays * DAY;

  const recent: number[] = [];
  const previous: number[] = [];
  for (const o of observations) {
    const t = new Date(o.date).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= recentStart) recent.push(o.price);
    else if (t >= previousStart) previous.push(o.price);
  }
  if (recent.length < 2 || previous.length < 2) return undefined;

  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const prevAvg = avg(previous);
  if (prevAvg <= 0) return undefined;
  return round(((avg(recent) - prevAvg) / prevAvg) * 100);
}

/**
 * Indice de confiance 0–100 : volume + fraîcheur + stabilité des prix.
 * Chaque point est justifié — l'utilisateur voit pourquoi.
 */
export function computeConfidence(
  observations: ObservationInput[],
  now: Date
): { confidence: number; reasons: string[] } {
  const n = observations.length;
  const reasons: string[] = [];

  // Volume : 0 obs → 0, 20+ obs → 60 pts (progression racine, vite utile).
  const volume = Math.min(60, Math.round(Math.sqrt(n / 20) * 60));
  if (n === 0) reasons.push("Aucune observation — produit inconnu");
  else reasons.push(`${n} observation${n > 1 ? "s" : ""} enregistrée${n > 1 ? "s" : ""}`);

  // Fraîcheur : au moins une observation dans les 90 derniers jours → 20 pts.
  const fresh = observations.some(
    (o) => now.getTime() - new Date(o.date).getTime() <= 90 * DAY
  );
  if (fresh) reasons.push("Données récentes (moins de 3 mois)");
  else if (n > 0) reasons.push("Données anciennes — prudence");

  // Stabilité : coefficient de variation < 25 % → 20 pts (prix cohérents).
  let stable = false;
  if (n >= 3) {
    const prices = observations.map((o) => o.price);
    const avg = prices.reduce((s, x) => s + x, 0) / n;
    const sd = Math.sqrt(prices.reduce((s, x) => s + (x - avg) ** 2, 0) / n);
    stable = avg > 0 && sd / avg < 0.25;
    reasons.push(stable ? "Prix stables entre les ventes" : "Prix très variables");
  }

  const confidence = Math.min(100, volume + (fresh ? 20 : 0) + (stable ? 20 : 0));
  return { confidence, reasons };
}

/** Statistiques complètes d'un produit à partir de ses observations. */
export function productStats(
  observations: ObservationInput[],
  now: Date = new Date()
): ProductStats {
  const valid = observations
    .filter((o) => o.price > 0 && o.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  const { confidence, confidenceReasons } = withReasons(valid, now);
  if (valid.length === 0) {
    return { count: 0, confidence, confidenceReasons };
  }

  const prices = valid.map((o) => o.price).sort((a, b) => a - b);
  const sales = valid.filter((o) => o.kind === "vente");
  const auctions = valid.filter((o) => o.kind === "enchere");
  // Prix suggérés : ventes conclues si assez nombreuses, sinon tout.
  const basis = (sales.length >= 3 ? sales.map((o) => o.price) : prices).sort(
    (a, b) => a - b
  );

  return {
    count: valid.length,
    avg: round(prices.reduce((s, x) => s + x, 0) / prices.length),
    min: prices[0],
    max: prices[prices.length - 1],
    median: percentile(prices, 0.5),
    last: valid[valid.length - 1],
    lastSale: sales[sales.length - 1],
    lastAuction: auctions[auctions.length - 1],
    suggestedFast: percentile(basis, 0.25),
    suggestedNormal: percentile(basis, 0.5),
    suggestedPremium: percentile(basis, 0.75),
    typicalAuctionPrice: auctions.length
      ? percentile(auctions.map((o) => o.price).sort((a, b) => a - b), 0.5)
      : undefined,
    trendPct: computeTrend(valid, now),
    confidence,
    confidenceReasons,
  };
}

function withReasons(valid: ObservationInput[], now: Date) {
  const { confidence, reasons } = computeConfidence(valid, now);
  return { confidence, confidenceReasons: reasons };
}

/** Tendance d'un groupe (catégorie…) : indice de marché ↗ / ↘ / ➡. */
export interface MarketIndexEntry {
  key: string;
  trendPct: number | undefined;
  count: number;
}

export function marketIndex(
  groups: Map<string, ObservationInput[]>,
  now: Date = new Date()
): MarketIndexEntry[] {
  return [...groups.entries()]
    .map(([key, obs]) => ({
      key,
      trendPct: computeTrend(obs, now),
      count: obs.length,
    }))
    .filter((e) => e.count > 0)
    .sort((a, b) => (b.trendPct ?? -Infinity) - (a.trendPct ?? -Infinity));
}

/**
 * Équipement / accessoire d'un produit avec sa plus-value.
 * Ex. Raspberry Pi : alimentation officielle +10 €, boîtier +10 €,
 * carte SD +10 €, refroidissement actif +8 €…
 */
export interface ProductAccessory {
  label: string;
  /** Plus-value sur le prix de revente, en €. */
  delta: number;
}

/** Somme des plus-values des équipements inclus dans un lot. */
export function accessoryBonus(
  accessories: ProductAccessory[],
  includedLabels: string[]
): number {
  const included = new Set(includedLabels);
  return accessories
    .filter((a) => included.has(a.label))
    .reduce((sum, a) => sum + a.delta, 0);
}

/** Applique la plus-value des équipements aux prix suggérés d'un produit. */
export function adjustSuggestions(
  stats: ProductStats,
  bonus: number
): Pick<ProductStats, "suggestedFast" | "suggestedNormal" | "suggestedPremium"> {
  const add = (v: number | undefined) => (v === undefined ? undefined : v + bonus);
  return {
    suggestedFast: add(stats.suggestedFast),
    suggestedNormal: add(stats.suggestedNormal),
    suggestedPremium: add(stats.suggestedPremium),
  };
}

/** Normalise un texte pour la mise en correspondance produit ↔ titre. */
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    // « 400mm » → « 400 mm », « f4 » → « f 4 » : les nombres deviennent des mots
    .replace(/(\d)([a-z])/g, "$1 $2")
    .replace(/([a-z])(\d)/g, "$1 $2")
    .trim();
}

/**
 * Un produit correspond-il à un titre d'annonce ?
 * Vrai si tous les mots significatifs du nom (ou d'un alias) sont présents.
 */
export function matchesTitle(
  title: string,
  productName: string,
  aliases: string[] = []
): boolean {
  const haystack = ` ${normalizeForMatch(title)} `;
  const candidates = [productName, ...aliases];
  return candidates.some((c) => {
    const words = normalizeForMatch(c)
      .split(" ")
      .filter((w) => w.length >= 2);
    return words.length > 0 && words.every((w) => haystack.includes(` ${w} `));
  });
}
