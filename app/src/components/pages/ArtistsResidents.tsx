"use client";
/* Residents dynamisch aus TakeoffData.artists() (statt hartkodierter
   Karten) — neue Artists (z. B. Blaulicht) erscheinen automatisch, ohne
   Markup-Aenderung. Dazu ein Genre-Filter als Chip-Toggle-Leiste (Muster:
   Mission-Control-Buttons, aria-pressed traegt den Zustand). Aufklapp-
   Verhalten der Karten kommt unveraendert aus dem geteilten ExpandCard
   (Muster-Portierung des data-expand-Bausteins). */
import { useMemo, useState } from "react";
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
        <div className="genre-filter" role="group" aria-label={filterAria}>
          <button
            type="button"
            className={`chip${selected === ALL ? " hot" : ""}`}
            aria-pressed={selected === ALL}
            onClick={() => setSelected(ALL)}
          >
            {allLabel}
          </button>
          {tokens.map(tok => (
            <button
              key={tok}
              type="button"
              className={`chip${selected === tok ? " hot" : ""}`}
              aria-pressed={selected === tok}
              onClick={() => setSelected(tok)}
            >
              {tok}
            </button>
          ))}
        </div>
      )}
      <div className="card-grid">
        {visible.map(a => (
          <ExpandCard
            key={a.slug}
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
            <span className="eq-bars" aria-hidden="true"><span /><span /><span /><span /></span>
            <div className="avatar" aria-hidden="true" translate="no">{a.initials}</div>
            <h3 translate="no">{a.name}</h3>
            <p className="m-meta" translate="no">{a.genres}</p>
          </ExpandCard>
        ))}
      </div>
    </>
  );
}
