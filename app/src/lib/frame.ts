/* ============================================================
   frame.ts — EIN Takt fuer alles, was pro Bild etwas tut

   ── Das Problem, das dieser Takt loest ─────────────────────
   Es liefen drei unabhaengige requestAnimationFrame-Schleifen nebeneinander:
   die Szenen-Engine, der FPS-Watchdog (eine eigene Schleife, nur um zu
   messen) und ProgressRocket. Auf /kollektiv kam ein vierter Mitspieler
   dazu.

   Drei Schleifen sind nicht dreimal so teuer wie eine — sie sind
   schlimmer, weil ihre Reihenfolge nicht festgelegt ist. ProgressRocket
   SCHREIBT Styles auf <html>; die Engine und KollektivHistory LESEN
   danach Layoutwerte (scrollY, getBoundingClientRect). Faellt ein Schreiben
   vor ein Lesen, muss der Browser mitten im Bild Stil und Layout neu
   berechnen, um die Frage zu beantworten. Das ist Layout-Thrashing, und es
   entsteht hier nicht durch schlechten Code in einer Datei, sondern durch
   das Zusammentreffen von zweien.

   ── Wie er es loest ────────────────────────────────────────
   Jeder Teilnehmer meldet getrennt an, was er LIEST und was er SCHREIBT.
   Der Takt ruft in jedem Bild erst alle Lese-, dann alle Schreibfunktionen.
   Damit ist die Reihenfolge nicht mehr Glueckssache, sondern zugesichert —
   und zwar auch fuer Teilnehmer, die nichts voneinander wissen.

   ── Was er ausserdem erledigt ──────────────────────────────
   · Bei `document.hidden` haelt er an. Bisher machte das die Engine fuer
     sich und ProgressRocket fuer sich; der Watchdog gar nicht — der lief
     im Hintergrund-Tab weiter.
   · Ohne Teilnehmer laeuft gar kein rAF.
   · Er misst nebenbei die Bildzeit und gibt sie weiter (`dt`), damit der
     Qualitaetsregler keine eigene Schleife dafuer braucht.
   ============================================================ */

export interface TaktAufgabe {
  /** Layout lesen (scrollY, Masse). Laeuft VOR allen Schreibfunktionen. */
  lesen?: (t: number, dt: number) => void;
  /** Styles/Canvas schreiben. Laeuft NACH allen Lesefunktionen. */
  schreiben?: (t: number, dt: number) => void;
}

const aufgaben = new Set<TaktAufgabe>();
let raf = 0;
let letzteZeit = 0;
let angehaengt = false;

/* Beobachter der Bildzeit — der Qualitaetsregler haengt sich hier ein,
   statt eine zweite Schleife nur zum Messen zu fahren. */
const zeitgeber = new Set<(dt: number) => void>();

function bild(t: number): void {
  raf = requestAnimationFrame(bild);
  const dt = letzteZeit ? t - letzteZeit : 16.7;
  letzteZeit = t;

  /* Erst lesen … */
  for (const a of aufgaben) a.lesen?.(t, dt);
  /* … dann schreiben. Diese zwei Zeilen sind der ganze Zweck der Datei. */
  for (const a of aufgaben) a.schreiben?.(t, dt);

  for (const z of zeitgeber) z(dt);
}

function starten(): void {
  if (raf || typeof document === "undefined") return;
  if (document.hidden) return;
  letzteZeit = 0;
  raf = requestAnimationFrame(bild);
}

function anhalten(): void {
  cancelAnimationFrame(raf);
  raf = 0;
}

function sichtbarkeit(): void {
  if (document.hidden) anhalten();
  else if (aufgaben.size || zeitgeber.size) starten();
}

function sicherstellenAngehaengt(): void {
  if (angehaengt || typeof document === "undefined") return;
  document.addEventListener("visibilitychange", sichtbarkeit);
  angehaengt = true;
}

/** Meldet eine Aufgabe an. Rueckgabe meldet sie wieder ab. */
export function taktAnmelden(a: TaktAufgabe): () => void {
  sicherstellenAngehaengt();
  aufgaben.add(a);
  starten();
  let weg = false;
  return () => {
    if (weg) return;
    weg = true;
    aufgaben.delete(a);
    if (!aufgaben.size && !zeitgeber.size) anhalten();
  };
}

/** Nur die Bildzeit mithoeren, ohne selbst etwas zu tun. */
export function taktMithoeren(cb: (dt: number) => void): () => void {
  sicherstellenAngehaengt();
  zeitgeber.add(cb);
  starten();
  let weg = false;
  return () => {
    if (weg) return;
    weg = true;
    zeitgeber.delete(cb);
    if (!aufgaben.size && !zeitgeber.size) anhalten();
  };
}

/** Laeuft der Takt gerade? (Fuer Tests und den Qualitaetsregler.) */
export function taktLaeuft(): boolean { return raf !== 0; }
