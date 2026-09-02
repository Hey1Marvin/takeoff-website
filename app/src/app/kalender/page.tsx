import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { events, upcoming, past, nextEvent, pageContent, fmtDate } from "@/lib/data";
import { eventHref } from "@/lib/site";
import type { TakeoffEvent } from "@/lib/types";
import KalenderChrono from "@/components/pages/KalenderChrono";
import KalenderHeroActions from "@/components/pages/KalenderHeroActions";
import KalenderTimeline, { type KalenderTimelineItem, type KalenderRowCalendar } from "@/components/pages/KalenderTimeline";
import { capitalizeWeekday, eventTiming, googleCalUrl, icsCalendar, icsVEvent } from "@/components/pages/KalenderDates";
import "@/styles/pages/kalender.css";

export const metadata: Metadata = {
  title: "Eventkalender · takeoff potsdam",
  description: "Alle takeoff-Termine — einmal abonnieren, nie wieder ein Event verpassen. Jeder Termin schon heute einzeln als .ics oder Google-Kalender-Link.",
};

/* Spiegelt src/data/pages/kalender.json (siehe assets/js/pages/kalender.js
   im Prototyp für die 1:1-Referenz der Render-Logik, "Bordchronometer").
   Gegenüber dem Prototyp bewusst vereinfacht: KEIN eigenes clock.eventSlug-
   Override mehr — nextEvent() im Gateway trägt diese Entscheidung schon
   sitesweit (settings.nextEventSlug), ein zweites Override-Feld nur für
   diese Seite wäre eine zweite Quelle der Wahrheit für dieselbe Frage.

   It. 14: Auf der Seite steht kein deutscher Text mehr direkt im JSX —
   auch Kleinbeschriftungen ("Details", "Google Maps ↗", die Einheiten
   T/h/m/s der Uhr) kommen aus dieser Datei. */
interface KalenderPageContent {
  hero: { eyebrow: string; h1: string; intro: string };
  clock: {
    label: string;
    fallbackTarget: string;
    caption: string;
    tminusLabel: string;
    tplusLabel: string;
    liftoffLabel: string;
    liftoffNote: string;
    emptyValue: string;
    units: { days: string; hours: string; minutes: string; seconds: string };
  };
  calendarActions: {
    googleLabel: string;
    icsLabel: string;
    icsAllLabel: string;
    subscribeLabel: string;
    subscribeTitle: string;
    subscribeNote: string;
    tbaNote: string;
  };
  stats: { items: { mode: "auto" | "manual"; key?: string; value?: string; label: string }[] };
  monthGrid: {
    eyebrow: string;
    titleHtml: string;
    lead: string;
    monthsAhead: number;
    emptyMonthNote: string;
    todayLabel: string;
    eventLabel: string;
    gridLabelTemplate: string;
  };
  timeline: {
    eyebrow: string;
    titleHtml: string;
    lead: string;
    filters: { key: string; label: string }[];
    filterGroupLabel: string;
    detailsLabel: string;
    yearCountTemplate: string;
    yearCountSingular: string;
    todayLabel: string;
    emptyNote: string;
  };
  venues: { eyebrow: string; titleHtml: string; lead: string; mapsLabel: string };
  venueNotes: Record<string, string>;
  howto: { label: string; textHtml: string };
  faqSection: { eyebrow: string; titleHtml: string; lead: string };
  faq: { q: string; a: string }[];
  share: { label: string; text: string; copiedToast?: string };
  patchTeaser: { label: string; href: string };
}

const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function calInfo(e: TakeoffEvent) {
  return {
    slug: e.slug, title: e.title, date: e.date, doors: e.doors, end: e.end,
    venueName: e.venue.name, address: e.venue.address, priceLabel: e.pricing.label,
  };
}

/* ---------- Monatsgitter "Wann geht's los" — nur Monate mit Terminen. ---------- */
interface MonthCell { day: number; isToday: boolean; events: TakeoffEvent[] }
interface MonthCard { year: number; monthName: string; cells: (MonthCell | null)[] }

function buildMonthCards(upcomingEvents: TakeoffEvent[], monthsAhead: number, todayIso: string): MonthCard[] {
  const byMonth = new Map<string, TakeoffEvent[]>();
  upcomingEvents.forEach(ev => {
    const key = ev.date.slice(0, 7);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(ev);
  });

  const now = new Date();
  const cards: MonthCard[] = [];
  for (let i = 0; i < monthsAhead; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthEvents = byMonth.get(key);
    if (!monthEvents?.length) continue;

    const year = d.getFullYear(), month = d.getMonth();
    const monthName = new Intl.DateTimeFormat("de-DE", { month: "long" }).format(d);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Montag = 0
    const byDay = new Map<number, TakeoffEvent[]>();
    monthEvents.forEach(ev => {
      const day = Number(ev.date.slice(8, 10));
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(ev);
    });

    const cells: (MonthCell | null)[] = [];
    for (let p = 0; p < firstDow; p++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ day, isToday: dayStr === todayIso, events: byDay.get(day) ?? [] });
    }
    cards.push({ year, monthName, cells });
  }
  return cards;
}

/* ---------- Venue-Kurzverzeichnis — aus upcoming() dedupliziert. ---------- */
interface VenueCard { name: string; address: string; transit: string; mapsQuery: string; note?: string }

function buildVenues(upcomingEvents: TakeoffEvent[], notes: Record<string, string>): VenueCard[] {
  const seen = new Map<string, VenueCard>();
  upcomingEvents.forEach(ev => {
    const v = ev.venue;
    if (!v?.name || seen.has(v.name)) return;
    seen.set(v.name, { name: v.name, address: v.address, transit: v.transit, mapsQuery: v.mapsQuery, note: notes[v.name] });
  });
  return [...seen.values()];
}

/* ---------- Zeitleiste — Jahres-/Heute-Trenner + Kalender-Aktionen je Zeile.
   sortedEvents muss bereits aufsteigend nach date sortiert sein. ---------- */
function buildTimelineItems(
  sortedEvents: TakeoffEvent[],
  todayIso: string,
  cfg: { yearCountTemplate: string; yearCountSingular: string; todayLabel: string; tbaNote: string },
): KalenderTimelineItem[] {
  const items: KalenderTimelineItem[] = [];
  const countByYear = new Map<string, number>();
  sortedEvents.forEach(ev => {
    const y = ev.date.slice(0, 4);
    countByYear.set(y, (countByYear.get(y) ?? 0) + 1);
  });

  let lastYear: string | null = null;
  let todayInserted = false;

  sortedEvents.forEach(ev => {
    if (!todayInserted && ev.date >= todayIso) {
      items.push({ kind: "today", id: "today-divider", dtLabel: cfg.todayLabel, ddLabel: "" });
      todayInserted = true;
    }
    const year = ev.date.slice(0, 4);
    if (year !== lastYear) {
      const count = countByYear.get(year) ?? 0;
      const ddLabel = count === 1
        ? cfg.yearCountSingular
        : cfg.yearCountTemplate.replace("{n}", String(count));
      items.push({ kind: "year", id: `year-${year}`, dtLabel: year, ddLabel });
      lastYear = year;
    }

    const isUpcoming = ev.date >= todayIso && ev.state !== "past";
    let calendar: KalenderRowCalendar | null = null;
    if (isUpcoming) {
      const info = calInfo(ev);
      const { hasTime } = eventTiming(ev.date, ev.doors, ev.end);
      calendar = hasTime
        ? { googleUrl: googleCalUrl(info), icsContent: icsVEvent(info), tbaNote: null }
        : { googleUrl: null, icsContent: null, tbaNote: cfg.tbaNote };
    }

    items.push({
      kind: "event",
      id: `ev-${ev.slug}`,
      slug: ev.slug,
      href: eventHref(ev.slug),
      date: ev.date,
      dtLabel: `${capitalizeWeekday(ev.weekday)} ${fmtDate(ev.date)}`,
      title: ev.title,
      venueName: ev.venue.name,
      priceLabel: ev.pricing.label,
      calendar,
    });
  });

  if (!todayInserted) items.push({ kind: "today", id: "today-divider", dtLabel: cfg.todayLabel, ddLabel: "" });
  return items;
}

export default async function KalenderPage() {
  const [page, all, up, gone, next] = await Promise.all([
    pageContent<KalenderPageContent>("kalender"),
    events(),
    upcoming(),
    past(),
    nextEvent(),
  ]);
  if (!page) notFound();

  const todayIso = new Date().toISOString().slice(0, 10);
  const venueCount = new Set(up.map(e => e.venue.name).filter(Boolean)).size;
  const statCounts: Record<string, number> = { upcomingCount: up.length, pastCount: gone.length, venueCount };

  const monthCards = buildMonthCards(up, page.monthGrid.monthsAhead, todayIso);
  const venueCards = buildVenues(up, page.venueNotes);
  const sortedAll = [...all].sort((a, b) => a.date.localeCompare(b.date));
  const timelineItems = buildTimelineItems(sortedAll, todayIso, {
    yearCountTemplate: page.timeline.yearCountTemplate,
    yearCountSingular: page.timeline.yearCountSingular,
    todayLabel: page.timeline.todayLabel,
    tbaNote: page.calendarActions.tbaNote,
  });
  const allIcsContent = up.length ? icsCalendar(up.map(e => icsVEvent(calInfo(e)))) : null;
  const lastPast = gone[0] ?? null;

  return (
    <>
      {/* ---------- Kopf: das Instrument steht in der Mitte, nicht in einer
           linken Spalte. Als einzige Seite der Site ist /kalender um eine
           senkrechte Achse gebaut — ein Chronometer ist ein rundes Objekt,
           und die Anordnung T–Plus | Jetzt | T–Minus liest sich selbst als
           Zeitachse. ---------- */}
      <section className="phero bc-phero">
        <div className="wrap bc-hero">
          <p className="eyebrow bc-eyebrow">{page.hero.eyebrow}</p>
          <h1 dangerouslySetInnerHTML={{ __html: page.hero.h1 }} />
          <p className="section-intro bc-intro">{page.hero.intro}</p>

          <KalenderChrono
            clockAriaLabel={page.clock.label}
            caption={page.clock.caption}
            tminusLabel={page.clock.tminusLabel}
            tplusLabel={page.clock.tplusLabel}
            liftoffLabel={page.clock.liftoffLabel}
            liftoffNote={page.clock.liftoffNote}
            emptyValue={page.clock.emptyValue}
            units={page.clock.units}
            fallbackTarget={page.clock.fallbackTarget}
            nextTitle={next?.title ?? null}
            nextDate={next?.date ?? null}
            nextDoors={next?.doors ?? null}
            lastPastDate={lastPast?.date ?? null}
            lastPastDoors={lastPast?.doors ?? null}
          />

          <KalenderHeroActions
            subscribeLabel={page.calendarActions.subscribeLabel}
            subscribeTitle={page.calendarActions.subscribeTitle}
            shareLabel={page.share.label}
            shareText={page.share.text}
            copiedToast={page.share.copiedToast}
          />
          <p className="bc-subnote txfit">{page.calendarActions.subscribeNote}</p>
        </div>
      </section>

      {/* Eigene <section> statt eines nackten <div class="wrap">: die
          Tagmodus-Platte in scene-day.css haengt an den DIREKTEN Kindern von
          <main>. Als 1120px-Kasten bekam das Statistikband dort eine helle
          Platte nur auf seiner eigenen Breite — links und rechts stand ein
          harter schwarzer Riegel. Fensterbreite Sektion, Platte laeuft durch. */}
      <section className="bc-statsband">
        <div className="wrap">
          <div className="stats">
            {page.stats.items.map((item, i) => (
              <div key={i}>
                <b>{item.mode === "manual" ? item.value : statCounts[item.key ?? ""]}</b>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Ab hier: Rubrik links, Inhalt rechts. Die Ueberschrift ist
           kein Displaymoment mehr, sondern eine mitlaufende Rubrik — dadurch
           traegt die Seite ihren Inhalt ueber die volle Spaltenbreite statt
           in einer 760px-Saeule mit toter Flaeche daneben. ---------- */}
      <section className="bc-lane" id="monatsgitter">
        <div className="wrap bc-grid">
          <div className="bc-rubric">
            <header className="section-head">
              <p className="eyebrow">{page.monthGrid.eyebrow}</p>
              <h2 className="h2" dangerouslySetInnerHTML={{ __html: page.monthGrid.titleHtml }} />
              <p className="bc-lead">{page.monthGrid.lead}</p>
            </header>
          </div>

          <div className="bc-body">
            {monthCards.length > 0 ? (
              <div className="bc-months">
                {monthCards.map(card => (
                  <div className="bc-month" key={`${card.year}-${card.monthName}`}>
                    <div className="bc-month-head"><b>{card.monthName}</b><span>{card.year}</span></div>
                    <div className="bc-weekdays" aria-hidden="true">
                      {WEEKDAY_LABELS.map(w => <span key={w}>{w}</span>)}
                    </div>
                    <div
                      className="bc-month-grid"
                      aria-label={page.monthGrid.gridLabelTemplate
                        .replace("{month}", card.monthName)
                        .replace("{year}", String(card.year))}
                    >
                      {card.cells.map((cell, i) => {
                        if (!cell) return <span className="bc-day is-pad" aria-hidden="true" key={i} />;
                        if (cell.events.length > 0) {
                          const titles = cell.events.map(e => e.title).join(" · ");
                          const label = `${cell.day}. ${card.monthName}${cell.isToday ? ` — ${page.monthGrid.todayLabel}` : ""} — ${page.monthGrid.eventLabel}: ${titles}`;
                          return (
                            <a
                              className={`bc-day has-event${cell.isToday ? " is-today" : ""}`}
                              href={`#ev-${cell.events[0].slug}`}
                              aria-label={label}
                              key={i}
                            >
                              {cell.day}
                            </a>
                          );
                        }
                        if (cell.isToday) {
                          return (
                            <span className="bc-day is-today" aria-label={`${cell.day}. ${card.monthName} — ${page.monthGrid.todayLabel}`} key={i}>
                              {cell.day}
                            </span>
                          );
                        }
                        return <span className="bc-day" key={i}>{cell.day}</span>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="bc-months-empty txfit">{page.monthGrid.emptyMonthNote}</p>
            )}
          </div>
        </div>
      </section>

      <section className="bc-lane" id="termine">
        <div className="wrap bc-grid">
          <div className="bc-rubric">
            <header className="section-head">
              <p className="eyebrow">{page.timeline.eyebrow}</p>
              <h2 className="h2" dangerouslySetInnerHTML={{ __html: page.timeline.titleHtml }} />
              <p className="bc-lead">{page.timeline.lead}</p>
            </header>
          </div>

          <div className="bc-body">
            <KalenderTimeline
              items={timelineItems}
              todayIso={todayIso}
              filters={page.timeline.filters}
              filterGroupLabel={page.timeline.filterGroupLabel}
              detailsLabel={page.timeline.detailsLabel}
              emptyNote={page.timeline.emptyNote}
              cal={{
                googleLabel: page.calendarActions.googleLabel,
                icsLabel: page.calendarActions.icsLabel,
                icsAllLabel: page.calendarActions.icsAllLabel,
              }}
              allIcsContent={allIcsContent}
            />

            <p className="bc-patch-teaser">
              <Link href={page.patchTeaser.href}>{page.patchTeaser.label}</Link>
            </p>
          </div>
        </div>
      </section>

      <section className="bc-lane" id="landeplaetze">
        <div className="wrap bc-grid">
          <div className="bc-rubric">
            <header className="section-head">
              <p className="eyebrow">{page.venues.eyebrow}</p>
              <h2 className="h2" dangerouslySetInnerHTML={{ __html: page.venues.titleHtml }} />
              <p className="bc-lead">{page.venues.lead}</p>
            </header>
          </div>

          <div className="bc-body">
            <div className="bc-venues">
              {venueCards.map(v => (
                <div className="bc-venue" key={v.name}>
                  <div className="vcard">
                    <span className="vname" translate="no">{v.name}</span>
                    {v.address && <span className="vaddr">{v.address}</span>}
                    {v.transit && <span className="vhint">{v.transit}</span>}
                  </div>
                  {v.note && <p className="bc-venue-note">{v.note}</p>}
                  <div className="route-row">
                    <a
                      className="btn btn-ghost"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.mapsQuery || v.address || v.name)}`}
                      target="_blank"
                      rel="noopener"
                    >
                      {page.venues.mapsLabel}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Abo-Erklaerung und Abo-Fragen gehoeren zusammen — vorher waren es zwei
          Sektionen, eine davon nur mit einem einzigen Kasten darin. */}
      <section className="bc-lane" id="abo-faq">
        <div className="wrap bc-grid">
          <div className="bc-rubric">
            <header className="section-head">
              <p className="eyebrow">{page.faqSection.eyebrow}</p>
              <h2 className="h2" dangerouslySetInnerHTML={{ __html: page.faqSection.titleHtml }} />
              <p className="bc-lead">{page.faqSection.lead}</p>
            </header>
          </div>

          <div className="bc-body">
            <div className="transmission">
              <span className="tx-label">{page.howto.label}</span>
              <p dangerouslySetInnerHTML={{ __html: page.howto.textHtml }} />
            </div>

            <div className="bc-faqlist">
              {page.faq.map(item => (
                <details className="faq" key={item.q}>
                  <summary>{item.q}</summary>
                  <div className="faq-body">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
