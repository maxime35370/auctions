/**
 * API /api/auctions
 *  - GET  : liste des enchères analysées (récentes en premier)
 *  - POST : créer une analyse — le serveur recalcule tout via le moteur,
 *           les valeurs envoyées par le client ne sont jamais persistées telles quelles.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeAuction } from "@/lib/engine";
import { auctionInputSchema } from "@/lib/validation";

export async function GET() {
  const auctions = await prisma.auction.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(auctions);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = auctionInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const analysis = analyzeAuction(data);

  const auction = await prisma.auction.create({
    data: {
      ...data,
      totalCost: analysis.totalCost,
      maxBudget: analysis.maxBudget,
      potentialMargin: analysis.potentialMargin,
      netProfit: analysis.netProfit,
      roi: analysis.roi,
      score: analysis.score,
      scoreBreakdown: JSON.stringify(analysis.criteria),
    },
  });

  return NextResponse.json(auction, { status: 201 });
}
