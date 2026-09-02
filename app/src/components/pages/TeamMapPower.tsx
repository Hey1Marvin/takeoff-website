"use client";
/* Der EINE orchestrierte Bewegungsmoment der Team-Seite (It. 14): der
   Bordplan baut sich einmal auf, wenn er zum ersten Mal ins Bild kommt —
   die Ringe zeichnen sich, danach setzen die Punkte gestaffelt ein, einer
   je Crew-Rolle. Alles andere auf der Seite bewegt sich nur noch als
   Antwort auf eine Handlung (Karte drehen, Station anfassen).

   Gleiches Muster wie EventsBoardPower.tsx: eigener IntersectionObserver
   statt der globalen .reveal-Mechanik, weil der Server-Render sichtbar
   bleiben muss — ohne JS steht der fertige Plan sofort da. Nachgereicht
   wird nur die Klasse, unter der die Keyframes in team.css haengen.

   FX-Tier und prefers-reduced-motion werden VOR dem Klassenwechsel
   geprueft: bei data-fx="s" oder reduzierter Bewegung passiert gar nichts,
   nicht nur eine gestauchte Laufzeit. */
import { useEffect } from "react";

export default function TeamMapPower() {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".kt-map");
    if (!el) return;
    if (document.documentElement.dataset.fx === "s") return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          io.unobserve(el);
          el.classList.add("kt-map-on");
        });
      },
      { rootMargin: "0px 0px -12% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return null;
}
