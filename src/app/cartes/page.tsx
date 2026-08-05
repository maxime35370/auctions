"use client";

/**
 * 🃏 Lot de cartes Pokémon : saisir les numéros visibles sur les photos,
 * identifier chaque carte (pokemontcg.io, prix Cardmarket €), et obtenir une
 * estimation VOLONTAIREMENT PRUDENTE avec un mode de confiance honnête
 * (🟢 précis / 🟡 fourchette / 🔴 « je ne peux pas estimer précisément »).
 */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  HIGH_VALUE_THRESHOLD,
  identifyCards,
  parseCardLines,
  summarizeLot,
  type IdentifiedCard,
  type PhotoQuality,
} from "@/lib/cards/pokemon";
import { emptyAuctionInput } from "@/lib/engine";
import { euro } from "@/lib/format";
import { setPendingDraft } from "@/lib/handoff";
import type { AuctionDraft } from "@/lib/storage";

export default function CartesPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [cards, setCards] = useState<IdentifiedCard[] | null>(null);
  const [invalid, setInvalid] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Options de prudence (« qualité des données »)
  const [unreadableCount, setUnreadableCount] = useState(0);
  const [prudentValue, setPrudentValue] = useState(0);
  const [photoQuality, setPhotoQuality] = useState<PhotoQuality>("bonnes");

  // Le résumé se recalcule en direct quand les options de prudence changent.
  const summary = useMemo(() => {
    if (cards === null && unreadableCount === 0) return null;
    return summarizeLot(cards ?? [], {
      unreadableCount,
      prudentValue,
      photoQuality,
    });
  }, [cards, unreadableCount, prudentValue, photoQuality]);

  async function handleIdentify() {
    const { queries, invalid: bad } = parseCardLines(text);
    setInvalid(bad);
    setError(null);
    if (queries.length === 0 && unreadableCount === 0) {
      setError(
        "Saisissez au moins une carte (« Dracaufeu 4/102 » ou « 025/198 ») — ou seulement le nombre de cartes illisibles pour une estimation prudente."
      );
      return;
    }
    if (queries.length > 40) {
      setError("Maximum 40 cartes à la fois (limites de l'API publique).");
      return;
    }
    if (queries.length === 0) {
      setCards([]); // estimation prudente pure (aucune carte lisible)
      return;
    }
    setBusy(true);
    setCards(null);
    try {
      const results = await identifyCards(queries, (done, total) =>
        setProgress([done, total])
      );
      setCards(results);
      if (results.every((r) => r.card === null)) {
        setError(
          "Aucune carte identifiée — l'API est peut-être injoignable, ou les numéros sont inhabituels. Réessayez, ou utilisez l'estimation prudente."
        );
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  function handleAnalyse() {
    if (!summary) return;
    const draft: Partial<AuctionDraft> = {
      ...emptyAuctionInput(),
      title: `Lot de ${summary.cardCount} cartes Pokémon`,
      category: "art-collection",
      resaleFast: summary.resaleFast,
      resaleNormal: summary.resaleNormal,
      resaleOptimized: summary.resaleOptimized,
      comments:
        `${summary.modeMessage}\n` +
        `Valeur prouvée (cartes cotées) : ${euro(summary.provenValue)} · ` +
        `estimation prudente des illisibles : ${euro(summary.prudentUnknownValue)} · ` +
        `total prudent : ${euro(summary.totalValue)} (confiance ${summary.confidence} %).\n` +
        (summary.highValue.length
          ? `Cartes à forte valeur à vérifier sur les photos :\n${summary.highValue
              .map((c) => `- ${c.card?.name} (${c.query.raw}) : ${euro(c.avgSell!)}`)
              .join("\n")}`
          : "Aucune carte à forte valeur détectée."),
    };
    setPendingDraft(draft);
    router.push("/analyse");
  }

  const modeTone =
    summary?.mode === "precis"
      ? "border-positive/40 bg-positive/5"
      : summary?.mode === "fourchette"
        ? "border-accent/40 bg-accent/5"
        : "border-negative/40 bg-negative/5";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">🃏 Lot de cartes Pokémon</h1>
        <p className="text-sm text-muted mt-1">
          Saisissez les numéros visibles sur les photos (une carte par ligne).
          L&apos;estimation est <b>volontairement prudente</b> : les cartes
          illisibles valent leur valeur plancher, jamais plus. ⚠ La base de
          prix est <b>anglophone</b> et couvre mal les extensions très
          récentes (2024+) : ces cartes ressortent « non identifiées » —
          comptez-les dans l&apos;estimation prudente. L&apos;OCR des photos
          viendra ensuite.
        </p>
      </div>

      <section className="rounded-xl border border-accent/40 bg-surface p-4 space-y-3">
        <textarea
          className="field min-h-32 font-mono text-sm"
          placeholder={"Dracaufeu 4/102\nPikachu 58/102\n025/198\nTortank 2/102"}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        {/* 🛡 Qualité des données — le logiciel connaît ses limites */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="field-label">Cartes illisibles (nb)</label>
            <input
              className="field"
              type="number"
              min={0}
              value={unreadableCount === 0 ? "" : unreadableCount}
              placeholder="0"
              onChange={(e) =>
                setUnreadableCount(e.target.value === "" ? 0 : Number(e.target.value))
              }
            />
          </div>
          <div>
            <label className="field-label">Valeur prudente (€/carte)</label>
            <input
              className="field"
              type="number"
              min={0}
              step={0.5}
              value={prudentValue === 0 ? "" : prudentValue}
              placeholder="ex : 10"
              onChange={(e) =>
                setPrudentValue(e.target.value === "" ? 0 : Number(e.target.value))
              }
            />
            <p className="text-[10px] text-muted mt-0.5">
              ex : 12 Ultra Rares illisibles × 10 € ≈ 120 €
            </p>
          </div>
          <div>
            <label className="field-label">🖼 Lisibilité des photos</label>
            <select
              className="field"
              value={photoQuality}
              onChange={(e) => setPhotoQuality(e.target.value as PhotoQuality)}
            >
              <option value="bonnes">Bonnes (références lisibles)</option>
              <option value="moyennes">Moyennes (confiance ≤ 70 %)</option>
              <option value="floues">Floues (confiance ≤ 35 %)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleIdentify}
            disabled={busy || (!text.trim() && unreadableCount === 0)}
            className="rounded-lg bg-accent text-background font-semibold px-4 py-2 text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {busy
              ? progress
                ? `Identification… ${progress[0]}/${progress[1]}`
                : "Identification…"
              : "Estimer le lot"}
          </button>
          <p className="text-[11px] text-muted">
            Formats : « Dracaufeu 4/102 » (le nom aide à trancher) ou
            « 025/198 ». Prix Cardmarket via l&apos;API publique pokemontcg.io.
          </p>
        </div>
        {invalid.length > 0 && (
          <p className="text-xs text-accent">
            ⚠ Lignes ignorées (pas de numéro/total) : {invalid.join(" · ")}
          </p>
        )}
        {error && <p className="text-sm text-negative">{error}</p>}
      </section>

      {summary && (
        <>
          {/* Mode de confiance — honnête */}
          <div className={`rounded-xl border p-4 ${modeTone}`}>
            <p className="text-sm font-medium">{summary.modeMessage}</p>
          </div>

          {/* Résumé du lot */}
          <div className="rounded-xl border border-edge bg-surface p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <Big
                label="Total prudent estimé"
                value={euro(summary.totalValue)}
                strong={summary.mode !== "imprecis"}
                hint={`prouvé ${euro(summary.provenValue)} + illisibles ${euro(summary.prudentUnknownValue)}`}
              />
              <Big label="Confiance" value={`${summary.confidence} %`} />
              <Big
                label="Cartes à forte valeur"
                value={`${summary.highValue.length}`}
                hint={`≥ ${HIGH_VALUE_THRESHOLD} €`}
              />
              <Big
                label="Identifiées / cotées"
                value={`${summary.identified} / ${summary.priced}`}
                hint={`sur ${summary.cardCount} cartes`}
              />
            </div>
            <div className="grid grid-cols-3 gap-3 text-center mt-3 text-sm">
              <div className="rounded-lg bg-surface-2 p-2">
                <div className="text-xs text-muted">Revente rapide (lot, −30 %)</div>
                <div className="font-bold">{euro(summary.resaleFast)}</div>
              </div>
              <div className="rounded-lg bg-surface-2 p-2">
                <div className="text-xs text-muted">Normale (−15 %)</div>
                <div className="font-bold">{euro(summary.resaleNormal)}</div>
              </div>
              <div className="rounded-lg bg-surface-2 p-2">
                <div className="text-xs text-muted">Optimisée (à l&apos;unité)</div>
                <div className="font-bold">{euro(summary.resaleOptimized)}</div>
              </div>
            </div>
            <button
              onClick={handleAnalyse}
              className="mt-3 rounded-lg bg-accent text-background font-semibold px-4 py-2 text-sm hover:opacity-90 transition-opacity"
            >
              🎯 Analyser ce lot (formulaire pré-rempli)
            </button>
          </div>

          {/* Détail des cartes */}
          {cards && cards.length > 0 && (
            <section className="rounded-xl border border-edge bg-surface p-4">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
                Détail des cartes
              </h2>
              <ul className="divide-y divide-edge">
                {cards.map((c, i) => (
                  <li key={i} className="py-2 flex items-center gap-3 text-sm">
                    {c.card?.images?.small ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.card.images.small}
                        alt={c.card.name}
                        className="w-10 rounded border border-edge"
                        onError={(e) => (e.currentTarget.style.display = "none")}
                      />
                    ) : (
                      <span className="w-10 text-center text-muted">🃏</span>
                    )}
                    <div className="flex-1 min-w-0">
                      {c.card && c.nameMismatch ? (
                        <>
                          <p className="font-medium text-negative truncate">
                            ⚠ « {c.query.raw} » — nom différent, non comptée
                          </p>
                          <p className="text-xs text-muted truncate">
                            Trouvé « {c.card.name} » ({c.card.set?.name}) au même
                            numéro : probable extension récente absente de la
                            base. Utilisez l&apos;estimation prudente pour
                            cette carte.
                          </p>
                        </>
                      ) : c.card ? (
                        <>
                          <p className="font-medium truncate">
                            {c.card.name}{" "}
                            {(c.avgSell ?? 0) >= HIGH_VALUE_THRESHOLD && "⭐"}
                          </p>
                          <p className="text-xs text-muted truncate">
                            {c.card.set?.name} · n° {c.card.number}
                            {c.card.rarity ? ` · ${c.card.rarity}` : ""}
                            {c.matchCount > 1
                              ? ` · ⚠ ${c.matchCount} correspondances possibles`
                              : ""}
                          </p>
                        </>
                      ) : (
                        <p className="text-muted">
                          ❓ « {c.query.raw} » non identifiée (extension récente
                          ou numéro inhabituel) — comptez-la en estimation
                          prudente
                        </p>
                      )}
                    </div>
                    <span className="font-bold whitespace-nowrap">
                      {c.avgSell !== undefined ? euro(c.avgSell) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Big({
  label,
  value,
  hint,
  strong,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`font-black ${strong ? "text-2xl text-positive" : "text-xl"}`}>
        {value}
      </div>
      {hint && <div className="text-[10px] text-muted">{hint}</div>}
    </div>
  );
}
