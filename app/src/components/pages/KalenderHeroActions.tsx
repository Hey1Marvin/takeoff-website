"use client";
/* Hero-CTA-Zeile: Abo-Knopf (bewusst inert — echter Feed kommt erst mit dem
   Backend, siehe .transmission-Erklärblock weiter unten) + Teilen-Knopf.
   Teilen-Logik 1:1 das Muster aus AwarenessShareButton.tsx (Web-Share-API
   mit Zwischenablage-Fallback), hier im eigenen Kalender-Namespace
   dupliziert statt seitenübergreifend importiert. */
import { useEffect, useState } from "react";

export default function KalenderHeroActions({
  subscribeLabel, subscribeTitle, shareLabel, shareText, copiedToast = "Link kopiert ✓",
}: {
  subscribeLabel: string;
  subscribeTitle: string;
  shareLabel: string;
  shareText: string;
  copiedToast?: string;
}) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  const onShare = async () => {
    const url = location.href.split("#")[0];
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, text: shareText, url });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast(copiedToast);
    } catch {
      setToast(url);
    }
  };

  return (
    <>
      <div className="cta-row">
        <button
          type="button"
          className="btn btn-primary"
          title={subscribeTitle}
          aria-disabled="true"
        >
          {subscribeLabel}
        </button>
        <button type="button" className="btn btn-ghost" aria-label={shareLabel} onClick={onShare}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" />
            <path d="M8.3 10.7l7.4-4.4M8.3 13.3l7.4 4.4" />
          </svg>
          <span>{shareLabel}</span>
        </button>
      </div>
      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}
