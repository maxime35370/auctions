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

// ---------------------------------------------------------------------------
// Provenance et maturité — la graduation heuristique → estimé → mesuré
// ---------------------------------------------------------------------------

/**
 * Sur quoi repose une information :
 *  - 🟢 mesure      : ≥ 30 points de données réels ;
 *  - 🟡 estime      : 10 à 29 points de données ;
 *  - 🔴 heuristique : valeur prédéfinie, faute de données.
 * Les heuristiques disparaissent automatiquement quand les données arrivent —
 * aucune règle à modifier à la main.
 */
export type Provenance = "mesure" | "estime" | "heuristique";

export const PROVENANCE_THRESHOLDS = { estime: 10, mesure: 30 };

export function provenanceFor(sampleSize: number): Provenance {
  if (sampleSize >= PROVENANCE_THRESHOLDS.mesure) return "mesure";
  if (sampleSize >= PROVENANCE_THRESHOLDS.estime) return "estime";
  return "heuristique";
}

/** Taux de maturité des données d'un produit (0–100). */
export interface DataMaturity {
  score: number;
  level: "fiable" | "partiel" | "insuffisant";
  observations: number;
  sales: number;
  myTransactions: number;
}

/**
 * Maturité = volume d'observations (≤ 50 pts) + ventes conclues (≤ 30 pts)
 * + transactions personnelles (≤ 20 pts). ≥ 70 : fiable ; ≥ 30 : partiel.
 */
export function dataMaturity(observations: ExtendedObservation[]): DataMaturity {
  const sales = observations.filter((o) => o.kind === "vente").length;
  const myTransactions = new Set(
    observations.filter((o) => o.auctionId).map((o) => o.auctionId)
  ).size;
  const score = Math.min(
    100,
    Math.min(50, observations.length) +
      Math.min(30, sales * 2) +
      Math.min(20, myTransactions * 5)
  );
  return {
    score,
    level: score >= 70 ? "fiable" : score >= 30 ? "partiel" : "insuffisant",
    observations: observations.length,
    sales,
    myTransactions,
  };
}

/**
 * Popularité MESURÉE d'un produit : volume d'observations sur 12 mois
 * (la demande laisse des traces) + fraîcheur. Remplace la table par
 * catégorie dès que l'échantillon suffit (provenance ≥ estimé).
 * Barème documenté : 30 pts de base avec données + jusqu'à 65 pts de volume
 * (plafond à 50 observations/12 mois) → maximum 95.
 */
export function measuredPopularity(
  observations: ExtendedObservation[],
  now: Date = new Date()
): { score: number; provenance: Provenance; recentCount: number } {
  const recentCount = observations.filter(
    (o) => now.getTime() - new Date(o.date).getTime() <= 365 * DAY
  ).length;
  const provenance = provenanceFor(recentCount);
  const score =
    provenance === "heuristique"
      ? 0
      : Math.round(Math.min(95, 30 + 65 * Math.min(1, recentCount / 50)));
  return { score, provenance, recentCount };
}

/**
 * Probabilités MESURÉES des scénarios de revente, à partir des délais réels
 * de MES transactions (adjudication → vente) :
 * rapide = part vendue ≤ 10 j ; normal = ≤ 30 j ; optimisé = ≤ 90 j.
 * Nécessite ≥ 5 délais (estimé), ≥ 15 (mesuré).
 */
export interface MeasuredProbabilities {
  sampleSize: number;
  /** Jamais heuristique : la fonction renvoie undefined sans données. */
  provenance: "mesure" | "estime";
  rapidePct: number;
  normalPct: number;
  optimisePct: number;
  avgDays: number;
}

export function measuredProbabilities(
  observations: ExtendedObservation[]
): MeasuredProbabilities | undefined {
  const delays = saleDelays(observations);
  if (delays.length < 5) return undefined;
  const share = (limit: number) =>
    Math.round((delays.filter((d) => d <= limit).length / delays.length) * 1000) / 10;
  return {
    sampleSize: delays.length,
    provenance: delays.length >= 15 ? "mesure" : "estime",
    rapidePct: share(10),
    normalPct: share(30),
    optimisePct: share(90),
    avgDays: Math.round(delays.reduce((s, d) => s + d, 0) / delays.length),
  };
}

/** Délais adjudication → vente de mes transactions (jours). */
function saleDelays(observations: ExtendedObservation[]): number[] {
  const byAuction = new Map<string, { bought?: string; sold?: string }>();
  for (const o of observations) {
    if (!o.auctionId) continue;
    const entry = byAuction.get(o.auctionId) ?? {};
    if (o.kind === "enchere") entry.bought = o.date;
    if (o.kind === "vente") entry.sold = o.date;
    byAuction.set(o.auctionId, entry);
  }
  const delays: number[] = [];
  for (const { bought, sold } of byAuction.values()) {
    if (!bought || !sold) continue;
    const days = (new Date(sold).getTime() - new Date(bought).getTime()) / DAY;
    if (days >= 0) delays.push(days);
  }
  return delays;
}

/** Statistiques réelles par plateforme (comparateur mesuré). */
export interface PlatformStat {
  source: string;
  count: number;
  avg: number;
  median: number;
}

export function platformStats(
  observations: ExtendedObservation[]
): PlatformStat[] {
  const bySource = new Map<string, number[]>();
  for (const o of observations) {
    if (!o.source || o.source === "moi" || o.price <= 0) continue;
    const list = bySource.get(o.source) ?? [];
    list.push(o.price);
    bySource.set(o.source, list);
  }
  return [...bySource.entries()]
    .filter(([, prices]) => prices.length >= 2)
    .map(([source, prices]) => {
      const sorted = [...prices].sort((a, b) => a - b);
      return {
        source,
        count: prices.length,
        avg: round(prices.reduce((s, x) => s + x, 0) / prices.length),
        median: percentile(sorted, 0.5),
      };
    })
    .sort((a, b) => b.avg - a.avg);
}

/**
 * « Pourquoi je recommande (ou non) cet achat ? » — uniquement des faits
 * mesurés sur les données ; jamais d'opinion.
 */
export function explainRecommendation(args: {
  currentPrice: number;
  stats: ProductStats;
  zones?: OpportunityZones;
  stability?: PriceStability;
  performance?: MyVsMarket;
  saleDelay?: { avgDays: number; count: number };
}): { positives: string[]; negatives: string[] } {
  const { currentPrice, stats, zones, stability, performance, saleDelay } = args;
  const positives: string[] = [];
  const negatives: string[] = [];

  if (stats.median !== undefined && currentPrice > 0) {
    const diff = Math.round(((currentPrice - stats.median) / stats.median) * 100);
    if (diff <= -5) positives.push(`Prix ${-diff} % sous la médiane du marché`);
    else if (diff >= 10) negatives.push(`Prix ${diff} % au-dessus de la médiane`);
  }
  if (zones && currentPrice > 0) {
    if (currentPrice <= zones.opportunityPrice)
      positives.push("Dans la zone d'opportunité (meilleurs 15 % des prix observés)");
    else if (currentPrice > zones.fairPrice)
      negatives.push("Au-dessus de la zone d'achat intéressante");
  }
  if (stats.count >= PROVENANCE_THRESHOLDS.estime)
    positives.push(`Objet observé ${stats.count} fois — données exploitables`);
  else if (stats.count > 0)
    negatives.push(`Seulement ${stats.count} observation(s) — prudence`);
  if (saleDelay)
    positives.push(
      `Mon temps moyen de revente : ${saleDelay.avgDays} j (${saleDelay.count} transaction(s))`
    );
  if (stability) {
    if (stability.label === "stable") positives.push("Prix stables sur le marché (faible dispersion)");
    if (stability.label === "tres-variable")
      negatives.push(`Prix très variables (±${stability.cvPct.toFixed(0)} %) — revente incertaine`);
  }
  if (performance && performance.diffPct >= 5)
    positives.push(
      `Bon historique personnel : je revends +${performance.diffPct.toFixed(0)} % vs le marché`
    );

  return { positives, negatives };
}

/**
 * Confiance dans la RECOMMANDATION — distincte du score de l'affaire.
 * Un objet peut être excellent (score 92/100) avec des données très faibles
 * (confiance 25 %), et inversement.
 *
 *  - Produit lié avec données : 80 % confiance des données produit
 *    + 20 % complétude de la saisie ;
 *  - Sans données produit : plafonnée à 40 % (estimations personnelles).
 */
export function recommendationConfidence(
  inputCompleteness: number,
  productConfidence?: number,
  /** Pénalité liée à l'origine du lot (retour client −12, SAV −18…). */
  originPenalty = 0
): { value: number; basis: string } {
  const applyPenalty = (v: number) => Math.max(5, v - originPenalty);
  if (productConfidence !== undefined) {
    return {
      value: applyPenalty(
        Math.round(productConfidence * 0.8 + inputCompleteness * 0.2)
      ),
      basis:
        originPenalty > 0
          ? `basée sur les observations réelles du produit (−${originPenalty} pts : origine du lot risquée)`
          : "basée sur les observations réelles du produit",
    };
  }
  return {
    value: applyPenalty(Math.round(Math.min(40, inputCompleteness * 0.4))),
    basis:
      "basée sur vos estimations uniquement — liez une fiche produit pour l'augmenter",
  };
}

/**
 * « Pourquoi ce prix d'opportunité ? » — l'explication en faits mesurés :
 * part des ventes au-dessus du seuil, tendance, performance personnelle,
 * délai moyen. L'application explique, l'utilisateur décide.
 */
export function explainOpportunity(args: {
  zones: OpportunityZones;
  observations: ObservationInput[];
  trendPct?: number;
  performance?: MyVsMarket;
  saleDelay?: { avgDays: number; count: number };
}): string[] {
  const { zones, observations, trendPct, performance, saleDelay } = args;
  const reasons: string[] = [];

  const prices = observations.filter((o) => o.price > 0).map((o) => o.price);
  if (prices.length > 0) {
    const above = prices.filter((p) => p > zones.opportunityPrice).length;
    reasons.push(
      `${Math.round((above / prices.length) * 100)} % des prix observés sont au-dessus de ce seuil`
    );
  }
  if (trendPct !== undefined) {
    if (trendPct >= 3)
      reasons.push(`Les prix montent (+${trendPct.toFixed(0)} % sur 6 mois)`);
    else if (trendPct <= -3)
      reasons.push(`Les prix baissent (${trendPct.toFixed(0)} % sur 6 mois) — prudence`);
    else reasons.push("Prix stables sur les 6 derniers mois");
  }
  if (performance && Math.abs(performance.diffPct) >= 3) {
    reasons.push(
      performance.diffPct > 0
        ? `Tu revends généralement ${performance.diffPct.toFixed(0)} % au-dessus de la médiane`
        : `Tu revends généralement ${(-performance.diffPct).toFixed(0)} % sous la médiane — vise plus bas`
    );
  }
  if (saleDelay) reasons.push(`Ton délai moyen de revente : ${saleDelay.avgDays} jours`);

  return reasons;
}

// ---------------------------------------------------------------------------
// Moteur statistique : prix d'opportunité, stabilité, mes performances
// ---------------------------------------------------------------------------

/** Observation enrichie (source + lien transaction) pour les stats avancées. */
export interface ExtendedObservation extends ObservationInput {
  source?: string;
  auctionId?: string | null;
}

/**
 * 🎯 Prix d'opportunité — répond à « à partir de quel prix j'achète ? ».
 *
 * Zones calculées sur les prix observés (adjudications si ≥ 5, sinon tout) :
 *  - excellente affaire : sous le percentile 15 ;
 *  - intéressant : entre p15 et p40 ;
 *  - marge faible : au-dessus de p40.
 * Les seuils sont des paramètres — ajustables avec l'expérience.
 */
export interface OpportunityZones {
  /** Sous ce prix : excellente affaire (p15). */
  opportunityPrice: number;
  /** Jusqu'à ce prix : encore intéressant (p40). */
  fairPrice: number;
  /** Base de calcul utilisée. */
  basis: "adjudications" | "toutes-observations";
  sampleSize: number;
}

export function opportunityZones(
  observations: ExtendedObservation[],
  pOpportunity = 0.15,
  pFair = 0.4
): OpportunityZones | undefined {
  const valid = observations.filter((o) => o.price > 0);
  if (valid.length < 3) return undefined;
  const auctions = valid.filter((o) => o.kind === "enchere");
  const useAuctions = auctions.length >= 5;
  const prices = (useAuctions ? auctions : valid)
    .map((o) => o.price)
    .sort((a, b) => a - b);
  return {
    opportunityPrice: percentile(prices, pOpportunity),
    fairPrice: percentile(prices, pFair),
    basis: useAuctions ? "adjudications" : "toutes-observations",
    sampleSize: prices.length,
  };
}

/** Position d'un prix d'achat dans les zones d'opportunité. */
export function opportunityVerdict(
  price: number,
  zones: OpportunityZones
): { level: "excellent" | "interessant" | "faible"; label: string } {
  if (price <= zones.opportunityPrice)
    return { level: "excellent", label: "🎯 Zone d'opportunité — excellente affaire" };
  if (price <= zones.fairPrice)
    return { level: "interessant", label: "🟡 Prix intéressant" };
  return { level: "faible", label: "🔴 Au-dessus du marché — marge faible" };
}

/** Stabilité du marché : écart-type et coefficient de variation. */
export interface PriceStability {
  stdDev: number;
  /** Coefficient de variation (écart-type / moyenne), en %. */
  cvPct: number;
  label: "stable" | "variable" | "tres-variable";
}

export function priceStability(
  observations: ObservationInput[]
): PriceStability | undefined {
  const prices = observations.filter((o) => o.price > 0).map((o) => o.price);
  if (prices.length < 3) return undefined;
  const avg = prices.reduce((s, x) => s + x, 0) / prices.length;
  const stdDev = Math.sqrt(
    prices.reduce((s, x) => s + (x - avg) ** 2, 0) / prices.length
  );
  const cvPct = round((stdDev / avg) * 100);
  return {
    stdDev: round(stdDev),
    cvPct,
    label: cvPct < 15 ? "stable" : cvPct < 30 ? "variable" : "tres-variable",
  };
}

/**
 * Mes performances vs le marché : mes prix de vente (source « moi »)
 * comparés à la médiane des ventes observées ailleurs.
 * → « Je revends les Raspberry Pi 12 % plus cher que la moyenne. »
 */
export interface MyVsMarket {
  myAvgSale: number;
  marketMedianSale: number;
  diffPct: number;
  mySaleCount: number;
  marketSaleCount: number;
}

export function myVsMarket(
  observations: ExtendedObservation[]
): MyVsMarket | undefined {
  const sales = observations.filter((o) => o.kind === "vente" && o.price > 0);
  const mine = sales.filter((o) => o.source === "moi");
  const market = sales.filter((o) => o.source !== "moi");
  if (mine.length === 0 || market.length < 2) return undefined;

  const myAvg = mine.reduce((s, o) => s + o.price, 0) / mine.length;
  const marketMedian = percentile(
    market.map((o) => o.price).sort((a, b) => a - b),
    0.5
  );
  if (marketMedian <= 0) return undefined;
  return {
    myAvgSale: round(myAvg),
    marketMedianSale: marketMedian,
    diffPct: round(((myAvg - marketMedian) / marketMedian) * 100),
    mySaleCount: mine.length,
    marketSaleCount: market.length,
  };
}

/**
 * ⚡ Temps moyen de revente, calculé sur MES transactions : pour chaque
 * enchère (auctionId), délai entre l'adjudication et la vente.
 */
export function averageSaleDelay(
  observations: ExtendedObservation[]
): { avgDays: number; count: number } | undefined {
  const delays = saleDelays(observations);
  if (delays.length === 0) return undefined;
  return {
    avgDays: Math.round(delays.reduce((s, d) => s + d, 0) / delays.length),
    count: delays.length,
  };
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
