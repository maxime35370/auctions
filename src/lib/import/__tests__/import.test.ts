import { describe, expect, it } from "vitest";
import {
  extractFromText,
  findAuctionHouse,
  findBuyerFeePct,
  findEndDate,
  findLocation,
  findPriceNear,
  findQuantity,
  parseFrenchDate,
  parseFrenchNumber,
} from "../parse";
import { mergeData } from "../connectors/generic";
import { detectConnector } from "../registry";
import { toDraft } from "../importer";
import { countFields } from "../types";

describe("parse — nombres et prix français", () => {
  it("convertit les formats français", () => {
    expect(parseFrenchNumber("1 234,56")).toBe(1234.56);
    expect(parseFrenchNumber("1.234,56")).toBe(1234.56);
    expect(parseFrenchNumber("1234.56")).toBe(1234.56);
    expect(parseFrenchNumber("120")).toBe(120);
  });

  it("trouve un prix proche d'un mot-clé", () => {
    const text = "Lot n°42 — Enchère actuelle : 1 250 € — frais en sus";
    expect(findPriceNear(text, ["ench[eè]re actuelle"])).toBe(1250);
    expect(findPriceNear(text, ["mise [aà] prix"])).toBeUndefined();
  });

  it("trouve les frais acheteur en %", () => {
    expect(findBuyerFeePct("Frais de vente : 24,6 % TTC")).toBe(24.6);
    expect(findBuyerFeePct("frais acheteur de 20% en sus")).toBe(20);
    expect(findBuyerFeePct("aucune mention")).toBeUndefined();
    // Un pourcentage aberrant (> 50 %) est rejeté
    expect(findBuyerFeePct("frais : 99 %")).toBeUndefined();
  });
});

describe("parse — localisation, maison de vente, quantité", () => {
  it("trouve une localisation française (code postal + ville)", () => {
    expect(findLocation("Retrait sur place : 35000 Rennes\nautre ligne")).toBe("Rennes (35)");
    expect(findLocation("aucune adresse")).toBeUndefined();
  });

  it("trouve une maison de vente", () => {
    expect(findAuctionHouse("Vente organisée par SVV Atlantique Ouest.")).toContain("SVV Atlantique");
    expect(findAuctionHouse("Hôtel des ventes de Rouen — vente courante")).toContain("tel des ventes");
    expect(findAuctionHouse("rien ici")).toBeUndefined();
  });

  it("détecte la quantité d'un lot", () => {
    expect(findQuantity("Lot de 3 NAS Synology DS920+")).toBe(3);
    expect(findQuantity("Un NAS Synology")).toBeUndefined();
    expect(findQuantity("Lot de 1 objet")).toBeUndefined();
  });
});

describe("parse — dates françaises", () => {
  it("convertit les dates textuelles et numériques", () => {
    expect(parseFrenchDate("12 août 2026")).toBe("2026-08-12");
    expect(parseFrenchDate("3 février 2027")).toBe("2027-02-03");
    expect(parseFrenchDate("12/08/2026")).toBe("2026-08-12");
    expect(parseFrenchDate("2026-08-12")).toBe("2026-08-12");
  });

  it("trouve la date de fin près des mots-clés", () => {
    expect(findEndDate("Clôture de la vente : 12 août 2026 à 14h")).toBe("2026-08-12");
    expect(findEndDate("Fin le 05/09/2026")).toBe("2026-09-05");
    expect(findEndDate("aucune date")).toBeUndefined();
  });
});

describe("extractFromText — mode presse-papiers", () => {
  const page = `
    Interencheres - vente aux enchères
    Lot de 2 imprimantes 3D Creality Ender 3 V2
    Enchère actuelle : 120 €
    Frais acheteur : 20 % TTC
    Clôture : 12 août 2026
    https://cdn.example.com/photos/lot42-1.jpg
    https://cdn.example.com/photos/lot42-2.jpg
  `;

  it("extrait titre, prix, frais, date et photos", () => {
    const d = extractFromText(page);
    expect(d.title).toContain("Creality Ender 3");
    expect(d.currentPrice).toBe(120);
    expect(d.buyerFeePct).toBe(20);
    expect(d.endDate).toBe("2026-08-12");
    expect(d.photos).toHaveLength(2);
  });
});

describe("extractFromText — page Interencheres réaliste (menus, parasites)", () => {
  const realisticPage = `
    Interencheres
    Se connecter
    Mes listes
    Rechercher un objet, une vente, une maison de ventes...
    Toutes les catégories
    MOBILIER & OBJETS D'ART
    MATÉRIEL PROFESSIONNEL
    Comment acheter ?
    Vente courante de matériel informatique et audiovisuel
    mercredi 20 août 2026 à 14:00
    SVV Atlantique Ouest Enchères
    Lot n° 42
    Lot de 3 NAS Synology DS920+ avec disques durs
    Enchère en cours
    210,00 €
    Frais de vente : 24,66 % TTC en sus
    Clôture le 20 août 2026
    Retrait : 35000 Rennes
    Voir plus de lots
    Newsletter
    Mentions légales
    CGV
  `;

  it("trouve le prix même sur une ligne séparée du libellé", () => {
    const d = extractFromText(realisticPage);
    expect(d.currentPrice).toBe(210);
  });

  it("ancre le titre près du prix (pas les menus ni le nom de la vente)", () => {
    const d = extractFromText(realisticPage);
    expect(d.title).toBe("Lot de 3 NAS Synology DS920+ avec disques durs");
  });

  it("trouve frais décimaux, date de clôture, localisation et maison de vente", () => {
    const d = extractFromText(realisticPage);
    expect(d.buyerFeePct).toBe(24.66);
    expect(d.endDate).toBe("2026-08-20");
    expect(d.location).toBe("Rennes (35)");
    expect(d.auctionHouse).toContain("Ench");
  });

  it("gère « montant avant libellé » et « commission »", () => {
    const d = extractFromText(
      "Objectif Canon EF 50mm f/1.8 STM comme neuf\n180,00 €\nDernière enchère\nCommission : 20 % HT"
    );
    expect(d.currentPrice).toBe(180);
    expect(d.buyerFeePct).toBe(20);
    expect(d.title).toContain("Canon EF 50mm");
  });
});

describe("livraison — toutes formulations et sécurité « sur devis »", () => {
  it("détecte « Livraison France 21,60 € » et « Livraison Europe 38,28 € »", async () => {
    const { findShipping } = await import("../parse");
    const s = findShipping(
      "RETRAIT ET LIVRAISON\nLivraison France\n21,60 €\nLivraison Europe\n38,28 €"
    );
    expect(s.france).toBe(21.6);
    expect(s.europe).toBe(38.28);
    expect(s.onQuote).toBe(false);
  });

  it("reconnaît les autres formulations (expédition, frais d'envoi, Colissimo…)", async () => {
    const { findShipping } = await import("../parse");
    expect(findShipping("Expédition France : 15 €").france).toBe(15);
    expect(findShipping("Frais d'envoi : 12,50 €").france).toBe(12.5);
    expect(findShipping("Colissimo : 9,90 €").france).toBe(9.9);
    expect(findShipping("Mondial Relay 6,99 €").france).toBe(6.99);
  });

  it("« sur devis » / « nous contacter » → coût inconnu, JAMAIS 0", async () => {
    const { findShipping } = await import("../parse");
    expect(findShipping("Livraison : sur devis").onQuote).toBe(true);
    expect(findShipping("Expédition : nous contacter").onQuote).toBe(true);
    const d = extractFromText("Lot de 2 objets divers\nEnchère en cours : 50 €\nLivraison sur devis");
    expect(d.shippingCost).toBeUndefined();
    expect(d.shippingOnQuote).toBe(true);
    expect(d.description).toContain("Livraison sur devis");
  });

  it("détecte le retrait sur place uniquement", async () => {
    const { findShipping } = await import("../parse");
    expect(findShipping("Retrait sur place uniquement, pas d'expédition").pickupOnly).toBe(true);
  });

  it("frais plateforme extraits en nombre et inclus au brouillon", async () => {
    const { findPlatformFeePct } = await import("../parse");
    expect(findPlatformFeePct("Les frais Interencheres de 1,8% sont pris en charge")).toBe(1.8);
    const { toDraft } = await import("../importer");
    const draft = toDraft({ platformFeePct: 1.8, shippingCost: 21.6, currentPrice: 300, buyerFeePct: 24 });
    expect(draft.platformFeePct).toBe(1.8);
    expect(draft.shippingCost).toBe(21.6);
  });
});

describe("cartels de maisons de vente — grades, origines, frais additionnels", () => {
  // Reproduction du cartel ADN Enchères (Interencheres) : la légende CGV
  // contient TOUS les grades — le piège classique.
  const legende = `
    Les grades de fonctionnement - Merci de lire les CGV
    Parfaitement fonctionnel : Toutes les fonctions originales de l'appareil sont utilisables.
    Fonctionnel : Toutes les fonctions originales de l'appareil sont utilisables. Une dégradation sérieuse de la batterie a été constatée.
    Partiellement fonctionnel : Une ou plusieurs fonctions originales de l'appareil sont non fonctionnelles.
    Test d'allumage : Un simple test d'allumage a été effectué par nos équipes (on/off).
    Hors Service : L'appareil ne fonctionne pas.
    Origines des lots - Merci de lire les CGV
    Litige transport : Le produit n'a pu être délivré...
    Retour Client : Ce produit acheté dans le (e-)commerce a fait l'objet d'un retour...
    Retour SAV : Ce produit a été restitué pour un défaut de fonctionnement présumé.
    Retour d'Entrepôt : Ce lot n'a jamais quitté son entrepôt d'origine...
    Frais de la vente : 26% pour les ventes volontaires
    Les frais Interencheres de 1,8% sont pris en charge par ADN Enchères si le bordereau est réglé en CB
  `;

  it("ne devine JAMAIS un grade quand seule la légende CGV est présente", async () => {
    const { findGrade, findLotOrigin } = await import("../parse");
    expect(findGrade(legende)).toBeUndefined();
    expect(findLotOrigin(legende)).toBeUndefined();
  });

  it("détecte le grade étiqueté du lot, même avec la légende complète", async () => {
    const { findGrade } = await import("../parse");
    const page = `Appareil photo Lumix DMC-G7\nGrade : Test d'allumage\n${legende}`;
    const g = findGrade(page)!;
    expect(g.label).toBe("Test d'allumage");
    expect(g.condition).toBe("a-reparer");
    expect(g.warning).toContain("allumage");
  });

  it("détecte un grade unique sans étiquette", async () => {
    const { findGrade } = await import("../parse");
    const g = findGrade("Console de mixage vendue hors service, pour pièces")!;
    expect(g.condition).toBe("epave");
  });

  it("détecte l'origine étiquetée et son avertissement", async () => {
    const { findLotOrigin } = await import("../parse");
    const o = findLotOrigin(`Origine : Retour SAV\n${legende}`)!;
    expect(o.label).toBe("Retour SAV");
    expect(o.warning).toContain("défaut");
  });

  it("extractFromText : frais 26 %, note +1,8 %, grade → état et commentaires", () => {
    const page = `Lot n° 12\nLot de 2 appareils photo Lumix DMC-G7\nEnchère en cours\n85,00 €\nGrade : Hors Service\nOrigine : Retour SAV\n${legende}`;
    const d = extractFromText(page);
    expect(d.buyerFeePct).toBe(26);
    expect(d.platformFeePct).toBe(1.8); // vrai champ, inclus au calcul
    expect(d.rawCondition).toBe("epave");
    expect(d.description).toContain("Hors service");
    expect(d.description).toContain("Retour SAV");
    expect(d.description).toContain("Frais plateforme 1.8 %");
    expect(d.currentPrice).toBe(85);
  });

  it("guessCondition mappe les grades vers les états internes", async () => {
    const { toDraft } = await import("../importer");
    expect(toDraft({ rawCondition: "a-reparer" }).condition).toBe("a-reparer");
    expect(toDraft({ rawCondition: "Hors service" }).condition).toBe("epave");
    expect(toDraft({ rawCondition: "test d'allumage" }).condition).toBe("a-reparer");
    expect(toDraft({ rawCondition: "parfaitement fonctionnel" }).condition).toBe("tres-bon");
  });
});

describe("registry — détection du connecteur", () => {
  it("choisit le bon connecteur selon l'URL", () => {
    expect(detectConnector("demo:ender3").id).toBe("demo");
    expect(detectConnector("https://www.interencheres.com/lot/42").id).toBe("interencheres");
    expect(detectConnector("https://exemple.fr/annonce").id).toBe("generic");
    expect(detectConnector("pas-une-url").id).toBe("generic");
  });
});

describe("importer — conversion en brouillon", () => {
  it("mappe les données extraites vers le formulaire", () => {
    const draft = toDraft({
      title: "Canon EF 100-400mm f/4.5-5.6L IS II USM",
      currentPrice: 720,
      buyerFeePct: 24,
      rawCondition: "Occasion",
      photos: ["https://x/1.jpg"],
      endDate: "2026-08-12",
      sourceUrl: "https://www.interencheres.com/lot/1",
    });
    expect(draft.category).toBe("photo"); // reconnu via « Canon »
    expect(draft.currentPrice).toBe(720);
    expect(draft.buyerFeePct).toBe(24);
    expect(draft.condition).toBe("bon");
    expect(draft.endDate).toBe("2026-08-12");
  });

  it("devine la catégorie informatique et l'état épave pour du HS", () => {
    const draft = toDraft({
      title: "Lot imprimantes 3D en panne",
      rawCondition: "HS pour pièces",
    });
    expect(draft.category).toBe("informatique");
    expect(draft.condition).toBe("epave");
  });

  it("applique des défauts sûrs quand tout manque", () => {
    const draft = toDraft({});
    expect(draft.buyerFeePct).toBe(20);
    expect(draft.category).toBe("autre");
  });
});

describe("extension — pont avec l'extension Chrome", () => {
  it("encode puis décode un payload (aller-retour fidèle, accents inclus)", async () => {
    const { encodeExtensionPayload, decodeExtensionPayload, EXT_IMPORT_HASH_PREFIX } =
      await import("../extension");
    const payload = {
      v: 1 as const,
      url: "https://www.interencheres.com/lot/42",
      title: "Lot n°42 — Objectif Canon éprouvé",
      meta: '<meta property="og:title" content="Canon 100-400">',
      text: "Enchère actuelle : 720 €\nFrais : 24 % TTC",
      photos: ["https://cdn.x/1.jpg"],
    };
    const encoded = encodeExtensionPayload(payload);
    expect(encoded).not.toMatch(/[+/=]/); // URL-safe
    const decoded = decodeExtensionPayload(EXT_IMPORT_HASH_PREFIX + encoded);
    expect(decoded).toEqual(payload);
  });

  it("rejette les fragments invalides sans lever d'erreur", async () => {
    const { decodeExtensionPayload } = await import("../extension");
    expect(decodeExtensionPayload("#ext-import=%%%")).toBeNull();
    expect(decodeExtensionPayload("#autre=abc")).toBeNull();
  });

  it("décode un payload v2 avec champs structurés", async () => {
    const { encodeExtensionPayload, decodeExtensionPayload, EXT_IMPORT_HASH_PREFIX } =
      await import("../extension");
    const payload = {
      v: 2 as const,
      url: "https://www.interencheres.com/lot/9",
      title: "Lot de 3 NAS Synology DS920+",
      meta: "",
      text: "extrait",
      photos: [],
      fields: {
        title: "Lot de 3 NAS Synology DS920+",
        currentPrice: 210,
        buyerFeePct: 24,
        location: "Rennes (35)",
        endDate: "2026-08-08",
        quantity: 3,
      },
    };
    const decoded = decodeExtensionPayload(
      EXT_IMPORT_HASH_PREFIX + encodeExtensionPayload(payload)
    );
    expect(decoded?.fields?.currentPrice).toBe(210);
    expect(decoded?.fields?.quantity).toBe(3);
  });

  it("les champs v2 sont prioritaires et la quantité passe en commentaire", async () => {
    const { importFromExtension } = await import("../importer");
    const { toDraft } = await import("../importer");
    const data = await importFromExtension(
      {
        v: 2,
        url: "https://www.interencheres.com/lot/9",
        title: "page",
        meta: "",
        text: "Enchère en cours : 999 €", // sera battu par le champ direct
        photos: [],
        fields: { currentPrice: 210, buyerFeePct: 24, quantity: 3, location: "Rennes (35)" },
      },
      () => {}
    );
    expect(data?.currentPrice).toBe(210);
    expect(data?.location).toBe("Rennes (35)");
    const draft = toDraft(data!);
    expect(draft.comments).toContain("Quantité détectée : 3");
  });

  it("importFromExtension extrait via les connecteurs et garde les photos", async () => {
    const { importFromExtension } = await import("../importer");
    const data = await importFromExtension(
      {
        v: 1,
        url: "https://www.interencheres.com/lot/42",
        title: "Lot 42",
        meta: "",
        text: "Lot de 2 imprimantes 3D Creality Ender 3\nEnchère en cours : 120 €\nFrais acheteur : 20 % TTC",
        photos: ["https://cdn.x/a.jpg", "https://cdn.x/b.jpg"],
      },
      () => {}
    );
    expect(data?.currentPrice).toBe(120);
    expect(data?.buyerFeePct).toBe(20);
    expect(data?.photos).toEqual(["https://cdn.x/a.jpg", "https://cdn.x/b.jpg"]);
    expect(data?.sourceUrl).toContain("interencheres");
  });
});

describe("extractMarketListings — 📊 étude de marché", () => {
  const ebayPage = `
    eBay - canon 100-400 ii - ventes réussies
    Canon EF 100-400mm f/4.5-5.6L IS II USM
    1 320,00 €
    +12,00 € livraison
    Canon EF 100-400 L IS II USM très bon état
    1 410,00 €
    Livraison gratuite
    Objectif Canon 100-400 mark II
    1 180 €
    Canon EF 100-400mm II (pour pièces)
    650,00 €
  `;

  it("extrait toutes les annonces avec leur contexte, sans les frais de port", async () => {
    const { extractMarketListings } = await import("../market");
    const listings = extractMarketListings(ebayPage);
    expect(listings.map((l) => l.price)).toEqual([1320, 1410, 1180, 650]);
    expect(listings[0].context).toContain("Canon EF 100-400mm");
  });

  it("résume le marché : compte, bornes, médiane et prix d'opportunité", async () => {
    const { extractMarketListings, summarizeMarket } = await import("../market");
    const s = summarizeMarket(extractMarketListings(ebayPage))!;
    expect(s.count).toBe(4);
    expect(s.min).toBe(650);
    expect(s.max).toBe(1410);
    expect(s.opportunity).toBeLessThan(s.median);
  });

  it("déduplique les prix répétés au même contexte", async () => {
    const { extractMarketListings } = await import("../market");
    const listings = extractMarketListings("Canon truc machin\n100 €\nCanon truc machin\n100 €");
    expect(listings).toHaveLength(1);
  });
});

describe("mergeData — fusion des sources", () => {
  it("la première valeur définie gagne, les vides sont ignorés", () => {
    const merged = mergeData(
      { title: "", currentPrice: undefined },
      { title: "JSON-LD", currentPrice: 100, photos: [] },
      { title: "OpenGraph", photos: ["a.jpg"] }
    );
    expect(merged.title).toBe("JSON-LD");
    expect(merged.currentPrice).toBe(100);
    expect(merged.photos).toEqual(["a.jpg"]);
  });

  it("countFields compte les champs utiles", () => {
    expect(countFields({ title: "x", photos: [], currentPrice: 5 })).toBe(2);
  });
});
