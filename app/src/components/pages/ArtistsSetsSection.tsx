"use client";
/* Sets-Grid + "Random Transmission"-Knopf (research/50-pages-konzept.md:
   Tool der Artists-Seite). Wuerfelt aus allen Sets eins, scrollt zur
   passenden Setcard und hebt sie kurz hervor (Konzept-Dokument, Punkt 4).
   Die Consent-Facade selbst steckt in ArtistsSetCard — diese Komponente
   kennt nur die Liste + das Scroll/Highlight-Verhalten. */
import { useEffect, useRef, useState } from "react";
import ArtistsSetCard, { type SetCardData } from "./ArtistsSetCard";

export default function ArtistsSetsSection({
  sets,
  randomLabel,
  randomHint,
  randomEmpty,
  consentText,
}: {
  sets: SetCardData[];
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
    document.getElementById(`set-${pick.id}`)?.scrollIntoView({
      behavior: fx === "s" ? "auto" : "smooth",
      block: "center",
    });
    setHighlight(pick.id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHighlight(null), 1400);
  }

  return (
    <>
      <div className="sets-tools">
        <button type="button" className="btn btn-ghost" onClick={randomTransmission} disabled={sets.length === 0}>
          {randomLabel}
        </button>
        <span className="lu-note">{sets.length === 0 ? randomEmpty : randomHint}</span>
      </div>
      <div className="setgrid">
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
