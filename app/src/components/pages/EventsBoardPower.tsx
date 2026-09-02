"use client";
/* Abflugtafel "Power-On" — einmaliger, dezenter Einlauf fuer .board-frame
   beim ersten Sichtbarwerden (Instrument, das gerade angeht). Gleiches
   Muster wie EventsStatusFlap.tsx: eigener IntersectionObserver statt der
   globalen .reveal-Mechanik, weil .board-frame keinen Grundzustand
   "unsichtbar" bekommen soll (Server-Render bleibt immer sichtbar, auch
   ohne JS) — nur die Klasse fuer die Keyframes (events.css) wird nachgereicht.
   Respektiert FX-Tier + prefers-reduced-motion VOR dem Klassenwechsel, die
   Keyframes selbst liegen zusaetzlich unter der globalen [data-fx="s"]-
   Bremse in takeoff.css. */
import { useEffect } from "react";

export default function EventsBoardPower() {
  useEffect(() => {
    const el = document.querySelector<HTMLElement>(".board-frame");
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
        });
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return null;
}
