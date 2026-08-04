"use client";

/**
 * 📈 « Actualiser le marché » : colle une page de résultats entière
 * (eBay ventes réussies, Leboncoin, Marketplace…), l'application extrait
 * toutes les annonces, montre le résumé statistique, et enregistre le lot
 * d'observations d'un clic. C'est TOI qui valides — jamais l'application.
 */
import { useMemo, useState } from "react";
import {
  extractMarketListings,
  summarizeMarket,
} from "@/lib/import/market";
import {
  addObservation,
  OBSERVATION_KINDS,
  OBSERVATION_SOURCES,
  type ObservationSource,
} from "@/lib/storage";
import { euro } from "@/lib/format";

export function MarketStudy({
  productId,
  onSaved,
}: {
  productId: string;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [text, setText] = useState("");
  const [source, setSource] = useState<ObservationSource>("ebay");
  const [kind, setKind] = useState<"vente" | "enchere" | "annonce">("vente");
  const [date, setDate] = useState(today);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const listings = useMemo(() => extractMarketListings(text), [text]);
  const summary = useMemo(() => summarizeMarket(listings), [listings]);

  function handleSave() {
    if (!summary) return;
    const label = `Étude de marché du ${date} (${summary.count} annonces)`;
    for (const listing of listings) {
      addObservation({
        productId,
        date,
        price: listing.price,
        kind,
        source,
        url: "",
        notes: `${label} — ${listing.context}`,
      });
    }
    setSavedCount(summary.count);
    setText("");
    onSaved();
  }

  return (
    <section className="rounded-xl border border-accent/40 bg-surface p-4 space-y-3">
      <h2 className="text-sm font-semibold text-accent uppercase tracking-wide">
        📈 Actualiser le marché
      </h2>
      <p className="text-xs text-muted">
        Faites une recherche (eBay «&nbsp;ventes réussies&nbsp;», Leboncoin,
        Marketplace…), copiez toute la page de résultats (Ctrl+A puis Ctrl+C)
        et collez ici : chaque annonce devient une observation.
      </p>

      <textarea
        className="field min-h-28 font-mono text-xs"
        placeholder="Collez ici la page de résultats complète…"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSavedCount(null);
        }}
      />

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="field-label">Type</label>
          <select
            className="field"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            {OBSERVATION_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Source</label>
          <select
            className="field"
            value={source}
            onChange={(e) => setSource(e.target.value as ObservationSource)}
          >
            {OBSERVATION_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Date du relevé</label>
          <input
            className="field"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {summary && (
        <div className="rounded-lg border border-edge bg-surface-2 p-3 space-y-2">
          <p className="text-sm font-semibold">
            ✅ {summary.count} annonce{summary.count > 1 ? "s" : ""} détectée
            {summary.count > 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-sm">
            <MiniStat label="Mini" value={euro(summary.min)} />
            <MiniStat label="Moyen" value={euro(summary.avg)} />
            <MiniStat label="Médiane" value={euro(summary.median)} />
            <MiniStat label="Maxi" value={euro(summary.max)} />
            <MiniStat label="🎯 Opportunité" value={`< ${euro(summary.opportunity)}`} accent />
          </div>
          <details className="text-xs text-muted">
            <summary className="cursor-pointer">
              Voir les annonces détectées
            </summary>
            <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
              {listings.map((l, i) => (
                <li key={i}>
                  {euro(l.price)} — {l.context}
                </li>
              ))}
            </ul>
          </details>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-lg bg-accent text-background font-semibold px-4 py-2 text-sm hover:opacity-90 transition-opacity"
          >
            Conserver ces {summary.count} observations
          </button>
        </div>
      )}

      {savedCount !== null && (
        <p className="text-sm text-positive">
          ✔ Marché actualisé — {savedCount} observation
          {savedCount > 1 ? "s" : ""} enregistrée{savedCount > 1 ? "s" : ""}.
          Statistiques, prix d&apos;opportunité et courbe mis à jour.
        </p>
      )}
    </section>
  );
}

function MiniStat({
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
