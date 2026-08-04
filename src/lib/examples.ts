/** Enchères d'exemple pour découvrir l'application (bouton « Charger des exemples »). */
import { emptyAuctionInput } from "./engine";
import { saveAuction, type AuctionDraft } from "./storage";

const base = (): AuctionDraft => ({
  ...emptyAuctionInput(),
  sourceUrl: "",
  title: "",
  auctionHouse: "",
  location: "",
  comments: "",
  endDate: "",
  photos: [],
});

const EXAMPLES: AuctionDraft[] = [
  {
    ...base(),
    title: "Lot de 6 Raspberry Pi 5 8 Go",
    category: "informatique",
    auctionHouse: "Enchères Normandie",
    location: "Caen (14)",
    currentPrice: 320,
    buyerFeePct: 24,
    travelCost: 25,
    condition: "tres-bon",
    refurbHours: 1,
    cleaningHours: 0.5,
    photoHours: 0.5,
    listingHours: 0.5,
    packingHours: 1,
    savHours: 0.5,
    sellingFeePct: 0,
    sellingMiscCost: 10,
    resaleFast: 720,
    resaleNormal: 850,
    resaleOptimized: 960,
    comments: "Vérifier : alimentations présentes, cartes SD incluses, ports USB.",
    status: "suivie",
  },
  {
    ...base(),
    title: "Canon EF 100-400 L IS II",
    category: "photo",
    auctionHouse: "Hôtel des ventes de Rouen",
    location: "Rouen (76)",
    currentPrice: 650,
    buyerFeePct: 22,
    travelCost: 40,
    condition: "bon",
    refurbHours: 0.5,
    cleaningHours: 0.5,
    photoHours: 0.5,
    listingHours: 0.5,
    packingHours: 0.5,
    sellingMiscCost: 15,
    resaleFast: 1050,
    resaleNormal: 1200,
    resaleOptimized: 1350,
    comments: "Contrôler l'AF, la bague de zoom et l'absence de champignons.",
    status: "analysee",
  },
  {
    ...base(),
    title: "Imprimante 3D Creality Ender 3 (à réviser)",
    category: "informatique",
    auctionHouse: "SVV Atlantique",
    location: "Nantes (44)",
    currentPrice: 90,
    buyerFeePct: 20,
    travelCost: 60,
    condition: "a-reparer",
    refurbHours: 6,
    cleaningHours: 1,
    photoHours: 0.5,
    listingHours: 0.5,
    packingHours: 1,
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
