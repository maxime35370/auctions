"use client";

/**
 * Courbe des prix observés d'un produit — SVG pur, sans dépendance.
 * Points colorés par type : vente (vert), enchère (jaune), annonce (gris).
 */
import { dateFr, euro } from "@/lib/format";

export interface ChartPoint {
  date: string; // YYYY-MM-DD
  price: number;
  kind: "vente" | "enchere" | "annonce";
}

const KIND_COLOR: Record<ChartPoint["kind"], string> = {
  vente: "var(--positive)",
  enchere: "var(--accent)",
  annonce: "var(--muted)",
};

export function PriceChart({ points }: { points: ChartPoint[] }) {
  const sorted = [...points]
    .filter((p) => p.price > 0 && p.date)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (sorted.length < 2) {
    return (
      <p className="text-sm text-muted p-4 text-center">
        La courbe apparaîtra à partir de 2 observations.
      </p>
    );
  }

  const W = 640;
  const H = 220;
  const PAD = { top: 16, right: 16, bottom: 28, left: 56 };

  const times = sorted.map((p) => new Date(p.date).getTime());
  const prices = sorted.map((p) => p.price);
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const pMin = Math.min(...prices);
  const pMax = Math.max(...prices);
  const pSpan = pMax - pMin || 1;
  const tSpan = tMax - tMin || 1;

  const x = (t: number) => PAD.left + ((t - tMin) / tSpan) * (W - PAD.left - PAD.right);
  const y = (p: number) =>
    H - PAD.bottom - ((p - pMin) / pSpan) * (H - PAD.top - PAD.bottom);

  const path = sorted
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(new Date(p.date).getTime()).toFixed(1)},${y(p.price).toFixed(1)}`)
    .join(" ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Courbe des prix observés"
      >
        {/* Lignes de repère min / max */}
        {[pMin, pMax].map((p) => (
          <g key={p}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(p)}
              y2={y(p)}
              stroke="var(--border)"
              strokeDasharray="4 4"
            />
            <text
              x={PAD.left - 6}
              y={y(p) + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--muted)"
            >
              {euro(p)}
            </text>
          </g>
        ))}

        {/* Dates de début / fin */}
        <text x={PAD.left} y={H - 8} fontSize="11" fill="var(--muted)">
          {dateFr(sorted[0].date)}
        </text>
        <text
          x={W - PAD.right}
          y={H - 8}
          textAnchor="end"
          fontSize="11"
          fill="var(--muted)"
        >
          {dateFr(sorted[sorted.length - 1].date)}
        </text>

        {/* Courbe */}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" />

        {/* Points */}
        {sorted.map((p, i) => (
          <circle
            key={i}
            cx={x(new Date(p.date).getTime())}
            cy={y(p.price)}
            r="4"
            fill={KIND_COLOR[p.kind]}
          >
            <title>{`${dateFr(p.date)} — ${euro(p.price)} (${p.kind})`}</title>
          </circle>
        ))}
      </svg>
      <div className="flex gap-4 text-[11px] text-muted mt-1 px-1">
        <span><span className="text-positive">●</span> Vente conclue</span>
        <span><span className="text-accent">●</span> Adjudication</span>
        <span>● Prix affiché</span>
      </div>
    </div>
  );
}
