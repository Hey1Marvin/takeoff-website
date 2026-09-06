/* Mobil-Audit: misst konkrete Design-Probleme auf allen öffentlichen Seiten
   bei 360 / 390 / 412 px. KEINE Wertung per Auge — nur nachmessbare Fakten:

     - Tap-Ziele < 44px, Fließtext < 14px
     - horizontaler Overflow in BEIDEN Richtungen (scrollWidth und
       aufgesprengter Layout-Viewport)
     - Kopfleisten-Höhe (> 64px wird gemeldet — auf dem Telefon ist die
       HUD-Zeile weg, 60px sind das Ziel)
     - Hero-Kontrast: der Text im Hero ("/" und "/events/marsmission") wird
       gegen das gemessen, was WIRKLICH dahinter liegt — bei "/" das laufende
       Video (zwei Stichproben, die schlechtere zählt), auf der Event-Seite
       der statische Grund. Dazu wird der Text kurz unsichtbar geschaltet,
       ein Ausschnitt fotografiert und im Browser selbst ausgewertet
       (mittlere relative Leuchtdichte nach WCAG). Unter 4.5:1 → KONTRAST.
     - Erster Bildschirm auf "/": wie viele Textblöcke stehen im ersten
       Bild (> 7 → BLOECKE), und liegt der Hauptknopf `.hm-cta` im
       Daumenbereich (untere 40 % des Bildschirms, über der Falz)?
     - Sticky-Leiste auf "/events/marsmission" (nur ≤ 560px): erscheint sie
       nach 700px Scroll, liegt sie im Bild, bleibt Mission Control darüber,
       hält der Footer Platz für sie?

   Aufruf (aus app/, Server auf :3210):
     node scripts/mobile-audit.mjs 3210                # 360, 390 und 412 nacheinander
     node scripts/mobile-audit.mjs 3210 390            # nur eine Breite
     node scripts/mobile-audit.mjs 3210 --report       # Detail je Seite (Tap, Text, Kontrast, Blöcke)
     node scripts/mobile-audit.mjs 3210 --json         # zusätzlich .design-audit/mobil-<breite>[-tag][-<theme>].json
     node scripts/mobile-audit.mjs 3210 --tag          # derselbe Lauf im Tagmodus (takeoff-day=on)
     node scripts/mobile-audit.mjs 3210 --theme mars   # mit Theme mars|strand (Standard: Space)

   Der Lauf setzt vor dem ersten Paint takeoff-video=on und takeoff-fx=l,
   damit der Kontrast über dem laufenden Video gemessen wird und nicht über
   dem Ersatz-Standbild. Nachts und tags sind zwei getrennte Läufe (--tag),
   damit ein Lauf nicht doppelt so lang dauert.

   Nicht parallel zu mess-leistung.mjs starten: ein zweites Chromium
   verfälscht dessen Bildzeiten. */
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* ---------- Argumente ---------- */
const ARGS = process.argv.slice(2);
const THEME = (() => { const i = ARGS.indexOf("--theme"); return i >= 0 ? (ARGS[i + 1] ?? null) : null; })();
const POS = ARGS.filter((a, i) => !a.startsWith("--") && ARGS[i - 1] !== "--theme");
const PORT = POS[0] ?? "3210";
const HOEHEN = { 360: 780, 390: 844, 412: 915 };
const BREITEN = POS[1] ? [Number(POS[1])] : [360, 390, 412];
const TAG = ARGS.includes("--tag");
const REPORT = ARGS.includes("--report");
const JSON_AUS = ARGS.includes("--json");
const BASIS = `http://localhost:${PORT}`;
const ROUTEN = ["/", "/events", "/events/marsmission", "/artists", "/artists/jojo",
  "/kollektiv", "/awareness", "/news", "/kalender", "/team", "/musik", "/kontakt",
  "/impressum", "/datenschutz"];
/* Hero-Texte, deren Kontrast gemessen wird — nur wo sie im DOM stehen. */
const KONTRAST_ZIELE = { "/": [".hm-date", ".hm-title", ".hm-meta"],
                         "/events/marsmission": [".etitle", ".ed-facts dd"] };
const KONTRAST_MIN = 4.5;

/* ---------- Browser ---------- */
const prof = mkdtempSync(join(tmpdir(), "ma-"));
const dbgPort = 9400 + Math.floor(Math.random() * 400);
const maxW = Math.max(...BREITEN), maxH = Math.max(...BREITEN.map(w => HOEHEN[w] ?? 780));
const chrome = spawn("chromium", ["--headless", "--disable-gpu", "--no-sandbox",
  "--autoplay-policy=no-user-gesture-required",
  `--remote-debugging-port=${dbgPort}`, `--user-data-dir=${prof}`,
  `--window-size=${maxW},${maxH}`, "about:blank"], { stdio: "ignore" });

const schlaf = (ms) => new Promise(r => setTimeout(r, ms));
await schlaf(1200);
let wsUrl;
for (let i = 0; i < 30; i++) {
  try { const l = await (await fetch(`http://127.0.0.1:${dbgPort}/json/list`)).json();
    wsUrl = l.find((t) => t.type === "page")?.webSocketDebuggerUrl;
    if (wsUrl) break; } catch { /* retry */ }
  await schlaf(300);
}
if (!wsUrl) { console.error("Chromium antwortet nicht auf dem Debug-Port."); chrome.kill(); process.exit(2); }
const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let id = 0; const warten = new Map();
ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.id && warten.has(m.id)) { warten.get(m.id)(m); warten.delete(m.id); } });
const cdp = (method, params = {}) => new Promise(res => { const i = ++id; warten.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expr) => { const m = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true }); return m?.result?.result?.value; };
/* Für Ausdrücke, die ein Promise liefern (Bild dekodieren, auf ein Frame warten). */
const jsP = async (expr) => { const m = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true }); return m?.result?.result?.value; };

await cdp("Page.enable"); await cdp("Runtime.enable");
/* Vor dem ersten Paint: Video an, volle FX-Stufe, Tag/Nacht und Theme.
   Dieselben Schlüssel liest das BOOT-Script in layout.tsx. */
await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `try {
  localStorage.setItem("takeoff-video", "on");
  localStorage.setItem("takeoff-fx", "l");
  localStorage.removeItem("takeoff-fx-downgrades");
  localStorage.setItem("takeoff-day", ${JSON.stringify(TAG ? "on" : "off")});
  ${THEME ? `localStorage.setItem("takeoff-theme", ${JSON.stringify(THEME)});` : `localStorage.removeItem("takeoff-theme");`}
} catch (e) {}` });

/* ---------- Messcode, läuft in der Seite ---------- */
const MESS = `(() => {
  const vw = innerWidth;
  /* ZWEI Overflow-Signale, nicht eins:
     - scrollWidth > innerWidth: klassischer horizontaler Ueberlauf.
     - innerWidth > device-width: ein nowrap-Element hat den LAYOUT-Viewport
       breiter gezogen als das Geraet — die Seite wird seitlich verschiebbar,
       Ueberschriften ragen ueber den Rand. Der erste Test allein SIEHT das
       nicht (innerWidth waechst mit). Genau dieser Fall (langer Event-Titel
       „takeoff × No Gravity") wurde lange uebersehen. */
  const out = { overflow: document.documentElement.scrollWidth - vw,
                viewportBlow: Math.max(0, Math.round(vw - window.__DEV_W__)),
                tap: [], smallText: [], wide: [], tight: [] };
  const seen = new Set();
  const imZu = (el) => el.closest('dialog:not([open])') !== null;   // geschlossenes Menue
  const inlineLink = (el) => el.tagName === 'A' && el.closest('p,li,dd,figcaption,.section-intro,.m-brief'); // WCAG 2.5.5 nimmt Inline-Links aus
  // Tap-Ziele: interaktive Elemente < 44px (kleinste Seite)
  document.querySelectorAll('a,button,[role=button],summary,input,select').forEach(el => {
    if (imZu(el) || inlineLink(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;                 // unsichtbar
    if (getComputedStyle(el).display === 'none') return;
    const s = Math.min(r.width, r.height);
    if (s < 44) {
      const k = el.tagName + '.' + (el.className && typeof el.className==='string' ? el.className.split(' ')[0] : '') + '|' + (el.textContent||'').trim().slice(0,18);
      if (!seen.has(k)) { seen.add(k); out.tap.push({ el: k, w: Math.round(r.width), h: Math.round(r.height) }); }
    }
  });
  // zu kleiner Fließtext: p/li/dd mit computed font-size < 14px und echtem Text
  document.querySelectorAll('p,li,dd,figcaption,.m-meta,.section-intro,.nc-meta').forEach(el => {
    if (el.closest('dialog:not([open])')) return;            // geschlossenes Menue nicht werten
    const t = (el.textContent||'').trim(); if (t.length < 12) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 14) { const k = el.className+'|'+fs; if(!seen.has(k)){seen.add(k); out.smallText.push({ cls: (typeof el.className==='string'?el.className:'')||el.tagName, fs: +fs.toFixed(1), sample: t.slice(0,30) }); } }
  });
  // Kopfleiste: wie hoch frisst die Topbar den ersten Screen?
  const tb = document.querySelector('.topbar'); if (tb) out.topbarH = Math.round(tb.getBoundingClientRect().height);
  // erster H1 Abstand von oben (kommt Inhalt spät?)
  const h1 = document.querySelector('main h1, main .wordmark, main .etitle');
  if (h1) out.firstHeadingTop = Math.round(h1.getBoundingClientRect().top);
  out.innerHeight = innerHeight;
  return out;
})()`;

/* Erster Bildschirm auf "/": Blöcke zählen, Lage des Hauptknopfs. */
const ERSTER = `(() => {
  const H = innerHeight, out = { bloecke: 0, liste: [], innerHeight: H };
  for (const el of document.querySelectorAll('p, h1, h2, h3, .btn, .chip, .tminus')) {
    if (el.closest('dialog:not([open])')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const t = (el.textContent || '').trim(); if (!t.length) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;               // Kind eines display:none-Vorfahren
    if (r.bottom <= 0 || r.top >= H) continue;
    out.bloecke++;
    const name = (typeof el.className === 'string' && el.className.trim()) ? '.' + el.className.trim().split(/\\s+/)[0] : el.tagName.toLowerCase();
    out.liste.push(name + ' „' + t.slice(0, 18) + (t.length > 18 ? '…' : '') + '“');
  }
  const cta = document.querySelector('.hm-cta');
  if (cta) {
    const r = cta.getBoundingClientRect(), mitte = (r.top + r.bottom) / 2;
    out.cta = { top: Math.round(r.top), bottom: Math.round(r.bottom), mitte: Math.round(mitte),
                daumen: mitte >= H * 0.6, unterFalz: r.bottom > H };
  }
  return out;
})()`;

/* Helfer für die Kontrastmessung — einmal je Seite installiert. */
const HILFE = `(() => {
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const lumRgb = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const naechstesBild = () => new Promise(f => requestAnimationFrame(() => requestAnimationFrame(f)));
  window.__ma = {
    /* Ein Ziel: Textfarbe + Ausschnitt im Viewport. Liegt es ausserhalb,
       wird es in die Mitte gescrollt (Event-Seite: die Fakten koennen bei
       360px unter der Falz stehen). */
    ziel(sel) {
      const el = document.querySelector(sel); if (!el) return null;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' && !el.__maVersteckt) return { sel, unsichtbar: true };
      let r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return { sel, unsichtbar: true };
      if (r.top < 0 || r.bottom > innerHeight) { el.scrollIntoView({ block: 'center', behavior: 'instant' }); r = el.getBoundingClientRect(); }
      const x = Math.max(0, r.left), y = Math.max(0, r.top);
      const w = Math.min(innerWidth, r.right) - x, h = Math.min(innerHeight, r.bottom) - y;
      if (w < 2 || h < 2) return { sel, unsichtbar: true };
      let farbe = cs.color, lumAlt = null;
      /* Chrom-Schrift (.etitle, .wordmark): background-clip: text mit
         color: transparent — die Glyphen tragen den Verlauf, nicht die
         Textfarbe. Gemessen wird gegen BEIDE Enden der Chromrampe
         (--chrome-lo und --chrome-hi), gewertet wird das bessere: nachts
         auf hellem Grund traegt die dunkle Stufe, tags auf dem dunklen
         Hero-Anker die helle (dazu kommt der deckende Umriss). Nur eine
         Stufe zu nehmen meldete die tags gut lesbare Missionsakte mit 2,2:1. */
      if (/rgba\\([^)]*,\\s*0\\)$/.test(farbe) || farbe === 'transparent') {
        const hex = (name) => {
          const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
          const m = v.match(/^#([0-9a-f]{6})$/i); if (!m) return null;
          const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255];
        };
        const lo = hex('--chrome-lo'), hi = hex('--chrome-hi');
        if (lo) farbe = 'rgb(' + lo.join(', ') + ')';
        if (hi) lumAlt = lumRgb(...hi);
      }
      const [cr, cg, cb] = (farbe.match(/[\\d.]+/g) || ['0', '0', '0']).map(Number);
      return { sel, color: farbe, lumText: lumRgb(cr, cg, cb), lumAlt, clip: { x, y, width: w, height: h } };
    },
    /* Glyphen weg, Flaechen bleiben: nur die Zielelemente selbst werden
       unsichtbar, nicht ihr Container — eine Traegerflaeche auf .hero-m
       oder .ehero gehoert zum Hintergrund, gegen den der Text steht. */
    verstecke(sels, an) {
      for (const sel of sels) for (const el of document.querySelectorAll(sel)) {
        if (an) { el.__maVor = el.style.visibility; el.__maVersteckt = true; el.style.visibility = 'hidden'; }
        else { el.style.visibility = el.__maVor ?? ''; el.__maVersteckt = false; }
      }
      return naechstesBild();
    },
    /* PNG (Data-URL) -> mittlere relative Leuchtdichte, dazu das hellste
       Zehntel (fuer den Report; geflaggt wird der Mittelwert). */
    lum(dataUrl) {
      return new Promise((f, rej) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
          const g = c.getContext('2d'); g.drawImage(img, 0, 0);
          const d = g.getImageData(0, 0, c.width, c.height).data;
          const ls = new Float32Array(d.length / 4); let sum = 0;
          for (let i = 0, j = 0; i < d.length; i += 4, j++) { const l = lumRgb(d[i], d[i + 1], d[i + 2]); ls[j] = l; sum += l; }
          ls.sort();
          const n = ls.length, k = Math.max(1, Math.floor(n / 10)); let top = 0;
          for (let i = n - k; i < n; i++) top += ls[i];
          f({ mittel: sum / n, hell: top / k, px: n });
        };
        img.onerror = () => rej(new Error('PNG nicht dekodierbar'));
        img.src = dataUrl;
      });
    },
    warteBild: naechstesBild,
  };
  return true;
})()`;

/* Sticky-Leiste nach dem Scrollen (nur Event-Seite, nur Telefon). */
const STICKY = `(() => {
  const s = document.querySelector('.sticky-cta');
  if (!s) return { fehlt: true };
  const cs = getComputedStyle(s), r = s.getBoundingClientRect();
  const m = document.querySelector('.mctrl'); const mr = m ? m.getBoundingClientRect() : null;
  const mSichtbar = !!m && getComputedStyle(m).display !== 'none' && mr.height > 0;
  const f = document.querySelector('footer');
  return { fehlt: false,
    gezeigt: s.classList.contains('is-shown') && cs.display !== 'none' && r.height > 0 && r.top < innerHeight,
    isShown: s.classList.contains('is-shown'), display: cs.display,
    top: Math.round(r.top), hoehe: Math.round(r.height), innerHeight,
    mctrlUnten: mSichtbar ? Math.round(mr.bottom) : null,
    kollidiert: mSichtbar && mr.bottom > r.top - 8,
    footerPolster: f ? Math.round(parseFloat(getComputedStyle(f).paddingBottom)) : null };
})()`;

const kontrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/* Kontrast je Ziel — eine Stichprobe. Liefert je Selektor {kontrast, hell, color}. */
async function stichprobe(ziele) {
  const aus = [];
  for (const sel of ziele) {
    const z = await js(`__ma.ziel(${JSON.stringify(sel)})`);
    if (!z || z.unsichtbar) { if (z) aus.push({ sel, unsichtbar: true }); continue; }
    await jsP("__ma.warteBild()");
    const shot = await cdp("Page.captureScreenshot", { format: "png", clip: { ...z.clip, scale: 1 } });
    const data = shot?.result?.data;
    if (!data) { aus.push({ sel, fehler: shot?.error?.message ?? "kein Bild" }); continue; }
    let l;
    try { l = await jsP(`__ma.lum("data:image/png;base64,${data}")`); } catch (e) { aus.push({ sel, fehler: String(e) }); continue; }
    if (!l) { aus.push({ sel, fehler: "Bild nicht auswertbar" }); continue; }
    /* Chromrampe: das bessere von beiden Enden (siehe __ma.ziel). */
    const best = (grund) => z.lumAlt == null
      ? kontrast(z.lumText, grund)
      : Math.max(kontrast(z.lumText, grund), kontrast(z.lumAlt, grund));
    aus.push({ sel, color: z.color, lumText: +z.lumText.toFixed(4), lumGrund: +l.mittel.toFixed(4),
      kontrast: +best(l.mittel).toFixed(2),
      kontrastHell: +best(l.hell).toFixed(2) });
  }
  return aus;
}

/* Hero-Kontrast einer Route: Video abwarten, ein- oder zweimal messen,
   je Selektor den SCHLECHTESTEN Wert behalten. */
async function heroKontrast(route) {
  const ziele = KONTRAST_ZIELE[route]; if (!ziele) return null;
  await js(HILFE);
  const out = { videoBereit: null, ziele: {} };
  if (route === "/") {
    const hatVideo = await js(`!!document.querySelector('.hero-video')`);
    let bereit = false;
    for (let i = 0; hatVideo && i < 20 && !bereit; i++) {           // bis 4 s
      bereit = await js(`!!document.querySelector('.hero-video.is-ready video')`);
      if (!bereit) await schlaf(200);
    }
    out.videoBereit = bereit;
  }
  await js("scrollTo(0, 0)");
  await jsP(`__ma.verstecke(${JSON.stringify(ziele)}, true)`);
  /* Auf "/" zwei Stichproben (0,5 s und 3 s nach is-ready): das Video
     laeuft, eine helle Szene kann spaeter kommen. Ohne Video reicht eine. */
  const zeiten = route === "/" && out.videoBereit ? [500, 2500] : [300];
  for (const t of zeiten) {
    await schlaf(t);
    for (const p of await stichprobe(ziele)) {
      const alt = out.ziele[p.sel];
      if (!alt || (p.kontrast != null && (alt.kontrast == null || p.kontrast < alt.kontrast))) out.ziele[p.sel] = p;
    }
  }
  await jsP(`__ma.verstecke(${JSON.stringify(ziele)}, false)`);
  await js("scrollTo(0, 0)");
  return out;
}

/* ---------- Lauf je Breite ---------- */
const suffix = (TAG ? "-tag" : "") + (THEME ? `-${THEME}` : "");
for (const W of BREITEN) {
  const H = HOEHEN[W] ?? 780;
  await cdp("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 2, mobile: true });
  console.log(`\n=== MOBIL-AUDIT @ ${W}×${H}px${TAG ? " · Tag" : " · Nacht"}${THEME ? ` · ${THEME}` : ""} ===`);
  const report = {};
  for (const r of ROUTEN) {
    await cdp("Page.navigate", { url: BASIS + r });
    await schlaf(1900);
    await cdp("Runtime.evaluate", { expression: `window.__DEV_W__ = ${W};` });
    const m = await js(MESS) ?? {};
    report[r] = m;
    const flags = [];
    if (m.overflow > 0) flags.push(`OVERFLOW ${m.overflow}px`);
    if (m.viewportBlow > 2) flags.push(`VIEWPORT+${m.viewportBlow}px`);
    const tapN = m.tap?.length ?? 0, smallN = m.smallText?.length ?? 0;
    if (tapN) flags.push(`${tapN} Tap<44`);
    if (smallN) flags.push(`${smallN} Text<14px`);
    if (m.topbarH > 64) flags.push(`Topbar ${m.topbarH}px`);

    // Erster Bildschirm (nur Startseite)
    if (r === "/") {
      const e = await js(ERSTER);
      m.ersterBildschirm = e;
      if (e?.bloecke > 7) flags.push(`BLOECKE ${e.bloecke}`);
      if (W <= 560) {
        if (!e?.cta) flags.push("hm-cta fehlt");
        else {
          m.thumb = e.cta.daumen && !e.cta.unterFalz;
          if (e.cta.unterFalz) flags.push(`CTA unter der Falz (bottom ${e.cta.bottom} > ${e.innerHeight})`);
          else if (!e.cta.daumen) flags.push(`CTA nicht im Daumenbereich (Mitte ${e.cta.mitte} < ${Math.round(e.innerHeight * 0.6)})`);
        }
      }
    }

    // Hero-Kontrast
    if (KONTRAST_ZIELE[r]) {
      const k = await heroKontrast(r);
      m.kontrast = k;
      if (r === "/" && k.videoBereit === false) flags.push("Video nicht bereit (Kontrast über Standbild)");
      for (const [sel, p] of Object.entries(k.ziele)) {
        if (p.kontrast != null && p.kontrast < KONTRAST_MIN) flags.push(`KONTRAST ${sel} ${p.kontrast.toFixed(1)}:1`);
        if (p.fehler) flags.push(`KONTRAST ${sel} nicht messbar (${p.fehler})`);
      }
      const gemessen = Object.keys(k.ziele).length;
      if (!gemessen) flags.push("KONTRAST: keines der Ziele im DOM");
    }

    // Sticky-Leiste (Event-Seite, nur Telefon)
    if (r === "/events/marsmission" && W <= 560) {
      await js("scrollTo(0, 700)");
      await schlaf(600);
      const s = await js(STICKY);
      m.sticky = s;
      if (s?.fehlt) flags.push("STICKY fehlt");
      else if (s) {
        if (!s.gezeigt) flags.push(`STICKY nicht gezeigt (is-shown=${s.isShown}, display=${s.display}, top=${s.top}/${s.innerHeight})`);
        if (s.kollidiert) flags.push(`STICKY Mission Control kollidiert (mctrl bottom ${s.mctrlUnten} > Leiste top ${s.top} − 8)`);
        if (s.footerPolster == null || s.footerPolster < s.hoehe) flags.push(`STICKY Footer-Polster ${s.footerPolster ?? "?"}px < ${s.hoehe}px`);
      }
      await js("scrollTo(0, 0)");
    }

    console.log(`${r.padEnd(24)} ${flags.length ? flags.join(' · ') : 'ok'}`);
    if (tapN) console.log('   tap: ' + m.tap.slice(0,6).map(t=>`${t.el.split('|')[0]}(${t.w}x${t.h})`).join(', '));
    if (smallN) console.log('   txt: ' + m.smallText.slice(0,4).map(t=>`${t.cls.split(' ')[0]||'?'}=${t.fs}px`).join(', '));
  }
  console.log(`\nTopbar-Höhen: ${Object.entries(report).map(([r,m])=>m.topbarH).filter(Boolean).slice(0,3).join('/')}px · Erste Überschrift Abstand oben: ${report['/']?.firstHeadingTop}px · Blöcke im ersten Bild: ${report['/']?.ersterBildschirm?.bloecke ?? '?'} · CTA im Daumenbereich: ${report['/']?.thumb == null ? '?' : report['/'].thumb ? 'ja' : 'nein'}`);

  if (JSON_AUS) {
    const dir = new URL("../.design-audit/", import.meta.url);
    mkdirSync(dir, { recursive: true });
    const datei = new URL(`mobil-${W}${suffix}.json`, dir);
    writeFileSync(datei, JSON.stringify({ meta: { breite: W, hoehe: H, tag: TAG, theme: THEME ?? "space", zeit: new Date().toISOString() }, routen: report }, null, 2));
    console.log(`JSON: .design-audit/mobil-${W}${suffix}.json`);
  }

  // Detailreport je Seite (für Agents)
  if (REPORT) {
    console.log(`\n==== DETAIL @ ${W}px (je Seite: Tap<44, Text<14, Kontrast, erster Bildschirm, Sticky) ====`);
    for (const [r, m] of Object.entries(report)) {
      const taps = (m.tap||[]).map(t=>`${t.el.split('|')[0]}(${t.w}x${t.h})`).join(', ');
      const txt = (m.smallText||[]).map(t=>`${(t.cls||'').split(' ')[0]||'?'}=${t.fs}px`).join(', ');
      let z = `\n${r}\n  tap<44: ${taps||'—'}\n  text<14: ${txt||'—'}${m.overflow>0?`\n  OVERFLOW: ${m.overflow}px`:''}`;
      if (m.kontrast) {
        const zeilen = Object.values(m.kontrast.ziele).map(p => p.kontrast != null
          ? `${p.sel} ${p.kontrast.toFixed(1)}:1 (hellstes Zehntel ${p.kontrastHell.toFixed(1)}:1, Text ${p.color})`
          : `${p.sel} ${p.unsichtbar ? 'nicht sichtbar' : 'Fehler: ' + p.fehler}`);
        z += `\n  kontrast${m.kontrast.videoBereit === false ? ' (Video NICHT bereit)' : ''}: ${zeilen.join(' · ') || '—'}`;
      }
      if (m.ersterBildschirm) {
        const e = m.ersterBildschirm;
        z += `\n  erster Bildschirm (${e.innerHeight}px): ${e.bloecke} Blöcke — ${e.liste.join(', ')}`;
        if (e.cta) z += `\n  hm-cta: top ${e.cta.top} · bottom ${e.cta.bottom} · Mitte ${e.cta.mitte} → ${e.cta.daumen ? 'Daumenbereich' : 'zu hoch'}${e.cta.unterFalz ? ', unter der Falz' : ''}`;
      }
      if (m.sticky) {
        const s = m.sticky;
        z += `\n  sticky: ${s.fehlt ? 'fehlt' : `is-shown=${s.isShown} · top ${s.top} · Höhe ${s.hoehe} · mctrl bottom ${s.mctrlUnten ?? '—'} · Footer padding-bottom ${s.footerPolster ?? '—'}px`}`;
      }
      console.log(z);
    }
  }
}

ws.close(); chrome.kill();
process.exit(0);
