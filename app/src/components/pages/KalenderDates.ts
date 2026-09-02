/* ============================================================
   Reine Datums-/ICS-Helfer für /kalender — isomorph (Server UND Client,
   keine Browser-APIs, kein "use client" nötig), damit page.tsx (Timeline,
   Google-/ics-Links) und KalenderChrono.tsx (tickendes T-Minus/T-Plus)
   dieselbe Zeitzonen-Logik teilen statt sie zu duplizieren.

   Portierungs-Muster: assets/js/pages/kalender.js (berlinDate/eventTiming/
   googleCalUrl/icsVEvent). db.json liefert date+Zeit getrennt, ohne
   Offset, teils "TBA"/"open end"/"" — Europe/Berlin ist die einzige
   gültige Auslegung dieser Seite; Offset grob nach Sommerzeit-Fenster
   ergänzt (reicht für den Planungshorizont der Seite, wie im Original).
   ============================================================ */

export const HHMM = /^\d{2}:\d{2}$/;
export const pad = (n: number) => String(n).padStart(2, "0");

/** "SA" -> "Sa" (Anzeige in der Zeitleiste; CSS transformiert dt zusätzlich
    per text-transform, das hier ist für Screenreader die korrekte Fassung). */
export const capitalizeWeekday = (w: string) => (w ? w.charAt(0) + w.slice(1).toLowerCase() : "");

export function berlinDate(dateStr: string, timeStr?: string): Date {
  const t = HHMM.test(timeStr || "") ? (timeStr as string) : "00:00";
  const month = Number(dateStr.split("-")[1]);
  const offset = month > 3 && month < 10 ? "+02:00" : "+01:00";
  return new Date(`${dateStr}T${t}:00${offset}`);
}

export interface EvTiming {
  hasTime: boolean;
  start: Date | null;
  end: Date | null;
}

/** Ende fehlt/unlesbar -> 4h Platzhalterdauer; Ende <= Start -> Rollover über Mitternacht. */
export function eventTiming(date: string, doors: string, end: string): EvTiming {
  if (!HHMM.test(doors || "")) return { hasTime: false, start: null, end: null };
  const start = berlinDate(date, doors);
  let endD = HHMM.test(end || "") ? berlinDate(date, end) : new Date(start.getTime() + 4 * 3600e3);
  if (endD.getTime() <= start.getTime()) endD = new Date(endD.getTime() + 864e5);
  return { hasTime: true, start, end: endD };
}

export interface CalInfo {
  slug: string;
  title: string;
  date: string;
  doors: string;
  end: string;
  venueName?: string;
  address?: string;
  priceLabel?: string;
}

export function googleCalUrl(info: CalInfo): string | null {
  const { hasTime, start, end } = eventTiming(info.date, info.doors, info.end);
  if (!hasTime || !start || !end) return null;
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const loc = [info.venueName, info.address].filter(Boolean).join(", ");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `takeoff: ${info.title}`,
    dates: `${fmt(start)}/${fmt(end)}`,
  });
  if (loc) params.set("location", loc);
  if (info.priceLabel) params.set("details", info.priceLabel);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function icsEscape(s: string): string {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Ein VEVENT-Block, RFC5545-schlank (bewusst ohne 75-Oktett-Zeilenfaltung —
    Kalender-Apps tolerieren die etwas längeren Zeilen; Prototyp-Muster). */
export function icsVEvent(info: CalInfo): string {
  const { hasTime, start, end } = eventTiming(info.date, info.doors, info.end);
  const loc = [info.venueName, info.address].filter(Boolean).join(", ");
  const uid = `${info.slug || info.title.replace(/\s+/g, "-")}-${info.date}@takeoff-potsdam.de`;
  const lines = ["BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${icsStamp(new Date())}`];
  if (hasTime && start && end) {
    lines.push(`DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`);
  } else {
    // Datum bekannt, Uhrzeit nicht (z.B. "TBA") -> ganztägiger Eintrag statt
    // Ausschluss; DTEND ist bei VALUE=DATE exklusiv (naechster Tag).
    const startLocal = new Date(`${info.date}T00:00:00`);
    const endLocal = new Date(startLocal.getTime() + 864e5);
    const dPart = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    lines.push(`DTSTART;VALUE=DATE:${dPart(startLocal)}`, `DTEND;VALUE=DATE:${dPart(endLocal)}`);
  }
  lines.push(`SUMMARY:${icsEscape("takeoff: " + info.title)}`);
  if (loc) lines.push(`LOCATION:${icsEscape(loc)}`);
  if (info.priceLabel) lines.push(`DESCRIPTION:${icsEscape(info.priceLabel)}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

export function icsCalendar(vevents: string[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//takeoff potsdam//kalender//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");
}

/** T-Minus/T-Plus-Anzeige, als Zahlen statt HTML-String (kein
    dangerouslySetInnerHTML nötig — Aufrufer baut daraus JSX). */
export interface DeltaParts {
  days: number;
  hours: string;
  minutes: string;
  seconds: string;
}
export function deltaParts(ms: number): DeltaParts {
  const clamped = Math.max(0, ms);
  return {
    days: Math.floor(clamped / 864e5),
    hours: pad(Math.floor(clamped / 36e5) % 24),
    minutes: pad(Math.floor(clamped / 6e4) % 60),
    seconds: pad(Math.floor(clamped / 1e3) % 60),
  };
}
