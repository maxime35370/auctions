/**
 * Orchestration d'un import :
 *
 *   URL → détection du site → acquisition du HTML → connecteur
 *       → StandardAuctionData → brouillon de formulaire pré-rempli
 *
 * Acquisition : l'application étant un site statique (GitHub Pages), le
 * navigateur ne peut lire une page d'un autre site que si celui-ci l'autorise
 * (CORS). Quand l'accès direct est bloqué, l'utilisateur colle le contenu de
 * la page (mode presse-papiers) — le connecteur travaille alors sur ce texte.
 * Un futur petit proxy (Cloudflare Worker) rendra l'accès direct universel
 * sans changer une ligne des connecteurs.
 */

import { detectConnector } from "./registry";
import type { ImportStep, ProgressReporter, StandardAuctionData } from "./types";
import { emptyAuctionInput, CATEGORIES, type Condition } from "@/lib/engine";
import type { AuctionDraft } from "@/lib/storage";

export type { ImportStep };

/** Import depuis une URL (tentative d'accès direct, sinon guide l'utilisateur). */
export async function importFromUrl(
  url: string,
  report: ProgressReporter
): Promise<StandardAuctionData | null> {
  const connector = detectConnector(url);
  report({ icon: "🔍", label: `Analyse de l'URL…`, status: "pending" });

  // Le connecteur démo n'a pas besoin de réseau.
  if (connector.id === "demo") {
    const { data, fieldsFound } = await connector.extract({ url, report });
    report({
      icon: "🎉",
      label: `${fieldsFound} champ(s) extrait(s) — vérifiez et complétez avant d'enregistrer`,
      status: "ok",
    });
    return data;
  }

  let html: string;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
    report({ icon: "✅", label: "Connexion réussie", status: "ok" });
  } catch {
    report({
      icon: "🚫",
      label:
        "Accès direct bloqué par le site (protection CORS) — c'est fréquent. " +
        "Utilisez « Importer depuis le presse-papiers » : copiez le contenu de la page (Ctrl+A puis Ctrl+C) et revenez ici.",
      status: "error",
    });
    return null;
  }

  const { data, fieldsFound } = await connector.extract({ url, html, report });
  report({
    icon: fieldsFound >= 3 ? "🎉" : "⚠️",
    label: `${fieldsFound} champ(s) extrait(s) — vérifiez et complétez avant d'enregistrer`,
    status: fieldsFound >= 3 ? "ok" : "warn",
  });
  return data;
}

/** Import depuis un texte / HTML collé par l'utilisateur. */
export async function importFromClipboard(
  content: string,
  sourceUrl: string,
  report: ProgressReporter
): Promise<StandardAuctionData | null> {
  if (content.trim().length < 40) {
    report({
      icon: "🚫",
      label: "Le contenu collé est trop court pour être analysé.",
      status: "error",
    });
    return null;
  }
  report({ icon: "📋", label: "Analyse du contenu collé…", status: "pending" });
  const connector = detectConnector(sourceUrl);
  if (connector.id !== "generic") {
    report({ icon: "✅", label: `Site reconnu : ${connector.name}`, status: "ok" });
  }
  const { data, fieldsFound } = await connector.extract({
    url: sourceUrl,
    html: content,
    report,
  });
  report({
    icon: fieldsFound >= 3 ? "🎉" : "⚠️",
    label: `${fieldsFound} champ(s) extrait(s) — vérifiez et complétez avant d'enregistrer`,
    status: fieldsFound >= 3 ? "ok" : "warn",
  });
  return data;
}

// ---------------------------------------------------------------------------
// Conversion vers un brouillon de formulaire
// ---------------------------------------------------------------------------

/** Mots-clés → catégorie interne. */
const CATEGORY_KEYWORDS: [RegExp, (typeof CATEGORIES)[number]][] = [
  [/imprimante|raspberry|nas|ordinateur|pc\b|serveur|ssd|informatique|3d/i, "informatique"],
  [/canon|nikon|sony alpha|objectif|reflex|hybride|photo|flash/i, "photo"],
  [/ampli|enceinte|platine|hifi|audio|vid[eé]o|t[eé]l[eé]viseur/i, "audio-video"],
  [/lave|frigo|r[eé]frig|four|aspirateur|[eé]lectrom[eé]nager/i, "electromenager"],
  [/perceuse|scie|outillage|compresseur|poste [aà] souder/i, "outillage"],
  [/montre|bijou|horlog|or\b|argent\b/i, "horlogerie-bijoux"],
  [/table|chaise|armoire|bureau|meuble|mobilier|canap/i, "mobilier"],
  [/voiture|v[eé]hicule|moto|scooter|utilitaire/i, "vehicules"],
  [/tableau|sculpture|c[eé]ramique|collection|timbre/i, "art-collection"],
];

function guessCategory(data: StandardAuctionData): string {
  const haystack = `${data.rawCategory ?? ""} ${data.title ?? ""}`;
  for (const [re, cat] of CATEGORY_KEYWORDS) {
    if (re.test(haystack)) return cat;
  }
  return "autre";
}

function guessCondition(raw?: string): Condition {
  if (!raw) return "bon";
  if (/neuf/i.test(raw)) return "neuf";
  if (/tr[eè]s bon/i.test(raw)) return "tres-bon";
  if (/hs|panne|pi[eè]ce|[eé]pave|d[eé]faut/i.test(raw)) return "a-reparer";
  if (/moyen|us[eé]/i.test(raw)) return "moyen";
  return "bon";
}

/** Transforme les données extraites en brouillon de formulaire pré-rempli. */
export function toDraft(data: StandardAuctionData): Partial<AuctionDraft> {
  return {
    ...emptyAuctionInput(),
    sourceUrl: data.sourceUrl?.startsWith("demo:") ? "" : (data.sourceUrl ?? ""),
    title: data.title ?? "",
    category: guessCategory(data),
    auctionHouse: data.auctionHouse ?? "",
    location: data.location ?? "",
    comments: data.description ?? "",
    endDate: data.endDate ?? "",
    photos: data.photos ?? [],
    currentPrice: data.currentPrice ?? 0,
    buyerFeePct: data.buyerFeePct ?? 20,
    shippingCost: data.shippingCost ?? 0,
    condition: guessCondition(data.rawCondition),
  };
}
