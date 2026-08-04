/**
 * Données d'exemple pour découvrir l'application avec un dashboard rempli.
 * Lancer : `npx prisma db seed` (efface puis recrée les exemples).
 */
import { PrismaClient } from "@prisma/client";
import { analyzeAuction, type AuctionInput } from "../src/lib/engine";

const prisma = new PrismaClient();

type SeedAuction = AuctionInput & {
  title: string;
  auctionHouse: string;
  location: string;
  comments?: string;
  status?: string;
};

const EXAMPLES: SeedAuction[] = [
  {
    title: "Lot de 6 Raspberry Pi 5 8 Go",
    category: "informatique",
    auctionHouse: "Enchères Normandie",
    location: "Caen (14)",
    currentPrice: 320,
    buyerFeePct: 24,
    vatPct: 0,
    travelCost: 25,
    shippingCost: 0,
    condition: "tres-bon",
    refurbHours: 1,
    resaleFast: 720,
    resaleNormal: 850,
    resaleOptimized: 960,
    comments: "Vérifier : alimentations présentes, cartes SD incluses, ports USB.",
    status: "suivie",
  },
  {
    title: "Canon EF 100-400 L IS II",
    category: "photo",
    auctionHouse: "Hôtel des ventes de Rouen",
    location: "Rouen (76)",
    currentPrice: 650,
    buyerFeePct: 22,
    vatPct: 0,
    travelCost: 40,
    shippingCost: 0,
    condition: "bon",
    refurbHours: 0.5,
    resaleFast: 1050,
    resaleNormal: 1200,
    resaleOptimized: 1350,
    comments: "Contrôler l'AF, la bague de zoom et l'absence de champignons.",
  },
  {
    title: "Imprimante 3D Creality Ender 3 (à réviser)",
    category: "informatique",
    auctionHouse: "SVV Atlantique",
    location: "Nantes (44)",
    currentPrice: 90,
    buyerFeePct: 20,
    vatPct: 0,
    travelCost: 60,
    shippingCost: 0,
    condition: "a-reparer",
    refurbHours: 6,
    resaleFast: 120,
    resaleNormal: 150,
    resaleOptimized: 180,
    comments: "Buse bouchée annoncée. Les Creality dépassent rarement 180 €.",
  },
];

async function main() {
  await prisma.auction.deleteMany();

  for (const { title, auctionHouse, location, comments, status, ...input } of EXAMPLES) {
    const analysis = analyzeAuction(input);
    await prisma.auction.create({
      data: {
        title,
        auctionHouse,
        location,
        comments,
        status: status ?? "analysee",
        ...input,
        totalCost: analysis.totalCost,
        maxBudget: analysis.maxBudget,
        potentialMargin: analysis.potentialMargin,
        netProfit: analysis.netProfit,
        roi: analysis.roi,
        score: analysis.score,
        scoreBreakdown: JSON.stringify(analysis.criteria),
      },
    });
  }

  console.log(`✔ ${EXAMPLES.length} enchères d'exemple créées.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
