"use client";

/**
 * Tableau de bord « Bloomberg » : pépite du jour, portefeuille, podium des
 * catégories, enchères qui se terminent bientôt, meilleures opportunités.
 * Toutes les données vivent dans le navigateur (voir src/lib/storage.ts).
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { CATEGORY_LABELS, type Category } from "@/lib/engine";
import {
  endingSoon,
  listAuctions,
  portfolioStats,
  realizedByCategory,
  type AuctionRecord,
} from "@/lib/storage";
import { loadExamples } from "@/lib/examples";
import { dateFr, euro, pct, signedEuro } from "@/lib/format";
import { ScoreStars } from "@/components/ScoreStars";

const catLabel = (c: string) => CATEGORY_LABELS[c as Category] ?? c;

export default function DashboardPage() {
  const [auctions, setAuctions] = useState<AuctionRecord[] | null>(null);

  useEffect(() => {
    setAuctions(listAuctions());
  }, []);

  if (auctions === null) return null;

  const count = auctions.length;
  const gems = auctions.filter((a) => a.score >= 80);
  const avgRoi = count
    ? auctions.reduce((sum, a) => sum + a.roi, 0) / count
    : 0;
  const stats = portfolioStats(auctions);
  const podium = realizedByCategory(auctions).slice(0, 3);
  const soon = endingSoon(auctions);

  const opportunities = [...auctions]
    .filter((a) => a.status === "analysee" || a.status === "suivie")
    .sort((a, b) => b.score - a.score);
  const gem = opportunities[0];
  const others = opportunities.slice(1, 6);

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
        <>
          {/* 🔥 Pépite du jour */}
          {gem && (
            <Link
              href={`/fiche?id=${gem.id}`}
              className="block rounded-xl border border-accent/50 bg-accent/5 p-5 hover:border-accent transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-accent uppercase tracking-wide">
                    🔥 Pépite du jour
                  </div>
                  <div className="text-xl font-bold mt-1">{gem.title}</div>
                  <div className="mt-1">
                    <ScoreStars score={gem.score} />
                  </div>
                </div>
                <div className="flex gap-6 text-center">
                  <div>
                    <div className="text-xs text-muted">Budget max</div>
                    <div className="text-lg font-bold">{euro(gem.maxBudget)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Gain estimé</div>
                    <div
                      className={`text-lg font-bold ${gem.netProfit >= 0 ? "text-positive" : "text-negative"}`}
                    >
                      {signedEuro(gem.netProfit)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted">Coût total</div>
                    <div className="text-lg font-bold">{euro(gem.totalCost)}</div>
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Statistiques clés */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Enchères observées" value={String(count)} />
            <StatCard label="Pépites (score ≥ 80)" value={String(gems.length)} accent />
            <StatCard label="ROI moyen estimé" value={pct(avgRoi)} />
            <StatCard
              label="Bénéfice réalisé"
              value={signedEuro(stats.realizedProfit)}
              tone={stats.realizedProfit > 0 ? "positive" : undefined}
            />
          </div>

          {/* 🏆 Portefeuille */}
          <Link
            href="/stock"
            className="block rounded-xl border border-edge bg-surface p-4 hover:border-accent/50 transition-colors"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-sm font-semibold text-muted uppercase tracking-wide">
                🏆 Mon portefeuille
              </div>
              <div className="flex flex-wrap gap-6 text-sm">
                <span>
                  Capital engagé : <b>{euro(stats.invested)}</b>
                </span>
                <span>
                  Valeur du stock : <b>{euro(stats.stockValue)}</b>
                </span>
                <span>
                  Bénéfice latent :{" "}
                  <b className={stats.latentProfit >= 0 ? "text-positive" : "text-negative"}>
                    {signedEuro(stats.latentProfit)}
                  </b>
                </span>
                <span className="text-accent">Voir le stock →</span>
              </div>
            </div>
          </Link>

          {/* ⚡ Enchères qui se terminent bientôt */}
          {soon.length > 0 && (
            <section className="rounded-xl border border-accent/40 bg-surface p-4">
              <h2 className="text-sm font-semibold text-accent mb-3 uppercase tracking-wide">
                ⚡ Se terminent bientôt
              </h2>
              <ul className="divide-y divide-edge">
                {soon.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/fiche?id=${a.id}`}
                      className="flex items-center justify-between py-2 hover:bg-surface-2 rounded-lg px-2 -mx-2 transition-colors"
                    >
                      <span className="font-medium">{a.title}</span>
                      <span className="text-sm text-muted">
                        fin : {dateFr(a.endDate)} · budget max {euro(a.maxBudget)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Meilleures opportunités */}
            <section className="rounded-xl border border-edge bg-surface p-4">
              <h2 className="text-sm font-semibold text-muted mb-3 uppercase tracking-wide">
                🏆 Meilleures opportunités
              </h2>
              {others.length === 0 && !gem ? (
                <p className="text-sm text-muted">Aucune opportunité en cours.</p>
              ) : (
                <ul className="divide-y divide-edge">
                  {(gem ? [gem, ...others] : others).map((a) => (
                    <li key={a.id}>
                      <Link
                        href={`/fiche?id=${a.id}`}
                        className="flex items-center justify-between py-2.5 hover:bg-surface-2 rounded-lg px-2 -mx-2 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{a.title}</p>
                          <p className="text-xs text-muted">
                            Budget max {euro(a.maxBudget)} · gain{" "}
                            {signedEuro(a.netProfit)}
                          </p>
                        </div>
                        <ScoreStars score={a.score} size="sm" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Podium réel ou ROI estimé par catégorie */}
            <section className="rounded-xl border border-edge bg-surface p-4">
              {podium.length > 0 ? (
                <>
                  <h2 className="text-sm font-semibold text-muted mb-3 uppercase tracking-wide">
                    📈 Tes catégories gagnantes (ventes réelles)
                  </h2>
                  <ul className="space-y-2 text-sm">
                    {podium.map((c, i) => (
                      <li key={c.category} className="flex items-center justify-between">
                        <span>
                          {["🥇", "🥈", "🥉"][i]} {catLabel(c.category)}{" "}
                          <span className="text-muted">({c.count})</span>
                        </span>
                        <span
                          className={`font-semibold ${c.profit >= 0 ? "text-positive" : "text-negative"}`}
                        >
                          {signedEuro(c.profit)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-muted mt-3">
                    Calculé à partir de tes ventes réelles (statut « Revendue »).
                  </p>
                </>
              ) : (
                <EstimatedCategories auctions={auctions} />
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/** ROI moyen estimé par catégorie (tant qu'il n'y a pas de ventes réelles). */
function EstimatedCategories({ auctions }: { auctions: AuctionRecord[] }) {
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

  return (
    <>
      <h2 className="text-sm font-semibold text-muted mb-3 uppercase tracking-wide">
        Catégories les plus rentables (estimation)
      </h2>
      <div className="space-y-3">
        {categories.map((c) => (
          <div key={c.cat}>
            <div className="flex justify-between text-xs mb-1">
              <span>
                {catLabel(c.cat)} <span className="text-muted">({c.n})</span>
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
    </>
  );
}

function StatCard({
  label,
  value,
  accent,
  tone,
}: {
  label: string;
  value: string;
  accent?: boolean;
  tone?: "positive";
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? "border-accent/50 bg-accent/5" : "border-edge bg-surface"
      }`}
    >
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${tone === "positive" ? "text-positive" : ""}`}>
        {value}
      </div>
    </div>
  );
}
