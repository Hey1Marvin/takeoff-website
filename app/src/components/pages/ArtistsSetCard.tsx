"use client";
/* Zwei-Klick-Fassade fuer ein Set/Podcast — jetzt mit echtem Player.

   Der Vertrag aus CLAUDE.md §6: keine Dritt-Requests ohne Zustimmung.
   Deshalb drei Stufen statt zwei:

     1. Ruhezustand — nur eigene Pixel, kein Byte an SoundCloud/YouTube.
     2. Erster Klick  — der Hinweis erscheint, WAS geladen wuerde.
     3. Zweiter Klick — der Player wird eingebettet.

   Erst in Stufe 3 entsteht ein Request nach draussen. Auch das Standbild
   kommt nicht von der Plattform (das waere bereits ein Request), sondern
   aus unseren eigenen Daten.

   Bis It. 13 endete das hier bei Stufe 2 — es gab ueberhaupt keinen Player,
   der Klick schaltete nur einen Hinweistext um. */
import { useState } from "react";
import type { MediaSet } from "@/lib/types";

export interface SetCardData {
  id: string;
  title: string;
  meta: string;
  /** Ohne Quelle bleibt es bei der reinen Fassade (wie bisher). */
  quelle?: Pick<MediaSet, "platform" | "id" | "url">;
}

/* Beide Einbettungen laufen ueber die datensparsame Variante:
   youtube-nocookie setzt vor dem Abspielen keine Werbe-Cookies, der
   SoundCloud-Player laeuft ohne verwandte Titel und ohne Kommentare. */
function playerSrc(q: NonNullable<SetCardData["quelle"]>): string {
  if (q.platform === "youtube") {
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(q.id)}`
      + `?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
  }
  const track = encodeURIComponent(q.url);
  return `https://w.soundcloud.com/player/?url=${track}`
    + `&auto_play=true&hide_related=true&show_comments=false`
    + `&show_reposts=false&show_teaser=false&visual=false&color=%23e04fb4`;
}

export default function ArtistsSetCard({
  data,
  highlighted = false,
  consentText,
  ariaLabel,
}: {
  data: SetCardData;
  highlighted?: boolean;
  consentText: string;
  ariaLabel: string;
}) {
  const [asked, setAsked] = useState(false);
  const [playing, setPlaying] = useState(false);

  const q = data.quelle;
  const dienst = q?.platform === "youtube" ? "YouTube" : "SoundCloud";

  /* Stufe 3: der Player ersetzt die Karte. Ein <iframe> darf nicht in einem
     <button> stehen — deshalb hier ein eigener Zweig statt eines Zustands
     innerhalb des Knopfes. */
  if (playing && q) {
    return (
      <div className={`setcard is-playing${highlighted ? " hit" : ""}`} id={`set-${data.id}`}>
        <iframe
          className="set-player"
          src={playerSrc(q)}
          title={data.title}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        />
        <span className="s-meta">
          <b>{data.title}</b>
          <span>{data.meta} · läuft bei {dienst}</span>
        </span>
      </div>
    );
  }

  const naechsteStufe = () => {
    if (!asked) { setAsked(true); return; }   // Stufe 2: nur der Hinweis
    if (q) setPlaying(true);                   // Stufe 3: jetzt erst nach draussen
  };

  return (
    <button
      id={`set-${data.id}`}
      type="button"
      className={`setcard${asked ? " asked" : ""}${highlighted ? " hit" : ""}`}
      aria-label={ariaLabel}
      aria-expanded={asked}
      onClick={naechsteStufe}
    >
      <span className="cover" aria-hidden="true"><span className="play">▶</span></span>
      <span className="s-meta">
        <b>{data.title}</b>
        <span>{data.meta}</span>
      </span>
      <span className="consent-note">
        {q
          ? `Noch einmal tippen — dann lädt der Player von ${dienst}. Vorher geht kein Byte dorthin.`
          : consentText}
      </span>
    </button>
  );
}
