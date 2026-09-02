"use client";
/* Odometer: die Statistik-Zahlen zählen einmalig von 0 auf ihren Zielwert
   hoch, sobald die Leiste in den Sichtbereich scrollt (Tier-gated, wie
   setupOdometer/animateStat in kollektiv.js — hier ohne GSAP als kleiner
   eigener rAF-Tween mit power-out-Annäherung). */
import { useEffect, useRef } from "react";
import { fxOn } from "./KollektivFx";

export interface StatCell {
  value: string;
  label: string;
}

function animateCell(el: HTMLElement, isCancelled: () => boolean) {
  const raw = el.textContent?.trim() ?? "";
  const m = raw.match(/^(\d+)(.*)$/);
  if (!m) return;
  const digits = m[1].length;
  const target = parseInt(m[1], 10);
  const suffix = m[2];
  const duration = 1100;
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
  const start = performance.now();

  function tick(now: number) {
    if (isCancelled()) return;
    const t = Math.min(1, (now - start) / duration);
    el.textContent = String(Math.round(target * easeOut(t))).padStart(digits, "0") + suffix;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

export default function KollektivStats({ stats }: { stats: StatCell[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !fxOn()) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const io = new IntersectionObserver(
      entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        if (!fxOn()) return;
        el.querySelectorAll("b").forEach((b, i) => {
          timers.push(setTimeout(() => {
            if (!cancelled) animateCell(b as HTMLElement, () => cancelled);
          }, i * 90));
        });
      }),
      { threshold: 0.4 }
    );
    io.observe(el);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      io.disconnect();
    };
  }, []);

  return (
    <div className="stats bp-odometer" ref={ref}>
      {stats.map(s => (
        <div key={s.label}>
          <b>{s.value}</b>
          <span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}
