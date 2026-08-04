"use client";

/** Bouton de suppression d'une enchère, avec confirmation. */
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteAuctionButton({ auctionId }: { auctionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm("Supprimer définitivement cette analyse ?")) return;
    setBusy(true);
    const res = await fetch(`/api/auctions/${auctionId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/encheres");
      router.refresh();
    } else {
      setBusy(false);
      alert("La suppression a échoué.");
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={busy}
      className="rounded-lg border border-negative/40 text-negative px-3 py-1.5 text-sm hover:bg-negative/10 disabled:opacity-50 transition-colors"
    >
      {busy ? "Suppression…" : "Supprimer"}
    </button>
  );
}
