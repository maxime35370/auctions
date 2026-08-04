/**
 * Schémas de validation des entrées API (zod).
 * Centralisés ici pour être partagés entre les routes et, plus tard,
 * d'éventuels imports automatiques (parsing d'URL, etc.).
 */
import { z } from "zod";
import { CATEGORIES } from "@/lib/engine";

const money = z.coerce.number().min(0).default(0);

export const auctionInputSchema = z.object({
  sourceUrl: z.string().url().optional().or(z.literal("")).transform((v) => v || undefined),
  title: z.string().min(1, "Le titre est obligatoire"),
  category: z.enum(CATEGORIES).catch("autre"),
  auctionHouse: z.string().optional(),
  location: z.string().optional(),
  currentPrice: money,
  buyerFeePct: z.coerce.number().min(0).max(100).default(0),
  vatPct: z.coerce.number().min(0).max(100).default(0),
  travelCost: money,
  shippingCost: money,
  condition: z
    .enum(["neuf", "tres-bon", "bon", "moyen", "a-reparer", "epave"])
    .default("bon"),
  refurbHours: z.coerce.number().min(0).default(0),
  comments: z.string().optional(),
  resaleFast: money,
  resaleNormal: money,
  resaleOptimized: money,
  status: z
    .enum(["analysee", "suivie", "achetee", "perdue", "revendue"])
    .default("analysee"),
});

export type AuctionPayload = z.infer<typeof auctionInputSchema>;
