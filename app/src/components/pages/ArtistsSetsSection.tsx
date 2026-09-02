"use client";
/* Sets-Grid + "Random Transmission"-Knopf (research/50-pages-konzept.md:
   Tool der Artists-Seite). Wuerfelt aus allen Sets eins, scrollt zur
   passenden Setcard und hebt sie kurz hervor.

   IT. 14: Der Knopf steht jetzt in der Kopfleiste der Sektion, an der
   rechten Satzkante — vorher stand er als eigene Zeile linksbuendig unter
   der Ueberschrift, in einer Seite, deren Hauptproblem genau diese
   linksbuendige Schmalspalte war. Deshalb rendert diese Komponente die
   Kopfleiste gleich mit: das Werkzeug gehoert optisch in den Kopf, der Kopf
   ist aber Markup der Seite. ArtistsSectionHead ist absichtlich ohne
   "use client" gebaut und laesst sich von hier wie von der Serverseite
   verwenden.

   Die Consent-Facade selbst steckt unveraendert in ArtistsSetCard — diese
   Komponente kennt nur die Liste, den Kopf und das Scroll/Highlight-
   Verhalten. */
import { useEffect, useRef, useState } from "react";
import ArtistsSetCard, { type SetCardData } from "./ArtistsSetCard";
import ArtistsSectionHead from "./ArtistsSectionHead";

export default function ArtistsSetsSection({
  sets,
  eyebrow,
  title,
  titleGlow,
  note,
  randomLabel,
  randomHint,
  randomEmpty,
  consentText,
}: {
  sets: SetCardData[];
  eyebrow: string;
  title: string;
  titleGlow?: string;
  note?: string;
  randomLabel: string;
  randomHint: string;
  randomEmpty: string;
  consentText: string;
}) {
  const [highlight, setHighlight] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function randomTransmission() {
    if (sets.length === 0) return;
    const pick = sets[Math.floor(Math.random() * sets.length)];
    const fx = document.documentElement.dataset.fx ?? "m";
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`set-${pick.id}`)?.scrollIntoView({
      behavior: fx === "s" || reduced ? "auto" : "smooth",
      block: "center",
    });
    setHighlight(pick.id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHighlight(null), 1600);
  }

  return (
    <>
      <ArtistsSectionHead eyebrow={eyebrow} title={title} glow={titleGlow} note={note}>
        <div className="ar-tool">
          <button
            type="button"
            className="btn btn-ghost ar-random"
            onClick={randomTransmission}
            disabled={sets.length === 0}
          >
            {randomLabel}
          </button>
          <p className="ar-tool-note txfit">{sets.length === 0 ? randomEmpty : randomHint}</p>
        </div>
      </ArtistsSectionHead>
      <div className="setgrid ar-setgrid">
        {sets.map(s => (
          <ArtistsSetCard
            key={s.id}
            data={s}
            highlighted={highlight === s.id}
            consentText={consentText}
            ariaLabel={`Set abspielen: ${s.title}`}
          />
        ))}
      </div>
    </>
  );
}
