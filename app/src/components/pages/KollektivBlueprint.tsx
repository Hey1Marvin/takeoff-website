"use client";
/* Ebene 1 des Bauplan-Signaturmotivs (kollektiv.css): das Millimeterraster
   hinter der ganzen Seite bekommt bei Tier "l" (volle Show) einen leichten
   Parallax-Drift beim Scrollen (--bp-drift, siehe .bp-blueprint::before).
   Tier s/m: Raster steht still (CSS-Default 0px) — reines Deko-Extra ohne
   Informationswert, deshalb keine Eile beim Downgrade nötig, aber sauber
   zurückgesetzt. Portierung von main.js' buildScrollFX (Grid-Parallax-Teil);
   die Flightlog-Massline (zweiter Teil derselben Funktion im Prototyp) sitzt
   aus Komponenten-Klarheit separat in KollektivHistory. */
import { ReactNode, useEffect, useRef } from "react";
import { clamp01, fxFull, rafThrottle } from "./KollektivFx";

const DRIFT_PX = -46;

export default function KollektivBlueprint({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = document.documentElement;
    let active = false;

    const update = rafThrottle(() => {
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const progress = total > 0 ? clamp01(-rect.top / total) : 0;
      el.style.setProperty("--bp-drift", `${progress * DRIFT_PX}px`);
    });

    const apply = () => {
      if (fxFull()) {
        if (!active) {
          active = true;
          addEventListener("scroll", update, { passive: true });
          addEventListener("resize", update, { passive: true });
        }
        update();
      } else {
        if (active) {
          active = false;
          removeEventListener("scroll", update);
          removeEventListener("resize", update);
          update.cancel();
        }
        el.style.setProperty("--bp-drift", "0px");
      }
    };

    apply();
    const onVisibility = () => { if (!document.hidden) update(); };
    document.addEventListener("visibilitychange", onVisibility);
    /* Tier-Wechsel (Mission-Control-Knopf, Watchdog) landen als data-fx-
       Attributänderung auf <html> — gleiches Muster wie main.js/kollektiv.js. */
    const mo = new MutationObserver(apply);
    mo.observe(html, { attributes: true, attributeFilter: ["data-fx"] });

    return () => {
      removeEventListener("scroll", update);
      removeEventListener("resize", update);
      document.removeEventListener("visibilitychange", onVisibility);
      mo.disconnect();
      update.cancel();
    };
  }, []);

  return (
    <div className="bp-blueprint" ref={ref}>
      {children}
    </div>
  );
}
