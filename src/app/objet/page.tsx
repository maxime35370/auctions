"use client";

/**
 * Fiche produit (?id=…) — le « Wikipédia des objets » :
 * statistiques calculées, indice de confiance justifié, courbe des prix,
 * ventes observées (ajout/suppression) et enchères liées.
 */
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  averageSaleDelay,
  CATEGORIES,
  CATEGORY_LABELS,
  dataMaturity,
  myVsMarket,
  opportunityZones,
  platformStats,
  priceStability,
  productStats,
  type Category,
} from "@/lib/engine";
import {
  addObservation,
  auctionsForProduct,
  deleteObservation,
  deleteProduct,
  getProduct,
  listObservations,
  OBSERVATION_KINDS,
  OBSERVATION_SOURCES,
  REJECT_REASONS,
  rejectObservation,
  restoreObservation,
  saveProduct,
  type AuctionRecord,
  type Observation,
  type ObservationSource,
  type Product,
} from "@/lib/storage";
import { dateFr, euro } from "@/lib/format";
import { PriceChart } from "@/components/PriceChart";
import { MarketStudy } from "@/components/MarketStudy";
import { MaturityBadge } from "@/components/KnowledgeBadges";
import { ConfidenceBadge, Trend } from "@/components/KnowledgeBadges";
import { ScoreStars } from "@/components/ScoreStars";

export default function ObjetPage() {
  return (
    <Suspense>
      <ObjetContent />
    </Suspense>
  );
}

function ObjetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [product, setProduct] = useState<Product | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [auctions, setAuctions] = useState<AuctionRecord[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    if (!id) return;
    setProduct(getProduct(id) ?? null);
    setObservations(listObservations(id));
    setAuctions(auctionsForProduct(id));
  }, [id]);

  useEffect(() => {
    refresh();
    setReady(true);
  }, [refresh]);

  if (!ready) return null;
  if (!product) {
    return (
      <div className="rounded-xl border border-edge bg-surface p-10 text-center space-y-3">
        <p className="font-semibold">Fiche introuvable</p>
        <Link href="/objets" className="text-accent text-sm hover:underline">
          ← Retour à la base de connaissances
        </Link>
      </div>
    );
  }

  // Les observations rejetées sont conservées mais exclues des calculs.
  const active = observations.filter((o) => !o.rejected);
  const stats = productStats(active);
  const zones = opportunityZones(active);
  const stability = priceStability(active);
  const performance = myVsMarket(active);
  const saleDelay = averageSaleDelay(active);
  const maturity = dataMaturity(active);
  const platforms = platformStats(active);

  function handleDelete() {
    if (!product) return;
    if (!confirm("Supprimer cette fiche et toutes ses observations ?")) return;
    deleteProduct(product.id);
    router.push("/objets");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/objets" className="text-xs text-muted hover:text-foreground">
            ← Base de connaissances
          </Link>
          <h1 className="text-2xl font-bold mt-1">{product.name}</h1>
          <p className="text-sm text-muted mt-1">
            {CATEGORY_LABELS[product.category as Category] ?? product.category}
            {product.brand ? ` · ${product.brand}` : ""} · Observé{" "}
            <b className="text-foreground">{stats.count}</b> fois
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MaturityBadge score={maturity.score} level={maturity.level} />
          <ConfidenceBadge value={stats.confidence} />
          <button
            onClick={handleDelete}
            className="rounded-lg border border-negative/40 text-negative px-3 py-1.5 text-sm hover:bg-negative/10 transition-colors"
          >
            Supprimer
          </button>
        </div>
      </div>

      {/* Statistiques clés */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Prix moyen observé" value={stats.avg !== undefined ? euro(stats.avg) : "—"} />
        <Stat
          label="Fourchette"
          value={
            stats.min !== undefined ? `${euro(stats.min)} – ${euro(stats.max!)}` : "—"
          }
        />
        <Stat
          label="Adjudication typique"
          value={stats.typicalAuctionPrice !== undefined ? euro(stats.typicalAuctionPrice) : "—"}
          hint="médiane des enchères observées"
        />
        <Stat
          label="Tendance 6 mois"
          value={stats.trendPct !== undefined ? <Trend pct={stats.trendPct} /> : "—"}
        />
      </div>

      {/* 🎯 Prix d'opportunité */}
      {zones && (
        <div className="rounded-xl border border-positive/40 bg-positive/5 p-4">
          <div className="text-xs font-semibold text-positive uppercase tracking-wide mb-2">
            🎯 Prix d&apos;opportunité — à partir de quel prix acheter ?
          </div>
          <div className="grid sm:grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-lg bg-surface p-3 border border-positive/40">
              <div className="text-xs text-positive">Excellente affaire</div>
              <div className="text-xl font-black">&lt; {euro(zones.opportunityPrice)}</div>
            </div>
            <div className="rounded-lg bg-surface p-3 border border-accent/40">
              <div className="text-xs text-accent">Intéressant</div>
              <div className="text-xl font-bold">
                {euro(zones.opportunityPrice)} – {euro(zones.fairPrice)}
              </div>
            </div>
            <div className="rounded-lg bg-surface p-3 border border-negative/40">
              <div className="text-xs text-negative">Marge faible</div>
              <div className="text-xl font-bold">&gt; {euro(zones.fairPrice)}</div>
            </div>
          </div>
          <p className="text-[11px] text-muted mt-2">
            Percentiles 15 et 40 sur {zones.sampleSize} observation
            {zones.sampleSize > 1 ? "s" : ""} (
            {zones.basis === "adjudications"
              ? "adjudications uniquement"
              : "toutes observations"}
            ).
          </p>
        </div>
      )}

      {/* 📊 Statistiques avancées */}
      {(stability || saleDelay || performance) && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {stability && (
            <Stat
              label="Stabilité du marché"
              value={
                stability.label === "stable"
                  ? "🟢 Stable"
                  : stability.label === "variable"
                    ? "🟡 Variable"
                    : "🔴 Très variable"
              }
              hint={`écart-type ${euro(stability.stdDev)} (±${stability.cvPct.toFixed(0)} %)`}
            />
          )}
          {saleDelay && (
            <Stat
              label="⚡ Mon temps moyen de revente"
              value={`${saleDelay.avgDays} jour${saleDelay.avgDays > 1 ? "s" : ""}`}
              hint={`sur ${saleDelay.count} transaction${saleDelay.count > 1 ? "s" : ""}`}
            />
          )}
          {performance && (
            <Stat
              label="Moi vs le marché"
              value={
                <span className={performance.diffPct >= 0 ? "text-positive" : "text-negative"}>
                  {performance.diffPct >= 0 ? "+" : ""}
                  {performance.diffPct.toFixed(0)} %
                </span>
              }
              hint={`je revends en moyenne ${euro(performance.myAvgSale)} (marché : ${euro(performance.marketMedianSale)})`}
            />
          )}
        </div>
      )}

      {/* Prix de revente suggérés */}
      {stats.suggestedNormal !== undefined && (
        <div className="rounded-xl border border-accent/40 bg-accent/5 p-4">
          <div className="text-xs font-semibold text-accent uppercase tracking-wide mb-2">
            💡 Prix de revente suggérés (calculés sur {stats.count} observation
            {stats.count > 1 ? "s" : ""})
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xs text-muted">Rapide (p25)</div>
              <div className="text-lg font-bold">{euro(stats.suggestedFast!)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Normal (médiane)</div>
              <div className="text-lg font-bold">{euro(stats.suggestedNormal)}</div>
            </div>
            <div>
              <div className="text-xs text-muted">Premium (p75)</div>
              <div className="text-lg font-bold">{euro(stats.suggestedPremium!)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Maturité des données + indice de confiance justifié */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-edge bg-surface p-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">
            Maturité des données : {maturity.score} %
          </h2>
          <ul className="text-sm space-y-1 text-muted">
            <li>• {maturity.observations} observation{maturity.observations > 1 ? "s" : ""}</li>
            <li>• {maturity.sales} vente{maturity.sales > 1 ? "s" : ""} conclue{maturity.sales > 1 ? "s" : ""}</li>
            <li>• {maturity.myTransactions} transaction{maturity.myTransactions > 1 ? "s" : ""} personnelle{maturity.myTransactions > 1 ? "s" : ""}</li>
          </ul>
          <p className="text-[11px] text-muted mt-2">
            Plus la maturité est haute, plus les recommandations reposent sur
            des mesures réelles plutôt que sur des hypothèses.
          </p>
        </div>
        <div className="rounded-xl border border-edge bg-surface p-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-2">
            Indice de confiance : {stats.confidence} %
          </h2>
          <ul className="text-sm space-y-1">
            {stats.confidenceReasons.map((r) => (
              <li key={r} className="text-muted">
                • {r}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 📦 Comparateur de plateformes — mesuré sur les observations */}
      {platforms.length >= 2 && (
        <div className="rounded-xl border border-edge bg-surface p-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            📦 Comparateur de plateformes{" "}
            <span className="normal-case font-normal">(mesuré sur tes observations)</span>
          </h2>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted border-b border-edge">
              <tr>
                <th className="text-left font-medium py-2">Plateforme</th>
                <th className="text-right font-medium py-2">Annonces</th>
                <th className="text-right font-medium py-2">Prix moyen</th>
                <th className="text-right font-medium py-2">Médiane</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {platforms.map((p) => (
                <tr key={p.source}>
                  <td className="py-1.5 capitalize">{p.source}</td>
                  <td className="py-1.5 text-right">{p.count}</td>
                  <td className="py-1.5 text-right font-medium">{euro(p.avg)}</td>
                  <td className="py-1.5 text-right">{euro(p.median)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted mt-2">
            💡 Pour maximiser le prix →{" "}
            <b className="capitalize">{platforms[0].source}</b>
            {platforms.length > 1 && (
              <>
                {" "}
                · les prix les plus bas s&apos;observent sur{" "}
                <b className="capitalize">{platforms[platforms.length - 1].source}</b>
              </>
            )}
            . Les délais moyens par plateforme viendront de tes ventes réelles.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* Courbe des prix */}
        <section className="rounded-xl border border-edge bg-surface p-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            📈 Courbe des prix
          </h2>
          <PriceChart points={active} />
        </section>

        {/* Fiche éditable */}
        <ProductEditor product={product} onSaved={refresh} />
      </div>

      {/* 📈 Étude de marché : absorber des dizaines d'annonces d'un coup */}
      <MarketStudy productId={product.id} onSaved={refresh} />

      {/* Observations */}
      <ObservationsSection
        productId={product.id}
        observations={observations}
        onChanged={refresh}
      />

      {/* Enchères liées */}
      {auctions.length > 0 && (
        <section className="rounded-xl border border-edge bg-surface p-4">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            Mes enchères liées ({auctions.length})
          </h2>
          <ul className="divide-y divide-edge">
            {auctions.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/fiche?id=${a.id}`}
                  className="flex items-center justify-between py-2 hover:bg-surface-2 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <span className="font-medium">{a.title}</span>
                  <ScoreStars score={a.score} size="sm" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
      {hint && <div className="text-[10px] text-muted mt-0.5">{hint}</div>}
    </div>
  );
}

/** Édition des champs manuels de la fiche. */
function ProductEditor({
  product,
  onSaved,
}: {
  product: Product;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: product.name,
    brand: product.brand,
    category: product.category,
    aliases: product.aliases.join(", "),
    priceNew: product.priceNew,
    notes: product.notes,
    checkPoints: product.checkPoints,
  });
  const [accessories, setAccessories] = useState(product.accessories);
  const [newAccessory, setNewAccessory] = useState({ label: "", delta: 10 });
  const [saved, setSaved] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveProduct(
      {
        name: form.name.trim() || product.name,
        brand: form.brand.trim(),
        category: form.category,
        aliases: form.aliases
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        priceNew: form.priceNew,
        notes: form.notes,
        checkPoints: form.checkPoints,
        accessories,
      },
      product.id
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onSaved();
  }

  return (
    <form
      onSubmit={handleSave}
      className="rounded-xl border border-edge bg-surface p-4 space-y-3"
    >
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
        Fiche
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label">Nom</label>
          <input
            className="field"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="field-label">Marque</label>
          <input
            className="field"
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
          />
        </div>
        <div>
          <label className="field-label">Catégorie</label>
          <select
            className="field"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Prix neuf (€)</label>
          <input
            className="field"
            type="number"
            min={0}
            value={form.priceNew ?? ""}
            placeholder="—"
            onChange={(e) =>
              setForm({
                ...form,
                priceNew: e.target.value === "" ? null : Number(e.target.value),
              })
            }
          />
        </div>
      </div>
      <div>
        <label className="field-label">
          Alias <span className="text-muted">(séparés par des virgules — aident la reconnaissance des titres)</span>
        </label>
        <input
          className="field"
          placeholder="Ex : 100-400 II, EF 100-400L IS II"
          value={form.aliases}
          onChange={(e) => setForm({ ...form, aliases: e.target.value })}
        />
      </div>
      <div>
        <label className="field-label">Points à vérifier (un par ligne)</label>
        <textarea
          className="field min-h-16"
          value={form.checkPoints}
          onChange={(e) => setForm({ ...form, checkPoints: e.target.value })}
        />
      </div>
      <div>
        <label className="field-label">Notes</label>
        <textarea
          className="field min-h-16"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
      </div>

      {/* Équipements avec plus-value */}
      <div className="space-y-2">
        <label className="field-label">
          🧩 Équipements avec plus-value{" "}
          <span className="text-muted">
            (cochés lot par lot dans l&apos;analyse — ex. alimentation,
            boîtier, carte SD. Pour les variantes comme la RAM, créez plutôt
            une fiche par variante.)
          </span>
        </label>
        {accessories.length > 0 && (
          <ul className="space-y-1.5">
            {accessories.map((a, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{a.label}</span>
                <span className="text-positive font-medium">+{a.delta} €</span>
                <button
                  type="button"
                  onClick={() =>
                    setAccessories(accessories.filter((_, j) => j !== i))
                  }
                  className="text-negative text-xs hover:underline"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            className="field flex-1"
            placeholder="Ex : Alimentation officielle"
            value={newAccessory.label}
            onChange={(e) =>
              setNewAccessory({ ...newAccessory, label: e.target.value })
            }
          />
          <input
            className="field w-24"
            type="number"
            title="Plus-value en €"
            value={newAccessory.delta === 0 ? "" : newAccessory.delta}
            onChange={(e) =>
              setNewAccessory({
                ...newAccessory,
                delta: e.target.value === "" ? 0 : Number(e.target.value),
              })
            }
          />
          <button
            type="button"
            disabled={!newAccessory.label.trim()}
            onClick={() => {
              setAccessories([
                ...accessories,
                { label: newAccessory.label.trim(), delta: newAccessory.delta },
              ]);
              setNewAccessory({ label: "", delta: 10 });
            }}
            className="rounded-lg border border-edge px-3 text-sm hover:bg-surface-2 disabled:opacity-40 transition-colors"
          >
            + €
          </button>
        </div>
      </div>
      <button
        type="submit"
        className="rounded-lg bg-accent text-background font-semibold px-4 py-2 text-sm hover:opacity-90 transition-opacity"
      >
        {saved ? "✔ Enregistré" : "Enregistrer la fiche"}
      </button>
    </form>
  );
}

/** Liste + ajout des ventes observées. */
function ObservationsSection({
  productId,
  observations,
  onChanged,
}: {
  productId: string;
  observations: Observation[];
  onChanged: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    date: today,
    price: 0,
    kind: "vente" as Observation["kind"],
    source: "leboncoin" as ObservationSource,
    url: "",
    notes: "",
  });

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (form.price <= 0) return;
    addObservation({ productId, ...form });
    setForm({ ...form, price: 0, url: "", notes: "" });
    onChanged();
  }

  const sourceLabel = (s: string) =>
    OBSERVATION_SOURCES.find((x) => x.value === s)?.label ?? s;
  const kindLabel = (k: string) =>
    OBSERVATION_KINDS.find((x) => x.value === k)?.label ?? k;

  return (
    <section className="rounded-xl border border-edge bg-surface p-4 space-y-4">
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
        🗒 Ventes observées ({observations.length})
      </h2>

      {/* Ajout */}
      <form onSubmit={handleAdd} className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
        <div>
          <label className="field-label">Date</label>
          <input
            className="field"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>
        <div>
          <label className="field-label">Prix (€)</label>
          <input
            className="field"
            type="number"
            min={0}
            value={form.price === 0 ? "" : form.price}
            placeholder="0"
            onChange={(e) =>
              setForm({ ...form, price: e.target.value === "" ? 0 : Number(e.target.value) })
            }
          />
        </div>
        <div>
          <label className="field-label">Type</label>
          <select
            className="field"
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value as Observation["kind"] })}
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
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value as ObservationSource })}
          >
            {OBSERVATION_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Lien (optionnel)</label>
          <input
            className="field"
            type="url"
            placeholder="https://…"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
        </div>
        <button
          type="submit"
          disabled={form.price <= 0}
          className="rounded-lg bg-accent text-background font-semibold px-4 py-2 text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          + Ajouter
        </button>
      </form>

      {/* Liste */}
      {observations.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted border-b border-edge">
              <tr>
                <th className="text-left font-medium py-2 pr-4">Date</th>
                <th className="text-right font-medium py-2 pr-4">Prix</th>
                <th className="text-left font-medium py-2 pr-4">Type</th>
                <th className="text-left font-medium py-2 pr-4">Source</th>
                <th className="text-left font-medium py-2 pr-4">Note</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {observations.map((o) => (
                <tr key={o.id} className={o.rejected ? "opacity-50" : ""}>
                  <td className="py-2 pr-4">{dateFr(o.date)}</td>
                  <td
                    className={`py-2 pr-4 text-right font-medium ${o.rejected ? "line-through" : ""}`}
                  >
                    {euro(o.price)}
                  </td>
                  <td className="py-2 pr-4">
                    {o.rejected ? (
                      <span className="text-negative text-xs">
                        🚫 Rejetée — {o.rejectReason}
                      </span>
                    ) : (
                      kindLabel(o.kind)
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {o.url ? (
                      <a
                        href={o.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline"
                      >
                        {sourceLabel(o.source)} ↗
                      </a>
                    ) : (
                      sourceLabel(o.source)
                    )}
                  </td>
                  <td className="py-2 pr-4 text-muted text-xs max-w-48 truncate">
                    {o.notes}
                  </td>
                  <td className="py-2 text-right whitespace-nowrap">
                    {o.rejected ? (
                      <button
                        onClick={() => {
                          restoreObservation(o.id);
                          onChanged();
                        }}
                        className="text-positive text-xs hover:underline mr-2"
                        title="Réintégrer dans les statistiques"
                      >
                        ↩
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          const reason = window.prompt(
                            `Raison du rejet ? (${REJECT_REASONS.join(", ")})`,
                            "Prix aberrant"
                          );
                          if (reason === null) return;
                          rejectObservation(o.id, reason || "Prix aberrant");
                          onChanged();
                        }}
                        className="text-accent text-xs hover:underline mr-2"
                        title="Rejeter (exclue des stats, conservée pour mémoire)"
                      >
                        🚫
                      </button>
                    )}
                    <button
                      onClick={() => {
                        deleteObservation(o.id);
                        onChanged();
                      }}
                      className="text-negative text-xs hover:underline"
                      title="Supprimer définitivement"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
