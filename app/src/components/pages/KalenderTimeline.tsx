"use client";
/* Zeitleiste "Alle Termine auf einen Blick" — Termin-Zeilen sind bereits
   fertig (sortiert, mit Jahres-/Heute-Trennern) aus dem Gateway gebaut
   (page.tsx, Server-Teil); diese Komponente übernimmt nur, was echte
   Browser-Interaktion braucht: Filter (all/upcoming/past) + .ics-Downloads
   (Blob/ObjectURL sind Browser-APIs, der .ics-Text selbst kommt bereits
   fix vorgerechnet vom Server mit).

   Zeilen bleiben beim Filtern über das native `hidden`-Attribut im DOM
   (kein Array-.filter() vor dem Rendern) — sonst würden die #ev-<slug>-
   Sprungziele des Monatsgitters bei aktivem Filter plötzlich fehlen. */
import Link from "next/link";
import { useMemo, useState } from "react";

export interface KalenderRowCalendar {
  googleUrl: string | null;
  icsContent: string | null;
  tbaNote: string | null;
}
export interface KalenderRow {
  kind: "event";
  id: string;
  slug: string;
  href: string;
  date: string;
  dtLabel: string;
  title: string;
  venueName: string;
  priceLabel: string;
  calendar: KalenderRowCalendar | null;
}
export interface KalenderDivider {
  kind: "year" | "today";
  id: string;
  dtLabel: string;
  ddLabel: string;
}
export type KalenderTimelineItem = KalenderRow | KalenderDivider;

function isVisible(item: KalenderTimelineItem, filter: string, todayIso: string): boolean {
  if (filter === "all") return true;
  if (item.kind !== "event") return false;   // Trenner nur in der Gesamtansicht
  const isPast = item.date < todayIso;
  return filter === "upcoming" ? !isPast : isPast;
}

function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default function KalenderTimeline({
  items, todayIso, filters, emptyNote, cal, allIcsContent,
}: {
  items: KalenderTimelineItem[];
  todayIso: string;
  filters: { key: string; label: string }[];
  emptyNote: string;
  cal: { googleLabel: string; icsLabel: string; icsAllLabel: string };
  allIcsContent: string | null;
}) {
  const [filter, setFilter] = useState("all");

  const visibleCount = useMemo(
    () => items.filter(it => it.kind === "event" && isVisible(it, filter, todayIso)).length,
    [items, filter, todayIso]
  );

  return (
    <>
      <div className="bc-toolbar">
        <div className="bc-filterbar" role="group" aria-label="Zeitleiste filtern">
          {filters.map(f => (
            <button
              key={f.key}
              type="button"
              className={`chip${filter === f.key ? " hot" : ""}`}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {allIcsContent && (
          <button type="button" className="btn btn-ghost" onClick={() => downloadIcs("takeoff-termine.ics", allIcsContent)}>
            {cal.icsAllLabel}
          </button>
        )}
      </div>

      <dl className="m-rows" style={{ borderTop: "1px solid var(--bg-hairline)" }}>
        {items.map(item => {
          const hidden = !isVisible(item, filter, todayIso);

          // Discriminant-Reihenfolge ist wichtig: "event" hat einen einzelnen
          // Literalwert, TS kann ihn deshalb sauber ausschliessen und den Rest
          // zu KalenderDivider verengen. Umgekehrt (erst "year", dann "today"
          // separat pruefen) narrowt TS NICHT kumulativ, weil beide Werte zum
          // selben mehrwertigen kind: "year" | "today"-Discriminanten gehoeren.
          if (item.kind !== "event") {
            return (
              <div className={`m-row bc-${item.kind}`} key={item.id} hidden={hidden}>
                <dt>{item.dtLabel}</dt><dd>{item.kind === "year" ? item.ddLabel : ""}</dd>
              </div>
            );
          }

          return (
            <div className="m-row" id={item.id} key={item.id} hidden={hidden}>
              <dt>{item.dtLabel}</dt>
              <dd>
                <b>{item.title}</b>
                {item.venueName && <> · {item.venueName}</>}
                {item.priceLabel && <> · {item.priceLabel}</>}
                {" · "}<Link href={item.href} style={{ color: "var(--acc-3-tint)" }}>Details</Link>
                {item.calendar && (
                  <div className={`bc-caladd${item.calendar.tbaNote ? " is-tba" : ""}`}>
                    {item.calendar.tbaNote ? (
                      item.calendar.tbaNote
                    ) : (
                      <>
                        {item.calendar.googleUrl && (
                          <a href={item.calendar.googleUrl} target="_blank" rel="noopener">{cal.googleLabel}</a>
                        )}
                        {item.calendar.icsContent && (
                          <button
                            type="button"
                            onClick={() => downloadIcs(`takeoff-${item.slug}.ics`, item.calendar!.icsContent!)}
                          >
                            {cal.icsLabel}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="bc-empty" hidden={visibleCount !== 0}>{emptyNote}</p>
    </>
  );
}
