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

   Punkt 3 blieb dabei allerdings HALB geloest, und das ist der Grund fuer
   den zweiten Umbau (It. 17b): der Faktor kam zurueck, die STUFE nicht.
   `stufeRunter()` hatte kein Gegenstueck, in Stufe "s" lief der Regler gar
   nicht erst an, und die uebernommene Sticky-Mechanik des Vorgaengers
   (drei Ruecknahmen in vierzehn Tagen machen die niedrigere Stufe zum
   Standard) schrieb das Ergebnis sogar ueber Sitzungen hinweg fest. Einmal
   unten hiess in der Praxis: fuer immer unten. Die Sticky-Mechanik ist
   deshalb ersatzlos raus, und der Weg nach oben steht weiter unten.

   Muster nach research/31-performance-adaptiv-a11y.md §2.2 (drei
   `PerformanceMonitor`), das die Notiz ausdruecklich als Goldstandard nennt.
   ============================================================ */
import { taktMithoeren } from "@/lib/frame";
import type { SkyEnv } from "./types";

/** Attribut auf <html>, damit Mission Control den Wert ablesen kann. */
export const Q_ATTR = "data-q";

/** Attribut auf <html>: die Sparstufe, an der die teuren Effekte haengen. */
export const SPAR_ATTR = "data-spar";

/* ============================================================
   DIE SPARLEITER

   `q` ist der gemessene Spielraum, sonst nichts. Was bei Knappheit
   ZUERST faellt, ist eine gestalterische Entscheidung und keine
   Messgroesse — deshalb steht sie hier an einer Stelle und nicht als
   verstreute Schwelle in fuenf Dateien. Die Reihenfolge hat Marvin
   festgelegt:

     1. das Hero-Video      2. die Sternen-Animation      3. Sternenzahl
                                                             und Themes

   Daraus die Leiter. Jede Stufe nimmt genau eine Sache weg, und zwar
   die naechstteure, die noch da ist:

     0  volle Show
     1  die Vollbild-Blends UEBER dem Video (Farbangleichung, Filter auf
        dem laufenden <video>). Billigste Vorstufe von Prioritaet 1 —
        das Video laeuft weiter, nur ohne die Ebenen darueber.
     2  das Video haelt an, das Standbild bleibt stehen.   PRIORITAET 1
     3  die bewegten Sterne stehen still, der gebackene
        Himmel bleibt.                                     PRIORITAET 2
     4  Sternenzahl und Aufloesung runter, Theme-Zugaben
        weg (Meteore, Wolkendrift, Wasserglitzer, Mars-
        Partikel).                                         PRIORITAET 3
     5  die letzten Vollbild-Ebenen: Korn, Vignette, die
        Unschaerfe der Kopfleiste, der Awareness-Warp.

   Faellt danach immer noch nichts ins Lot, geht eine ganze FX-Stufe
   verloren — das ist die Notbremse weiter unten und hat ihre eigene
   Geduld von acht Fenstern.

   TOTBAND: hoch wird an anderen Werten geschaltet als runter, sonst
   flattert die Leiter an jeder Grenze — `q` bewegt sich in Schritten
   von 0,1, und eine Grenze genau auf einem Schritt waere ein Wackler
   je Fenster. */
const SPAR_RUNTER = [0.85, 0.70, 0.55, 0.40, 0.25] as const;
const SPAR_HOCH   = [0.95, 0.80, 0.65, 0.50, 0.35] as const;

/* Die Aufloesung wird in groben Stufen gefahren, nicht stufenlos: jede
   Aenderung loest `resize()` aus und damit ein Neu-Setzen des Sternenfelds.
   Stufenlos durchgereicht wuerde die Regelung sich selbst zum Ruckeln
   bringen — sie wuerde bei jedem Zehntel neu saeen. Deshalb haengt sie an
   der Leiter und nicht an `q`: die Leiter hat ein Totband, `q` nicht.
   Tiefer als frueher (Boden 0,55 statt 0,7) — die Pixelersparnis ist
   quadratisch und damit der groesste Einzelhebel, den es hier gibt. */
const DPR_STUFEN = [1, 1, 1, 1, 0.75, 0.55] as const;

/** Der Aufloesungs-Multiplikator zur aktuellen Sparstufe. */
export function dprFaktor(): number {
  return DPR_STUFEN[Math.min(DPR_STUFEN.length - 1, Math.max(0, spar))];
}

let q = 1;
/** Aktueller Qualitaetsfaktor 0…1 — von der Engine je Bild gelesen. */
export function qualitaet(): number { return q; }

let spar = 0;
/** Aktuelle Sparstufe 0…5 — von der Engine und von HeroVideo gelesen. */
export function sparStufe(): number { return spar; }

export function startQualitaet(env: SkyEnv): () => void {
  const html = document.documentElement;
  let gestoppt = false;

  /* ---------- Bildwiederholrate ----------
     Sie wurde frueher EINMAL aus den ersten dreissig Bildern bestimmt
     (Median) und stand dann fest. Das hat sich als Fehler erwiesen, und
     zwar als einer, der sich selbst versteckt: die ersten dreissig Bilder
     fallen in die Ladephase, in der die Szene noch gar nicht laeuft.
     Nachgemessen an dieser Seite — dieselbe Maschine, derselbe Browser:

       Seite startet langsam  -> Median 33 ms -> gemerkt: 30 Hz -> "langsam"
                                 ab 55 ms -> nie etwas zu tun
       Seite startet schnell  -> Median 17 ms -> gemerkt: 60 Hz -> "langsam"
                                 ab 28 ms -> 46 % der Bilder gelten als
                                 langsam, obwohl die Seite SCHNELLER ist

     Je schlechter eine Seite startet, desto nachsichtiger wurde der Regler.
     Aufgefallen ist es, als eine Verbesserung am Kompositing die Startphase
     beschleunigte — woraufhin sich die Seite fuer ihre eigene Verbesserung
     bis auf q=0 herunterregelte.

     Jetzt fortlaufend aus dem 10. Perzentil eines gleitenden Fensters: die
     SCHNELLSTEN Bilder verraten die Rate des Bildschirms, denn schneller als
     sein Takt kann kein Bild erscheinen. Kein Monotonie-Zwang nach oben —
     sonst faengt sich der Stromsparmodus (der auf 30 Hz deckelt) genau den
     Dauerueberlast-Fehlschluss ein, an dem der alte Watchdog gestorben ist. */
  let hz = 60;
  const PROBEN_MAX = 240;                       /* ~4 s bei 60 Hz */
  const proben = new Float64Array(PROBEN_MAX);
  let probenN = 0, probenI = 0;
  let gemessen = false;

  /* Fenster von ~250 ms statt 180 Bildern: ein Scroll-Ruckler dauert keine
     drei Sekunden, und in einem Drei-Sekunden-Mittel verschwindet er. */
  let fensterStart = 0;
  let fensterBilder = 0;
  let fensterLangsam = 0;

  /* Hysterese: wie oft hintereinander muss es gut aussehen, bevor wieder
     hochgeregelt wird. Sie bleibt unsymmetrisch — runter mit zwei Fenstern,
     hoch erst mit vier —, damit die Regelung nicht sichtbar pendelt. */
  let gutInFolge = 0;
  /* Gegenstueck dazu: wie oft es hintereinander schlecht aussehen muss,
     BEVOR Qualitaet faellt. Vorher genuegte ein einziges Fenster — und ein
     einzelnes Fenster ist alles Moegliche: der Ruck beim Scrollbeginn, ein
     nachladendes Bild, eine Speicherbereinigung. Nachgemessen fiel der
     Faktor auf einem unbelasteten Rechner allein beim Scrollbeginn von 100
     auf 90 und kam nicht mehr hoch. Die STUFE hatte immer eine Geduld von
     acht Fenstern; dass der Faktor gar keine hatte, war schlicht eine
     Luecke. Zwei Fenster sind 500 ms — fuer echte Ueberlast belanglos
     (dort ist jedes Fenster schlecht), fuer einen einzelnen Ruckler
     entscheidend. */
  let schlechtInFolge = 0;
  let amBoden = 0;
  let flipflops = 0;
  let zuletztRichtung = 0;

  /* Die Leiter aus `q` ableiten. Erst so weit hinunter, wie die
     Runter-Schwellen es verlangen, dann so weit hinauf, wie die
     Hoch-Schwellen es erlauben — dazwischen liegt das Totband, in dem sich
     nichts bewegt. */
  const stufeAus = (wert: number, jetzt: number): number => {
    let s = jetzt;
    while (s < SPAR_RUNTER.length && wert < SPAR_RUNTER[s]) s++;
    while (s > 0 && wert > SPAR_HOCH[s - 1]) s--;
    return s;
  };

  const setzeSpar = (neu: number) => {
    if (neu === spar) return;
    spar = neu;
    html.setAttribute(SPAR_ATTR, String(spar));
  };

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
    setzeSpar(stufeAus(q, spar));
  };

  /* ============================================================
     DER WEG ZURUECK

     Bis hierher gab es `stufeRunter()` ohne Gegenstueck. Die Stufe konnte
     l -> m -> s nur fallen, und nach drei Herunterstufungen in vierzehn
     Tagen schrieb der Regler die niedrigere Stufe als Dauerstand ins
     localStorage. In Stufe "s" lief er zudem gar nicht erst an (der Guard
     unten stieg sofort aus) — er konnte sich also nicht einmal melden,
     wenn wieder Luft da war. Einmal unten hiess: fuer immer unten, ueber
     Sitzungen hinweg, und das Hero-Video hing daran mit.

     Drei Aenderungen daran, alle drei bewusst:

     · Der Regler laeuft auch in Stufe "s" (siehe Guard).
     · Es wird NICHTS mehr dauerhaft gemerkt. `takeoff-fx` ist der
       Startwert beim Laden, keine Decke und kein Ziel. Eine Fehlmessung
       ueberlebt damit keine Sitzung. Der Preis ist, dass ein schwaches
       Geraet nach jedem harten Neuladen ein paar Sekunden braucht, bis
       sich die Stufe wieder gesetzt hat — das ist der richtige Preis
       dafuer, dass es sich ueberhaupt wieder erholen kann.
     · Hoch geht es nur als VERSUCH, nie als Schlussfolgerung. In Stufe
       "s" ist die Seite leer, also sind alle Bilder schnell — "viel Luft"
       beweist dort ueber Stufe "m" genau nichts. Also: Stufe anheben, acht
       Fenster lang zusehen, und beim ersten schlechten Fenster zurueck.
       Die Wartezeit bis zum naechsten Versuch verdoppelt sich mit jedem
       Fehlschlag (20 s, 40 s, 80 s … bis 10 min) und halbiert sich mit
       jedem Erfolg. Ohne diese Bremse pendelt ein Geraet, das knapp zu
       schwach ist, im Sekundentakt zwischen zwei Stufen — sichtbares
       Pendeln waere schlimmer als die niedrigere Stufe.
     ============================================================ */
  const VERSUCH_MIN = 20000, VERSUCH_MAX = 600000, VERSUCH_FENSTER = 8;
  let wartezeit = VERSUCH_MIN;
  let naechsterVersuch = 0;
  let versuchLaeuft = 0;
  /* Trennt eigene Schreibzugriffe auf `data-fx` von fremden (Mission
     Control, Boot). Ohne das loeste jeder eigene Stufenwechsel den eigenen
     MutationObserver aus und setzte den gerade laufenden Versuch zurueck. */
  let eigenerWechsel = false;
  /* Schonfrist nach einer Wahl von Hand: sonst springt die Automatik zurueck,
     waehrend der Finger noch auf dem Knopf liegt. */
  let manuellBis = 0;

  const setzeStufe = (naechste: string): void => {
    eigenerWechsel = true;
    html.dataset.fx = naechste;
    q = 1; html.setAttribute(Q_ATTR, "100");   // in der neuen Stufe frisch anfangen
    setzeSpar(0);
    flipflops = 0; amBoden = 0; zuletztRichtung = 0; gutInFolge = 0; schlechtInFolge = 0;
    fensterStart = 0; fensterBilder = 0; fensterLangsam = 0;
  };

  function stufeRunter(): void {
    const jetzt = html.dataset.fx;
    const naechste = jetzt === "l" ? "m" : jetzt === "m" ? "s" : null;
    if (!naechste) return;
    setzeStufe(naechste);
    wartezeit = Math.min(VERSUCH_MAX, wartezeit * 2);
    naechsterVersuch = performance.now() + wartezeit;
  }

  function stufeHoch(): void {
    const jetzt = html.dataset.fx;
    const naechste = jetzt === "s" ? "m" : jetzt === "m" ? "l" : null;
    if (!naechste) return;
    setzeStufe(naechste);
    versuchLaeuft = VERSUCH_FENSTER;
  }

  /* Zwei Sperren, die die Automatik NICHT ueberstimmt. Beide sind keine
     Leistungsfragen, deshalb stehen sie ausserhalb der Regelung:
     · reduzierte Bewegung ist eine Zugaenglichkeitseinstellung;
     · der Datensparmodus kostet den Besucher Geld, nicht Bildrate. */
  const darfHoch = (): boolean => {
    if (env.reduced) return false;
    const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (c?.saveData === true) return false;
    return performance.now() >= manuellBis;
  };

  const bild = (dt: number) => {
    if (gestoppt || document.hidden) return;
    /* `data-fx === "s"` stand hier frueher mit in der Bedingung. Genau das
       machte die unterste Stufe zur Sackgasse: dort mass niemand mehr, also
       konnte auch niemand melden, dass wieder Luft da ist. Jetzt laeuft der
       Regler weiter — die Engine zeichnet in "s" ohnehin nichts, der Takt
       kostet also fast nichts. `reduced` und `perf` bleiben harte Ausstiege. */
    if (env.reduced || env.perf) return;

    /* Jedes brauchbare Bild wandert in den Ringpuffer, aus dem die Rate
       kommt. Ausgewertet wird er nur beim Fensterwechsel (viermal je
       Sekunde) — sortieren in jedem Bild waere Arbeit fuer nichts. */
    if (dt > 1 && dt < 200) {
      proben[probenI] = dt;
      probenI = (probenI + 1) % PROBEN_MAX;
      if (probenN < PROBEN_MAX) probenN++;
    }
    if (!gemessen && probenN < 30) return;

    const budget = 1000 / hz;
    /* Ab wann ein Bild "langsam" heisst. Vorher stand hier `budget / 0.6`
       (1,67x). Nachgemessen auf dieser Seite, Regler stillgelegt, beim
       Scrollen der Startseite in Stufe l:

                     ungedrosselt   unter 6x CPU-Drossel
       ueber 27.8 ms      20 %              98 %      <- alte Grenze (1,67x)
       ueber 33.3 ms      14 %              98 %      <- 2x
       ueber 41.7 ms       1 %              96 %      <- 2,5x, diese Grenze

       Entscheidend ist nicht nur, dass die Grenze unter Last ausloest —
       das taten alle drei —, sondern dass der GESUNDE Zustand weit genug
       unter der Erholungsschwelle von 5 % liegt. Bei 1,67x und 2x sitzt
       eine gesunde Seite mit 14-20 % mitten in der Totzone zwischen
       "erholen" (unter 5 %) und "weiter senken" (ueber 25 %): der Faktor
       faellt beim ersten Scroll-Ruckler um einen Schritt und bleibt dort
       fuer den Rest der Sitzung stehen — gemessen genau so, q fiel bei
       1500 ms auf 90 und ruehrte sich danach nicht mehr.
       Mit 2,5x liegt der gesunde Zustand bei 1 % und damit klar im
       Erholungsbereich, waehrend echte Ueberlast mit 96 % unveraendert
       ausloest. Auf 30-Hz-Geraeten sind das 83 ms je Bild — wer dort so
       lange braucht, zeigt 12 Bilder je Sekunde und ist wirklich zu
       langsam; der Stromsparmodus allein reicht dafuer nicht. */
    const langsamAb = budget * 2.5;

    if (!fensterStart) fensterStart = performance.now();
    fensterBilder++;
    if (dt > langsamAb) fensterLangsam++;

    if (performance.now() - fensterStart < 250) return;

    /* Fenster ist voll: erst die Rate nachfuehren, dann urteilen.
       Die Reihenfolge im Ringpuffer ist fuer ein Perzentil egal — nur der
       gefuellte Teil zaehlt, solange er noch nicht rundgelaufen ist. */
    const sortiert = Array.from(proben.subarray(0, probenN)).sort((a, b) => a - b);
    const p10 = sortiert[Math.floor(sortiert.length * 0.1)];
    if (p10 > 0) hz = Math.max(24, Math.min(144, Math.round(1000 / p10)));
    gemessen = true;

    const anteil = fensterLangsam / Math.max(1, fensterBilder);
    fensterStart = 0; fensterBilder = 0; fensterLangsam = 0;

    /* Laeuft gerade ein Versuch, gilt nur eine Frage: haelt die hoehere
       Stufe? Waehrenddessen wird nicht zusaetzlich an `q` gedreht — sonst
       misst man am Ende die Regelung und nicht die Stufe. */
    if (versuchLaeuft > 0) {
      if (anteil > 0.25) { versuchLaeuft = 0; stufeRunter(); return; }
      if (--versuchLaeuft === 0) wartezeit = Math.max(VERSUCH_MIN, wartezeit / 2);
      return;
    }

    if (anteil > 0.25) {
      gutInFolge = 0;
      if (++schlechtInFolge < 2) return;
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
      schlechtInFolge = 0;
      /* Hochregeln nach vier ruhigen Fenstern (~1 s) je Schritt. Runter geht
         es mit zwei schlechten Fenstern, hoch nur mit jedem vierten guten —
         das ist die Hysterese, die sichtbares Pendeln verhindert. Mit acht
         Fenstern (dem ersten Versuch) dauerte der Weg vom Boden zurueck auf
         volle Qualitaet sechzehn Sekunden; das ist keine Vorsicht mehr,
         sondern fuehlt sich an wie "kommt nicht wieder hoch". */
      if (++gutInFolge >= 4 && q < 1) { setzeQ(q + 0.1); gutInFolge = 0; }

      /* Volle Qualitaet erreicht und immer noch Luft: dann ist nicht der
         Faktor zu niedrig, sondern die STUFE. Frueher endete der Weg hier —
         `q` war wieder bei 1, und mehr ging nicht. Jetzt beginnt hier der
         Versuch, eine Stufe hoeher zu kommen. */
      if (q >= 1 && gutInFolge >= 4 && performance.now() >= naechsterVersuch && darfHoch()) {
        gutInFolge = 0;
        stufeHoch();
      }
    } else {
      gutInFolge = 0;
      schlechtInFolge = 0;
    }
  };

  html.setAttribute(Q_ATTR, String(Math.round(q * 100)));
  html.setAttribute(SPAR_ATTR, String(spar));
  const ab = taktMithoeren(bild);

  /* Stufenwechsel von aussen (Mission Control, Boot-Script): frisch
     anfangen, sonst traegt die neue Stufe den Faktor der alten — und die
     Automatik haelt danach dreissig Sekunden still, damit eine Wahl von Hand
     nicht unter dem Finger zurueckspringt.
     Eigene Wechsel laufen daran vorbei: `setzeStufe()` hat schon aufgeraeumt,
     ein zweites Zuruecksetzen wuerde einen laufenden Versuch abwuergen. */
  const obs = new MutationObserver(() => {
    if (eigenerWechsel) { eigenerWechsel = false; return; }
    manuellBis = performance.now() + 30000;
    naechsterVersuch = Math.max(naechsterVersuch, manuellBis);
    versuchLaeuft = 0;
    q = 1; html.setAttribute(Q_ATTR, "100");
    spar = 0; html.setAttribute(SPAR_ATTR, "0");
    gutInFolge = 0; schlechtInFolge = 0; flipflops = 0; zuletztRichtung = 0; amBoden = 0;
    fensterStart = 0; fensterBilder = 0; fensterLangsam = 0;
  });
  obs.observe(html, { attributes: true, attributeFilter: ["data-fx"] });

  return () => {
    gestoppt = true; obs.disconnect(); ab();
    html.removeAttribute(Q_ATTR); html.removeAttribute(SPAR_ATTR);
  };
}
