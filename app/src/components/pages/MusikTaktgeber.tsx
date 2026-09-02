"use client";
/* "Taktgeber" — BPM-Skala (Dial-Pendant im Content) + Genre-Liste mit
   Puls-Punkten + Tap-Tempo-Pad als EINE Client-Komponente, weil alle drei
   denselben State teilen: das eigene Tempo ("Du"), einmal getippt,
   erscheint live als Marker auf der Skala UND hebt die passende Genre-
   Zeile hervor. Die Puls-Punkte selbst laufen rein über CSS (Hover/Focus,
   siehe musik.css `.tg-genres .m-row[data-bpm] dt::before`) — hier steckt
   nur das echte Tap-Tempo-Messen (Portierung von wireTap() aus
   assets/js/pages/musik.js).

   Single Source of Truth für alle BPM-Werte sind die genres-Props (aus
   pageContent("musik")) — keine zweite, hartkodierte Zahl im Skript. */
import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";

export interface MusikWayfindLink {
  slug: string;
  label: string;
  href: string;
}

export interface MusikGenreVM {
  id: string;
  label: string;
  shortLabel: string;
  bpm: number | null;
  beatMs: number | null;
  text: string; // kann "{bpm}" als Platzhalter enthalten
  wayfindArtists: MusikWayfindLink[];
  wayfindEvents: MusikWayfindLink[];
}

export interface MusikTapCopy {
  instruction: string;
  button: string;
  reset: string;
  resultTemplate: string; // "{bpm}"/"{genre}"-Platzhalter
  tooFastText: string;
  tooSlowText: string;
  flavor: Record<string, string>;
}

type TappableGenre = MusikGenreVM & { bpm: number };

const GAP_RESET_MS = 2200;
/* Wie im Prototyp: dieser Zwischenschritt-Text lebt nicht in musik.json,
   weil er rein algorithmisch ist (kein Redaktions-Text) — gleiches
   Vorgehen wie bei EventsBpmTool.tsx. */
const TAP_AGAIN_TEXT = "Nochmal — beim zweiten Tipp erkennen wir den Takt.";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* Bold nur "~138 BPM" als Einheit (matcht die Quelle: <b>~138 BPM</b>),
   nicht die ganze Zahl isoliert — Techno/Psytrance haben kein {bpm} und
   bleiben unangetastet. */
function renderGenreText(text: string, bpm: number | null): ReactNode {
  if (bpm == null) return text;
  const withNumber = text.replace("{bpm}", String(bpm));
  const boldMarker = `~${bpm} BPM`;
  const idx = withNumber.indexOf(boldMarker);
  if (idx === -1) return withNumber;
  return (
    <>
      {withNumber.slice(0, idx)}
      <b>{boldMarker}</b>
      {withNumber.slice(idx + boldMarker.length)}
    </>
  );
}

function fillTemplate(tmpl: string, bpmRounded: number, genreLabel: string): ReactNode {
  return tmpl.split(/(\{bpm\}|\{genre\})/g).map((part, i) => {
    if (part === "{bpm}") return <b key={`bpm${i}`}>{bpmRounded}</b>;
    if (part === "{genre}") return <b key={`genre${i}`}>{genreLabel}</b>;
    return part;
  });
}

function nearestTapGenre(bpm: number, list: TappableGenre[]): TappableGenre {
  return list.reduce((best, g) => (Math.abs(g.bpm - bpm) < Math.abs(best.bpm - bpm) ? g : best), list[0]);
}

function describeTap(bpm: number, list: TappableGenre[], tap: MusikTapCopy): ReactNode {
  const g = nearestTapGenre(bpm, list);
  const dist = Math.abs(g.bpm - bpm);
  const bpmRounded = Math.round(bpm);
  if (dist <= 4) {
    const flavor = tap.flavor[g.id];
    return <>{fillTemplate(tap.resultTemplate, bpmRounded, g.label)}{flavor ? ` ${flavor}` : ""}</>;
  }
  if (dist <= 9) {
    return <>Nah an <b>{g.label}</b> ({g.bpm} BPM) — eine Idee {bpm < g.bpm ? "schneller" : "langsamer"}.</>;
  }
  return <>{bpm < g.bpm ? tap.tooSlowText : tap.tooFastText}</>;
}

function fxOn(): boolean {
  return document.documentElement.dataset.fx !== "s" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function MusikTaktgeber({
  scaleMin, scaleMax, scaleCaption, genres, tap,
}: {
  scaleMin: number;
  scaleMax: number;
  scaleCaption: string;
  genres: MusikGenreVM[];
  tap: MusikTapCopy;
}) {
  const [tapBpm, setTapBpm] = useState<number | null>(null);
  const [awaitingSecond, setAwaitingSecond] = useState(false);
  const tapsRef = useRef<number[]>([]);
  const padRef = useRef<HTMLButtonElement>(null);

  const tappable = genres.filter((g): g is TappableGenre => g.bpm != null);
  const matched = tapBpm != null && tappable.length > 0 ? nearestTapGenre(tapBpm, tappable) : null;
  const matchedIsClose = matched != null && tapBpm != null && Math.abs(matched.bpm - tapBpm) <= 4;

  const ticks: number[] = [];
  for (let v = scaleMin; v <= scaleMax; v += 10) ticks.push(v);

  function flashRing() {
    const el = padRef.current;
    if (!el || !fxOn()) return;
    el.classList.remove("is-tapped");
    void el.offsetWidth; // Reflow erzwingen, damit schnelle Folge-Taps die Animation neu starten
    el.classList.add("is-tapped");
  }

  function handleTap() {
    if (tappable.length === 0) return;
    const now = performance.now();
    const taps = tapsRef.current;
    if (taps.length && now - taps[taps.length - 1] > GAP_RESET_MS) taps.length = 0; // alte Serie verwerfen
    taps.push(now);
    if (taps.length > 8) taps.shift(); // gleitendes Fenster

    if (taps.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < taps.length; i++) gaps.push(taps[i] - taps[i - 1]);
      const avgMs = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const bpm = 60000 / avgMs;
      if (bpm >= 40 && bpm <= 300) { // Ausreisser ignorieren
        setTapBpm(bpm);
        setAwaitingSecond(false);
      }
    } else {
      setAwaitingSecond(true);
    }
    flashRing();
  }

  function handleReset() {
    tapsRef.current = [];
    setTapBpm(null);
    setAwaitingSecond(false);
  }

  return (
    <>
      <div className="tg-panel">
        <p className="tg-caption">Taktskala · {scaleMin}–{scaleMax} BPM</p>
        <p className="tg-caption-sub">{scaleCaption}</p>
        <div className="tg-scale">
          <div className="tg-scale-track">
            {ticks.map(v => {
              const major = v % 30 === 0;
              return (
                <span key={v} className={`tg-tick${major ? " tg-tick--major" : ""}`} style={{ "--at": v } as CSSProperties}>
                  {major && <b>{v}</b>}
                </span>
              );
            })}
            {tappable.map(g => (
              <span key={g.id} className="tg-mark" data-genre={g.id} style={{ "--at": g.bpm } as CSSProperties}>
                <i className="tg-dot" aria-hidden="true" />
                <b translate="no">{g.shortLabel}</b>
                <small>{g.bpm}</small>
              </span>
            ))}
            <span
              className="tg-mark tg-mark--you"
              id="tg-you"
              hidden={tapBpm == null}
              style={tapBpm != null ? ({ "--at": clamp(tapBpm, scaleMin, scaleMax) } as CSSProperties) : undefined}
            >
              <i className="tg-dot" aria-hidden="true" />
              <b>Du</b>
              <small>{tapBpm != null ? Math.round(tapBpm) : "—"}</small>
            </span>
          </div>
        </div>
      </div>

      <dl className="m-rows tg-genres">
        {genres.map(g => {
          const hasWayfind = g.wayfindArtists.length > 0 || g.wayfindEvents.length > 0;
          return (
            <div
              key={g.id}
              id={`g-${g.id}`}
              className={`m-row${matchedIsClose && matched?.id === g.id ? " is-matched" : ""}`}
              data-genre={g.id}
              data-bpm={g.bpm ?? ""}
              style={g.beatMs != null ? ({ "--beat": `${g.beatMs}ms` } as CSSProperties) : undefined}
            >
              <dt translate={g.id === "bounce" ? undefined : "no"}>{g.label}</dt>
              <dd>{renderGenreText(g.text, g.bpm)}</dd>
              {hasWayfind && (
                <div className="tg-wayfind">
                  {g.wayfindArtists.length > 0 && (
                    <>
                      <span className="tg-wayfind-label">Live gespielt von</span>
                      {g.wayfindArtists.map(a => (
                        <Link key={`a-${a.slug}`} className="chip" href={a.href}>{a.label}</Link>
                      ))}
                    </>
                  )}
                  {g.wayfindEvents.length > 0 && (
                    <>
                      <span className="tg-wayfind-label">Nächste Termine</span>
                      {g.wayfindEvents.map(e => (
                        <Link key={`e-${e.slug}`} className="chip" href={e.href}>{e.label}</Link>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </dl>

      <div className="tg-tap" aria-live="polite">
        <p className="tg-tap-label"><i className="tg-tap-dot" aria-hidden="true" />Tipp mit</p>
        <button
          ref={padRef}
          type="button"
          className="tg-tap-pad"
          id="tg-tap-btn"
          aria-describedby="tg-tap-readout"
          onClick={handleTap}
        >
          <span className="tg-tap-ring" aria-hidden="true" />
          <span className="tg-tap-word">{tap.button}</span>
        </button>
        <p className="tg-tap-readout" id="tg-tap-readout">
          <span className="tg-tap-bpm"><b>{tapBpm != null ? Math.round(tapBpm) : "—"}</b> <small>BPM</small></span>
          <span className="tg-tap-match">
            {awaitingSecond ? TAP_AGAIN_TEXT : tapBpm != null ? describeTap(tapBpm, tappable, tap) : tap.instruction}
          </span>
        </p>
        <button type="button" className="tg-tap-reset" onClick={handleReset} hidden={tapBpm == null}>
          {tap.reset}
        </button>
      </div>
    </>
  );
}
