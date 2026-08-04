"use client";

/**
 * Réception d'une étude de marché envoyée par l'extension Chrome
 * (« 📊 Actualiser le marché dans Auctions ») : la page de résultats arrive
 * dans le fragment d'URL, les annonces sont extraites, la fiche produit est
 * reconnue automatiquement (noms/alias), l'utilisateur prévisualise puis
 * valide — l'application n'enregistre jamais seule.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  decodeExtensionPayload,
  EXT_MARKET_HASH_PREFIX,
  type ExtensionPayload,
} from "@/lib/import/extension";
import {
  extractMarketListings,
  guessKindFromUrl,
  guessSourceFromUrl,
  summarizeMarket,
} from "@/lib/import/market";
import { matchesTitle } from "@/lib/engine";
import {
  addObservation,
  listProducts,
  type Product,
} from "@/lib/storage";
import { euro } from "@/lib/format";

export function MarketReceiver() {
  const router = useRouter();
  const [payload, setPayload] = useState<ExtensionPayload | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState<string>("");
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    if (!window.location.hash.startsWith(EXT_MARKET_HASH_PREFIX)) return;
    handled.current = true;
    const decoded = decodeExtensionPayload(
      window.location.hash,
      EXT_MARKET_HASH_PREFIX
    );
    window.history.replaceState(null, "", window.location.pathname);
    if (!decoded) return;
    const all = listProducts();
    setProducts(all);
    setPayload(decoded);
    // 🔎 Reconnaissance automatique : le nom (ou un alias) d'un produit connu
    // apparaît-il dans le titre de la page OU dans les premières annonces ?
    const haystack = `${decoded.title}\n${decoded.text.slice(0, 3000)}`;
    const match = all.find((p) => matchesTitle(haystack, p.name, p.aliases));
    if (match) setProductId(match.id);
  }, []);

  const listings = useMemo(
    () => (payload ? extractMarketListings(payload.text) : []),
    [payload]
  );
  const summary = useMemo(() => summarizeMarket(listings), [listings]);

  if (!payload) return null;

  const source = guessSourceFromUrl(payload.url);
  const kind = guessKindFromUrl(payload.url, payload.title);
  const today = new Date().toISOString().slice(0, 10);
  const recognized = products.find((p) => p.id === productId);

  function handleSave() {
    if (!summary || !productId) return;
    const label = `Étude de marché du ${today} (${summary.count} annonces, extension)`;
    for (const listing of listings) {
      addObservation({
        productId,
        date: today,
        price: listing.price,
        kind,
        source,
        url: "",
        notes: `${label} — ${listing.context}`,
      });
    }
    router.push(`/objet?id=${productId}`);
  }

  return (
    <section className="rounded-xl border border-accent bg-accent/5 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-accent uppercase tracking-wide">
        📊 Étude de marché reçue de l&apos;extension
      </h2>
      <p className="text-sm text-muted">
        Page analysée : <span className="text-foreground">{payload.title}</span>
      </p>

      {!summary ? (
        <p className="text-sm text-negative">
          Aucune annonce détectée sur cette page — vérifiez qu&apos;il
          s&apos;agit bien d&apos;une page de résultats avec des prix.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-sm">
            <Mini label="Annonces" value={String(summary.count)} />
            <Mini label="Mini" value={euro(summary.min)} />
            <Mini label="Médiane" value={euro(summary.median)} />
            <Mini label="Maxi" value={euro(summary.max)} />
            <Mini label="🎯 Opportunité" value={`< ${euro(summary.opportunity)}`} accent />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-56">
              <label className="field-label">
                {recognized
                  ? "✅ Produit reconnu automatiquement"
                  : "Choisir la fiche produit de destination"}
              </label>
              <select
                className="field"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="">— Sélectionner une fiche —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted">
              Type : <b>{kind === "vente" ? "ventes conclues" : "prix affichés"}</b>{" "}
              · Source : <b>{source}</b>
            </p>
            <button
              onClick={handleSave}
              disabled={!productId}
              className="rounded-lg bg-accent text-background font-semibold px-4 py-2 text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              Conserver ces {summary.count} observations
            </button>
            <button
              onClick={() => setPayload(null)}
              className="rounded-lg border border-edge px-3 py-2 text-sm hover:bg-surface-2 transition-colors"
            >
              Ignorer
            </button>
          </div>

          <details className="text-xs text-muted">
            <summary className="cursor-pointer">Voir les annonces détectées</summary>
            <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
              {listings.map((l, i) => (
                <li key={i}>
                  {euro(l.price)} — {l.context}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}

function Mini({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-lg p-2 ${accent ? "bg-positive/10 text-positive" : "bg-surface"}`}>
      <div className="text-[10px] text-muted">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}
