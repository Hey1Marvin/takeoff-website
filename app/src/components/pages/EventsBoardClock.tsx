"use client";
/* Live-Uhr im Board-Header — rein dekorativ (aria-hidden), zeigt ehrlich
   die Client-Uhrzeit (kein simuliertes Backend). Portierung von
   startClock() aus assets/js/pages/events.js: Tier s = einmal gesetzt,
   kein Intervall; m = 1×/Minute; l = Sekundentakt. */
import { useEffect, useState } from "react";

const PLACEHOLDER = "– –:– –:– –";

export default function EventsBoardClock() {
  const [time, setTime] = useState(PLACEHOLDER);

  useEffect(() => {
    const fmt = (d: Date) =>
      d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    // Erste echte Zeit erst nach dem Mount setzen (s.o.: PLACEHOLDER ist
    // SSR-gleich) — ein Lazy-useState-Initializer würde die Build-/Server-
    // Zeit einfrieren bzw. bei Hydration einen Text-Mismatch auslösen.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTime(fmt(new Date()));

    const fx = document.documentElement.dataset.fx ?? "m";
    if (fx === "s") return;
    const everyMs = fx === "l" ? 1000 : 60000;
    const id = setInterval(() => {
      if (!document.hidden) setTime(fmt(new Date()));
    }, everyMs);
    return () => clearInterval(id);
  }, []);

  return <span className="board-clock" aria-hidden="true">{time}</span>;
}
