"use client";
/* Signatur-Motiv der Awareness-Seite: EIN violetter Aurora-Schleier in der
   Farbwelt der lila Warnwesten, der im 4-Sekunden-Takt atmet. Das ist der
   einzige Bewegungsmoment der Seite — bewusst kein Scroll-Effekt, keine
   Reveals, kein Parallax. Die Ruhe ist die Aussage.

   Alles Sichtbare steckt in awareness.css (Keyframes aw-breathe/aw-drift,
   getiert ueber html[data-fx]). Hier liegt nur das eine Stueck echte
   Interaktion: der Ruheraum-Abschnitt hebt beim Erreichen den unteren Saum
   an (html.aw-quiet-active) — ein langsamer Zustandswechsel, keine Schleife.
   Bei Tier s / reduced-motion bleibt der Zustand dauerhaft "an", ganz ohne
   Scroll-Tracking.

   Der Warp-Filter ist bewusst NUR eine Definition: referenziert wird er in
   awareness.css allein bei data-fx="l" und ausserhalb von reduced-motion.
   Vorher lief `filter: url(#aw-warp) blur(28px)` auf einer bildschirm-
   fuellenden fixierten Ebene in JEDER Stufe mit — die teuerste Zeile der
   Seite genau dort, wo jemand um wenig Effekt gebeten hat. */
import { useEffect } from "react";

export default function AwarenessAurora() {
  useEffect(() => {
    const html = document.documentElement;
    const quiet = document.querySelector(".aw-quiet");
    if (!quiet) return;

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fx = html.dataset.fx;

    if (fx === "s" || reduced || !("IntersectionObserver" in window)) {
      html.classList.add("aw-quiet-active");
      return () => html.classList.remove("aw-quiet-active");
    }

    const io = new IntersectionObserver(
      ([entry]) => html.classList.toggle("aw-quiet-active", entry.isIntersecting),
      { threshold: 0.35, rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(quiet);
    return () => {
      io.disconnect();
      html.classList.remove("aw-quiet-active");
    };
  }, []);

  return (
    <>
      {/* Nur Filter-Definition, kein sichtbares Element. `scene-deco`, damit
          scene-day.css dieser Ebene keinen hellen Grund unterschiebt. */}
      <svg className="aw-defs scene-deco" aria-hidden="true" focusable="false">
        <filter id="aw-warp" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.014" numOctaves={2} seed={7} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={150} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      {/* Der Schleier: eine Klasse statt einer ID — Seiten-CSS wird global
          gebuendelt, und eine ID im Selektor ist der Fehler, der schon einmal
          eine fremde Seite veraendert hat. */}
      <div className="aw-sky scene-deco" aria-hidden="true">
        <div className="aw-sky-veil" />
        <div className="aw-sky-glow" />
      </div>
    </>
  );
}
