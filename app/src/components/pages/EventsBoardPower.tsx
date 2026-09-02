"use client";
/* Abflugtafel "Power-On" — der EINE orchestrierte Bewegungsmoment der
   Seite (It. 14). Beim ersten Sichtbarwerden faehrt der Rahmen hoch
   (.board-power-on) UND die Zeilen klappen gestaffelt um
   (.ev-flap-in auf der Liste, Verzoegerung ueber --i je Zeile).
   Beides laeuft aus EINEM Beobachter, damit Rahmen und Zeilen nicht
   gegeneinander starten.

   Gleiches Muster wie EventsStatusFlap.tsx: eigener IntersectionObserver
   statt der globalen .reveal-Mechanik, weil weder Rahmen noch Zeilen
   einen Grundzustand "unsichtbar" bekommen sollen — der Server-Render
   bleibt immer sichtbar, auch ohne JS. Nur die Klasse fuer die Keyframes
   (events.css) wird nachgereicht.

   Respektiert FX-Tier + prefers-reduced-motion VOR dem Klassenwechsel;
   die Keyframes liegen zusaetzlich unter eigenen Bremsen in events.css
   (die globale [data-fx="s"]-Regel in takeoff.css staucht nur die
   Laufzeit, nicht die Verzoegerung). */
import { useEffect } from "react";

export default function EventsBoardPower() {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".ev-frame");
    if (!el) return;
    const fxOn = document.documentElement.dataset.fx !== "s";
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fxOn || reduced || !("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          io.unobserve(el);
          el.classList.add("board-power-on");
          el.querySelector(".ev-rows")?.classList.add("ev-flap-in");
        });
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return null;
}
