"use client";

/**
 * Assistant d'import : URL, presse-papiers ou démo → progression détaillée
 * (✅ site reconnu, 📷 photos trouvées, ⚠ frais non trouvés…) → formulaire
 * pré-rempli via onImported().
 */
import { useEffect, useRef, useState } from "react";
import {
  importFromClipboard,
  importFromExtension,
  importFromUrl,
  toDraft,
  type ImportStep,
} from "@/lib/import/importer";
import {
  decodeExtensionPayload,
  EXT_IMPORT_HASH_PREFIX,
} from "@/lib/import/extension";
import type { AuctionDraft } from "@/lib/storage";

export function ImportAssistant({
  onImported,
}: {
  onImported: (draft: Partial<AuctionDraft>) => void;
}) {
  const [url, setUrl] = useState("");
  const [steps, setSteps] = useState<ImportStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const stepsRef = useRef<HTMLDivElement>(null);

  const report = (step: ImportStep) =>
    setSteps((prev) => {
      // Une étape "pending" est remplacée par la suivante de même icône.
      const next = [...prev.filter((s) => s.status !== "pending" || s.icon !== step.icon), step];
      queueMicrotask(() =>
        stepsRef.current?.scrollTo({ top: 99999, behavior: "smooth" })
      );
      return next;
    });

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setSteps([]);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  // 🧩 Import automatique quand la page est ouverte par l'extension Chrome
  // (#ext-import=… dans l'URL — le fragment n'est jamais envoyé à un serveur).
  const extHandled = useRef(false);
  useEffect(() => {
    if (extHandled.current) return;
    if (!window.location.hash.startsWith(EXT_IMPORT_HASH_PREFIX)) return;
    extHandled.current = true;
    const payload = decodeExtensionPayload(window.location.hash);
    // Nettoie l'URL (évite de ré-importer au rechargement).
    window.history.replaceState(null, "", window.location.pathname);
    if (!payload) return;
    setUrl(payload.url);
    run(async () => {
      const data = await importFromExtension(payload, report);
      if (data) onImported(toDraft(data));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUrl = () =>
    run(async () => {
      const data = await importFromUrl(url.trim(), report);
      if (data) onImported(toDraft(data));
    });

  const handleDemo = () =>
    run(async () => {
      const data = await importFromUrl("demo:ender3", report);
      if (data) onImported(toDraft(data));
    });

  const handlePaste = () =>
    run(async () => {
      let content = pasteText;
      // Si la zone est vide, on tente la lecture directe du presse-papiers.
      if (!content.trim() && navigator.clipboard?.readText) {
        try {
          content = await navigator.clipboard.readText();
        } catch {
          // Permission refusée : l'utilisateur collera dans la zone de texte.
        }
      }
      if (!content.trim()) {
        setPasteOpen(true);
        report({
          icon: "📋",
          label:
            "Collez le contenu de la page dans la zone ci-dessous (Ctrl+A puis Ctrl+C sur la page de l'annonce), puis relancez.",
          status: "warn",
        });
        return;
      }
      const data = await importFromClipboard(content, url.trim(), report);
      if (data) {
        onImported(toDraft(data));
        setPasteText("");
      }
    });

  return (
    <section className="rounded-xl border border-accent/40 bg-surface p-4 space-y-3">
      <h2 className="text-sm font-semibold text-accent uppercase tracking-wide">
        ⚡ Import automatique
      </h2>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          className="field flex-1"
          type="url"
          placeholder="https://www.interencheres.com/…"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && url.trim()) {
              e.preventDefault();
              handleUrl();
            }
          }}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleUrl}
            disabled={busy || !url.trim()}
            className="rounded-lg bg-accent text-background font-semibold px-4 py-2 text-sm hover:opacity-90 disabled:opacity-40 transition-opacity whitespace-nowrap"
          >
            Analyser l&apos;URL
          </button>
          <button
            type="button"
            onClick={() => {
              setPasteOpen(true);
              if (pasteText.trim()) handlePaste();
            }}
            disabled={busy}
            className="rounded-lg border border-edge px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-40 transition-colors whitespace-nowrap"
            title="Copiez toute la page de l'annonce, puis collez-la ici"
          >
            📋 Presse-papiers
          </button>
          <button
            type="button"
            onClick={handleDemo}
            disabled={busy}
            className="rounded-lg border border-edge px-3 py-2 text-sm hover:bg-surface-2 disabled:opacity-40 transition-colors whitespace-nowrap"
            title="Charge une enchère fictive réaliste pour tester le flux complet"
          >
            🧪 Démo
          </button>
        </div>
      </div>

      {pasteOpen && (
        <div className="space-y-2">
          <textarea
            className="field min-h-28 font-mono text-xs"
            placeholder="Collez ici le contenu de la page de l'annonce (Ctrl+A puis Ctrl+C sur la page, puis Ctrl+V ici)…"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <button
            type="button"
            onClick={handlePaste}
            disabled={busy || !pasteText.trim()}
            className="rounded-lg bg-accent text-background font-semibold px-4 py-1.5 text-sm hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            Extraire les informations
          </button>
        </div>
      )}

      {steps.length > 0 && (
        <div
          ref={stepsRef}
          className="rounded-lg bg-surface-2 p-3 text-sm space-y-1 max-h-48 overflow-y-auto"
        >
          {steps.map((s, i) => (
            <p
              key={i}
              className={
                s.status === "ok"
                  ? "text-positive"
                  : s.status === "warn"
                    ? "text-accent"
                    : s.status === "error"
                      ? "text-negative"
                      : "text-muted"
              }
            >
              {s.icon} {s.label}
            </p>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted">
        L&apos;import remplit le formulaire ci-dessous — vérifiez toujours les
        valeurs avant d&apos;enregistrer. Trois voies : 🧩 l&apos;extension
        Chrome « Analyser cette enchère » (un clic depuis la page de
        l&apos;annonce —{" "}
        <a
          href="https://github.com/maxime35370/auctions/tree/main/extension"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          installation
        </a>
        ), 🌐 l&apos;URL directe (selon les sites), et 📋 le presse-papiers
        qui fonctionne partout.
      </p>
    </section>
  );
}
