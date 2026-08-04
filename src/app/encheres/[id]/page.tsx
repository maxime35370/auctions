/**
 * Fiche détaillée d'une enchère : informations saisies + analyse complète.
 * L'analyse est recalculée depuis les entrées (source de vérité : le moteur),
 * ce qui garantit que la fiche reflète toujours les règles métier actuelles.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  analyzeAuction,
  CATEGORY_LABELS,
  CONDITIONS,
  type Category,
  type Condition,
} from "@/lib/engine";
import { dateFr } from "@/lib/format";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { DeleteAuctionButton } from "@/components/DeleteAuctionButton";

export const dynamic = "force-dynamic";

export default async function AuctionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auction = await prisma.auction.findUnique({ where: { id } });
  if (!auction) notFound();

  const analysis = analyzeAuction({
    currentPrice: auction.currentPrice,
    buyerFeePct: auction.buyerFeePct,
    vatPct: auction.vatPct,
    travelCost: auction.travelCost,
    shippingCost: auction.shippingCost,
    condition: auction.condition as Condition,
    category: auction.category,
    refurbHours: auction.refurbHours,
    resaleFast: auction.resaleFast,
    resaleNormal: auction.resaleNormal,
    resaleOptimized: auction.resaleOptimized,
  });

  const conditionLabel =
    CONDITIONS.find((c) => c.value === auction.condition)?.label ??
    auction.condition;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/encheres" className="text-xs text-muted hover:text-foreground">
            ← Retour à l&apos;historique
          </Link>
          <h1 className="text-2xl font-bold mt-1">{auction.title}</h1>
          <p className="text-sm text-muted mt-1">
            Analysée le {dateFr(auction.createdAt)}
            {auction.auctionHouse ? ` · ${auction.auctionHouse}` : ""}
            {auction.location ? ` · ${auction.location}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/encheres/${auction.id}/modifier`}
            className="rounded-lg border border-edge px-3 py-1.5 text-sm hover:bg-surface-2 transition-colors"
          >
            Modifier
          </Link>
          <DeleteAuctionButton auctionId={auction.id} />
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6 items-start">
        {/* Informations saisies */}
        <section className="rounded-xl border border-edge bg-surface p-4 space-y-2 text-sm">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            Informations
          </h2>
          <InfoRow label="Catégorie" value={CATEGORY_LABELS[auction.category as Category] ?? auction.category} />
          <InfoRow label="État" value={conditionLabel} />
          <InfoRow label="Maison de vente" value={auction.auctionHouse} />
          <InfoRow label="Localisation" value={auction.location} />
          <InfoRow
            label="Annonce"
            value={
              auction.sourceUrl ? (
                <a
                  href={auction.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline break-all"
                >
                  Voir l&apos;annonce ↗
                </a>
              ) : null
            }
          />
          {auction.comments && (
            <div className="pt-2 border-t border-edge">
              <div className="text-xs text-muted mb-1">Commentaires</div>
              <p className="whitespace-pre-wrap">{auction.comments}</p>
            </div>
          )}
        </section>

        {/* Analyse */}
        <AnalysisPanel analysis={analysis} />
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
