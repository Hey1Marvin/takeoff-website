/* Signatur-Motiv "Frequenzen" — das Archivband.

   VORHER (It. 13): ein fixiertes Vollbild-Canvas (#freqwave) mit drei
   Sinuslinien bei rgb(... / .14) hinter einer Maske und opacity .8. Auf den
   Audit-Screenshots ist davon NICHTS zu sehen — und es war einer von fuenf
   fast identischen Tricks der Seite (fixierte, schwach deckende, radial
   maskierte Vollflaechen-Ebene). Ein Motiv, das man nicht sieht, ist keins.

   JETZT: das Motiv ist ein Objekt IM Satzspiegel statt eine Ebene dahinter —
   ein Wellenform-Ueberblick, wie ihn ein DJ-Player ueber den ganzen Track
   zeichnet. Es traegt dabei eine Aussage: das Band ist in so viele Keulen
   geteilt, wie es Aufzeichnungen im Archiv gibt, und jede Keule hat ihre
   Spitze. Man sieht also, wie gross das Archiv ist.

   Bewusst OHNE Animation und OHNE JavaScript (Server Component, statisches
   SVG): der eine Bewegungsmoment dieser Seite ist der EQ auf den Karten, der
   auf Zeigen reagiert. Ein dauerhaft laufender Hintergrund waere genau der
   generische Default, den It. 14 loswerden will — und ein statisches SVG
   steht auch bei data-fx="s", bei blockiertem JS und im Screenshot. */

const BARS = 120;
const VB_W = 1200;
const VB_H = 100;
const MID = VB_H / 2;

/* Deterministisch statt Math.random(): Server und Client muessen dasselbe
   Bild rechnen, sonst meldet React einen Hydrations-Unterschied. Kleiner
   ganzzahliger Hash (xorshift-artig), Ergebnis in [0,1). */
function noise(i: number, seed: number): number {
  let x = (i + 1) * 374761393 + seed * 668265263;
  x = (x ^ (x >>> 13)) >>> 0;
  x = Math.imul(x, 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

export default function ArtistsFreqBand({
  segments,
  caption,
  seed = 7,
}: {
  /** Anzahl der Aufzeichnungen — so viele Keulen bekommt das Band. */
  segments: number;
  caption: string;
  seed?: number;
}) {
  const lobes = Math.max(1, segments);
  const pitch = VB_W / BARS;
  const width = pitch * 0.52;

  /* Pro Keule wird die lauteste Saeule markiert — ein Signal je Aufzeichnung. */
  const heights: number[] = [];
  const lobeOf: number[] = [];
  for (let i = 0; i < BARS; i++) {
    const x = (i + 0.5) / BARS;
    const pos = x * lobes;
    const lobe = Math.min(lobes - 1, Math.floor(pos));
    const t = pos - lobe;
    const envelope = Math.pow(Math.sin(Math.PI * t), 0.55);
    const grain = 0.34 + 0.66 * noise(i, seed);
    heights.push(Math.max(2.5, envelope * grain * (VB_H * 0.92)));
    lobeOf.push(lobe);
  }
  const peaks = new Set<number>();
  for (let l = 0; l < lobes; l++) {
    let best = -1, bestH = -1;
    for (let i = 0; i < BARS; i++) {
      if (lobeOf[i] === l && heights[i] > bestH) { bestH = heights[i]; best = i; }
    }
    if (best >= 0) peaks.add(best);
  }

  return (
    <figure className="ar-band">
      <div className="ar-band-plot">
        <svg
          className="ar-band-svg"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          {heights.map((h, i) => (
            <rect
              key={i}
              className={peaks.has(i) ? "ar-band-bar is-peak" : "ar-band-bar"}
              x={i * pitch + (pitch - width) / 2}
              y={MID - h / 2}
              width={width}
              height={h}
              rx={width / 2}
            />
          ))}
        </svg>
      </div>
      {/* Der Text sitzt in einem Block, die Platte auf dem Inline-Element
          darin: `.txplate` ist `display: inline`, damit sie mit dem
          Zeilenumbruch mitlaeuft — ein Inline-Element ignoriert aber Mass
          und Abstand. Beides gehoert deshalb auf den Mantel. */}
      <figcaption className="ar-band-cap"><span className="txplate">{caption}</span></figcaption>
    </figure>
  );
}
