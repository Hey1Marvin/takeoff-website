/* Signatur-Motiv "Orbit" der Artist-Detailseite (research/50-pages-konzept.md):
   ein kleiner Satellit kreist langsam um den Avatar — die "eigene Umlaufbahn"
   jedes Artists. Schlicht gehalten: gestrichelter Ring (statisch, bleibt
   auch bei Tier s stehen) + ein Punkt, der ihn per CSS-Animation abfliegt
   (vom globalen Kill-Switch in takeoff.css bei Tier s/reduced-motion
   automatisch stillgelegt). Reine Praesentation — Server Component. */
export default function ArtistOrbitAvatar({
  initials,
  size = 96,
}: {
  initials: string;
  size?: number;
}) {
  return (
    <div className="aorbit" style={{ width: size, height: size }} aria-hidden="true">
      <div className="avatar" translate="no">{initials}</div>
      <div className="sat-orbit"><span className="sat-dot" /></div>
    </div>
  );
}
