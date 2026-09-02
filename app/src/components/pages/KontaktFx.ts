/* ============================================================
   KontaktFx — kleine geteilte Helfer für die Bodenstation-/Radar-
   Signaturmotive dieser Seite (eigener Namensraum, gleiche Idee wie
   KollektivFx.ts: reine Funktionen ohne State/DOM-Referenzen, damit
   jede Client-Komponente ihre eigene Lebensdauer unabhängig hält).
   ============================================================ */

export function reducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Tier "s" oder reduced-motion => Seite bleibt ohne Zusatz-Animation schön. */
export function fxOn(): boolean {
  return document.documentElement.dataset.fx !== "s" && !reducedMotion();
}

/** Nur Tier "l" (volle Show) fährt die teuersten Extras. */
export function fxFull(): boolean {
  return document.documentElement.dataset.fx === "l" && !reducedMotion();
}

/* Event-Name für die Wegweiser→Radar-Kopplung: KontaktWegweiser und
   KontaktFunkkanaele sind getrennte Client-Inseln (eigene Sektionen).
   Ein Themen-Chip-Klick im Wegweiser markiert trotzdem den passenden
   Radar-Blip als aktiv — per CustomEvent statt geteiltem State oder
   DOM-Querying (die Prototyp-Lösung in kontakt.js), damit kein Re-Render
   der Ziel-Komponente die Markierung wieder verwirft. */
export const TOPIC_SELECT_EVENT = "kontakt:topic-select";

export interface TopicSelectDetail {
  ch: string;
}

/* Event-Name fuer den Sende-Puls: KontaktBodenstation haelt den einen
   dokumentweiten Klick-Listener auf [data-fs-pulse] (Dach-Antenne + Toast).
   Die Konsole (KontaktFunkkanaele) liegt in einer anderen Client-Insel,
   soll aber im selben Moment reagieren — Radar-Ping und Status "Signal
   unterwegs". Gleiche Bruecke wie bei TOPIC_SELECT_EVENT: ein CustomEvent
   statt geteiltem State, damit beide Inseln unabhaengig bleiben. */
export const SEND_PULSE_EVENT = "kontakt:send-pulse";

export interface SendPulseDetail {
  /** "mail" oder "telegram" — bestimmt Toast und Beschriftung. */
  kind: "mail" | "telegram";
}
