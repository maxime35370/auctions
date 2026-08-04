/**
 * Connecteur générique — fonctionne sur n'importe quel site.
 *
 * S'appuie sur les standards du web plutôt que sur la structure HTML d'un
 * site précis (qui peut changer à tout moment) :
 *   1. JSON-LD schema.org (Product / Offer) — le plus fiable ;
 *   2. balises OpenGraph (og:title, og:image…) ;
 *   3. heuristiques texte (prix en €, « frais … % », date de fin, images).
 *
 * Les connecteurs spécifiques (Interencheres…) l'utilisent en filet de
 * sécurité : leurs sélecteurs d'abord, le générique pour combler les trous.
 */

import {
  extractFromText,
  extractImages,
  extractJsonLd,
  extractOpenGraph,
  toDocument,
} from "../parse";
import {
  countFields,
  type Connector,
  type ExtractContext,
  type ImportResult,
  type ProgressReporter,
  type StandardAuctionData,
} from "../types";

/** Fusionne des extractions partielles (la première valeur définie gagne). */
export function mergeData(
  ...parts: Partial<StandardAuctionData>[]
): StandardAuctionData {
  const out: StandardAuctionData = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      if (value === undefined || value === "") continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (out[key as keyof StandardAuctionData] === undefined) {
        (out as Record<string, unknown>)[key] = value;
      }
    }
  }
  return out;
}

/** Extraction générique d'un HTML complet (partagée entre connecteurs). */
export function extractGeneric(
  html: string,
  url: string | undefined,
  report: ProgressReporter
): StandardAuctionData {
  const doc = toDocument(html);
  const text = doc?.body?.textContent ?? html;

  const jsonLd = doc ? extractJsonLd(doc) : {};
  if (jsonLd.title || jsonLd.currentPrice !== undefined) {
    report({ icon: "✅", label: "Données structurées trouvées (schema.org)", status: "ok" });
  }

  const og = doc ? extractOpenGraph(doc) : {};
  const fromText = extractFromText(text);
  const images = doc ? extractImages(doc, url) : [];

  const data = mergeData(jsonLd, og, fromText, {
    photos: images.length ? images : undefined,
    sourceUrl: url,
  });

  report({
    icon: "📄",
    label: data.title ? `Titre trouvé : ${data.title.slice(0, 60)}` : "Titre non trouvé",
    status: data.title ? "ok" : "warn",
  });
  report({
    icon: "💰",
    label:
      data.currentPrice !== undefined
        ? `Prix actuel trouvé : ${data.currentPrice} €`
        : "Prix non trouvé",
    status: data.currentPrice !== undefined ? "ok" : "warn",
  });
  report({
    icon: "📷",
    label: data.photos?.length
      ? `${data.photos.length} photo(s) trouvée(s)`
      : "Aucune photo trouvée",
    status: data.photos?.length ? "ok" : "warn",
  });
  report({
    icon: "💶",
    label:
      data.buyerFeePct !== undefined
        ? `Frais acheteur trouvés : ${data.buyerFeePct} %`
        : "Frais acheteur non trouvés — à saisir manuellement",
    status: data.buyerFeePct !== undefined ? "ok" : "warn",
  });
  if (data.endDate) {
    report({ icon: "📅", label: `Date de fin trouvée : ${data.endDate}`, status: "ok" });
  }

  return data;
}

export const genericConnector: Connector = {
  id: "generic",
  name: "Générique (OpenGraph / schema.org)",
  matches: () => true, // dernier recours : accepte tout

  async extract(ctx: ExtractContext): Promise<ImportResult> {
    const html = ctx.html ?? "";
    const data = extractGeneric(html, ctx.url || undefined, ctx.report);
    return { data, fieldsFound: countFields(data) };
  },
};
