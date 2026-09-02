/* ============================================================
   Welche Seiten die Szene an den Raendern zeigen.

   Im Prototyp haengt das am Dateinamen (main.js:71-80): Startseite,
   Eventuebersicht und Event-Detailseiten leben von der Szene und bekommen
   deshalb KEINE durchgehende Leseplatte — links und rechts bleibt die
   Landschaft stehen. Alle uebrigen Seiten sind Lesestrecken.

   Im App Router gibt es dafuer keinen statischen serverseitigen Weg:
   `headers()` im Root-Layout wuerde die ganze Site dynamisch machen und
   das Prerendering zerstoeren. Deshalb zweigleisig:

     · Erstes Laden  -> dieselbe Regel als Literal im BOOT-Script
                        (layout.tsx). Kein FOUC, bleibt statisch.
     · Client-Nav    -> SceneFlags.tsx nutzt diese Funktion.

   ACHTUNG: Die Regel steht damit an ZWEI Stellen. Wer sie hier aendert,
   muss den BOOT-String in `src/app/layout.tsx` mitziehen. Der saubere
   Endzustand waere ein Feld `scene` in SITE_LINKS (src/lib/site.ts), aus
   dem der BOOT-String generiert wird — eigener Arbeitsschritt.
   ============================================================ */

export interface SceneFlagSet {
  /** Szene bleibt an den Raendern sichtbar (Startseite + Events). */
  edges: boolean;
  /** Eventseiten: kein Kasten hinter dem Text, stattdessen ein Schleier. */
  event: boolean;
}

export function sceneFlags(pathname: string): SceneFlagSet {
  const p = pathname.replace(/\/+$/, "") || "/";
  const event = p === "/events" || p.startsWith("/events/");
  return { edges: p === "/" || event, event };
}
