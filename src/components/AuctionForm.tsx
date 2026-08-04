"use client";

/**
 * Formulaire d'analyse d'une enchère.
 *
 * Le moteur (fonctions pures) tourne directement dans le navigateur :
 * l'analyse se met à jour en temps réel pendant la saisie. À l'enregistrement,
 * le serveur revalide et recalcule tout — le client n'est jamais la source de
 * vérité des chiffres persistés.
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  analyzeAuction,
  CATEGORIES,
  CATEGORY_LABELS,
  CONDITIONS,
  type AuctionInput,
} from "@/lib/engine";
import { AnalysisPanel } from "./AnalysisPanel";

export interface AuctionFormValues extends AuctionInput {
  sourceUrl: string;
  title: string;
  auctionHouse: string;
  location: string;
  comments: string;
}

const EMPTY: AuctionFormValues = {
  sourceUrl: "",
  title: "",
  auctionHouse: "",
  location: "",
  comments: "",
  currentPrice: 0,
  buyerFeePct: 20,
  vatPct: 0,
  travelCost: 0,
  shippingCost: 0,
  condition: "bon",
  category: "autre",
  refurbHours: 0,
  resaleFast: 0,
  resaleNormal: 0,
  resaleOptimized: 0,
};

export function AuctionForm({
  initialValues,
  auctionId,
}: {
  initialValues?: Partial<AuctionFormValues>;
  /** Si fourni, le formulaire édite une enchère existante (PUT). */
  auctionId?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<AuctionFormValues>({
    ...EMPTY,
    ...initialValues,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analysis = useMemo(() => analyzeAuction(values), [values]);

  const set = <K extends keyof AuctionFormValues>(
    key: K,
    value: AuctionFormValues[K]
  ) => setValues((v) => ({ ...v, [key]: value }));

  const num =
    (key: keyof AuctionFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      set(key, (e.target.value === "" ? 0 : Number(e.target.value)) as never);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        auctionId ? `/api/auctions/${auctionId}` : "/api/auctions",
        {
          method: auctionId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Erreur ${res.status}`);
      }
      const auction = await res.json();
      router.push(`/encheres/${auction.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue");
      setSaving(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-8 items-start">
      {/* ------------------------------ Formulaire ------------------------ */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <Section title="Annonce">
          <div>
            <label className="field-label">
              URL de l&apos;enchère{" "}
              <span className="text-muted">
                (analyse automatique prévue dans une future version)
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
          </div>
        </Section>

        <Section title="Coûts">
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Prix actuel (€)" value={values.currentPrice} onChange={num("currentPrice")} />
            <NumberField label="Frais acheteur (%)" value={values.buyerFeePct} onChange={num("buyerFeePct")} step={0.1} />
            <NumberField label="TVA (%)" value={values.vatPct} onChange={num("vatPct")} step={0.1} />
            <NumberField label="Déplacement (€)" value={values.travelCost} onChange={num("travelCost")} />
            <NumberField label="Livraison (€)" value={values.shippingCost} onChange={num("shippingCost")} />
            <NumberField label="Remise en état (heures)" value={values.refurbHours} onChange={num("refurbHours")} step={0.5} />
          </div>
        </Section>

        <Section title="Estimation de revente">
          <div className="grid grid-cols-3 gap-3">
            <NumberField label="Rapide (€)" value={values.resaleFast} onChange={num("resaleFast")} />
            <NumberField label="Normale (€)" value={values.resaleNormal} onChange={num("resaleNormal")} />
            <NumberField label="Optimisée (€)" value={values.resaleOptimized} onChange={num("resaleOptimized")} />
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
          disabled={saving}
          className="w-full rounded-lg bg-accent text-background font-semibold py-2.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving
            ? "Enregistrement…"
            : auctionId
              ? "Mettre à jour l'analyse"
              : "Enregistrer l'analyse"}
        </button>
      </form>

      {/* --------------------------- Aperçu en direct --------------------- */}
      <div className="lg:sticky lg:top-20">
        <h2 className="text-sm font-semibold text-muted mb-3 uppercase tracking-wide">
          Analyse en direct
        </h2>
        <AnalysisPanel analysis={analysis} />
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
}: {
  label: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  step?: number;
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
    </div>
  );
}
