"use client";
/* ============================================================
   EmbedConsent — die Zustimmung zu Fremd-Playern, einmal fuer alle

   Der gemessene Vertrag (AGENTS.md, "Fremd-Player"): vor der Zustimmung
   geht KEIN Request an soundcloud.com, sndcdn, youtube.com, ytimg oder
   googlevideo — auch kein Vorschaubild, auch kein Favicon. Deshalb sind
   die Plattform-Zeichen lokale SVGs (public/img/logo-*.svg), die als
   CSS-Maske geladen werden: sie erben damit currentColor und passen in
   Space-, Mars- und Strand-Theme, ohne dass es drei Dateien braucht.

   ── Wo der Zustand lebt ────────────────────────────────────
   Auf <html data-embeds="on|off">, nicht in React. Das Boot-Script in
   layout.tsx stempelt das Attribut aus localStorage("takeoff-embed-consent")
   noch vor dem ersten Paint, Mission Control (Zeile "Player") schreibt
   dorthin zurueck, und diese Datei liest es. Damit gibt es genau eine
   Wahrheit — kein "Panel sagt aus, Karte spielt trotzdem".

   Gelesen wird per useSyncExternalStore + MutationObserver statt
   useState+useEffect. Zwei Gruende: der Wert kann sich jederzeit von
   aussen aendern (Mission Control liegt in einem anderen Teilbaum), und
   ein setState im Effekt schlaegt an der Lint-Regel `set-state-in-effect`
   an. Der Server-Schnappschuss ist bewusst `false`: serverseitig gibt es
   kein localStorage, und "keine Zustimmung" ist die sichere Annahme —
   die erste gerenderte Fassung laedt damit garantiert nichts nach.
   ============================================================ */
import { useSyncExternalStore } from "react";

/** Attribut auf <html> — dieselbe Schreibweise wie im Boot-Script. */
export const EMBED_ATTR = "data-embeds";
/** localStorage-Schluessel — identisch mit Boot-Script und MissionControl. */
export const EMBED_STORAGE_KEY = "takeoff-embed-consent";

export type EmbedPlatform = "soundcloud" | "youtube";

/** Anzeigename des Dienstes — geht als {dienst} in die i18n-Texte. */
export function dienstName(platform: EmbedPlatform | undefined): string {
  return platform === "youtube" ? "YouTube" : "SoundCloud";
}

/* ---------- Ein Abonnement fuer alle Leser ----------
   Ein MutationObserver pro Seite statt einer pro Karte: eine Event-Seite
   hat schnell ein Dutzend Set-Karten, und jede haette sonst ihren eigenen
   Beobachter am selben Element. */
const listeners = new Set<() => void>();
let observer: MutationObserver | null = null;

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (!observer) {
    observer = new MutationObserver(() => {
      for (const l of listeners) l();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [EMBED_ATTR],
    });
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) {
      observer?.disconnect();
      observer = null;
    }
  };
}

function snapshot(): boolean {
  return document.documentElement.getAttribute(EMBED_ATTR) === "on";
}

/**
 * Hat der Nutzer den Fremd-Playern zugestimmt?
 *
 * Nur ausserhalb von React aufrufen (Event-Handler, Hilfsfunktionen) —
 * in einer Komponente gehoert `useEmbedConsent()` hin, sonst rendert sie
 * bei einer Aenderung nicht neu.
 */
export function hatZugestimmt(): boolean {
  if (typeof document === "undefined") return false;
  return snapshot();
}

/** Reaktiv: erneuert die Komponente, sobald sich `data-embeds` aendert. */
export function useEmbedConsent(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}

/**
 * Zustimmen — Attribut UND localStorage.
 *
 * Das Attribut zuerst: es ist die Wahrheit, an der CSS und alle Leser
 * haengen. Der Speicher ist nur das Gedaechtnis fuer den naechsten Besuch
 * und darf ruhig fehlschlagen (Safari Private Mode wirft schon beim
 * Zugriff) — dann gilt die Zustimmung eben nur fuer diese Sitzung.
 */
export function zustimmen(): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(EMBED_ATTR, "on");
  try {
    window.localStorage.setItem(EMBED_STORAGE_KEY, "on");
  } catch {
    /* egal — die Sitzung laeuft trotzdem, gemerkt wird es nur nicht */
  }
}

/**
 * Zuruecknehmen. Mission Control macht dasselbe an seiner eigenen Zeile;
 * diese Funktion existiert, damit spaetere Aufrufer (Datenschutzseite,
 * Admin) nicht wieder eine zweite Schreibstelle erfinden.
 */
export function zuruecknehmen(): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(EMBED_ATTR, "off");
  try {
    window.localStorage.setItem(EMBED_STORAGE_KEY, "off");
  } catch {
    /* siehe oben */
  }
}

/**
 * Das Plattform-Zeichen — lokal, einfarbig, ohne Fremd-Request.
 *
 * Technisch eine CSS-Maske (`mask-image`) statt eines <img>: nur so faerbt
 * currentColor die Form ein. Ein <img> haette immer die Farbe der Datei,
 * und die passte dann in genau einem der drei Themes.
 */
export function PlatformLogo({
  platform,
  className,
}: {
  platform: EmbedPlatform;
  className?: string;
}) {
  return (
    <span
      className={`ec-logo${className ? " " + className : ""}`}
      data-platform={platform}
      aria-hidden="true"
    />
  );
}
