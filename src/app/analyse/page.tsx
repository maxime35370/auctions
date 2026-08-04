"use client";

/**
 * Nouvelle analyse — ou édition si l'URL contient ?id=<enchère>.
 * En création, l'assistant d'import (URL / presse-papiers / démo) pré-remplit
 * le formulaire ; le paramètre de requête remplace les routes dynamiques,
 * incompatibles avec l'export statique GitHub Pages.
 */
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuctionForm } from "@/components/AuctionForm";
import { ImportAssistant } from "@/components/ImportAssistant";
import { getAuction, type AuctionDraft, type AuctionRecord } from "@/lib/storage";

export default function AnalysePage() {
  return (
    <Suspense>
      <AnalyseContent />
    </Suspense>
  );
}

function AnalyseContent() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const [record, setRecord] = useState<AuctionRecord | null>(null);
  const [imported, setImported] = useState<Partial<AuctionDraft> | null>(null);
  const [importCount, setImportCount] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (editId) setRecord(getAuction(editId) ?? null);
    setReady(true);
  }, [editId]);

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {record ? "Modifier l'analyse" : "Analyser une enchère"}
        </h1>
        <p className="text-sm text-muted mt-1">
          {record
            ? "Modifiez les informations : l'analyse se met à jour en temps réel."
            : "Importez une annonce ou saisissez les informations : l'analyse se met à jour en temps réel."}
        </p>
      </div>

      {!record && (
        <ImportAssistant
          onImported={(draft) => {
            setImported(draft);
            setImportCount((n) => n + 1); // remonte le formulaire avec les données
          }}
        />
      )}

      <AuctionForm
        key={record?.id ?? `import-${importCount}`}
        auctionId={record?.id}
        initialValues={record ?? imported ?? undefined}
      />
    </div>
  );
}
