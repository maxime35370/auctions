/** Helpers de formatage (affichage uniquement — aucun calcul métier ici). */

export const euro = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);

export const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)} %`;

export const signedEuro = (n: number) => `${n > 0 ? "+" : ""}${euro(n)}`;

export const dateFr = (d: Date | string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
    typeof d === "string" ? new Date(d) : d
  );
