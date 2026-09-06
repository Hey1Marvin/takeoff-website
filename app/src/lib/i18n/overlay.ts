import "server-only";
/* ============================================================
   i18n/overlay.ts — englische Inhalte ueber die deutschen legen

   ── Warum Inhalte NICHT ins Woerterbuch gehoeren ───────────
   de.ts/en.ts tragen das Interface: Nav, Knoepfe, aria-Labels,
   Fehlermeldungen. Inhalte — Events, Artists, News, Seitentexte — leben
   in der Datenschicht (db.json, data/pages/*.json) und kommen ueber den
   Gateway. Sie doppelt zu pflegen, einmal in der Datenbank und einmal im
   Woerterbuch, waere genau der stille Textverlust, vor dem der Prototyp
   selbst warnt (siehe den CMS-GRENZE-Abschnitt in index.ts).

   Deshalb liegt die Uebersetzung DORT, wo der Text liegt:

     {
       "hero": { "title": "Artists &", "intro": "Die Menschen …" },
       "i18n": { "en": { "hero": { "intro": "The people …" } } }
     }

   Das Overlay ist DUENN. Im Beispiel ist nur `intro` uebersetzt; `title`
   faellt still auf das Deutsche zurueck. Genau so ist es gewollt: eine
   fehlende Uebersetzung darf nichts verschwinden lassen und nichts kaputt
   aussehen — der Besucher liest dann eben diesen einen Satz auf Deutsch.

   ── Die Regeln, die beim Mischen gelten ────────────────────
   · Objekte werden TIEF gemischt, damit ein Overlay einzelne Felder
     ersetzen kann, ohne den ganzen Block zu wiederholen.
   · Listen werden ERSETZT, nicht elementweise gemischt. Eine uebersetzte
     Liste hat oft eine andere Laenge (Aufzaehlungen lassen sich nicht
     immer 1:1 abbilden), und ein elementweises Mischen wuerde bei
     unterschiedlicher Reihenfolge Saetze zerschneiden.
     AUSNAHME: Listen von Objekten mit `slug` oder `id` — dort wird ueber
     den Schluessel zugeordnet, damit man in db.json nicht alle neun
     Events wiederholen muss, um eines zu uebersetzen.
   · Der Schluessel `i18n` selbst wird nie durchgereicht; nach der
     Aufloesung ist er weg.
   · Schluessel, die mit `_` beginnen (`_labels` fuer das Admin), bleiben
     unangetastet.
   ============================================================ */
import type { Locale } from "./index";

/** Der Schluessel, unter dem Uebersetzungen an einem Datensatz haengen. */
export const OVERLAY_KEY = "i18n";

type Wert = unknown;
type Obj = Record<string, Wert>;

const istObjekt = (v: Wert): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Hat die Liste durchgehend Elemente mit stabilem Schluessel? */
function schluesselFeld(liste: Wert[]): "slug" | "id" | null {
  if (!liste.length || !liste.every(istObjekt)) return null;
  for (const feld of ["slug", "id"] as const) {
    if (liste.every(e => typeof (e as Obj)[feld] === "string")) return feld;
  }
  return null;
}

function mische(grund: Wert, oben: Wert): Wert {
  if (oben === undefined) return grund;

  if (Array.isArray(grund) && Array.isArray(oben)) {
    /* Listen mit Schluessel: elementweise zuordnen, damit ein Overlay
       nur die uebersetzten Eintraege nennen muss. */
    const feld = schluesselFeld(grund);
    if (feld && schluesselFeld(oben) === feld) {
      const nachSchluessel = new Map(
        oben.map(e => [(e as Obj)[feld] as string, e]),
      );
      return grund.map(e =>
        mische(e, nachSchluessel.get((e as Obj)[feld] as string)),
      );
    }
    /* Sonst: ersetzen. Siehe Kopfkommentar. */
    return oben;
  }

  if (istObjekt(grund) && istObjekt(oben)) {
    const raus: Obj = { ...grund };
    for (const [k, v] of Object.entries(oben)) {
      if (k === OVERLAY_KEY) continue;
      raus[k] = mische(grund[k], v);
    }
    return raus;
  }

  return oben;
}

/**
 * Loest alle `i18n`-Overlays in einer Datenstruktur auf.
 *
 * Fuer `de` wird nur aufgeraeumt (die Overlays fliegen raus, damit kein
 * englischer Text versehentlich im deutschen Baum landet und damit die
 * Datenmenge im HTML nicht unnoetig doppelt steht).
 */
export function loeseOverlay<T>(daten: T, locale: Locale): T {
  return gehe(daten, locale) as T;
}

function gehe(knoten: Wert, locale: Locale): Wert {
  if (Array.isArray(knoten)) return knoten.map(k => gehe(k, locale));
  if (!istObjekt(knoten)) return knoten;

  /* Erst die Kinder aufloesen, dann das eigene Overlay darueberlegen.
     Andersherum wuerde ein Overlay, das selbst wieder Overlays enthaelt
     (verschachtelte Datensaetze), nicht aufgeloest. */
  const unten: Obj = {};
  for (const [k, v] of Object.entries(knoten)) {
    if (k === OVERLAY_KEY) continue;
    unten[k] = k.startsWith("_") ? v : gehe(v, locale);
  }

  const overlay = knoten[OVERLAY_KEY];
  if (locale === "de" || !istObjekt(overlay)) return unten;

  const fuerSprache = overlay[locale];
  if (!istObjekt(fuerSprache)) return unten;

  return mische(unten, gehe(fuerSprache, locale)) as Obj;
}
