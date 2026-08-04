/**
 * Pont avec l'extension Chrome « Analyser cette enchère ».
 *
 * L'extension extrait le contenu de la page d'annonce (métadonnées, JSON-LD,
 * texte, photos) et ouvre l'application sur
 * `/analyse#ext-import=<base64url(JSON)>`. Le fragment d'URL (#…) n'est
 * JAMAIS envoyé à un serveur : les données restent entièrement locales.
 *
 * Côté application, le payload est décodé puis passe par les MÊMES
 * connecteurs que les autres modes d'import — l'extension n'est qu'une
 * troisième voie d'acquisition (URL directe, presse-papiers, extension).
 */

import type { StandardAuctionData } from "./types";

/**
 * Champs déjà extraits par l'extension, directement sur la page.
 * L'extension envoie un JSON compact et nettoyé — jamais la page brute.
 */
export interface ExtensionFields {
  title?: string;
  description?: string;
  currentPrice?: number;
  buyerFeePct?: number;
  location?: string;
  auctionHouse?: string;
  /** YYYY-MM-DD */
  endDate?: string;
  condition?: string;
  /** Nombre d'unités détecté (« Lot de 3 … »). */
  quantity?: number;
}

/** Données envoyées par l'extension (format versionné, v1 accepté). */
export interface ExtensionPayload {
  v: 1 | 2;
  /** URL de la page d'annonce. */
  url: string;
  /** document.title de la page. */
  title: string;
  /** Balises <meta>, <title> et scripts JSON-LD (HTML brut, plafonné). */
  meta: string;
  /** Extrait de texte visible (plafonné — sert de filet aux connecteurs). */
  text: string;
  /** URLs des images principales de la page (≤ 6). */
  photos: string[];
  /** v2 : champs structurés extraits sur la page par l'extension. */
  fields?: ExtensionFields;
}

/** Préfixe du fragment : import d'une enchère (→ /analyse). */
export const EXT_IMPORT_HASH_PREFIX = "#ext-import=";
/** Préfixe du fragment : étude de marché (→ /objets). */
export const EXT_MARKET_HASH_PREFIX = "#ext-market=";

// --- Base64 URL-safe (Unicode) ---------------------------------------------

export function encodeExtensionPayload(payload: ExtensionPayload): string {
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeExtensionPayload(
  fragment: string,
  prefix: string = EXT_IMPORT_HASH_PREFIX
): ExtensionPayload | null {
  if (!fragment.startsWith(prefix)) return null;
  try {
    let b64 = fragment
      .slice(prefix.length)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if ((parsed?.v !== 1 && parsed?.v !== 2) || typeof parsed.url !== "string")
      return null;
    const f = parsed.fields ?? {};
    const str = (x: unknown) => (typeof x === "string" ? x : undefined);
    const num = (x: unknown) =>
      typeof x === "number" && Number.isFinite(x) ? x : undefined;
    return {
      v: parsed.v,
      url: parsed.url,
      title: typeof parsed.title === "string" ? parsed.title : "",
      meta: typeof parsed.meta === "string" ? parsed.meta : "",
      text: typeof parsed.text === "string" ? parsed.text : "",
      photos: Array.isArray(parsed.photos)
        ? parsed.photos.filter((p: unknown): p is string => typeof p === "string")
        : [],
      fields:
        parsed.v === 2
          ? {
              title: str(f.title),
              description: str(f.description),
              currentPrice: num(f.currentPrice),
              buyerFeePct: num(f.buyerFeePct),
              location: str(f.location),
              auctionHouse: str(f.auctionHouse),
              endDate: str(f.endDate),
              condition: str(f.condition),
              quantity: num(f.quantity),
            }
          : undefined,
    };
  } catch {
    return null;
  }
}

// --- Reconstruction d'un HTML analysable par les connecteurs ----------------

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Reconstruit un document HTML minimal : les métadonnées telles quelles
 * (elles seront parsées par DOMParser) + le texte visible échappé.
 */
export function payloadToHtml(payload: ExtensionPayload): string {
  return `<html><head><title>${escapeHtml(payload.title)}</title>\n${payload.meta}\n</head><body>${escapeHtml(payload.text)}</body></html>`;
}

/** Champs que l'extension fournit directement, prioritaires sur l'extraction. */
export function payloadDirectFields(
  payload: ExtensionPayload
): Partial<StandardAuctionData> {
  const f = payload.fields;
  return {
    sourceUrl: payload.url,
    photos: payload.photos.length ? payload.photos : undefined,
    title: f?.title,
    description: appendQuantity(f?.description, f?.quantity),
    currentPrice: f?.currentPrice,
    buyerFeePct: f?.buyerFeePct,
    location: f?.location,
    auctionHouse: f?.auctionHouse,
    endDate: f?.endDate,
    rawCondition: f?.condition,
  };
}

/** La quantité détectée (« Lot de 3 ») est notée en commentaire. */
function appendQuantity(
  description: string | undefined,
  quantity: number | undefined
): string | undefined {
  if (!quantity || quantity < 2) return description;
  const note = `Quantité détectée : ${quantity} unités.`;
  return description ? `${note}\n${description}` : note;
}
