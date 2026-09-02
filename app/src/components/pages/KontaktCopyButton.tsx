"use client";
/* E-Mail-Adresse in die Zwischenablage kopieren — Portierung von
   wireCopyEmail() aus assets/js/pages/kontakt.js. Eigene Toast-Instanz
   (gleiches Muster wie EventsShareButton/AwarenessShareButton). */
import { useEffect, useState } from "react";

export default function KontaktCopyButton({
  email, copyToast = "Adresse kopiert ✓",
}: {
  email: string;
  copyToast?: string;
}) {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(id);
  }, [toast]);

  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setToast(copyToast);
    } catch {
      setToast(email);   // letzter Ausweg, falls Clipboard-API fehlt/blockiert ist
    }
  };

  return (
    <>
      <button type="button" id="fs-copy-btn" className="btn btn-ghost" onClick={onClick}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </svg>
        E-Mail kopieren
      </button>
      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}
