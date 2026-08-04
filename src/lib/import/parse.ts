/**
 * Helpers d'extraction — fonctions pures sur du texte / HTML.
 *
 * Toute l'« intelligence » d'extraction vit ici pour être testable
 * unitairement sans navigateur ni site externe. Les connecteurs composent
 * ces briques.
 */

import type { StandardAuctionData } from "./types";

// ---------------------------------------------------------------------------
// Nombres, prix, pourcentages
// ---------------------------------------------------------------------------

/** Convertit « 1 234,56 » / "1.234,56" / "1234.56" en nombre. */
export function parseFrenchNumber(raw: string): number | undefined {
  const cleaned = raw
    .replace(/[\s  ]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // points de milliers
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Cherche un prix en € proche d'un des mots-clés donnés.
 * Ex. « Enchère actuelle : 1 250 € » → 1250.
 */
export function findPriceNear(text: string, keywords: string[]): number | undefined {
  for (const kw of keywords) {
    const re = new RegExp(
      `${kw}[^0-9€]{0,40}?(\\d[\\d\\s\\u00a0\\u202f.,]*)\\s*€`,
      "i"
    );
    const m = text.match(re);
    if (m) {
      const n = parseFrenchNumber(m[1]);
      if (n !== undefined && n > 0) return n;
    }
  }
  return undefined;
}

/** Premier montant en € du texte (dernier recours). */
export function findAnyPrice(text: string): number | undefined {
  const m = text.match(/(\d[\d\s  .,]*)\s*€/);
  return m ? parseFrenchNumber(m[1]) : undefined;
}

/** Frais acheteur : « frais … 24 % » / « 24% TTC de frais ». */
export function findBuyerFeePct(text: string): number | undefined {
  const patterns = [
    /frais[^%]{0,60}?(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i,
    /(\d{1,2}(?:[.,]\d{1,2})?)\s*%[^.]{0,30}frais/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = parseFrenchNumber(m[1]);
      if (n !== undefined && n > 0 && n <= 50) return n;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const FRENCH_MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** « 12 août 2026 » ou « 12/08/2026 » → « 2026-08-12 ». */
export function parseFrenchDate(raw: string): string | undefined {
  const text = stripAccents(raw.toLowerCase());

  const textual = text.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (textual) {
    const month = FRENCH_MONTHS[textual[2]];
    if (month) {
      return `${textual[3]}-${String(month).padStart(2, "0")}-${textual[1].padStart(2, "0")}`;
    }
  }

  const numeric = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (numeric) {
    return `${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
  }

  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];

  return undefined;
}

/** Date de fin proche des mots-clés « fin / clôture / se termine ». */
export function findEndDate(text: string): string | undefined {
  const m = text.match(
    /(?:fin|cl[oô]ture|se termine|jusqu'au)[^\n]{0,60}?(\d{1,2}\s+\p{L}+\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/iu
  );
  return m ? parseFrenchDate(m[1]) : undefined;
}

// ---------------------------------------------------------------------------
// HTML : OpenGraph, JSON-LD, photos
// ---------------------------------------------------------------------------

/** Parse le HTML avec le DOM du navigateur (ou renvoie null hors navigateur). */
export function toDocument(html: string): Document | null {
  if (typeof DOMParser === "undefined") return null;
  return new DOMParser().parseFromString(html, "text/html");
}

/** Contenu des balises <meta property="og:*"> utiles. */
export function extractOpenGraph(doc: Document): Partial<StandardAuctionData> {
  const meta = (prop: string) =>
    doc
      .querySelector(`meta[property="${prop}"], meta[name="${prop}"]`)
      ?.getAttribute("content") ?? undefined;

  const images = [...doc.querySelectorAll('meta[property="og:image"]')]
    .map((m) => m.getAttribute("content"))
    .filter((u): u is string => !!u);

  return {
    title: meta("og:title") ?? doc.querySelector("title")?.textContent?.trim(),
    description: meta("og:description") ?? meta("description"),
    photos: images.length ? images : undefined,
    auctionHouse: meta("og:site_name"),
  };
}

interface JsonLdNode {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  image?: string | string[] | { url?: string }[];
  offers?: { price?: number | string; priceCurrency?: string } | { price?: number | string }[];
  [key: string]: unknown;
}

/** Extrait les données Product/Offer des blocs JSON-LD (schema.org). */
export function extractJsonLd(doc: Document): Partial<StandardAuctionData> {
  const result: Partial<StandardAuctionData> = {};
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed = JSON.parse(script.textContent ?? "");
      const nodes: JsonLdNode[] = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes.flatMap((n) =>
        Array.isArray((n as { "@graph"?: JsonLdNode[] })["@graph"])
          ? (n as { "@graph": JsonLdNode[] })["@graph"]
          : [n]
      )) {
        const type = Array.isArray(node["@type"]) ? node["@type"].join(" ") : node["@type"];
        if (!type || !/Product|Offer|Event/i.test(type)) continue;
        if (node.name && !result.title) result.title = String(node.name);
        if (node.description && !result.description)
          result.description = String(node.description);
        const images = Array.isArray(node.image) ? node.image : node.image ? [node.image] : [];
        const urls = images
          .map((i) => (typeof i === "string" ? i : (i as { url?: string }).url))
          .filter((u): u is string => !!u);
        if (urls.length && !result.photos) result.photos = urls;
        const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
        if (offers?.price !== undefined && result.currentPrice === undefined) {
          const p = typeof offers.price === "number" ? offers.price : parseFrenchNumber(offers.price);
          if (p !== undefined) result.currentPrice = p;
        }
      }
    } catch {
      // JSON-LD invalide : on ignore ce bloc.
    }
  }
  return result;
}

/** Grandes images du document (fallback si pas d'OpenGraph/JSON-LD). */
export function extractImages(doc: Document, baseUrl?: string): string[] {
  const urls = new Set<string>();
  for (const img of doc.querySelectorAll("img[src]")) {
    const src = img.getAttribute("src") ?? "";
    if (/logo|icon|sprite|avatar|pixel/i.test(src)) continue;
    if (!/\.(jpe?g|png|webp)(\?|$)/i.test(src)) continue;
    try {
      urls.add(baseUrl ? new URL(src, baseUrl).href : src);
    } catch {
      // URL invalide : ignorée
    }
    if (urls.size >= 8) break;
  }
  return [...urls];
}

// ---------------------------------------------------------------------------
// Texte libre (mode presse-papiers)
// ---------------------------------------------------------------------------

/** Mots typiques de la navigation / des en-têtes de site (à éviter en titre). */
const BOILERPLATE =
  /vente aux ench[eè]res|interencheres|agorastore|cookies|se connecter|mon compte|recherche|menu|accueil/i;

/**
 * Devine le titre du lot parmi les premières lignes : on privilégie une ligne
 * descriptive (« Lot de… », présence de chiffres/modèle) et on écarte les
 * en-têtes de site.
 */
function guessTitle(lines: string[]): string | undefined {
  const candidates = lines
    .filter((l) => l.length >= 10 && l.length <= 140 && !l.startsWith("http"))
    .slice(0, 12);

  let best: string | undefined;
  let bestScore = -Infinity;
  for (const line of candidates) {
    let score = Math.min(line.length, 80) / 20;
    if (/\blot\b|n[°º]/i.test(line)) score += 3;
    if (/\d/.test(line)) score += 1;
    if (BOILERPLATE.test(line)) score -= 6;
    if (score > bestScore) {
      bestScore = score;
      best = line;
    }
  }
  return best;
}

/** Extraction best-effort depuis du texte libre collé par l'utilisateur. */
export function extractFromText(text: string): Partial<StandardAuctionData> {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return {
    title: guessTitle(lines),
    currentPrice:
      findPriceNear(text, [
        "ench[eè]re actuelle", "prix actuel", "derni[eè]re ench[eè]re",
        "mise [aà] prix", "prix de d[eé]part", "estimation",
      ]) ?? findAnyPrice(text),
    buyerFeePct: findBuyerFeePct(text),
    endDate: findEndDate(text),
    photos: [...text.matchAll(/https?:\/\/\S+\.(?:jpe?g|png|webp)\S*/gi)]
      .map((m) => m[0])
      .slice(0, 8),
  };
}
