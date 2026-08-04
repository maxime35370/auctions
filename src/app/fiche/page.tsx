"use client";

/**
 * Fiche détaillée d'une enchère (?id=<enchère>).
 * L'analyse est recalculée depuis les entrées : la fiche reflète toujours
 * les règles métier actuelles du moteur.
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
import { deleteAuction, getAuction, type AuctionRecord } from "@/lib/storage";
import { dateFr } from "@/lib/format";
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

        <AnalysisPanel analysis={analysis} />
      </div>
    </div>
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
