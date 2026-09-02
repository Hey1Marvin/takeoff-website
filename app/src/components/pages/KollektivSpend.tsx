"use client";
/* Veredelung ("Kassenbuch"): die Balken wachsen einmalig von 0 auf ihre
   Zielbreite, sobald der Block in den Sichtbereich scrollt — gleiches
   static->armed->drawn-Muster wie KollektivRig (Anlagen-Diagramm) und
   KollektivStats (Odometer): erst "armed" (Breite 0, Transition scharf),
   dann bei Intersection "drawn" (Breite --pct). Zwei getrennte Renders
   sind hier bewusst noetig, sonst faehrt die Transition nie los (der
   Browser braucht den 0%-Zustand tatsaechlich einmal gemalt). Tier-Gate
   ueber fxOn() wie ueberall in KollektivFx — Tier s/reduced-motion
   ueberspringen die Animation, die CSS-Grundregel (width:var(--pct))
   greift dann sofort ohne Sprung. */
import { CSSProperties, useEffect, useRef, useState } from "react";
import { fxOn } from "./KollektivFx";

export interface SpendItem {
  label: string;
  percent: number;
}

type Phase = "static" | "armed" | "drawn";

export default function KollektivSpend({ items }: { items: SpendItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("static");

  useEffect(() => {
    const el = ref.current;
    if (!el || !fxOn()) return;
    setPhase("armed");

    const io = new IntersectionObserver(
      entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        if (fxOn()) setPhase("drawn");
      }),
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className={`bp-spend${phase !== "static" ? ` is-${phase}` : ""}`} ref={ref}>
      {items.map((item, i) => {
        const pct = Math.max(0, Math.min(100, item.percent));
        return (
          <div className="bp-spend-row" key={item.label}>
            <span className="bp-spend-label">{item.label}</span>
            <span className="bp-spend-track">
              <span className="bp-spend-fill" style={{ "--pct": `${pct}%`, "--i": i } as CSSProperties} />
            </span>
            <span className="bp-spend-pct">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}
