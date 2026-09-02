"use client";
/* Zwei-Klick-Facade fuer ein Set/Podcast in der "Sound of takeoff"-Reihe —
   Portierung von renderListen()/card.addEventListener("click", () =>
   card.classList.toggle("asked")) aus assets/js/pages/musik.js. Kein
   echter Player, kein Tracking — ein Klick zeigt nur den Consent-Hinweis.
   Eigene, schlanke Kopie im musik-Namensraum (gleiches Muster wie
   ArtistsSetCard auf der Artists-Seite). */
import { useState } from "react";

export default function MusikSetCard({
  title, meta, consentText, ariaLabel,
}: {
  title: string;
  meta: string;
  consentText: string;
  ariaLabel: string;
}) {
  const [asked, setAsked] = useState(false);

  return (
    <button
      type="button"
      className={`setcard${asked ? " asked" : ""}`}
      aria-label={ariaLabel}
      aria-expanded={asked}
      onClick={() => setAsked(v => !v)}
    >
      <span className="cover" aria-hidden="true"><span className="play">▶</span></span>
      <span className="s-meta"><b>{title}</b><span>{meta}</span></span>
      <span className="consent-note">{consentText}</span>
    </button>
  );
}
