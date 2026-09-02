/* ============================================================
   sky/index.ts — die Szene an React anschliessen

   `mountSky(canvas)` baut die Umgebung, startet die Engine und den
   Watchdog, verdrahtet die Zustandswechsel auf `<html>` und gibt eine
   Aufraeumfunktion zurueck. Ein `useEffect` in einer Client-Komponente
   braucht nichts weiter zu wissen.

   ------------------------------------------------------------
   Portierungsnotiz: `scrollP`

   Im Prototyp ist `scrollP` eine `let`-Variable der aeusseren IIFE. In der
   App kommt der Wert aus `state.ts` und wird als `env.scrollP` gelesen.
   Gefaehrlich daran: vier Zeichenfunktionen haben einen PARAMETER mit
   demselben Namen. Ein blindes Suchen-und-Ersetzen erzeugt Code, der sogar
   laeuft — Mond und Sonne stuenden aber falsch, und das faellt erst im
   Browser auf. Deshalb wurde jede Fundstelle einzeln entschieden:

   ERSETZT (echte Lesestellen der Freivariablen, 2 Stueck):
     · engine.ts:1644  `paintMarsFX(g, 0, env.scrollP || 0, 16)`
       — statischer Marsaufbau in Stufe „Aus"
     · engine.ts:5166  `const sp = env.scrollP;`
       — einmal pro Bild in der Zeichenschleife, von dort an alle
         Himmelskoerper weitergereicht

   UNVERAENDERT (Parameter gleichen Namens und deren Rumpf):
     · `sunPos(scrollP)`      (engine.ts:398, Rumpf 401-402)
     · `paintMoon(g, scrollP)`(engine.ts:1030, Rumpf 1035, 1036, 1053)
     · `paintSun(g, scrollP)` (engine.ts:1186, Rumpf 1187)
     · `paintPhobos(g, scrollP)` (engine.ts:1348, Rumpf 1352-1353)

   UNVERAENDERT (Kommentartext): engine.ts:931, 1042, 1046
   ------------------------------------------------------------ */
import { initStars } from "./engine";
import { createEnv, startScrollTracking, watchSky } from "./state";
import { startWatchdog } from "./watchdog";
import type { SkyApi } from "./types";

/* Die Ebenen, die `initStars()` selbst neben das Canvas haengt. Der
   Prototyp kennt kein Unmount und raeumt sie nie ab; in React ist das
   zwingend, sonst stapeln sich bei jedem Fast Refresh weitere Ebenen
   uebereinander. */
const LAYER_IDS = ["skyback", "dayclouds", "horizon", "glints", "props"] as const;

type Listener = [EventTarget, string, EventListenerOrEventListenerObject, unknown];

export function mountSky(canvas: HTMLCanvasElement): () => void {
  const env = createEnv();
  const stopScroll = startScrollTracking();

  /* `initStars()` haengt selbst einen resize- und einen
     visibilitychange-Listener auf — mit anonymen Funktionen, die man ohne
     Eingriff in die (bewusst unveraenderte) Engine nicht mehr abmelden
     kann. Statt die Engine anzufassen, wird `addEventListener` fuer die
     Dauer des synchronen Aufrufs mitgeschrieben. Danach kennen wir die
     Referenzen und koennen sie beim Unmount sauber entfernen. Doppelt
     registrieren waere die Alternative gewesen — dann liefe bei jedem
     Resize ein zweiter, voller Szenen-Neuaufbau. */
  const captured: Listener[] = [];
  const targets: EventTarget[] = [window, document];
  const originals = targets.map(t => t.addEventListener);
  targets.forEach(t => {
    const orig = t.addEventListener.bind(t);
    t.addEventListener = (type: string, fn: EventListenerOrEventListenerObject | null, opts?: unknown) => {
      if (fn) captured.push([t, type, fn, opts]);
      orig(type, fn, opts as AddEventListenerOptions);
    };
  });

  let api: SkyApi | undefined;
  try {
    api = initStars(env, canvas) as SkyApi | undefined;
  } finally {
    targets.forEach((t, i) => { t.addEventListener = originals[i]!; });
  }

  const stopWatchdog = startWatchdog(env);

  /* Zuordnung woertlich aus main.js (Mission-Control-Handler, Z. 6088-6166):
     · Boden an/aus  -> paintHorizon() + seedGlints()
     · Tag/Nacht     -> refreshTheme(), also voller Neuaufbau ueber resize().
       Frueher genuegte hier paintHorizon() + seedGlints(), weil der
       Tag/Nacht-Schalter nichts an dem aenderte, was paintBackdrop()
       zeichnet. Seit es einen Tag-Himmel gibt, stimmt das nicht mehr: die
       statische Ebene traegt nachts Milchstrasse und Sterne und tagsueber
       Himmelsverlauf und Wolken, und die Sternenliste selbst wird tagsueber
       gar nicht erst erzeugt. Beides entsteht in resize(). paintHorizon()
       und seedGlints() ruft refreshTheme() mit auf.
     · Theme         -> refreshTheme()
     · Tier          -> „s" haelt an und baut die stehende Ebene neu,
       alles darueber laeuft wieder los (entspricht applyTier()). */
  const unwatch = watchSky(change => {
    if (!api) return;
    if (change.tier !== undefined) {
      if (change.tier === "s") { api.stop(); api.resize(); }
      else { api.resize(); api.start(); }
    }
    if (change.day !== undefined || change.theme !== undefined) { api.refreshTheme(); return; }
    if (change.ground !== undefined) { api.paintHorizon(); api.seedGlints(); }
  });

  return () => {
    unwatch();
    stopWatchdog();
    stopScroll();
    captured.forEach(([t, type, fn]) => t.removeEventListener(type, fn));
    api?.stop();
    const parent = canvas.parentNode;
    if (parent) {
      LAYER_IDS.forEach(id => {
        const el = (parent as ParentNode).querySelector<HTMLElement>("#" + id);
        el?.remove();
      });
    }
  };
}

export { createEnv, watchSky, startScrollTracking, scrollProgress } from "./state";
export { startWatchdog } from "./watchdog";
export type { FxTier, ScenePreset, SkyEnv, SkyApi } from "./types";
