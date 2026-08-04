import { AuctionForm } from "@/components/AuctionForm";

export const metadata = { title: "Nouvelle analyse — Auction Intelligence" };

export default function AnalysePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analyser une enchère</h1>
        <p className="text-sm text-muted mt-1">
          Collez l&apos;URL de l&apos;annonce puis saisissez les informations :
          l&apos;analyse se met à jour en temps réel.
        </p>
      </div>
      <AuctionForm />
    </div>
  );
}
