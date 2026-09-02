/* ============================================================
   sky/noise.ts — Rauschgeneratoren der Szene

   Portiert aus `prototype/assets/js/main.js`:
     Z. 284-337 — noise2 / fbm / pnoise2 / pfbm
     Z. 834-866 — hash3 / vnoise3 / fbm3
   Zahlenwerte und Kommentare sind unveraendert uebernommen; ergaenzt
   wurden nur Typen. `engine.ts` traegt aus Portierungsgruenden noch seine
   eigenen, identischen Kopien (der Rumpf von `initStars` ist bewusst
   1:1 uebernommen) — dieses Modul ist die typisierte Fassung fuer alles,
   was danach kommt.
   ============================================================ */

/** Ein 2D-Wertrauschfeld: `(x, y) => 0..1`. */
export type Noise2 = (x: number, y: number) => number;
/** Ein in x periodisches 2D-Wertrauschfeld: `(x, y, P) => 0..1`, `P` = Periode in Gitterzellen. */
export type PNoise2 = (x: number, y: number, P: number) => number;

/* ---- Wertrauschen fuer Milchstrasse und Staubbahnen ---- */
export function noise2(seed: number): Noise2 {
  const g = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) g[i] = Math.random();
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const at = (a: number, b: number) => g[((a * 73 + b * 179 + seed * 31) & 4095 + 0) & 4095]!;
    const n00 = at(xi, yi), n10 = at(xi + 1, yi), n01 = at(xi, yi + 1), n11 = at(xi + 1, yi + 1);
    return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v;
  };
}

export function fbm(n: Noise2, x: number, y: number, oct: number): number {
  let s = 0, a = .5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f); f *= 2.03; a *= .5; }
  return s;
}

/* ---- In x periodisches Wertrauschen (nur fuer die Wolken) ----
   Die Wolkenebene ist doppelt so breit wie das Fenster und wird langsam
   durchgeschoben. Damit die Schleife nicht springt, muss das Feld in x
   exakt periodisch sein. noise2() ist das nicht: sein Hash kennt keine
   Periode, und fbm() multipliziert die Frequenz mit 2.03, was jede
   Periodizitaet ohnehin zerstoert. Hier deshalb beides periodisch —
   Gitterkoordinate wird vor dem Nachschlagen gefaltet, Frequenz
   verdoppelt sich exakt. */
export function pnoise2(seed: number): PNoise2 {
  const g = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) g[i] = Math.random();
  return (x: number, y: number, P: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const at = (a: number, b: number) => g[(((((a % P) + P) % P) * 73 + b * 179 + seed * 31) & 4095)]!;
    const n00 = at(xi, yi), n10 = at(xi + 1, yi), n01 = at(xi, yi + 1), n11 = at(xi + 1, yi + 1);
    return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v;
  };
}

/* Der Domain-Warp bleibt periodisch: verschiebt man x um P, verschiebt
   sich auch das (periodische) Warpfeld um P — das Argument wandert also
   um genau eine Periode weiter und liefert denselben Wert. */
export function pfbm(n: PNoise2, x: number, y: number, oct: number, P: number): number {
  let s = 0, a = .5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f, P * f); f *= 2; a *= .5; }
  return s;
}

/* ---- 3D-Wertrauschen fuer die Mondtextur ---- */
export function hash3(x: number, y: number, z: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

export function vnoise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), t = zf * zf * (3 - 2 * zf);
  let r = 0;
  for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const wgt = (i ? u : 1 - u) * (j ? v : 1 - v) * (k ? t : 1 - t);
    r += wgt * hash3(xi + i, yi + j, zi + k);
  }
  return r;
}

export function fbm3(x: number, y: number, z: number, oct: number): number {
  let s = 0, a = .5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise3(x * f, y * f, z * f); f *= 2.07; a *= .5; }
  return s;
}
