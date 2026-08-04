/**
 * Panneau de résultats d'une analyse : verdict, coûts, scénarios de revente
 * et détail des critères. Utilisé à la fois par l'aperçu en direct du
 * formulaire et par la fiche détaillée d'une enchère.
 */
import type { AuctionAnalysis } from "@/lib/engine";
import { euro, pct, signedEuro } from "@/lib/format";
import { ScoreStars } from "./ScoreStars";

const VERDICT_STYLES: Record<AuctionAnalysis["verdict"], string> = {
  pepite: "bg-accent/15 text-accent border-accent/40",
  "bonne-affaire": "bg-positive/10 text-positive border-positive/40",
  correct: "bg-yellow-500/10 text-yellow-400 border-yellow-500/40",
  "a-eviter": "bg-negative/10 text-negative border-negative/40",
};

function Money({ value }: { value: number }) {
  const cls = value > 0 ? "text-positive" : value < 0 ? "text-negative" : "";
  return <span className={cls}>{signedEuro(value)}</span>;
}

export function AnalysisPanel({ analysis }: { analysis: AuctionAnalysis }) {
  const a = analysis;
  return (
    <div className="space-y-5">
      {/* Verdict + score */}
      <div
        className={`rounded-xl border p-4 flex items-center justify-between ${VERDICT_STYLES[a.verdict]}`}
      >
        <span className="text-lg font-bold">{a.verdictLabel}</span>
        <ScoreStars score={a.score} size="lg" />
      </div>

      {/* Chiffres clés */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <KeyFigure label="Coût total réel" value={euro(a.totalCost)} />
        <KeyFigure
          label="Budget max conseillé"
          value={euro(a.maxBudget)}
          hint="prix marteau, ROI cible 30 %"
          accent
        />
        <KeyFigure label="ROI (normal)" value={pct(a.roi)} />
        <KeyFigure
          label="Marge potentielle"
          value={<Money value={a.potentialMargin} />}
        />
        <KeyFigure
          label="Bénéfice net (normal)"
          value={<Money value={a.netProfit} />}
        />
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
              <th className="text-right font-medium pb-2">Bénéfice net</th>
              <th className="text-right font-medium pb-2">ROI</th>
            </tr>
          </thead>
          <tbody>
            {a.scenarios.map((s) => (
              <tr key={s.kind} className="border-t border-edge">
                <td className="py-1.5">{s.label}</td>
                <td className="py-1.5 text-right">{euro(s.price)}</td>
                <td className="py-1.5 text-right">
                  <Money value={s.netProfit} />
                </td>
                <td className="py-1.5 text-right">{pct(s.roi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Critères de notation */}
      <section className="rounded-xl border border-edge bg-surface p-4">
        <h3 className="text-sm font-semibold mb-3 text-muted">
          Détail du score
        </h3>
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
    </div>
  );
}

function KeyFigure({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        accent ? "border-accent/50 bg-accent/5" : "border-edge bg-surface"
      }`}
    >
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      {hint && <div className="text-[10px] text-muted mt-0.5">{hint}</div>}
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
