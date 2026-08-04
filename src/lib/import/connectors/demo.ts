/**
 * Connecteur de démonstration (🧪 mode développeur).
 *
 * Simule un import complet avec un jeu de données réaliste : permet de tester
 * tout le flux (progression, format commun, pré-remplissage, analyse) sans
 * dépendre d'un site externe. C'est aussi la référence de ce qu'un vrai
 * connecteur doit produire.
 */

import { countFields, type Connector, type ImportResult } from "../types";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const demoConnector: Connector = {
  id: "demo",
  name: "Démonstration",
  matches: (url) => url.startsWith("demo:"),

  async extract({ report }): Promise<ImportResult> {
    report({ icon: "🔍", label: "Analyse de l'annonce de démonstration…", status: "pending" });
    await wait(300);
    report({ icon: "✅", label: "Site reconnu : Démo (Interencheres simulé)", status: "ok" });
    await wait(250);
    report({ icon: "✅", label: "Connexion réussie", status: "ok" });
    await wait(250);
    report({ icon: "📄", label: "Titre trouvé", status: "ok" });
    report({ icon: "💰", label: "Prix actuel trouvé : 120 €", status: "ok" });
    await wait(250);
    report({ icon: "📷", label: "2 photos trouvées", status: "ok" });
    report({ icon: "💶", label: "Frais acheteur trouvés : 20 %", status: "ok" });
    await wait(250);
    report({ icon: "📅", label: "Date de fin trouvée", status: "ok" });
    report({ icon: "⚠️", label: "État précis non indiqué — « occasion » par défaut", status: "warn" });

    const endDate = new Date(Date.now() + 4 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const data = {
      title: "Lot de 2 imprimantes 3D Creality Ender 3 V2",
      description:
        "Lot de deux imprimantes 3D Creality Ender 3 V2, vendues en l'état. " +
        "Provenance : liquidation d'un fablab. Buses et plateaux d'origine.",
      rawCategory: "Imprimantes 3D",
      photos: [
        "https://picsum.photos/seed/ender3-a/640/480",
        "https://picsum.photos/seed/ender3-b/640/480",
      ],
      currentPrice: 120,
      buyerFeePct: 20,
      shippingCost: 35,
      location: "Lyon (69)",
      auctionHouse: "Interencheres (démo)",
      endDate,
      rawCondition: "Occasion",
      sourceUrl: "demo:ender3",
    };

    return { data, fieldsFound: countFields(data) };
  },
};
