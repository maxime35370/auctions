"use client";

/**
 * Historique : toutes les enchères observées, avec sauvegarde (export JSON)
 * et restauration (import) — les données vivent dans le navigateur.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CATEGORY_LABELS, type Category } from "@/lib/engine";
import {
  exportJson,
  importJson,
  listAuctions,
  type AuctionRecord,
} from "@/lib/storage";
import { dateFr, euro, pct } from "@/lib/format";
import { ScoreStars } from "@/components/ScoreStars";

const STATUS_LABELS: Record<string, string> = {
  analysee: "Analysée",
  suivie: "Suivie",
  achetee: "Achetée",
  perdue: "Perdue",
  revendue: "Revendue",
};

export default function EncheresPage() {
  const [auctions, setAuctions] = useState<AuctionRecord[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAuctions(listAuctions());
  }, []);

  if (auctions === null) return null;

  function handleExport() {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auction-intelligence-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const n = importJson(await file.text());
      setAuctions(listAuctions());
      setMessage(`✔ ${n} enchère(s) importée(s).`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import impossible.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          Historique{" "}
          <span className="text-muted text-base font-normal">
            ({auctions.length})
          </span>
        </h1>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="rounded-lg border border-edge px-3 py-2 text-sm hover:bg-surface-2 transition-colors"
            title="Télécharger une sauvegarde JSON de toutes les données"
          >
            ⬇ Sauvegarder
          </button>
          <button
            onClick={() => fileInput.current?.click()}
            className="rounded-lg border border-edge px-3 py-2 text-sm hover:bg-surface-2 transition-colors"
            title="Restaurer une sauvegarde JSON"
          >
            ⬆ Importer
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImport}
          />
          <Link
            href="/analyse"
            className="rounded-lg bg-accent text-background font-semibold px-4 py-2 text-sm hover:opacity-90 transition-opacity"
          >
            + Nouvelle analyse
          </Link>
        </div>
      </div>

      {message && (
        <p className="text-sm rounded-lg border border-edge bg-surface p-3">
          {message}
        </p>
      )}

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
                    <Link
                      href={`/fiche?id=${a.id}`}
                      className="font-medium hover:text-accent"
                    >
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
