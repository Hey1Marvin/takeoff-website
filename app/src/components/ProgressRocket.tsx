"use client";
/* Scroll-Fortschritt als Flugbahn. Der VERTRAG mit takeoff.css:
   Das CSS bewegt Balken (scaleX) und Rakete (left-calc) über die Variablen
   --scrollp (0..1) und --thrust (Schub aus Scroll-Geschwindigkeit, plus
   gestuftes --thrust-q für Filter). Diese Komponente SCHREIBT nur die
   Variablen — identisch zur Prototyp-Mechanik in main.js. */
import { useEffect } from "react";

const IDLE_THRUST = 0.14;      // Triebwerk läuft im Stand gedrosselt
const THRUST_GAIN = 0.045;     // px/ms → Schub
const SMOOTH = 0.12;

export default function ProgressRocket() {
  useEffect(() => {
    const html = document.documentElement;
    let raf = 0, running = true;
    let thrust = IDLE_THRUST, lastY = scrollY, lastT = performance.now();
    let lastSp = "", lastTh = "", lastThQ = "";

    const frame = (t: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const dt = Math.max(1, t - lastT); lastT = t;

      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;

      const v = Math.abs(scrollY - lastY) / dt; lastY = scrollY;
      const target = Math.min(1, IDLE_THRUST + v * THRUST_GAIN * 16);
      thrust += (target - thrust) * SMOOTH;

      /* Nur schreiben, was sich sichtbar geändert hat (Prototyp-Muster). */
      const sp = p.toFixed(4);
      if (sp !== lastSp) { html.style.setProperty("--scrollp", sp); lastSp = sp; }
      const th = thrust.toFixed(3);
      if (th !== lastTh) { html.style.setProperty("--thrust", th); lastTh = th; }
      const thQ = (Math.round(thrust * 16) / 16).toFixed(4);
      if (thQ !== lastThQ) { html.style.setProperty("--thrust-q", thQ); lastThQ = thQ; }
    };

    const start = () => { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(frame); } };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const onVis = () => (document.hidden ? stop() : start());

    if ((html.dataset.fx ?? "m") === "s") {
      /* Tier s: kein Dauerloop — Fortschritt nur bei Scroll, Schub fix. */
      html.style.setProperty("--thrust", String(IDLE_THRUST));
      const onScroll = () => {
        const max = document.documentElement.scrollHeight - innerHeight;
        html.style.setProperty("--scrollp", max > 0 ? (scrollY / max).toFixed(4) : "0");
      };
      onScroll();
      addEventListener("scroll", onScroll, { passive: true });
      return () => removeEventListener("scroll", onScroll);
    }

    /* Direkter Scroll-Pfad zusätzlich zum rAF-Loop: schreibt --scrollp sofort
       (auch wenn rAF gedrosselt ist, z. B. Hintergrund-Tab); der Loop macht
       nur noch die Schub-Glättung obendrauf. */
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const sp = max > 0 ? Math.min(1, Math.max(0, scrollY / max)).toFixed(4) : "0";
      if (sp !== lastSp) { html.style.setProperty("--scrollp", sp); lastSp = sp; }
    };
    onScroll();
    html.style.setProperty("--thrust", String(IDLE_THRUST));
    addEventListener("scroll", onScroll, { passive: true });

    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      running = false; stop();
      removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVis);
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
