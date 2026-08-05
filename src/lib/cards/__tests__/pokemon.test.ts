import { describe, expect, it } from "vitest";
import {
  buildSearchUrl,
  parseCardLines,
  pickMatch,
  summarizeLot,
  toIdentified,
  type ApiCard,
} from "../pokemon";

const apiCard = (
  name: string,
  number: string,
  avgSell?: number,
  setName = "Base Set"
): ApiCard => ({
  name,
  number,
  set: { name: setName, printedTotal: 102 },
  cardmarket: avgSell !== undefined ? { prices: { averageSellPrice: avgSell } } : undefined,
});

describe("parseCardLines — formats de saisie", () => {
  it("parse nom + numéro, numéro seul, zéros initiaux et espaces", () => {
    const { queries, invalid } = parseCardLines(
      "Dracaufeu 4/102\n025/198\nPikachu 58 / 102\n\nligne invalide\n"
    );
    expect(queries).toHaveLength(3);
    expect(queries[0]).toMatchObject({ name: "Dracaufeu", number: "4", printedTotal: 102 });
    expect(queries[1]).toMatchObject({ name: undefined, number: "25", printedTotal: 198 });
    expect(queries[2]).toMatchObject({ name: "Pikachu", number: "58" });
    expect(invalid).toEqual(["ligne invalide"]);
  });
});

describe("buildSearchUrl", () => {
  it("interroge par numéro et taille de collection (printedTotal OU total)", () => {
    const url = buildSearchUrl({ raw: "4/102", number: "4", printedTotal: 102 });
    expect(url).toContain("api.pokemontcg.io/v2/cards");
    expect(decodeURIComponent(url)).toContain("number:4");
    expect(decodeURIComponent(url)).toContain("set.printedTotal:102");
  });
});

describe("pickMatch — désambiguïsation par le nom", () => {
  it("le nom saisi tranche entre plusieurs correspondances", () => {
    const cards = [apiCard("Machop", "4"), apiCard("Charizard", "4")];
    const { card } = pickMatch(
      { raw: "Dracaufeu 4/102", name: "Charizard", number: "4", printedTotal: 102 },
      cards
    );
    expect(card?.name).toBe("Charizard");
  });

  it("sans nom : première correspondance, ambiguïté signalée", () => {
    const cards = [apiCard("A", "4"), apiCard("B", "4")];
    const r = toIdentified({ raw: "4/102", number: "4", printedTotal: 102 }, cards);
    expect(r.card?.name).toBe("A");
    expect(r.matchCount).toBe(2);
  });
});

describe("summarizeLot — le récap façon « 163 € · confiance 94 % »", () => {
  const mk = (avgSell?: number, found = true, matchCount = 1) =>
    ({
      query: { raw: "x", number: "1", printedTotal: 102 },
      card: found ? apiCard("Carte", "1", avgSell) : null,
      matchCount: found ? matchCount : 0,
      avgSell,
    });

  it("total, fortes valeurs, confiance et décotes de lot", () => {
    const s = summarizeLot([
      mk(80), // ⭐ forte valeur
      mk(45), // ⭐
      mk(25), // ⭐
      mk(3),
      mk(5),
      mk(5),
    ]);
    expect(s.totalValue).toBe(163);
    expect(s.highValue).toHaveLength(3);
    expect(s.highValue[0].avgSell).toBe(80); // triées par valeur
    expect(s.confidence).toBe(100);
    expect(s.resaleFast).toBe(114.1); // −30 %
    expect(s.resaleOptimized).toBe(163);
  });

  it("la confiance baisse avec les cartes non identifiées ou ambiguës", () => {
    const s = summarizeLot([mk(50), mk(undefined, false), mk(30, true, 3)]);
    expect(s.identified).toBe(2);
    expect(s.confidence).toBeLessThan(80);
  });

  it("lot vide : zéro partout, pas de NaN", () => {
    const s = summarizeLot([]);
    expect(s.totalValue).toBe(0);
    expect(s.confidence).toBe(0);
  });
});

describe("prudence et qualité des données — le logiciel connaît ses limites", () => {
  const mk = (avgSell?: number, found = true, matchCount = 1) => ({
    query: { raw: "x", number: "1", printedTotal: 102 },
    card: found
      ? apiCard("Carte", "1", avgSell)
      : null,
    matchCount: found ? matchCount : 0,
    avgSell,
  });

  it("scénario prudent : 12 illisibles × 10 € = 120 €, jamais plus", () => {
    const s = summarizeLot([], { unreadableCount: 12, prudentValue: 10 });
    expect(s.totalValue).toBe(120);
    expect(s.provenValue).toBe(0);
    expect(s.prudentUnknownValue).toBe(120);
    expect(s.mode).toBe("imprecis"); // rien d'identifié → confiance faible
    expect(s.modeMessage).toContain("je ne peux pas estimer précisément");
  });

  it("prouvé + prudent se cumulent, la confiance tient compte des illisibles", () => {
    const s = summarizeLot([mk(50), mk(30)], {
      unreadableCount: 2,
      prudentValue: 5,
    });
    expect(s.provenValue).toBe(80);
    expect(s.totalValue).toBe(90);
    // 2 identifiées sur 4 cartes → confiance moyenne
    expect(s.mode).toBe("fourchette");
    expect(s.modeMessage).toContain("fourchette");
  });

  it("photos floues : confiance plafonnée à 35 %, même si tout est identifié", () => {
    const perfect = [mk(50), mk(30), mk(20)];
    expect(summarizeLot(perfect).confidence).toBe(100);
    expect(summarizeLot(perfect).mode).toBe("precis");
    const blurry = summarizeLot(perfect, { photoQuality: "floues" });
    expect(blurry.confidence).toBeLessThanOrEqual(35);
    expect(blurry.mode).toBe("imprecis");
    const medium = summarizeLot(perfect, { photoQuality: "moyennes" });
    expect(medium.confidence).toBeLessThanOrEqual(70);
  });
});
