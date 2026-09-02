"use client";
/* "Taktgeber" — das Signatur-Motiv der Musik-Seite als EIN Instrument:
   Taktskala + Tap-Tempo-Pad + die drei Kern-Tempi als Spalten, alles in
   einer Konsole. Warum eine einzige Client-Komponente: die drei Teile
   teilen denselben State. Einmal getippt erscheint das eigene Tempo live
   als "Du"-Marke auf der Skala UND hebt die passende Genre-Spalte hervor —
   und weil Pad und Spalten jetzt nebeneinander stehen, sieht man beides
   ohne zu scrollen. Vorher lag das Pad zwei Bildschirme unter der Liste.

   Die Aussage der Seite ist der TEMPO-UNTERSCHIED (138 / 145 / 150 BPM).
   Deshalb pulsiert der Punkt jeder Kern-Spalte dauerhaft in seinem echten
   Takt (60000/BPM ms) statt nur bei Hover — nebeneinander laufend ist der
   Unterschied sichtbar, nacheinander per Hover war er es nie. Der Puls ist
   der EINE Bewegungsmoment dieser Seite (musik.css §4); alles andere
   bewegt sich nur als Antwort auf eine Handlung.

   Single Source of Truth für alle BPM-Werte und alle Texte sind die Props
   (aus pageContent("musik")) — keine zweite, hartkodierte Zahl und kein
   deutscher Satz im Skript. */
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

export interface MusikScaleCopy {
  min: number;
  max: number;
  label: string;
  caption: string;
  coreLabel: string;
  youLabel: string;
}

export interface MusikTapCopy {
  label: string;
  instruction: string;
  button: string;
  reset: string;
  againText: string;
  resultTemplate: string; // "{bpm}"/"{genre}"-Platzhalter
  nearTemplate: string; // "{bpm}"/"{genre}"/"{richtung}"-Platzhalter
  fasterWord: string;
  slowerWord: string;
  tooFastText: string;
  tooSlowText: string;
  flavor: Record<string, string>;
}

export interface MusikWayfindCopy {
  artistsLabel: string;
  eventsLabel: string;
}

export interface MusikGuestsCopy {
  label: string;
  note: string;
}

type TappableGenre = MusikGenreVM & { bpm: number };

const GAP_RESET_MS = 2200;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/* Skalen-Mapping. Steht bewusst HIER und nicht mehr in musik.css: dort war
   `calc((var(--at) - 60) / 120 * 100%)` fest verdrahtet — die Skalengrenzen
   kommen aber aus musik.json. Wer dort 60/180 geändert hätte, hätte eine
   Skala bekommen, deren Beschriftung und deren Positionen auseinanderlaufen.
   Jetzt rechnet genau eine Stelle. */
const pctOf = (v: number, min: number, max: number) =>
  `${((clamp(v, min, max) - min) / (max - min)) * 100}%`;

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

/* Ein Template mit {bpm}/{genre}/{richtung} in React-Knoten auflösen — die
   Zahl und der Genre-Name werden ausgezeichnet, der Rest bleibt Fliesstext. */
function fillTemplate(tmpl: string, vals: Record<string, ReactNode>): ReactNode {
  return tmpl.split(/(\{bpm\}|\{genre\}|\{richtung\})/g).map((part, i) => {
    const key = part.slice(1, -1);
    if (part.startsWith("{") && key in vals) return <span key={`${key}${i}`}>{vals[key]}</span>;
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
    return (
      <>
        {fillTemplate(tap.resultTemplate, { bpm: <b>{bpmRounded}</b>, genre: <b>{g.label}</b> })}
        {flavor ? ` ${flavor}` : ""}
      </>
    );
  }
  if (dist <= 9) {
    return fillTemplate(tap.nearTemplate, {
      bpm: g.bpm,
      genre: <b>{g.label}</b>,
      richtung: bpm < g.bpm ? tap.fasterWord : tap.slowerWord,
    });
  }
  return <>{bpm < g.bpm ? tap.tooSlowText : tap.tooFastText}</>;
}

function fxOn(): boolean {
  return document.documentElement.dataset.fx !== "s" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* Der Puls-Punkt einer Kern-Spalte. Kern + Ring laufen beide über
   `--beat` (= 60000/BPM ms), gesetzt auf der Spalte. Ruhezustand (Tier s /
   reduced-motion) ist der volle Kern ohne Ring — dafür braucht es kein JS,
   die Regeln stehen in musik.css §4. */
function BeatDot() {
  return (
    <span className="tg-beat" aria-hidden="true">
      <i className="tg-beat-ring" />
      <i className="tg-beat-core" />
    </span>
  );
}

function WayfindChips({ genre, copy }: { genre: MusikGenreVM; copy: MusikWayfindCopy }) {
  if (genre.wayfindArtists.length === 0 && genre.wayfindEvents.length === 0) return null;
  return (
    <div className="tg-wayfind">
      {genre.wayfindArtists.length > 0 && (
        <>
          <span className="tg-wayfind-label">{copy.artistsLabel}</span>
          <span className="tg-wayfind-chips">
            {genre.wayfindArtists.map(a => (
              <Link key={`a-${a.slug}`} className="chip" href={a.href}>{a.label}</Link>
            ))}
          </span>
        </>
      )}
      {genre.wayfindEvents.length > 0 && (
        <>
          <span className="tg-wayfind-label">{copy.eventsLabel}</span>
          <span className="tg-wayfind-chips">
            {genre.wayfindEvents.map(e => (
              <Link key={`e-${e.slug}`} className="chip" href={e.href}>{e.label}</Link>
            ))}
          </span>
        </>
      )}
    </div>
  );
}

export default function MusikTaktgeber({
  scale, genres, tap, wayfind, guests,
}: {
  scale: MusikScaleCopy;
  genres: MusikGenreVM[];
  tap: MusikTapCopy;
  wayfind: MusikWayfindCopy;
  guests: MusikGuestsCopy;
}) {
  const [tapBpm, setTapBpm] = useState<number | null>(null);
  const [awaitingSecond, setAwaitingSecond] = useState(false);
  const tapsRef = useRef<number[]>([]);
  const padRef = useRef<HTMLButtonElement>(null);

  const core = genres.filter((g): g is TappableGenre => g.bpm != null);
  const guestGenres = genres.filter(g => g.bpm == null);
  const matched = tapBpm != null && core.length > 0 ? nearestTapGenre(tapBpm, core) : null;
  const matchedIsClose = matched != null && tapBpm != null && Math.abs(matched.bpm - tapBpm) <= 4;

  const ticks: number[] = [];
  for (let v = scale.min; v <= scale.max; v += 10) ticks.push(v);

  /* Klammer unter dem Kernbereich: exakt die Spanne der echten Tempi plus
     ein halbes Punkt-Polster, damit die Aussenpunkte innen liegen. */
  const coreLo = core.length > 0 ? Math.min(...core.map(g => g.bpm)) : scale.min;
  const coreHi = core.length > 0 ? Math.max(...core.map(g => g.bpm)) : scale.max;
  const bracketLeft = pctOf(coreLo, scale.min, scale.max);
  const bracketRight = pctOf(coreHi, scale.min, scale.max);

  function flashRing() {
    const el = padRef.current;
    if (!el || !fxOn()) return;
    el.classList.remove("is-tapped");
    void el.offsetWidth; // Reflow erzwingen, damit schnelle Folge-Taps die Animation neu starten
    el.classList.add("is-tapped");
  }

  function handleTap() {
    if (core.length === 0) return;
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
    <div className="tg-console">
      {/* ---- Ableseteil: die Skala ---- */}
      <div className="tg-read">
        <p className="tg-caption">
          {scale.label} <span aria-hidden="true">·</span>{" "}
          <span className="tg-num">{scale.min}–{scale.max}</span> BPM
        </p>
        <p className="tg-caption-sub">{scale.caption}</p>
        <div className="tg-scale-track">
          <span
            className="tg-bracket"
            aria-hidden="true"
            style={{ "--from": bracketLeft, "--to": bracketRight } as CSSProperties}
          >
            <b>{scale.coreLabel}</b>
          </span>
          {ticks.map(v => {
            const major = v % 30 === 0;
            return (
              <span
                key={v}
                className={`tg-tick${major ? " tg-tick--major" : ""}`}
                style={{ "--at": pctOf(v, scale.min, scale.max) } as CSSProperties}
              >
                {major && <b>{v}</b>}
              </span>
            );
          })}
          {core.map(g => (
            <span
              key={g.id}
              className={`tg-mark${matchedIsClose && matched?.id === g.id ? " is-matched" : ""}`}
              data-genre={g.id}
              style={{ "--at": pctOf(g.bpm, scale.min, scale.max) } as CSSProperties}
            >
              <i className="tg-dot" aria-hidden="true" />
              <small className="tg-num">{g.bpm}</small>
              <span className="tg-sr">{g.label}</span>
            </span>
          ))}
          <span
            className="tg-mark tg-mark--you"
            hidden={tapBpm == null}
            style={tapBpm != null ? ({ "--at": pctOf(tapBpm, scale.min, scale.max) } as CSSProperties) : undefined}
          >
            <i className="tg-you-stem" aria-hidden="true" />
            <i className="tg-dot" aria-hidden="true" />
            <small><b>{scale.youLabel}</b> <span className="tg-num">{tapBpm != null ? Math.round(tapBpm) : "—"}</span></small>
          </span>
        </div>
      </div>

      {/* ---- Bedienteil: Tap-Tempo ---- */}
      <div className="tg-tap">
        <p className="tg-tap-label"><i className="tg-tap-dot" aria-hidden="true" />{tap.label}</p>
        <button
          ref={padRef}
          type="button"
          className="tg-tap-pad"
          aria-describedby="tg-tap-readout"
          onClick={handleTap}
        >
          <span className="tg-tap-ring" aria-hidden="true" />
          <span className="tg-tap-word">{tap.button}</span>
        </button>
        <p className="tg-tap-readout" id="tg-tap-readout" aria-live="polite">
          <span className="tg-tap-bpm">
            <b className="tg-num">{tapBpm != null ? Math.round(tapBpm) : "—"}</b> <small>BPM</small>
          </span>
          <span className="tg-tap-match">
            {awaitingSecond ? tap.againText : tapBpm != null ? describeTap(tapBpm, core, tap) : tap.instruction}
          </span>
        </p>
        <button type="button" className="tg-tap-reset" onClick={handleReset} hidden={tapBpm == null}>
          {tap.reset}
        </button>
      </div>

      {/* ---- Vergrösserung: die drei Kern-Tempi als Spalten ---- */}
      <div className="tg-cards">
        {core.map(g => (
          <article
            key={g.id}
            id={`g-${g.id}`}
            className={`tg-card${matchedIsClose && matched?.id === g.id ? " is-matched" : ""}`}
            data-genre={g.id}
            style={g.beatMs != null ? ({ "--beat": `${g.beatMs}ms` } as CSSProperties) : undefined}
          >
            <p className="tg-card-bpm">
              <BeatDot />
              <b className="tg-num">{g.bpm}</b>
              <small>BPM</small>
            </p>
            <h2 className="tg-card-name" translate={g.id === "bounce" ? undefined : "no"}>{g.label}</h2>
            <p className="tg-card-text">{renderGenreText(g.text, g.bpm)}</p>
            <WayfindChips genre={g} copy={wayfind} />
          </article>
        ))}
      </div>

      {/* ---- Gäste ohne festes Tempo ---- */}
      {guestGenres.length > 0 && (
        <div className="tg-guests">
          <p className="tg-guests-head">
            <span className="tg-guests-label">{guests.label}</span>
            <span className="tg-guests-note">{guests.note}</span>
          </p>
          <div className="tg-guests-list">
            {guestGenres.map(g => (
              <div key={g.id} id={`g-${g.id}`} className="tg-guest" data-genre={g.id}>
                <p className="tg-guest-name">
                  <i className="tg-guest-dot" aria-hidden="true" />
                  <span translate="no">{g.label}</span>
                </p>
                <p className="tg-guest-text">{g.text}</p>
                <WayfindChips genre={g} copy={wayfind} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
