"use client";

/**
 * Formulaire d'analyse d'une enchère.
 *
 * Le moteur (fonctions pures) tourne directement dans le navigateur :
 * l'analyse se met à jour en temps réel pendant la saisie. À l'enregistrement,
 * la couche de stockage recalcule et persiste le tout (localStorage).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  accessoryBonus,
  adjustSuggestions,
  analyzeAuction,
  averageSaleDelay,
  dataMaturity,
  explainRecommendation,
  LOT_ORIGINS,
  lotOriginMeta,
  measuredPopularity,
  measuredProbabilities,
  myVsMarket,
  opportunityVerdict,
  opportunityZones,
  recommendationConfidence,
  priceStability,
  CATEGORIES,
  CATEGORY_LABELS,
  CONDITIONS,
  emptyAuctionInput,
  matchesTitle,
  productStats,
  type AuctionInput,
  type KnowledgeContext,
} from "@/lib/engine";
import {
  allObservations,
  listProducts,
  saveAuction,
  type AuctionDraft,
  type Product,
} from "@/lib/storage";
import { euro, hours } from "@/lib/format";
import { ebaySoldSearchUrl } from "@/lib/import/market";
import { AnalysisPanel } from "./AnalysisPanel";
import { ConfidenceBadge, MaturityBadge } from "./KnowledgeBadges";

/** Au-delà de cet âge, le marché est considéré comme ancien (90 jours). */
const STALE_DAYS = 90;

const EMPTY: AuctionDraft = {
  ...emptyAuctionInput(),
  sourceUrl: "",
  title: "",
  auctionHouse: "",
  location: "",
  comments: "",
  endDate: "",
  photos: [],
  buyerFeePct: 20,
};

export function AuctionForm({
  initialValues,
  auctionId,
}: {
  initialValues?: Partial<AuctionDraft>;
  /** Si fourni, le formulaire édite une enchère existante. */
  auctionId?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<AuctionDraft>({
    ...EMPTY,
    ...initialValues,
  });
  const [photosText, setPhotosText] = useState(
    (initialValues?.photos ?? []).join("\n")
  );
  const [error, setError] = useState<string | null>(null);

  // --- Base de connaissances : liaison à une fiche produit ---
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => setProducts(listProducts()), []);
  const linkedProduct = products.find((p) => p.id === values.productId) ?? null;
  const suggestions = useMemo(
    () =>
      values.productId
        ? []
        : products.filter((p) => matchesTitle(values.title, p.name, p.aliases)).slice(0, 3),
    [products, values.title, values.productId]
  );
  const knownObs = useMemo(
    () =>
      linkedProduct
        ? allObservations().filter(
            (o) => o.productId === linkedProduct.id && !o.rejected
          )
        : [],
    [linkedProduct]
  );
  const knownStats = useMemo(
    () => (linkedProduct ? productStats(knownObs) : null),
    [linkedProduct, knownObs]
  );
  const zones = useMemo(() => opportunityZones(knownObs), [knownObs]);
  const zoneVerdict =
    zones && values.currentPrice > 0
      ? opportunityVerdict(values.currentPrice, zones)
      : null;

  // 🔎 Reconnaissance automatique : liaison d'office quand un seul produit
  // correspond au titre (l'utilisateur peut toujours détacher).
  const autoLinked = useRef(false);
  useEffect(() => {
    if (autoLinked.current || values.productId || auctionId) return;
    if (suggestions.length === 1) {
      autoLinked.current = true;
      setValues((v) => ({ ...v, productId: suggestions[0].id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions]);

  // Fraîcheur du marché : dernière observation > 90 jours → actualisation.
  const staleness = useMemo(() => {
    const last = knownStats?.last?.date;
    if (!last) return null;
    const ageDays = Math.floor(
      (Date.now() - new Date(last).getTime()) / 86_400_000
    );
    return { ageDays, stale: ageDays > STALE_DAYS };
  }, [knownStats]);

  const ebaySearch = ebaySoldSearchUrl(
    linkedProduct ? linkedProduct.name : values.title
  );
  // Équipements inclus dans ce lot → plus-value sur les prix suggérés.
  const included = values.accessoriesIncluded ?? [];
  const bonus = linkedProduct
    ? accessoryBonus(linkedProduct.accessories, included)
    : 0;
  const adjusted =
    knownStats && knownStats.suggestedNormal !== undefined
      ? adjustSuggestions(knownStats, bonus)
      : null;

  // Graduation : le contexte de connaissances remplace les heuristiques par
  // des valeurs mesurées (popularité réelle, probabilités réelles).
  const knowledgeCtx = useMemo<KnowledgeContext | undefined>(() => {
    if (!linkedProduct || knownObs.length === 0) return undefined;
    const pop = measuredPopularity(knownObs);
    const probs = measuredProbabilities(knownObs);
    const ctx: KnowledgeContext = {};
    if (pop.provenance !== "heuristique")
      ctx.popularity = { score: pop.score, provenance: pop.provenance };
    if (probs)
      ctx.probabilities = {
        provenance: probs.provenance,
        rapidePct: probs.rapidePct,
        normalPct: probs.normalPct,
        optimisePct: probs.optimisePct,
      };
    return ctx.popularity || ctx.probabilities ? ctx : undefined;
  }, [linkedProduct, knownObs]);

  const maturity = useMemo(
    () => (linkedProduct ? dataMaturity(knownObs) : null),
    [linkedProduct, knownObs]
  );

  // « Pourquoi ce conseil ? » — uniquement des faits mesurés.
  const recommendation = useMemo(() => {
    if (!linkedProduct || !knownStats || knownStats.count === 0) return null;
    return explainRecommendation({
      currentPrice: values.currentPrice,
      stats: knownStats,
      zones,
      stability: priceStability(knownObs),
      performance: myVsMarket(knownObs),
      saleDelay: averageSaleDelay(knownObs),
    });
  }, [linkedProduct, knownStats, knownObs, zones, values.currentPrice]);

  const analysis = useMemo(
    () => analyzeAuction(values, knowledgeCtx),
    [values, knowledgeCtx]
  );

  // Confiance dans la recommandation : distincte du score de l'affaire.
  const confidence = useMemo(() => {
    const completeness =
      analysis.criteria.find((c) => c.key === "confiance")?.value ?? 0;
    return recommendationConfidence(
      completeness,
      knownStats && knownStats.count > 0 ? knownStats.confidence : undefined,
      lotOriginMeta(values.lotOrigin)?.confidencePenalty ?? 0
    );
  }, [analysis, knownStats, values.lotOrigin]);
  const totalHours =
    values.refurbHours +
    values.cleaningHours +
    values.photoHours +
    values.listingHours +
    values.packingHours +
    values.savHours;

  const set = <K extends keyof AuctionDraft>(key: K, value: AuctionDraft[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const num =
    (key: keyof AuctionDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
      set(key, (e.target.value === "" ? 0 : Number(e.target.value)) as never);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!values.title.trim()) {
      setError("Le titre est obligatoire.");
      return;
    }
    try {
      const photos = photosText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.startsWith("http"));
      const record = saveAuction({ ...values, photos }, auctionId);
      router.push(`/fiche?id=${record.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
      {/* ------------------------------ Formulaire ------------------------ */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <Section title="Annonce">
          <div>
            <label className="field-label">
              URL de l&apos;annonce{" "}
              <span className="text-muted">
                (remplie automatiquement par l&apos;import ⚡ ci-dessus)
              </span>
            </label>
            <input
              className="field"
              type="url"
              placeholder="https://www.interencheres.com/…"
              value={values.sourceUrl}
              onChange={(e) => set("sourceUrl", e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Titre *</label>
            <input
              className="field"
              required
              placeholder="Ex : Canon EF 100-400 L II"
              value={values.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Catégorie</label>
              <select
                className="field"
                value={values.category}
                onChange={(e) => set("category", e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">État</label>
              <select
                className="field"
                value={values.condition}
                onChange={(e) =>
                  set("condition", e.target.value as AuctionInput["condition"])
                }
              >
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">
                Origine du lot{" "}
                <span className="text-muted">(pénalise risque et budget)</span>
              </label>
              <select
                className="field"
                value={values.lotOrigin}
                onChange={(e) => set("lotOrigin", e.target.value)}
              >
                <option value="">Aucune / inconnue</option>
                {LOT_ORIGINS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} (budget −{o.budgetReductionPct} %)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Maison de vente</label>
              <input
                className="field"
                placeholder="Ex : Hôtel des ventes de Caen"
                value={values.auctionHouse}
                onChange={(e) => set("auctionHouse", e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Localisation</label>
              <input
                className="field"
                placeholder="Ex : Caen (14)"
                value={values.location}
                onChange={(e) => set("location", e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Fin de l&apos;enchère</label>
              <input
                className="field"
                type="date"
                value={values.endDate}
                onChange={(e) => set("endDate", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="field-label">
              📷 Photos <span className="text-muted">(une URL par ligne)</span>
            </label>
            <textarea
              className="field min-h-16 font-mono text-xs"
              placeholder={"https://…/photo1.jpg\nhttps://…/photo2.jpg"}
              value={photosText}
              onChange={(e) => setPhotosText(e.target.value)}
            />
          </div>
        </Section>

        <Section title="Coûts d'achat">
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Prix actuel (€)" value={values.currentPrice} onChange={num("currentPrice")} />
            <NumberField label="Frais acheteur (%)" value={values.buyerFeePct} onChange={num("buyerFeePct")} step={0.1} />
            <NumberField
              label="Frais plateforme (%)"
              value={values.platformFeePct}
              onChange={num("platformFeePct")}
              step={0.1}
              hint="Interencheres 1,8 %, frais Live…"
            />
            <NumberField label="TVA (%)" value={values.vatPct} onChange={num("vatPct")} step={0.1} />
            <NumberField label="Déplacement (€)" value={values.travelCost} onChange={num("travelCost")} />
            <NumberField label="Livraison (€)" value={values.shippingCost} onChange={num("shippingCost")} />
          </div>
        </Section>

        <Section title="Base de connaissances">
          {linkedProduct ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm">
                  📚 <b>Produit connu :</b>{" "}
                  <Link
                    href={`/objet?id=${linkedProduct.id}`}
                    className="text-accent hover:underline"
                  >
                    {linkedProduct.name}
                  </Link>{" "}
                  {knownStats && knownStats.count > 0 && (
                    <span className="text-muted">
                      ({knownStats.count} observation{knownStats.count > 1 ? "s" : ""})
                    </span>
                  )}
                  {staleness && !staleness.stale && (
                    <span className="text-positive text-xs"> · marché récent ✓</span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  {maturity && (
                    <MaturityBadge score={maturity.score} level={maturity.level} />
                  )}
                  {knownStats && <ConfidenceBadge value={knownStats.confidence} />}
                  <button
                    type="button"
                    onClick={() => set("productId", null)}
                    className="text-xs text-muted hover:text-negative"
                  >
                    Détacher
                  </button>
                </div>
              </div>
              {recommendation &&
                recommendation.positives.length + recommendation.negatives.length > 0 && (
                  <div className="rounded-lg border border-edge bg-surface-2 p-3">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                      Pourquoi ce conseil ? (basé sur tes données réelles)
                    </p>
                    <ul className="text-sm space-y-1">
                      {recommendation.positives.map((r) => (
                        <li key={r} className="text-positive">
                          ✓ {r}
                        </li>
                      ))}
                      {recommendation.negatives.map((r) => (
                        <li key={r} className="text-negative">
                          ✗ {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              {linkedProduct.accessories.length > 0 && (
                <div className="rounded-lg border border-edge bg-surface-2 p-3 space-y-1.5">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                    🧩 Inclus dans ce lot ?
                  </p>
                  {linkedProduct.accessories.map((a) => (
                    <label
                      key={a.label}
                      className="flex items-center gap-2 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="accent-[var(--accent)]"
                        checked={included.includes(a.label)}
                        onChange={(e) =>
                          set(
                            "accessoriesIncluded",
                            e.target.checked
                              ? [...included, a.label]
                              : included.filter((l) => l !== a.label)
                          )
                        }
                      />
                      <span className="flex-1">{a.label}</span>
                      <span className="text-positive text-xs">+{a.delta} €</span>
                    </label>
                  ))}
                  {bonus > 0 && (
                    <p className="text-xs text-positive pt-1 border-t border-edge">
                      Plus-value des équipements inclus : +{bonus} €
                    </p>
                  )}
                </div>
              )}
              {staleness?.stale && (
                <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm">
                  🟠 <b>Marché ancien</b> : dernière observation il y a{" "}
                  {Math.round(staleness.ageDays / 30)} mois — actualisation
                  recommandée avant de vous fier aux prix suggérés.{" "}
                  <a
                    href={ebaySearch}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline font-medium"
                  >
                    Ouvrir la recherche eBay « ventes réussies » ↗
                  </a>{" "}
                  <span className="text-muted">
                    puis « 📊 Actualiser le marché » via l&apos;extension.
                  </span>
                </div>
              )}
              {zones && (
                <div
                  className={`rounded-lg border p-3 text-sm ${
                    zoneVerdict?.level === "excellent"
                      ? "border-positive/40 bg-positive/5"
                      : zoneVerdict?.level === "faible"
                        ? "border-negative/40 bg-negative/5"
                        : "border-edge bg-surface-2"
                  }`}
                >
                  <p>
                    🎯 <b>Prix d&apos;opportunité :</b> excellente affaire sous{" "}
                    <b>{euro(zones.opportunityPrice)}</b>, intéressant
                    jusqu&apos;à <b>{euro(zones.fairPrice)}</b>
                  </p>
                  {zoneVerdict && (
                    <p className="mt-1 font-medium">
                      Au prix actuel ({euro(values.currentPrice)}) :{" "}
                      {zoneVerdict.label}
                    </p>
                  )}
                </div>
              )}
              {adjusted && knownStats ? (
                <div className="rounded-lg border border-accent/40 bg-accent/5 p-3 space-y-2 text-sm">
                  <p>
                    💡 Analyse intelligente : prix suggérés{" "}
                    <b>{euro(adjusted.suggestedFast!)}</b> /{" "}
                    <b>{euro(adjusted.suggestedNormal!)}</b> /{" "}
                    <b>{euro(adjusted.suggestedPremium!)}</b>
                    {bonus > 0 && (
                      <span className="text-positive"> (équipements inclus : +{bonus} €)</span>
                    )}
                    {knownStats.typicalAuctionPrice !== undefined && (
                      <span className="text-muted">
                        {" "}
                        · adjudication typique {euro(knownStats.typicalAuctionPrice)}
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setValues((v) => ({
                        ...v,
                        resaleFast: adjusted.suggestedFast!,
                        resaleNormal: adjusted.suggestedNormal!,
                        resaleOptimized: adjusted.suggestedPremium!,
                      }))
                    }
                    className="rounded-lg bg-accent text-background font-semibold px-3 py-1.5 text-xs hover:opacity-90 transition-opacity"
                  >
                    Utiliser les prix connus{bonus > 0 ? " (ajustés)" : ""}
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted">
                  Pas encore d&apos;observations pour ce produit.{" "}
                  <a
                    href={ebaySearch}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    Ouvrir la recherche eBay « ventes réussies » ↗
                  </a>{" "}
                  puis « 📊 Actualiser le marché » via l&apos;extension pour
                  activer l&apos;analyse intelligente.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted">
                ❓ <b>Produit inconnu</b> → analyse simple. Liez une fiche
                produit pour activer l&apos;analyse intelligente
                {values.title.trim().length >= 6 && (
                  <>
                    {" "}
                    — ou{" "}
                    <a
                      href={ebaySearch}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      ouvrir la recherche eBay correspondante ↗
                    </a>
                  </>
                )}
                .
              </p>
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => set("productId", p.id)}
                      className="rounded-full border border-accent/40 bg-accent/10 text-accent px-3 py-1 text-xs hover:bg-accent/20 transition-colors"
                    >
                      🔗 Lier à « {p.name} »
                    </button>
                  ))}
                </div>
              )}
              {products.length > 0 && (
                <select
                  className="field"
                  value=""
                  onChange={(e) => e.target.value && set("productId", e.target.value)}
                >
                  <option value="">Lier à une fiche existante…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs">
                <Link href="/objets" className="text-accent hover:underline">
                  Créer une fiche produit →
                </Link>
              </p>
            </div>
          )}
        </Section>

        <Section title="Estimation de revente">
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Rapide (€)" value={values.resaleFast} onChange={num("resaleFast")} />
            <NumberField label="Normale (€)" value={values.resaleNormal} onChange={num("resaleNormal")} />
            <NumberField label="Optimisée (€)" value={values.resaleOptimized} onChange={num("resaleOptimized")} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <NumberField
              label="Commission plateforme (%)"
              value={values.sellingFeePct}
              onChange={num("sellingFeePct")}
              step={0.1}
              hint="eBay, PayPal…"
            />
            <NumberField
              label="Frais de revente (€)"
              value={values.sellingMiscCost}
              onChange={num("sellingMiscCost")}
              hint="essence, cartons, scotch…"
            />
            <NumberField
              label="Gain minimum visé (€)"
              value={values.minProfitTarget}
              onChange={num("minProfitTarget")}
              hint="en dessous : pas la peine"
            />
          </div>
        </Section>

        <Section
          title={`Temps de travail — total : ${hours(totalHours)}`}
        >
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Remise en état (h)" value={values.refurbHours} onChange={num("refurbHours")} step={0.25} />
            <NumberField label="Nettoyage (h)" value={values.cleaningHours} onChange={num("cleaningHours")} step={0.25} />
            <NumberField label="Photos (h)" value={values.photoHours} onChange={num("photoHours")} step={0.25} />
            <NumberField label="Annonce (h)" value={values.listingHours} onChange={num("listingHours")} step={0.25} />
            <NumberField label="Emballage (h)" value={values.packingHours} onChange={num("packingHours")} step={0.25} />
            <NumberField label="SAV (h)" value={values.savHours} onChange={num("savHours")} step={0.25} />
          </div>
        </Section>

        <Section title="Commentaires">
          <textarea
            className="field min-h-24"
            placeholder="Points à vérifier, accessoires inclus, remarques…"
            value={values.comments}
            onChange={(e) => set("comments", e.target.value)}
          />
        </Section>

        {error && (
          <p className="text-sm text-negative border border-negative/40 bg-negative/10 rounded-lg p-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-lg bg-accent text-background font-semibold py-2.5 hover:opacity-90 transition-opacity"
        >
          {auctionId ? "Mettre à jour l'analyse" : "Enregistrer l'analyse"}
        </button>
      </form>

      {/* --------------------------- Aperçu en direct --------------------- */}
      <div className="lg:sticky lg:top-20">
        <h2 className="text-sm font-semibold text-muted mb-3 uppercase tracking-wide">
          Analyse en direct
        </h2>
        <AnalysisPanel analysis={analysis} confidence={confidence} />
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="rounded-xl border border-edge bg-surface p-4 space-y-3">
      <legend className="px-2 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = 1,
  hint,
}: {
  label: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  step?: number;
  hint?: string;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        className="field"
        type="number"
        min={0}
        step={step}
        value={value === 0 ? "" : value}
        placeholder="0"
        onChange={onChange}
      />
      {hint && <p className="text-[10px] text-muted mt-0.5">{hint}</p>}
    </div>
  );
}
