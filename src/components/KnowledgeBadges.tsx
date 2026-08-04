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

export function Trend({ pct }: { pct: number }) {
  if (Math.abs(pct) < 3) return <span className="text-muted">➡ stable</span>;
  return pct > 0 ? (
    <span className="text-positive">↗ +{pct.toFixed(0)} %</span>
  ) : (
    <span className="text-negative">↘ {pct.toFixed(0)} %</span>
  );
}
