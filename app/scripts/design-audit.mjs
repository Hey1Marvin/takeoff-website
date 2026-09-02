/* ============================================================
   design-audit.mjs — Gestaltungsfehler messen statt raten.

   verify-ui.mjs ist das Pass/Fail-Tor: es sagt, ob die Seite kaputt ist.
   Dieses Skript ist das Messgeraet: es sagt, WO und UM WIE VIEL etwas
   falsch sitzt, und legt Screenshots ab, die man ansehen kann.

   Es prueft vier Dinge, die ein gruener Build nie sieht:

     1 UEBERLAPPUNG  Welcher Kasten liegt ueber einem Text, der ihm nicht
                     gehoert? Gemessen wird die Schnittflaeche zwischen
                     einem Textknoten und jedem Element, das ihn weder
                     enthaelt noch von ihm enthalten wird und spaeter
                     gemalt wird. Genau das ist die schwarze Platte ueber
                     "Naechste Missionen": ein ::before-Ueberstand von
                     20-34px aus scene-night.css.
     2 BESCHNITT     Wird eine Ueberschrift von ihrem eigenen Kasten
                     abgeschnitten? Zwei Faelle: Inhalt hoeher als der
                     Kasten (scrollHeight > clientHeight) und Glyphen,
                     die ueber eine Textplatte hinausragen (line-height
                     kleiner als der Schriftkasten von ~1.17em).
     3 RHYTHMUS      Der senkrechte Abstand zwischen benachbarten
                     Bloecken. Ausgegeben wird die tatsaechliche Leiter
                     je Seite — daran sieht man sofort, ob zwei Bloecke
                     zu eng stehen oder ein Abstand aus der Reihe faellt.
     4 LESBARKEIT    Text ohne Flaeche dahinter, inklusive h1 (das fehlt
                     in verify-ui.mjs) und inklusive Tag-Modus (dort
                     laeuft die Pruefung bisher gar nicht).

   Aufruf:
     npm run build && npm run start -- -p 3210
     node scripts/design-audit.mjs                    # alles
     node scripts/design-audit.mjs /awareness /events # nur diese Routen
     BASE=http://localhost:3000 node scripts/design-audit.mjs

   Ergebnis:
     .design-audit/<route>__<modus>__<breite>.png     Screenshots
     .design-audit/befunde.json                       alle Messwerte
     Zusammenfassung auf der Konsole
   ============================================================ */

import { chromium } from "playwright";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE || "http://localhost:3210";
const AUS = ".design-audit";

const ALLE_ROUTEN = [
  "/", "/events", "/events/freiraeume", "/events/marsmission",
  "/artists", "/artists/jojo", "/kollektiv", "/awareness", "/news",
  "/kalender", "/team", "/musik", "/kontakt", "/impressum", "/datenschutz",
];

/* Aus der Kommandozeile: alles nach dem Skriptnamen sind Routen. */
const ROUTEN = process.argv.slice(2).filter(a => a.startsWith("/"));
const routen = ROUTEN.length ? ROUTEN : ALLE_ROUTEN;

/* Drei Breiten: Telefon, Tablet, Desktop. Die 1210px sind bewusst dabei —
   in genau diesem Fenster ragen die Deko-Items in die Textspalte
   (home.css dokumentiert das nachgemessen). */
const BREITEN = [
  { name: "360", w: 360, h: 780 },
  { name: "768", w: 768, h: 1024 },
  { name: "1210", w: 1210, h: 900 },
  { name: "1440", w: 1440, h: 900 },
];

const MODI = [
  { name: "nacht", tag: false },
  { name: "tag", tag: true },
];

/* ------------------------------------------------------------
   Die Messung laeuft im Browser. Alles hier drin ist DOM-Code.
   ------------------------------------------------------------ */
const MESSEN = () => {
  const raus = { ueberlappung: [], beschnitt: [], rhythmus: [], lesbarkeit: [] };

  const sicht = el => {
    const s = getComputedStyle(el);
    if (s.display === "none" || s.visibility === "hidden" || +s.opacity === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const pfad = el => {
    const teile = [];
    for (let n = el; n && n !== document.body && teile.length < 4; n = n.parentElement) {
      let t = n.tagName.toLowerCase();
      if (n.id) { teile.unshift(t + "#" + n.id); break; }
      if (n.className && typeof n.className === "string") {
        const c = n.className.trim().split(/\s+/).slice(0, 2).join(".");
        if (c) t += "." + c;
      }
      teile.unshift(t);
    }
    return teile.join(" > ");
  };
  const text = el => (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60);

  /* ---------- 1 · Ueberlappung ----------
     Fuer jede Ueberschrift und jeden Absatz: liegt eine Flaeche darueber,
     die weder Vorfahr noch Nachfahr ist? Gemessen wird gegen die
     Bounding-Box der Textzeilen (getClientRects), nicht gegen die
     Element-Box — sonst zaehlt Leerraum als Treffer. */
  const traeger = [...document.querySelectorAll("main *")].filter(el => {
    if (!sicht(el)) return false;
    const s = getComputedStyle(el);
    /* Kandidaten sind Flaechen: eigener Hintergrund oder ein ::before/::after,
       das eine Flaeche malt. Das ::before erreichen wir nicht direkt — wir
       nehmen deshalb jedes positionierte Element mit Pseudo-Inhalt mit. */
    const hatGrund = s.backgroundColor !== "rgba(0, 0, 0, 0)" || s.backgroundImage !== "none";
    const vor = getComputedStyle(el, "::before");
    const hatVor = vor.content !== "none" &&
      (vor.backgroundColor !== "rgba(0, 0, 0, 0)" || vor.backgroundImage !== "none");
    return hatGrund || hatVor;
  });

  for (const t of document.querySelectorAll("main h1, main h2, main h3")) {
    if (!sicht(t) || !text(t)) continue;
    const zeilen = [...t.getClientRects()];
    if (!zeilen.length) continue;

    for (const f of traeger) {
      if (f === t || f.contains(t) || t.contains(f)) continue;

      /* Nur was NACH dem Text gemalt wird, kann ihn verdecken. Positionierte
         Elemente malen nach nicht-positionierten; sonst entscheidet die
         DOM-Reihenfolge. */
      const fs = getComputedStyle(f);
      const ts = getComputedStyle(t);
      /* Ein Element mit negativem z-index malt HINTER dem normalen
         Inhaltsfluss — es kann Text nicht verdecken. Genau so liegt das
         Hero-Video (z-index:-1) hinter der Next-Card, obwohl es sie
         geometrisch ueberdeckt. Ohne diese Zeile meldet die Pruefung
         jedes Hintergrundbild als Ueberlappung. */
      /* Negativer Stapelrang — auch geerbt. `.aw-sky-inner` traegt selbst
         z-index auto, liegt aber in `#aw-sky` mit z-index -2 und malt damit
         hinter dem gesamten Inhalt. Ohne den Blick nach oben meldet die
         Pruefung jede Deko-Ebene als Ueberlappung. */
      let hinten = false;
      for (let n = f; n && n !== document.body; n = n.parentElement) {
        const ns = getComputedStyle(n);
        if (ns.zIndex !== "auto" && parseInt(ns.zIndex, 10) < 0) { hinten = true; break; }
        /* Ein eigener Stapelkontext beendet die Suche: weiter oben liegende
           Raenge gelten dann nicht mehr fuer dieses Element. */
        if (ns.isolation === "isolate" || (ns.zIndex !== "auto" && parseInt(ns.zIndex, 10) >= 0)) break;
      }
      if (hinten) continue;

      /* Und der Text kann selbst einen Rang tragen: seit It. 14 stehen
         Ueberschriften auf z-index 1 und liegen damit ueber jeder
         Geschwisterplatte, auch wenn die geometrisch drueberliegt.
         Ohne diese Zeile meldet die Pruefung genau die Faelle weiter,
         die sie vorher gefunden hat und die inzwischen behoben sind. */
      const rang = v => (v.zIndex === "auto" ? 0 : parseInt(v.zIndex, 10) || 0);
      if (ts.position !== "static" && rang(ts) > rang(fs)) continue;

      const fPos = fs.position !== "static";
      const tPos = ts.position !== "static";
      const spaeter = fPos && !tPos
        ? true
        : (t.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      if (!spaeter) continue;

      /* Die eigentliche Flaeche ist oft das ::before, das ueber sein
         Element hinausragt. Ueberstand aus dem inset ablesen. */
      const vor = getComputedStyle(f, "::before");
      let box = f.getBoundingClientRect();
      if (vor.content !== "none" && vor.position === "absolute") {
        const px = v => (v && v.endsWith("px") ? parseFloat(v) : 0);
        box = new DOMRect(
          box.x + px(vor.left), box.y + px(vor.top),
          box.width - px(vor.left) - px(vor.right),
          box.height - px(vor.top) - px(vor.bottom));
      }

      for (const z of zeilen) {
        const ux = Math.max(0, Math.min(z.right, box.right) - Math.max(z.left, box.left));
        const uy = Math.max(0, Math.min(z.bottom, box.bottom) - Math.max(z.top, box.top));
        if (ux > 4 && uy > 2) {
          raus.ueberlappung.push({
            text: text(t), textPfad: pfad(t), ueberPfad: pfad(f),
            ueberlappungPx: Math.round(uy), breitePx: Math.round(ux),
          });
          break;
        }
      }
    }
  }

  /* ---------- 2 · Beschnitt ---------- */
  for (const el of document.querySelectorAll("main h1, main h2, main h3, main .wordmark, main .etitle")) {
    if (!sicht(el) || !text(el)) continue;
    const s = getComputedStyle(el);
    const groesse = parseFloat(s.fontSize);
    const zeile = s.lineHeight === "normal" ? groesse * 1.2 : parseFloat(s.lineHeight);

    if (el.scrollHeight - el.clientHeight > 1 && s.overflow !== "visible") {
      raus.beschnitt.push({ text: text(el), pfad: pfad(el), grund: "Inhalt hoeher als Kasten",
        umPx: Math.round(el.scrollHeight - el.clientHeight) });
    }
    /* Schriftkasten von Unbounded/Planet Kosmos ~1.17em. Liegt der
       Zeilenvorschub darunter, ueberlappen die Zeilen einer umbrechenden
       Ueberschrift und Unterlaengen stossen an. */
    if (zeile / groesse < 1.17 && el.getClientRects().length > 1) {
      raus.beschnitt.push({ text: text(el), pfad: pfad(el),
        grund: `line-height ${(zeile / groesse).toFixed(2)} < Schriftkasten 1.17 bei ${el.getClientRects().length} Zeilen`,
        umPx: Math.round((1.17 - zeile / groesse) * groesse) });
    }
    if (s.webkitBackgroundClip === "text" || s.backgroundClip === "text") {
      const pad = parseFloat(s.paddingBottom) + parseFloat(s.paddingTop);
      if (zeile / groesse < 1.2 && pad < groesse * 0.1) {
        raus.beschnitt.push({ text: text(el), pfad: pfad(el),
          grund: "background-clip:text ohne Padding-Ausgleich bei engem line-height", umPx: 0 });
      }
    }
  }

  /* ---------- 3 · Rhythmus ---------- */
  const bloecke = [...document.querySelectorAll("main > *, main .section > .wrap > *")]
    .filter(sicht)
    .map(el => ({ el, r: el.getBoundingClientRect() }))
    .sort((a, b) => a.r.top - b.r.top);
  for (let i = 1; i < bloecke.length; i++) {
    const luft = bloecke[i].r.top - bloecke[i - 1].r.bottom;
    if (luft > -400 && luft < 400) {
      raus.rhythmus.push({
        oben: pfad(bloecke[i - 1].el), unten: pfad(bloecke[i].el),
        abstandPx: Math.round(luft),
      });
    }
  }

  /* ---------- 4 · Lesbarkeit: Text ohne Flaeche ----------
     h1 ist hier bewusst dabei — verify-ui.mjs laesst es aus, und genau
     die Awareness-Hero-Ueberschrift faellt dadurch durchs Raster. */
  for (const el of document.querySelectorAll("main h1, main h2, main h3, main p, main li, main dt, main dd, main span.chip")) {
    if (!sicht(el) || !text(el)) continue;
    let hat = false;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.backgroundColor !== "rgba(0, 0, 0, 0)" && !/, 0\)$/.test(s.backgroundColor)) { hat = true; break; }
      if (s.backgroundImage !== "none") { hat = true; break; }
      const vor = getComputedStyle(n, "::before");
      if (vor.content !== "none" &&
          (vor.backgroundImage !== "none" ||
           (vor.backgroundColor !== "rgba(0, 0, 0, 0)" && !/, 0\)$/.test(vor.backgroundColor)))) { hat = true; break; }
    }
    if (!hat) raus.lesbarkeit.push({ text: text(el), pfad: pfad(el) });
  }

  return raus;
};

/* ------------------------------------------------------------ */
await rm(AUS, { recursive: true, force: true });
await mkdir(AUS, { recursive: true });

const browser = await chromium.launch();
const alles = [];
let summeU = 0, summeB = 0, summeL = 0;

for (const route of routen) {
  for (const modus of MODI) {
    for (const b of BREITEN) {
      const ctx = await browser.newContext({ viewport: { width: b.w, height: b.h } });
      /* Tag/Nacht vor dem ersten Frame setzen — das BOOT-Script liest den
         localStorage-Schluessel, ein spaeterer Klick wuerde nachladen. */
      await ctx.addInitScript(([tag, theme]) => {
        try {
          /* Das BOOT-Script prueft auf den Wert "on" (layout.tsx). Mit "1"
             bleibt die Seite Nacht und die halbe Messreihe ist wertlos. */
          localStorage.setItem("takeoff-day", tag ? "on" : "off");
          if (theme) localStorage.setItem("takeoff-theme", theme);
          /* Volle Effektstufe, sonst misst man eine Seite, auf der
             Reveals und Deko-Parallaxe gar nicht laufen. */
          localStorage.setItem("takeoff-fx", "l");
        } catch {}
      }, [modus.tag, process.env.THEME || ""]);

      const page = await ctx.newPage();
      const fehler = [];
      page.on("console", m => { if (m.type() === "error") fehler.push(m.text()); });

      await page.goto(BASE + route, { waitUntil: "networkidle" });
      /* Reveals ausloesen: einmal durchscrollen, dann zurueck. Sonst
         misst man Bloecke, die noch bei opacity 0 stehen. */
      await page.evaluate(async () => {
        const schritt = innerHeight * 0.8;
        for (let y = 0; y < document.body.scrollHeight; y += schritt) {
          scrollTo(0, y); await new Promise(r => setTimeout(r, 60));
        }
        scrollTo(0, 0); await new Promise(r => setTimeout(r, 250));
      });

      const befund = await page.evaluate(MESSEN);
      const themeTeil = process.env.THEME ? `__${process.env.THEME}` : "";
      const name = `${route.replace(/\//g, "_") || "_home"}${themeTeil}__${modus.name}__${b.name}`;
      await page.screenshot({ path: path.join(AUS, name + ".png"), fullPage: true });

      summeU += befund.ueberlappung.length;
      summeB += befund.beschnitt.length;
      summeL += befund.lesbarkeit.length;
      alles.push({ route, modus: modus.name, breite: b.name, bild: name + ".png",
        konsolenfehler: fehler, ...befund });

      const marke = befund.ueberlappung.length || befund.beschnitt.length ? "!!" : "  ";
      console.log(`${marke} ${route.padEnd(24)} ${modus.name.padEnd(6)} ${b.name.padStart(5)}px  ` +
        `ueberlappung ${String(befund.ueberlappung.length).padStart(2)} · ` +
        `beschnitt ${String(befund.beschnitt.length).padStart(2)} · ` +
        `ohne Flaeche ${String(befund.lesbarkeit.length).padStart(3)}`);

      await ctx.close();
    }
  }
}

await browser.close();
await writeFile(path.join(AUS, "befunde.json"), JSON.stringify(alles, null, 2));

console.log(`\n== Summe ==`);
console.log(`   Ueberlappungen : ${summeU}`);
console.log(`   Beschnitte     : ${summeB}`);
console.log(`   Text o. Flaeche: ${summeL}`);
console.log(`\n   Screenshots + befunde.json in ${AUS}/`);
