"use client";
/* Teilen-Knopf für die Hilfe-Seite — Web-Share-API mit Zwischenablage-
   Fallback. 1:1 das Muster aus dem Prototyp (wireShareButtons in
   assets/js/pages/awareness.js, übernommen von events.js). */
import { useEffect, useState } from "react";

export default function AwarenessShareButton({
  text, url, label, copiedToast = "Link kopiert ✓",
}: {
  text: string;
  url: string;
  label: string;
  copiedToast?: string;
}) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  const onClick = async () => {
    const absUrl = new URL(url, location.href).href;
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, text, url: absUrl });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        // sonst: Clipboard-Fallback unten
      }
    }
    try {
      await navigator.clipboard.writeText(absUrl);
      setToast(copiedToast);
    } catch {
      setToast(absUrl); // letzter Ausweg, falls Clipboard-API fehlt/blockiert ist
    }
  };

  return (
    <>
      <button type="button" className="btn btn-ghost m-share" onClick={onClick}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" />
          <path d="M8.3 10.7l7.4-4.4M8.3 13.3l7.4 4.4" />
        </svg>
        <span>{label}</span>
      </button>
      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}
