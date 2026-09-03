/* ============================================================
   mess-leistung.mjs — Bildzeiten beim Scrollen, gemessen statt geraten

   WARUM ES DIESES SKRIPT GIBT
   `verify-ui.mjs` prueft elf Gruppen und war zwoelf Iterationen lang gruen,
   waehrend die Seite beim Scrollen sichtbar ruckelte. Es misst Struktur —
   Ebenen, Overflow, Zustaende —, aber keine einzige Bildzeit. Was niemand
   misst, faellt niemandem auf.

   WAS GEMESSEN WIRD
   Je Route und Effektstufe wird die Seite mit fester Geschwindigkeit
   durchgescrollt, waehrenddessen laufen drei Sonden IM Browser mit:
     · rAF-Abstaende  -> Bildzeiten (p50/p95/schlechtestes, Anzahl > 50 ms)
     · longtask       -> Blockierungen des Hauptstrangs ("haengt sich auf")
     · layout-shift   -> CLS, damit eine Optimierung nicht Ruckeln gegen
                         Springen eintauscht
     · long-animation-frame (LoAF) -> WIEVIEL Arbeit je Bild, aufgeteilt in
                         Skript und Stil/Layout

   Warum LoAF dazugehoert: rAF-Abstaende sind an die Bildwiederholrate
   gerastert. Ein Bild, das 18 ms Arbeit macht, erscheint dort als 33 ms —
   man sieht, DASS ein Bild verpasst wurde, aber nicht, woran. LoAF liefert
   die Rohzeiten und trennt Skript von Stil/Layout. Genau diese Trennung
   entscheidet, ob eine Optimierung an der Zeichenschleife oder am CSS
   ansetzen muss.

   ZWEI FALLEN, DIE HIER BEWUSST UMGANGEN WERDEN
   1. `?perf=1` legt den FPS-Watchdog stumm (state.ts, `perf`). Ohne das
      stuft er mitten im Messlauf herunter — er sieht ja lange Frames — und
      die zweite Haelfte der Messung gilt dann fuer eine ANDERE Effektstufe
      als die erste. Der Vorher-Nachher-Vergleich misst dann zwei
      verschiedene Dinge.
   2. Die Effektstufe muss im localStorage stehen, BEVOR das Boot-Script in
      layout.tsx laeuft — deshalb `addInitScript` und nicht `evaluate`.

   BEDIENUNG
     npm run build && npx next start -p 3210
     node scripts/mess-leistung.mjs                 # misst und schreibt Bericht
     node scripts/mess-leistung.mjs --grundlinie    # zusaetzlich als Grundlinie ablegen
     node scripts/mess-leistung.mjs --vergleich     # gegen die Grundlinie halten

   Braucht Playwright (wie verify-ui.mjs), ist bewusst KEINE
   Projekt-Abhaengigkeit.
   ============================================================ */
import { chromium } from "playwright";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.BASE || "http://localhost:3210";
const HIER = dirname(fileURLToPath(import.meta.url));
const GRUNDLINIE = `${HIER}/../.messwerte/grundlinie.json`;
const LETZTE = `${HIER}/../.messwerte/letzte.json`;

const args = process.argv.slice(2);
const setzeGrundlinie = args.includes("--grundlinie");
const vergleiche = args.includes("--vergleich");

/* Routen mit ihren jeweiligen Lastspitzen. Die Auswahl ist nicht beliebig:
   jede steht fuer eine andere Art von Last. */
const ROUTEN = [
  ["/",                        "Startseite — Hero-Video + volle Szene"],
  ["/kollektiv",               "zweiter Scroll-Handler (KollektivHistory)"],
  ["/awareness",               "achte Vollbild-Ebene (aw-sky + Blur-Schleier)"],
  ["/events/groesstes-event",  "32 Medienkacheln"],
  ["/events/pride",            "17 Lineup-Eintraege"],
  ["/artists/jojo",            "Artist-Seite mit Set-Karten"],
];

/* "s" laeuft ohne Zeichenschleife — dort wird gemessen, ob die RUHIGE Stufe
   wirklich ruhig ist. Wenn selbst dort Bilder ueber 50 ms auftauchen, liegt
   es nicht an der Szene. */
const STUFEN = ["s", "m", "l"];

/* CPU-Drosselung. OHNE sie misst man vor allem, dass der Entwicklerrechner
   schnell ist — dort laeuft alles mit 60 fps und ein Fortschritt waere
   unsichtbar. Marvins Beschwerde gilt aber schwaecheren Geraeten.
   4x ist der Wert, mit dem auch Lighthouse mobil drosselt (Moto-G-Klasse,
   siehe research/31-performance-adaptiv-a11y.md §3.1). Ueber die Umgebung
   abschaltbar, um ungedrosselt gegenzuprobieren. */
const DROSSEL = Number(process.env.DROSSEL ?? 4);

const perzentil = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))];
};

/* ---------- Die Sonde, die IM Browser laeuft ----------
   Sie scrollt selbst, statt sich von aussen scrollen zu lassen: ein
   `mouse.wheel` von Playwright erzeugt Eingabe-Ereignisse mit eigener
   Taktung und misst am Ende die Reaktionszeit des Treibers mit. Uns
   interessiert, was die SEITE kostet. */
function sondeCode(scrollMs) {
  return new Promise(fertig => {
    const bilder = [];
    const langeAufgaben = [];
    let cls = 0;

    const poLong = new PerformanceObserver(list => {
      for (const e of list.getEntries()) langeAufgaben.push(Math.round(e.duration));
    });
    try { poLong.observe({ entryTypes: ["longtask"] }); } catch { /* Firefox kennt es nicht */ }

    const poCls = new PerformanceObserver(list => {
      for (const e of list.getEntries()) if (!e.hadRecentInput) cls += e.value;
    });
    try { poCls.observe({ type: "layout-shift", buffered: true }); } catch { /* egal */ }

    /* LoAF meldet NUR Bilder ueber 50 ms — es ist damit kein Mass fuer die
       normale Bildarbeit, sondern der Melder fuer genau das, was Marvin als
       "haengt sich auf" beschreibt. Bewusst OHNE `buffered`: mit gepufferten
       Eintraegen kaemen die Ladebilder mit in die Statistik, und die haben
       mit dem Scrollen nichts zu tun (sie waren der Grund, warum hier zuerst
       auf jeder Route ~105 ms standen, sogar in der Stufe ohne Zeichenschleife). */
    const loaf = [];
    const poLoaf = new PerformanceObserver(list => {
      for (const e of list.getEntries()) {
        loaf.push({
          d: Math.round(e.duration),
          sl: Math.round(e.styleAndLayoutDuration || 0),
          js: Math.round((e.scripts || []).reduce((a, s) => a + s.duration, 0)),
        });
      }
    });
    try { poLoaf.observe({ type: "long-animation-frame" }); } catch { /* nur Chromium */ }

    const maxY = document.documentElement.scrollHeight - innerHeight;
    const start = performance.now();
    let letzte = start;
    let richtung = 1;

    const schritt = t => {
      const dt = t - letzte; letzte = t;
      bilder.push(dt);

      /* Feste Strecke je Bild, nicht je Millisekunde: so scrollt die Messung
         auf schnellen und langsamen Geraeten gleich weit und die Bildzeiten
         bleiben vergleichbar. */
      const y = scrollY + 14 * richtung;
      if (y >= maxY) richtung = -1;
      else if (y <= 0) richtung = 1;
      scrollTo(0, Math.max(0, Math.min(maxY, y)));

      if (t - start < scrollMs) requestAnimationFrame(schritt);
      else {
        poLong.disconnect(); poCls.disconnect(); poLoaf.disconnect();
        /* Die ersten drei Bilder wegwerfen: darin steckt der Aufbau der
           Sonde selbst, nicht die Seite. */
        fertig({ bilder: bilder.slice(3), langeAufgaben, loaf, cls: Math.round(cls * 1000) / 1000, maxY });
      }
    };
    requestAnimationFrame(t => { letzte = t; requestAnimationFrame(schritt); });
  });
}

/* Bildwiederholrate des Messrechners: ohne sie ist "60 fps" eine Annahme.
   Auf einem 120-Hz-Schirm ist ein 16-ms-Bild bereits ein verpasstes. */
async function messeRefresh(page) {
  return page.evaluate(() => new Promise(fertig => {
    const d = []; let n = 0, letzte = 0;
    const tick = t => {
      if (letzte) d.push(t - letzte);
      letzte = t;
      if (++n < 40) requestAnimationFrame(tick);
      else {
        d.sort((a, b) => a - b);
        fertig(Math.round(1000 / d[Math.floor(d.length / 2)]));
      }
    };
    requestAnimationFrame(tick);
  }));
}

const browser = await chromium.launch();
const refreshCtx = await browser.newContext();
const refreshPage = await refreshCtx.newPage();
await refreshPage.goto(BASE + "/", { waitUntil: "load" });
const HZ = await messeRefresh(refreshPage);
await refreshCtx.close();

const budget = Math.round((1000 / HZ) * 10) / 10;
console.log(`\nBildwiederholrate des Messrechners: ${HZ} Hz  (Bildbudget ${budget} ms)`);
console.log(`Basis: ${BASE}   CPU-Drosselung: ${DROSSEL}x\n`);

const ergebnis = { hz: HZ, wann: new Date().toISOString(), routen: {} };
let fehler = 0;

/* Themes messen, nicht nur Routen: Mars traegt Rover und Rakete auf einer
   eigenen bewegten Ebene, Strand die Brandung mit bis zu 46 Wellenkaemmen.
   Beide sind ganz andere Zeichenschleifen als der Sternenhimmel — wer nur
   Space misst, hat zwei Drittel der Szene nie gesehen. Nur auf der
   Startseite, damit der Lauf nicht ausufert. */
const THEMEN = ["space", "mars", "strand"];

const laeufe = [];
for (const [route, was] of ROUTEN) {
  for (const stufe of STUFEN) {
    const themen = route === "/" ? THEMEN : ["space"];
    for (const theme of themen) laeufe.push({ route, was, stufe, theme });
  }
}

let letzteRoute = "";
for (const { route, was, stufe, theme } of laeufe) {
  if (route !== letzteRoute) { console.log(`\n== ${route}  — ${was}`); letzteRoute = route; }
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    /* VOR dem Boot-Script: sonst stempelt es die alte Stufe und die
       Messung laeuft gegen etwas anderes als angezeigt. */
    await page.addInitScript(([s, th]) => {
      try {
        localStorage.setItem("takeoff-fx", s);
        localStorage.setItem("takeoff-theme", th);
        localStorage.setItem("takeoff-ground", "on");
        localStorage.removeItem("takeoff-fx-downgrades");
      } catch { /* egal */ }
    }, [stufe, theme]);

    const konsole = [];
    page.on("pageerror", e => konsole.push(e.message));

    /* Erst laden, DANN drosseln: eine gedrosselte Ladephase verzoegert nur
       den Aufbau und faelscht die spaeteren Messwerte ueber nachlaufende
       Arbeit. Gemessen werden soll das Scrollen. */
    await page.goto(`${BASE}${route}?perf=1`, { waitUntil: "load" });
    await page.waitForTimeout(1400);          // Szene aufbauen lassen
    const cdp = await ctx.newCDPSession(page);
    if (DROSSEL > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: DROSSEL });

    const istStufe = await page.evaluate(() => document.documentElement.dataset.fx);
    const m = await page.evaluate(sondeCode, 4000);

    /* Der Mittelwert ist das feine Mass. p50/p95 koennen nur Vielfache der
       Bildwiederholrate annehmen (16,7 / 33,3 / 50 …) — eine Verbesserung um
       weniger als ein ganzes Bild ist darin unsichtbar, und welcher Stufe ein
       Grenzfall zufaellt, entscheidet die Tageslast der Maschine. Der
       Mittelwert ueber ~250 Bilder loest deutlich feiner auf. */
    const mittel = Math.round((m.bilder.reduce((a, b) => a + b, 0) / Math.max(1, m.bilder.length)) * 10) / 10;
    const p50 = Math.round(perzentil(m.bilder, .5) * 10) / 10;
    const p95 = Math.round(perzentil(m.bilder, .95) * 10) / 10;
    const max = Math.round(Math.max(...m.bilder, 0) * 10) / 10;
    const ruckler = m.bilder.filter(d => d > 50).length;
    const langste = Math.max(0, ...m.langeAufgaben);

    /* Haenger = Bilder ueber 50 ms, wie LoAF sie meldet. Dazu das
       schlimmste davon und die Aufteilung Skript / Stil+Layout — sie sagt,
       ob die Zeichenschleife oder das CSS die Ursache ist. */
    const haenger = m.loaf.length;
    const schlimmster = Math.max(0, ...m.loaf.map(x => x.d));
    const mit = k => haenger ? Math.round(m.loaf.reduce((a, x) => a + x[k], 0) / haenger) : 0;
    const jsMs = mit("js"), slMs = mit("sl");

    const name = theme === "space" ? `${route} @${stufe}` : `${route} @${stufe} ${theme}`;
    ergebnis.routen[name] = {
      mittel, p50, p95, max, ruckler, cls: m.cls, langste, bilder: m.bilder.length,
      haenger, schlimmster, jsMs, slMs,
    };

    /* Bewertung gegen das ECHTE Bildbudget des Geraets, nicht gegen 16.7 ms. */
    const gut = p95 <= budget * 1.5 && ruckler === 0;
    const zeichen = gut ? "OK  " : "LANG";
    if (!gut) fehler++;
    console.log(
      `  ${zeichen} [${stufe}${theme === "space" ? "" : "/" + theme.slice(0, 2)}] Mittel ${String(mittel).padStart(5)} ms · p95 ${String(p95).padStart(6)} ms · max ${String(max).padStart(6)} ms`
      + ` · Haenger ${String(haenger).padStart(3)} (max ${String(schlimmster).padStart(4)} ms,`
      + ` JS ${String(jsMs).padStart(3)} / Stil ${String(slMs).padStart(3)})`
      + ` · CLS ${m.cls}`
      + (istStufe !== stufe ? `  ⚠ Stufe ist ${istStufe}!` : "")
      + (konsole.length ? `  ⚠ ${konsole[0].slice(0, 60)}` : ""),
    );
    await ctx.close();
  }
}

await browser.close();

mkdirSync(dirname(LETZTE), { recursive: true });
writeFileSync(LETZTE, JSON.stringify(ergebnis, null, 2));
if (setzeGrundlinie) {
  writeFileSync(GRUNDLINIE, JSON.stringify(ergebnis, null, 2));
  console.log(`\nGrundlinie abgelegt: ${GRUNDLINIE}`);
}

if (vergleiche && existsSync(GRUNDLINIE)) {
  const alt = JSON.parse(readFileSync(GRUNDLINIE, "utf8"));
  console.log(`\n\n==== Vergleich mit der Grundlinie (${alt.wann}) ====`);
  console.log("Route @Stufe                     mittlere Bildzeit          Aenderung");
  let summeAlt = 0, summeNeu = 0, n = 0;
  for (const [k, neu] of Object.entries(ergebnis.routen)) {
    const a = alt.routen[k];
    if (!a || a.mittel === undefined) continue;
    const d = Math.round((neu.mittel - a.mittel) * 10) / 10;
    const proz = Math.round((d / a.mittel) * 1000) / 10;
    summeAlt += a.mittel; summeNeu += neu.mittel; n++;
    const pfeil = proz < -3 ? `besser  ${proz} %` : proz > 3 ? `SCHLECHTER +${proz} %` : "gleich";
    console.log(
      `${k.padEnd(32)} ${String(a.mittel).padStart(6)} → ${String(neu.mittel).padStart(6)} ms   `
      + `${pfeil}`,
    );
  }
  if (n) {
    const ga = summeAlt / n, gn = summeNeu / n;
    console.log(`\n${"ueber alle Messungen".padEnd(32)} ${ga.toFixed(1).padStart(6)} → ${gn.toFixed(1).padStart(6)} ms   `
      + `${(((gn - ga) / ga) * 100).toFixed(1)} %`);
  }
}

console.log(`\n==== ${fehler ? fehler + " Messungen ueber Budget" : "ALLE INNERHALB DES BUDGETS"} ====`);
