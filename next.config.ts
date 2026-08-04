import type { NextConfig } from "next";

/**
 * Export statique : l'application est déployée sur GitHub Pages (aucun
 * serveur). `NEXT_PUBLIC_BASE_PATH` est défini par le workflow de déploiement
 * (/auctions) ; en local, l'app est servie à la racine.
 */
const nextConfig: NextConfig = {
  output: "export",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",
  trailingSlash: true, // URLs en /dossier/ → accès direct possible sur GitHub Pages
  images: { unoptimized: true },
};

export default nextConfig;
