import type { Metadata } from "next";
import Link from "next/link";
import { upcoming, past, fmtDate, settings, pageContent, nextEvent } from "@/lib/data";
import { eventHref, pageHref } from "@/lib/site";
import type { TakeoffEvent } from "@/lib/types";
import ExpandCard from "@/components/ExpandCard";
import EventsStatusFlap from "@/components/pages/EventsStatusFlap";
import EventsBoardClock from "@/components/pages/EventsBoardClock";
import EventsTminusClock from "@/components/pages/EventsTminusClock";
import EventsShareButton from "@/components/pages/EventsShareButton";
import EventsFlightLog from "@/components/pages/EventsFlightLog";
import EventsBpmTool from "@/components/pages/EventsBpmTool";
import "@/styles/pages/events.css";

export const metadata: Metadata = {
  title: "Events & Missionen · takeoff potsdam",
  description: "Alle takeoff-Events: kommende Missionen und das Flight Log der vergangenen Nächte.",
};

/* Spiegelt src/data/pages/events.json (siehe assets/js/pages/events.js im
   Prototyp für die 1:1-Referenz der Render-/Statuslogik). */
interface EventsPageData {
  hero: { eyebrow: string; titleHtml: string; intro: string };
  board: { code: string; title: string; boardingWindowHours?: number };
  emptyState: { eyebrow: string; title: string; text: string; ctaLabel: string; ctaHref: string };
  sections: { upcomingEyebrow: string; flightlogEyebrow: string; flightlogTitleHtml: string };
  eventExtras?: Record<string, { detailPage?: string; transit?: string; capacityNote?: string; weatherNote?: string; shareText?: string }>;
  faq: { q: string; a: string }[];
  tapTempo?: { title?: string; intro?: string; genres?: { name: string; bpmMin: number; bpmMax: number }[] };
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
      <Link href={pageHref("kollektiv", "mitmachen")} style={{ color: "var(--acc-3-tint)" }}>kollektiv#mitmachen</Link>
      {text.slice(idx + marker.length)}
    </>
  );
}

/* Portierung von chipsHtml() aus events.js. */
function eventChips(ev: TakeoffEvent): { label: string; hot?: boolean }[] {
  const chips: { label: string; hot?: boolean }[] = [];
  if (ev.pricing?.label) chips.push({ label: ev.pricing.label, hot: true });
  for (const g of ev.genres ?? []) chips.push({ label: g });
  /* Nur kurze Altersmarken ("18+") werden zum Chip — db.json führt für
     Open Airs auch ausformulierte Sätze im selben Feld, die als Pille
     unlesbar würden. */
  if (ev.age && /^\d{1,2}\+$/.test(ev.age)) chips.push({ label: ev.age });
  return chips;
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

/* Beweis-Portierung: komplette Events-Seite aus dem Gateway gerendert —
   neue Events in der DB erscheinen hier automatisch (Karten, Flight Log,
   Menü-Zähler in Topbar/BurgerMenu). */
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

  return (
    <>
      <section className="phero">
        <div className="wrap">
          <p className="eyebrow">{page?.hero.eyebrow ?? "Flugplan"}</p>
          <h1 dangerouslySetInnerHTML={{ __html: heroTitleHtml }} />
          <p className="section-intro">
            {page?.hero.intro ?? "Alles, was ansteht — und alles, was war. Tippe eine Karte an für das Briefing."}
          </p>
          <div className="tminus" role="timer" aria-label="Countdown zum nächsten Event">
            <span className="label">T-Minus</span>
            <EventsTminusClock targetIso={tminusTarget} />
          </div>
        </div>
      </section>

      <section className="section" id="kommend" style={{ paddingTop: "clamp(30px, 5vh, 50px)" }}>
        <div className="wrap">
          <p className="eyebrow">{page?.sections.upcomingEyebrow ?? "Kommende Missionen"}</p>

          {up.length > 0 && (
            <div className="board">
              <div className="board-frame">
                <div className="board-toprow">
                  <span className="board-code" aria-hidden="true">{page?.board.code ?? "PDM"}</span>
                  <span className="board-title">{page?.board.title ?? "Abflugtafel"}</span>
                  <EventsBoardClock />
                </div>
                <div className="board-cols" aria-hidden="true">
                  <span>Gate</span><span>Datum</span><span>Mission</span><span>Ort</span><span>Status</span>
                </div>
              </div>
            </div>
          )}

          <div className="board-actions">
            <Link className="btn btn-ghost" href={pageHref("kalender")}>{page?.calendar.subscribeLabel ?? "Alle Termine abonnieren →"}</Link>
          </div>

          {up.length === 0 ? (
            <div className="transmission standby-state">
              <span className="tx-label">{page?.emptyState.eyebrow ?? "Standby"}</span>
              <p>
                <strong>{page?.emptyState.title ?? "Nächster Start in Vorbereitung"}</strong><br />
                <span className="es-text">{page?.emptyState.text ?? "Kein Event angekündigt — aber startklar. Telegram weiß es zuerst."}</span>
              </p>
              <div className="cta-row" style={{ justifyContent: "center", marginTop: 16 }}>
                <a className="btn btn-primary" href={s.telegram} target="_blank" rel="noopener">
                  {page?.emptyState.ctaLabel ?? "Telegram beitreten"}
                </a>
              </div>
            </div>
          ) : (
            <div className="card-grid">
              {up.map(e => {
                const label = computeLabel(e, boardingWindowH);
                const statusKey = statusKeyFor(label);
                const extra = page?.eventExtras?.[e.slug];
                const chips = eventChips(e);
                const transit = extra?.transit || e.venue.transit;
                const shareText = extra?.shareText || `${e.title} · ${e.weekday} ${fmtDate(e.date)} · ${e.venue.name}`;
                const noteLine = extra?.weatherNote
                  ? { icon: "🌧", text: extra.weatherNote }
                  : extra?.capacityNote
                    ? { icon: "⚠", text: extra.capacityNote }
                    : null;

                return (
                  <ExpandCard
                    key={e.slug}
                    style={{ "--card-acc": e.theme.accent, "--card-acc-rgb": e.theme.accentRgb } as React.CSSProperties}
                    more={
                      <>
                        <dl className="m-rows">
                          <div className="m-row"><dt>Boarding</dt><dd><b>{e.doors}</b>{e.end ? ` · ${e.end === "open end" ? "open end" : `Ende ${e.end}`}` : ""}</dd></div>
                          <div className="m-row"><dt>Landeplatz</dt><dd><b>{e.venue.name}</b><br />{transit || e.venue.address}</dd></div>
                          <div className="m-row"><dt>Eintritt</dt><dd><b>{e.pricing.label}</b>{e.age === "18+" ? " · 18+" : ""}</dd></div>
                          {e.genres.length > 0 && (
                            <div className="m-row"><dt>Sound</dt><dd>{e.genres.join(" · ")}</dd></div>
                          )}
                        </dl>
                        {e.venue.mapsQuery && (
                          <div className="route-row">
                            <a className="btn btn-ghost" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.venue.mapsQuery)}`} target="_blank" rel="noopener">Google Maps ↗</a>
                            <a className="btn btn-ghost" href={`https://maps.apple.com/?q=${encodeURIComponent(e.venue.mapsQuery)}`} target="_blank" rel="noopener">Apple Karten ↗</a>
                            <a className="btn btn-ghost" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(e.venue.mapsQuery)}`} target="_blank" rel="noopener">OSM ↗</a>
                          </div>
                        )}
                        {transit && <p className="lu-note">{transit}</p>}
                        <p className="m-brief">{e.brief}</p>
                        {noteLine && <p className="note-line">{noteLine.icon} {noteLine.text}</p>}
                        <div className="cta-row">
                          <Link className="btn btn-primary" href={eventHref(e.slug)}>Zur Missionsseite</Link>
                          <a className="btn btn-ghost" href="#" aria-disabled="true" title="Demo — echter Download kommt mit dem Backend">
                            {page?.calendar.ctaLabel ?? "＋ In den Kalender (.ics)"}
                          </a>
                          <EventsShareButton text={shareText} url={eventHref(e.slug)} copiedToast={page?.share?.copiedToast} />
                          <a className="btn btn-ghost" href={s.telegram} target="_blank" rel="noopener">
                            {e.state === "tba" ? "Telegram · zuerst erfahren" : "Telegram"}
                          </a>
                        </div>
                      </>
                    }
                  >
                    <span className="gate-tag" aria-hidden="true" />
                    <EventsStatusFlap label={label} statusKey={statusKey} />
                    <div className="patch" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        {PATCH_ICON_INNER[e.theme.patch] ?? PATCH_ICON_INNER.star}
                      </svg>
                    </div>
                    <div className="m-date">{e.weekday} <em>{fmtDate(e.date)}</em></div>
                    <h3>{e.title}</h3>
                    <p className="m-meta">
                      {e.venue.name}{e.doors && e.doors !== "TBA" ? ` · ab ${e.doors}` : ""} · {e.pricing.label}
                      <br />{e.subtitle}
                    </p>
                    {chips.length > 0 && (
                      <div className="chips">
                        {chips.map((c, i) => (
                          <span className={`chip${c.hot ? " hot" : ""}`} key={`${c.label}-${i}`}>{c.label}</span>
                        ))}
                      </div>
                    )}
                  </ExpandCard>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section className="section" id="flightlog">
        <div className="wrap">
          <EventsFlightLog
            events={flogEntries}
            eyebrow={page?.sections.flightlogEyebrow ?? "Flight Log"}
            titleHtml={page?.sections.flightlogTitleHtml ?? 'Bisherige <span class="glow">Missionen</span>'}
            toggleLabel={page?.patchLog?.toggleLabel ?? "War ich dabei"}
            toastTemplate={page?.patchLog?.toastTemplate ?? "Patch gespeichert — {count}/{total} Missionen"}
            resetLabel={page?.patchLog?.resetLabel ?? "Zurücksetzen"}
          />
          <p className="lu-note" style={{ marginTop: 18 }}>
            Galerien &amp; Sets folgen, sobald alle Abgebildeten gefragt wurden — <Link href={pageHref("kontakt")} style={{ color: "var(--acc-3-tint)" }}>kein Foto ohne Frage</Link>.
          </p>
        </div>
      </section>

      <section className="section" id="bpm">
        <div className="wrap">
          <header className="section-head">
            <p className="eyebrow">Sound-Check</p>
            <h2 className="h2">Finde deinen <span className="glow">Rave-Rhythmus</span></h2>
            <p className="section-intro">{page?.tapTempo?.intro ?? "Klopf mit — wir sagen dir, zu welchem Genre dein Tempo passt."}</p>
          </header>
          <EventsBpmTool genres={bpmGenres} />
        </div>
      </section>

      <section className="section" id="faq">
        <div className="wrap" style={{ maxWidth: 820 }}>
          <header className="section-head">
            <p className="eyebrow">Bevor du fragst</p>
            <h2 className="h2">Häufige <span className="glow">Fragen</span></h2>
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
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
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
