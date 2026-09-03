/* Mobil-Audit: misst konkrete Design-Probleme auf allen öffentlichen Seiten
   bei 360px (und 390px). KEINE Wertung per Auge — nur nachmessbare Fakten:
   Tap-Ziele <44px, Fließtext <15px, überbreite Zeilen, Kopfleisten-Höhe,
   horizontaler Overflow, zu enge vertikale Abstände zwischen Blöcken.
   Aufruf: node scripts/mobile-audit.mjs 3210 [breite] */
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = process.argv[2] ?? "3210";
const W = Number(process.argv[3] ?? 360);
const BASIS = `http://localhost:${PORT}`;
const ROUTEN = ["/", "/events", "/events/marsmission", "/artists", "/artists/jojo",
  "/kollektiv", "/awareness", "/news", "/kalender", "/team", "/musik", "/kontakt",
  "/impressum", "/datenschutz"];

const prof = mkdtempSync(join(tmpdir(), "ma-"));
const dbgPort = 9400 + Math.floor(Math.random() * 400);
const chrome = spawn("chromium", ["--headless", "--disable-gpu", "--no-sandbox",
  `--remote-debugging-port=${dbgPort}`, `--user-data-dir=${prof}`,
  `--window-size=${W},780`, "about:blank"], { stdio: "ignore" });

const schlaf = (ms) => new Promise(r => setTimeout(r, ms));
await schlaf(1200);
let wsUrl;
for (let i = 0; i < 30; i++) {
  try { const l = await (await fetch(`http://127.0.0.1:${dbgPort}/json/list`)).json();
    wsUrl = l.find((t) => t.type === "page")?.webSocketDebuggerUrl;
    if (wsUrl) break; } catch { /* retry */ }
  await schlaf(300);
}
const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let id = 0; const warten = new Map();
ws.addEventListener("message", (ev) => { const m = JSON.parse(ev.data); if (m.id && warten.has(m.id)) { warten.get(m.id)(m); warten.delete(m.id); } });
const cdp = (method, params = {}) => new Promise(res => { const i = ++id; warten.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const js = async (expr) => { const m = await cdp("Runtime.evaluate", { expression: expr, returnByValue: true }); return m?.result?.result?.value; };

await cdp("Page.enable"); await cdp("Runtime.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: W, height: 780, deviceScaleFactor: 2, mobile: true });

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
  // zu kleiner Fließtext: p/li/dd mit computed font-size < 15px und echtem Text
  document.querySelectorAll('p,li,dd,figcaption,.m-meta,.section-intro,.nc-meta').forEach(el => {
    if (el.closest('dialog:not([open])')) return;            // geschlossenes Menue nicht werten
    const t = (el.textContent||'').trim(); if (t.length < 12) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 14) { const k = el.className+'|'+fs; if(!seen.has(k)){seen.add(k); out.smallText.push({ cls: (typeof el.className==='string'?el.className:'')||el.tagName, fs: +fs.toFixed(1), sample: t.slice(0,30) }); } }
  });
  // Überbreite Textzeilen (>40em ~ zu lang für Handy, sollte fit sein)
  // Kopfleiste: wie hoch frisst die Topbar den ersten Screen?
  const tb = document.querySelector('.topbar'); if (tb) out.topbarH = Math.round(tb.getBoundingClientRect().height);
  // erster H1 Abstand von oben (kommt Inhalt spät?)
  const h1 = document.querySelector('main h1, main .wordmark, main .etitle');
  if (h1) out.firstHeadingTop = Math.round(h1.getBoundingClientRect().top);
  return out;
})()`;

console.log(`\n=== MOBIL-AUDIT @ ${W}px ===`);
const report = {};
for (const r of ROUTEN) {
  await cdp("Page.navigate", { url: BASIS + r });
  await schlaf(1900);
  await cdp("Runtime.evaluate", { expression: `window.__DEV_W__ = ${W};` });
  const m = await js(MESS);
  report[r] = m;
  const tapN = m.tap?.length ?? 0, smallN = m.smallText?.length ?? 0;
  const flags = [];
  if (m.overflow > 0) flags.push(`OVERFLOW ${m.overflow}px`);
  if (m.viewportBlow > 2) flags.push(`VIEWPORT+${m.viewportBlow}px`);
  if (tapN) flags.push(`${tapN} Tap<44`);
  if (smallN) flags.push(`${smallN} Text<15px`);
  if (m.topbarH > 96) flags.push(`Topbar ${m.topbarH}px`);
  console.log(`${r.padEnd(24)} ${flags.length ? flags.join(' · ') : 'ok'}`);
  if (tapN) console.log('   tap: ' + m.tap.slice(0,6).map(t=>`${t.el.split('|')[0]}(${t.w}x${t.h})`).join(', '));
  if (smallN) console.log('   txt: ' + m.smallText.slice(0,4).map(t=>`${t.cls.split(' ')[0]||'?'}=${t.fs}px`).join(', '));
}
console.log(`\nTopbar-Höhen: ${Object.entries(report).map(([r,m])=>m.topbarH).filter(Boolean).slice(0,3).join('/')}px · Erste Überschrift Abstand oben: ${report['/']?.firstHeadingTop}px`);

// Detailreport je Seite (für Agents) — nur wenn 3. Arg "--report"
if (process.argv.includes("--report")) {
  console.log("\n==== DETAIL (je Seite: Tap<44 & Text<14) ====");
  for (const [r, m] of Object.entries(report)) {
    const taps = (m.tap||[]).map(t=>`${t.el.split('|')[0]}(${t.w}x${t.h})`).join(', ');
    const txt = (m.smallText||[]).map(t=>`${(t.cls||'').split(' ')[0]||'?'}=${t.fs}px`).join(', ');
    console.log(`\n${r}\n  tap<44: ${taps||'—'}\n  text<14: ${txt||'—'}${m.overflow>0?`\n  OVERFLOW: ${m.overflow}px`:''}`);
  }
}
ws.close(); chrome.kill();
process.exit(0);
