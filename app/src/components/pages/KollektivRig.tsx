"use client";
/* Ebene 3 ("Herzstück") des Bauplan-Signaturmotivs: das Anlagen-Diagramm
   baut sich in Bau-Reihenfolge auf (Sub → Top → Verkabelung → Labels),
   sobald es in den Sichtbereich scrollt — Portierung von setupRig() in
   kollektiv.js (dort eine GSAP-Timeline mit Stagger/Overlap; hier ohne
   GSAP als CSS-Transition mit vorgerechneten Verzögerungen je Element,
   gleiche Reihenfolge/Choreografie). Tier s/reduced-motion: die SVG bleibt
   beim CSS-Default stehen (stroke-dashoffset:0 = fertig gezeichnet, siehe
   .bp-rig .bp-p in kollektiv.css) — keine inline Styles, kein Sprung. */
import { CSSProperties, useEffect, useRef, useState } from "react";
import { fxOn } from "./KollektivFx";

type Phase = "static" | "armed" | "drawn";

const EASE = "var(--ease-out)";

export default function KollektivRig() {
  const ref = useRef<SVGSVGElement>(null);
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
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const strokeStyle = (delayMs: number): CSSProperties | undefined =>
    phase === "static" ? undefined : {
      strokeDashoffset: phase === "drawn" ? 0 : 1,
      transition: `stroke-dashoffset .8s ${EASE} ${delayMs}ms`,
    };
  const labelStyle = (delayMs: number): CSSProperties | undefined =>
    phase === "static" ? undefined : {
      opacity: phase === "drawn" ? 1 : 0,
      transition: `opacity .5s ${EASE} ${delayMs}ms`,
    };

  return (
    <svg className="bp-rig" viewBox="0 0 360 200" aria-hidden="true" focusable="false" ref={ref}>
      <line className="bp-p bp-p-truss" pathLength={1} x1="20" y1="24" x2="340" y2="24" style={strokeStyle(1330)} />
      <rect className="bp-p bp-p-sub" pathLength={1} x="30" y="120" width="70" height="60" rx="2" style={strokeStyle(0)} />
      <circle className="bp-p bp-p-sub" pathLength={1} cx="65" cy="150" r="20" style={strokeStyle(120)} />
      <rect className="bp-p bp-p-sub" pathLength={1} x="260" y="120" width="70" height="60" rx="2" style={strokeStyle(240)} />
      <circle className="bp-p bp-p-sub" pathLength={1} cx="295" cy="150" r="20" style={strokeStyle(360)} />
      <path className="bp-p bp-p-top" pathLength={1} d="M40 118 L50 70 L90 70 L100 118 Z" style={strokeStyle(710)} />
      <path className="bp-p bp-p-top" pathLength={1} d="M260 118 L270 70 L310 70 L320 118 Z" style={strokeStyle(830)} />
      <line className="bp-p bp-p-lead" pathLength={1} x1="100" y1="150" x2="132" y2="150" style={strokeStyle(1390)} />
      <line className="bp-p bp-p-lead" pathLength={1} x1="90" y1="90" x2="132" y2="90" style={strokeStyle(1450)} />
      <line className="bp-p bp-p-lead" pathLength={1} x1="180" y1="24" x2="180" y2="46" style={strokeStyle(1510)} />
      <g className="bp-p-label" style={labelStyle(2110)}>
        <text x="136" y="153">{"2× SUB · EIGENBAU '24/'25"}</text>
        <text x="136" y="93">{"2× TOP · EIGENBAU '25"}</text>
        <text x="184" y="42">DMX · EIGENBAU-PULT</text>
      </g>
    </svg>
  );
}
