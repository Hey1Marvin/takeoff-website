import type { Metadata } from "next";
import Link from "next/link";
import { upcoming, past, fmtDate, settings, pageContent, nextEvent } from "@/lib/data";
import { eventHref, pageHref } from "@/lib/site";
import type { TakeoffEvent } from "@/lib/types";
import EventsStatusFlap from "@/components/pages/EventsStatusFlap";
import EventsBoardClock from "@/components/pages/EventsBoardClock";
import EventsBoardRow from "@/components/pages/EventsBoardRow";
import EventsTminusClock from "@/components/pages/EventsTminusClock";
import EventsShareButton from "@/components/pages/EventsShareButton";
import EventsFlightLog from "@/components/pages/EventsFlightLog";
import EventsBpmTool from "@/components/pages/EventsBpmTool";
import EventsBoardPower from "@/components/pages/EventsBoardPower";
import "@/styles/pages/events.css";

export const metadata: Metadata = {
  title: "Events & Missionen · takeoff potsdam",
  description: "Alle takeoff-Events: kommende Missionen und das Flight Log der vergangenen Nächte.",
};

/* Spiegelt src/data/pages/events.json. */
interface EventsPageData {
  hero: { eyebrow: string; titleHtml: string; intro: string };
  board: {
    code: string;
    title: string;
    boardingWindowHours?: number;
    columns: { gate: string; date: string; mission: string; place: string; status: string };
    gatePrefix: string;
    toggleLabel: string;
    footNoteOne: string;
    footNoteMany: string;
    footNoteNone: string;
  };
  briefing: {
    boarding: string; boardingEnd: string; boardingOpenEnd: string;
    venue: string; entry: string; sound: string;
    detailCta: string; telegramCta: string; telegramTbaCta: string; icsDemoTitle: string;
  };
  emptyState: { eyebrow: string; title: string; text: string; ctaLabel: string; ctaHref: string };
  sections: {
    upcomingEyebrow: string;
    flightlogEyebrow: string;
    flightlogTitleHtml: string;
    flightlogNote: { before: string; linkLabel: string; after: string };
  };
  eventExtras?: Record<string, { detailPage?: string; transit?: string; capacityNote?: string; weatherNote?: string; shareText?: string }>;
  faqSection: { eyebrow: string; titleHtml: string };
  faq: { q: string; a: string }[];
  tapTempo?: { eyebrow?: string; title?: string; titleHtml?: string; intro?: string; genres?: { name: string; bpmMin: number; bpmMax: number }[] };
  patchLog?: { toggleLabel: string; toastTemplate: string; resetLabel: string };
  share?: { copiedToast?: string };
  calendar: { ctaLabel: string; subscribeLabel: string };
  transmission: { label: string; text: string };
}

const DEFAULT_BOARDING_WINDOW_H = 48;

/* Kombiniertes Datum+Einlasszeit als ISO-String — Basis für Split-Flap-
   Status UND T-Minus-Countdown, damit beide Widgets nie widersprüchlich
   wirken (z. B. Status schon "Boarding", Countdown aber noch auf
   Mitternacht statt Einlasszeit). */
function doorsIso(ev: Pick<TakeoffEvent, "date" | "doors">): string {
  const doorsRaw = /^\d\d:\d\d$/.test(ev.doors || "") ? ev.doors : "00:00";
  return `${ev.date}T${doorsRaw}`;
}

/* Portierung von computeLabel() aus events.js — db.json kennt nur die
   state-Werte upcoming/tba/past; die vier Tafel-Stati (inkl. Departed im
   Flight Log) ergeben sich daraus ohne Schema-Änderung. */
function computeLabel(ev: TakeoffEvent, boardingWindowH: number): string {
  if (ev.state === "tba") return "TBA 🤫";
  const doorsMs = Date.parse(doorsIso(ev));
  if (!Number.isNaN(doorsMs) && (doorsMs - Date.now()) / 36e5 <= boardingWindowH) return "Boarding";
  return "Announced";
}
const statusKeyFor = (label: string) => label.toLowerCase().replace(/[^a-z]+/g, "") || "announced";

/* Die letzte FAQ-Antwort erwähnt im JSON wörtlich "kollektiv.html#mitmachen"
   (Prototyp-Artefakt: der Fließtext wurde dort per Hand zum <a> — im JSON
   bleibt nur die Text-Erwähnung). Hier wird daraus ein echter Link auf die
   reale Route, ohne den Antworttext zu duplizieren. */
function renderFaqAnswer(text: string) {
  const marker = "kollektiv.html#mitmachen";
  const idx = text.indexOf(marker);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <Link className="ev-inline-link" href={pageHref("kollektiv", "mitmachen")}>kollektiv#mitmachen</Link>
      {text.slice(idx + marker.length)}
    </>
  );
}

/* Patch-Icons je Theme — 1:1 aus den Karten-SVGs in prototype/events.html
   übernommen (inkl. der zwei kleinen Staub-Kreise beim Planeten). */
const PATCH_ICON_INNER: Record<string, React.ReactNode> = {
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

/* Gate-Nummer war bis It. 14 ein reiner CSS-Zaehler (counter-increment auf
   .mcard, ungescopet — er lief damit auch auf fremden Seiten mit). Jetzt
   kommt sie aus der Reihenfolge der Liste, wie jede andere Angabe der
   Zeile auch. */
const gateNo = (i: number) => String(i + 1).padStart(2, "0");

export default async function EventsPage() {
  const [up, gone, s, page, next] = await Promise.all([
    upcoming(),
    past(),
    settings(),
    pageContent<EventsPageData>("events"),
    nextEvent(),
  ]);

  const boardingWindowH = page?.board?.boardingWindowHours ?? DEFAULT_BOARDING_WINDOW_H;
  const tminusTarget = next ? doorsIso(next) : null;

  const flogEntries = gone.map(e => ({
    slug: e.slug,
    patchNo: e.patchNo ?? "M?",
    dateDisplay: fmtDate(e.date),
    title: e.title,
    venue: e.venue.name,
    brief: e.brief || undefined,
    href: eventHref(e.slug),
  }));

  const faq = page?.faq ?? [];
  const bpmGenres = page?.tapTempo?.genres;
  const heroTitleHtml = page?.hero.titleHtml ?? 'Events &amp; <span class="glow">Missionen</span>';
  const cols = page?.board.columns ?? { gate: "Gate", date: "Datum", mission: "Mission", place: "Ort", status: "Status" };
  const br = page?.briefing;

  const footNote =
    up.length === 0
      ? page?.board.footNoteNone ?? "Kein Abflug angekündigt"
      : up.length === 1
        ? page?.board.footNoteOne ?? "1 Abflug angekündigt"
        : (page?.board.footNoteMany ?? "{count} Abflüge angekündigt").replace("{count}", String(up.length));

  return (
    <>
      <section className="phero">
        <div className="wrap">
          <p className="eyebrow">{page?.hero.eyebrow ?? "Flugplan"}</p>
          <h1 dangerouslySetInnerHTML={{ __html: heroTitleHtml }} />
          <p className="section-intro">
            {page?.hero.intro ?? "Alles, was ansteht — und alles, was war. Tipp eine Zeile der Tafel an, dann klappt das Briefing auf."}
          </p>
          <div className="tminus" role="timer" aria-label="Countdown zum nächsten Event">
            <span className="label">T-Minus</span>
            <EventsTminusClock targetIso={tminusTarget} />
          </div>
        </div>
      </section>

      {/* Die Tafel ist der Ausbruch aus der Textspalte: breiter als jeder
          andere Block der Seite (.ev-wrap), weil eine Abflugtafel breit
          IST. Genau ein Ausbruch — mehrere verschiedene Breiten laesen
          sich als Zufall, einer als Absicht. */}
      <section className="section ev-sec ev-sec--board" id="kommend">
        <div className="wrap ev-wrap">
          <p className="eyebrow">{page?.sections.upcomingEyebrow ?? "Kommende Missionen"}</p>

          <div className="ev-board">
            <EventsBoardPower />
            <div className="ev-frame">
              <div className="board-toprow">
                <span className="board-code" aria-hidden="true">{page?.board.code ?? "PDM"}</span>
                <h2 className="board-title">{page?.board.title ?? "Abflugtafel"}</h2>
                <EventsBoardClock />
              </div>

              {up.length === 0 ? (
                <div className="ev-standby">
                  <span className="ev-standby-label">{page?.emptyState.eyebrow ?? "Standby"}</span>
                  <p className="ev-standby-title">{page?.emptyState.title ?? "Nächster Start in Vorbereitung"}</p>
                  <p className="ev-standby-text">{page?.emptyState.text ?? "Kein Event angekündigt — aber startklar. Telegram weiß es zuerst."}</p>
                  <a className="btn btn-primary" href={s.telegram} target="_blank" rel="noopener">
                    {page?.emptyState.ctaLabel ?? "Telegram beitreten"}
                  </a>
                </div>
              ) : (
                <>
                  <div className="ev-cols" aria-hidden="true">
                    <span>{cols.gate}</span>
                    <span>{cols.date}</span>
                    <span>{cols.mission}</span>
                    <span>{cols.place}</span>
                    <span>{cols.status}</span>
                    <span />
                  </div>

                  <ul className="ev-rows">
                    {up.map((e, i) => {
                      const label = computeLabel(e, boardingWindowH);
                      const statusKey = statusKeyFor(label);
                      const extra = page?.eventExtras?.[e.slug];
                      const transit = extra?.transit || e.venue.transit;
                      const shareText = extra?.shareText || `${e.title} · ${e.weekday} ${fmtDate(e.date)} · ${e.venue.name}`;
                      const noteLine = extra?.weatherNote
                        ? { icon: "🌧", text: extra.weatherNote }
                        : extra?.capacityNote
                          ? { icon: "⚠", text: extra.capacityNote }
                          : null;
                      const whenLine = [
                        e.doors && e.doors !== "TBA" ? `ab ${e.doors}` : "",
                        e.pricing.label,
                      ].filter(Boolean).join(" · ");
                      const endLine = e.end
                        ? e.end === "open end"
                          ? ` · ${br?.boardingOpenEnd ?? "open end"}`
                          : ` · ${br?.boardingEnd ?? "Ende"} ${e.end}`
                        : "";

                      return (
                        <EventsBoardRow
                          key={e.slug}
                          index={i}
                          accent={e.theme.accent}
                          accentRgb={e.theme.accentRgb}
                          toggleLabel={page?.board.toggleLabel ?? "Briefing"}
                          head={
                            <>
                              <span className="ev-c ev-c-gate">
                                <span className="ev-gate">{page?.board.gatePrefix ?? "Gate"} {gateNo(i)}</span>
                              </span>
                              <span className="ev-c ev-c-date">
                                <span className="ev-wd">{e.weekday}</span>
                                <span className="ev-day">{fmtDate(e.date)}</span>
                              </span>
                              <span className="ev-c ev-c-mission">
                                <span className="ev-patch" aria-hidden="true">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                                    {PATCH_ICON_INNER[e.theme.patch] ?? PATCH_ICON_INNER.star}
                                  </svg>
                                </span>
                                <span className="ev-titles">
                                  <span className="ev-title">{e.title}</span>
                                  {e.subtitle && <span className="ev-sub">{e.subtitle}</span>}
                                </span>
                              </span>
                              <span className="ev-c ev-c-place">
                                <span className="ev-venue">{e.venue.name}</span>
                                {whenLine && <span className="ev-when">{whenLine}</span>}
                              </span>
                              <span className="ev-c ev-c-status">
                                <EventsStatusFlap label={label} statusKey={statusKey} className="ev-status" />
                              </span>
                            </>
                          }
                          more={
                            <>
                              <div className="ev-facts">
                                <dl className="m-rows">
                                  <div className="m-row">
                                    <dt>{br?.boarding ?? "Boarding"}</dt>
                                    <dd><b>{e.doors}</b>{endLine}</dd>
                                  </div>
                                  <div className="m-row">
                                    <dt>{br?.venue ?? "Landeplatz"}</dt>
                                    <dd><b>{e.venue.name}</b><br />{transit || e.venue.address}</dd>
                                  </div>
                                  <div className="m-row">
                                    <dt>{br?.entry ?? "Eintritt"}</dt>
                                    <dd><b>{e.pricing.label}</b>{e.age === "18+" ? " · 18+" : ""}</dd>
                                  </div>
                                  {e.genres.length > 0 && (
                                    <div className="m-row">
                                      <dt>{br?.sound ?? "Sound"}</dt>
                                      <dd translate="no">{e.genres.join(" · ")}</dd>
                                    </div>
                                  )}
                                </dl>
                              </div>

                              <div className="ev-brief">
                                <p className="m-brief">{e.brief}</p>
                                {noteLine && <p className="ev-note">{noteLine.icon} {noteLine.text}</p>}
                                {e.venue.mapsQuery && (
                                  <div className="route-row ev-route">
                                    <a className="btn btn-ghost" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.venue.mapsQuery)}`} target="_blank" rel="noopener">Google Maps ↗</a>
                                    <a className="btn btn-ghost" href={`https://maps.apple.com/?q=${encodeURIComponent(e.venue.mapsQuery)}`} target="_blank" rel="noopener">Apple Karten ↗</a>
                                    <a className="btn btn-ghost" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(e.venue.mapsQuery)}`} target="_blank" rel="noopener">OSM ↗</a>
                                  </div>
                                )}
                              </div>

                              <div className="cta-row ev-cta">
                                <Link className="btn btn-primary" href={eventHref(e.slug)}>{br?.detailCta ?? "Zur Missionsseite"}</Link>
                                <a className="btn btn-ghost" href="#" aria-disabled="true" title={br?.icsDemoTitle ?? "Demo — echter Download kommt mit dem Backend"}>
                                  {page?.calendar.ctaLabel ?? "＋ In den Kalender (.ics)"}
                                </a>
                                <EventsShareButton text={shareText} url={eventHref(e.slug)} copiedToast={page?.share?.copiedToast} />
                                <a className="btn btn-ghost" href={s.telegram} target="_blank" rel="noopener">
                                  {e.state === "tba" ? (br?.telegramTbaCta ?? "Telegram · zuerst erfahren") : (br?.telegramCta ?? "Telegram")}
                                </a>
                              </div>
                            </>
                          }
                        />
                      );
                    })}
                  </ul>
                </>
              )}

              {/* Fusszeile INNERHALB des Rahmens: der Abo-Link hing vorher
                  mit margin-top:-8px im Schlagschatten der Tafel. */}
              <div className="ev-foot">
                <span className="ev-foot-note">{footNote}</span>
                <Link className="ev-foot-link" href={pageHref("kalender")}>
                  {page?.calendar.subscribeLabel ?? "Alle Termine abonnieren →"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section ev-sec ev-sec--log" id="flightlog">
        <div className="wrap">
          <EventsFlightLog
            events={flogEntries}
            eyebrow={page?.sections.flightlogEyebrow ?? "Flight Log"}
            titleHtml={page?.sections.flightlogTitleHtml ?? 'Bisherige <span class="glow">Missionen</span>'}
            toggleLabel={page?.patchLog?.toggleLabel ?? "War ich dabei"}
            toastTemplate={page?.patchLog?.toastTemplate ?? "Patch gespeichert — {count}/{total} Missionen"}
            resetLabel={page?.patchLog?.resetLabel ?? "Zurücksetzen"}
          />
          <p className="lu-note ev-log-note">
            {page?.sections.flightlogNote?.before ?? "Galerien & Sets folgen, sobald alle Abgebildeten gefragt wurden — "}
            <Link className="ev-inline-link" href={pageHref("kontakt")}>
              {page?.sections.flightlogNote?.linkLabel ?? "kein Foto ohne Frage"}
            </Link>
            {page?.sections.flightlogNote?.after ?? "."}
          </p>
        </div>
      </section>

      {/* FAQ und Tap-Tempo standen als zwei volle Sektionen untereinander,
          beide als schmale Spalte in einem 1440er Fenster. Als Paar
          benutzen sie die Breite und die Seite wird um eine Sektionshoehe
          kuerzer. */}
      <section className="section ev-sec ev-sec--end">
        <div className="wrap">
          <div className="ev-endgrid">
            <div className="ev-faq" id="faq">
              <header className="section-head">
                <p className="eyebrow">{page?.faqSection.eyebrow ?? "Bevor du fragst"}</p>
                <h2 className="h2" dangerouslySetInnerHTML={{ __html: page?.faqSection.titleHtml ?? 'Häufige <span class="glow">Fragen</span>' }} />
              </header>
              <div className="faqlist">
                {faq.map(item => (
                  <details key={item.q}>
                    <summary>
                      {item.q}
                      <span className="fq-ico" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                      </span>
                    </summary>
                    <p className="fq-a">{renderFaqAnswer(item.a)}</p>
                  </details>
                ))}
              </div>
            </div>

            <aside className="ev-bpm" id="bpm">
              <header className="section-head">
                <p className="eyebrow">{page?.tapTempo?.eyebrow ?? "Sound-Check"}</p>
                <h2
                  className="h2 ev-bpm-title"
                  dangerouslySetInnerHTML={{ __html: page?.tapTempo?.titleHtml ?? 'Finde deinen <span class="glow">Rave-Rhythmus</span>' }}
                />
                <p className="section-intro ev-bpm-intro">{page?.tapTempo?.intro ?? "Klopf mit — wir sagen dir, zu welchem Genre dein Tempo passt."}</p>
              </header>
              <EventsBpmTool genres={bpmGenres} />
            </aside>
          </div>
        </div>
      </section>

      <section className="section ev-sec ev-sec--tx">
        <div className="wrap">
          <div className="transmission">
            <span className="tx-label">{page?.transmission.label ?? "Transmission incoming"}</span>
            <p>{page?.transmission.text}</p>
          </div>
        </div>
      </section>
    </>
  );
}
