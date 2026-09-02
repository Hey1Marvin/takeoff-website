/* Signatur-Motiv "Orbit" der Artist-Detailseite (research/50-pages-konzept.md):
   ein kleiner Satellit kreist langsam um den Avatar — die "eigene Umlaufbahn"
   jedes Artists. Das ist der EINE Bewegungsmoment dieser Seite; sonst bewegt
   sich hier nichts von selbst.

   Aufbau: zwei ruhige Bahnen (die innere gestrichelt, die aeussere ein
   Haarstrich) und darauf ein Punkt mit kurzer Schweifspur. Die Spur ist ein
   `conic-gradient` auf dem rotierenden Element — sie kostet kein zweites
   Animations-Objekt und zeigt die Richtung, in die der Satellit laeuft.

   Groesse kommt aus artists.css (frueher ein Inline-Style mit Pixelwert).
   Bei data-fx="s" und `prefers-reduced-motion` legt der globale Kill-Switch
   in takeoff.css die Rotation still — die Bahnen bleiben stehen, das Bild
   bleibt vollstaendig. Reine Praesentation, Server Component. */
export default function ArtistOrbitAvatar({ initials }: { initials: string }) {
  return (
    <div className="ar-orbit" aria-hidden="true">
      <span className="ar-orbit-path" />
      <span className="ar-orbit-path is-outer" />
      <span className="ar-orbit-sat">
        <span className="ar-orbit-dot" />
      </span>
      <span className="ar-orbit-face" translate="no">{initials}</span>
    </div>
  );
}
