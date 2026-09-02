/* Sektionskopf der Artists-Seiten — die Antwort auf "linksbuendige Spalte,
   rechts 55 % schwarz".

   Statt eyebrow + h2 in einer 520px-Spalte ist der Kopf eine Leiste ueber die
   VOLLE Satzbreite: links Titel, rechts ein Mono-Messwert (Anzahl Kanaele,
   Aufzeichnungen, Naechte) oder ein Werkzeug, darunter ein Haarstrich, der bis
   zur rechten Kante durchlaeuft und dort in einen Zahnkamm ausfranst — die
   leise Wiederholung des Frequenz-Motivs, ohne eine zweite Vollflaechen-Ebene.

   Bewusst NICHT `.section-head`: dessen Nacht-Traegerflaeche (scene-night.css)
   ist eine grosse weiche Ellipse, und genau die soll It. 14 loswerden. Der
   Text bekommt hier seinen Grund einzeln — h2 als `.txplate`-Schild, der
   Messwert als `.txfit`, die Eyebrow ueber eine eigene Regel in artists.css.

   Kein "use client": rein praesentational, damit die Datei sowohl aus der
   Server-Seite als auch aus den Client-Komponenten (Sets-Sektion) importiert
   werden kann. */
import type { ReactNode } from "react";

export default function ArtistsSectionHead({
  eyebrow,
  title,
  glow,
  note,
  children,
}: {
  eyebrow: string;
  title: string;
  /** Zweiter Teil der Ueberschrift, in Akzentfarbe. */
  glow?: string;
  /** Mono-Messwert an der rechten Kante, z. B. "04 Kanäle". */
  note?: string;
  /** Werkzeuge an der rechten Kante (Random Transmission). */
  children?: ReactNode;
}) {
  return (
    <header className="ar-head">
      <div className="ar-head-main">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="h2 txplate">
          {title}
          {glow ? <> <span className="glow">{glow}</span></> : null}
        </h2>
      </div>
      {(note || children) && (
        <div className="ar-head-aside">
          {note ? <p className="ar-count txfit">{note}</p> : null}
          {children}
        </div>
      )}
      <span className="ar-rule" aria-hidden="true" />
    </header>
  );
}
