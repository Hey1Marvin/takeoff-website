"use client";
/* T-Minus-Countdown zum nächsten Launch — Portierung des Countdown-Blocks
   aus assets/js/main.js ("4 · Countdown"). targetIso kommt fertig vom
   Server (Event-Datum + Einlasszeit, siehe doorsIso() in events/page.tsx);
   ohne nächstes Event bleibt der Platzhalter "—" stehen. */
import { useEffect, useState } from "react";

type Remaining = { days: number; hrs: number; min: number; sec: number } | "liftoff";

function computeRemaining(target: number): Remaining {
  const diff = target - Date.now();
  if (diff <= 0) return "liftoff";
  return {
    days: Math.floor(diff / 864e5),
    hrs: Math.floor(diff / 36e5) % 24,
    min: Math.floor(diff / 6e4) % 60,
    sec: Math.floor(diff / 1e3) % 60,
  };
}
const pad = (n: number) => String(n).padStart(2, "0");

export default function EventsTminusClock({ targetIso }: { targetIso: string | null }) {
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    if (!targetIso) return;
    const target = new Date(targetIso).getTime();
    if (Number.isNaN(target)) return;
    const tick = () => setRemaining(computeRemaining(target));
    tick();
    const id = setInterval(() => { if (!document.hidden) tick(); }, 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  if (!remaining) return <span className="clock">—</span>;
  if (remaining === "liftoff") {
    return <span className="clock">LIFTOFF <small>· läuft!</small></span>;
  }
  return (
    <span className="clock">
      {remaining.days}<small>d</small> {pad(remaining.hrs)}<small>h</small>{" "}
      {pad(remaining.min)}<small>m</small> {pad(remaining.sec)}<small>s</small>
    </span>
  );
}
