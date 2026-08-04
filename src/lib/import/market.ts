/**
 * 📊 Étude de marché — extraction en masse depuis une page de résultats collée.
 *
 * L'utilisateur copie une page entière de résultats (eBay « ventes réussies »,
 * Leboncoin, Marketplace…) ; ce module en extrait toutes les annonces (prix +
 * contexte) pour créer d'un coup des dizaines d'observations sur une fiche
 * produit. Volontairement indépendant de toute API : un copier-coller
 * fonctionnera toujours, quels que soient les quotas et les CGU des sites.
 */

import { parseFrenchNumber } from "./parse";

/** Une annonce détectée dans le texte collé. */
export interface MarketListing {
  price: number;
  /** Ligne de contexte (souvent le titre de l'annonce). */
  context: string;
}

/** Lignes à ignorer : frais de port, mentions parasites. */
const NOISE = /livraison|frais de port|port :|shipping|\/mois|par mois|d[eè]s\s|remise|coupon|[eé]conomisez/i;

/** Prix plausibles pour de l'occasion : au-delà, probablement du bruit. */
const MIN_PRICE = 1;
const MAX_PRICE = 100_000;

/**
 * Extrait toutes les annonces (prix + ligne de contexte) d'un texte collé.
 * Déduplique les prix répétés sur des lignes identiques (affichages doublés).
 */
export function extractMarketListings(text: string): MarketListing[] {
  const listings: MarketListing[] = [];
  const seen = new Set<string>();
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || NOISE.test(line)) continue;

    for (const match of line.matchAll(/(\d[\d\s  .,]*)\s*(?:€|EUR)/gi)) {
      const price = parseFrenchNumber(match[1]);
      if (price === undefined || price < MIN_PRICE || price > MAX_PRICE) continue;

      // Contexte : la ligne précédente non vide si la ligne courante n'est
      // qu'un prix (mise en page typique des listes de résultats).
      const isPriceOnly = line.replace(match[0], "").trim().length < 12;
      const context = isPriceOnly
        ? (findPreviousText(lines, i) ?? line)
        : line;

      const key = `${price}|${context.slice(0, 60)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      listings.push({ price, context: context.slice(0, 120) });
    }
  }
  return listings;
}

function findPreviousText(lines: string[], from: number): string | undefined {
  for (let j = from - 1; j >= Math.max(0, from - 4); j--) {
    const candidate = lines[j].trim();
    if (
      candidate.length >= 12 &&
      !/€|EUR/.test(candidate) &&
      !NOISE.test(candidate)
    ) {
      return candidate;
    }
  }
  return undefined;
}

/** Résumé statistique d'une étude de marché (avant enregistrement). */
export interface MarketSummary {
  count: number;
  min: number;
  max: number;
  avg: number;
  median: number;
  /** 🎯 percentile 15 — le prix d'opportunité de ce snapshot. */
  opportunity: number;
}

export function summarizeMarket(listings: MarketListing[]): MarketSummary | undefined {
  if (listings.length === 0) return undefined;
  const prices = listings.map((l) => l.price).sort((a, b) => a - b);
  const at = (p: number) => {
    const idx = (prices.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return Math.round((prices[lo] + (prices[hi] - prices[lo]) * (idx - lo)) * 100) / 100;
  };
  return {
    count: prices.length,
    min: prices[0],
    max: prices[prices.length - 1],
    avg: Math.round((prices.reduce((s, x) => s + x, 0) / prices.length) * 100) / 100,
    median: at(0.5),
    opportunity: at(0.15),
  };
}
