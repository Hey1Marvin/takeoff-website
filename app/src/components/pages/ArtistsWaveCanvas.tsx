"use client";
/* Signatur-Motiv "Frequenzen" (research/50-pages-konzept.md): feine
   Wellenform-/Equalizer-Linien als leise Atmosphaere hinter den Sections,
   zusaetzlich zum Sternenhimmel (#stars), nicht statt ihm. Strukturell
   eine Portierung des Starfield.tsx-Musters: DPR-Handling, Resize,
   document.hidden-Pause, Cleanup — nur die Zeichnung ist anders.
   Tier s: kein Canvas, kein rAF (identisches Verhalten zu Starfield.tsx) —
   die Seite bleibt ohne das Motiv schoen. */
import { useEffect, useRef } from "react";

type WaveLine = { rgbIdx: 0 | 1 | 2; base: number; amp: number; freq: number; speed: number; phase: number };

const LINES: WaveLine[] = [
  { rgbIdx: 0, base: 0.32, amp: 22, freq: 1.6, speed: 0.00016, phase: 0 },
  { rgbIdx: 1, base: 0.52, amp: 16, freq: 2.3, speed: -0.00011, phase: 2 },
  { rgbIdx: 2, base: 0.7, amp: 26, freq: 1.1, speed: 0.00013, phase: 4 },
];

export default function ArtistsWaveCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fx = () => document.documentElement.dataset.fx ?? "m";
    if (fx() === "s") return;

    const DPR = Math.min(devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0, running = false;

    const accent = () => {
      const s = getComputedStyle(document.documentElement);
      return [
        s.getPropertyValue("--acc-1-rgb").trim() || "224 79 180",
        s.getPropertyValue("--acc-2-rgb").trim() || "119 97 209",
        s.getPropertyValue("--acc-3-rgb").trim() || "82 177 224",
      ];
    };

    function resize() {
      w = canvas!.width = innerWidth * DPR;
      h = canvas!.height = innerHeight * DPR;
      canvas!.style.width = innerWidth + "px";
      canvas!.style.height = innerHeight + "px";
    }

    function frame(t: number) {
      raf = requestAnimationFrame(frame);
      if (w === 0 || h === 0) resize();
      const rgbs = accent();
      const step = fx() === "l" ? 6 : 10;
      ctx!.clearRect(0, 0, w, h);
      for (const ln of LINES) {
        const baseY = h * ln.base;
        ctx!.beginPath();
        for (let x = 0; x <= w; x += step) {
          const px = x / w;
          const y =
            baseY +
            Math.sin(px * Math.PI * 2 * ln.freq + t * ln.speed + ln.phase) * ln.amp * DPR +
            Math.sin(px * Math.PI * 2 * ln.freq * 2.3 + t * ln.speed * 1.7) * ln.amp * 0.3 * DPR;
          if (x === 0) ctx!.moveTo(x, y);
          else ctx!.lineTo(x, y);
        }
        ctx!.strokeStyle = `rgb(${rgbs[ln.rgbIdx]} / .14)`;
        ctx!.lineWidth = 1.4 * DPR;
        ctx!.stroke();
      }
    }

    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(frame); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    const onVis = () => (document.hidden ? stop() : (resize(), start()));

    addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVis);
    resize();
    start();
    return () => {
      stop();
      removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas id="freqwave" ref={ref} aria-hidden="true" className="freqwave scene-deco" />;
}
