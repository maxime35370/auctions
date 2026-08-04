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

import { analyzeAuction, type AuctionInput, type Condition } from "@/lib/engine";
import { z } from "zod";

const STORAGE_KEY = "auction-intelligence:auctions:v1";

export type AuctionStatus =
  | "analysee"
  | "suivie"
  | "achetee"
  | "perdue"
  | "revendue";

/** Une enchère enregistrée (saisie + snapshot des calculs). */
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
  status?: AuctionStatus;
};

// ---------------------------------------------------------------------------
// Validation (zod) — utilisée pour l'import JSON et la lecture du stockage
// ---------------------------------------------------------------------------

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
  status: z
    .enum(["analysee", "suivie", "achetee", "perdue", "revendue"])
    .catch("analysee"),
  currentPrice: z.number().min(0).catch(0),
  buyerFeePct: z.number().min(0).max(100).catch(0),
  vatPct: z.number().min(0).max(100).catch(0),
  travelCost: z.number().min(0).catch(0),
  shippingCost: z.number().min(0).catch(0),
  condition: z
    .enum(["neuf", "tres-bon", "bon", "moyen", "a-reparer", "epave"])
    .catch("bon"),
  refurbHours: z.number().min(0).catch(0),
  resaleFast: z.number().min(0).catch(0),
  resaleNormal: z.number().min(0).catch(0),
  resaleOptimized: z.number().min(0).catch(0),
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

  const record: AuctionRecord = {
    ...draft,
    condition: draft.condition as Condition,
    status: draft.status ?? existing?.status ?? "analysee",
    id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
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
