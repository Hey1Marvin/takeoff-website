"use client";
/* Klebende Leiste der Event-Seite — nur Telefon, nur kommende Events.

   Der Daumen wohnt im unteren Drittel des Schirms. Der eine Knopf der
   Seite (Telegram) steht im Hero und ist nach dem ersten Wisch weg;
   ab da steht er hier unten, zusammen mit dem Satz, den man braucht,
   um ihn zu treffen („SA 19.09. · 23:00 · Free Entry").

   Sichtbar wird die Leiste erst, wenn der Hero-Knopf NACH OBEN aus dem
   Bild gescrollt ist — nicht, wenn er noch unter dem Falz wartet, sonst
   staenden beim Laden zwei Knoepfe fuer dieselbe Aktion im Bild.

   Warum IntersectionObserver und kein Scroll-Listener: die Frage „ist
   der Knopf im Bild?" muss nicht pro Bild beantwortet werden, sondern
   nur an der Kante. Der Observer feuert genau dort und kostet dazwischen
   nichts — kein Layout-Lesen im Takt, also auch nichts, was an
   src/lib/frame.ts angemeldet gehoerte. Ohne Observer (sehr alte
   Browser) bleibt die Leiste einfach eingefahren; der Hero-Knopf ist
   weiterhin da.

   Aussehen: mobile.css (.sticky-cta) — hier nur Markup und Zustand. */
import { useEffect, useState } from "react";

export default function EventStickyCta({ info, href, label, ariaLabel }: {
  info: React.ReactNode;
  href: string;
  label: string;
  ariaLabel: string;
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const anchor = document.querySelector(".ed-hero-cta") ?? document.querySelector(".ehero");
    if (!anchor) return;
    const io = new IntersectionObserver(([entry]) => {
      /* `top < 0`: der Anker liegt OBERHALB des Viewports. Nur dann
         ist der Hero-Knopf wirklich vorbeigescrollt. */
      setShown(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    io.observe(anchor);
    return () => io.disconnect();
  }, []);

  return (
    <div className={"sticky-cta" + (shown ? " is-shown" : "")} role="region" aria-label={ariaLabel}>
      <span className="sc-info">{info}</span>
      <a className="btn btn-primary" href={href} target="_blank" rel="noopener">{label}</a>
    </div>
  );
}
