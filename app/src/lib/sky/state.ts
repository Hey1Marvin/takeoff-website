/* ============================================================
   sky/state.ts — woher die Engine ihren Zustand nimmt

   Die Wahrheit ist `document.documentElement`, KEIN React-State-Spiegel.
   Das Boot-Script im Layout stempelt `data-fx` und `data-theme` vor dem
   ersten Paint, Mission Control und der Watchdog schreiben dorthin, und
   die CSS-Regeln haengen ohnehin daran. Ein zweiter Zustand daneben waere
   ein zweiter Zustand, der abweichen kann.

   Deshalb liest `createEnv()` bei JEDEM Zugriff frisch vom Element ab.
   `reduced` ist bewusst eine LIVE-Abfrage der Media Query: wer die
   Systemeinstellung waehrend der Sitzung aendert, wird sofort
   beruecksichtigt.
   ============================================================ */
import type { FxTier, ScenePreset, SkyEnv } from "./types";

const TIERS: readonly string[] = ["s", "m", "l"];
const PRESETS: readonly string[] = ["space", "mars", "strand"];

const readTier = (html: HTMLElement): FxTier => {
  const v = html.dataset.fx;
  return (v && TIERS.includes(v) ? v : "m") as FxTier;
};

const readTheme = (html: HTMLElement): ScenePreset => {
  const v = html.dataset.theme ?? "space";
  return (PRESETS.includes(v) ? v : "space") as ScenePreset;
};

/* ---------- Scroll-Fortschritt 0..1 als ZAHL ----------
   Uebernommen aus main.js (§ „Scroll-Progress"), ohne den Schub-Teil:
   `--thrust` und die Abklingschleife gehoeren zur Rakete und leben in
   `ProgressRocket.tsx`. Hier bleibt nur die Zahl, die die Sternenschleife
   in jedem Bild braucht.

   scrollHeight bei jedem Scroll-Ereignis zu lesen erzwingt ein Layout. Der
   Wert aendert sich nur bei Resize und wenn Inhalte aufklappen — also cachen. */
let scrollMax = 0;
let scrollP = 0;
let trackers = 0;
let detach: (() => void) | null = null;

const measureScroll = () => {
  scrollMax = document.documentElement.scrollHeight - innerHeight;
  setProgress();
};
const setProgress = () => { scrollP = scrollMax > 0 ? scrollY / scrollMax : 0; };

/** Startet die Scroll-Messung (mehrfach aufrufbar, zaehlt mit). Rueckgabe haengt sie wieder ab. */
export function startScrollTracking(): () => void {
  if (trackers++ === 0) {
    measureScroll();
    addEventListener("scroll", setProgress, { passive: true });
    addEventListener("resize", measureScroll, { passive: true });
    addEventListener("load", measureScroll);
    detach = () => {
      removeEventListener("scroll", setProgress);
      removeEventListener("resize", measureScroll);
      removeEventListener("load", measureScroll);
    };
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    if (--trackers === 0) { detach?.(); detach = null; }
  };
}

/** Der aktuelle Scroll-Fortschritt 0..1 — nur gueltig, solange getrackt wird. */
export function scrollProgress(): number { return scrollP; }

/** Ein Fenster auf `<html>`: alle Felder werden bei jedem Lesen frisch abgefragt. */
export function createEnv(): SkyEnv {
  const html = document.documentElement;
  const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  /* Messbetrieb: `?perf=1` legt den FPS-Watchdog still. Einmal beim Start
     gelesen — genau wie im Prototyp, wo `PERF` eine Konstante ist. */
  const perf = /[?&]perf=1(?:&|$)/.test(location.search);
  return {
    get tier() { return readTier(html); },
    get theme() { return readTheme(html); },
    get day() { return html.classList.contains("day-mode"); },
    get ground() { return html.classList.contains("ground-on"); },
    get reduced() { return motionQuery.matches; },
    get scrollP() { return scrollP; },
    get perf() { return perf; },
  };
}

/** Was sich an `<html>` geaendert hat. Nur tatsaechlich geaenderte Felder sind gesetzt. */
export interface SkyChange {
  tier?: FxTier;
  theme?: ScenePreset;
  day?: boolean;
  ground?: boolean;
}

/* Ein MutationObserver statt eigener Events: so wird JEDE Quelle erfasst —
   Mission Control, der Watchdog, das Boot-Script, spaeter der Admin. Wer
   auf `<html>` schreibt, muss nichts davon wissen. */
export function watchSky(cb: (change: SkyChange) => void): () => void {
  const html = document.documentElement;
  let tier = readTier(html);
  let theme = readTheme(html);
  let day = html.classList.contains("day-mode");
  let ground = html.classList.contains("ground-on");

  const obs = new MutationObserver(() => {
    const change: SkyChange = {};
    const t = readTier(html);      if (t !== tier)      { tier = t;      change.tier = t; }
    const th = readTheme(html);    if (th !== theme)    { theme = th;    change.theme = th; }
    const d = html.classList.contains("day-mode");   if (d !== day)    { day = d;    change.day = d; }
    const g = html.classList.contains("ground-on");  if (g !== ground) { ground = g; change.ground = g; }
    /* `class` aendert sich auf <html> auch aus ganz anderen Gruenden
       (Scroll-Klassen, Menue-Zustand). Ohne diesen Filter wuerde jede davon
       einen vollen Szenen-Neuaufbau ausloesen. */
    if (change.tier !== undefined || change.theme !== undefined
        || change.day !== undefined || change.ground !== undefined) cb(change);
  });
  obs.observe(html, { attributes: true, attributeFilter: ["data-fx", "data-theme", "class"] });
  return () => obs.disconnect();
}
