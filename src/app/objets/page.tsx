"use client";

/**
 * Base de connaissances : la liste des fiches produits, avec leurs
 * statistiques calculées depuis les ventes observées.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  productStats,
  type Category,
} from "@/lib/engine";
import {
  allObservations,
  listProducts,
  saveProduct,
  type Observation,
  type Product,
} from "@/lib/storage";
import { euro } from "@/lib/format";
import { ConfidenceBadge, Trend } from "@/components/KnowledgeBadges";
import { MarketReceiver } from "@/components/MarketReceiver";

export default function ObjetsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("autre");

  const refresh = () => {
    setProducts(listProducts());
    setObservations(allObservations());
  };
  useEffect(refresh, []);

  if (products === null) return null;

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    saveProduct({
      name: name.trim(),
      brand: "",
      category,
      aliases: [],
      priceNew: null,
      notes: "",
      checkPoints: "",
      accessories: [],
    });
    setName("");
    setCreating(false);
    refresh();
  }

  return (
    <div className="space-y-6">
      {/* Réception d'une étude de marché envoyée par l'extension Chrome */}
      <MarketReceiver />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            📚 Base de connaissances{" "}
            <span className="text-muted text-base font-normal">
              ({products.length} fiche{products.length > 1 ? "s" : ""})
            </span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Chaque produit a sa fiche : plus vous enregistrez de ventes
            observées, plus les analyses deviennent intelligentes.
          </p>
        </div>
        <button
          onClick={() => setCreating((c) => !c)}
          className="rounded-lg bg-accent text-background font-semibold px-4 py-2 text-sm hover:opacity-90 transition-opacity"
        >
          + Nouvelle fiche
        </button>
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-accent/40 bg-surface p-4 flex flex-col sm:flex-row gap-3"
        >
          <input
            className="field flex-1"
            autoFocus
            placeholder="Ex : Canon EF 100-400 L IS II"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="field sm:w-56"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-accent text-background font-semibold px-4 py-2 text-sm"
          >
            Créer
          </button>
        </form>
      )}

      {products.length === 0 && !creating ? (
        <div className="rounded-xl border border-edge bg-surface p-10 text-center space-y-3">
          <p className="text-3xl">📚</p>
          <p className="font-semibold">Aucune fiche produit pour le moment</p>
          <p className="text-sm text-muted max-w-md mx-auto">
            Créez une fiche pour chaque objet que vous suivez (ex. « Canon
            100-400 II », « Raspberry Pi 5 »), puis enregistrez les prix
            observés sur Interencheres, Leboncoin, eBay… L&apos;application
            calculera prix conseillés, indice de confiance et tendance.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {products.map((p) => {
            const obs = observations.filter((o) => o.productId === p.id);
            const stats = productStats(obs);
            return (
              <Link
                key={p.id}
                href={`/objet?id=${p.id}`}
                className="rounded-xl border border-edge bg-surface p-4 hover:border-accent/50 transition-colors block space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-muted">
                      {CATEGORY_LABELS[p.category as Category] ?? p.category}
                      {p.brand ? ` · ${p.brand}` : ""}
                    </p>
                  </div>
                  <ConfidenceBadge value={stats.confidence} />
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  <span className="text-muted">
                    Observé <b className="text-foreground">{stats.count}</b> fois
                  </span>
                  {stats.avg !== undefined && (
                    <span className="text-muted">
                      Prix moyen <b className="text-foreground">{euro(stats.avg)}</b>
                    </span>
                  )}
                  {stats.trendPct !== undefined && <Trend pct={stats.trendPct} />}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
