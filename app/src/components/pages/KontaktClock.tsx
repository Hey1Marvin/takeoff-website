"use client";
/* Bodenstations-Uhr (Potsdam) in der Hero-Statuszeile — reines Text-Update,
   keine Animation. Portierung von tickClock()/startClock() aus
   assets/js/pages/kontakt.js: Tier s = einmal gesetzt, kein Intervall;
   m = alle 45s; l = alle 15s (gleiches Muster wie EventsBoardClock). */
import { useEffect, useState } from "react";
import { fxOn, fxFull } from "./KontaktFx";

const PLACEHOLDER = "--:--";

export default function KontaktClock() {
  const [time, setTime] = useState(PLACEHOLDER);

  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString("de-DE", {
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin",
    });
    // Erste echte Zeit erst nach dem Mount setzen (PLACEHOLDER ist SSR-gleich) —
    // ein Lazy-useState-Initializer würde die Build-/Server-Zeit einfrieren
    // bzw. bei Hydration einen Text-Mismatch auslösen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTime(fmt());

    if (!fxOn()) return;   // Tier s: einmal gesetzt, kein Intervall
    const everyMs = fxFull() ? 15000 : 45000;
    const id = setInterval(() => {
      if (!document.hidden) setTime(fmt());
    }, everyMs);
    return () => clearInterval(id);
  }, []);

  return <time>{time}</time>;
}
