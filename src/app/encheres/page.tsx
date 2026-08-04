/** Historique : toutes les enchères observées, récentes en premier. */
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CATEGORY_LABELS, type Category } from "@/lib/engine";
import { dateFr, euro, pct } from "@/lib/format";
import { ScoreStars } from "@/components/ScoreStars";

export const dynamic = "force-dynamic";
export const metadata = { title: "Historique — Auction Intelligence" };

const STATUS_LABELS: Record<string, string> = {
  analysee: "Analysée",
  suivie: "Suivie",
  achetee: "Achetée",
  perdue: "Perdue",
  revendue: "Revendue",
};

export default async function EncheresPage() {
  const auctions = await prisma.auction.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          Historique{" "}
          <span className="text-muted text-base font-normal">
            ({auctions.length})
          </span>
        </h1>
        <Link
          href="/analyse"
          className="rounded-lg bg-accent text-background font-semibold px-4 py-2 text-sm hover:opacity-90 transition-opacity"
        >
          + Nouvelle analyse
        </Link>
      </div>

      {auctions.length === 0 ? (
        <p className="text-muted text-sm rounded-xl border border-edge bg-surface p-8 text-center">
          Aucune enchère enregistrée pour le moment.
        </p>
      ) : (
        <div className="rounded-xl border border-edge bg-surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted border-b border-edge">
              <tr>
                <th className="text-left font-medium px-4 py-3">Lot</th>
                <th className="text-left font-medium px-4 py-3">Catégorie</th>
                <th className="text-right font-medium px-4 py-3">Coût total</th>
                <th className="text-right font-medium px-4 py-3">Bénéfice</th>
                <th className="text-right font-medium px-4 py-3">ROI</th>
                <th className="text-right font-medium px-4 py-3">Score</th>
                <th className="text-right font-medium px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {auctions.map((a) => (
                <tr key={a.id} className="hover:bg-surface-2 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/encheres/${a.id}`} className="font-medium hover:text-accent">
                      {a.title}
                    </Link>
                    <div className="text-xs text-muted">
                      {dateFr(a.createdAt)}
                      {a.auctionHouse ? ` · ${a.auctionHouse}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {CATEGORY_LABELS[a.category as Category] ?? a.category}
                  </td>
                  <td className="px-4 py-3 text-right">{euro(a.totalCost)}</td>
                  <td
                    className={`px-4 py-3 text-right ${a.netProfit >= 0 ? "text-positive" : "text-negative"}`}
                  >
                    {euro(a.netProfit)}
                  </td>
                  <td className="px-4 py-3 text-right">{pct(a.roi)}</td>
                  <td className="px-4 py-3 text-right">
                    <ScoreStars score={a.score} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted">
                    {STATUS_LABELS[a.status] ?? a.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
