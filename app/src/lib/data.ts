/* ============================================================
   TakeoffData — zentraler Daten-Gateway (Server-Seite)

   Identische Idee wie im Prototyp: EIN Zugangspunkt für alle
   Inhalte, Backend austauschbar über Adapter. Heute liest der
   LocalJsonAdapter die eingecheckte JSON-DB; der Supabase-
   Adapter (Skizze unten) ersetzt ihn später, ohne dass eine
   Seite angefasst wird. Auth läuft dann ebenfalls hier.
   ============================================================ */
import "server-only";
import { cache } from "react";
import { promises as fs } from "fs";
import path from "path";
import rawDb from "@/data/db.json";
import type { Db, TakeoffEvent, EventTheme } from "./types";

interface Adapter {
  loadDb(): Promise<Db>;
  loadPage(slug: string): Promise<Record<string, unknown> | null>;
}

const LocalJsonAdapter: Adapter = {
  async loadDb() {
    return rawDb as unknown as Db;
  },
  async loadPage(slug) {
    // Nur einfache Slugs zulassen — kein Pfad-Traversal.
    if (!/^[a-z0-9-]+$/.test(slug)) return null;
    try {
      const p = path.join(process.cwd(), "src/data/pages", `${slug}.json`);
      return JSON.parse(await fs.readFile(p, "utf-8"));
    } catch {
      return null;
    }
  },
};

/* Später (Skizze):
const SupabaseAdapter: Adapter = {
  async loadDb() {
    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    const [settings, events, artists, ...] = await Promise.all([
      sb.from("settings").select().single(), sb.from("events").select("*"), ...
    ]);
    return { settings: settings.data, events: events.data, ... } as Db;
  },
  async loadPage(slug) {
    const { data } = await sb.from("pages").select("content").eq("slug", slug).maybeSingle();
    return data?.content ?? null;
  },
}; */

const adapter: Adapter = LocalJsonAdapter;

/* Pro Request genau EIN Ladevorgang. Heute (JSON) kostet das wenig; mit dem
   Supabase-Adapter wäre jede Gateway-Funktion sonst ein eigener Roundtrip —
   Topbar allein ruft settings() und nextEvent() auf. Muss VOR dem Umzug
   stehen, sonst wird der Adapter-Tausch teuer statt neutral. */
const db = cache(() => adapter.loadDb());
const today = () => new Date().toISOString().slice(0, 10);

export async function settings() {
  return (await db()).settings;
}

export async function events({ visibleOnly = true } = {}) {
  return (await db()).events.filter(e => !visibleOnly || e.visible !== false);
}

export async function event(slug: string) {
  return (await events({ visibleOnly: false })).find(e => e.slug === slug) ?? null;
}

export async function upcoming(): Promise<TakeoffEvent[]> {
  return (await events())
    .filter(e => e.state !== "past" && e.date >= today())
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function past(): Promise<TakeoffEvent[]> {
  return (await events())
    .filter(e => e.state === "past" || e.date < today())
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function nextEvent(): Promise<TakeoffEvent | null> {
  const s = (await db()).settings;
  return (await event(s.nextEventSlug)) ?? (await upcoming())[0] ?? null;
}

/* Regel des Auftraggebers: Die Startseite trägt IMMER das Theme des
   nächsten Events; ohne besonderes Theme gilt der normale Space-Himmel. */
export async function activeTheme(): Promise<Required<EventTheme>> {
  const t = (await nextEvent())?.theme ?? ({} as EventTheme);
  return {
    preset: t.preset || "space",
    accent: t.accent || "#e04fb4",
    accentRgb: t.accentRgb || "224 79 180",
    patch: t.patch || "star",
  };
}

export async function artists() {
  return (await db()).artists.filter(a => a.visible !== false);
}
export async function artist(slug: string) {
  return (await db()).artists.find(a => a.slug === slug) ?? null;
}
/* Partner/Familie. Stand bis It. 13 als `family` im Seiteninhalt von
   kollektiv.json — obwohl ein Entity-Contract dafuer existierte und die
   Partner auch in Event-Texten auftauchen. Nach der Projektregel gehoert
   solcher Inhalt dem Projekt, nicht einer Seite. */
export async function partners() {
  return ((await db()).partners ?? []).filter(p => p.visible !== false);
}
/** Partner eines Events — die Gegenrichtung von Partner.events. */
export async function partnersOfEvent(slug: string) {
  return (await partners()).filter(p => p.events?.includes(slug));
}

export async function guests() {
  return (await db()).guests;
}
export async function team() {
  return (await db()).team.filter(t => t.visible !== false);
}
export async function news() {
  return (await db()).news.slice().sort((a, b) => b.date.localeCompare(a.date));
}
export async function history() {
  return (await db()).history;
}

export async function pageContent<T = Record<string, unknown>>(slug: string): Promise<T | null> {
  const extra = await adapter.loadPage(slug);
  if (extra) return extra as T;
  return (((await db()).pages ?? {})[slug] as T) ?? null;
}

/* HUD-Ticker aus der Datenschicht.

   Vorher stand in settings.hudTicker fertiger Fließtext ("NEXT LAUNCH → SA
   12.09. …") — dieselben Angaben, die strukturiert in events[] liegen. Zwei
   Quellen für eine Wahrheit heißt: eine davon veraltet, und zwar still.
   Jetzt werden die Zeilen der kommenden Events erzeugt; hudTicker bleibt für
   zusätzliche redaktionelle Meldungen und wird ANGEHÄNGT, nicht ersetzt. */
export async function tickerLines(): Promise<string[]> {
  const [next, s] = await Promise.all([upcoming(), settings()]);
  const lines = next.map((e, i) => {
    const teile = [
      /* Im Ticker ohne Jahr — er zeigt nur Kommendes, da ist das Jahr Ballast
         (so hielt es auch der von Hand gepflegte Vorgänger). */
      `${i === 0 ? "NEXT LAUNCH → " : ""}${e.weekday} ${e.date.slice(8, 10)}.${e.date.slice(5, 7)}.`,
      e.title,
      e.venue.name,
      e.doors && e.doors !== "TBA" ? e.doors : "",
      e.pricing.label,
    ].filter(Boolean);
    return teile.join(" · ").toUpperCase();
  });
  return [...lines, ...s.hudTicker];
}

export function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}`;
}
