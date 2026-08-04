/** Affichage étoiles + score /100 d'une enchère. */
export function ScoreStars({
  score,
  size = "md",
}: {
  score: number;
  size?: "sm" | "md" | "lg";
}) {
  const stars = Math.max(1, Math.min(5, Math.round(score / 20)));
  const textSize =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg";
  return (
    <span className={`inline-flex items-center gap-2 ${textSize}`}>
      <span className="text-accent tracking-tight">
        {"★".repeat(stars)}
        <span className="opacity-25">{"★".repeat(5 - stars)}</span>
      </span>
      <span className="font-semibold">{score}/100</span>
    </span>
  );
}
