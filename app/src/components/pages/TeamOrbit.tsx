/* Bordplan — das kleine HUD der Team-Seite (It. 14).

   VORHER war das hier eine vollflaechige, fixierte Ebene (position: fixed,
   50vw breit, opacity .16, radiale Maske) hinter dem ganzen Inhalt. Genau
   der Trick, den fuenf andere Seiten auch benutzen — und im Tag-Screenshot
   (.design-audit/_team__tag__1440.png) war davon NICHTS mehr zu sehen: die
   Ringe laufen ueber --ink-faint/--acc-*, die im Tagmodus dunkel auf hell
   kippen, bei .16 Deckkraft bleibt daneben nichts uebrig. Ein Signaturmotiv,
   das in der Haelfte aller Zustaende unsichtbar ist, ist kein Motiv.

   JETZT steht der Plan IM Layout: rechte Spalte des Crew-Boards, in beiden
   Modi sichtbar, mit einer Legende daneben, die dieselbe Information in
   Text wiederholt. Damit ist er Informationsgrafik statt Deko — und die
   tote Flaeche rechts neben der Textspalte ist belegt.

   Reine Praesentation, kein State => Server Component. Die einmalige
   Aufbau-Animation (der EINE orchestrierte Bewegungsmoment der Seite)
   haengt an der Klasse `kt-map-on`, die TeamMapPower.tsx nachreicht; ohne
   JS, bei data-fx="s" und bei reduzierter Bewegung steht der fertige Plan
   sofort da.

   Farben kommen NICHT aus dieser Datei: welche Station welchen Akzent
   traegt, entscheidet team.css ueber :nth-child — dieselbe Reihenfolge
   faerbt Ring, Legendenzeile und Bereichspunkt im Board. */

import type { CSSProperties } from "react";

/* Ringradien im viewBox-Raster (300x300, Mittelpunkt 150/150). Vier Stufen:
   drei Stationen plus ein Reservering. Eine Konstante an EINER Stelle —
   die Punkte rechnen ihre Position daraus, statt sie doppelt zu pflegen. */
const RADII = [46, 76, 106, 130];

export interface TeamStationVM {
  id: string;
  title: string;
  count: number;
}

function ringDots(r: number, count: number): { x: number; y: number }[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const angle = ((360 / count) * i - 90) * (Math.PI / 180); // ab 12 Uhr, im Uhrzeigersinn
    return { x: +(r * Math.cos(angle)).toFixed(2), y: +(r * Math.sin(angle)).toFixed(2) };
  });
}

export default function TeamOrbit({
  stations, note, reserveLabel,
}: {
  stations: TeamStationVM[];
  note: string;
  reserveLabel: string;
}) {
  const rings = stations.slice(0, RADII.length);
  const reserveR: number | undefined = RADII[rings.length];

  return (
    <div className="kt-map">
      {/* Die Grafik traegt keine Information, die die Legende nicht auch
          traegt — deshalb aria-hidden statt einer erfundenen Bildbeschreibung. */}
      <svg viewBox="0 0 300 300" aria-hidden="true" focusable="false">
        <g transform="translate(150,150)">
          {reserveR !== undefined && (
            <circle className="kt-ring kt-ring-reserve" r={reserveR} pathLength={1} />
          )}
          <g className="kt-stations">
            {rings.map((s, i) => (
              <g key={s.id} style={{ "--r": i } as CSSProperties}>
                <circle className="kt-ring" r={RADII[i]} pathLength={1} />
                {ringDots(RADII[i], s.count).map((d, j) => (
                  <circle
                    key={j}
                    className="kt-dot"
                    cx={d.x}
                    cy={d.y}
                    r={3}
                    style={{ "--i": i * 5 + j } as CSSProperties}
                  />
                ))}
              </g>
            ))}
          </g>
          <circle className="kt-hub" r={3.2} />
        </g>
      </svg>

      <ul className="kt-legend">
        {rings.map(s => (
          <li key={s.id}>
            <span className="kt-legend-dot" aria-hidden="true" />
            <span className="kt-legend-name">{s.title}</span>
            <span className="kt-legend-count">{String(s.count).padStart(2, "0")}</span>
          </li>
        ))}
        {reserveR !== undefined && (
          <li className="kt-legend-reserve">
            <span className="kt-legend-dot" aria-hidden="true" />
            <span className="kt-legend-name">{reserveLabel}</span>
            <span className="kt-legend-count">--</span>
          </li>
        )}
      </ul>

      <p className="kt-map-note">{note}</p>
    </div>
  );
}
