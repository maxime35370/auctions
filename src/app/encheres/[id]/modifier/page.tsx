/** Édition d'une enchère existante — réutilise le formulaire d'analyse. */
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AuctionForm } from "@/components/AuctionForm";
import type { Condition } from "@/lib/engine";

export const dynamic = "force-dynamic";
export const metadata = { title: "Modifier — Auction Intelligence" };

export default async function EditAuctionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auction = await prisma.auction.findUnique({ where: { id } });
  if (!auction) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Modifier l&apos;analyse</h1>
      <AuctionForm
        auctionId={auction.id}
        initialValues={{
          sourceUrl: auction.sourceUrl ?? "",
          title: auction.title,
          category: auction.category,
          auctionHouse: auction.auctionHouse ?? "",
          location: auction.location ?? "",
          comments: auction.comments ?? "",
          currentPrice: auction.currentPrice,
          buyerFeePct: auction.buyerFeePct,
          vatPct: auction.vatPct,
          travelCost: auction.travelCost,
          shippingCost: auction.shippingCost,
          condition: auction.condition as Condition,
          refurbHours: auction.refurbHours,
          resaleFast: auction.resaleFast,
          resaleNormal: auction.resaleNormal,
          resaleOptimized: auction.resaleOptimized,
        }}
      />
    </div>
  );
}
