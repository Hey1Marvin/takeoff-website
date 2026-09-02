/* "Genre als Frequenzband-Anzeige (138-150 BPM Skala)" — der zweite Auftrag
   der Artist-Detailseite aus research/50-pages-konzept.md, bisher nicht
   gebaut: die Seite zeigte das Genre als nackten Text neben dem Namen.

   Die Tempi sind KEINE Erfindung dieser Datei, sondern die Zahlen, die das
   Genre-Lexikon der Musik-Seite fuehrt (Trance 138 · Hard Trance 145 ·
   Bounce 150, src/data/pages/musik.json). Sie stehen hier trotzdem noch
   einmal in src/data/pages/artists.json, weil das Blatt spaeter redaktionell
   bearbeitbar sein soll und nicht auf die Musik-Seite zeigen kann.

   Genres ohne festes Tempo (Techno, Psytrance) und die Licht-"Genres" von
   Blaulicht (DMX, Tubes, Schwarzlicht) bekommen KEIN Band, sondern eine
   Zeile darunter — eine BPM-Marke waere dort schlicht gelogen. Hat ein
   Artist gar kein Tempo-Genre, faellt die ganze Anzeige weg.

   Rein statisch, Server Component: der eine Bewegungsmoment dieser Seite ist
   der Satellit im Orbit. */

export interface BpmConfig {
  label: string;
  unit: string;
  min: number;
  max: number;
  ticks: number[];
  /** Halbe Bandbreite in BPM — ein Genre ist ein Bereich, kein Punkt. */
  spread: number;
  otherLabel: string;
  genres: { match: string; bpm: number }[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function genreTokens(genres: string): string[] {
  return genres.split("·").map(g => g.trim()).filter(Boolean);
}

export default function ArtistBpmBand({
  genres,
  config,
}: {
  genres: string;
  config: BpmConfig;
}) {
  const span = config.max - config.min;
  if (span <= 0) return null;
  const pct = (bpm: number) => clamp(((bpm - config.min) / span) * 100, 0, 100);

  const tokens = genreTokens(genres);
  const bpmOf = (token: string) =>
    config.genres.find(g => g.match.toLowerCase() === token.toLowerCase())?.bpm;

  const bands = tokens
    .map(token => ({ token, bpm: bpmOf(token) }))
    .filter((b): b is { token: string; bpm: number } => typeof b.bpm === "number");
  const rest = tokens.filter(t => typeof bpmOf(t) !== "number");

  if (bands.length === 0) return null;

  return (
    <figure className="ar-freq">
      <figcaption className="ar-freq-label txfit">{config.label}</figcaption>

      <div className="ar-freq-scale" aria-hidden="true">
        <span className="ar-freq-axis" />
        {config.ticks.map(t => (
          <span key={t} className="ar-freq-tick" style={{ left: `${pct(t)}%` }} />
        ))}
        {bands.map((b, i) => (
          <span
            key={b.token}
            className="ar-freq-band"
            data-tone={i % 3}
            style={{
              left: `${pct(b.bpm - config.spread)}%`,
              width: `${pct(b.bpm + config.spread) - pct(b.bpm - config.spread)}%`,
            }}
          />
        ))}
        {config.ticks.map(t => (
          <span key={`l-${t}`} className="ar-freq-tick-label" style={{ left: `${pct(t)}%` }}>
            {t}
          </span>
        ))}
      </div>

      {/* Die Legende traegt die Aussage als Text — die Skala darueber ist
          reine Anschauung und deshalb aria-hidden. */}
      <ul className="ar-freq-keys">
        {bands.map((b, i) => (
          <li key={b.token} data-tone={i % 3}>
            <b translate="no">{b.token}</b>
            <span>~{b.bpm} {config.unit}</span>
          </li>
        ))}
        {rest.map(t => (
          <li key={t} className="is-mute">
            <b translate="no">{t}</b>
            <span>{config.otherLabel}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
