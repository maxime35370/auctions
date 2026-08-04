/** Helpers de formatage (affichage uniquement — aucun calcul métier ici). */

export const euro = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);

export const pct = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)} %`;

export const signedEuro = (n: number) => `${n > 0 ? "+" : ""}${euro(n)}`;

/** Formate une durée en heures : 3.75 → "3 h 45". */
export const hours = (h: number) => {
  const whole = Math.floor(h);
  const minutes = Math.round((h - whole) * 60);
  if (whole === 0 && minutes === 0) return "0 h";
  if (minutes === 0) return `${whole} h`;
  return `${whole} h ${String(minutes).padStart(2, "0")}`;
};

export const dateFr = (d: Date | string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(
    typeof d === "string" ? new Date(d) : d
  );
