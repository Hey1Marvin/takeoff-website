"use client";
/* Der Nachthimmel — Anschluss der portierten Szenen-Engine.

   Die eigentliche Arbeit macht `src/lib/sky/` (1:1 aus dem Prototyp).
   Diese Komponente tut nur zwei Dinge: das Canvas rendern und die Engine
   an dessen Lebenszyklus haengen.

   Warum der Wrapper `<div class="sky">`: die Engine haengt ihre fuenf
   weiteren Ebenen (#skyback, #dayclouds, #horizon, #glints, #props) per
   `canvas.parentNode.insertBefore(...)` neben das Canvas. Ohne Wrapper
   waere dieser Elternknoten <body> — ein von React verwalteter Knoten,
   in den fremde Kinder einzufuegen Reconciliation-Risiko traegt. Ein
   `position: static`-div ohne transform/opacity/filter erzeugt KEINEN
   Stacking Context, die z-index -2/-3 der Ebenen wirken also weiterhin
   gegen den Wurzel-Kontext — der Grund, warum der Wrapper optisch
   folgenlos bleibt. */
import { useEffect, useRef } from "react";
import { mountSky } from "@/lib/sky";

export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return mountSky(ref.current);   // Rueckgabe = Aufraeumfunktion
  }, []);

  return (
    <div className="sky" aria-hidden="true">
      <canvas id="stars" ref={ref} />
    </div>
  );
}
