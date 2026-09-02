"use client";
/* Signatur-Motiv "Bodenstation" — fixe Empfangsschüssel oben rechts, hinter
   dem Inhalt (z-index -2, gleiches Stapel-Prinzip wie #stars/#aw-sky: exakt
   dieser Knoten landet im DOM NACH Starfield, gewinnt also bei gleichem
   z-index automatisch). Sweep/Ringe sind reines CSS über [data-fx] (siehe
   news.css) — hier steckt nur der einmalige "Power-On"-Puls beim ersten
   Sichtbarwerden der Hero-Section (Muster: AwarenessAurora). Die zweite
   Interaktion — der "Ping" beim Abschluss des Typewriters — kommt bewusst
   NICHT von hier: NewsCard löst ihn selbst über die stabile id="rx-array"
   aus (1:1 die Bruecke, die auch news.js nutzt: pingArray() fragt das
   Element direkt aus dem DOM, statt Props durch den Baum zu reichen). */
import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";

export default function NewsRxArray() {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fx = document.documentElement.dataset.fx;
    if (fx === "s" || reduced || !("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver(
      entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        el.classList.add("rx-poweron");
      }),
      { threshold: 0.1 }
    );
    io.observe(document.querySelector(".phero") ?? document.body);
    return () => io.disconnect();
  }, []);

  return (
    <svg
      id="rx-array"
      ref={ref}
      className="rx-array scene-deco"
      viewBox="0 0 640 480"
      preserveAspectRatio="xMaxYMin meet"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="rx-chrome" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--chrome-hi)" />
          <stop offset=".5" stopColor="var(--chrome-mid)" />
          <stop offset="1" stopColor="var(--chrome-lo)" />
        </linearGradient>
      </defs>
      <g className="rx-rings" transform="translate(430 150)">
        <circle className="rx-ring" r="34" />
        <circle className="rx-ring" r="34" style={{ "--rx-delay": "1.6s" } as CSSProperties} />
        <circle className="rx-ring" r="34" style={{ "--rx-delay": "3.2s" } as CSSProperties} />
        <circle className="rx-ring rx-ring--burst" r="34" />
      </g>
      <g className="rx-sweep" transform="translate(430 150)">
        <line x1="0" y1="0" x2="0" y2="-150" />
      </g>
      <g className="rx-mast" fill="none" stroke="url(#rx-chrome)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M370 150 a60 22 -8 1 0 120 -14 a60 22 -8 1 0 -120 14 Z" />
        <path d="M430 150 L430 96" />
        <path d="M430 172 L430 300 M405 300 L455 300 M415 300 L410 330 M445 300 L450 330" />
      </g>
    </svg>
  );
}
