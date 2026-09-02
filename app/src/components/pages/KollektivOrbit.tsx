"use client";
/* "Tage im Orbit" = heute minus Gründungsdatum — zwangsläufig ein Wert der
   aktuellen Uhrzeit, deshalb wie im Prototyp (renderOrbit() läuft dort erst
   beim Hydrieren, siehe kollektiv.js) clientseitig berechnet. useState mit
   Lazy-Initializer statt Date.now() direkt im Render-Body: der Wert entsteht
   so garantiert genau einmal beim ersten Rendern statt bei jedem Re-Render
   neu (Reinheits-Vertrag von React-Komponenten/-Hooks). */
import { useState } from "react";

function daysSince(foundedDate: string): number {
  const founded = new Date(`${foundedDate}T00:00:00`).getTime();
  return Math.max(0, Math.floor((Date.now() - founded) / 86400000));
}

export default function KollektivOrbit({ foundedDate }: { foundedDate: string }) {
  const [days] = useState(() => daysSince(foundedDate));
  return (
    <p className="bp-orbit">
      <i className="bp-orbit-dot" aria-hidden="true" />
      {/* .txplate: der Zaehler sitzt direkt auf der Szene (kein Vorfahre
          in scene-night.css's Traegerflaechen-Liste) — enge Fläche statt
          gar keiner, siehe kollektiv.css. */}
      <span className="txplate">T+ <b>{days}</b> Tage im Orbit</span>
    </p>
  );
}
