"use client";

/**
 * Tableau de bord : vue d'ensemble des enchères analysées.
 * Toutes les données vivent dans le navigateur (voir src/lib/storage.ts).
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { CATEGORY_LABELS, type Category } from "@/lib/engine";
import { listAuctions, type AuctionRecord } from "@/lib/storage";
import { loadExamples } from "@/lib/examples";
import { euro, pct } from "@/lib/format";
import { ScoreStars } from "@/components/ScoreStars";

export default function DashboardPage() {
  const [auctions, setAuctions] = useState<AuctionRecord[] | null>(null);

  useEffect(() => {
    setAuctions(listAuctions());
  }, []);

  if (auctions === null) return null; // premier rendu (avant lecture du stockage)

  const count = auctions.length;
  const gems = auctions.filter((a) => a.score >= 80);
  const avgRoi = count
    ? auctions.reduce((sum, a) => sum + a.roi, 0) / count
    : 0;

  const byCategory = new Map<string, { total: number; n: number }>();
  for (const a of auctions) {
    const entry = byCategory.get(a.category) ?? { total: 0, n: 0 };
    entry.total += a.roi;
    entry.n += 1;
    byCategory.set(a.category, entry);
  }
  const categories = [...byCategory.entries()]
    .map(([cat, { total, n }]) => ({ cat, avgRoi: total / n, n }))
    .sort((a, b) => b.avgRoi - a.avgRoi)
    .slice(0, 5);
  const maxCatRoi = Math.max(1, ...categories.map((c) => Math.abs(c.avgRoi)));

  const topOpportunities = [...auctions]
    .filter((a) => a.status === "analysee" || a.status === "suivie")
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <Link
          href="/analyse"
          className="rounded-lg bg-accent text-background font-semibold px-4 py-2 text-sm hover:opacity-90 transition-opacity"
        >
          + Nouvelle analyse
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Enchères observées" value={String(count)} />
        <StatCard label="Pépites (score ≥ 80)" value={String(gems.length)} accent />
        <StatCard label="ROI moyen" value={pct(avgRoi)} />
        <StatCard
          label="Bénéfice potentiel cumulé"
          value={euro(auctions.reduce((s, a) => s + Math.max(0, a.netProfit), 0))}
        />
      </div>

      {count === 0 ? (
        <div className="rounded-xl border border-edge bg-surface p-10 text-center space-y-3">
          <p className="text-3xl">🔍</p>
          <p className="font-semibold">Aucune enchère analysée pour le moment</p>
          <p className="text-sm text-muted">
            Commencez par analyser votre première enchère : l&apos;application
            calculera le coût réel, le budget conseillé et le potentiel de gain.
          </p>
          <div className="flex justify-center gap-3 mt-2">
            <Link
              href="/analyse"
              className="rounded-lg bg-accent text-background font-semibold px-4 py-2 text-sm"
            >
              Analyser une enchère
            </Link>
            <button
              onClick={() => {
                loadExamples();
                setAuctions(listAuctions());
              }}
              className="rounded-lg border border-edge px-4 py-2 text-sm hover:bg-surface-2 transition-colors"
            >
              Charger 3 exemples
            </button>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <section className="rounded-xl border border-edge bg-surface p-4">
            <h2 className="text-sm font-semibold text-muted mb-3 uppercase tracking-wide">
              🏆 Meilleures opportunités
            </h2>
            <ul className="divide-y divide-edge">
              {topOpportunities.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/fiche?id=${a.id}`}
                    className="flex items-center justify-between py-2.5 hover:bg-surface-2 rounded-lg px-2 -mx-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{a.title}</p>
                      <p className="text-xs text-muted">
                        Budget max {euro(a.maxBudget)} · bénéfice{" "}
                        {euro(a.netProfit)}
                      </p>
                    </div>
                    <ScoreStars score={a.score} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-edge bg-surface p-4">
            <h2 className="text-sm font-semibold text-muted mb-3 uppercase tracking-wide">
              Catégories les plus rentables
            </h2>
            <div className="space-y-3">
              {categories.map((c) => (
                <div key={c.cat}>
                  <div className="flex justify-between text-xs mb-1">
                    <span>
                      {CATEGORY_LABELS[c.cat as Category] ?? c.cat}{" "}
                      <span className="text-muted">({c.n})</span>
                    </span>
                    <span className="font-medium">{pct(c.avgRoi)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${c.avgRoi >= 0 ? "bg-positive" : "bg-negative"}`}
                      style={{
                        width: `${Math.min(100, (Math.abs(c.avgRoi) / maxCatRoi) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? "border-accent/50 bg-accent/5" : "border-edge bg-surface"
      }`}
    >
      <div className="text-xs text-muted">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
