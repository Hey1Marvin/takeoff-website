/* ============================================================
   KollektivFx — kleine geteilte Helfer für die Bauplan-Signaturmotive
   (Blaupausen-Drift, Massline-Scrub, Rig-Diagramm, Odometer). Reine
   Funktionen ohne State/DOM-Referenzen, damit jede Client-Komponente
   ihre eigene Lebensdauer (Setup/Cleanup) unabhängig hält — gleiche
   Tier-Logik wie im Prototyp (assets/js/main.js, kollektiv.js).
   ============================================================ */

export function reducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Tier "s" oder reduced-motion => Seite bleibt ohne Zusatz-Animation schön. */
export function fxOn(): boolean {
  return document.documentElement.dataset.fx !== "s" && !reducedMotion();
}

/** Nur Tier "l" (volle Show) fährt die teuersten Extras. */
export function fxFull(): boolean {
  return document.documentElement.dataset.fx === "l" && !reducedMotion();
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

interface Throttled {
  (): void;
  cancel(): void;
}

/** rAF-gedrosselter Handler: läuft nie öfter als einmal pro Frame und
    pausiert komplett, während der Tab verborgen ist (Akku/CPU). */
export function rafThrottle(fn: () => void): Throttled {
  let raf = 0;
  const request = (() => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (!document.hidden) fn();
    });
  }) as Throttled;
  request.cancel = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  return request;
}
