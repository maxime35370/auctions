/**
 * Panneau de résultats d'une analyse : jauge, budget maximum, stratégie
 * conseillée, scénarios, score expliqué et plateformes de revente.
 * Utilisé par l'aperçu en direct du formulaire et par la fiche détaillée.
 */
import type { AuctionAnalysis } from "@/lib/engine";
import { euro, hours, pct, signedEuro } from "@/lib/format";
import { ScoreStars } from "./ScoreStars";

const VERDICT_META: Record<
  AuctionAnalysis["verdict"],
  { emoji: string; label: string; bar: string; text: string; border: string }
> = {
  pepite: {
    emoji: "🟢",
    label: "Excellent achat",
    bar: "bg-positive",
    text: "text-positive",
    border: "border-positive/40",
  },
  "bonne-affaire": {
    emoji: "🟢",
    label: "Bonne affaire",
    bar: "bg-positive",
    text: "text-positive",
    border: "border-positive/40",
  },
  correct: {
    emoji: "🟡",
    label: "Affaire moyenne",
    bar: "bg-accent",
    text: "text-accent",
    border: "border-accent/40",
  },
  "a-eviter": {
    emoji: "🔴",
    label: "Mauvaise affaire",
    bar: "bg-negative",
    text: "text-negative",
    border: "border-negative/40",
  },
};

function Money({ value }: { value: number }) {
  const cls = value > 0 ? "text-positive" : value < 0 ? "text-negative" : "";
  return <span className={cls}>{signedEuro(value)}</span>;
}

export function AnalysisPanel({ analysis }: { analysis: AuctionAnalysis }) {
  const a = analysis;
  const v = VERDICT_META[a.verdict];

  return (
    <div className="space-y-5">
      {/* Jauge — le verdict en une seconde */}
      <div className={`rounded-xl border ${v.border} bg-surface p-5 text-center space-y-2`}>
        <div className="text-3xl">{v.emoji}</div>
        <div className={`text-xl font-bold ${v.text}`}>{v.label}</div>
        <div className="h-3 rounded-full bg-surface-2 overflow-hidden max-w-sm mx-auto">
          <div
            className={`h-full rounded-full ${v.bar} transition-all`}
            style={{ width: `${a.score}%` }}
          />
        </div>
        <ScoreStars score={a.score} size="lg" />
      </div>

      {/* 🛑 Budget maximum */}
      <div className="rounded-xl border border-negative/50 bg-negative/5 p-4 text-center">
        <div className="text-sm font-semibold">
          🛑 N&apos;enchérissez jamais au-dessus de
        </div>
        <div className="text-3xl font-black mt-1">{euro(a.maxBudget)}</div>
        <div className="text-[11px] text-muted mt-1">
          prix marteau maximal préservant 30 % de ROI sur la revente normale
        </div>
      </div>

      {/* 🎯 Stratégie conseillée */}
      <div className="rounded-xl border border-accent/50 bg-accent/5 p-4">
        <div className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">
          🎯 Stratégie conseillée
        </div>
        <div className="text-lg font-bold">{a.strategy.title}</div>
        <p className="text-sm text-muted mt-1">{a.strategy.reason}</p>
        {a.strategy.kind && (
          <div className="grid grid-cols-3 gap-2 mt-3 text-center text-sm">
            <div className="rounded-lg bg-surface p-2">
              <div className="text-xs text-muted">Gain réel</div>
              <div className="font-bold">
                <Money value={a.strategy.gain} />
              </div>
            </div>
            <div className="rounded-lg bg-surface p-2">
              <div className="text-xs text-muted">Délai</div>
              <div className="font-bold">{a.strategy.timeEstimate}</div>
            </div>
            <div className="rounded-lg bg-surface p-2">
              <div className="text-xs text-muted">Probabilité</div>
              <div className="font-bold">{a.strategy.probability} %</div>
            </div>
          </div>
        )}
      </div>

      {/* Alerte gain minimum */}
      {!a.meetsMinProfit && (
        <p className="text-sm rounded-lg border border-negative/40 bg-negative/10 text-negative p-3">
          ⚠️ Aucun scénario n&apos;atteint votre gain minimum conseillé — cette
          opération ne vaut probablement pas le déplacement.
        </p>
      )}

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KeyFigure label="Coût total réel" value={euro(a.totalCost)} />
        <KeyFigure label="ROI (normal)" value={pct(a.roi)} />
        <KeyFigure
          label="Gain réel (normal)"
          value={<Money value={a.netProfit} />}
        />
        <KeyFigure label="Temps total estimé" value={hours(a.totalTimeHours)} />
      </div>

      {/* Détail du coût */}
      <section className="rounded-xl border border-edge bg-surface p-4">
        <h3 className="text-sm font-semibold mb-3 text-muted">
          Décomposition du coût
        </h3>
        <dl className="text-sm space-y-1.5">
          <CostRow label="Prix marteau" value={a.costBreakdown.hammerPrice} />
          <CostRow label="Frais acheteur" value={a.costBreakdown.buyerFee} />
          <CostRow label="TVA" value={a.costBreakdown.vat} />
          <CostRow label="Déplacement" value={a.costBreakdown.travelCost} />
          <CostRow label="Livraison" value={a.costBreakdown.shippingCost} />
          <div className="flex justify-between border-t border-edge pt-1.5 font-semibold">
            <dt>Total</dt>
            <dd>{euro(a.totalCost)}</dd>
          </div>
        </dl>
      </section>

      {/* Scénarios de revente */}
      <section className="rounded-xl border border-edge bg-surface p-4">
        <h3 className="text-sm font-semibold mb-3 text-muted">
          Scénarios de revente
        </h3>
        <table className="w-full text-sm">
          <thead className="text-muted text-xs">
            <tr>
              <th className="text-left font-medium pb-2">Scénario</th>
              <th className="text-right font-medium pb-2">Prix</th>
              <th className="text-right font-medium pb-2">Gain brut</th>
              <th className="text-right font-medium pb-2">Gain réel</th>
              <th className="text-right font-medium pb-2">Délai</th>
            </tr>
          </thead>
          <tbody>
            {a.scenarios.map((s) => (
              <tr
                key={s.kind}
                className={`border-t border-edge ${s.kind === a.strategy.kind ? "bg-accent/5" : ""}`}
              >
                <td className="py-1.5">
                  {s.kind === a.strategy.kind ? "🎯 " : ""}
                  {s.label}
                </td>
                <td className="py-1.5 text-right">{euro(s.price)}</td>
                <td className="py-1.5 text-right text-muted">
                  {signedEuro(s.grossProfit)}
                </td>
                <td className="py-1.5 text-right">
                  <Money value={s.netProfit} />
                </td>
                <td className="py-1.5 text-right text-muted text-xs">
                  {s.timeEstimate}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Pourquoi cette note ? */}
      <section className="rounded-xl border border-edge bg-surface p-4">
        <h3 className="text-sm font-semibold mb-3 text-muted">
          Pourquoi cette note ?
        </h3>
        {a.explanation.positives.length + a.explanation.negatives.length > 0 && (
          <ul className="text-sm space-y-1 mb-3">
            {a.explanation.positives.map((p) => (
              <li key={p} className="text-positive">
                ✔ {p}
              </li>
            ))}
            {a.explanation.negatives.map((n) => (
              <li key={n} className="text-negative">
                ✘ {n}
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2.5">
          {a.criteria.map((c) => (
            <div key={c.key}>
              <div className="flex justify-between text-xs mb-1">
                <span>
                  {c.label}{" "}
                  <span className="text-muted">
                    ({Math.round(c.weight * 100)} %)
                  </span>
                </span>
                <span className="font-medium">{c.value}/100</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    c.value >= 70
                      ? "bg-positive"
                      : c.value >= 40
                        ? "bg-accent"
                        : "bg-negative"
                  }`}
                  style={{ width: `${c.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 📦 Plateformes de revente */}
      <section className="rounded-xl border border-edge bg-surface p-4">
        <h3 className="text-sm font-semibold mb-3 text-muted">
          📦 Où revendre ?
        </h3>
        <ul className="text-sm space-y-2">
          {a.platforms.map((p) => (
            <li key={p.name} className="flex items-start justify-between gap-3">
              <div>
                <span className="font-medium">{p.name}</span>
                <p className="text-xs text-muted">{p.reason}</p>
              </div>
              <span className="text-accent whitespace-nowrap">
                {"★".repeat(p.stars)}
                <span className="opacity-25">{"★".repeat(5 - p.stars)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function KeyFigure({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted">{label}</dt>
      <dd>{euro(value)}</dd>
    </div>
  );
}
