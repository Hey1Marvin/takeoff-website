/* ============================================================
   sky/qualitaet.ts — stufenlose Qualitaet statt Stufen-Sprüngen

   Loest `watchdog.ts` ab. Der alte Watchdog hatte drei Fehler, die alle
   dasselbe bewirkten: Qualitaet verlieren, ohne dafuer Fluessigkeit zu
   gewinnen.

   1. FESTE 33-MS-SCHWELLE. Er zaehlte jedes Bild ueber 33 ms als „langsam".
      Ein iPhone im Stromsparmodus ist auf 30 fps gedeckelt — dort ist JEDES
      Bild 33,3 ms lang. Die Seite stufte sich also sofort herunter, und nach
      drei Malen wurde das per localStorage dauerhaft. Umgekehrt ist dieselbe
      Schwelle auf einem 120-Hz-Geraet viel zu nachsichtig: dort sind schon
      12 ms ein verpasstes Bild.
      -> Jetzt wird die Bildwiederholrate GEMESSEN und die Grenzen liegen
         relativ dazu.

   2. NUR GANZE STUFEN. l -> m -> s ist eine Klippe. Zwischen „volle Show"
      und „halbe Show" liegt nichts, obwohl die wirksamsten Stellschrauben
      (Aufloesung, Sternenzahl) stufenlos waeren.
      -> Jetzt ein Faktor 0…1, der zuerst die Aufloesung senkt (quadratische
         Pixelersparnis, groesster Einzelhebel), dann die bewegten Sterne,
         dann die Zugaben.

   3. NIE WIEDER HOCH. Ein kurzer Aussetzer kostete die Qualitaet fuer den
      Rest der Sitzung.
      -> Jetzt steigt der Faktor wieder, wenn Luft da ist. Runter schnell,
         hoch zoegerlich — sichtbares Pendeln waere schlimmer als beides.

   Uebernommen wird die Sticky-Mechanik des Vorgaengers (drei Ruecknahmen in
   vierzehn Tagen machen die niedrigere Stufe zum Standard) — sie war
   richtig, nur der Ausloeser war falsch.

   Muster nach research/31-performance-adaptiv-a11y.md §2.2 (drei
   `PerformanceMonitor`), das die Notiz ausdruecklich als Goldstandard nennt.
   ============================================================ */
import { taktMithoeren } from "@/lib/frame";
import type { SkyEnv } from "./types";

const store = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* egal */ } },
};

/** Attribut auf <html>, damit Mission Control den Wert ablesen kann. */
export const Q_ATTR = "data-q";

/* Die Aufloesung wird in vier groben Stufen gefahren, nicht stufenlos: jede
   Aenderung loest `resize()` aus und damit ein Neu-Setzen des Sternenfelds.
   Stufenlos durchgereicht wuerde die Regelung sich selbst zum Ruckeln
   bringen — sie wuerde bei jedem Zehntel neu saeen. */
const DPR_STUFEN = [0.7, 0.85, 1, 1] as const;

/** Der Aufloesungs-Multiplikator zum aktuellen Faktor. */
export function dprFaktor(q: number): number {
  const i = Math.min(DPR_STUFEN.length - 1, Math.max(0, Math.round(q * (DPR_STUFEN.length - 1))));
  return DPR_STUFEN[i];
}

let q = 1;
/** Aktueller Qualitaetsfaktor 0…1 — von der Engine je Bild gelesen. */
export function qualitaet(): number { return q; }

export function startQualitaet(env: SkyEnv): () => void {
  const html = document.documentElement;
  let gestoppt = false;

  /* Bildwiederholrate: die ersten Bilder messen, danach steht sie. Ohne sie
     waere jede Schwelle eine Annahme ueber fremde Hardware. */
  let hz = 60;
  let messProben: number[] = [];
  let gemessen = false;

  /* Fenster von ~250 ms statt 180 Bildern: ein Scroll-Ruckler dauert keine
     drei Sekunden, und in einem Drei-Sekunden-Mittel verschwindet er. */
  let fensterStart = 0;
  let fensterBilder = 0;
  let fensterLangsam = 0;

  /* Hysterese: wie oft hintereinander muss es gut aussehen, bevor wieder
     hochgeregelt wird. Runter reicht ein schlechtes Fenster. */
  let gutInFolge = 0;
  let amBoden = 0;
  let flipflops = 0;
  let zuletztRichtung = 0;

  const setzeQ = (neu: number) => {
    const g = Math.max(0, Math.min(1, Math.round(neu * 100) / 100));
    if (g === q) return;
    const richtung = g < q ? -1 : 1;
    if (zuletztRichtung && richtung !== zuletztRichtung) flipflops++;
    zuletztRichtung = richtung;
    q = g;
    /* Ablesbar machen: Mission Control zeigt den Wert an. Der Zustand lebt
       auf <html> wie alles andere Darstellungsrelevante — kein zweiter
       Zustand daneben. */
    html.setAttribute(Q_ATTR, String(Math.round(q * 100)));
  };

  function stufeRunter(): void {
    const jetzt = html.dataset.fx;
    const naechste = jetzt === "l" ? "m" : jetzt === "m" ? "s" : null;
    if (!naechste) return;
    html.dataset.fx = naechste;
    q = 1; html.setAttribute(Q_ATTR, "100");   // in der neuen Stufe frisch anfangen
    flipflops = 0; amBoden = 0; zuletztRichtung = 0;
    try {
      const hist = (JSON.parse(store.get("takeoff-fx-downgrades") || "[]") as number[])
        .filter(ts => Date.now() - ts < 14 * 864e5);
      hist.push(Date.now());
      store.set("takeoff-fx-downgrades", JSON.stringify(hist));
      if (hist.length >= 3) store.set("takeoff-fx", naechste);
    } catch { /* egal */ }
  }

  const bild = (dt: number) => {
    if (gestoppt || document.hidden) return;
    if (html.dataset.fx === "s" || env.reduced || env.perf) return;

    /* Phase 1: Bildwiederholrate bestimmen. */
    if (!gemessen) {
      if (dt > 1 && dt < 200) messProben.push(dt);
      if (messProben.length >= 30) {
        messProben.sort((a, b) => a - b);
        const median = messProben[messProben.length >> 1];
        hz = Math.round(1000 / median);
        /* Auf plausible Werte klemmen: ein Hintergrund-Tab oder ein
           Messfehler darf keine absurde Zielrate setzen. */
        hz = Math.max(24, Math.min(144, hz));
        gemessen = true;
        messProben = [];
      }
      return;
    }

    const budget = 1000 / hz;
    /* Grenzen relativ zur echten Rate (research §2.2): unter 0,6x der Rate
       ist es zu langsam, ueber 0,9x ist Luft nach oben. In Bildzeit
       gerechnet heisst das: langsam ab budget/0.6, gut unter budget/0.9. */
    const langsamAb = budget / 0.6;

    if (!fensterStart) fensterStart = performance.now();
    fensterBilder++;
    if (dt > langsamAb) fensterLangsam++;

    if (performance.now() - fensterStart < 250) return;

    const anteil = fensterLangsam / Math.max(1, fensterBilder);
    fensterStart = 0; fensterBilder = 0; fensterLangsam = 0;

    if (anteil > 0.25) {
      gutInFolge = 0;
      if (q > 0) { setzeQ(q - 0.1); amBoden = 0; }
      else if (++amBoden >= 8) {
        /* Faktor am Boden UND acht Fenster (~2 s) lang weiter zu langsam:
           erst dann eine ganze Stufe zurueck. Ohne diese Wartezeit faellt
           die Stufe schon 2,5 s nach dem ersten Ruckler — ein kurzer
           Lastberg (ein nachladendes Bild, ein fremdes Skript) wuerde dann
           dauerhaft Qualitaet kosten, und genau das war der Fehler des
           alten Watchdogs. */
        stufeRunter();
        amBoden = 0;
      }
      /* Pendelt es zwischen hoch und runter, ist die Stufe selbst zu hoch. */
      if (flipflops >= 6) { stufeRunter(); amBoden = 0; }
    } else if (anteil < 0.05) {
      /* Hochregeln nach vier ruhigen Fenstern (~1 s) je Schritt. Runter geht
         es mit jedem schlechten Fenster, hoch nur mit jedem vierten guten —
         das ist die Hysterese, die sichtbares Pendeln verhindert. Mit acht
         Fenstern (dem ersten Versuch) dauerte der Weg vom Boden zurueck auf
         volle Qualitaet sechzehn Sekunden; das ist keine Vorsicht mehr,
         sondern fuehlt sich an wie "kommt nicht wieder hoch". */
      if (++gutInFolge >= 4 && q < 1) { setzeQ(q + 0.1); gutInFolge = 0; }
    } else {
      gutInFolge = 0;
    }
  };

  html.setAttribute(Q_ATTR, String(Math.round(q * 100)));
  const ab = taktMithoeren(bild);

  /* Stufenwechsel von aussen (Mission Control, Boot-Script): frisch
     anfangen, sonst traegt die neue Stufe den Faktor der alten. */
  const obs = new MutationObserver(() => {
    q = 1; html.setAttribute(Q_ATTR, "100");
    gutInFolge = 0; flipflops = 0; zuletztRichtung = 0; amBoden = 0;
    fensterStart = 0; fensterBilder = 0; fensterLangsam = 0;
  });
  obs.observe(html, { attributes: true, attributeFilter: ["data-fx"] });

  return () => { gestoppt = true; obs.disconnect(); ab(); html.removeAttribute(Q_ATTR); };
}
