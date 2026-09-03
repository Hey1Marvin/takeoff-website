"use client";
/* Scroll-Fortschritt als Flugbahn. Der VERTRAG mit takeoff.css:
   Das CSS bewegt Balken (scaleX) und Rakete (translateX) über die Variablen
   --scrollp (0..1) und --thrust (Schub aus Scroll-Geschwindigkeit, plus
   gestuftes --thrust-q für Filter). Diese Komponente SCHREIBT nur die
   Variablen — identisch zur Prototyp-Mechanik in main.js.

   ── Was It. 16 hier geändert hat ───────────────────────────
   1. KEINE eigene rAF-Schleife mehr. Sie lief auf JEDER Seite dauerhaft,
      unabhängig davon, ob gerade gescrollt wurde. Jetzt hängt die
      Komponente am gemeinsamen Takt (lib/frame.ts) — dort ist zugesichert,
      dass alle Lesevorgänge vor allen Schreibvorgängen laufen. Vorher
      schrieb diese Komponente Styles auf <html>, während die Szenen-Engine
      und KollektivHistory im selben Bild Layoutwerte lasen; wessen
      rAF-Rückruf zuerst drankam, war nicht festgelegt.
   2. `scrollHeight` wird NICHT mehr in jedem Bild gelesen. Das ist eine
      layout-auslösende Eigenschaft, und ihr Wert ändert sich nur bei Resize
      und beim Aufklappen von Inhalten. Gemessen wird jetzt wie in
      sky/state.ts: einmal bei resize/load, dazwischen gecacht. */
import { useEffect } from "react";
import { taktAnmelden } from "@/lib/frame";

const IDLE_THRUST = 0.14;      // Triebwerk läuft im Stand gedrosselt
const THRUST_GAIN = 0.045;     // px/ms → Schub
const SMOOTH = 0.12;

export default function ProgressRocket() {
  useEffect(() => {
    const html = document.documentElement;
    let thrust = IDLE_THRUST, lastY = scrollY;
    let lastSp = "", lastTh = "", lastThQ = "";

    /* Die eine teure Größe, gecacht. Dasselbe Muster wie
       sky/state.ts:measureScroll — bewusst dort abgeschaut statt neu
       erfunden, damit es nur eine Art gibt, diese Zahl zu bestimmen. */
    let scrollMax = 0;
    const messen = () => { scrollMax = document.documentElement.scrollHeight - innerHeight; };
    messen();
    addEventListener("resize", messen, { passive: true });
    addEventListener("load", messen);

    /* Zwischen Lesen und Schreiben gereichte Werte. Sie existieren, damit
       die Schreibphase nichts mehr aus dem DOM holen muss. */
    let p = 0, v = 0;

    const lesen = (_t: number, dt: number) => {
      const y = scrollY;                    // billig, löst kein Layout aus
      p = scrollMax > 0 ? Math.min(1, Math.max(0, y / scrollMax)) : 0;
      v = Math.abs(y - lastY) / Math.max(1, dt);
      lastY = y;
    };

    const schreiben = () => {
      const target = Math.min(1, IDLE_THRUST + v * THRUST_GAIN * 16);
      thrust += (target - thrust) * SMOOTH;

      /* Nur schreiben, was sich sichtbar geändert hat (Prototyp-Muster).
         Jede dieser Zuweisungen macht den Stil des gesamten Dokuments
         ungültig — die Variablen hängen an <html> und werden vererbt. */
      const sp = p.toFixed(4);
      if (sp !== lastSp) { html.style.setProperty("--scrollp", sp); lastSp = sp; }
      const th = thrust.toFixed(3);
      if (th !== lastTh) { html.style.setProperty("--thrust", th); lastTh = th; }
      /* Gestuft auf 16 Werte, ausschließlich für den drop-shadow am Rumpf.
         Ein Filter ist ein Neuzeichnen; ihn 60-mal je Sekunde neu zu
         berechnen kostet spürbar, in 16 Stufen sieht man keinen
         Unterschied. (Bis It. 16 las diese Variable niemand — der Filter
         hing am ungestuften Wert.) */
      const thQ = (Math.round(thrust * 16) / 16).toFixed(4);
      if (thQ !== lastThQ) { html.style.setProperty("--thrust-q", thQ); lastThQ = thQ; }
    };

    /* Stufe s: kein Takt, kein Schub — der Fortschritt folgt allein dem
       Scrollen. Ein Dauertakt wäre in der Stufe, die "Aus" heißt, genau das
       Falsche. */
    if ((html.dataset.fx ?? "m") === "s") {
      html.style.setProperty("--thrust", String(IDLE_THRUST));
      html.style.setProperty("--thrust-q", String(IDLE_THRUST));
      const onScroll = () => {
        const sp = scrollMax > 0 ? (scrollY / scrollMax).toFixed(4) : "0";
        if (sp !== lastSp) { html.style.setProperty("--scrollp", sp); lastSp = sp; }
      };
      onScroll();
      addEventListener("scroll", onScroll, { passive: true });
      return () => {
        removeEventListener("scroll", onScroll);
        removeEventListener("resize", messen);
        removeEventListener("load", messen);
      };
    }

    html.style.setProperty("--thrust", String(IDLE_THRUST));
    const abmelden = taktAnmelden({ lesen, schreiben });
    return () => {
      abmelden();
      removeEventListener("resize", messen);
      removeEventListener("load", messen);
    };
  }, []);

  return (
    <div className="nav-progress" aria-hidden="true">
      <i />
      <svg className="rocket" viewBox="0 0 132 30">
        <defs>
          <linearGradient id="rk-hull" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8f96a8" /><stop offset=".22" stopColor="#eef0f4" />
            <stop offset=".38" stopColor="#ffffff" /><stop offset=".38" stopColor="#dfe2e9" />
            <stop offset=".68" stopColor="#9aa0b0" /><stop offset="1" stopColor="#4d5364" />
          </linearGradient>
          <linearGradient id="rk-dark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5a6072" /><stop offset=".38" stopColor="#2b3040" /><stop offset="1" stopColor="#14171f" />
          </linearGradient>
          <linearGradient id="rk-bell" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b9bdc9" /><stop offset=".4" stopColor="#6e7488" /><stop offset="1" stopColor="#33384a" />
          </linearGradient>
          <linearGradient id="rk-plume" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor="#ffffff" /><stop offset=".12" stopColor="#dbe9ff" />
            <stop offset=".45" stopColor="#8fb6f5" stopOpacity=".55" /><stop offset="1" stopColor="#5f86d8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rk-plume-hot" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0" stopColor="#fff6e2" /><stop offset=".35" stopColor="#ffd9a0" stopOpacity=".8" /><stop offset="1" stopColor="#ff9d5c" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className="rk-jet">
          <path className="rk-jet-outer" d="M20 11.4 C6 12.6 -14 14 -30 15 C-14 16 6 17.4 20 18.6 Z" fill="url(#rk-plume)" />
          <path className="rk-jet-hot" d="M20 12.8 C12 13.5 0 14.4 -8 15 C0 15.6 12 16.5 20 17.2 Z" fill="url(#rk-plume-hot)" />
          <g className="rk-diamonds" fill="#ffffff">
            <ellipse cx="10" cy="15" rx="2.6" ry="1.5" opacity=".85" />
            <ellipse cx="0" cy="15" rx="2.1" ry="1.2" opacity=".6" />
            <ellipse cx="-11" cy="15" rx="1.6" ry=".9" opacity=".4" />
            <ellipse cx="-22" cy="15" rx="1.1" ry=".6" opacity=".22" />
          </g>
        </g>
        <g className="rk-body">
          <path d="M28 10.6 L21 8.4 L21 21.6 L28 19.4 Z" fill="url(#rk-bell)" />
          <path d="M21 8.4 L21 21.6" stroke="#1b1f2a" strokeWidth="1.2" />
          <path d="M40 10.0 L28 4.8 L30 9.9 Z" fill="url(#rk-dark)" />
          <path d="M40 20.0 L28 25.2 L30 20.1 Z" fill="url(#rk-dark)" />
          <rect x="28" y="9.6" width="52" height="10.8" fill="url(#rk-hull)" />
          <rect x="76" y="9.6" width="7" height="10.8" fill="url(#rk-dark)" />
          <rect x="83" y="10.3" width="26" height="9.4" fill="url(#rk-hull)" />
          <path d="M109 10.3 C119 11 127 12.7 131 15 C127 17.3 119 19 109 19.7 Z" fill="url(#rk-hull)" />
          <rect x="95" y="7.4" width="4.4" height="2.9" rx=".6" fill="url(#rk-dark)" />
          <rect x="95" y="19.7" width="4.4" height="2.9" rx=".6" fill="url(#rk-dark)" />
          <rect x="46" y="12.4" width="2.2" height="5.2" fill="#c8323f" opacity=".85" />
          <rect x="52" y="13.2" width="1.2" height="3.6" fill="#2b3040" opacity=".55" />
          <rect x="55" y="13.2" width="1.2" height="3.6" fill="#2b3040" opacity=".55" />
          <path d="M29 10.2 L108 10.2" stroke="#ffffff" strokeOpacity=".8" strokeWidth=".9" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
