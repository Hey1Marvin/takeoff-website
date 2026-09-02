import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { events, event, settings, fmtDate } from "@/lib/data";
import { t } from "@/lib/i18n";
import { pageHref } from "@/lib/site";

/* Generische Event-Detailseite — dynamisch aus der DB.
   Jedes Event (auch später im Admin angelegte) bekommt automatisch
   seine Seite; besondere Event-Skins (Mars-Boden etc.) kommen als
   gezielte Erweiterungen pro Preset dazu. */

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

export default async function EventDetail(
  { params }: { params: Promise<{ slug: string }> }
) {
  const [e, s] = await Promise.all([event((await params).slug), settings()]);
  if (!e || e.visible === false) notFound();

  const isPast = e.state === "past";
  const acc = { "--acc-override": e.theme.accent } as React.CSSProperties;
  const maps = e.venue.mapsQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.venue.mapsQuery)}`
    : null;

  return (
    <>
      <section className="ehero">
        <div className="wrap">
          <div className="patch-hero" style={{ color: e.theme.accent, ...acc }} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              strokeLinecap="round" strokeLinejoin="round">
              {PATCH_ICONS[e.theme.patch] ?? PATCH_ICONS.star}
            </svg>
          </div>
          <h1 className="etitle">{e.title.replace(/^takeoff:\s*/i, "").toLowerCase()}</h1>
          {e.subtitle && <p className="esub">{e.subtitle}</p>}
          <div className="facts">
            <span><b>{e.weekday} {fmtDate(e.date)}</b></span>
            {e.doors && e.doors !== "TBA" && <span>Boarding <b>{e.doors}</b>{e.end ? ` · ${e.end}` : ""}</span>}
            <span><b>{e.venue.name}</b>{e.venue.address ? `, ${e.venue.address}` : ""}</span>
            {e.pricing.label && <span><b>{e.pricing.label}</b></span>}
            {e.age === "18+" && <span><b>18+</b></span>}
          </div>
          {!isPast && (
            <div className="cta-row" style={{ justifyContent: "center", marginTop: 26 }}>
              <a className="btn btn-primary" href={s.telegram} target="_blank" rel="noopener">
                Telegram · Updates zuerst
              </a>
            </div>
          )}
          {isPast && <p className="lu-note" style={{ marginTop: 20 }}>Diese Mission ist abgeschlossen. Danke an alle, die dabei waren. ♥</p>}
        </div>
      </section>

      <div className="wrap section" style={{ paddingTop: "clamp(40px,6vh,70px)" }}>
        {e.brief && (
          <div className="eblock">
            <h3>{isPast ? "Debriefing" : "Mission Briefing"}</h3>
            <p>{e.brief}</p>
          </div>
        )}

        {e.lineup.length > 0 && (
          <div className="eblock">
            <h3>{isPast ? "Lineup · Rückblick" : "Crew an Bord · A–Z"}</h3>
            <div className="lineup">
              {e.lineup.map(a => (
                <span className="act" key={a.name}>
                  {a.name}
                  {a.genres && <small>{a.genres}</small>}
                </span>
              ))}
            </div>
          </div>
        )}

        {e.stats && e.stats.length > 0 && (
          <div className="eblock">
            <h3>Die Nacht in Zahlen</h3>
            <div className="stats" style={{ border: 0, padding: "10px 0" }}>
              {e.stats.map(st => <div key={st.l}><b>{st.n}</b><span>{st.l}</span></div>)}
            </div>
          </div>
        )}

        {e.gallery && e.gallery.length > 0 && (
          <div className="eblock">
            <h3>Galerie</h3>
            <div className="gallery-grid">
              {e.gallery.map(src => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt="" loading="lazy"
                  style={{ borderRadius: 10, aspectRatio: "4/3", objectFit: "cover" }} />
              ))}
            </div>
            <p className="lu-note" style={{ marginTop: 14 }}>
              Kein Foto ohne Frage — du bist auf einem Bild und willst das nicht?{" "}
              <Link href={pageHref("kontakt")} style={{ color: "var(--acc-3-tint)" }}>Eine Nachricht genügt.</Link>
            </p>
          </div>
        )}

        {(e.extras?.length ?? 0) > 0 && (
          <div className="eblock">
            <h3>Gut zu wissen</h3>
            <div className="glog">
              {e.extras!.map(x => <span className="chip" key={x}>{x}</span>)}
            </div>
          </div>
        )}

        <div className="eblock">
          <h3>Awareness an Bord</h3>
          <p>
            Awareness-Team in <b>lila Westen</b>, Ersthelfer*innen im Umlauf, Ruheraum mit
            Verbandszeug, Free Water. Hilfe holen hat nie Konsequenzen —{" "}
            <Link href={pageHref("awareness")} style={{ color: "var(--acc-3-tint)" }}>mehr dazu</Link>.
          </p>
        </div>

        {maps && !isPast && (
          <div className="eblock">
            <h3>Landeplatz</h3>
            <div className="vcard">
              <span className="vname">{e.venue.name}</span>
              {e.venue.address && <span className="vaddr">{e.venue.address}</span>}
              {e.venue.transit && <span className="vhint">{e.venue.transit}</span>}
            </div>
            <div className="route-row">
              <a className="btn btn-ghost" href={maps} target="_blank" rel="noopener">Google Maps ↗</a>
              <a className="btn btn-ghost" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(e.venue.mapsQuery)}`} target="_blank" rel="noopener">OSM ↗</a>
            </div>
            <p className="lu-note">Karten öffnen extern in deiner App — hier lädt kein Tracker.</p>
          </div>
        )}

        <Link className="back-link" href={pageHref("events")}>{t("event.page.back_all")}</Link>
      </div>
    </>
  );
}
