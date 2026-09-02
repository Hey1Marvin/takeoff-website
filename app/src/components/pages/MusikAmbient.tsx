/* Hintergrund-Schichten der Musik-Seite: Frequenzbänder + Halbkreis-
   Tempometer ("Taktgeber"-Dial). Beides ist reines, statisches SVG/CSS —
   keine Interaktion, kein State — deshalb bewusst KEINE Client-Komponente
   (Server Component, läuft ohne jedes JS). Der Zeiger schwingt rein über
   CSS (siehe .tg-dial-arm in musik.css); Ruhezustand bei Tier s/reduced-
   motion zeigt fest auf die Trance-Kerbe.

   Fixed-positioniert (z-index:-2) — die DOM-Position hier spielt für die
   Optik keine Rolle, nur dass die Seite sie überhaupt rendert (gleiches
   Muster wie AwarenessAurora: als erstes Element der Seiten-Fragment
   platziert). Ticks alle 10 BPM (60–180), ein gemeinsamer senkrechter
   Vorlage-Strich (12-Uhr-Stellung = 120 BPM) wird je Marke um
   winkel(bpm) = 1.5·bpm − 180 Grad um den Hub gedreht — dieselbe Formel
   wie für den Zeiger-Ruhezustand (Trance 138 BPM → 27°). */

const TICK_ANGLES = Array.from({ length: 13 }, (_, i) => -90 + i * 15);

const NOTCHES: { genre: string; angle: number }[] = [
  { genre: "trance", angle: 27 },
  { genre: "hard-trance", angle: 37.5 },
  { genre: "bounce", angle: 45 },
];

export default function MusikAmbient() {
  return (
    <>
      <div className="tg-field" aria-hidden="true" />
      <svg id="tg-dial" className="tg-dial" viewBox="0 0 640 340" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="tg-hub-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--acc-1-tint)" stopOpacity=".85" />
            <stop offset="100%" stopColor="var(--acc-1-tint)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g className="tg-dial-ticks">
          {TICK_ANGLES.map(a => (
            <line key={a} x1="320" y1="20" x2="320" y2="38" transform={`rotate(${a} 320 320)`} />
          ))}
        </g>
        <g className="tg-dial-notches">
          {NOTCHES.map(n => (
            <line key={n.genre} data-genre={n.genre} x1="320" y1="20" x2="320" y2="60" transform={`rotate(${n.angle} 320 320)`} />
          ))}
        </g>
        <g className="tg-dial-sweep">
          <line className="tg-dial-arm" x1="320" y1="320" x2="320" y2="36" />
        </g>
        <circle className="tg-dial-hub" cx="320" cy="320" r="20" />
      </svg>
    </>
  );
}
