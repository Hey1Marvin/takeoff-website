/* Ebene 1 des Bauplan-Signaturmotivs (kollektiv.css): der Bogen, auf dem
   die ganze Seite liegt — Millimeterraster, Bogenkante, Heftrand.

   VORHER war das eine Client-Komponente, die dem Raster bei FX-Tier "l"
   einen Parallax-Drift beim Scrollen gab (--bp-drift). Der ist It. 14
   bewusst entfallen, aus zwei Gruenden:

     1. Er widersprach dem Motiv. Auf einer Blaupause IST das Raster das
        Papier; Papier verschiebt sich nicht unter seiner eigenen Zeichnung.
        Der Drift las sich deshalb nicht als Tiefe, sondern als Wackeln.
     2. Er war der vierte gleichzeitige Bewegungsmoment der Seite und der
        einzige ohne Informationswert. Die Regel dieser Iteration ist EIN
        orchestrierter Moment — der ist hier die Massline im Logbuch, die
        sich beim Scrollen zeichnet (KollektivHistory).

   Damit bleibt kein Client-Zustand uebrig: die Komponente ist jetzt eine
   reine Server-Komponente und kostet kein JavaScript mehr. --bp-drift ist
   aus dem CSS entfernt, das Raster steht still. */
import type { ReactNode } from "react";

export default function KollektivBlueprint({ children }: { children: ReactNode }) {
  return <div className="bp-blueprint">{children}</div>;
}
