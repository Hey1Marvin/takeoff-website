/* ============================================================
   404 — „Lost in Space"

   Es gab bisher gar keine: jeder vertippte Pfad landete auf Next.js'
   Standardseite, weiss, serifenlos, ohne Sternenhimmel — mitten in einer
   Site, deren ganzer Charakter der Raum ist. Konzept 50 §E sieht sie als
   „Lost in Space" mit treibendem Einhorn vor.

   Gestaltung: EIN Motiv (das Einhorn an der Rettungsleine, das langsam
   aus dem Bild treibt), EIN Bewegungsmoment (dieses Treiben). Drumherum
   die Mission-Log-Sprache, die die Site ohnehin spricht — keine zweite
   Idee, kein zweiter Effekt.

   Serverkomponente; nur der Text braucht Sprache, deshalb steckt er in
   einer kleinen Clientkomponente (sonst wechselt er beim Umschalten nicht
   mit, siehe AGENTS.md).
   ============================================================ */
import "@/styles/pages/not-found.css";
import NotFoundInhalt from "@/components/pages/NotFoundInhalt";

export default function NotFound() {
  return (
    <section className="section nf-sec">
      <div className="wrap nf-wrap">
        <NotFoundInhalt />
      </div>
    </section>
  );
}
