"use client";

/** Petits badges de la base de connaissances : confiance et tendance. */

export function ConfidenceBadge({ value }: { value: number }) {
  const tone =
    value >= 70
      ? "border-positive/40 bg-positive/10 text-positive"
      : value >= 40
        ? "border-accent/40 bg-accent/10 text-accent"
        : "border-edge text-muted";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${tone}`}>
      Confiance {value} %
    </span>
  );
}

/** 🟢 Mesuré / 🟡 Estimé / 🔴 Heuristique — sur quoi repose l'information. */
export function ProvenanceBadge({
  value,
}: {
  value: "mesure" | "estime" | "heuristique" | undefined;
}) {
  if (!value) return null;
  const meta = {
    mesure: { label: "🟢 Mesuré", cls: "border-positive/40 text-positive" },
    estime: { label: "🟡 Estimé", cls: "border-accent/40 text-accent" },
    heuristique: { label: "🔴 Heuristique", cls: "border-edge text-muted" },
  }[value];
  return (
    <span
      className={`rounded-full border px-1.5 py-0.5 text-[10px] whitespace-nowrap ${meta.cls}`}
      title={
        value === "mesure"
          ? "Basé sur ≥ 30 points de données réels"
          : value === "estime"
            ? "Basé sur 10 à 29 points de données"
            : "Valeur prédéfinie — remplacée automatiquement quand les données arrivent"
      }
    >
      {meta.label}
    </span>
  );
}

/** Taux de maturité des données d'un produit. */
export function MaturityBadge({
  score,
  level,
}: {
  score: number;
  level: "fiable" | "partiel" | "insuffisant";
}) {
  const meta = {
    fiable: { label: "🟢 Données fiables", cls: "border-positive/40 bg-positive/10 text-positive" },
    partiel: { label: "🟡 Données partielles", cls: "border-accent/40 bg-accent/10 text-accent" },
    insuffisant: { label: "🔴 Données insuffisantes", cls: "border-negative/40 bg-negative/10 text-negative" },
  }[level];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs whitespace-nowrap ${meta.cls}`}>
      {meta.label} · {score} %
    </span>
  );
}

export function Trend({ pct }: { pct: number }) {
  if (Math.abs(pct) < 3) return <span className="text-muted">➡ stable</span>;
  return pct > 0 ? (
    <span className="text-positive">↗ +{pct.toFixed(0)} %</span>
  ) : (
    <span className="text-negative">↘ {pct.toFixed(0)} %</span>
  );
}
