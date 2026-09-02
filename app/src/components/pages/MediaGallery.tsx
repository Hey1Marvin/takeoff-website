"use client";
/* Galerie der Kollektiv-Clips.

   Drei Dinge, die hier bewusst so sind:

   1. NUR EIN VIDEO GLEICHZEITIG. Ohne das laufen bei 32 Kacheln (Mario-Kart-
      Rave) nach ein paar Klicks ein Dutzend Clips parallel — Ton uebereinander,
      Geraet am Anschlag. Wer ein neues startet, stoppt das alte.
   2. LADEN ERST BEIM KLICK. Im Ruhezustand steht nur das Standbild; das
      <video> entsteht erst danach. Sonst zoege eine Galerie Megabytes, bevor
      jemand etwas sehen will.
   3. STUMM STARTEN. Autoplay mit Ton wird von Browsern ohnehin blockiert und
      ist an einem Arbeitsplatz unhoeflich. Wo Ton etwas traegt, gibt es einen
      Schalter — wo nicht (Mitschnitte), fehlt er ganz.

   Bei FX-Stufe s bleibt es bei den Standbildern: kein Video, keine Bewegung.
   Das folgt derselben Regel wie Sternenfeld und Hero-Video. */
import { useEffect, useRef, useState } from "react";
import type { MediaItem } from "@/lib/types";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function MediaGallery({ items, label }: { items: MediaItem[]; label?: string }) {
  const [aktiv, setAktiv] = useState<number | null>(null);
  const [ton, setTon] = useState(false);
  const [statisch, setStatisch] = useState(false);
  const refs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    const html = document.documentElement;
    const lesen = () => setStatisch(
      (html.dataset.fx ?? "m") === "s" ||
      matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    lesen();
    const mo = new MutationObserver(lesen);
    mo.observe(html, { attributes: true, attributeFilter: ["data-fx"] });
    return () => mo.disconnect();
  }, []);

  /* Beim Wechsel das vorherige Video anhalten und zuruecksetzen — sonst
     laeuft es im Hintergrund weiter und verbraucht Bandbreite. */
  const starte = (i: number) => {
    if (statisch) return;
    refs.current.forEach((v, j) => { if (v && j !== i) { v.pause(); v.currentTime = 0; } });
    setAktiv(i); setTon(false);
  };

  if (items.length === 0) return null;

  return (
    <ul className="mgal" aria-label={label}>
      {items.map((m, i) => {
        const laeuft = aktiv === i;
        return (
          <li key={m.src} className={`mgal-item ${m.orientation}`}>
            {laeuft ? (
              <div className="mgal-flaeche">
                <video
                  ref={el => { refs.current[i] = el; }}
                  className="mgal-video"
                  src={m.src}
                  poster={m.poster}
                  autoPlay
                  loop
                  muted={!ton}
                  playsInline
                  controls={false}
                  onClick={() => { setAktiv(null); }}
                />
                <span className="mgal-cap">{m.caption}</span>
                {m.ton && (
                  <button type="button" className="mgal-ton"
                    aria-pressed={ton} onClick={() => setTon(v => !v)}>
                    {ton ? "Ton aus" : "Ton an"}
                  </button>
                )}
              </div>
            ) : (
              <button type="button" className="mgal-flaeche" onClick={() => starte(i)}
                aria-label={`Abspielen: ${m.caption}`} disabled={statisch}>
                {/* Bewusst <img>: die Poster liegen bereits in Zielgroesse vor,
                    next/image wuerde sie nur ein zweites Mal umrechnen. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="mgal-poster" src={m.poster} alt={m.caption} loading="lazy" />
                <span className="mgal-dauer">{mmss(m.dauer)}</span>
                {!statisch && <span className="mgal-play" aria-hidden="true">▶</span>}
                <span className="mgal-cap">{m.caption}</span>
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
