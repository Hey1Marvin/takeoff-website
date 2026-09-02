"use client";
/* Zwei-Klick-Facade fuer ein Set/Podcast — Portierung des Prototyp-Musters
   aus main.js: card.addEventListener("click", () => card.classList.toggle
   ("asked")). Kein echter Player, kein Tracking — ein Klick zeigt nur den
   Consent-Hinweis. Wird sowohl von der Artists-Uebersicht (ArtistsSetsSection)
   als auch von der Artist-Detailseite verwendet. */
import { useState } from "react";

export interface SetCardData {
  id: string;
  title: string;
  meta: string;
}

export default function ArtistsSetCard({
  data,
  highlighted = false,
  consentText,
  ariaLabel,
}: {
  data: SetCardData;
  highlighted?: boolean;
  consentText: string;
  ariaLabel: string;
}) {
  const [asked, setAsked] = useState(false);

  return (
    <button
      id={`set-${data.id}`}
      type="button"
      className={`setcard${asked ? " asked" : ""}${highlighted ? " hit" : ""}`}
      aria-label={ariaLabel}
      aria-expanded={asked}
      onClick={() => setAsked(v => !v)}
    >
      <span className="cover" aria-hidden="true"><span className="play">▶</span></span>
      <span className="s-meta"><b>{data.title}</b><span>{data.meta}</span></span>
      <span className="consent-note">{consentText}</span>
    </button>
  );
}
