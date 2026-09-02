"use client";
/* Signatur-Motiv "Bordchronometer" — Mission-Clock-Kopf des Kalenders:
   Bordzeit (tickende HH:MM + Sekunden), T-Minus zum nächsten Launch,
   T-Plus seit dem letzten. Alle Zieldaten kommen fertig vom Server
   (Gateway-Aufruf in page.tsx) — anders als im Prototyp (der clientseitig
   erst TakeoffData nachladen musste) steht der Zielwert hier schon beim
   ersten Tick fest, kein Nachlade-Flackern.

   Tier-Guards (1:1 Muster aus Starfield.tsx / kalender.js):
   - Tier s ODER prefers-reduced-motion: Uhr wird einmal gesetzt, keine
     Sekundenanzeige, kein Interval — kein "totes" --:--, ein echter,
     nur nicht tickender Zeitstempel.
   - Tier m: Sekundentakt-Anzeige, Refresh alle 5s (genug für Minuten-
     Granularität bei T-Minus/-Plus).
   - Tier l: echter Sekundentakt (1s) inkl. Flap-artigem Sekunden-Tick.
   - document.hidden pausiert das Interval; MutationObserver auf
     data-fx regelt live neu (Mission-Control-Panel kann den Tier jederzeit
     wechseln); Cleanup räumt Interval + Observer beim Unmount ab. */
import { useEffect, useRef, useState } from "react";
import { berlinDate, deltaParts, type DeltaParts } from "./KalenderDates";

export interface KalenderChronoProps {
  clockAriaLabel: string;
  fallbackTarget: string;
  nextTitle: string | null;
  nextDate: string | null;
  nextDoors: string | null;
  lastPastDate: string | null;
  lastPastDoors: string | null;
}

function reducedMotion() {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function fxOn() {
  return document.documentElement.dataset.fx !== "s" && !reducedMotion();
}
function fxFull() {
  return document.documentElement.dataset.fx === "l" && !reducedMotion();
}

type TMinusState = { liftoff: true } | { liftoff: false; d: DeltaParts; withSeconds: boolean } | null;

export default function KalenderChrono({
  clockAriaLabel, fallbackTarget, nextTitle, nextDate, nextDoors, lastPastDate, lastPastDoors,
}: KalenderChronoProps) {
  const sweepRef = useRef<HTMLDivElement>(null);
  const [hm, setHm] = useState("--:--");
  const [sec, setSec] = useState<string | null>(null);
  const [tickCount, setTickCount] = useState(0);
  const [tminus, setTminus] = useState<TMinusState>(null);
  const [tplus, setTplus] = useState<DeltaParts | null>(null);

  useEffect(() => {
    const nextTarget = nextDate ? berlinDate(nextDate, nextDoors || "") : null;
    const lastPast = lastPastDate ? berlinDate(lastPastDate, lastPastDoors || "") : null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let lastMinute: string | null = null;

    function render() {
      const now = new Date();
      const hmStr = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
      if (hmStr !== lastMinute) { setHm(hmStr); lastMinute = hmStr; }

      const on = fxOn(), full = fxFull();
      if (!on) {
        setSec(null);
      } else {
        setSec(now.toLocaleTimeString("de-DE", { second: "2-digit", timeZone: "Europe/Berlin" }));
        if (full) setTickCount(c => c + 1);
      }

      if (nextTarget) {
        const diff = nextTarget.getTime() - now.getTime();
        setTminus(diff <= 0 ? { liftoff: true } : { liftoff: false, d: deltaParts(diff), withSeconds: full });
      }
      if (lastPast) setTplus(deltaParts(now.getTime() - lastPast.getTime()));
    }

    function syncSweep() {
      const sweep = sweepRef.current;
      if (!sweep) return;
      if (!fxOn()) { sweep.style.animationPlayState = "paused"; return; }
      const now = new Date();
      const s = now.getSeconds() + now.getMilliseconds() / 1000;
      sweep.style.animationDelay = `-${s}s`;
      sweep.style.animationPlayState = "running";
    }

    function start() {
      render();
      syncSweep();
      clearInterval(timer);
      if (!fxOn()) return;
      const everyMs = fxFull() ? 1000 : 5000;
      timer = setInterval(() => { if (!document.hidden) render(); }, everyMs);
    }

    start();
    // Live-Wechsel des FX-Tiers über das Mission-Control-Panel neu einregeln.
    const mo = new MutationObserver(start);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-fx"] });

    return () => {
      clearInterval(timer);
      mo.disconnect();
    };
  }, [nextDate, nextDoors, lastPastDate, lastPastDoors]);

  return (
    <>
      <div className="bc-dial" aria-hidden="true" />
      <div className="bc-sweep" aria-hidden="true" ref={sweepRef} />

      <div className="bc-cluster">
        <div className="bc-face" aria-hidden="true">
          <span>{hm}</span>
          <span className="bc-sec" hidden={sec === null} key={tickCount}>{sec ?? "--"}</span>
        </div>
        <p className="bc-caption" aria-hidden="true">Bordzeit · Europe/Berlin</p>

        <div className="bc-sub">
          <div className="tminus" role="timer" aria-label={clockAriaLabel}>
            <span className="label">T–Minus {nextTitle || fallbackTarget}</span>
            <span className="clock">
              {tminus === null && "—"}
              {tminus?.liftoff && <>LIFTOFF <small>· läuft</small></>}
              {tminus && !tminus.liftoff && (
                <>
                  {tminus.d.days}<small>T</small> {tminus.d.hours}<small>h</small> {tminus.d.minutes}<small>m</small>
                  {tminus.withSeconds && <> {tminus.d.seconds}<small>s</small></>}
                </>
              )}
            </span>
          </div>
          <div className="tminus tplus">
            <span className="label">T–Plus seit letztem Launch</span>
            <span className="clock">
              {tplus ? <>{tplus.days}<small>T</small> {tplus.hours}<small>h</small> {tplus.minutes}<small>m</small></> : "—"}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
