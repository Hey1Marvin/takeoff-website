"use client";

/* ============================================================
   Sprachzustand der App — DE/EN ohne Reload.

   Bewusst kein Locale-Routing: keine /en/-Pfade, keine
   Middleware, keine zweite Route je Seite. Der Prototyp schaltet
   im laufenden Dokument um (prototype/assets/js/i18n-runtime.js),
   und dabei bleibt es — ein offenes Overlay-Menue bleibt beim
   Wechsel offen, die URL aendert sich nicht, nichts laedt neu.

   ── SSR und Hydration ──────────────────────────────────────
   Serverseitig gibt es kein localStorage, also gilt dort immer
   DEFAULT_LOCALE ("de"). Der erste Client-Render muss dasselbe
   liefern, sonst schimpft React ueber einen Hydration-Mismatch.
   Beide Aussenwerte — Sprache und Sperrvermerk — kommen deshalb
   ueber useSyncExternalStore mit einem Server-Schnappschuss
   ("de" bzw. "nicht gesperrt"): React nimmt ihn beim Rendern auf
   dem Server UND beim Hydrieren und wechselt erst danach auf den
   echten Wert. Ein Render mit deutschem Text geht dem englischen
   also voraus — sichtbar nur als kurzes Aufblitzen bei Nutzern,
   die auf Englisch gestellt haben.

   Ganz weg bekommt man das Aufblitzen nur mit einer Information,
   die der Server schon kennt (Cookie statt localStorage) — das
   waere ein bewusster Schnitt und ist hier absichtlich nicht
   gemacht, weil der Prototyp-Vertrag localStorage vorgibt.
   Was der Orchestrator im Boot-Script (layout.tsx) ergaenzen
   kann, ist das Stempeln von <html lang> vor dem ersten Zeichnen
   — analog zu takeoff-fx/takeoff-theme. Das kollidiert nicht:
   lang ist ein Attribut, kein React-State, und dieser Provider
   liest es beim Mount als Startwert mit.

   ── Rechtstexte bleiben deutsch ────────────────────────────
   Traegt <html> das Attribut data-lang-lock (Impressum,
   Datenschutz), bleibt die Seite auf Deutsch und der Umschalter
   ist tot. Gesetzt wird das Attribut ueber <LangLock /> weiter
   unten in dieser Datei; erkannt wird es per MutationObserver am
   <html>-Element — so greift es auch, wenn es woanders gesetzt
   wird, und verschwindet beim Seitenwechsel wieder von selbst.
   Alternativ nimmt der Provider die Prop locked.
   Muster: i18n-runtime.js Z. 39 und Z. 154.
   ============================================================ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LANG_LOCK_ATTR,
  LANG_STORAGE_KEY,
  normalizeLocale,
  t as translate,
  type Key,
  type Locale,
  type Vars,
} from "@/lib/i18n";
/* ^ explizites "/index": solange die alte Datei src/lib/i18n.ts
   daneben liegt, gewinnt sie bei "@/lib/i18n" die Modulaufloesung.
   Sobald der Orchestrator sie entfernt hat, kann das "/index" weg. */

/* Storage darf nie eine Komponente killen — Safari Private Mode
   und Sandbox-iframes werfen beim blossen Zugriff. Gleiche
   Vorsichtsmassnahme wie im Prototyp, an beiden Stellen. */
const store = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* egal — dann merkt sich der Browser die Sprache eben nicht */
    }
  },
};

/* ── Zwei externe Quellen, zwei Abonnements ─────────────────
   Sprache und Sperrvermerk leben ausserhalb von React (im
   localStorage und am <html>-Element). Genau dafuer ist
   useSyncExternalStore da: es liefert beim Server-Rendern UND
   beim Hydrieren den Server-Schnappschuss und wechselt erst
   danach auf den echten Wert. Das haelt die Hydration sauber,
   ohne setState im Effekt — und ein setState im Effekt waere
   hier auch inhaltlich falsch: der Wert kann sich jederzeit
   von aussen aendern (zweiter Tab, gesetztes Attribut), nicht
   nur beim Mount. */

/* --- Quelle 1: gewaehlte Sprache (localStorage) --- */
const langListeners = new Set<() => void>();
let langCache: Locale | null = null;

/* Die Auswahl dieser Sitzung. Wichtig fuer den Fall, dass
   localStorage gar nicht schreibt (Safari Private Mode,
   Sandbox-iframe): ohne diesen Merker laege die Wahrheit
   ausschliesslich im Storage, und ein Klick auf EN haette dort
   schlicht keine Wirkung. Der Prototyp hat das Problem nicht,
   weil er html.lang direkt setzt und von dort zurueckliest. */
let langChoice: Locale | null = null;

function readLang(): Locale {
  if (langChoice !== null) return langChoice;
  const stored = store.get(LANG_STORAGE_KEY);
  /* Zweite Quelle: ein Boot-Script, das <html lang> schon vor dem
     ersten Zeichnen gestempelt hat. So bleibt der Provider mit
     einem spaeter ergaenzten Boot-Script vertraeglich. */
  return normalizeLocale(stored ?? document.documentElement.lang);
}

function getLangSnapshot(): Locale {
  if (langCache === null) langCache = readLang();
  return langCache;
}

function emitLang(): void {
  langCache = null;
  for (const listener of langListeners) listener();
}

function onStorage(e: StorageEvent): void {
  if (e.key !== LANG_STORAGE_KEY) return; /* zweiter Tab */
  langChoice = normalizeLocale(e.newValue);
  emitLang();
}

function subscribeLang(onChange: () => void): () => void {
  langListeners.add(onChange);
  if (langListeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    langListeners.delete(onChange);
    if (langListeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

function writeLang(next: Locale): void {
  langChoice = next;
  store.set(LANG_STORAGE_KEY, next);
  emitLang();
}

/* --- Quelle 2: Sperrvermerk am <html>-Element ---
   Beobachtet statt einmal gelesen: <LangLock /> setzt das
   Attribut in einem Effekt, und beim Verlassen der Seite faellt
   es wieder weg. Ein MutationObserver bekommt beides mit, ohne
   dass sich der Provider auf die Reihenfolge von Effekten oder
   auf einen Pfadwechsel verlassen muesste. */
const lockListeners = new Set<() => void>();
let lockObserver: MutationObserver | null = null;

function getLockSnapshot(): boolean {
  return document.documentElement.hasAttribute(LANG_LOCK_ATTR);
}

function subscribeLock(onChange: () => void): () => void {
  lockListeners.add(onChange);
  if (!lockObserver) {
    lockObserver = new MutationObserver(() => {
      for (const listener of lockListeners) listener();
    });
    lockObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [LANG_LOCK_ATTR],
    });
  }
  return () => {
    lockListeners.delete(onChange);
    if (lockListeners.size === 0) {
      lockObserver?.disconnect();
      lockObserver = null;
    }
  };
}

export type I18nValue = {
  /** Die aktuell wirksame Sprache. Bei data-lang-lock immer "de". */
  locale: Locale;
  /** Was der Nutzer gewaehlt hat — auch auf gesperrten Seiten. */
  preferred: Locale;
  /** true, wenn die Seite auf Deutsch festgenagelt ist. */
  locked: boolean;
  /** Sprache wechseln. Auf gesperrten Seiten wirkungslos. */
  setLocale: (next: Locale) => void;
  /** Text in der aktuellen Sprache. Signatur wie lib/i18n#t, nur ohne Locale. */
  t: (key: Key, vars?: Vars) => string;
};

/* Absichtlich kein `undefined` als Default: eine Komponente, die
   ausserhalb des Providers gerendert wird (Test, Storybook,
   isolierte Seite), soll deutschen Text zeigen und nicht werfen. */
const FALLBACK: I18nValue = {
  locale: DEFAULT_LOCALE,
  preferred: DEFAULT_LOCALE,
  locked: false,
  setLocale: () => {},
  t: (key, vars) => translate(key, DEFAULT_LOCALE, vars),
};

const I18nContext = createContext<I18nValue>(FALLBACK);

export function I18nProvider({
  children,
  /** Sperre auch ohne DOM-Attribut erzwingen (z. B. aus einem Layout). */
  locked: lockedProp,
}: {
  children: ReactNode;
  locked?: boolean;
}) {
  /* Dritter Parameter = Server-Schnappschuss: beim Rendern auf dem
     Server und beim Hydrieren gilt Deutsch bzw. "nicht gesperrt",
     genau wie im ausgelieferten HTML. */
  const preferred = useSyncExternalStore(subscribeLang, getLangSnapshot, () => DEFAULT_LOCALE);
  const domLocked = useSyncExternalStore(subscribeLock, getLockSnapshot, () => false);

  const locked = lockedProp ?? domLocked;
  const locale: Locale = locked ? DEFAULT_LOCALE : preferred;

  /* <html lang> mitschreiben: Screenreader, Silbentrennung und
     die Browser-Uebersetzung haengen daran. */
  useEffect(() => {
    if (document.documentElement.lang !== locale) {
      document.documentElement.lang = locale;
    }
    /* Wie im Prototyp: ein Ereignis fuer alles, was nicht React ist
       (Canvas-Motive, Text-Einpassung, spaetere Widgets). */
    document.dispatchEvent(
      new CustomEvent("takeoff:lang", { detail: { lang: locale } }),
    );
  }, [locale]);

  const setLocale = useCallback(
    (next: Locale) => {
      if (locked) return; /* gesperrte Seite: auch nichts speichern */
      writeLang(normalizeLocale(next));
    },
    [locked],
  );

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      preferred,
      locked,
      setLocale,
      t: (key: Key, vars?: Vars) => translate(key, locale, vars),
    }),
    [locale, preferred, locked, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Sprachzustand + t(). Ausserhalb des Providers: Deutsch, kein Fehler. */
export function useI18n(): I18nValue {
  return useContext(I18nContext);
}

/** Kurzform fuer Komponenten, die nur Text brauchen. */
export function useT(): I18nValue["t"] {
  return useContext(I18nContext).t;
}

/**
 * Setzt data-lang-lock auf <html> — fuer Impressum und
 * Datenschutz. Rendert nichts.
 *
 *     export default function Page() {
 *       return (<> <LangLock /> … </>);
 *     }
 *
 * Beim Verlassen der Seite wird das Attribut wieder entfernt;
 * der Provider prueft nach jedem Pfadwechsel neu.
 */
export function LangLock() {
  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute(LANG_LOCK_ATTR, "");
    return () => html.removeAttribute(LANG_LOCK_ATTR);
  }, []);
  return null;
}
