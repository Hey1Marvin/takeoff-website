"use client";
/* Signatur-Motiv "Bodenstation Potsdam": fixe Dach-Antenne unten rechts,
   hinter dem Inhalt (z-index -2, gleiches Stapel-Prinzip wie #stars —
   dieser Knoten landet im DOM NACH Starfield, gewinnt also bei gleichem
   z-index automatisch). Scan-Bewegung der Dish und Sweep laufen komplett
   über reines, Tier-gatetes CSS (kontakt.css) — hier steckt nur der
   Sende-Puls: ein einziger, dokumentweiter Klick-Listener auf
   [data-fs-pulse] (Portierung von wirePulse() aus kontakt.js). Trifft
   jeden mailto:/Telegram-Link egal in welcher Sektion (Wegweiser-Chips,
   Empfehlungskarte, CTA-Reihe) — ganz ohne preventDefault, der Link läuft
   normal weiter, hier kommt nur Ping-Ring-Animation + Toast obendrauf. */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

/* Kein Feld in kontakt.json (siehe _labels dort) — im Prototyp ebenfalls
   ein reiner JS-Fallback, der nie aus den Seitendaten überschrieben wird. */
const TELEGRAM_TOAST = "Kanal wird geöffnet …";
const TOAST_MS = 2600;

export default function KontaktBodenstation({
  stationLabel, sendToast,
}: {
  stationLabel: string;
  sendToast: string;
}) {
  const groundRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-fs-pulse]");
      if (!btn) return;
      const ground = groundRef.current;
      if (ground) {
        ground.classList.remove("is-sending");
        void ground.offsetWidth;   // Reflow erzwingen, damit die Animation bei erneutem Klick neu startet
        ground.classList.add("is-sending");
      }
      setToast(btn.dataset.fsPulse === "telegram" ? TELEGRAM_TOAST : sendToast);
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [sendToast]);

  return (
    <>
      <div className="fs-ground scene-deco" aria-hidden="true" ref={groundRef}>
        <div className="fs-roofline" />
        <svg className="fs-rig" viewBox="0 0 220 240" overflow="visible">
          <defs>
            <linearGradient id="fs-dish-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--chrome-hi)" />
              <stop offset=".4" stopColor="var(--chrome-mid)" />
              <stop offset="1" stopColor="var(--chrome-shadow)" />
            </linearGradient>
          </defs>
          {/* Spanndrähte, Mast, Warnlicht */}
          <g className="fs-mast">
            <path d="M40 230 L108 40" className="fs-wire" />
            <path d="M180 230 L108 40" className="fs-wire" />
            <path d="M108 220 L108 30" className="fs-pole" />
            <circle cx="108" cy="26" r="4" className="fs-beacon" />
          </g>
          {/* Dish, exzentrisch am Mast montiert, Gruppe = Rotationsziel */}
          <g className="fs-dish" style={{ transformOrigin: "108px 110px" }}>
            <ellipse cx="108" cy="110" rx="46" ry="16" fill="url(#fs-dish-grad)" stroke="var(--bg-void)" strokeWidth="1.5" />
            <path d="M62 110 L108 110 L154 110" className="fs-strut" />
            <path d="M108 96 L108 124" className="fs-strut" />
            <circle cx="108" cy="110" r="3" className="fs-feed" />
            {/* 3 Ping-Ringe fürs Sende-Feedback */}
            <circle cx="108" cy="110" r="4" className="fs-ring-fx" style={{ "--i": 0 } as CSSProperties} />
            <circle cx="108" cy="110" r="4" className="fs-ring-fx" style={{ "--i": 1 } as CSSProperties} />
            <circle cx="108" cy="110" r="4" className="fs-ring-fx" style={{ "--i": 2 } as CSSProperties} />
          </g>
        </svg>
        <span className="fs-tag">{stationLabel}</span>
      </div>
      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}
