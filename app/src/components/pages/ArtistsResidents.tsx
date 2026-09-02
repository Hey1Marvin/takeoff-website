"use client";
/* Residents dynamisch aus TakeoffData.artists() (statt hartkodierter
   Karten) — neue Artists (z. B. Blaulicht) erscheinen automatisch, ohne
   Markup-Aenderung. Dazu ein Genre-Filter als Chip-Toggle-Leiste (Muster:
   Mission-Control-Buttons, aria-pressed traegt den Zustand). Aufklapp-
   Verhalten der Karten kommt unveraendert aus dem geteilten ExpandCard
   (Muster-Portierung des data-expand-Bausteins).

   IT. 14 — zwei Aenderungen am Markup:

   1. DER MINI-EQ IST JETZT TEIL DER KARTE, nicht mehr ein absolut
      positioniertes Abziehbild in der Ecke. Vorher: vier 3px-Balken auf
      30 % Hoehe bei opacity .5 oben rechts, `position: absolute; z-index: 1`
      — und zwar OHNE dass artists.css die Karte selbst als positioniert
      erklaerte; es funktionierte nur, weil takeoff.css `.mcard` zufaellig
      `position: relative` gibt. Auf dem Screenshot liest sich das Ergebnis
      als vier Punkte. Jetzt sitzt der EQ im Fluss auf der Fusslinie der
      Karte: in Ruhe ein flacher Kamm (Teil des Kartenrahmens), auf Zeigen
      oder Tastaturfokus steigt er zum Spektrum auf. Das ist der eine
      Bewegungsmoment dieser Seite — nutzergetrieben, nichts laeuft von
      selbst.

   2. Kopf der Karte ist eine Zeile (Avatar links, Name/Genres daneben)
      statt zentrierter Avatar ueber linksbuendigem Text. Die Karte hat
      damit EINE linke Kante.

   Die `.reveal`-Klasse ist raus: Reveal-Streusel auf jedem Block ist der
   generische Default — und im Audit-Screenshot war die Filterleiste
   deswegen sogar unsichtbar.

   Veredelung (unveraendert): der Genre-Wechsel laeuft, wo verfuegbar, durch
   die native View Transitions API (document.startViewTransition) statt hart
   umzuschalten. Strikt FX-Tier/reduced-motion-gated in JS, weil der globale
   CSS-Kill-Switch (takeoff.css, `:root[data-fx="s"] *`) die
   ::view-transition-*-Pseudobaum-Elemente nicht erreicht (kein Nachfahre im
   normalen Dokumentbaum). React 19 batcht setState normalerweise ueber den
   naechsten Tick hinweg — ohne flushSync waere die DOM-Aenderung beim
   Snapshot des Browsers noch nicht passiert und die Transition liefe leer. */
import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import ExpandCard from "@/components/ExpandCard";
import { artistHref } from "@/lib/site";

export interface ResidentVM {
  slug: string;
  initials: string;
  name: string;
  role: string;
  genres: string;
  since?: string;
  bio: string;
  listenTitle?: string;
  historyRow?: { label: string; title: string; dateLabel: string };
}

const ALL = "__all__";

/* 14 Baender — genug, dass der Kamm als Spektrum liest, wenig genug, dass
   die Balken auf 320px Kartenbreite noch je 2px breit sind. */
const EQ_BARS = 14;

function genreTokens(genres: string): string[] {
  return genres.split("·").map(g => g.trim()).filter(Boolean);
}

export default function ArtistsResidents({
  artists,
  soundcloud,
  allLabel,
  filterAria,
}: {
  artists: ResidentVM[];
  soundcloud: string;
  allLabel: string;
  filterAria: string;
}) {
  const [selected, setSelected] = useState(ALL);

  function selectGenre(next: string) {
    const fx = document.documentElement.dataset.fx ?? "m";
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (fx === "s" || reduced || !document.startViewTransition) {
      setSelected(next);
      return;
    }
    const transition = document.startViewTransition(() => flushSync(() => setSelected(next)));
    /* .ready lehnt ab, wenn ein schnellerer Klick eine laufende Transition
       ueberholt (realistischer Fall bei mehreren Chips hintereinander) —
       ohne Catch waere das ein "Uncaught (in promise)" in der Konsole. */
    transition.ready.catch(() => {});
  }

  const tokens = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const a of artists) {
      for (const g of genreTokens(a.genres)) {
        if (!seen.has(g)) { seen.add(g); out.push(g); }
      }
    }
    return out;
  }, [artists]);

  const visible = selected === ALL ? artists : artists.filter(a => genreTokens(a.genres).includes(selected));

  return (
    <>
      {tokens.length > 1 && (
        <div className="ar-filter" role="group" aria-label={filterAria}>
          <button
            type="button"
            className={`chip${selected === ALL ? " hot" : ""}`}
            aria-pressed={selected === ALL}
            onClick={() => selectGenre(ALL)}
          >
            {allLabel}
          </button>
          {tokens.map(tok => (
            <button
              key={tok}
              type="button"
              className={`chip${selected === tok ? " hot" : ""}`}
              aria-pressed={selected === tok}
              onClick={() => selectGenre(tok)}
            >
              {tok}
            </button>
          ))}
        </div>
      )}
      <div className="card-grid ar-grid">
        {visible.map(a => (
          <ExpandCard
            key={a.slug}
            className="ar-card"
            toggleLabel="Profil"
            more={
              <>
                <dl className="m-rows">
                  <div className="m-row">
                    <dt>Rolle</dt>
                    <dd><b>{a.role}</b>{a.since && !/seit/i.test(a.role) ? ` · seit ${a.since}` : ""}</dd>
                  </div>
                  {a.historyRow && (
                    <div className="m-row">
                      <dt>{a.historyRow.label}</dt>
                      <dd>{a.historyRow.title} · {a.historyRow.dateLabel}</dd>
                    </div>
                  )}
                  {a.listenTitle && (
                    <div className="m-row">
                      <dt>Hören</dt>
                      <dd>{a.listenTitle}</dd>
                    </div>
                  )}
                </dl>
                <p className="m-brief">{a.bio}</p>
                <div className="cta-row">
                  <Link className="btn btn-primary" href={artistHref(a.slug)}>Zum Profil</Link>
                  <a className="btn btn-ghost" href={soundcloud} target="_blank" rel="noopener">SoundCloud ↗</a>
                </div>
              </>
            }
          >
            <div className="ar-card-top">
              <span className="ar-card-face" aria-hidden="true" translate="no">{a.initials}</span>
              <div className="ar-card-id">
                <h3 translate="no">{a.name}</h3>
                <p className="m-meta" translate="no">{a.genres}</p>
              </div>
            </div>
            <span className="ar-eq" aria-hidden="true">
              {Array.from({ length: EQ_BARS }, (_, i) => <i key={i} />)}
            </span>
          </ExpandCard>
        ))}
      </div>
    </>
  );
}
