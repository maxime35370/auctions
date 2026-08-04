/** Enchères d'exemple pour découvrir l'application (bouton « Charger des exemples »). */
import { saveAuction, type AuctionDraft } from "./storage";

const EXAMPLES: AuctionDraft[] = [
  {
    title: "Lot de 6 Raspberry Pi 5 8 Go",
    category: "informatique",
    auctionHouse: "Enchères Normandie",
    location: "Caen (14)",
    sourceUrl: "",
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
    sourceUrl: "",
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
    status: "analysee",
  },
  {
    title: "Imprimante 3D Creality Ender 3 (à réviser)",
    category: "informatique",
    auctionHouse: "SVV Atlantique",
    location: "Nantes (44)",
    sourceUrl: "",
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
    status: "analysee",
  },
];

/** Insère les exemples et renvoie leur nombre. */
export function loadExamples(): number {
  for (const draft of EXAMPLES) saveAuction(draft);
  return EXAMPLES.length;
}
