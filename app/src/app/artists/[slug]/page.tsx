import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { artists, artist, event, settings, pageContent, fmtDate } from "@/lib/data";
import type { TakeoffEvent } from "@/lib/types";
import ArtistOrbitAvatar from "@/components/pages/ArtistOrbitAvatar";
import ArtistBpmBand, { type BpmConfig } from "@/components/pages/ArtistBpmBand";
import ArtistsSectionHead from "@/components/pages/ArtistsSectionHead";
import ArtistsSetCard from "@/components/pages/ArtistsSetCard";
import MediaGallery from "@/components/pages/MediaGallery";
import "@/styles/pages/artists.css";
import { pageHref } from "@/lib/site";

/* Generische Artist-Detailseite — dynamisch aus der DB, Vorbild:
   events/[slug]/page.tsx. Auftritte ergeben sich aus appearances (Event-
   Slugs) per event()-Lookup, nicht aus eigener Pflege (Contract-Kommentar
   in artist.json).

   IT. 14 — was sich gestalterisch geaendert hat:
   · Der Kopf ist ein Datenblatt-Spread: links Identitaet (Orbit, Name,
     Bio), rechts das Frequenzband des Genres und die Eckdaten. Vorher war
     die ganze Seite eine 760px-Spalte am linken Rand.
   · Das Frequenzband ist neu (Konzept 50 §E, bisher nicht gebaut).
   · Die Ueberschriften stehen in src/data/pages/artists.json statt als
     deutscher Text im JSX.
   · Sets- und Video-Raster sind nicht mehr auf 520px gedeckelt, sondern
     stehen als Spread nebeneinander und fuellen die Satzbreite.
   · Alle Inline-Abstaende (marginTop: 8/18, paddingTop-Varianten) sind
     raus — Rhythmus kommt aus --sp-* in artists.css.
   · Der Zurueck-Link steht jetzt am Fuss (UX-Regel aus Konzept 50). */

export async function generateStaticParams() {
  return (await artists()).map(a => ({ slug: a.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const a = await artist((await params).slug);
  if (!a) return {};
  return {
    title: `${a.name} · Artist · takeoff potsdam`,
    description: `${a.name} — ${a.genres}${a.role ? ` · ${a.role}` : ""} bei takeoff.`,
  };
}

interface DetailContent {
  eyebrow: string;
  roleLabel: string;
  sinceLabel: string;
  debutLabel: string;
  socialsLabel: string;
  socialsValue: string;
  mediaEyebrow: string;
  mediaTitle: string;
  mediaTitleGlow: string;
  mediaCountLabel: string;
  setsEyebrow: string;
  setsTitle: string;
  setsCountLabel: string;
  logEyebrow: string;
  logTitle: string;
  logTitleGlow: string;
  logCountLabel: string;
  backLabel: string;
  consentText: string;
}

interface ArtistsContent {
  detail: DetailContent;
  frequenzband: BpmConfig;
}

/* Sicherheitsnetz, falls artists.json fehlt — gleiche Werte wie dort. */
const DEFAULT: ArtistsContent = {
  detail: {
    eyebrow: "Artist",
    roleLabel: "Rolle",
    sinceLabel: "seit",
    debutLabel: "Debüt",
    socialsLabel: "Socials",
    socialsValue: "SoundCloud ↗",
    mediaEyebrow: "Bewegtbild",
    mediaTitle: "Vor dem",
    mediaTitleGlow: "Pult",
    mediaCountLabel: "Clips",
    setsEyebrow: "Hören",
    setsTitle: "Sets",
    setsCountLabel: "Aufzeichnungen",
    logEyebrow: "Flight Log",
    logTitle: "Bei takeoff",
    logTitleGlow: "gespielt",
    logCountLabel: "Nächte",
    backLabel: "← Alle Artists",
    consentText: "Demo: Hier würde jetzt der Player laden (Zwei-Klick, DSGVO-freundlich). Kein Klick = kein Tracking.",
  },
  frequenzband: {
    label: "Frequenzband",
    unit: "BPM",
    min: 135,
    max: 153,
    ticks: [138, 145, 150],
    spread: 2.5,
    otherLabel: "ohne festes Tempo",
    genres: [
      { match: "Trance", bpm: 138 },
      { match: "Hard Trance", bpm: 145 },
      { match: "Bounce", bpm: 150 },
      { match: "Hard Bounce", bpm: 150 },
    ],
  },
};

const readout = (n: number, label: string) => `${String(n).padStart(2, "0")} ${label}`;

export default async function ArtistDetail(
  { params }: { params: Promise<{ slug: string }> }
) {
  const [a, s, contentRaw] = await Promise.all([
    artist((await params).slug),
    settings(),
    pageContent<ArtistsContent>("artists"),
  ]);
  if (!a || a.visible === false) notFound();

  const t = contentRaw?.detail ?? DEFAULT.detail;
  const bpm = contentRaw?.frequenzband ?? DEFAULT.frequenzband;

  /* Auftritte NICHT am Artist gepflegt, sondern ueber die appearances-Liste
     (Event-Slugs) live aus den Events aufgeloest — verstecktes Event bleibt
     trotz Referenz unsichtbar (gleiches Sichtbarkeits-Prinzip wie ueberall). */
  const apps = (await Promise.all(a.appearances.map(slug => event(slug))))
    .filter((e): e is TakeoffEvent => !!e && e.visible !== false)
    .sort((x, y) => y.date.localeCompare(x.date)); // neueste zuerst, wie das Flight Log

  const debut = apps.length > 0 ? apps[apps.length - 1] : null;
  const media = a.media ?? [];
  const hasMedia = media.length > 0;
  const hasSets = a.sets.length > 0;

  return (
    <>
      <section className="phero ar-sec ar-sec--hero">
        <div className="wrap ar-dhero">
          <div className="ar-dmain">
            <div className="ar-ident">
              <ArtistOrbitAvatar initials={a.initials} />
              <div className="ar-ident-text">
                <p className="eyebrow">{t.eyebrow}</p>
                <h1 className="txplate" translate="no">{a.name}</h1>
                <div className="ar-lead">
                  <p className="txplate" translate="no">
                    {a.genres}{a.role ? ` · ${a.role}` : ""}
                  </p>
                </div>
              </div>
            </div>
            <div className="ar-bio"><p className="txplate">{a.bio}</p></div>
          </div>

          <aside className="ar-dside">
            <ArtistBpmBand genres={a.genres} config={bpm} />
            <dl className="m-rows">
              <div className="m-row">
                <dt>{t.roleLabel}</dt>
                <dd>
                  <b>{a.role}</b>
                  {a.since && !/seit/i.test(a.role) ? ` · ${t.sinceLabel} ${a.since}` : ""}
                </dd>
              </div>
              {debut && (
                <div className="m-row">
                  <dt>{t.debutLabel}</dt>
                  <dd>{debut.title} · {fmtDate(debut.date)}</dd>
                </div>
              )}
              <div className="m-row">
                <dt>{t.socialsLabel}</dt>
                <dd>
                  <a className="ar-extlink" href={s.soundcloud} target="_blank" rel="noopener">
                    {t.socialsValue}
                  </a>
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      {/* Sehen und Hoeren stehen nebeneinander: zwei schmale Raster fuellen
          die Satzbreite besser als eines, das links klebt. Fehlt eine der
          beiden Haelften, laeuft die andere allein ueber die volle Breite. */}
      {(hasMedia || hasSets) && (
        <section className="section ar-sec ar-sec--first">
          <div className={`wrap ar-spread${hasMedia && hasSets ? " is-split" : ""}`}>
            {hasMedia && (
              <div className="ar-col">
                <ArtistsSectionHead
                  eyebrow={t.mediaEyebrow}
                  title={t.mediaTitle}
                  glow={t.mediaTitleGlow}
                  note={readout(media.length, t.mediaCountLabel)}
                />
                <MediaGallery items={media} label={`Videos von ${a.name}`} />
              </div>
            )}
            {hasSets && (
              <div className="ar-col">
                <ArtistsSectionHead
                  eyebrow={t.setsEyebrow}
                  title={t.setsTitle}
                  note={readout(a.sets.length, t.setsCountLabel)}
                />
                <div className="setgrid ar-setgrid">
                  {a.sets.map((set, i) => (
                    <ArtistsSetCard
                      key={i}
                      data={{
                        id: `${a.slug}-${i}`, title: set.title, meta: set.meta,
                        quelle: { platform: set.platform, id: set.id, url: set.url },
                      }}
                      consentText={t.consentText}
                      ariaLabel={`Set abspielen: ${set.title}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {apps.length > 0 && (
        <section className="section ar-sec">
          <div className="wrap">
            <ArtistsSectionHead
              eyebrow={t.logEyebrow}
              title={t.logTitle}
              glow={t.logTitleGlow}
              note={readout(apps.length, t.logCountLabel)}
            />
            {/* Enge Platten am Text (.txplate) statt einer Platte hinter der
                ganzen Liste — die Zeitleiste bekommt ihre Linie in
                artists.css zurueck. */}
            <ul className="flog ar-flog">
              {apps.map(e => (
                <li key={e.slug}>
                  <span className="fpatch" aria-hidden="true">{e.patchNo ?? "M?"}</span>
                  <span className="fdate txplate">{fmtDate(e.date)}</span>
                  <span className="fname txplate" translate="no">{e.title}</span>
                  <span className="fvenue txplate" translate="no">{e.venue.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="section ar-sec ar-sec--last">
        <div className="wrap">
          <div className="cta-row">
            <a className="btn btn-ghost" href={s.soundcloud} target="_blank" rel="noopener">SoundCloud ↗</a>
            <Link className="btn btn-ghost" href={pageHref("artists")}>{t.backLabel}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
