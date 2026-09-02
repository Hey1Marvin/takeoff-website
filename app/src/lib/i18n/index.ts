/* ============================================================
   i18n — Interface-Texte DE/EN

   Vertrag (AGENTS.md): UI-Chrome-Texte werden NIE im JSX
   hartkodiert, sondern hier nachgeschlagen.

   ── Woher die Texte kommen ─────────────────────────────────
   Uebernommen aus dem fertigen Woerterbuch des Prototyps,
   prototype/assets/js/i18n.js (Laufzeit dort:
   prototype/assets/js/i18n-runtime.js). Schluesselnamen sind
   1:1 dieselben — wer Markup aus dem Prototyp portiert, kann
   ein data-i18n="nav.events" direkt zu t("nav.events") machen.

   ── Was hier bewusst FEHLT: die Inhaltsdaten ───────────────
   Das Woerterbuch des Prototyps trennt sich selbst an einer
   Stelle, die es "CMS-GRENZE" nennt (i18n.js Z. 710 fuer den
   deutschen, Z. 1535 fuer den englischen Block):

     OBERHALB  Interface — Nav, Menue, Footer, Buttons,
               aria-Labels, Mission Control, Fehlermeldungen,
               js.*-Laufzeittexte.   → steht in de.ts / en.ts
     UNTERHALB Inhaltsdaten — event.* · flog.* · artist.* ·
               artistpage.* · venue.* · partner.* · guest.* ·
               hist.*   → steht hier NICHT.

   Diese rund 189 Schluessel je Sprache sind keine UI-Strings,
   sondern Datensaetze. In der App kommen dieselben Inhalte aus
   src/data/db.json und src/data/pages/*.json ueber den Gateway
   (src/lib/data.ts). Sie doppelt zu pflegen — einmal in der
   Datenbank, einmal im Woerterbuch — waere genau der stille
   Textverlust, vor dem der Prototyp selbst warnt.

   Mehrsprachige Inhalte sind deshalb eine Aufgabe der
   Datenschicht, nicht dieses Moduls: geplant als Overlay je
   Datensatz, "i18n": { "en": { … } }, aufgeloest im Gateway.
   Wer die englischen Inhaltstexte sucht: sie liegen fertig
   uebersetzt in prototype/assets/js/i18n.js ab Z. 1535 und
   koennen von dort in die Datensaetze wandern.

   ── Kein Locale-Routing ────────────────────────────────────
   Umgeschaltet wird ohne Reload und ohne URL-Aenderung (wie im
   Prototyp): keine /en/-Pfade, keine Middleware, kein
   generateStaticParams je Sprache. Der Zustand lebt im
   I18nProvider und in localStorage("takeoff-lang").
   Serverseitig gilt immer DEFAULT_LOCALE.

   ── Verhaeltnis zu src/lib/intern/i18n.ts ──────────────────
   Der Crew-Bereich hat eine eigene Textdatei mit gleichem
   Muster (ct(key) => string). Ihr Kommentar haelt fest, dass
   sie "spaeter dort eingegliedert" wird. Damit das ohne Umbau
   geht, ist t() hier so geschnitten, dass ct() zur Einzeiler-
   Weiterleitung wird:

       export const ct = (key: CrewKey) => t(key);

   Noetig dafuer beim Zusammenlegen: die Crew-Schluessel wandern
   nach de.ts/en.ts (dotted, z. B. "crew.nav.arbeit"), CrewKey
   wird ein Subtyp von Key, CrewLocale ein Alias von Locale.
   Bis dahin bleibt intern/i18n.ts unangetastet.
   ============================================================ */

import { de, type Key } from "./de";
import { en } from "./en";

export type Locale = "de" | "en";
export type { Key };

export const LOCALES: Locale[] = ["de", "en"];
export const DEFAULT_LOCALE: Locale = "de";

/** Der localStorage-Schluessel — derselbe wie im Prototyp. */
export const LANG_STORAGE_KEY = "takeoff-lang";

/** Attribut auf <html>, das eine Seite auf Deutsch festnagelt
 *  (Impressum, Datenschutz — Rechtstexte bleiben verbindlich
 *  deutsch). Muster: i18n-runtime.js Z. 39. */
export const LANG_LOCK_ATTR = "data-lang-lock";

const dict: Record<Locale, Record<string, string>> = { de, en };

export function isLocale(value: unknown): value is Locale {
  return value === "de" || value === "en";
}

/** Sprache aus beliebigem Input normalisieren (localStorage,
 *  Attribut, navigator.language) — Unbekanntes wird Deutsch. */
export function normalizeLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export type Vars = Record<string, string | number>;

/* Platzhalter der Form {name}.

   Vorsicht aus dem Prototyp uebernommen (i18n-runtime.js
   Z. 46–59): ein Text mit Platzhaltern, dem die Variablen
   fehlen, wird NICHT gesetzt — sonst stuende woertlich
   "{time} Uhr" auf der Seite. Hier heisst "nicht setzen":
   fill() gibt null zurueck, und der Aufrufer entscheidet.
   t() macht daraus einen leeren String (rendert nichts),
   tOrNull() reicht das null durch. */
const VAR_RE = /\{(\w+)\}/g;

function fill(str: string, vars?: Vars): string | null {
  if (!str.includes("{")) return str;
  if (!vars) return null;
  let missing = false;
  const out = str.replace(VAR_RE, (_m, name: string) => {
    const v = vars[name];
    if (v === undefined || v === null) {
      missing = true;
      return `{${name}}`;
    }
    return String(v);
  });
  return missing ? null : out;
}

/** Rohwert nachschlagen — Englisch, sonst still Deutsch.
 *  Nie leerer Text: eine Luecke in en faellt auf de zurueck. */
function lookup(key: Key, locale: Locale): string | undefined {
  const table = dict[locale] ?? dict[DEFAULT_LOCALE];
  const raw = table[key as string];
  return raw !== undefined ? raw : dict[DEFAULT_LOCALE][key as string];
}

/**
 * Text nachschlagen, ohne Notloesung.
 *
 * Gibt `null` zurueck, wenn der Schluessel unbekannt ist oder
 * ein Platzhalter nicht gefuellt werden kann. Fuer Stellen, an
 * denen lieber gar nichts als etwas Kaputtes stehen soll:
 *
 *     const s = tOrNull("common.time", locale, { time: "22:00" });
 *     return s ? <span>{s}</span> : null;
 */
export function tOrNull(key: Key, locale: Locale = DEFAULT_LOCALE, vars?: Vars): string | null {
  const raw = lookup(key, locale);
  if (raw === undefined) return null;
  return fill(raw, vars);
}

/**
 * Der Normalfall: liefert immer einen String.
 *
 *     t("nav.events")                       // Deutsch (Server)
 *     t("nav.events", locale)               // mit Sprache aus dem Provider
 *     t("common.time", locale, { time: "22:00" })
 *
 * Kann ein Platzhalter nicht gefuellt werden, kommt "" zurueck
 * (rendert nichts) statt eines sichtbaren "{time} Uhr". Im
 * Dev-Build gibt es dazu eine Warnung — im Prod-Build nicht,
 * dort soll eine Textluecke die Seite nicht zumuellen.
 */
export function t(key: Key, locale: Locale = DEFAULT_LOCALE, vars?: Vars): string {
  const out = tOrNull(key, locale, vars);
  if (out !== null) return out;
  if (process.env.NODE_ENV !== "production") {
    const raw = lookup(key, locale);
    console.warn(
      raw === undefined
        ? `[i18n] Unbekannter Schluessel: "${String(key)}"`
        : `[i18n] Platzhalter ohne Wert in "${String(key)}": "${raw}"`,
    );
  }
  return "";
}

/**
 * Vorgebundene Variante fuer eine Sprache — praktisch in
 * Komponenten, die viele Texte brauchen:
 *
 *     const tt = translator(locale);
 *     tt("nav.events");
 */
export function translator(locale: Locale = DEFAULT_LOCALE) {
  return (key: Key, vars?: Vars): string => t(key, locale, vars);
}

export { de, en };

/* ============================================================
   Datum je Sprache.

   `fmtDate()` im Gateway liefert bewusst weiterhin das deutsche `TT.MM.JJ` —
   es rendert serverseitig, wo die (clientseitig umschaltbare) Sprache noch
   nicht feststeht. Alles, was im Chrome MIT der Sprache wechseln soll, geht
   stattdessen hierdurch und bekommt das ISO-Datum gereicht.

   Auch der Wochentag kommt von hier statt aus dem gespeicherten Feld
   `weekday` ("SA") — das ist deutsch und hat auf einer englischen Seite
   nichts verloren.
   ============================================================ */
const INTL_LOCALE: Record<Locale, string> = { de: "de-DE", en: "en-GB" };

export function formatEventDate(iso: string, locale: Locale = DEFAULT_LOCALE): string {
  const d = new Date(iso + "T12:00:00");          // Mittag: keine Zeitzonen-Rutscher
  if (Number.isNaN(d.getTime())) return iso;
  const wd = new Intl.DateTimeFormat(INTL_LOCALE[locale], { weekday: "short" })
    .format(d).replace(".", "").toUpperCase();
  const rest = locale === "de"
    ? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(d)
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(d);
  return `${wd} ${rest}`;
}

/* Beschriftung eines SITE_LINKS-Eintrags. Der Link-Generator kennt nur einen
   String-Schluessel (er darf nicht von i18n abhaengen, sonst haengen die
   beiden Verträge im Kreis) — hier wird er geprueft und aufgeloest.
   Unbekannter oder fehlender Schluessel: deutscher Fallback statt leerem Text. */
export function tLabel(key: string | undefined, fallback: string, locale: Locale = DEFAULT_LOCALE): string {
  if (!key || !(key in de)) return fallback;
  return t(key as Key, locale);
}
