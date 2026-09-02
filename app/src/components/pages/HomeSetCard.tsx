"use client";
/* Zwei-Klick-Player (Facade) — Portierung von main.js Z. 6056–6058:
   `$$(".setcard").forEach(card => card.addEventListener("click", () =>
   card.classList.toggle("asked")))`.

   Erst der Klick deckt die Consent-Notiz auf (.setcard.asked .consent-note),
   erst danach würde ein echter Player nachgeladen. Ohne Klick geht kein
   einziger Request an SoundCloud oder YouTube — das ist der Punkt der
   Facade, kein Deko-Detail. */
import { useState } from "react";

export default function HomeSetCard({
  title, meta, consentNote, ariaLabel,
}: {
  title: string;
  meta: string;
  consentNote: string;
  ariaLabel: string;
}) {
  const [asked, setAsked] = useState(false);

  return (
    <button
      className={`setcard${asked ? " asked" : ""}`}
      type="button"
      aria-label={ariaLabel}
      aria-expanded={asked}
      onClick={() => setAsked(a => !a)}
    >
      <span className="cover"><span className="play" aria-hidden="true">▶</span></span>
      <span className="s-meta"><b>{title}</b><span>{meta}</span></span>
      <span className="consent-note">{consentNote}</span>
    </button>
  );
}
