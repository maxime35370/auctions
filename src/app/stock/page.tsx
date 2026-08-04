"use client";

/**
 * Mon stock : les lots possédés (achetés, pas encore revendus) avec leur
 * avancement de revente, et la vue portefeuille (capital, valeur, latent).
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  listAuctions,
  PIPELINE_STEPS,
  portfolioStats,
  type AuctionRecord,
} from "@/lib/storage";
import { euro, signedEuro } from "@/lib/format";

export default function StockPage() {
  const [auctions, setAuctions] = useState<AuctionRecord[] | null>(null);

  useEffect(() => {
    setAuctions(listAuctions());
  }, []);

  if (auctions === null) return null;

  const stats = portfolioStats(auctions);
  const owned = auctions.filter((a) => a.status === "achetee");
  const sold = auctions.filter((a) => a.status === "revendue");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">🏆 Mon portefeuille</h1>

      {/* Vue portefeuille */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Capital engagé" value={euro(stats.invested)} />
        <StatCard label="Valeur du stock" value={euro(stats.stockValue)} />
        <StatCard
          label="Bénéfice latent"
          value={signedEuro(stats.latentProfit)}
          tone={stats.latentProfit >= 0 ? "positive" : "negative"}
        />
        <StatCard
          label="Bénéfice réalisé"
          value={signedEuro(stats.realizedProfit)}
          tone={stats.realizedProfit >= 0 ? "positive" : "negative"}
          hint={`${stats.soldCount} vente(s) terminée(s)`}
        />
      </div>

      {/* Lots possédés */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          📦 Mon stock{" "}
          <span className="text-muted text-sm font-normal">
            ({owned.length} lot{owned.length > 1 ? "s" : ""})
          </span>
        </h2>
        {owned.length === 0 ? (
          <p className="text-muted text-sm rounded-xl border border-edge bg-surface p-8 text-center">
            Aucun lot en stock. Passez une enchère au statut «&nbsp;Achetée&nbsp;»
            (sur sa fiche) pour la voir apparaître ici.
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {owned.map((a) => (
              <StockCard key={a.id} record={a} />
            ))}
          </div>
        )}
      </section>

      {/* Ventes terminées */}
      {sold.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            ✅ Ventes terminées{" "}
            <span className="text-muted text-sm font-normal">({sold.length})</span>
          </h2>
          <div className="rounded-xl border border-edge bg-surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted border-b border-edge">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Lot</th>
                  <th className="text-right font-medium px-4 py-3">Adjugé</th>
                  <th className="text-right font-medium px-4 py-3">Revendu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {sold.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-2 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/fiche?id=${a.id}`} className="font-medium hover:text-accent">
                        {a.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.finalPrice !== null ? euro(a.finalPrice) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-positive">
                      {a.soldPrice !== null ? euro(a.soldPrice) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function StockCard({ record }: { record: AuctionRecord }) {
  const progress = record.pipeline.length / PIPELINE_STEPS.length;
  const bought = record.finalPrice ?? record.totalCost;
  const latent = record.resaleNormal - bought;

  return (
    <Link
      href={`/fiche?id=${record.id}`}
      className="rounded-xl border border-edge bg-surface p-4 hover:border-accent/50 transition-colors block space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold">{record.title}</p>
        <span
          className={`text-sm font-bold whitespace-nowrap ${latent >= 0 ? "text-positive" : "text-negative"}`}
        >
          {signedEuro(latent)}
        </span>
      </div>
      <div className="text-xs text-muted">
        Acheté : {euro(bought)} · Valeur estimée : {euro(record.resaleNormal)}
      </div>
      <div>
        <div className="flex flex-wrap gap-1.5 text-[11px] mb-2">
          {PIPELINE_STEPS.map((step) => {
            const done = record.pipeline.includes(step.key);
            return (
              <span
                key={step.key}
                className={`rounded-full px-2 py-0.5 border ${
                  done
                    ? "border-positive/40 bg-positive/10 text-positive"
                    : "border-edge text-muted"
                }`}
              >
                {done ? "✔ " : ""}
                {step.label}
              </span>
            );
          })}
        </div>
        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
          <div
            className="h-full rounded-full bg-positive transition-all"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

function StatCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div
        className={`text-2xl font-bold mt-1 ${
          tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : ""
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-[11px] text-muted mt-0.5">{hint}</div>}
    </div>
  );
}
