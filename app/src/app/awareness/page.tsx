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

/* Spiegelt src/data/pages/awareness.json. Alle sichtbaren deutschen Saetze
   stehen dort — im JSX bleiben nur Struktur und Verknuepfung. (It. 14: sechs
   Ueberschriften, drei Meldeweg-Label und vier Kleintexte sind aus diesem
   File in die JSON gewandert.) Der Contract page-awareness.json kennt die
   neuen Felder noch nicht; Quelle der Wahrheit fuer die Feldnamen ist wie in
   AGENTS.md festgelegt die eingecheckte JSON. */
interface AwarenessData {
  hero: { eyebrow: string; h1: string; intro: string };
  heroAid: { label: string; note: string; linkLabel: string };
  teamTiles: { icon: string; title: string; text: string }[];
  recognition: { eyebrow: string; title: string; text: string; icon: string; iconAlt: string };
  approachReasons: { eyebrow: string; intro: string; items: string[]; closing: string };
  ruheraum: { eyebrow: string; line: string };
  principlesHead: { eyebrow: string; title: string; intro: string };
  principles: { title: string; text: string }[];
  consequences: { label: string; text: string };
  helpHead: { eyebrow: string; title: string };
  reportChannels: {
    labels: { atEvent: string; afterEvent: string; principle: string };
    atEvent: string;
    afterEvent: { intro: string; email: string; subject?: string; responseNote: string };
    principleText: string;
  };
  emergencyNumbers: { label: string; number: string; note?: string }[];
  substances: {
    toleranceText: string;
    healthText: string;
    links: { label: string; url: string }[];
    disclaimer: string;
  };
  spiking: { title: string; signs: string[]; action: string };
  gettingHome: {
    eyebrow: string; title: string; intro: string;
    tipsLabel: string; tips: string[];
    mapsNote: string; nextLabel: string;
    useNextEventVenue?: boolean;
  };
  houseRules: { eyebrow: string; title: string; intro: string; rules: { text: string; hot?: boolean }[]; venueNote: string };
  faqHead: { eyebrow: string; title: string };
  faq: { q: string; a: string }[];
  share: { label: string; text: string; copiedToast?: string };
  transmission: { label: string; text: string };
  meta: { label: string; lastReviewed: string; statusNote?: string };
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

/* KOMPOSITION (It. 14)
   Jede Sektion ist ein 12-Spalten-Satzspiegel, aufgeteilt in 3 + 9: links
   die Marginalspalte (.aw-rail) mit dem Mikro-Label und dem Haarstrich,
   rechts der Lesefluss (.aw-flow). Innerhalb des Flusses gibt es GENAU ZWEI
   rechte Kanten — .aw-col (Satzbreite) und .aw-full (volle neun Spalten).
   Vorher waren es neun verschiedene max-width-Werte, also neun Kanten
   untereinander, und rechts blieb die halbe Seite schwarz.

   BEWEGUNG: exakt ein Moment, der 4-Sekunden-Atem der Aurora. Alle
   .reveal-Klassen sind hier bewusst raus — Reveal-Streusel auf sechs
   Bausteinen war der generische Default (und im Audit-Screenshot blieben
   die Karten dadurch unsichtbar). Alles andere bewegt sich nur als Antwort
   auf Hover/Fokus.

   ABSTAENDE: keine Inline-Styles mehr. Der Sektionsrhythmus kommt aus
   .aw-sec/.aw-quiet in awareness.css und damit aus --sp-*. */
export default async function AwarenessPage() {
  const [page, next] = await Promise.all([
    pageContent<AwarenessData>("awareness"),
    nextEvent(),
  ]);
  if (!page) notFound();

  const showVenue = page.gettingHome.useNextEventVenue !== false && !!next?.venue;
  const mapsQuery = next?.venue ? (next.venue.mapsQuery || next.venue.address || next.venue.name) : "";
  /* Der Soforthilfe-Kasten im Kopf zitiert die Notrufzeile, statt sie ein
     zweites Mal in der JSON zu fuehren — eine Quelle, eine Wahrheit. */
  const sos = page.emergencyNumbers.find(n => n.number === "112") ?? page.emergencyNumbers[0];
  const mailHref = `mailto:${page.reportChannels.afterEvent.email}${
    page.reportChannels.afterEvent.subject
      ? `?subject=${encodeURIComponent(page.reportChannels.afterEvent.subject)}`
      : ""}`;

  return (
    <>
      <AwarenessAurora />

      {/* ============ Kopf: Titelseite + Soforthilfe ============ */}
      <section className="phero aw-sec aw-hero">
        <div className="wrap">
          <p className="eyebrow">{page.hero.eyebrow}</p>
          <h1>{page.hero.h1}</h1>
          <div className="aw-hero-intro">
            <p className="aw-hero-lead txplate">{page.hero.intro}</p>
          </div>

          <aside className="aw-aid" aria-label={page.heroAid.label}>
            <span className="aw-aid-label">{page.heroAid.label}</span>
            <a className="aw-aid-num" href={`tel:${sos.number}`}>
              <span>{sos.label}</span>
              <b>{sos.number}</b>
            </a>
            <p className="aw-aid-note">{page.heroAid.note}</p>
            <a className="aw-aid-link" href="#hilfe">{page.heroAid.linkLabel}</a>
          </aside>
        </div>
      </section>

      {/* ============ So erkennst du uns · Team · Wobei du kommen kannst ============ */}
      <section className="section aw-sec aw-flowsec">
        <div className="wrap">
          <div className="aw-rail">
            <p className="eyebrow">{page.recognition.eyebrow}</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="aw-vest"
              src={publicImg(page.recognition.icon)}
              alt={page.recognition.iconAlt}
              width={120} height={140} loading="lazy"
            />
          </div>

          <div className="aw-flow">
            <header className="aw-head">
              <h2 className="h2 txplate">{page.recognition.title}</h2>
            </header>

            <div className="aw-col">
              <p className="aw-lead txplate">{page.recognition.text}</p>
            </div>

            <div className="aw-tiles aw-full">
              {page.teamTiles.map(tile => (
                <div className="atile" key={tile.title}>
                  <span className="ico" aria-hidden="true">{TILE_ICONS[tile.icon] ?? null}</span>
                  <b>{tile.title}</b>{tile.text}
                </div>
              ))}
            </div>

            <div className="aw-reasons aw-full">
              <p className="eyebrow">{page.approachReasons.eyebrow}</p>
              <div className="aw-col">
                <p className="aw-reasons-intro txplate">{page.approachReasons.intro}</p>
              </div>
              <ul className="aw-reasons-list">
                {page.approachReasons.items.map(item => <li className="txfit" key={item}>{item}</li>)}
              </ul>
              <div className="aw-col">
                <p className="aw-reasons-closing txplate">{page.approachReasons.closing}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Unsere Grundsätze + Eskalation ============ */}
      <section className="section aw-sec aw-flowsec">
        <div className="wrap">
          <div className="aw-rail">
            <p className="eyebrow">{page.principlesHead.eyebrow}</p>
          </div>

          <div className="aw-flow">
            <header className="aw-head">
              <h2 className="h2 txplate">{page.principlesHead.title}</h2>
              <div className="aw-col"><p className="aw-lead txplate">{page.principlesHead.intro}</p></div>
            </header>

            <div className="aw-principles aw-full">
              {page.principles.map((p, i) => (
                <div className="aw-principle" key={p.title}>
                  <span className="aw-num" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                  <b>{p.title}</b>
                  <p>{p.text}</p>
                </div>
              ))}
            </div>

            <div className="aw-consequence aw-full">
              <span className="aw-label">{page.consequences.label}</span>
              <p>{page.consequences.text}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Hilfe & Notfall ============ */}
      <section className="section aw-sec aw-flowsec" id="hilfe">
        <div className="wrap">
          <div className="aw-rail">
            <p className="eyebrow">{page.helpHead.eyebrow}</p>
            <AwarenessShareButton
              text={page.share.text}
              url="/awareness#hilfe"
              label={page.share.label}
              copiedToast={page.share.copiedToast}
            />
          </div>

          <div className="aw-flow">
            <header className="aw-head">
              <h2 className="h2 txplate">{page.helpHead.title}</h2>
            </header>

            <div className="aw-tel-grid aw-full">
              {page.emergencyNumbers.map(n => (
                <a className="aw-tel" href={`tel:${n.number}`} key={n.number}>
                  <span className="aw-tel-label">{n.label}</span>
                  <span className="aw-tel-num">{n.number}</span>
                  {n.note && <span className="aw-tel-note">{n.note}</span>}
                </a>
              ))}
            </div>

            <dl className="m-rows aw-report aw-full">
              <div className="m-row">
                <dt>{page.reportChannels.labels.atEvent}</dt>
                <dd>{page.reportChannels.atEvent}</dd>
              </div>
              <div className="m-row">
                <dt>{page.reportChannels.labels.afterEvent}</dt>
                <dd>
                  {page.reportChannels.afterEvent.intro}{" "}
                  <b><a className="aw-mail" href={mailHref}>{page.reportChannels.afterEvent.email}</a></b>{" "}
                  — {page.reportChannels.afterEvent.responseNote}
                </dd>
              </div>
              <div className="m-row">
                <dt>{page.reportChannels.labels.principle}</dt>
                <dd><b>{page.reportChannels.principleText}</b></dd>
              </div>
            </dl>

            <div className="aw-substances aw-full">
              <p>{page.substances.toleranceText}</p>
              <p>{page.substances.healthText}</p>
              <div className="aw-links">
                {page.substances.links.map(l => (
                  <a href={l.url} target="_blank" rel="noopener" key={l.url}>{l.label}</a>
                ))}
              </div>
              <p className="aw-disclaimer">{page.substances.disclaimer}</p>
            </div>

            <div className="aw-spiking aw-col">
              <h3 className="txplate">{page.spiking.title}</h3>
              <ul>
                {page.spiking.signs.map(s => <li className="txfit" key={s}>{s}</li>)}
              </ul>
              <p className="aw-action txplate">{page.spiking.action}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Ruheraum: bewusst die leerste Section der Seite ============ */}
      <section className="section aw-sec aw-quiet">
        <div className="wrap">
          <p className="eyebrow">{page.ruheraum.eyebrow}</p>
          <div className="aw-quiet-body">
            <p className="aw-quiet-line txplate">{page.ruheraum.line}</p>
          </div>
        </div>
      </section>

      {/* ============ Hausregeln ============ */}
      <section className="section aw-sec aw-flowsec" id="regeln">
        <div className="wrap">
          <div className="aw-rail">
            <p className="eyebrow">{page.houseRules.eyebrow}</p>
          </div>

          <div className="aw-flow">
            <header className="aw-head">
              <h2 className="h2 txplate">{page.houseRules.title}</h2>
            </header>

            <div className="glog aw-full">
              {page.houseRules.rules.map(r => (
                <span className={`chip${r.hot ? " hot" : ""}`} key={r.text}>{r.text}</span>
              ))}
            </div>
            <div className="aw-rules-note">
              <div className="aw-col"><p className="aw-lead txplate">{page.houseRules.intro}</p></div>
              <div className="aw-col"><p className="aw-fine txplate">{page.houseRules.venueNote}</p></div>
            </div>

            <div className="transmission aw-tx aw-full">
              <span className="tx-label">{page.transmission.label}</span>
              <p>{page.transmission.text}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Sicher hin & zurück zur nächsten Mission ============ */}
      <section className="section aw-sec aw-flowsec aw-home">
        <div className="wrap">
          <div className="aw-rail">
            <p className="eyebrow">{page.gettingHome.eyebrow}</p>
          </div>

          <div className="aw-flow">
            <header className="aw-head">
              <h2 className="h2 txplate">{page.gettingHome.title}</h2>
              <div className="aw-col"><p className="aw-lead txplate">{page.gettingHome.intro}</p></div>
            </header>

            <div className="aw-two aw-full">
              {showVenue && next?.venue && (
                <div className="vcard">
                  <span className="vname txfit">{next.venue.name}</span>
                  {next.venue.address && <span className="vaddr txfit">{next.venue.address}</span>}
                  {next.venue.transit && <span className="vhint txfit">{next.venue.transit}</span>}
                  {next.extras && next.extras.length > 0 && (
                    <div className="chips">
                      {next.extras.map(x => <span className="chip" key={x}>{x}</span>)}
                    </div>
                  )}
                  <div className="route-row">
                    <a className="btn btn-ghost" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsQuery)}`} target="_blank" rel="noopener">Google Maps ↗</a>
                    <a className="btn btn-ghost" href={`https://maps.apple.com/?daddr=${encodeURIComponent(mapsQuery)}`} target="_blank" rel="noopener">Apple Karten ↗</a>
                    <a className="btn btn-ghost" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(mapsQuery)}`} target="_blank" rel="noopener">OSM ↗</a>
                  </div>
                  <p className="lu-note txfit">{page.gettingHome.mapsNote}</p>
                </div>
              )}

              <div className="aw-hometips">
                <p className="eyebrow">{page.gettingHome.tipsLabel}</p>
                <ul>
                  {page.gettingHome.tips.map(tip => <li className="txfit" key={tip}>{tip}</li>)}
                </ul>
                {next && (
                  <p className="lu-note aw-nextline txfit">
                    {page.gettingHome.nextLabel}{" "}
                    <Link className="aw-nextlink" href={eventHref(next.slug)}>
                      {next.title} · {fmtDate(next.date)} →
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Awareness-FAQ ============ */}
      <section className="section aw-sec aw-flowsec">
        <div className="wrap">
          <div className="aw-rail">
            <p className="eyebrow">{page.faqHead.eyebrow}</p>
          </div>

          <div className="aw-flow">
            <header className="aw-head">
              <h2 className="h2 txplate">{page.faqHead.title}</h2>
            </header>

            <div className="aw-faq aw-full">
              {page.faq.map(item => (
                <details className="faq" key={item.q}>
                  <summary>{item.q}</summary>
                  <div className="faq-body">{item.a}</div>
                </details>
              ))}
            </div>

            <div className="aw-col aw-meta-note">
              <p className="lu-note txplate">
                {page.meta.label} {fmtDate(page.meta.lastReviewed)}{page.meta.statusNote ? ` · ${page.meta.statusNote}` : ""}
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
