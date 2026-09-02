"use client";
/* Signatur-Motiv "Leuchtfeuer": violetter Aurora-Schleier über dem
   Sternenhimmel + Atem-Puls. Fast alles daran ist reines CSS, getrieben
   vom globalen data-fx-Attribut (siehe @keyframes aw-breathe in
   awareness.css) — hier steckt nur das eine Stück echte Interaktion:
   der Ruheraum-Abschnitt intensiviert beim Erreichen kurz den
   Horizont-Glow (html.aw-quiet-active). Bei Tier s / reduced-motion
   bleibt der Zustand dauerhaft "an", ganz ohne Scroll-Tracking —
   identisch zum Prototyp-Fallback in awareness.js. */
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
      {/* Warp-Filter (einmalig, unbewegt) — nur Definition, kein sichtbares Element */}
      <svg
        className="aw-defs"
        aria-hidden="true"
        focusable="false"
        style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      >
        <filter id="aw-warp" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.014" numOctaves={2} seed={7} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={160} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      {/* Himmels-Ebene: liegt ÜBER #stars, Sternenhimmel bleibt sichtbar (mix-blend-mode: screen) */}
      <div id="aw-sky" className="scene-deco" aria-hidden="true"><div className="aw-sky-inner" /></div>
    </>
  );
}
