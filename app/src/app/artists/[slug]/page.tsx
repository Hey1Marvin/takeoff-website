import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { artists, artist, event, settings, fmtDate } from "@/lib/data";
import type { TakeoffEvent } from "@/lib/types";
import ArtistOrbitAvatar from "@/components/pages/ArtistOrbitAvatar";
import ArtistsSetCard from "@/components/pages/ArtistsSetCard";
import "@/styles/pages/artists.css";
import { pageHref } from "@/lib/site";

/* Generische Artist-Detailseite — dynamisch aus der DB, Vorbild:
   events/[slug]/page.tsx. Auftritte ergeben sich aus appearances (Event-
   Slugs) per event()-Lookup, nicht aus eigener Pflege (Contract-Kommentar
   in artist.json). Signatur-Motiv: Orbit (ArtistOrbitAvatar). */

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

const CONSENT_TEXT =
  "Demo: Hier würde jetzt der Player laden (Zwei-Klick, DSGVO-freundlich). Kein Klick = kein Tracking.";

export default async function ArtistDetail(
  { params }: { params: Promise<{ slug: string }> }
) {
  const [a, s] = await Promise.all([artist((await params).slug), settings()]);
  if (!a || a.visible === false) notFound();

  /* Auftritte NICHT am Artist gepflegt, sondern ueber die appearances-Liste
     (Event-Slugs) live aus den Events aufgeloest — verstecktes Event bleibt
     trotz Referenz unsichtbar (gleiches Sichtbarkeits-Prinzip wie ueberall). */
  const apps = (await Promise.all(a.appearances.map(slug => event(slug))))
    .filter((e): e is TakeoffEvent => !!e && e.visible !== false)
    .sort((x, y) => y.date.localeCompare(x.date)); // neueste zuerst, wie das Flight Log

  const debut = apps.length > 0 ? apps[apps.length - 1] : null;

  return (
    <>
      <section className="phero">
        <div className="wrap" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 26 }}>
          <ArtistOrbitAvatar initials={a.initials} />
          <div>
            <p className="eyebrow">Artist</p>
            <h1 translate="no">{a.name}</h1>
            <p className="section-intro" style={{ marginTop: 8 }}>
              {a.genres}{a.role ? ` · ${a.role}` : ""}
            </p>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "clamp(24px, 4vh, 40px)" }}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <dl className="m-rows" style={{ borderTop: "1px solid var(--bg-hairline)" }}>
            <div className="m-row">
              <dt>Rolle</dt>
              <dd><b>{a.role}</b>{a.since && !/seit/i.test(a.role) ? ` · seit ${a.since}` : ""}</dd>
            </div>
            {debut && (
              <div className="m-row">
                <dt>Debüt</dt>
                <dd>{debut.title} · {fmtDate(debut.date)}</dd>
              </div>
            )}
            <div className="m-row">
              <dt>Socials</dt>
              <dd><a href={s.soundcloud} target="_blank" rel="noopener" style={{ color: "var(--ink)" }}>SoundCloud ↗</a></dd>
            </div>
          </dl>
          <p className="section-intro" style={{ marginTop: 18 }}>{a.bio}</p>
        </div>
      </section>

      {a.sets.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <header className="section-head">
              <p className="eyebrow">Hören</p>
              <h2 className="h2">Sets</h2>
            </header>
            <div className="setgrid" style={{ maxWidth: 520 }}>
              {a.sets.map((set, i) => (
                <ArtistsSetCard
                  key={i}
                  data={{ id: `${a.slug}-${i}`, title: set.title, meta: set.meta }}
                  consentText={CONSENT_TEXT}
                  ariaLabel={`Set abspielen: ${set.title}`}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="section" style={{ paddingTop: a.sets.length > 0 ? 0 : "clamp(24px, 4vh, 40px)" }}>
        <div className="wrap">
          <div className="cta-row">
            <a className="btn btn-ghost" href={s.soundcloud} target="_blank" rel="noopener">SoundCloud ↗</a>
            <Link className="btn btn-ghost" href={pageHref("artists")}>← Alle Artists</Link>
          </div>
        </div>
      </section>

      {apps.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <header className="section-head">
              <p className="eyebrow">Flight Log</p>
              <h2 className="h2">Bei takeoff <span className="glow">gespielt</span></h2>
            </header>
            <ul className="flog">
              {apps.map(e => (
                <li key={e.slug}>
                  <span className="fpatch" aria-hidden="true">{e.patchNo ?? "M?"}</span>
                  <span className="fdate">{fmtDate(e.date)}</span>
                  <span className="fname" translate="no">{e.title}</span>
                  <span className="fvenue" translate="no">{e.venue.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
