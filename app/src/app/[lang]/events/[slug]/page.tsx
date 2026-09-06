import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import MediaGallery from "@/components/pages/MediaGallery";
import ArtistsSetCard from "@/components/pages/ArtistsSetCard";
import { events, event, settings, artists, fmtDate } from "@/lib/data";
import { t } from "@/lib/i18n";
import { pageHref, artistHref } from "@/lib/site";
import type { Artist, LineupSlot } from "@/lib/types";
import "@/styles/pages/event-detail.css";

/* ============================================================
   Generische Event-Detailseite — dynamisch aus der DB.

   Jedes Event (auch spaeter im Admin angelegte) bekommt automatisch
   seine Seite; besondere Event-Skins (Mars-Boden etc.) kommen ueber das
   Theme-Preset, nicht ueber eine eigene Route.

   ── Was It. 14h hier geaendert hat ─────────────────────────
   1. GESTALTUNG. Die Seite stand als einzige Event-Seite noch auf dem
      alten Vokabular: neun .eblock-Bloecke in einer 760px-Spalte, keine
      Flaeche, ein Inline-Style am Zahlen-Band. Sie folgt jetzt der
      Linie von /events (Rahmen, Hairlines, Mono-Mikrolabels, EIN
      Ausbruch aus der Spalte) — Details in event-detail.css.
   2. INHALT. Die echten Instagram-Ankuendigungen sind im Datensatz
      angekommen: Handles und Crew je Act, B2B als Beziehung statt als
      Namensbestandteil, Marktplatz, DJ-Contest (rueckblickend!),
      Hausregeln, Credits, Track-ID. Alle Abschnitte sind bedingt —
      `strandparty` hat nichts davon und zeigt deshalb auch nichts.
   3. i18n. Die Ueberschriften waren fest deutsch verdrahtet, obwohl die
      Schluessel seit langem in de.ts UND en.ts stehen. Jetzt kommt
      jedes Chrome-Wort aus t(). Inhalte (Titel, Brief, Namen, Regeln)
      bleiben Sache der Datenschicht — das Woerterbuch kennt sie
      bewusst nicht (siehe i18n/index.ts, „CMS-GRENZE").
   ============================================================ */

export async function generateStaticParams() {
  return (await events()).map(e => ({ slug: e.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const e = await event((await params).slug);
  if (!e) return {};
  return {
    title: `${e.title} · ${e.weekday} ${fmtDate(e.date)} · takeoff potsdam`,
    description: e.brief,
  };
}

const PATCH_ICONS: Record<string, React.ReactNode> = {
  star: <path d="M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9z" />,
  planet: <><circle cx="12" cy="12" r="5.2" /><path d="M4.5 14.6c2.6 1.9 12.6 1.7 15-2.5" /></>,
  umbrella: <><path d="M4 12.5a8 8 0 0 1 16 0z" /><path d="M12 4.5V3" /><path d="M12 12.5V18a2 2 0 0 0 4 .5" /></>,
  heart: <path d="M12 20s-7.2-4.6-9.2-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.2 11c-2 4.4-9.2 9-9.2 9z" />,
};

/* ============================================================
   Textwerkzeuge
   ============================================================ */

/** Instagram-Profil. Ein <a> loest keinen Request aus — deshalb steht
 *  hier ein Link und kein Widget. Der Satzpunkt hinter einem Handle
 *  gehoert nicht zum Namen. */
const igHref = (handle: string) =>
  `https://www.instagram.com/${handle.replace(/^@/, "").replace(/\.+$/, "")}/`;

/* Handles im Fliesstext („@mampe.berlin", „No Gravity Berlin ·
   @nogravityberlin") anklickbar machen. Das Muster endet bewusst auf
   einem Wortzeichen, damit ein Satzpunkt draussen bleibt. */
const HANDLE_RE = /(@[A-Za-z0-9._]*[A-Za-z0-9_])/g;
function withHandles(text: string): React.ReactNode[] {
  return text.split(HANDLE_RE).map((part, i) =>
    part.startsWith("@")
      ? <a key={i} className="ed-handle" href={igHref(part)} target="_blank" rel="noopener">{part}</a>
      : <span key={i}>{part}</span>,
  );
}

/* Der Bestand nutzt **fett** im brief-Feld (Kinder- und Jugendbudget
   Potsdam, No Gravity Berlin). Bis It. 14h standen die Sternchen
   woertlich auf der Seite. Bewusst nur diese eine Auszeichnung: mehr
   Markdown im Datenfeld waere eine Sprache, die der Contract nicht
   beschreibt. */
function richText(text: string): React.ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).map((chunk, i) =>
    i % 2 ? <b key={i}>{chunk}</b> : <span key={i}>{withHandles(chunk)}</span>,
  );
}

/** Zweistellige Blockzahl fuer die Mikro-Plakette im Blockkopf.
 *  Wortlos und damit sprachneutral. */
const count2 = (n: number) => String(n).padStart(2, "0");

/* ============================================================
   Lineup

   Bis It. 14h stand B2B im Namen („Cyonic B2B Niico") — damit war
   weder verlinkbar noch zaehlbar, wer gespielt hat. Jetzt ist es eine
   Beziehung (`b2bWith`), und beide Seiten des Paares stehen als eigene
   Acts im Datensatz. Hier werden sie wieder zu EINER Zeile.
   ============================================================ */
interface LineupEntry { key: string; slots: LineupSlot[] }

function groupLineup(lineup: LineupSlot[]): LineupEntry[] {
  const first = new Map<string, number>();
  lineup.forEach((s, i) => { if (!first.has(s.name)) first.set(s.name, i); });

  const taken = new Set<number>();
  const out: LineupEntry[] = [];
  lineup.forEach((slot, i) => {
    if (taken.has(i)) return;
    taken.add(i);
    const j = slot.b2bWith ? first.get(slot.b2bWith) : undefined;
    const partner = j !== undefined && !taken.has(j) ? lineup[j] : undefined;
    /* Nur ein GEGENSEITIGES b2bWith ist ein Paar. Zeigt nur eine Seite
       auf die andere (oder auf jemanden, der gar nicht im Lineup
       steht), bleibt es eine Zeile — sonst verschwaende ein einseitiger
       Eintrag stillschweigend einen Namen aus der Liste. */
    if (j !== undefined && partner && partner.b2bWith === slot.name) {
      taken.add(j);
      out.push({ key: `${slot.name}|${partner.name}`, slots: [slot, partner] });
    } else {
      out.push({ key: slot.name, slots: [slot] });
    }
  });

  /* Die Ueberschrift verspricht A–Z, also wird auch sortiert: der
     Bestand ist es nicht durchgaengig (Pride steht in der Reihenfolge
     der Ankuendigung). */
  return out.sort((a, b) => a.slots[0].name.localeCompare(b.slots[0].name, "de"));
}

/** Passende Artist-Seite zu einem Lineup-Slot — ueber den Handle, sonst
 *  ueber den Namen. Wer keine Seite hat, bleibt einfach Text. */
function artistFor(slot: LineupSlot, list: Artist[]): Artist | undefined {
  const handle = slot.handle?.replace(/^@/, "").toLowerCase();
  const name = slot.name.trim().toLowerCase();
  return list.find(a =>
    (handle !== undefined && a.handle?.replace(/^@/, "").toLowerCase() === handle)
    || a.name.trim().toLowerCase() === name,
  );
}

function Act({ slot, artist }: { slot: LineupSlot; artist?: Artist }) {
  return (
    <div className="ed-act">
      {artist
        ? <Link className="ed-act-name" href={artistHref(artist.slug)}>{slot.name}</Link>
        : <span className="ed-act-name">{slot.name}</span>}
      {(slot.handle || slot.crew || slot.genres || slot.time) && (
        <p className="ed-act-meta">
          {slot.handle && (
            <a className="ed-handle" href={igHref(slot.handle)} target="_blank" rel="noopener">
              {slot.handle}
            </a>
          )}
          {slot.crew && <span className="ed-tag">{slot.crew}</span>}
          {slot.genres && <span>{slot.genres}</span>}
          {slot.time && <span>{slot.time}</span>}
        </p>
      )}
      {slot.note && <p className="ed-act-note">{slot.note}</p>}
    </div>
  );
}

/** Blockkopf: Ueberschrift links, zweistellige Zahl rechts. */
function BlockHead({ title, n }: { title: string; n?: number }) {
  return (
    <div className="ed-head">
      <h3>{title}</h3>
      {n !== undefined && <span className="ed-count">{count2(n)}</span>}
    </div>
  );
}

/* Fuer Texte mit {link}-Platzhalter: t() liefert "" zurueck, wenn eine
   Variable fehlt (i18n/index.ts) — also wird ein unsichtbares Zeichen
   eingesetzt und der Satz daran geteilt. So bleibt der Satzbau in der
   Uebersetzung und der Link im JSX. */
const SPLIT = "⁣";

/* ============================================================
   Seite
   ============================================================ */
export default async function EventDetail(
  { params }: { params: Promise<{ slug: string }> }
) {
  const [e, s, allArtists] = await Promise.all([
    event((await params).slug), settings(), artists(),
  ]);
  if (!e || e.visible === false) notFound();

  const isPast = e.state === "past";
  /* Die Eventfarbe als --card-acc, wie auf der Tafel: dort entscheidet
     scene-day.css bereits, dass sie tags nur Flaeche sein darf und nie
     Schrift. Dieselbe Variable heisst dieselbe Entscheidung. */
  const acc = {
    "--card-acc": e.theme.accent,
    "--card-acc-rgb": e.theme.accentRgb,
  } as React.CSSProperties;

  const maps = e.venue.mapsQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.venue.mapsQuery)}`
    : null;

  const acts = groupLineup(e.lineup);
  const media = e.media ?? [];
  const sets = e.sets ?? [];
  const gallery = e.gallery ?? [];
  const stats = e.stats ?? [];
  const extras = e.extras ?? [];
  const market = e.market ?? [];
  const rules = e.rules ?? [];
  const credits = e.credits ?? {};
  const contest = e.contest;

  /* Credits: die vier bekannten Rollen bekommen ein uebersetztes Label,
     alles Weitere (heute: `hinweis`) ist ein Nachsatz ohne Label. */
  const creditRows = ([
    ["artwork", "event.page.credits.artwork"],
    ["foerderung", "event.page.credits.foerderung"],
    ["drinks", "event.page.credits.drinks"],
    ["kooperation", "event.page.credits.kooperation"],
  ] as const).filter(([key]) => credits[key]);
  const creditNote = credits.hinweis;
  const hasCredits = creditRows.length > 0 || Boolean(e.trackId) || Boolean(creditNote);

  const galleryNote = t("event.page.gallery.consent_note", "de", { link: SPLIT }).split(SPLIT);

  return (
    <>
      <section className="ehero" style={acc}>
        <div className="wrap">
          <div className="patch-hero" style={{ color: e.theme.accent }} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round">
              {PATCH_ICONS[e.theme.patch] ?? PATCH_ICONS.star}
            </svg>
          </div>
          {e.patchNo && <p className="ed-mission">{e.patchNo}</p>}
          <h1 className="etitle">{e.title.replace(/^takeoff:\s*/i, "").toLowerCase()}</h1>
          {e.subtitle && <p className="esub">{e.subtitle}</p>}
          <div className="facts">
            <span><b>{e.weekday} {fmtDate(e.date)}</b></span>
            {e.doors && e.doors !== "TBA" && (
              <span>{t("card.row.boarding")} <b>{e.doors}</b>{e.end ? ` · ${e.end}` : ""}</span>
            )}
            <span><b>{e.venue.name}</b>{e.venue.address ? `, ${e.venue.address}` : ""}</span>
            {e.pricing.label && <span><b>{e.pricing.label}</b></span>}
            {e.age === "18+" && <span><b>18+</b></span>}
          </div>
          {e.genres.length > 0 && (
            <div className="chips ed-hero-genres">
              {e.genres.map(g => <span className="chip" key={g}>{g}</span>)}
            </div>
          )}
          {!isPast && (
            <div className="cta-row ed-hero-cta">
              <a className="btn btn-primary" href={s.telegram} target="_blank" rel="noopener">
                {t("event.page.cta.telegram")}
              </a>
            </div>
          )}
          {isPast && (
            <p className="lu-note ed-hero-note">
              Diese Mission ist abgeschlossen. Danke an alle, die dabei waren. ♥
            </p>
          )}
        </div>
      </section>

      <section className="section ed-sec" style={acc}>
        <div className="wrap ed-wrap ed-page">

          {/* 1 · Briefing bzw. Debriefing — Fliesstext, schmale Spalte. */}
          {e.brief && (
            <div className="eblock">
              <BlockHead title={t(isPast ? "event.page.debriefing.h3" : "event.page.briefing.h3")} />
              <p>{richText(e.brief)}</p>
            </div>
          )}

          {/* 2 · Die Nacht in Zahlen. */}
          {stats.length > 0 && (
            <div className="eblock eblock--wide ed-numbers">
              <BlockHead title={t("event.page.numbers.h3")} n={stats.length} />
              <div className="ed-frame">
                <div className="stats">
                  {stats.map(st => <div key={st.l}><b>{st.n}</b><span>{st.l}</span></div>)}
                </div>
              </div>
            </div>
          )}

          {/* 3 · Lineup. Traegt 3 Namen und 17 — siehe event-detail.css §4. */}
          {acts.length > 0 && (
            <div className="eblock eblock--wide">
              <BlockHead title={t("event.page.lineup.h3_az")} n={e.lineup.length} />
              <div className="ed-frame">
                <div className="ed-list" data-cols={acts.length >= 6 ? "2" : "1"}>
                  {acts.map(entry => (
                    <div
                      key={entry.key}
                      className={`ed-item${entry.slots.length > 1 ? " ed-item--pair" : ""}`}
                    >
                      {entry.slots.length > 1 ? (
                        <div className="ed-pair">
                          <Act slot={entry.slots[0]} artist={artistFor(entry.slots[0], allArtists)} />
                          <p className="ed-b2b">{t("event.page.lineup.b2b")}</p>
                          <Act slot={entry.slots[1]} artist={artistFor(entry.slots[1], allArtists)} />
                        </div>
                      ) : (
                        <Act slot={entry.slots[0]} artist={artistFor(entry.slots[0], allArtists)} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4 · DJ-Contest. „abgelaufen" heisst Rueckblick, nicht Aufruf. */}
          {contest && (
            <div className="eblock">
              <BlockHead title={t("event.page.contest.h3")} />
              <div className="ed-frame ed-panel">
                {contest.status === "abgelaufen" && (
                  <p className="ed-badge">{t("event.page.contest.expired")}</p>
                )}
                <p className="ed-panel-title">{contest.titel}</p>
                {contest.bedingungen && (
                  <p className="ed-panel-text">{withHandles(contest.bedingungen)}</p>
                )}
                {(contest.veranstalter || contest.deadline || contest.bekanntgabe || contest.ergebnis) && (
                  <dl className="m-rows">
                    {contest.veranstalter && (
                      <div className="m-row">
                        <dt>{t("event.page.contest.by")}</dt>
                        <dd>{withHandles(contest.veranstalter)}</dd>
                      </div>
                    )}
                    {contest.deadline && (
                      <div className="m-row">
                        <dt>{t("event.page.contest.deadline")}</dt>
                        <dd>{contest.deadline}</dd>
                      </div>
                    )}
                    {contest.bekanntgabe && (
                      <div className="m-row">
                        <dt>{t("event.page.contest.announce")}</dt>
                        <dd>{contest.bekanntgabe}</dd>
                      </div>
                    )}
                    {contest.ergebnis && (
                      <div className="m-row">
                        <dt>{t("event.page.contest.result")}</dt>
                        <dd>{withHandles(contest.ergebnis)}</dd>
                      </div>
                    )}
                  </dl>
                )}
              </div>
            </div>
          )}

          {/* 5 · Marktplatz. */}
          {market.length > 0 && (
            <div className="eblock eblock--wide">
              <BlockHead title={t("event.page.market.h3")} n={market.length} />
              <div className="ed-frame">
                <div className="ed-list" data-cols={market.length >= 3 ? "2" : "1"}>
                  {market.map(m => (
                    <div className="ed-item" key={m.name}>
                      <div className="ed-stall">
                        <span className="ed-stall-name">{m.name}</span>
                        {m.handle && (
                          <a className="ed-handle" href={igHref(m.handle)} target="_blank" rel="noopener">
                            {m.handle}
                          </a>
                        )}
                        {m.beschreibung && <span className="ed-stall-text">{m.beschreibung}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="lu-note">{t("event.page.market.note")}</p>
            </div>
          )}

          {/* 6 · Videos. 32 Clips beim Mario-Kart-Rave — die Galerie
                 laedt erst beim Klick und spielt nur eins gleichzeitig. */}
          {media.length > 0 && (
            <div className="eblock eblock--wide">
              <BlockHead title={t("event.page.videos.h3")} n={media.length} />
              <MediaGallery items={media} label={`${t("event.page.videos.h3")} · ${e.title}`} />
            </div>
          )}

          {/* 7 · Sets zum Nachhoeren (Zwei-Klick-Fassade). */}
          {sets.length > 0 && (
            <div className="eblock eblock--wide">
              <BlockHead title={t("event.page.sets.h3")} n={sets.length} />
              <div className="setgrid">
                {sets.map((set, i) => (
                  <ArtistsSetCard
                    key={set.id}
                    data={{
                      id: `${e.slug}-set-${i}`, title: set.title, meta: set.meta,
                      quelle: { platform: set.platform, id: set.id, url: set.url },
                    }}
                    ariaLabel={`${t("embed.play")}: ${set.title}`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 8 · Galerie. */}
          {gallery.length > 0 && (
            <div className="eblock eblock--wide">
              <BlockHead title={t("event.page.gallery.h3")} n={gallery.length} />
              <div className="gallery-grid">
                {gallery.map(src => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} className="ed-shot" src={src} alt="" loading="lazy" />
                ))}
              </div>
              <p className="lu-note">
                {galleryNote[0]}
                <Link className="ed-link" href={pageHref("kontakt")}>{t("link.one_message")}</Link>
                {galleryNote[1]}
              </p>
            </div>
          )}

          {/* 9 · Gut zu wissen. */}
          {extras.length > 0 && (
            <div className="eblock">
              <BlockHead title={t("event.page.extras.h3")} />
              <div className="glog">
                {extras.map(x => <span className="chip" key={x}>{x}</span>)}
              </div>
            </div>
          )}

          {/* 10 · Hausregeln. */}
          {rules.length > 0 && (
            <div className="eblock">
              <BlockHead title={t("event.page.rules.h3")} n={rules.length} />
              <div className="ed-frame">
                <div className="ed-list">
                  {rules.map(r => (
                    <div className="ed-item" key={r}><p className="ed-rule">{r}</p></div>
                  ))}
                </div>
              </div>
              <p className="lu-note">{t("event.page.rules.note")}</p>
            </div>
          )}

          {/* 11 · Awareness. Steht auf jeder Event-Seite, auch bei
                  vergangenen: es ist eine Zusage, kein Programmpunkt. */}
          <div className="eblock">
            <BlockHead title={t("event.page.awareness.h3")} />
            <dl className="m-rows">
              <div className="m-row">
                <dt>{t("crew.awareness.name")}</dt>
                <dd>{t("aware.tile.team.text_event")}</dd>
              </div>
              <div className="m-row">
                <dt>{t("aware.tile.firstaid.title")}</dt>
                <dd>{t("aware.tile.sani.text_event")}</dd>
              </div>
              <div className="m-row">
                <dt>{t("aware.tile.water.title")}</dt>
                <dd>{t("aware.tile.water.text_event")}</dd>
              </div>
              <div className="m-row">
                <dt>{t("aware.tile.photo.title")}</dt>
                <dd>{t("aware.tile.photo.text_event")}</dd>
              </div>
            </dl>
            <p className="ed-principle">{t("aware.principle")}</p>
            <p className="ed-note">
              <Link className="ed-link" href={pageHref("awareness")}>
                {t("link.awareness_concept")} →
              </Link>
            </p>
          </div>

          {/* 12 · Landeplatz — nur, solange man noch hinfahren kann. */}
          {maps && !isPast && (
            <div className="eblock">
              <BlockHead title={t("event.page.maps.h3")} />
              <div className="vcard">
                <span className="vname">{e.venue.name}</span>
                {e.venue.address && <span className="vaddr">{e.venue.address}</span>}
                {e.venue.transit && <span className="vhint">{e.venue.transit}</span>}
              </div>
              <div className="route-row">
                <a className="btn btn-ghost" href={maps} target="_blank" rel="noopener">
                  {t("event.page.maps.google")}
                </a>
                <a className="btn btn-ghost" target="_blank" rel="noopener"
                  href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(e.venue.mapsQuery)}`}>
                  {t("event.page.maps.osm")}
                </a>
              </div>
              <p className="lu-note">{t("event.page.maps.note")}</p>
            </div>
          )}

          {/* 13 · Credits und Track-ID. */}
          {hasCredits && (
            <div className="eblock">
              <BlockHead title={t("event.page.credits.h3")} />
              <dl className="m-rows">
                {creditRows.map(([key, label]) => (
                  <div className="m-row" key={key}>
                    <dt>{t(label)}</dt>
                    <dd>{withHandles(credits[key])}</dd>
                  </div>
                ))}
                {e.trackId && (
                  <div className="m-row">
                    <dt>{t("event.page.trackid")}</dt>
                    <dd>{e.trackId}</dd>
                  </div>
                )}
              </dl>
              {creditNote && <p className="ed-note">{withHandles(creditNote)}</p>}
            </div>
          )}

          <div className="ed-foot">
            <Link className="back-link" href={pageHref("events")}>{t("event.page.back_all")}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
