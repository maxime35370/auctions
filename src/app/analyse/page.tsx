"use client";

/**
 * Nouvelle analyse — ou édition si l'URL contient ?id=<enchère>.
 * (Le paramètre de requête remplace les routes dynamiques, incompatibles
 * avec l'export statique GitHub Pages.)
 */
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuctionForm } from "@/components/AuctionForm";
import { getAuction, type AuctionRecord } from "@/lib/storage";

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
          Collez l&apos;URL de l&apos;annonce puis saisissez les informations :
          l&apos;analyse se met à jour en temps réel.
        </p>
      </div>
      <AuctionForm
        key={record?.id ?? "new"}
        auctionId={record?.id}
        initialValues={record ?? undefined}
      />
    </div>
  );
}
