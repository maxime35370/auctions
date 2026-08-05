/**
 * Transfert d'un brouillon d'analyse entre pages (ex. 🃏 Lot de cartes →
 * Nouvelle analyse) via sessionStorage — consommé une seule fois.
 */
import type { AuctionDraft } from "@/lib/storage";

const PENDING_DRAFT_KEY = "auction-intelligence:pending-draft";

export function setPendingDraft(draft: Partial<AuctionDraft>): void {
  sessionStorage.setItem(PENDING_DRAFT_KEY, JSON.stringify(draft));
}

/** Récupère puis efface le brouillon en attente (usage unique). */
export function takePendingDraft(): Partial<AuctionDraft> | null {
  try {
    const raw = sessionStorage.getItem(PENDING_DRAFT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PENDING_DRAFT_KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
