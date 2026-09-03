"use client";
/* ============================================================
   MediaGallery — die Clips des Kollektivs, der Events, der Artists

   ── Wie es sich anfuehlt ──────────────────────────────────
   Eine Wand aus Standbildern. Ein Klick, und GENAU DIESE Kachel wird
   zum Player und laeuft los — auf der Seite, nicht in einem Fenster
   darueber. In der Leiste sitzt der Vollbild-Knopf; wer will, geht
   von dort ganz gross.

   ── Warum keine Lightbox mehr ─────────────────────────────
   Es gab kurz eine: Klick oeffnet ein <dialog>, darin ein grosses
   Video mit Vor/Zurueck. Sie loeste das richtige Problem (190px-Kacheln
   sind zu klein) mit dem falschen Mittel — sie nimmt einem die Seite
   weg, um ein Video zu zeigen, das auch auf der Seite Platz hat.
   Jetzt sind die Kacheln gross genug, und der Weg ins Grosse ist der
   Vollbild-Knopf des Players statt einer selbstgebauten Zwischenstufe.

   ── Warum nicht alle Kacheln gleich Player sind ───────────
   Ein Event hat bis zu 32 Clips. 32 <media-controller> mit 32 <video>
   waeren 32 Metadaten-Ladevorgaenge beim Seitenaufbau. Die Kachel ist
   deshalb bis zum Klick nur ein <img> mit einem Knopf darueber — der
   Player entsteht erst, wenn er gebraucht wird.

   ── Was bleibt ────────────────────────────────────────────
   · Nur EIN Clip laeuft. Das ergibt sich hier von selbst: es gibt nur
     einen aktiven Index, also auch nur ein <video> im Dokument.
   · Bei FX-Stufe "s" oder `prefers-reduced-motion` startet nichts von
     allein. Die Kachel wird trotzdem zum Player — wer wenig Bewegung
     will, will nicht "kein Video", sondern "kein Video ungefragt".
   · Hoch- und Querformat behalten ihr Verhaeltnis, `grid-auto-flow:
     dense` fuellt die Luecken der doppelt breiten Querformat-Kacheln.
   · KEINE Zustimmung noetig: diese Videos liegen bei uns unter /media.
     Die Embed-Zustimmung betrifft ausschliesslich SoundCloud/YouTube.

   ── Warum die Klassen `mgal-v2` heissen ───────────────────
   `.mgal` und `.mgal-item` stehen in takeoff.css (geteilte Datei). Die
   neuen Regeln liegen in embeds.css, deren Ladereihenfolge gegenueber
   takeoff.css bei importierten Komponenten-Stylesheets nicht garantiert
   ist — sie haengen deshalb an einer ZWEITEN Klasse und gewinnen ueber
   Spezifitaet statt ueber Reihenfolge.
   ============================================================ */
import { useRef, useState, useSyncExternalStore } from "react";
import type { MediaItem } from "@/lib/types";
import MediaPlayer from "./MediaPlayer";
import "@/styles/embeds.css";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/* ---------- "Steht die Seite still?" ----------
   Zwei Quellen, ein Abonnement: `data-fx` auf <html> (Mission Control,
   Boot-Script, Watchdog) und die Systemeinstellung fuer reduzierte
   Bewegung. Gelesen per useSyncExternalStore statt useState+useEffect —
   der Wert aendert sich jederzeit von aussen, und ein setState im Effekt
   schlaegt an der Lint-Regel `set-state-in-effect` an.
   Server-Schnappschuss `false`: serverseitig gibt es weder Attribut noch
   Media Query, und "nicht statisch" ist die Fassung, die auch im HTML
   ohne JavaScript steht. */
const MOTION_Q = "(prefers-reduced-motion: reduce)";
const statischListeners = new Set<() => void>();
let statischObserver: MutationObserver | null = null;
let motionQuery: MediaQueryList | null = null;

const feuern = () => { for (const l of statischListeners) l(); };

function subscribeStatisch(onChange: () => void): () => void {
  statischListeners.add(onChange);
  if (!statischObserver) {
    statischObserver = new MutationObserver(feuern);
    statischObserver.observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-fx"],
    });
    motionQuery = matchMedia(MOTION_Q);
    motionQuery.addEventListener("change", feuern);
  }
  return () => {
    statischListeners.delete(onChange);
    if (statischListeners.size === 0) {
      statischObserver?.disconnect();
      statischObserver = null;
      motionQuery?.removeEventListener("change", feuern);
      motionQuery = null;
    }
  };
}

function statischSnapshot(): boolean {
  return (document.documentElement.dataset.fx ?? "m") === "s"
    || matchMedia(MOTION_Q).matches;
}

export default function MediaGallery({ items, label }: { items: MediaItem[]; label?: string }) {
  const statisch = useSyncExternalStore(subscribeStatisch, statischSnapshot, () => false);
  const [aktiv, setAktiv] = useState<number | null>(null);
  const kacheln = useRef<(HTMLButtonElement | null)[]>([]);

  if (items.length === 0) return null;

  return (
    <ul className="mgal mgal-v2" aria-label={label}>
      {items.map((m, i) => (
        <li key={m.src} className={`mgal-item ${m.orientation}${aktiv === i ? " is-live" : ""}`}>
          {aktiv === i ? (
            <>
              <MediaPlayer item={m} autoPlay={!statisch} />
              {/* Zurueck zum Standbild. Der Knopf gibt den Fokus an die
                  Kachel zurueck, sonst faengt die Tastaturbedienung nach
                  dem Schliessen wieder oben auf der Seite an. */}
              <button
                type="button"
                className="mgal-zu"
                onClick={() => {
                  setAktiv(null);
                  requestAnimationFrame(() => kacheln.current[i]?.focus());
                }}
                aria-label={`Schliessen: ${m.caption}`}
              >
                ✕
              </button>
              <span className="mgal-cap mgal-cap--live">{m.caption}</span>
            </>
          ) : (
            <button
              type="button"
              className="mgal-flaeche"
              ref={el => { kacheln.current[i] = el; }}
              onClick={() => setAktiv(i)}
              aria-label={`Abspielen: ${m.caption}`}
            >
              {/* Bewusst <img>: die Poster liegen bereits in Zielgroesse vor,
                  next/image wuerde sie nur ein zweites Mal umrechnen. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="mgal-poster" src={m.poster} alt="" loading="lazy" />
              <span className="mgal-dauer">{mmss(m.dauer)}</span>
              <span className="mgal-play" aria-hidden="true">▶</span>
              <span className="mgal-cap">{m.caption}</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
