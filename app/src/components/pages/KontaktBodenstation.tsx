"use client";
/* Signatur-Motiv "Bodenstation Potsdam", Teil 1 von 2: die fixe Dach-Antenne
   unten rechts, hinter dem Inhalt. Teil 2 ist die Konsole im Inhalt
   (KontaktFunkkanaele) — Radarscheibe plus Stationsanzeige. Beide gehoeren
   zu EINEM Motiv und reagieren auf EINEN Moment: den Sende-Puls.

   Hier steckt der eine dokumentweite Klick-Listener auf [data-fs-pulse]
   (Portierung von wirePulse() aus kontakt.js). Er trifft jeden
   mailto:/Telegram-Link, egal in welcher Sektion — ganz ohne
   preventDefault, der Link laeuft normal weiter, hier kommt nur die
   Ping-Ring-Animation, der Toast und seit It. 14 ein CustomEvent obendrauf,
   mit dem die Konsole im selben Moment mitschwingt (SEND_PULSE_EVENT).

   Stapelrang: der Knoten liegt hinter dem Inhalt, eine Stufe ueber dem
   Sternfeld (--z-scene) und eine unter den Traegerflaechen (--z-veil) —
   ausgerechnet in kontakt.css, damit hier keine nackte Zahl steht. */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { SEND_PULSE_EVENT, type SendPulseDetail } from "./KontaktFx";

const TOAST_MS = 2600;

export default function KontaktBodenstation({
  stationLabel, sendToast, telegramToast,
}: {
  stationLabel: string;
  sendToast: string;
  telegramToast: string;
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
      const kind: SendPulseDetail["kind"] = btn.dataset.fsPulse === "telegram" ? "telegram" : "mail";
      const ground = groundRef.current;
      if (ground) {
        ground.classList.remove("is-sending");
        void ground.offsetWidth;   // Reflow erzwingen, damit die Animation bei erneutem Klick neu startet
        ground.classList.add("is-sending");
      }
      setToast(kind === "telegram" ? telegramToast : sendToast);
      window.dispatchEvent(new CustomEvent<SendPulseDetail>(SEND_PULSE_EVENT, { detail: { kind } }));
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [sendToast, telegramToast]);

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
