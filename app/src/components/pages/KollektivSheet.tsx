/* Das Blatt — Traeger jeder Sektion dieser Seite.

   Die Kollektiv-Seite ist kein Text ueber ein Kollektiv, sondern eines
   seiner eigenen Konstruktionsdokumente. Ein technischer Bogen hat drei
   Dinge, die eine Textspalte nicht hat, und genau die baut diese
   Komponente:

     · HEFTRAND (.bp-rail) — links, ~92px, mit der senkrecht gesetzten
       Blattnummer. Sein Haarstrich laeuft ueber ALLE Blaetter durch: die
       Sektionen haben deshalb selbst kein vertikales Polster mehr (das
       traegt .bp-body), damit die Raender aneinander stossen statt durch
       Luecken unterbrochen zu werden. Das ist zugleich die Antwort auf den
       Hauptbefund des Audits — die Seite war eine linksbuendige Spalte auf
       1440px; jetzt hat sie einen Rand, eine Satzspalte und einen Kopf.
     · PASSERMARKEN (.bp-mark) — zwei Registerkreuze auf den Enden der
       Blattkante. Vier waeren korrekter fuer einen echten Bogen, aber die
       Blaetter stossen hier ohne Luecke aneinander: die unteren Marken des
       einen und die oberen des naechsten staenden 30px uebereinander und
       lesen als Rauschen statt als Register.
     · SCHRIFTFELD-ZEILE (.bp-plate) — "BL. 03 · LOGBUCH · M 1:1" oben
       rechts, aria-hidden, weil sie den Kicker der Sektion nur dekorativ
       wiederholt.

   Rein praesentational, kein Zustand -> Server-Komponente.

   `meta.no` darf leer bleiben: dann traegt das Blatt keine Nummer und
   keine Schriftfeldzeile, nur den durchlaufenden Rand (so haengt die
   Kennwerte-Leiste zwischen den Blaettern im selben Raster, ohne eine
   Blattnummer zu erfinden, die es im Dokument nicht gibt). */
import type { ReactNode } from "react";

export interface SheetMeta {
  /** Blattnummer, zweistellig ("03"). Leer = unbenanntes Zwischenblatt. */
  no?: string;
  /** Blattname im Schriftfeld ("Logbuch"). */
  name?: string;
  /** Massstab, falls einer angegeben ist ("M 1:1"). */
  scale?: string;
}

export default function KollektivSheet({
  meta, id, className, children,
}: {
  meta: SheetMeta;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const plate = [meta.no ? `BL. ${meta.no}` : "", meta.name, meta.scale]
    .filter(Boolean)
    .join(" · ")
    .toUpperCase();

  return (
    <section className={`section bp-sec${className ? ` ${className}` : ""}`} id={id}>
      <div className="wrap bp-sheet">
        <i className="bp-mark" data-pos="tl" aria-hidden="true" />
        <i className="bp-mark" data-pos="tr" aria-hidden="true" />
        <div className="bp-rail" aria-hidden="true">
          {meta.no && <span className="bp-rail-no">BL. {meta.no}</span>}
        </div>
        <div className="bp-body">
          {plate && <span className="bp-plate" aria-hidden="true">{plate}</span>}
          {children}
        </div>
      </div>
    </section>
  );
}
