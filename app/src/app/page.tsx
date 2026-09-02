import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import {
  settings, pageContent, upcoming, past, nextEvent, artists, team, fmtDate,
} from "@/lib/data";
import { eventHref, artistHref } from "@/lib/site";
import type { TakeoffEvent } from "@/lib/types";
import ExpandCard from "@/components/ExpandCard";
import EventsTminusClock from "@/components/pages/EventsTminusClock";
import HeroVideo from "@/components/HeroVideo";
import HomeSetCard from "@/components/pages/HomeSetCard";
import HomeSecrets from "@/components/pages/HomeSecrets";
import "@/styles/hero-video.css";
import "@/styles/pages/home.css";

/* ============================================================
   Startseite — Portierung von prototype/index.html (Z. 267–523).

   Sieben Abschnitte: Hero · Missionen · Genre-Band · Sound · Crew ·
   Stats · Awareness + Flight Log. Kein Textstück steht hier fest:
   Listen kommen aus dem Gateway (upcoming/past/artists/team/settings),
   alles Redaktionelle aus src/data/pages/home.json.
   ============================================================ */

interface HomePageContent {
  hero: {
    taglineHtml: string;
    tminusLabel: string;
    tminusAria: string;
    ctaMissionLabel: string;
    ctaTelegramLabel: string;
    scrollHint: string;
  };
  missions: {
    eyebrow: string; titleHtml: string; intro: string;
    headLinkLabel: string; headLinkHref: string;
    toggleLabel: string;
    statusLabels: { announced: string; tba: string; prep: string };
    rowLabels: { boarding: string; landing: string; entry: string; sound: string; status: string; motto: string };
    ctaMissionPage: string; ctaTelegram: string; emptyText: string;
  };
  band: { genres: string[] };
  sound: {
    eyebrow: string; titleHtml: string; intro: string;
    headLinkLabel: string; headLinkHref: string;
    genres: { label: string; hot?: boolean }[];
    maxSets: number; playAriaTemplate: string; consentNote: string;
  };
  crew: {
    eyebrow: string; titleHtml: string; intro: string;
    headLinkLabel: string; headLinkHref: string; maxItems: number;
  };
  foundedDate: string;
  stats: Record<"founded" | "missions" | "systemsBuilt" | "volunteerPercent",
    { mode: "auto" | "manual"; value?: string; label: string }>;
  awareness: {
    eyebrow: string; titleHtml: string;
    tiles: { icon: string; title: string; text: string }[];
    note: { text: string; links: { label: string; href: string }[] };
  };
  flightlog: { eyebrow: string; titleHtml: string; maxItems: number };
  secrets: { ariaLabel: string; foundTemplate: string; allFound: string; alreadyFound: string };
}

/* ---------- Icons ----------
   Alle SVGs 1:1 aus prototype/index.html. Die Schlüssel sind dieselben, die
   db.json (team[].icon) und home.json (awareness.tiles[].icon) verwenden —
   fehlt ein Schlüssel, fällt die Karte auf ihre Initialen zurück. */
const ICONS: Record<string, ReactNode> = {
  heart: <path d="M12 20s-7.2-4.6-9.2-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.2 11c-2 4.4-9.2 9-9.2 9z" />,
  cross: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8.5v7M8.5 12h7" />
    </>
  ),
  bolt: <path d="M13 3 5.5 13.5H11L9.5 21 17.5 10H12z" />,
  water: <path d="M12 3.5c3.6 4.4 5.5 7.2 5.5 10a5.5 5.5 0 0 1-11 0c0-2.8 1.9-5.6 5.5-10z" />,
  camera: (
    <>
      <path d="M8.8 6h5.4l1.6 2H20v9.4M6 8H4v10h11.5" />
      <circle cx="12" cy="13" r="2.7" />
      <path d="M3.5 3.5l17 17" />
    </>
  ),
};

/* Missions-Patch je Theme — identisch zur Events-Seite (dort aus denselben
   Karten-SVGs portiert), damit dasselbe Event überall dasselbe Abzeichen hat. */
const PATCH_ICON: Record<string, ReactNode> = {
  star: <path d="M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9z" />,
  planet: (
    <>
      <circle cx="12" cy="12" r="5.2" />
      <path d="M4.5 14.6c2.6 1.9 12.6 1.7 15-2.5" />
      <circle cx="10.2" cy="10.4" r=".8" />
      <circle cx="13.6" cy="13.2" r=".6" />
    </>
  ),
  umbrella: (
    <>
      <path d="M4 12.5a8 8 0 0 1 16 0z" />
      <path d="M12 4.5V3" />
      <path d="M12 12.5V18a2 2 0 0 0 4 .5" />
    </>
  ),
  heart: <path d="M12 20s-7.2-4.6-9.2-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.2 11c-2 4.4-9.2 9-9.2 9z" />,
};

function Icon({ name, strokeWidth = "1.6" }: { name: string; strokeWidth?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name] ?? ICONS.heart}
    </svg>
  );
}

/* Kombiniertes Datum + Einlasszeit — dieselbe Quelle wie auf der Events-Seite,
   damit Countdown und Karten nie widersprüchlich wirken. */
function doorsIso(ev: Pick<TakeoffEvent, "date" | "doors">): string {
  const doors = /^\d\d:\d\d$/.test(ev.doors || "") ? ev.doors : "00:00";
  return `${ev.date}T${doors}`;
}

/* „16–22 Uhr" / „ab 23 Uhr · open end" — im Prototyp handgeschrieben, hier
   aus doors/end erzeugt, damit eine Zeitänderung in der DB überall greift. */
function timeRange(ev: TakeoffEvent): string {
  const doors = ev.doors && ev.doors !== "TBA" ? ev.doors : "";
  if (!doors) return "";
  const short = (t: string) => t.replace(/:00$/, "");
  if (!ev.end) return `ab ${short(doors)} Uhr`;
  if (ev.end === "open end") return `ab ${short(doors)} Uhr · open end`;
  return `${short(doors)}–${short(ev.end)} Uhr`;
}

export default async function Home() {
  const [s, page, up, gone, next, arts, crew] = await Promise.all([
    settings(), pageContent<HomePageContent>("home"),
    upcoming(), past(), nextEvent(), artists(), team(),
  ]);

  /* Ohne home.json bliebe die Startseite leer — sie ist der Einstieg, das
     wäre der teuerste denkbare Fehlerfall. Deshalb kein notFound(), sondern
     eine harte Bedingung beim Rendern der redaktionellen Blöcke. */
  if (!page) throw new Error("src/data/pages/home.json fehlt oder ist unlesbar");

  const tminusTarget = next ? doorsIso(next) : null;

  /* Zahlen-Band: „auto" rechnet aus den echten Daten (Gründungsjahr,
     Anzahl geflogener Missionen), „manual" nimmt den Wert aus home.json —
     dieselbe Konvention wie auf /kollektiv. */
  const statCells = [
    { value: page.stats.founded.mode === "auto" ? page.foundedDate.slice(0, 4) : page.stats.founded.value, label: page.stats.founded.label },
    { value: page.stats.missions.mode === "auto" ? String(gone.length).padStart(2, "0") : page.stats.missions.value, label: page.stats.missions.label },
    { value: page.stats.systemsBuilt.value, label: page.stats.systemsBuilt.label },
    { value: page.stats.volunteerPercent.value, label: page.stats.volunteerPercent.label },
  ];

  /* Sets liegen an den Artists (artists[].sets) — die Startseite zeigt einen
     Auszug, /artists zeigt alle. */
  const sets = arts
    .flatMap(a => (a.sets ?? []).map(set => ({ ...set, artist: a.name })))
    .slice(0, page.sound.maxSets);

  const artistSlugs = new Set(arts.map(a => a.slug));
  const crewCards = crew.slice(0, page.crew.maxItems);
  const flog = gone.slice(0, page.flightlog.maxItems);

  return (
    <>
      {/* ============ HERO ============ */}
      <section className="hero">
        {/* Der Container bleibt im Markup leer: HeroVideo hängt das <video>
            erst zur Laufzeit ein und nur, wenn es erlaubt ist. Ohne
            JavaScript wird dadurch keine einzige Videodatei angefordert. */}
        <HeroVideo />
        <div className="hero-inner">
          <p className="pretitle">{s.claim}</p>
          <div className="hero-mark"><h1 className="wordmark" translate="no">takeoff</h1></div>
          <p className="tagline" dangerouslySetInnerHTML={{ __html: page.hero.taglineHtml }} />

          <div className="tminus" role="timer" aria-label={page.hero.tminusAria}>
            <span className="label">{page.hero.tminusLabel}</span>
            <EventsTminusClock targetIso={tminusTarget} />
          </div>

          {next && (
            <article className="next-card">
              <div className="nc-date">
                {next.weekday} <em>{fmtDate(next.date)}</em>
                {timeRange(next) ? ` · ${timeRange(next)}` : ""}
              </div>
              <h2>{next.title}</h2>
              <p className="nc-meta">
                {next.venue.name}{next.venue.address ? `, ${next.venue.address}` : ""}
                {next.subtitle ? ` · ${next.subtitle}` : ""}
              </p>
              <div className="chips">
                {next.pricing.label && <span className="chip hot">{next.pricing.label}</span>}
                {next.genres.map(g => <span className="chip" key={g} translate="no">{g}</span>)}
              </div>
              <div className="cta-row">
                <Link className="btn btn-primary" href={eventHref(next.slug)}>
                  {page.hero.ctaMissionLabel}
                </Link>
                <a className="btn btn-ghost" href={s.telegram} target="_blank" rel="noopener">
                  {page.hero.ctaTelegramLabel}
                </a>
              </div>
            </article>
          )}
        </div>
        <div className="scroll-hint" aria-hidden="true">{page.hero.scrollHint}</div>
      </section>

      {/* ============ MISSIONEN ============
          `hm-sec` ist der Namensraum-Marker der Startseite: home.css haengt
          seine Korrekturen (Kopf-Platten, Flight-Log, Reveal-Staffel) daran,
          damit nichts davon auf fremde Seiten durchschlaegt — die ids
          (#crew, #flightlog) existieren auch auf /team und /events. */}
      <section className="section missions hm-sec" id="missionen">
        {/* Theme-Deko: sichtbar ist immer nur das Item des aktiven Themes
            (takeoff.css), erst ab 1200px Breite. */}
        <span className="ditem d-space big" data-spd="-70" style={{ "--top": "10%", "--left": "2.5vw" } as React.CSSProperties} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9.2" y="9.2" width="5.6" height="5.6" rx="1" transform="rotate(45 12 12)" />
            <path d="M2.5 8.5l4.5 2M17 13.5l4.5 2M4.5 4.5l3.2 3.2M16.3 16.3l3.2 3.2" />
            <rect x="1.5" y="5.5" width="5" height="3" rx=".8" transform="rotate(24 4 7)" />
            <rect x="17.5" y="15.5" width="5" height="3" rx=".8" transform="rotate(24 20 17)" />
          </svg>
        </span>
        <span className="ditem d-mars big" data-spd="-60" style={{ "--top": "12%", "--left": "2.5vw" } as React.CSSProperties} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
            <circle cx="12" cy="12" r="5.2" />
            <path d="M3.5 14.8c2.8 2.1 14.2 1.9 17-2.8" />
            <circle cx="10" cy="10.3" r=".8" />
            <circle cx="13.6" cy="13.4" r=".6" />
          </svg>
        </span>
        <span className="ditem d-strand big" data-spd="-60" style={{ "--top": "12%", "--left": "2.5vw" } as React.CSSProperties} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 5h14l-7 8z" />
            <path d="M12 13v6M8.5 21h7M14.5 5l2.5-2.5" />
            <circle cx="17.8" cy="1.8" r="1.1" />
          </svg>
        </span>

        <div className="wrap">
          <header className="section-head reveal">
            <p className="eyebrow">{page.missions.eyebrow}</p>
            <h2 className="h2" dangerouslySetInnerHTML={{ __html: page.missions.titleHtml }} />
            <p className="section-intro">{page.missions.intro}</p>
            <Link className="head-link" href={page.missions.headLinkHref}>{page.missions.headLinkLabel}</Link>
          </header>

          {up.length === 0 ? (
            <p className="section-intro">{page.missions.emptyText}</p>
          ) : (
            <div className="card-grid">
              {up.map(e => {
                const tba = e.state === "tba";
                const rows = page.missions.rowLabels;
                return (
                  <ExpandCard
                    key={e.slug}
                    toggleLabel={page.missions.toggleLabel}
                    style={{ "--card-acc": e.theme.accent, "--card-acc-rgb": e.theme.accentRgb } as React.CSSProperties}
                    more={
                      <>
                        <dl className="m-rows">
                          {tba ? (
                            <>
                              <div className="m-row"><dt>{rows.status}</dt><dd><b>{page.missions.statusLabels.prep}</b></dd></div>
                              <div className="m-row"><dt>{rows.landing}</dt><dd><b translate="no">{e.venue.name}</b>{e.venue.address ? <>, {e.venue.address}</> : null}</dd></div>
                              <div className="m-row"><dt>{rows.motto}</dt><dd>{e.subtitle || e.title}</dd></div>
                            </>
                          ) : (
                            <>
                              <div className="m-row"><dt>{rows.boarding}</dt><dd><b>{e.doors}</b>{e.end ? (e.end === "open end" ? " · open end" : ` · Ende ${e.end}`) : ""}</dd></div>
                              <div className="m-row"><dt>{rows.landing}</dt><dd><b translate="no">{e.venue.name}</b><br />{e.venue.transit || e.venue.address}</dd></div>
                              <div className="m-row"><dt>{rows.entry}</dt><dd><b>{e.pricing.label}</b>{e.age === "18+" ? " · 18+" : ""}</dd></div>
                            </>
                          )}
                          {e.genres.length > 0 && (
                            <div className="m-row"><dt>{rows.sound}</dt><dd translate="no">{e.genres.join(" · ")}</dd></div>
                          )}
                        </dl>
                        <p className="m-brief">{e.brief}</p>
                        <div className="cta-row">
                          <Link className="btn btn-primary" href={eventHref(e.slug)}>{page.missions.ctaMissionPage}</Link>
                          <a className="btn btn-ghost" href={s.telegram} target="_blank" rel="noopener">{page.missions.ctaTelegram}</a>
                        </div>
                      </>
                    }
                  >
                    <span className="status">
                      {tba ? page.missions.statusLabels.tba : page.missions.statusLabels.announced}
                    </span>
                    <div className="patch" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        {PATCH_ICON[e.theme.patch] ?? PATCH_ICON.star}
                      </svg>
                    </div>
                    <div className="m-date">{e.weekday} <em>{fmtDate(e.date)}</em></div>
                    <h3>{e.title}</h3>
                    <p className="m-meta">
                      {[e.venue.name, timeRange(e), e.pricing.label].filter(Boolean).join(" · ")}
                      {e.subtitle ? <><br />{e.subtitle}</> : null}
                    </p>
                  </ExpandCard>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ============ Chrome-Genre-Band ============
          Zweimal dieselbe Folge: die Marquee-Animation schiebt den Track um
          -50% — die zweite Hälfte tritt dabei nahtlos an die Stelle der ersten. */}
      <div className="band" aria-hidden="true">
        <div className="band-track">
          {[0, 1].map(pass => page.band.genres.map(g => (
            <Fragment key={`${pass}-${g}`}>
              <span translate="no">{g}</span>
              <span className="sep">✦</span>
            </Fragment>
          )))}
        </div>
      </div>

      {/* ============ SOUND ============ */}
      <section className="section hm-sec" id="sound">
        <span className="ditem d-space" data-spd="-40" style={{ "--top": "22%", "--left": "auto", "--right": "2vw" } as React.CSSProperties} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
            <path d="M7 5.5l3-1.5 2.5 1 .5 3-2.5 2-3-.8z" />
            <path d="M15.5 12.5l2-1 2 .8.3 2.4-1.8 1.4-2.3-.6z" />
            <path d="M5.5 15.5l1.4-.7 1.5.6.2 1.7-1.3 1-1.6-.4z" />
          </svg>
        </span>
        <span className="ditem d-mars" data-spd="-85" style={{ "--top": "20%", "--left": "auto", "--right": "2vw" } as React.CSSProperties} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <circle cx="7.5" cy="16.5" r="3" />
            <path d="M10 14 21 3M13.5 14.5 21 7M10.5 10.5 17 4" />
          </svg>
        </span>
        <span className="ditem d-strand" data-spd="-85" style={{ "--top": "20%", "--left": "auto", "--right": "2vw" } as React.CSSProperties} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 3.5c-3 2.4-3 14.6 0 17M12 3.5c3 2.4 3 14.6 0 17M3.8 9.5c4.8-2 11.6-2 16.4 0M3.8 14.5c4.8 2 11.6 2 16.4 0" />
          </svg>
        </span>

        <div className="wrap">
          <header className="section-head reveal">
            <p className="eyebrow">{page.sound.eyebrow}</p>
            <h2 className="h2" dangerouslySetInnerHTML={{ __html: page.sound.titleHtml }} />
            <p className="section-intro">{page.sound.intro}</p>
            <Link className="head-link" href={page.sound.headLinkHref}>{page.sound.headLinkLabel}</Link>
          </header>

          <div className="genres reveal">
            {page.sound.genres.map(g => (
              <span className={`chip${g.hot ? " hot" : ""}`} key={g.label} translate="no">{g.label}</span>
            ))}
          </div>

          <div className="setgrid">
            {sets.map(set => (
              <HomeSetCard
                key={`${set.artist}-${set.title}`}
                title={set.title}
                meta={set.meta}
                consentNote={page.sound.consentNote}
                ariaLabel={page.sound.playAriaTemplate.replace("{title}", set.title)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ============ CREW ============ */}
      <section className="section hm-sec" id="crew">
        <div className="wrap">
          <header className="section-head reveal">
            <p className="eyebrow">{page.crew.eyebrow}</p>
            <h2 className="h2" dangerouslySetInnerHTML={{ __html: page.crew.titleHtml }} />
            <p className="section-intro">{page.crew.intro}</p>
            <Link className="head-link" href={page.crew.headLinkHref}>{page.crew.headLinkLabel}</Link>
          </header>
          <div className="crewgrid">
            {crewCards.map(m => {
              const inner = (
                <>
                  <div className="avatar">
                    {m.icon ? <Icon name={m.icon} /> : <span translate="no">{m.initials}</span>}
                  </div>
                  <b>{m.name}</b>
                  <span>{m.role}</span>
                </>
              );
              /* Wer ein Artist-Profil hat, bekommt hier den Weg dorthin —
                 die übrigen Crew-Karten bleiben reine Karten. */
              return artistSlugs.has(m.slug)
                ? <Link className="ccard" href={artistHref(m.slug)} key={m.slug}>{inner}</Link>
                : <div className="ccard" key={m.slug}>{inner}</div>;
            })}
          </div>
        </div>
      </section>

      {/* ============ Stats-Band ============
          <section> statt <div>, fensterbreit: im Tagmodus malt JEDES direkte
          Kind von <main> seine eigene helle Spalte (scene-day.css). Ein nur
          1120px breites Kind laesst links und rechts den schwarzen
          Seitengrund stehen — ein dunkler Riegel quer ueber die helle Seite.
          Nachgemessen und auf /team und /kalender genauso korrigiert. */}
      <section className="stats-band">
        <div className="wrap">
          <div className="stats reveal">
            {statCells.map(c => (
              <div key={c.label}><b>{c.value}</b><span>{c.label}</span></div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ AWARENESS ============ */}
      <section className="section hm-sec" id="awareness">
        <div className="wrap">
          <div className="aware reveal">
            <p className="eyebrow">{page.awareness.eyebrow}</p>
            <h2 className="h2" dangerouslySetInnerHTML={{ __html: page.awareness.titleHtml }} />
            <div className="aware-grid">
              {page.awareness.tiles.map(t => (
                <div className="atile" key={t.title}>
                  <span className="ico"><Icon name={t.icon} /></span>
                  <b>{t.title}</b>{t.text}
                </div>
              ))}
            </div>
            <p className="note">
              {page.awareness.note.text}{" "}
              {page.awareness.note.links.map((l, i) => (
                <span key={l.href}>
                  {i > 0 ? " · " : ""}
                  <Link href={l.href}>{l.label}</Link>
                </span>
              ))}
            </p>
          </div>
        </div>
      </section>

      {/* ============ FLIGHT LOG ============ */}
      <section className="section hm-sec" id="flightlog">
        <HomeSecrets
          ariaLabel={page.secrets.ariaLabel}
          foundTemplate={page.secrets.foundTemplate}
          allFound={page.secrets.allFound}
          alreadyFound={page.secrets.alreadyFound}
        />
        <div className="wrap">
          <header className="section-head reveal">
            <p className="eyebrow">{page.flightlog.eyebrow}</p>
            <h2 className="h2" dangerouslySetInnerHTML={{ __html: page.flightlog.titleHtml }} />
          </header>
          {/* `home-flog`: die Startseiten-Fassung des Logs. Nachts ersetzt
              home.css die grossflaechige Traegerplatte aus scene-night.css
              durch enge Textleisten — dafuer braucht jeder Textlauf eine
              eigene Inline-Ebene (.txplate). Die Ebene sitzt IN den
              Flex-Kindern, nicht auf ihnen: Flex-Items werden blockifiziert,
              erst der innere Span ist echtes Inline und kann mit
              box-decoration-break am Zeilenumbruch mitlaufen.
              `reveal` auf den Zeilen aktiviert die Stagger-Mechanik, die
              SceneReveals fuer .flog-Container bereits mitbringt. */}
          <ul className="flog home-flog">
            {flog.map(e => (
              <li key={e.slug} className="reveal">
                <span className="fpatch" aria-hidden="true">{e.patchNo ?? "M?"}</span>
                <span className="fdate"><span className="txplate">{fmtDate(e.date)}</span></span>
                <span className="fname"><Link className="txplate" href={eventHref(e.slug)}>{e.title}</Link></span>
                <span className="fvenue"><span className="txplate">{e.venue.name}</span></span>
                {e.brief && <span className="fnote"><span className="txplate">{e.brief}</span></span>}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
