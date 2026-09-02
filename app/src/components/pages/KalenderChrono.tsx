"use client";
/* Signatur-Motiv "Mission Clock" — der Instrumentenkopf des Kalenders.

   AUFBAU (It. 14 neu komponiert)
   Ein rundes Instrument statt eines Widgets in einer linken Textspalte:
   in der Mitte die Bordzeit, aussen ein Tickkranz, darauf ein Bogen, der
   zeigt, wie viel der Wartezeit zwischen letztem und naechstem Launch
   schon vorbei ist, und ein Zeiger, der die Sekunde faehrt. Links vom
   Instrument steht T–Plus (Vergangenheit), rechts T–Minus (Zukunft) —
   die Kopfzeile liest sich damit selbst als kleine Zeitachse.

   ALLE Zieldaten kommen fertig vom Server (Gateway-Aufruf in page.tsx):
   anders als im Prototyp (der clientseitig erst TakeoffData nachladen
   musste) steht der Zielwert schon beim ersten Tick fest, kein
   Nachlade-Flackern.

   BEWEGUNG — genau EINE (Briefing It. 14)
   Der Zeiger ist der einzige Dauerlaeufer der Seite. Er wird nicht per
   rAF gerechnet, sondern laeuft als 60s-CSS-Animation, deren Phase
   einmalig ueber `animation-delay` auf die echte Sekunde gesetzt wird.
   Grundzustand im Blatt ist `paused` — laeuft also erst, wenn diese
   Komponente ihn ausdruecklich startet.

   Tier-Guards (1:1 Muster aus Starfield.tsx / EventsBoardPower.tsx):
   - Tier s ODER prefers-reduced-motion: Zeiger bleibt stehen (die Phase
     wird trotzdem gesetzt — er zeigt die richtige Sekunde, er faehrt sie
     nur nicht), keine Sekundenanzeige, kein Interval. Kein "totes"
     --:--, ein echter, nur nicht tickender Zeitstempel.
   - Tier m: Sekundenanzeige, Refresh alle 5s (genug fuer Minuten-
     Granularitaet bei T-Minus/-Plus).
   - Tier l: echter Sekundentakt (1s) inkl. Flap-artigem Sekunden-Tick.
   - document.hidden pausiert das Interval; MutationObserver auf data-fx
     regelt live neu (Mission-Control-Panel kann den Tier jederzeit
     wechseln); Cleanup raeumt Interval + Observer beim Unmount ab.

   Der Fortschrittsbogen wird ueber eine CSS-Variable am Zifferblatt
   gesetzt (Ref statt State): er aendert sich um Bruchteile eines Pixels
   pro Minute und hat im React-Baum nichts verloren. */
import { useEffect, useRef, useState } from "react";
import { berlinDate, deltaParts, type DeltaParts } from "./KalenderDates";

export interface KalenderChronoUnits {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
}

export interface KalenderChronoProps {
  clockAriaLabel: string;
  caption: string;
  tminusLabel: string;
  tplusLabel: string;
  liftoffLabel: string;
  liftoffNote: string;
  emptyValue: string;
  units: KalenderChronoUnits;
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
  clockAriaLabel, caption, tminusLabel, tplusLabel, liftoffLabel, liftoffNote,
  emptyValue, units, fallbackTarget,
  nextTitle, nextDate, nextDoors, lastPastDate, lastPastDoors,
}: KalenderChronoProps) {
  const dialRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLSpanElement>(null);
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

      /* Verstrichener Anteil der Wartezeit als Lünetten-Bogen. Nur wenn
         BEIDE Enden bekannt sind — ein Bogen ohne Startpunkt waere eine
         erfundene Zahl. */
      const dial = dialRef.current;
      if (dial) {
        let prog = 0;
        if (nextTarget && lastPast) {
          const span = nextTarget.getTime() - lastPast.getTime();
          if (span > 0) {
            prog = Math.min(1, Math.max(0, (now.getTime() - lastPast.getTime()) / span));
          }
        }
        dial.style.setProperty("--bc-prog", String(Math.round(prog * 1000) / 1000));
      }
    }

    /* Phasensynchron statt bei 0 startend: `animation-delay` negativ auf die
       bereits verstrichene Sekunde des Minutenlaufs. Der Zeiger steht damit
       auch im pausierten Zustand (Tier s / reduzierte Bewegung) auf der
       richtigen Sekunde. */
    function syncHand() {
      const hand = handRef.current;
      if (!hand) return;
      const now = new Date();
      const s = now.getSeconds() + now.getMilliseconds() / 1000;
      hand.style.animationDelay = `-${s}s`;
      hand.style.animationPlayState = fxOn() ? "running" : "paused";
    }

    function start() {
      render();
      syncHand();
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
    <div className="bc-panel">
      {/* Jetzt — die Mitte. */}
      <div className="bc-instrument">
        <div className="bc-dial" aria-hidden="true" ref={dialRef}>
          <span className="bc-dial-arc" />
          <span className="bc-hand" ref={handRef} />
        </div>
        <div className="bc-readout" aria-hidden="true">
          <p className="bc-caption">{caption}</p>
          <div className="bc-face">
            <span className="bc-hm">{hm}</span>
            <span className="bc-seconds" hidden={sec === null} key={tickCount}>{sec ?? "--"}</span>
          </div>
        </div>
      </div>

      {/* Zukunft — Signalfarbe. */}
      <div className="tminus bc-tm" role="timer" aria-label={clockAriaLabel}>
        <span className="label">{tminusLabel} · {nextTitle || fallbackTarget}</span>
        <span className="clock">
          {tminus === null && emptyValue}
          {tminus?.liftoff && <>{liftoffLabel} <small>· {liftoffNote}</small></>}
          {tminus && !tminus.liftoff && (
            <>
              {tminus.d.days}<small>{units.days}</small> {tminus.d.hours}<small>{units.hours}</small> {tminus.d.minutes}<small>{units.minutes}</small>
              {tminus.withSeconds && <> {tminus.d.seconds}<small>{units.seconds}</small></>}
            </>
          )}
        </span>
      </div>

      {/* Vergangenheit — leise. Steht im Markup ZULETZT, weil T–Minus die
          Ablesung ist, auf die es ankommt: auf dem Telefon und im
          Screenreader kommt sie damit zuerst. Nach links wandert T–Plus
          erst ab 1000px per grid-column (kalender.css). */}
      <div className="tminus tplus bc-tp">
        <span className="label">{tplusLabel}</span>
        <span className="clock">
          {tplus
            ? <>{tplus.days}<small>{units.days}</small> {tplus.hours}<small>{units.hours}</small> {tplus.minutes}<small>{units.minutes}</small></>
            : emptyValue}
        </span>
      </div>
    </div>
  );
}
