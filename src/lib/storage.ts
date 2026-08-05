/**
 * Couche de persistance — implémentation navigateur (localStorage).
 *
 * L'application est déployée en site statique (GitHub Pages) : les données
 * sont stockées dans le navigateur. Cette couche isole complètement le reste
 * de l'application du mode de stockage : le jour où un backend (SQLite/
 * PostgreSQL + API) est réintroduit, seul ce fichier change — les pages et
 * composants appellent uniquement les fonctions exportées ici.
 *
 * Les valeurs calculées (coût, ROI, score…) sont toujours recalculées par le
 * moteur au moment de l'enregistrement : le stockage n'est jamais la source
 * de vérité des règles métier.
 */

import {
  analyzeAuction,
  defaultChecklist,
  matchesTitle,
  type AuctionInput,
  type Condition,
} from "@/lib/engine";
import { z } from "zod";

const STORAGE_KEY = "auction-intelligence:auctions:v1";
const PRODUCTS_KEY = "auction-intelligence:products:v1";
const OBSERVATIONS_KEY = "auction-intelligence:observations:v1";

export type AuctionStatus =
  | "analysee"
  | "suivie"
  | "achetee"
  | "perdue"
  | "revendue";

export const STATUS_LABELS: Record<AuctionStatus, string> = {
  analysee: "Analysée",
  suivie: "Suivie",
  achetee: "Achetée",
  perdue: "Perdue",
  revendue: "Revendue",
};

/** Étapes du pipeline de revente d'un lot possédé (mini-CRM). */
export const PIPELINE_STEPS = [
  { key: "nettoye", label: "Nettoyé" },
  { key: "repare", label: "Réparé / vérifié" },
  { key: "photographie", label: "Photographié" },
  { key: "annonce", label: "Annoncé" },
  { key: "vendu", label: "Vendu" },
  { key: "expedie", label: "Expédié / remis" },
  { key: "termine", label: "Terminé" },
] as const;

export type PipelineStepKey = (typeof PIPELINE_STEPS)[number]["key"];

export interface ChecklistItem {
  label: string;
  done: boolean;
}

/** Une enchère enregistrée (saisie + snapshot des calculs + suivi). */
export interface AuctionRecord extends AuctionInput {
  id: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
  sourceUrl: string;
  title: string;
  auctionHouse: string;
  location: string;
  comments: string;
  status: AuctionStatus;
  /** Date de fin de l'enchère (YYYY-MM-DD, vide si inconnue). */
  endDate: string;
  /** URLs des photos du lot. */
  photos: string[];
  /** Points à vérifier avant d'enchérir (cochables). */
  checklist: ChecklistItem[];
  /** Étapes du pipeline de revente accomplies (lots possédés). */
  pipeline: PipelineStepKey[];
  /** Prix d'adjudication réel (si achetée / perdue). */
  finalPrice: number | null;
  /** Prix de revente réel (si revendue). */
  soldPrice: number | null;
  /** Fiche produit liée (base de connaissances), si identifiée. */
  productId: string | null;
  /** Équipements du produit inclus dans ce lot (labels cochés). */
  accessoriesIncluded: string[];
  // Snapshot du moteur (recalculé à chaque enregistrement)
  totalCost: number;
  maxBudget: number;
  potentialMargin: number;
  netProfit: number;
  roi: number;
  score: number;
}

/** Données saisies par l'utilisateur (sans métadonnées ni calculs). */
export type AuctionDraft = AuctionInput & {
  sourceUrl: string;
  title: string;
  auctionHouse: string;
  location: string;
  comments: string;
  endDate: string;
  photos: string[];
  status?: AuctionStatus;
  productId?: string | null;
  accessoriesIncluded?: string[];
};

// ---------------------------------------------------------------------------
// Base de connaissances : produits et ventes observées
// ---------------------------------------------------------------------------

/** Fiche produit — le « Wikipédia des objets ». */
export interface Product {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  brand: string;
  category: string;
  /** Autres façons de nommer le produit (pour la reconnaissance de titres). */
  aliases: string[];
  /** Prix neuf de référence (saisi manuellement). */
  priceNew: number | null;
  notes: string;
  /** Points à vérifier propres à ce produit (un par ligne). */
  checkPoints: string;
  /**
   * Équipements avec plus-value (ex. « Alimentation officielle » +10 €).
   * Cochés lot par lot dans l'analyse, ils ajustent l'estimation.
   */
  accessories: { label: string; delta: number }[];
}

export type ObservationSource =
  | "interencheres"
  | "leboncoin"
  | "ebay"
  | "marketplace"
  | "moi"
  | "autre";

export const OBSERVATION_SOURCES: { value: ObservationSource; label: string }[] = [
  { value: "interencheres", label: "Interencheres" },
  { value: "leboncoin", label: "Leboncoin" },
  { value: "ebay", label: "eBay" },
  { value: "marketplace", label: "Facebook Marketplace" },
  { value: "moi", label: "Ma propre transaction" },
  { value: "autre", label: "Autre" },
];

export const OBSERVATION_KINDS: { value: "vente" | "enchere" | "annonce"; label: string }[] = [
  { value: "vente", label: "Vente conclue" },
  { value: "enchere", label: "Adjudication (enchère)" },
  { value: "annonce", label: "Prix affiché (annonce)" },
];

/** Une vente / enchère / annonce observée, rattachée à un produit. */
export interface Observation {
  id: string;
  productId: string;
  date: string; // YYYY-MM-DD
  price: number;
  kind: "vente" | "enchere" | "annonce";
  source: ObservationSource;
  url: string;
  notes: string;
  /** Renseigné quand l'observation vient d'une de mes transactions. */
  auctionId: string | null;
  /**
   * Observation rejetée (arnaque, prix aberrant…) : conservée pour mémoire
   * mais exclue de toutes les statistiques.
   */
  rejected: boolean;
  rejectReason: string;
}

export const REJECT_REASONS = [
  "Prix aberrant",
  "Arnaque probable",
  "Produit différent",
  "Doublon",
  "Autre",
] as const;

// ---------------------------------------------------------------------------
// Validation (zod) — import JSON et lecture du stockage
// ---------------------------------------------------------------------------

const num = (max?: number) =>
  max ? z.number().min(0).max(max).catch(0) : z.number().min(0).catch(0);

const recordSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  sourceUrl: z.string().catch(""),
  title: z.string().min(1),
  category: z.string().catch("autre"),
  auctionHouse: z.string().catch(""),
  location: z.string().catch(""),
  comments: z.string().catch(""),
  endDate: z.string().catch(""),
  photos: z.array(z.string()).catch([]),
  checklist: z
    .array(z.object({ label: z.string(), done: z.boolean() }))
    .catch([]),
  pipeline: z
    .array(z.enum(PIPELINE_STEPS.map((s) => s.key) as [PipelineStepKey, ...PipelineStepKey[]]))
    .catch([]),
  finalPrice: z.number().nullable().catch(null),
  soldPrice: z.number().nullable().catch(null),
  productId: z.string().nullable().catch(null),
  accessoriesIncluded: z.array(z.string()).catch([]),
  status: z
    .enum(["analysee", "suivie", "achetee", "perdue", "revendue"])
    .catch("analysee"),
  currentPrice: num(),
  buyerFeePct: num(100),
  platformFeePct: num(100),
  vatPct: num(100),
  travelCost: num(),
  shippingCost: num(),
  minProfitTarget: z.number().min(0).catch(100),
  sellingFeePct: num(100),
  sellingMiscCost: num(),
  condition: z
    .enum(["neuf", "tres-bon", "bon", "moyen", "a-reparer", "epave"])
    .catch("bon"),
  lotOrigin: z.string().catch(""),
  refurbHours: num(),
  cleaningHours: num(),
  photoHours: num(),
  listingHours: num(),
  packingHours: num(),
  savHours: num(),
  resaleFast: num(),
  resaleNormal: num(),
  resaleOptimized: num(),
  totalCost: z.number().catch(0),
  maxBudget: z.number().catch(0),
  potentialMargin: z.number().catch(0),
  netProfit: z.number().catch(0),
  roi: z.number().catch(0),
  score: z.number().catch(0),
});

const productSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  name: z.string().min(1),
  brand: z.string().catch(""),
  category: z.string().catch("autre"),
  aliases: z.array(z.string()).catch([]),
  priceNew: z.number().nullable().catch(null),
  notes: z.string().catch(""),
  checkPoints: z.string().catch(""),
  accessories: z
    .array(z.object({ label: z.string().min(1), delta: z.number() }))
    .catch([]),
});

const observationSchema = z.object({
  id: z.string().min(1),
  productId: z.string().min(1),
  date: z.string(),
  price: z.number().min(0),
  kind: z.enum(["vente", "enchere", "annonce"]).catch("vente"),
  source: z
    .enum(["interencheres", "leboncoin", "ebay", "marketplace", "moi", "autre"])
    .catch("autre"),
  url: z.string().catch(""),
  notes: z.string().catch(""),
  auctionId: z.string().nullable().catch(null),
  rejected: z.boolean().catch(false),
  rejectReason: z.string().catch(""),
});

const exportFileSchema = z.object({
  app: z.literal("auction-intelligence"),
  version: z.number(),
  exportedAt: z.string().optional(),
  auctions: z.array(recordSchema),
  // Absents des exports v1 : valeurs par défaut pour rester rétro-compatible.
  products: z.array(productSchema).catch([]),
  observations: z.array(observationSchema).catch([]),
});

// ---------------------------------------------------------------------------
// Lecture / écriture
// ---------------------------------------------------------------------------

function readStore<T>(key: string, schema: z.ZodType<T>): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = z.array(schema).safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

function writeStore<T>(key: string, items: T[]): void {
  window.localStorage.setItem(key, JSON.stringify(items));
}

const readAll = () => readStore(STORAGE_KEY, recordSchema) as AuctionRecord[];
const writeAll = (records: AuctionRecord[]) => writeStore(STORAGE_KEY, records);

const readProducts = () => readStore(PRODUCTS_KEY, productSchema) as Product[];
const writeProducts = (items: Product[]) => writeStore(PRODUCTS_KEY, items);

const readObservations = () =>
  readStore(OBSERVATIONS_KEY, observationSchema) as Observation[];
const writeObservations = (items: Observation[]) =>
  writeStore(OBSERVATIONS_KEY, items);

function update(id: string, patch: Partial<AuctionRecord>): AuctionRecord | undefined {
  const records = readAll();
  const found = records.find((a) => a.id === id);
  if (!found) return undefined;
  const next = { ...found, ...patch, updatedAt: new Date().toISOString() };
  writeAll(records.map((a) => (a.id === id ? next : a)));
  return next;
}

/** Toutes les enchères, plus récentes en premier. */
export function listAuctions(): AuctionRecord[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getAuction(id: string): AuctionRecord | undefined {
  return readAll().find((a) => a.id === id);
}

/** Crée ou met à jour une enchère — recalcule systématiquement l'analyse. */
export function saveAuction(draft: AuctionDraft, id?: string): AuctionRecord {
  const analysis = analyzeAuction(draft);
  const now = new Date().toISOString();
  const records = readAll();
  const existing = id ? records.find((a) => a.id === id) : undefined;

  // La checklist suit la catégorie : régénérée si l'enchère est nouvelle ou
  // si la catégorie change (les cases cochées sont conservées sinon).
  const checklist =
    existing && existing.category === draft.category && existing.checklist.length
      ? existing.checklist
      : defaultChecklist(draft.category);

  const record: AuctionRecord = {
    ...draft,
    condition: draft.condition as Condition,
    status: draft.status ?? existing?.status ?? "analysee",
    id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    checklist,
    pipeline: existing?.pipeline ?? [],
    finalPrice: existing?.finalPrice ?? null,
    soldPrice: existing?.soldPrice ?? null,
    productId: draft.productId ?? existing?.productId ?? null,
    accessoriesIncluded:
      draft.accessoriesIncluded ?? existing?.accessoriesIncluded ?? [],
    totalCost: analysis.totalCost,
    maxBudget: analysis.maxBudget,
    potentialMargin: analysis.potentialMargin,
    netProfit: analysis.netProfit,
    roi: analysis.roi,
    score: analysis.score,
  };

  const next = existing
    ? records.map((a) => (a.id === existing.id ? record : a))
    : [...records, record];
  writeAll(next);
  return record;
}

export function deleteAuction(id: string): void {
  writeAll(readAll().filter((a) => a.id !== id));
}

/** Coche / décoche un point de la checklist de vérifications. */
export function toggleChecklistItem(id: string, index: number): AuctionRecord | undefined {
  const record = getAuction(id);
  if (!record || !record.checklist[index]) return record;
  const checklist = record.checklist.map((item, i) =>
    i === index ? { ...item, done: !item.done } : item
  );
  return update(id, { checklist });
}

/** Coche / décoche une étape du pipeline de revente. */
export function togglePipelineStep(id: string, step: PipelineStepKey): AuctionRecord | undefined {
  const record = getAuction(id);
  if (!record) return undefined;
  const pipeline = record.pipeline.includes(step)
    ? record.pipeline.filter((s) => s !== step)
    : [...record.pipeline, step];
  return update(id, { pipeline });
}

/**
 * Met à jour le résultat réel : statut, prix d'adjudication, prix de revente.
 * Si l'enchère est liée à un produit, la transaction alimente automatiquement
 * la base de connaissances (une adjudication et/ou une vente observée).
 */
export function updateOutcome(
  id: string,
  outcome: { status: AuctionStatus; finalPrice: number | null; soldPrice: number | null }
): AuctionRecord | undefined {
  const record = update(id, outcome);
  if (record?.productId) {
    const today = new Date().toISOString().slice(0, 10);
    if (
      record.finalPrice !== null &&
      (record.status === "achetee" || record.status === "revendue")
    ) {
      upsertTransactionObservation(record, "enchere", record.finalPrice, today);
    }
    if (record.soldPrice !== null && record.status === "revendue") {
      upsertTransactionObservation(record, "vente", record.soldPrice, today);
    }
  }
  return record;
}

/** Crée ou met à jour l'observation issue d'une de mes transactions. */
function upsertTransactionObservation(
  record: AuctionRecord,
  kind: "vente" | "enchere",
  price: number,
  date: string
): void {
  const all = readObservations();
  const existing = all.find((o) => o.auctionId === record.id && o.kind === kind);
  if (existing) {
    writeObservations(
      all.map((o) => (o.id === existing.id ? { ...o, price } : o))
    );
    return;
  }
  writeObservations([
    ...all,
    {
      id: crypto.randomUUID(),
      productId: record.productId!,
      date,
      price,
      kind,
      source: "moi",
      url: "",
      notes: `Ma transaction : ${record.title}`,
      auctionId: record.id,
      rejected: false,
      rejectReason: "",
    },
  ]);
}

// ---------------------------------------------------------------------------
// Produits (fiches) et observations — CRUD
// ---------------------------------------------------------------------------

export function listProducts(): Product[] {
  return readProducts().sort((a, b) => a.name.localeCompare(b.name));
}

export function getProduct(id: string): Product | undefined {
  return readProducts().find((p) => p.id === id);
}

export type ProductDraft = Omit<Product, "id" | "createdAt" | "updatedAt">;

export function saveProduct(draft: ProductDraft, id?: string): Product {
  const now = new Date().toISOString();
  const products = readProducts();
  const existing = id ? products.find((p) => p.id === id) : undefined;
  const product: Product = {
    ...draft,
    id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  writeProducts(
    existing
      ? products.map((p) => (p.id === existing.id ? product : p))
      : [...products, product]
  );
  return product;
}

/** Supprime un produit, ses observations, et détache les enchères liées. */
export function deleteProduct(id: string): void {
  writeProducts(readProducts().filter((p) => p.id !== id));
  writeObservations(readObservations().filter((o) => o.productId !== id));
  writeAll(
    readAll().map((a) => (a.productId === id ? { ...a, productId: null } : a))
  );
}

/** Observations d'un produit, plus récentes en premier. */
export function listObservations(productId: string): Observation[] {
  return readObservations()
    .filter((o) => o.productId === productId)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function allObservations(): Observation[] {
  return readObservations();
}

/** Observations actives d'un produit (les rejetées sont exclues des stats). */
export function activeObservations(productId: string): Observation[] {
  return readObservations().filter((o) => o.productId === productId && !o.rejected);
}

export type ObservationDraft = Omit<
  Observation,
  "id" | "auctionId" | "rejected" | "rejectReason"
> & {
  auctionId?: string | null;
};

export function addObservation(draft: ObservationDraft): Observation {
  const observation: Observation = {
    auctionId: null,
    rejected: false,
    rejectReason: "",
    ...draft,
    id: crypto.randomUUID(),
  };
  writeObservations([...readObservations(), observation]);
  return observation;
}

export function deleteObservation(id: string): void {
  writeObservations(readObservations().filter((o) => o.id !== id));
}

/** Rejette une observation (exclue des stats, conservée pour mémoire). */
export function rejectObservation(id: string, reason: string): void {
  writeObservations(
    readObservations().map((o) =>
      o.id === id ? { ...o, rejected: true, rejectReason: reason } : o
    )
  );
}

/** Réintègre une observation rejetée. */
export function restoreObservation(id: string): void {
  writeObservations(
    readObservations().map((o) =>
      o.id === id ? { ...o, rejected: false, rejectReason: "" } : o
    )
  );
}

/** Produits dont le nom (ou un alias) correspond au titre d'une annonce. */
export function suggestProductsForTitle(title: string): Product[] {
  if (!title.trim()) return [];
  return readProducts().filter((p) => matchesTitle(title, p.name, p.aliases));
}

/** Nombre d'enchères rattachées à un produit. */
export function auctionsForProduct(productId: string): AuctionRecord[] {
  return readAll().filter((a) => a.productId === productId);
}

// ---------------------------------------------------------------------------
// Portefeuille et statistiques (calculés à la volée depuis les données réelles)
// ---------------------------------------------------------------------------

export interface PortfolioStats {
  /** Nombre de lots possédés (achetés, pas encore revendus). */
  ownedCount: number;
  /** Capital engagé : somme des prix d'achat réels des lots possédés. */
  invested: number;
  /** Valeur estimée du stock (revente normale des lots possédés). */
  stockValue: number;
  /** Bénéfice latent = valeur du stock − capital engagé. */
  latentProfit: number;
  /** Bénéfice réalisé : somme (prix de revente réel − coût réel) des lots revendus. */
  realizedProfit: number;
  /** Nombre de ventes terminées. */
  soldCount: number;
}

/** Coût d'achat réel d'un lot : prix d'adjudication saisi, sinon coût estimé. */
function realCost(a: AuctionRecord): number {
  if (a.finalPrice === null) return a.totalCost;
  // Le prix d'adjudication réel remplace le prix marteau estimé ; les frais
  // (acheteur, TVA, déplacement, livraison) s'appliquent de la même façon.
  const fee = a.finalPrice * (a.buyerFeePct / 100);
  const vat = (a.finalPrice + fee) * (a.vatPct / 100);
  return a.finalPrice + fee + vat + a.travelCost + a.shippingCost;
}

export function portfolioStats(records: AuctionRecord[]): PortfolioStats {
  const owned = records.filter((a) => a.status === "achetee");
  const sold = records.filter((a) => a.status === "revendue");

  const invested = owned.reduce((s, a) => s + realCost(a), 0);
  const stockValue = owned.reduce((s, a) => s + a.resaleNormal, 0);
  const realizedProfit = sold.reduce(
    (s, a) => s + (a.soldPrice ?? a.resaleNormal) - realCost(a),
    0
  );

  return {
    ownedCount: owned.length,
    invested,
    stockValue,
    latentProfit: stockValue - invested,
    realizedProfit,
    soldCount: sold.length,
  };
}

/** Bénéfice réalisé par catégorie (podium des catégories gagnantes). */
export function realizedByCategory(
  records: AuctionRecord[]
): { category: string; profit: number; count: number }[] {
  const map = new Map<string, { profit: number; count: number }>();
  for (const a of records) {
    if (a.status !== "revendue") continue;
    const entry = map.get(a.category) ?? { profit: 0, count: 0 };
    entry.profit += (a.soldPrice ?? a.resaleNormal) - realCost(a);
    entry.count += 1;
    map.set(a.category, entry);
  }
  return [...map.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.profit - a.profit);
}

/** Enchères suivies dont la date de fin approche (aujourd'hui + `days` jours). */
export function endingSoon(records: AuctionRecord[], days = 3): AuctionRecord[] {
  const today = new Date().toISOString().slice(0, 10);
  const limit = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  return records
    .filter(
      (a) =>
        a.endDate &&
        a.endDate >= today &&
        a.endDate <= limit &&
        (a.status === "analysee" || a.status === "suivie")
    )
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
}

// ---------------------------------------------------------------------------
// Sauvegarde / restauration (export–import JSON)
// ---------------------------------------------------------------------------

/** Sérialise toutes les données (enchères, produits, observations). */
export function exportJson(): string {
  return JSON.stringify(
    {
      app: "auction-intelligence",
      version: 2,
      exportedAt: new Date().toISOString(),
      auctions: readAll(),
      products: readProducts(),
      observations: readObservations(),
    },
    null,
    2
  );
}

/**
 * Importe un fichier d'export (v1 ou v2). Les éléments de même id sont
 * remplacés, les autres ajoutés. Renvoie le nombre d'éléments importés.
 */
export function importJson(text: string): number {
  const parsed = exportFileSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error("Fichier invalide : ce n'est pas un export Auction Intelligence.");
  }

  const mergeById = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
    const map = new Map(current.map((x) => [x.id, x]));
    for (const item of incoming) map.set(item.id, item);
    return [...map.values()];
  };

  const { auctions, products, observations } = parsed.data;
  writeAll(mergeById(readAll(), auctions as AuctionRecord[]));
  writeProducts(mergeById(readProducts(), products as Product[]));
  writeObservations(mergeById(readObservations(), observations as Observation[]));
  return auctions.length + products.length + observations.length;
}
