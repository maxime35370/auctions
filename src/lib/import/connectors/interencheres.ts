/**
 * Connecteur Interencheres (interencheres.com).
 *
 * Structure : sélecteurs spécifiques au site d'abord, extraction générique
 * (JSON-LD / OpenGraph / heuristiques) en filet de sécurité. Les sélecteurs
 * ci-dessous sont volontairement prudents : le HTML du site peut évoluer, et
 * une partie du contenu est chargée en JavaScript — dans ce cas le mode
 * « presse-papiers » reste la voie fiable.
 */

import { findAuctionHouse, findLocation, findPriceNear } from "../parse";
import { extractGeneric, mergeData } from "./generic";
import {
  countFields,
  type Connector,
  type ExtractContext,
  type ImportResult,
  type StandardAuctionData,
} from "../types";

export const interencheresConnector: Connector = {
  id: "interencheres",
  name: "Interencheres",
  matches: (url) => /(^|\.)interencheres\.com/i.test(safeHost(url)),

  async extract(ctx: ExtractContext): Promise<ImportResult> {
    ctx.report({ icon: "✅", label: "Site reconnu : Interencheres", status: "ok" });

    const html = ctx.html ?? "";
    const text = stripTags(html);

    // Motifs propres à Interencheres (best-effort — les pages réelles
    // permettront d'affiner ; le générique complète toujours derrière).
    const specific: Partial<StandardAuctionData> = {
      auctionHouse: findAuctionHouse(text) ?? "Interencheres",
      location: findLocation(text),
      currentPrice: findPriceNear(text, [
        "ench[eè]re en cours", "derni[eè]re ench[eè]re", "mise [aà] prix",
      ]),
    };

    const generic = extractGeneric(html, ctx.url || undefined, ctx.report);
    const data = mergeData(specific, generic);

    return { data, fieldsFound: countFields(data) };
  },
};

function safeHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function stripTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ");
}
