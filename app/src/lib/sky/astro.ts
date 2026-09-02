/* ============================================================
   sky/astro.ts — Astronomie-Grundlagen der Szene

   Portiert aus `prototype/assets/js/main.js` Z. 135-173. Zahlenwerte und
   Kommentare sind unveraendert uebernommen; ergaenzt wurden nur Typen.
   Diese Funktionen sind bewusst frei von DOM und Canvas: sie liefern
   Zahlen, keine Pixel.
   ============================================================ */

/* Echte Mondphase aus dem Datum.
   Synodischer Monat 29.530588853 d, Referenz-Neumond 06.01.2000 18:14 UTC.
   Rueckgabe: 0 = Neumond, .25 = zunehmend halb, .5 = Vollmond,
              .75 = abnehmend halb. */
export function moonPhaseNow(date: Date = new Date()): number {
  const SYNODIC = 29.530588853;
  const REF = Date.UTC(2000, 0, 6, 18, 14, 0);
  let p = ((date.getTime() - REF) / 86400000 / SYNODIC) % 1;
  if (p < 0) p += 1;
  return p;
}

/** Rot, Gruen, Blau — jeweils 0..255. */
export type RGB = [number, number, number];

/* Planckscher Ortsbogen: Farbtemperatur -> RGB (Tanner Helland).
   Gut genug fuer Bildschirmdarstellung, nicht fuer Photometrie. */
export function kelvinToRGB(K: number): RGB {
  const t = K / 100;
  let r: number, g: number, b: number;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
  if (t >= 66) b = 255;
  else if (t <= 19) b = 0;
  else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (v: number) => Math.max(0, Math.min(255, v));
  return [c(r), c(g), c(b)];
}

/** Ein Eintrag der Spektralklassen-Verteilung: Anteil `w`, Temperaturfenster `lo`..`hi` (Kelvin). */
export interface SpectralClass {
  readonly w: number;
  readonly lo: number;
  readonly hi: number;
}

/* Spektralklassen-Anteile eines SICHTBAREN Himmels. Nicht die
   volumenbegrenzte Verteilung (dort sind 76 % M-Zwerge) — die sieht man
   nicht, weil sie zu dunkel sind. */
export const SPECTRAL: readonly SpectralClass[] = [
  { w: .06, lo: 10000, hi: 28000 },   // O/B  blauweiss
  { w: .28, lo:  7300, hi: 10000 },   // A
  { w: .16, lo:  6000, hi:  7300 },   // F
  { w: .17, lo:  5300, hi:  6000 },   // G  sonnenaehnlich
  { w: .27, lo:  3900, hi:  5300 },   // K  orange
  { w: .06, lo:  2900, hi:  3900 },   // M  rot
];

export function sampleTemp(): number {
  const r = Math.random();
  let acc = 0;
  for (const c of SPECTRAL) { acc += c.w; if (r <= acc) return c.lo + Math.random() * (c.hi - c.lo); }
  return 5800;
}
