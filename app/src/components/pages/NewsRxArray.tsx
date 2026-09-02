/* Signatur-Motiv "Funkspruch-Terminal", Teil 1: die Empfangsschuessel.

   IT. 14 — WAS SICH GEAENDERT HAT UND WARUM
   Vorher war das hier eine vollflaechige, `position: fixed`, radial
   maskierte Ebene mit 17 % Deckkraft hinter der ganzen Seite. Das war
   derselbe Trick, den fuenf weitere Seiten benutzen — nebeneinander
   gelesen ein Effekt in vier Farben. Im Tagmodus war davon ausserdem
   nichts zu sehen: eine helle Chrome-Rampe auf hellem Grund bei .17.
   Nachgesehen in `.design-audit/_news__tag__1440.png` — an der Stelle
   steht schlicht nichts.

   Jetzt ist die Schuessel ein BEGRENZTES GERAET in der Konsolenspalte:
   sie sitzt in `.rx-scope`, einem kleinen Schirm, der in BEIDEN Modi
   dunkel bleibt (Tag-Leitplanke 2: "dunkle Bloecke bleiben dunkel").
   Damit traegt die Chrome-Rampe hell auf dunkel — tags wie nachts —, und
   die CRT-Scanline hat endlich eine Flaeche, auf der man sie sieht.

   KEINE EIGENE LOGIK, KEIN "use client"
   Die gesamte Choreografie haengt an einer einzigen Klasse auf dem Deck
   (`.rx-deck.is-receiving` / `.is-locked`), die NewsConsole waehrend des
   Typewriters setzt. Frueher stand hier ein IntersectionObserver plus eine
   DOM-Bruecke aus NewsCard heraus (`getElementById("rx-array")`), also
   zwei Quellen fuer denselben Zustand. Eine reicht — und dieses Modul ist
   damit reines Server-Markup ohne eine Zeile JavaScript im Bundle.

   GEOMETRIE
   Die Schuessel ist um 14 Grad gekippt, ihre Flaechennormale zeigt damit
   auf -76 Grad (hoch, leicht nach rechts). Erreger, Suchstrahl und die drei
   Wellenfronten liegen alle auf genau dieser Achse — deshalb liest das Bild
   als "die Schuessel horcht dorthin" und nicht als drei Deko-Teile, die
   zufaellig nebeneinanderliegen. Die Boegen sind +/-35 Grad um die Achse
   geoeffnet, Radien 14/22/30 um den Erreger bei (82|35).

   KEINE TRANSFORM-ANIMATION — BEWUSST
   Auf SVG-Gruppen ist `transform` gleichzeitig Praesentationsattribut und
   CSS-Eigenschaft: sobald CSS es animiert, faellt das Attribut ersatzlos
   weg, und `transform-origin: 0 0` bedeutet je nach `transform-box` etwas
   anderes. Genau daran hing der alte Sweep (er rotierte um die Ecke des
   Bildfelds statt um den Erreger). Die Bewegung laeuft deshalb
   ausschliesslich ueber `opacity` und `stroke-width` — deterministisch in
   jedem Browser. */

export default function NewsRxArray({ caption }: { caption?: string }) {
  return (
    <figure className="rx-scope">
      <svg
        className="rx-array"
        viewBox="0 0 144 182"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/* `gradientUnits="userSpaceOnUse"` ist hier PFLICHT, nicht Geschmack.
              In der Voreinstellung (objectBoundingBox) bezieht sich der Verlauf
              auf die Bounding Box JEDES EINZELNEN Elements — und die SVG-Spec
              sagt: hat diese Box null Breite oder Hoehe, wird das Element GAR
              NICHT gezeichnet. Genau das traf den senkrechten Mast und die
              waagerechte Standflaeche: beide waren im Screenshot unsichtbar,
              die schraegen Beine standen frei in der Luft. In User-Space-
              Koordinaten laeuft eine Rampe ueber das ganze Geraet — was
              ohnehin richtiger ist, weil Chrom eine Umgebung spiegelt und
              nicht jedes Teil fuer sich. */}
          <linearGradient id="rx-chrome" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="182">
            <stop offset="0" stopColor="var(--chrome-hi)" />
            <stop offset=".55" stopColor="var(--chrome-mid)" />
            <stop offset="1" stopColor="var(--chrome-lo)" />
          </linearGradient>
        </defs>

        {/* Wellenfronten — drei Boegen um die Empfangsachse. */}
        <g className="rx-waves" transform="translate(82 35)" fill="none">
          <path className="rx-wave" d="M-5.02 -13.07 A14 14 0 0 1 10.57 -9.18" />
          <path className="rx-wave" d="M-7.88 -20.54 A22 22 0 0 1 16.61 -14.43" />
          <path className="rx-wave" d="M-10.75 -28.01 A30 30 0 0 1 22.65 -19.67" />
        </g>

        {/* Suchstrahl auf derselben Achse, 30 Einheiten lang. */}
        <line className="rx-beam" x1="82" y1="35" x2="89.3" y2="5.9" />

        <g
          className="rx-rig"
          fill="none"
          stroke="url(#rx-chrome)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <ellipse cx="72" cy="74" rx="58" ry="23" transform="rotate(14 72 74)" />
          <ellipse cx="72" cy="74" rx="32" ry="12" transform="rotate(14 72 74)" opacity=".5" />
          <path d="M72 74 L82 35" />
          <circle cx="82" cy="35" r="4.5" />
          <path d="M72 92 L72 148" />
          <path d="M52 148 H92" />
          <path d="M59 148 L53 170 M85 148 L91 170" />
        </g>
      </svg>
      {caption && <figcaption className="rx-scope-cap">{caption}</figcaption>}
    </figure>
  );
}
