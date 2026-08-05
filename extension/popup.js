/**
 * Auction Intelligence — extension Chrome/Edge (Manifest V3).
 *
 * Deux actions depuis la page active :
 *  - 🔍 Analyser cette enchère → /analyse#ext-import=…
 *  - 📊 Actualiser le marché  → /objets#ext-market=…
 *
 * Permission `activeTab` uniquement : l'extension n'accède qu'à la page où
 * vous cliquez. Elle envoie un JSON compact (champs structurés + court
 * extrait de texte), jamais la page brute. Le fragment d'URL (#…) n'est
 * JAMAIS transmis à un serveur. Format : src/lib/import/extension.ts (v2).
 */

// URL de l'application (usage local : "http://localhost:3000")
const APP_URL = "https://maxime35370.github.io/auctions";

/**
 * Fonction exécutée DANS la page (sérialisée par Chrome).
 * Extraction structurée : motifs français ciblés Interencheres d'abord,
 * miroir compact de src/lib/import/parse.ts.
 */
function grabPage(mode) {
  const num = (raw) => {
    const cleaned = raw
      .replace(/[\s  ]/g, "")
      .replace(/\.(?=\d{3}(\D|$))/g, "")
      .replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
  };
  const PRICE = "(\\d[\\d\\s\\u00a0\\u202f.,]*)\\s*€";
  const priceNear = (text, keywords) => {
    for (const kw of keywords) {
      // libellé … montant (fenêtre large, traverse les sauts de ligne)
      let m = text.match(new RegExp(kw + "[^0-9€]{0,90}?" + PRICE, "i"));
      // montant … libellé (les pages affichent souvent le prix d'abord)
      if (!m) m = text.match(new RegExp(PRICE + "[^0-9€]{0,60}?" + kw, "i"));
      if (m) {
        const n = num(m[1]);
        if (n !== undefined && n > 0) return n;
      }
    }
    return undefined;
  };
  const frDate = (raw) => {
    const months = {
      janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
      juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
    };
    const t = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    let m = t.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if (m && months[m[2]])
      return `${m[3]}-${String(months[m[2]]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[0] : undefined;
  };

  const text = (document.body?.innerText ?? "").slice(0, 30000);

  // --- Champs structurés (le cœur du payload v2) ---
  const fields = {};
  fields.currentPrice = priceNear(text, [
    "ench[eè]re en cours", "ench[eè]re actuelle", "derni[eè]re ench[eè]re",
    "offre actuelle", "derni[eè]re offre", "montant de l'ench[eè]re",
    "prix actuel", "adjug[eé]", "mise [aà] prix", "prix de d[eé]part",
    "estimation",
  ]);
  const fee = text.match(/(?:frais|commission)[^%]{0,80}?(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i);
  if (fee) {
    const n = num(fee[1]);
    if (n !== undefined && n > 0 && n <= 50) fields.buyerFeePct = n;
  }
  const end = text.match(
    /(?:fin|cl[oô]ture|se termine|jusqu'au)[^\n]{0,60}?(\d{1,2}\s+\p{L}+\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/iu
  );
  if (end) fields.endDate = frDate(end[1]);
  const loc = text.match(/\b(\d{5})\s+([A-ZÀ-Ÿ][A-Za-zà-ÿ' -]{2,30}?)(?=[\n,.]|$)/m);
  if (loc) fields.location = `${loc[2].trim()} (${loc[1].slice(0, 2)})`;
  const h1 = document.querySelector("h1")?.textContent?.trim();
  if (
    h1 &&
    h1.length >= 8 &&
    h1.length <= 160 &&
    !/interencheres|agorastore|ench[eè]res|se connecter|recherche/i.test(h1)
  )
    fields.title = h1;
  const qty = (fields.title ?? document.title).match(/\blot de\s+(\d{1,3})\b/i);
  if (qty) fields.quantity = Number(qty[1]);
  // Grade du cartel (ADN Enchères…) prioritaire sur l'état générique.
  const grade = text.match(
    /\bgrade\s*:?\s{0,6}(parfaitement fonctionnel|partiellement fonctionnel|test d'?allumage|hors[- ]service|fonctionnel)/i
  );
  const cond =
    grade ??
    text.match(/[eé]tat\s*:?\s*(neuf|tr[eè]s bon(?: [eé]tat)?|bon(?: [eé]tat)?|occasion|moyen|pour pi[eè]ces|hs)/i);
  if (cond) fields.condition = cond[1];
  const og = document.querySelector('meta[property="og:description"], meta[name="description"]');
  if (og) fields.description = (og.getAttribute("content") ?? "").slice(0, 500);

  const meta = Array.from(
    document.querySelectorAll('head meta, head title, script[type="application/ld+json"]')
  )
    .map((el) => el.outerHTML)
    .join("\n")
    .slice(0, 15000);

  const photos = Array.from(document.images)
    .filter((img) => img.naturalWidth >= 200 || img.width >= 200)
    .map((img) => img.currentSrc || img.src)
    .filter(
      (src) =>
        /^https?:/.test(src) && !/logo|icon|sprite|avatar|pixel|badge/i.test(src)
    )
    .slice(0, 6);

  return {
    v: 2,
    url: location.href,
    title: document.title,
    meta,
    // Le marché a besoin de tout le texte (les annonces) ; l'enchère, d'un extrait.
    text: mode === "market" ? text : text.slice(0, 12000),
    photos: mode === "market" ? [] : photos,
    fields: mode === "market" ? undefined : fields,
  };
}

/** Base64 URL-safe Unicode (miroir de src/lib/import/extension.ts). */
function encodePayload(payload) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function run(mode) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:/.test(tab.url ?? "")) return;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: grabPage,
      args: [mode],
    });
    if (!result) return;

    // Limite de taille : replis successifs (texte réduit, puis champs seuls).
    let encoded = encodePayload(result);
    if (encoded.length > 200000) {
      result.text = result.text.slice(0, 8000);
      encoded = encodePayload(result);
    }
    if (encoded.length > 200000) {
      result.meta = "";
      result.text = result.text.slice(0, 3000);
      encoded = encodePayload(result);
    }

    const route =
      mode === "market" ? "/objets/#ext-market=" : "/analyse/#ext-import=";
    await chrome.tabs.create({ url: `${APP_URL}${route}${encoded}` });
    window.close();
  } catch (e) {
    // Pages protégées (chrome://, PDF…) : rien à faire.
    console.warn("Auction Intelligence :", e);
  }
}

document.getElementById("auction").addEventListener("click", () => run("auction"));
document.getElementById("market").addEventListener("click", () => run("market"));
