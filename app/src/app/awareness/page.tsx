import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageContent, nextEvent, fmtDate } from "@/lib/data";
import { eventHref } from "@/lib/site";
import AwarenessAurora from "@/components/pages/AwarenessAurora";
import AwarenessShareButton from "@/components/pages/AwarenessShareButton";
import "@/styles/pages/awareness.css";

export const metadata: Metadata = {
  title: "Awareness & Hilfe · takeoff potsdam",
  description: "Awareness bei takeoff: Team, Ersthelfer*innen, Free Water, Hausregeln — und wo du Hilfe bekommst.",
};

/* Spiegelt src/data/pages/awareness.json (siehe assets/js/pages/awareness.js
   im Prototyp für die 1:1-Referenz der Render-Logik). Der Contract
   page-awareness.json beschreibt dieselbe Idee etwas allgemeiner
   (Admin-Formular-Sicht) — Quelle der Wahrheit für die Feldnamen ist
   hier die tatsächlich eingecheckte JSON, wie von AGENTS.md vorgegeben. */
interface AwarenessData {
  hero: { eyebrow: string; h1: string; intro: string };
  teamTiles: { icon: string; title: string; text: string }[];
  recognition: { eyebrow: string; text: string; icon: string };
  approachReasons: { eyebrow: string; intro: string; items: string[]; closing: string };
  ruheraum: { eyebrow: string; line: string };
  principles: { title: string; text: string }[];
  consequences: { text: string };
  reportChannels: {
    atEvent: string;
    afterEvent: { email: string; subject?: string; responseNote: string };
  };
  emergencyNumbers: { label: string; number: string; note?: string }[];
  substances: {
    toleranceText: string;
    healthText: string;
    links: { label: string; url: string }[];
    disclaimer: string;
  };
  spiking: { title: string; signs: string[]; action: string };
  gettingHome: { intro: string; tips: string[]; useNextEventVenue?: boolean };
  houseRules: { intro: string; rules: { text: string; hot?: boolean }[]; venueNote: string };
  faq: { q: string; a: string }[];
  share: { label: string; text: string; copiedToast?: string };
  transmission: { label: string; text: string };
  meta: { lastReviewed: string; statusNote?: string };
}

/* Icon-Set der Team-Kacheln — identisch zu TILE_ICONS in
   assets/js/pages/awareness.js, damit Kachel-Look 1:1 bleibt. */
const TILE_ICONS: Record<string, React.ReactNode> = {
  team: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M12 20s-7.2-4.6-9.2-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.2 11c-2 4.4-9.2 9-9.2 9z" />
    </svg>
  ),
  sani: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.5" /><path d="M12 8.5v7M8.5 12h7" />
    </svg>
  ),
  water: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M12 3.5c3.6 4.4 5.5 7.2 5.5 10a5.5 5.5 0 0 1-11 0c0-2.8 1.9-5.6 5.5-10z" />
    </svg>
  ),
  camera: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.8 6h5.4l1.6 2H20v9.4M6 8H4v10h11.5" /><circle cx="12" cy="13" r="2.7" /><path d="M3.5 3.5l17 17" />
    </svg>
  ),
};

/* Prototyp-Bildpfade (assets/img/…) → selbst gehostetes /img/. */
const publicImg = (p: string) => p.replace(/^assets\/img\//, "/img/");

/* LESBARKEIT (It. 14): Statt der grossen radialen Nacht-Traegerflaechen aus
   scene-night.css traegt auf dieser Seite jeder Textbaustein seine eigene,
   ENG anliegende Platte (Klassen .txplate/.txfit, definiert in awareness.css;
   die grossen Flaechen sind dort per `content: none` abgeschaltet, Anker ist
   die Sektionsklasse `aw-sec`). Die Platte sitzt bewusst auf dem p/li/h2
   SELBST, nie auf einem inneren Span: die Lesbarkeits-Pruefung in
   verify-ui.mjs laeuft ueber genau diese Elemente und ihre Vorfahren. */
export default async function AwarenessPage() {
  const [page, next] = await Promise.all([
    pageContent<AwarenessData>("awareness"),
    nextEvent(),
  ]);
  if (!page) notFound();

  const showVenue = page.gettingHome.useNextEventVenue !== false && !!next?.venue;
  const mapsQuery = next?.venue ? (next.venue.mapsQuery || next.venue.address || next.venue.name) : "";

  return (
    <>
      <AwarenessAurora />

      <section className="phero aw-sec">
        <div className="wrap">
          <p className="eyebrow">{page.hero.eyebrow}</p>
          <h1>{page.hero.h1}</h1>
          <div className="aw-introw">
            <p className="section-intro txplate">{page.hero.intro}</p>
          </div>
        </div>
      </section>

      {/* ============ So erkennst du uns · Team · Wobei du kommen kannst ============ */}
      <section className="section aw-sec" style={{ paddingTop: "clamp(30px, 5vh, 50px)" }}>
        <div className="wrap">
          <header className="section-head">
            <p className="eyebrow">{page.recognition.eyebrow}</p>
            <h2 className="h2 txplate">Lila Weste, offenes Ohr</h2>
          </header>

          <div className="aw-recognition">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={publicImg(page.recognition.icon)} alt="Lila Awareness-Weste mit Reflektorstreifen" width={120} height={140} loading="lazy" />
            <div className="aw-rec-txt">
              <p className="txplate">{page.recognition.text}</p>
            </div>
          </div>

          <div className="aware reveal">
            <div className="aware-grid">
              {page.teamTiles.map(tile => (
                <div className="atile" key={tile.title}>
                  <span className="ico" aria-hidden="true">{TILE_ICONS[tile.icon] ?? null}</span>
                  <b>{tile.title}</b>{tile.text}
                </div>
              ))}
            </div>
          </div>

          <div className="aw-reasons">
            <p className="eyebrow">{page.approachReasons.eyebrow}</p>
            <p className="aw-reasons-intro txplate">{page.approachReasons.intro}</p>
            <ul className="aw-reasons-list">
              {page.approachReasons.items.map(item => <li className="txfit" key={item}>{item}</li>)}
            </ul>
            <p className="aw-reasons-closing txplate">{page.approachReasons.closing}</p>
          </div>
        </div>
      </section>

      {/* ============ Unsere Grundsätze + Eskalation ============ */}
      <section className="section aw-sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <header className="section-head">
            <p className="eyebrow">Unsere Grundsätze</p>
            <h2 className="h2 txplate">Vier Regeln für uns</h2>
            <div className="aw-introw">
              <p className="section-intro txplate">Daran hält sich das Awareness-Team — bei jeder Meldung, jedes Mal.</p>
            </div>
          </header>

          <div className="aw-principles">
            {page.principles.map((p, i) => (
              <div className="aw-principle reveal" key={p.title}>
                <span className="aw-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <b>{p.title}</b>
                <p>{p.text}</p>
              </div>
            ))}
          </div>

          <div className="aw-consequence reveal">
            <span className="aw-label">Eskalation</span>
            <p>{page.consequences.text}</p>
          </div>
        </div>
      </section>

      {/* ============ Hilfe & Notfall ============ */}
      <section className="section aw-sec" id="hilfe" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <header className="section-head">
            <p className="eyebrow">Hilfe &amp; Notfall</p>
            <h2 className="h2 txplate">Wenn&apos;s ernst wird</h2>
          </header>

          <div className="aw-share-row">
            <AwarenessShareButton
              text={page.share.text}
              url="/awareness#hilfe"
              label={page.share.label}
              copiedToast={page.share.copiedToast}
            />
          </div>

          <div className="aw-tel-grid">
            {page.emergencyNumbers.map(n => (
              <a className="aw-tel" href={`tel:${n.number}`} key={n.number}>
                <span className="aw-tel-label">{n.label}</span>
                <span className="aw-tel-num">{n.number}</span>
                {n.note && <span className="aw-tel-note">{n.note}</span>}
              </a>
            ))}
          </div>

          <dl className="m-rows aw-report">
            <div className="m-row"><dt>Am Event</dt><dd>{page.reportChannels.atEvent}</dd></div>
            <div className="m-row">
              <dt>Danach</dt>
              <dd>
                Ist etwas passiert? Schreib uns:{" "}
                <b>
                  <a
                    href={`mailto:${page.reportChannels.afterEvent.email}${page.reportChannels.afterEvent.subject ? `?subject=${encodeURIComponent(page.reportChannels.afterEvent.subject)}` : ""}`}
                    style={{ color: "var(--ink)" }}
                  >
                    {page.reportChannels.afterEvent.email}
                  </a>
                </b>{" "}
                — {page.reportChannels.afterEvent.responseNote}
              </dd>
            </div>
            <div className="m-row"><dt>Grundsatz</dt><dd><b>Hilfe holen hat nie Konsequenzen.</b> Für niemanden. Nie.</dd></div>
          </dl>

          <div className="aw-substances">
            <p>{page.substances.toleranceText}</p>
            <p>{page.substances.healthText}</p>
            <div className="aw-links">
              {page.substances.links.map(l => (
                <a href={l.url} target="_blank" rel="noopener" key={l.url}>{l.label}</a>
              ))}
            </div>
            <p className="aw-disclaimer">{page.substances.disclaimer}</p>
          </div>

          <div className="aw-spiking">
            <h3 className="txplate">{page.spiking.title}</h3>
            <ul>
              {page.spiking.signs.map(s => <li className="txfit" key={s}>{s}</li>)}
            </ul>
            <p className="aw-action txplate">{page.spiking.action}</p>
          </div>
        </div>
      </section>

      {/* ============ Ruheraum: bewusst die leerste Section der Seite ============ */}
      <section className="section aw-quiet aw-sec">
        <div className="wrap">
          <p className="eyebrow">{page.ruheraum.eyebrow}</p>
          <p className="aw-quiet-line txplate">{page.ruheraum.line}</p>
        </div>
      </section>

      {/* ============ Hausregeln ============ */}
      <section className="section aw-sec" id="regeln" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <header className="section-head">
            <p className="eyebrow">Hausregeln</p>
            <h2 className="h2 txplate">Kurz &amp; klar</h2>
          </header>
          <div className="glog">
            {page.houseRules.rules.map(r => (
              <span className={`chip${r.hot ? " hot" : ""}`} key={r.text}>{r.text}</span>
            ))}
          </div>
          <div className="aw-introw" style={{ marginTop: 22 }}>
            <p className="section-intro txplate">{page.houseRules.intro}</p>
          </div>
          <div className="aw-introw" style={{ marginTop: 10 }}>
            <p className="section-intro txplate">{page.houseRules.venueNote}</p>
          </div>

          <div className="transmission aw-tx">
            <span className="tx-label">{page.transmission.label}</span>
            <p>{page.transmission.text}</p>
          </div>
        </div>
      </section>

      {/* ============ Sicher hin & zurück zur nächsten Mission ============ */}
      <section className="section aw-home aw-sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <header className="section-head">
            <p className="eyebrow">Nächste Mission</p>
            <h2 className="h2 txplate">Sicher hin &amp; zurück</h2>
            <div className="aw-introw">
              <p className="section-intro txplate">{page.gettingHome.intro}</p>
            </div>
          </header>

          {showVenue && next?.venue && (
            <div className="vcard">
              <span className="vname txfit">{next.venue.name}</span>
              {next.venue.address && <span className="vaddr txfit">{next.venue.address}</span>}
              {next.venue.transit && <span className="vhint txfit">{next.venue.transit}</span>}
              {next.extras && next.extras.length > 0 && (
                <div className="chips" style={{ marginTop: 8 }}>
                  {next.extras.map(x => <span className="chip" key={x}>{x}</span>)}
                </div>
              )}
              <div className="route-row">
                <a className="btn btn-ghost" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsQuery)}`} target="_blank" rel="noopener">Google Maps ↗</a>
                <a className="btn btn-ghost" href={`https://maps.apple.com/?daddr=${encodeURIComponent(mapsQuery)}`} target="_blank" rel="noopener">Apple Karten ↗</a>
                <a className="btn btn-ghost" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(mapsQuery)}`} target="_blank" rel="noopener">OSM ↗</a>
              </div>
              <p className="lu-note txfit">Karten öffnen extern in deiner App — hier lädt kein Tracker.</p>
            </div>
          )}

          <ul className="aw-hometips">
            {page.gettingHome.tips.map(tip => <li className="txfit" key={tip}>{tip}</li>)}
          </ul>
          {next && (
            <p className="lu-note txfit" style={{ marginTop: 16 }}>
              Nächster Start:{" "}
              <Link href={eventHref(next.slug)} style={{ color: "var(--acc-3-tint)" }}>
                {next.title} · {fmtDate(next.date)} →
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* ============ Awareness-FAQ ============ */}
      <section className="section aw-sec" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <header className="section-head">
            <p className="eyebrow">Bevor du fragst</p>
            <h2 className="h2 txplate">Awareness-FAQ</h2>
          </header>
          <div className="aw-faq">
            {page.faq.map(item => (
              <details className="faq" key={item.q}>
                <summary>{item.q}</summary>
                <div className="faq-body">{item.a}</div>
              </details>
            ))}
          </div>
          <p className="lu-note aw-meta-note txfit">
            Stand: {fmtDate(page.meta.lastReviewed)}{page.meta.statusNote ? ` · ${page.meta.statusNote}` : ""}
          </p>
        </div>
      </section>
    </>
  );
}
