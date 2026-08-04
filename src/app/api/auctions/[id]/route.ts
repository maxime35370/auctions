/**
 * API /api/auctions/[id]
 *  - GET    : détail d'une enchère
 *  - PUT    : mise à jour (recalcule l'analyse côté serveur)
 *  - DELETE : suppression
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeAuction } from "@/lib/engine";
import { auctionInputSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const auction = await prisma.auction.findUnique({ where: { id } });
  if (!auction) {
    return NextResponse.json({ error: "Enchère introuvable" }, { status: 404 });
  }
  return NextResponse.json(auction);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
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

  try {
    const auction = await prisma.auction.update({
      where: { id },
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
    return NextResponse.json(auction);
  } catch {
    return NextResponse.json({ error: "Enchère introuvable" }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await prisma.auction.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Enchère introuvable" }, { status: 404 });
  }
}
