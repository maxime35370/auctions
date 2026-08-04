"use client";

/**
 * Fiche détaillée d'une enchère (?id=<enchère>) : analyse complète, photos,
 * checklist de vérifications, pipeline de revente et résultat réel.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  analyzeAuction,
  CATEGORY_LABELS,
  CONDITIONS,
  type Category,
} from "@/lib/engine";
import {
  deleteAuction,
  getAuction,
  getProduct,
  PIPELINE_STEPS,
  STATUS_LABELS,
  toggleChecklistItem,
  togglePipelineStep,
  updateOutcome,
  type AuctionRecord,
  type AuctionStatus,
} from "@/lib/storage";
import { dateFr, euro } from "@/lib/format";
import { AnalysisPanel } from "@/components/AnalysisPanel";

export default function FichePage() {
  return (
    <Suspense>
      <FicheContent />
    </Suspense>
  );
}

function FicheContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [record, setRecord] = useState<AuctionRecord | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (id) setRecord(getAuction(id) ?? null);
    setReady(true);
  }, [id]);

  if (!ready) return null;

  if (!record) {
    return (
      <div className="rounded-xl border border-edge bg-surface p-10 text-center space-y-3">
        <p className="font-semibold">Enchère introuvable</p>
        <Link href="/encheres" className="text-accent text-sm hover:underline">
          ← Retour à l&apos;historique
        </Link>
      </div>
    );
  }

  const analysis = analyzeAuction(record);
  const conditionLabel =
    CONDITIONS.find((c) => c.value === record.condition)?.label ??
    record.condition;
  const owned = record.status === "achetee" || record.status === "revendue";

  function handleDelete() {
    if (!record || !confirm("Supprimer définitivement cette analyse ?")) return;
    deleteAuction(record.id);
    router.push("/encheres");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/encheres" className="text-xs text-muted hover:text-foreground">
            ← Retour à l&apos;historique
          </Link>
          <h1 className="text-2xl font-bold mt-1">{record.title}</h1>
          <p className="text-sm text-muted mt-1">
            Analysée le {dateFr(record.createdAt)}
            {record.auctionHouse ? ` · ${record.auctionHouse}` : ""}
            {record.location ? ` · ${record.location}` : ""}
            {record.endDate ? ` · fin : ${dateFr(record.endDate)}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/analyse?id=${record.id}`}
            className="rounded-lg border border-edge px-3 py-1.5 text-sm hover:bg-surface-2 transition-colors"
          >
            Modifier
          </Link>
          <button
            onClick={handleDelete}
            className="rounded-lg border border-negative/40 text-negative px-3 py-1.5 text-sm hover:bg-negative/10 transition-colors"
          >
            Supprimer
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6 items-start">
        {/* ------------------------- Colonne gauche ---------------------- */}
        <div className="space-y-5">
          {/* Photos */}
          {record.photos.length > 0 && (
            <section className="rounded-xl border border-edge bg-surface p-4">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
                📷 Photos
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {record.photos.map((url) => (
                  <PhotoThumb key={url} url={url} alt={record.title} />
                ))}
              </div>
            </section>
          )}

          {/* Informations */}
          <section className="rounded-xl border border-edge bg-surface p-4 space-y-2 text-sm">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
              Informations
            </h2>
            <InfoRow
              label="Catégorie"
              value={CATEGORY_LABELS[record.category as Category] ?? record.category}
            />
            <InfoRow label="État" value={conditionLabel} />
            <InfoRow label="Maison de vente" value={record.auctionHouse} />
            <InfoRow label="Localisation" value={record.location} />
            <InfoRow
              label="Fiche produit"
              value={
                record.productId ? (
                  <Link
                    href={`/objet?id=${record.productId}`}
                    className="text-accent hover:underline"
                  >
                    📚 {getProduct(record.productId)?.name ?? "Voir la fiche"} →
                  </Link>
                ) : null
              }
            />
            <InfoRow
              label="Équipements inclus"
              value={
                record.accessoriesIncluded.length > 0
                  ? record.accessoriesIncluded.join(", ")
                  : null
              }
            />
            <InfoRow
              label="Annonce"
              value={
                record.sourceUrl ? (
                  <a
                    href={record.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline break-all"
                  >
                    Voir l&apos;annonce ↗
                  </a>
                ) : null
              }
            />
            {record.comments && (
              <div className="pt-2 border-t border-edge">
                <div className="text-xs text-muted mb-1">Commentaires</div>
                <p className="whitespace-pre-wrap">{record.comments}</p>
              </div>
            )}
          </section>

          {/* ⚠️ Checklist de vérifications */}
          <section className="rounded-xl border border-edge bg-surface p-4">
            <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
              ⚠️ Vérifications avant d&apos;enchérir
            </h2>
            <ul className="space-y-1.5 text-sm">
              {record.checklist.map((item, i) => (
                <li key={i}>
                  <label className="flex items-center gap-2 cursor-pointer hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={() =>
                        setRecord(toggleChecklistItem(record.id, i) ?? record)
                      }
                      className="accent-[var(--accent)]"
                    />
                    <span className={item.done ? "line-through text-muted" : ""}>
                      {item.label}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          {/* Résultat réel */}
          <OutcomeSection record={record} onChange={setRecord} />

          {/* Pipeline de revente (lots possédés) */}
          {owned && (
            <section className="rounded-xl border border-edge bg-surface p-4">
              <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
                🔄 Suivi de la revente
              </h2>
              <ul className="space-y-1.5 text-sm">
                {PIPELINE_STEPS.map((step) => {
                  const done = record.pipeline.includes(step.key);
                  return (
                    <li key={step.key}>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={done}
                          onChange={() =>
                            setRecord(
                              togglePipelineStep(record.id, step.key) ?? record
                            )
                          }
                          className="accent-[var(--accent)]"
                        />
                        <span className={done ? "text-positive" : ""}>
                          {done ? "✔ " : ""}
                          {step.label}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden mt-3">
                <div
                  className="h-full rounded-full bg-positive transition-all"
                  style={{
                    width: `${(record.pipeline.length / PIPELINE_STEPS.length) * 100}%`,
                  }}
                />
              </div>
            </section>
          )}
        </div>

        {/* ------------------------- Analyse ----------------------------- */}
        <AnalysisPanel analysis={analysis} />
      </div>
    </div>
  );
}

/** Statut + prix réels : la matière première du portefeuille. */
function OutcomeSection({
  record,
  onChange,
}: {
  record: AuctionRecord;
  onChange: (r: AuctionRecord) => void;
}) {
  const apply = (patch: {
    status?: AuctionStatus;
    finalPrice?: number | null;
    soldPrice?: number | null;
  }) => {
    const next = updateOutcome(record.id, {
      status: patch.status ?? record.status,
      finalPrice:
        patch.finalPrice !== undefined ? patch.finalPrice : record.finalPrice,
      soldPrice:
        patch.soldPrice !== undefined ? patch.soldPrice : record.soldPrice,
    });
    if (next) onChange(next);
  };

  return (
    <section className="rounded-xl border border-edge bg-surface p-4 space-y-3">
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
        🏁 Résultat réel
      </h2>
      <div>
        <label className="field-label">Statut</label>
        <select
          className="field"
          value={record.status}
          onChange={(e) => apply({ status: e.target.value as AuctionStatus })}
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {(record.status === "achetee" ||
        record.status === "revendue" ||
        record.status === "perdue") && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Prix d&apos;adjudication (€)</label>
            <input
              className="field"
              type="number"
              min={0}
              value={record.finalPrice ?? ""}
              placeholder="—"
              onChange={(e) =>
                apply({
                  finalPrice:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </div>
          {record.status === "revendue" && (
            <div>
              <label className="field-label">Prix de revente réel (€)</label>
              <input
                className="field"
                type="number"
                min={0}
                value={record.soldPrice ?? ""}
                placeholder="—"
                onChange={(e) =>
                  apply({
                    soldPrice:
                      e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
          )}
        </div>
      )}
      {record.status === "revendue" &&
        record.soldPrice !== null &&
        record.finalPrice !== null && (
          <p className="text-sm text-muted">
            Bénéfice réalisé pris en compte dans votre portefeuille :{" "}
            <span className="font-semibold text-positive">
              {euro(record.soldPrice)}
            </span>{" "}
            de revente pour un achat adjugé à{" "}
            <span className="font-semibold">{euro(record.finalPrice)}</span>.
          </p>
        )}
    </section>
  );
}

/**
 * Vignette photo tolérante : les liens d'images externes peuvent expirer ou
 * refuser l'affichage — une image indisponible montre un emplacement neutre
 * et ne bloque jamais l'analyse.
 */
function PhotoThumb({ url, alt }: { url: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div
        className="rounded-lg w-full h-32 border border-edge bg-surface-2 flex items-center justify-center text-muted text-xs"
        title={url}
      >
        📷 indisponible
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        onError={() => setBroken(true)}
        className="rounded-lg w-full h-32 object-cover border border-edge hover:opacity-90"
      />
    </a>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
