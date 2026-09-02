/* Signaturmotiv "Orbit-Stationsplan" — additiver Hintergrund-Layer
   zwischen Sternenhimmel und Inhalt, rein dekorativ (aria-hidden). Ein Ring
   pro Bereich (Flugdeck/Bodencrew/Bau & Gastgeber), ein äußerer blasser
   Ring als Platz für künftige Rollen. Reines SVG/CSS (kein Canvas, kein
   eigener rAF-Loop) — Sweep/Ringfarben laufen komplett über [data-fx] in
   team.css. Punktzahl je Ring kommt aus der tatsächlichen Bereichsgröße
   (server-seitig berechnet, siehe team/page.tsx) statt fix wie im
   Prototyp — macht das Motiv "grundlegend" statt Deko-Sticker.
   Reine Präsentation, keine Interaktion nötig => Server Component
   (Vorbild: ArtistOrbitAvatar.tsx). Ring-Radien (58/94/130/160) müssen mit
   RING_R hier übereinstimmen — eine Konstante an einer Stelle statt Magic
   Numbers doppelt zu pflegen. */

const RING_R: Record<string, number> = { flugdeck: 58, boden: 94, bau: 130 };

function ringDots(deptId: string, count: number): { x: string; y: string }[] {
  const r = RING_R[deptId];
  if (!r || count <= 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const angle = ((360 / count) * i - 90) * (Math.PI / 180); // ab 12 Uhr, im Uhrzeigersinn
    return { x: (r * Math.cos(angle)).toFixed(1), y: (r * Math.sin(angle)).toFixed(1) };
  });
}

export default function TeamOrbit({
  counts,
}: {
  counts: { flugdeck: number; boden: number; bau: number };
}) {
  return (
    <div className="kt-orbit" aria-hidden="true">
      <svg viewBox="0 0 480 420" preserveAspectRatio="xMinYMin meet" focusable="false">
        <g transform="translate(150,190)">
          <circle className="kt-ring kt-ring-fallback" r="160" />
          <circle className="kt-ring kt-ring-bau" r="130" />
          <circle className="kt-ring kt-ring-boden" r="94" />
          <circle className="kt-ring kt-ring-flugdeck" r="58" />
          <g className="kt-orbit-dots">
            {ringDots("flugdeck", counts.flugdeck).map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r="2.6" />
            ))}
          </g>
          <g className="kt-orbit-dots">
            {ringDots("boden", counts.boden).map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r="2.6" />
            ))}
          </g>
          <g className="kt-orbit-dots">
            {ringDots("bau", counts.bau).map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r="2.6" />
            ))}
          </g>
          <line className="kt-tick" x1="29" y1="-50.2" x2="37" y2="-64.1" />
          <line className="kt-tick" x1="92.6" y1="-16.3" x2="108.3" y2="-19.1" />
          <line className="kt-tick" x1="106.5" y1="74.6" x2="119.6" y2="83.8" />
          <text className="kt-ring-label" x="43" y="-61">FLUGDECK</text>
          <text className="kt-ring-label" x="114" y="-16">BODENCREW</text>
          <text className="kt-ring-label" x="125" y="88">BAU &amp; GASTGEBER</text>
          <g className="kt-sweep"><line x1="0" y1="0" x2="0" y2="-160" /></g>
          <circle className="kt-hub" r="3.4" />
        </g>
      </svg>
    </div>
  );
}
