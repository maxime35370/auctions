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
 * Libellés de prix rencontrés sur les sites d'enchères français
 * (Interencheres, Agorastore…). Ordre = priorité.
 */
export const PRICE_KEYWORDS = [
  "ench[eè]re en cours",
  "ench[eè]re actuelle",
  "derni[eè]re ench[eè]re",
  "offre actuelle",
  "derni[eè]re offre",
  "montant de l'ench[eè]re",
  "prix actuel",
  "adjug[eé][\\w ]{0,10}",
  "mise [aà] prix",
  "prix de d[eé]part",
  "estimation",
];

/**
 * Cherche un prix en € proche d'un des mots-clés donnés — dans les deux sens
 * (« Enchère en cours : 210 € » ET « 210 €\nEnchère en cours », les pages
 * réelles mettent souvent le libellé et le montant sur des lignes séparées).
 */
export function findPriceNear(text: string, keywords: string[]): number | undefined {
  const PRICE = "(\\d[\\d\\s\\u00a0\\u202f.,]*)\\s*€";
  for (const kw of keywords) {
    // mot-clé … prix (fenêtre large : traverse les sauts de ligne)
    let m = text.match(new RegExp(`${kw}[^0-9€]{0,90}?${PRICE}`, "i"));
    if (!m) {
      // prix … mot-clé (montant affiché avant son libellé)
      m = text.match(new RegExp(`${PRICE}[^0-9€]{0,60}?${kw}`, "i"));
    }
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

/** Frais acheteur : « frais de vente : 24,66 % TTC », « commission 20% »… */
export function findBuyerFeePct(text: string): number | undefined {
  const patterns = [
    /(?:frais|commission)[^%]{0,80}?(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i,
    /(\d{1,2}(?:[.,]\d{1,2})?)\s*%[^.]{0,40}(?:frais|commission)/i,
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

/** Localisation française : « 35000 Rennes » → « Rennes (35) ». */
export function findLocation(text: string): string | undefined {
  const m = text.match(/\b(\d{5})\s+([A-ZÀ-Ÿ][A-Za-zà-ÿ' -]{2,30}?)(?=[\n,.]|\s{2}|$)/m);
  if (!m) return undefined;
  const dept = m[1].slice(0, 2);
  return `${m[2].trim()} (${dept})`;
}

/** Maison de vente : « SVV … », « … Enchères », « Hôtel des ventes … ». */
export function findAuctionHouse(text: string): string | undefined {
  const patterns = [
    /\b(SVV\s+[A-ZÀ-Ÿ][\w'à-ÿ -]{2,40})/,
    /\b(H[oô]tel des ventes[\w'à-ÿ -]{0,40})/i,
    /\b([A-ZÀ-Ÿ][\w'à-ÿ-]+(?:\s[\w'à-ÿ-]+){0,3}\s+ench[eè]res)\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return undefined;
}

/** Quantité d'un lot : « Lot de 3 NAS… » → 3. */
export function findQuantity(title: string): number | undefined {
  const m = title.match(/\blot de\s+(\d{1,3})\b/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return n >= 2 && n <= 500 ? n : undefined;
}

// ---------------------------------------------------------------------------
// Grades et origines (cartels des maisons de vente sur Interencheres,
// ex. ADN Enchères) — LE signal d'état et de risque des lots.
// ---------------------------------------------------------------------------

/** Grade → état interne + avertissement. Ordre = du plus spécifique au moins. */
const GRADES: {
  re: RegExp;
  condition: "tres-bon" | "bon" | "a-reparer" | "epave";
  label: string;
  warning?: string;
}[] = [
  {
    re: /parfaitement fonctionnel/i,
    condition: "tres-bon",
    label: "Parfaitement fonctionnel",
  },
  {
    re: /partiellement fonctionnel/i,
    condition: "a-reparer",
    label: "Partiellement fonctionnel",
    warning: "une ou plusieurs fonctions HS, dégradation rapide à prévoir",
  },
  {
    re: /test d'?allumage/i,
    condition: "a-reparer",
    label: "Test d'allumage",
    warning:
      "seul l'allumage a été vérifié — fonctionnement réel inconnu, à traiter comme à réparer",
  },
  {
    re: /hors[- ]service/i,
    condition: "epave",
    label: "Hors service",
    warning: "l'appareil ne fonctionne pas — pour pièces ou spécialistes",
  },
  {
    // « fonctionnel » seul (pas précédé de parfaitement/partiellement)
    re: /(?<!parfaitement )(?<!partiellement )\bfonctionnel\b/i,
    condition: "bon",
    label: "Fonctionnel",
    warning: "dégradation sérieuse de la batterie possible (selon cartel)",
  },
];

export interface GradeInfo {
  label: string;
  condition: "tres-bon" | "bon" | "a-reparer" | "epave";
  warning?: string;
}

/**
 * Grade de fonctionnement DU LOT.
 * ⚠ Les pages contiennent souvent la légende CGV où TOUS les grades sont
 * définis : on ne prend jamais le premier mot trouvé. Priorité :
 *  1. ligne étiquetée « Grade : X » (fiable même avec la légende) ;
 *  2. sinon, un grade présent de façon UNIQUE dans le texte ;
 *  3. plusieurs grades présents sans étiquette → on ne devine pas.
 */
export function findGrade(text: string): GradeInfo | undefined {
  const labeled = text.match(
    /\bgrade\s*:?\s{0,6}(parfaitement fonctionnel|partiellement fonctionnel|test d'?allumage|hors[- ]service|fonctionnel)/i
  );
  if (labeled) {
    const found = GRADES.find((g) => g.re.test(labeled[1]));
    if (found)
      return { label: found.label, condition: found.condition, warning: found.warning };
  }
  const present = GRADES.filter((g) => g.re.test(text));
  if (present.length === 1) {
    const g = present[0];
    return { label: g.label, condition: g.condition, warning: g.warning };
  }
  return undefined; // légende CGV probable : on ne devine pas
}

/** Origine du lot → avertissement associé. */
const ORIGINS: { re: RegExp; label: string; warning: string }[] = [
  {
    re: /litige transport/i,
    label: "Litige transport",
    warning: "avarie possible pendant le transport, aucune garantie sur l'état",
  },
  {
    re: /retour client/i,
    label: "Retour client",
    warning: "produit retourné après usage, aucune garantie sur l'état ni le fonctionnement",
  },
  {
    re: /retour sav/i,
    label: "Retour SAV",
    warning: "défaut de fonctionnement présumé, aucune garantie — risque élevé",
  },
  {
    re: /retour d'?entrep[oô]t/i,
    label: "Retour d'entrepôt",
    warning: "jamais utilisé, mais défaut de référencement/stockage possible",
  },
];

/** Origine du lot (même prudence que pour les grades : étiquette ou unicité). */
export function findLotOrigin(
  text: string
): { label: string; warning: string } | undefined {
  const labeled = text.match(
    /\borigine\s*:?\s{0,6}(litige transport|retour client|retour sav|retour d'?entrep[oô]t)/i
  );
  if (labeled) {
    const found = ORIGINS.find((o) => o.re.test(labeled[1]));
    if (found) return { label: found.label, warning: found.warning };
  }
  const present = ORIGINS.filter((o) => o.re.test(text));
  if (present.length === 1)
    return { label: present[0].label, warning: present[0].warning };
  return undefined;
}

/** Frais additionnels Interencheres (ex. « frais Interencheres de 1,8 % »). */
export function findExtraFeeNote(text: string): string | undefined {
  const m = text.match(/frais interencheres de\s*(\d(?:[.,]\d{1,2})?)\s*%/i);
  if (!m) return undefined;
  return `Frais Interencheres +${m[1]} % en sus (souvent pris en charge par la maison si paiement CB — vérifier le cartel).`;
}

/**
 * Lignes parasites des pages réelles : navigation, cookies, RGPD, footer…
 * (liste enrichie au fil des retours sur de vraies pages).
 */
const BOILERPLATE =
  /vente aux ench[eè]res|interencheres|agorastore|ench[eè]res[- ]domaine|cookies?|se connecter|connexion|inscription|mon compte|mes listes|favoris|panier|rechercher|recherche|menu|accueil|newsletter|mentions l[eé]gales|cgv|conditions g[eé]n[eé]rales|donn[eé]es personnelles|rgpd|aide|contact|filtre|trier par|cat[eé]gories?|toutes les|prochaines ventes|[aà] la une|voir plus|en savoir plus|t[eé]l[eé]charger|comment (?:ach|vend)|fonctionne|s'abonner|suivre/i;

/** Ligne qui n'est qu'une date / heure / jour de semaine (pas un titre). */
const DATE_LINE =
  /^(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*\d{0,2}\s*(?:janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre|\d{1,2}\/\d{1,2})?\s*\d{0,4}\s*(?:[aà]\s*\d{1,2}[h:]\d{0,2})?$/i;

function titleScore(line: string): number {
  let score = Math.min(line.length, 80) / 20;
  if (/\blot\b|n[°º]/i.test(line)) score += 3;
  if (/\d/.test(line)) score += 1;
  if (BOILERPLATE.test(line)) score -= 8;
  if (DATE_LINE.test(line)) score -= 8;
  if (/€|%/.test(line)) score -= 4; // une ligne de prix n'est pas un titre
  return score;
}

/**
 * Devine le titre du lot. Stratégie : sur les vraies pages, le titre est
 * presque toujours À PROXIMITÉ DU PRIX (quelques lignes au-dessus) — bien
 * plus fiable que « première ligne plausible », qui attrape les menus.
 * `anchorIndex` = index de la ligne où le prix/libellé d'enchère a été trouvé.
 */
export function guessTitle(
  lines: string[],
  anchorIndex?: number
): string | undefined {
  const isCandidate = (l: string) =>
    l.length >= 10 && l.length <= 140 && !l.startsWith("http");

  let best: string | undefined;
  let bestScore = -Infinity;

  const consider = (line: string, proximityBonus: number) => {
    if (!isCandidate(line)) return;
    const score = titleScore(line) + proximityBonus;
    if (score > bestScore) {
      bestScore = score;
      best = line;
    }
  };

  if (anchorIndex !== undefined && anchorIndex >= 0) {
    // Fenêtre ancrée : les 15 lignes précédant le prix (les plus proches
    // reçoivent un léger bonus), puis les 3 suivantes.
    for (let i = Math.max(0, anchorIndex - 15); i < anchorIndex; i++) {
      consider(lines[i], 2 + (i - Math.max(0, anchorIndex - 15)) * 0.1);
    }
    for (let i = anchorIndex + 1; i <= Math.min(lines.length - 1, anchorIndex + 3); i++) {
      consider(lines[i], 1);
    }
    if (best && bestScore > 0) return best;
  }

  // Repli : balayage global (page entière, pas seulement le début).
  best = undefined;
  bestScore = -Infinity;
  for (const line of lines) consider(line, 0);
  return bestScore > 0 ? best : undefined;
}

/** Index de la première ligne contenant un libellé de prix d'enchère. */
export function findPriceAnchorIndex(lines: string[]): number {
  const re = new RegExp(PRICE_KEYWORDS.join("|"), "i");
  const idx = lines.findIndex((l) => re.test(l));
  if (idx >= 0) return idx;
  // Sinon : première ligne contenant un montant en €.
  return lines.findIndex((l) => /\d[\d\s  .,]*\s*€/.test(l));
}

/** Extraction best-effort depuis du texte libre collé par l'utilisateur. */
export function extractFromText(text: string): Partial<StandardAuctionData> {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Le prix sert d'ancre : le titre du lot est presque toujours juste à côté.
  const anchorIndex = findPriceAnchorIndex(lines);

  // Cartel de la maison de vente : grade de fonctionnement, origine du lot,
  // frais additionnels — les avertissements partent dans les commentaires.
  const grade = findGrade(text);
  const origin = findLotOrigin(text);
  const extraFee = findExtraFeeNote(text);
  const notes: string[] = [];
  if (grade)
    notes.push(
      `Grade annoncé : ${grade.label}${grade.warning ? ` — ⚠ ${grade.warning}` : ""}.`
    );
  if (origin) notes.push(`⚠ Origine : ${origin.label} — ${origin.warning}.`);
  if (extraFee) notes.push(extraFee);

  return {
    title: guessTitle(lines, anchorIndex >= 0 ? anchorIndex : undefined),
    currentPrice: findPriceNear(text, PRICE_KEYWORDS) ?? findAnyPrice(text),
    buyerFeePct: findBuyerFeePct(text),
    endDate: findEndDate(text),
    location: findLocation(text),
    auctionHouse: findAuctionHouse(text),
    rawCondition: grade?.condition,
    description: notes.length ? notes.join("\n") : undefined,
    photos: [...text.matchAll(/https?:\/\/\S+\.(?:jpe?g|png|webp)\S*/gi)]
      .map((m) => m[0])
      .slice(0, 8),
  };
}
