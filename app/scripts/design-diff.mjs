/* ============================================================
   design-diff.mjs — zwei Screenshot-Staende pixelweise vergleichen.

   Wozu: "Der Desktop bleibt unveraendert" ist eine Behauptung, solange
   niemand sie misst. Dieses Skript haelt die Bilder aus zwei Laeufen von
   design-audit.mjs (STATIC=1!) uebereinander und zaehlt die Pixel, die
   sich unterscheiden. Ohne STATIC=1 unterscheiden sich Uhren, Laufband
   und Sternfeld von sich selbst — dann misst man Rauschen.

   Aufruf:
     STATIC=1 AUS=.design-audit-vorher node scripts/design-audit.mjs   # vorher
     ... umbauen ...
     STATIC=1 node scripts/design-audit.mjs                            # nachher
     node scripts/design-diff.mjs .design-audit-vorher .design-audit [--widths 1210,1440] [--max 0.05]

   Ergebnis:
     Tabelle je Bildpaar mit Anteil abweichender Pixel; Diff-Bilder unter
     <dirB>/diff/<name>.png (abweichende Pixel magenta auf dem Nachher-Bild).
     Exit 1, sobald ein Paar der gepruefen Breiten ueber --max Prozent liegt.
   Bilder verschiedener Hoehe (Seite ist laenger/kuerzer geworden) zaehlen
   als Abweichung ueber die volle Differenzflaeche — genau das will man
   auf dem Desktop sehen.
   ============================================================ */

import { chromium } from "playwright";
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const dirs = args.filter(a => !a.startsWith("--"));
if (dirs.length < 2) {
  console.error("Aufruf: node scripts/design-diff.mjs <vorher> <nachher> [--widths 1210,1440] [--max 0.05]");
  process.exit(2);
}
const [A, B] = dirs;
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const BREITEN = opt("--widths", "1210,1440").split(",").map(s => s.trim());
const MAX = Number(opt("--max", "0.05"));

const dateien = (await readdir(B)).filter(f => f.endsWith(".png"));
const paare = dateien.filter(f => BREITEN.some(w => f.endsWith(`__${w}.png`)));
if (!paare.length) { console.error(`Keine Bilder fuer Breiten ${BREITEN.join("/")} in ${B}`); process.exit(2); }

await mkdir(path.join(B, "diff"), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();

/* Der Vergleich laeuft im Browser: zwei Bilder auf je ein Canvas, dann
   Byte fuer Byte. Zero Abhaengigkeiten, und Chromium ist ohnehin da. */
const VERGLEICH = async ([a, b]) => {
  const lade = src => new Promise((res, rej) => {
    const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src;
  });
  const [ia, ib] = await Promise.all([lade(a), lade(b)]);
  const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
  const cv = (im) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.fillStyle = "#000"; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0);
    return x.getImageData(0, 0, w, h);
  };
  const da = cv(ia), db = cv(ib);
  const out = new ImageData(new Uint8ClampedArray(db.data), w, h);
  let anders = 0;
  for (let i = 0; i < da.data.length; i += 4) {
    const d = Math.abs(da.data[i] - db.data[i]) + Math.abs(da.data[i + 1] - db.data[i + 1]) + Math.abs(da.data[i + 2] - db.data[i + 2]);
    if (d > 24) {
      anders++;
      out.data[i] = 255; out.data[i + 1] = 60; out.data[i + 2] = 220; out.data[i + 3] = 255;
    }
  }
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d").putImageData(out, 0, 0);
  return { anders, gesamt: w * h, hoeheA: ia.height, hoeheB: ib.height, bild: c.toDataURL("image/png") };
};

let schlecht = 0;
console.log(`\n${"Bild".padEnd(46)} ${"Hoehe v/n".padStart(12)} ${"anders".padStart(9)}`);
for (const name of paare.sort()) {
  let bufA;
  try { bufA = await readFile(path.join(A, name)); } catch { console.log(`${name.padEnd(46)}  fehlt in ${A}`); schlecht++; continue; }
  const bufB = await readFile(path.join(B, name));
  const r = await page.evaluate(VERGLEICH, [
    "data:image/png;base64," + bufA.toString("base64"),
    "data:image/png;base64," + bufB.toString("base64"),
  ]);
  const prozent = (100 * r.anders / r.gesamt);
  const marke = prozent > MAX ? "!!" : "  ";
  if (prozent > MAX) schlecht++;
  console.log(`${marke} ${name.padEnd(44)} ${String(r.hoeheA).padStart(5)}/${String(r.hoeheB).padEnd(5)} ${prozent.toFixed(3).padStart(8)} %`);
  if (r.anders > 0) {
    await writeFile(path.join(B, "diff", name), Buffer.from(r.bild.split(",")[1], "base64"));
  }
}
await browser.close();
console.log(`\n${schlecht ? `${schlecht} Paar(e) ueber ${MAX} % — Diff-Bilder in ${B}/diff/` : `alle ${paare.length} Paare unter ${MAX} %`}`);
process.exit(schlecht ? 1 : 0);
