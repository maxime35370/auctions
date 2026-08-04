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
  type AuctionInput,
  type Condition,
} from "@/lib/engine";
import { z } from "zod";

const STORAGE_KEY = "auction-intelligence:auctions:v1";

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
};

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
  status: z
    .enum(["analysee", "suivie", "achetee", "perdue", "revendue"])
    .catch("analysee"),
  currentPrice: num(),
  buyerFeePct: num(100),
  vatPct: num(100),
  travelCost: num(),
  shippingCost: num(),
  minProfitTarget: z.number().min(0).catch(100),
  sellingFeePct: num(100),
  sellingMiscCost: num(),
  condition: z
    .enum(["neuf", "tres-bon", "bon", "moyen", "a-reparer", "epave"])
    .catch("bon"),
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

const exportFileSchema = z.object({
  app: z.literal("auction-intelligence"),
  version: z.number(),
  exportedAt: z.string().optional(),
  auctions: z.array(recordSchema),
});

// ---------------------------------------------------------------------------
// Lecture / écriture
// ---------------------------------------------------------------------------

function readAll(): AuctionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = z.array(recordSchema).safeParse(JSON.parse(raw));
    return parsed.success ? (parsed.data as AuctionRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: AuctionRecord[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

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

/** Met à jour le résultat réel : statut, prix d'adjudication, prix de revente. */
export function updateOutcome(
  id: string,
  outcome: { status: AuctionStatus; finalPrice: number | null; soldPrice: number | null }
): AuctionRecord | undefined {
  return update(id, outcome);
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

/** Sérialise toutes les données pour téléchargement. */
export function exportJson(): string {
  return JSON.stringify(
    {
      app: "auction-intelligence",
      version: 1,
      exportedAt: new Date().toISOString(),
      auctions: readAll(),
    },
    null,
    2
  );
}

/**
 * Importe un fichier d'export. Les enchères importées remplacent celles ayant
 * le même id ; les autres sont ajoutées. Renvoie le nombre importé.
 * Lève une erreur si le fichier n'est pas un export valide.
 */
export function importJson(text: string): number {
  const parsed = exportFileSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error("Fichier invalide : ce n'est pas un export Auction Intelligence.");
  }
  const incoming = parsed.data.auctions as AuctionRecord[];
  const current = new Map(readAll().map((a) => [a.id, a]));
  for (const record of incoming) current.set(record.id, record);
  writeAll([...current.values()]);
  return incoming.length;
}
