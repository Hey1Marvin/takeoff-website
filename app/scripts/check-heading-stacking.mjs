/* ============================================================
   check-heading-stacking.mjs — Ueberschriften duerfen nie von einem
   fremden Element mit hoeherem Stapelrang verdeckt werden.

   Batch-Pruefung (siehe AGENTS.md-Verifizieren-Pflicht, Punkt 5 des
   Auftrags nach polish:artists/kollektiv/kontakt): fuer jede polierte
   Seite und jede section-Ueberschrift (h1/h2/h3 in <main>) muss
   elementFromPoint auf der Mitte der Ueberschrift die Ueberschrift
   selbst oder ein Kind/Elternteil davon treffen. Trifft es etwas
   anderes, liegt ein fremdes Element (Deko-Layer, Traegerflaeche,
   Karte, Canvas) mit hoeherem Stapelrang darueber — genau das Muster,
   das scene-night.css It.14 fuer .section-head-Nachbarn bereits einmal
   gefixt hat (":root:not(.day-mode) main :is(h1,h2,h3,h4,.h2,...)").

   Matrix: 360/768/1440 x {space,mars} x {Nacht,Tag}. FX-Tier fest auf
   "l", damit alle Deko-Ebenen tatsaechlich gemalt werden (Tier s laesst
   z. B. Canvas-Ebenen ganz weg — genau die Faelle, die hier interessieren,
   werden dort maskiert statt geloest).

   `block:"center"` beim scrollIntoView ist Absicht: die Seite hat einen
   sticky Topbar (z-index:100, takeoff.css). Ein Scroll, der die
   Ueberschrift an den GENAUEN oberen Rand legt (Default "start"), wuerde
   sie erwartbar hinter die Kopfleiste schieben — das ist Sticky-Header-
   Verhalten von Haus aus, kein Regressions-Bug dieser Politur. "center"
   haelt die Ueberschrift sicher im mittleren, freien Bereich.

   Aufruf:
     npm run build && npm run start -- -p 3210
     node scripts/check-heading-stacking.mjs        # BASE=... zum Umbiegen

   Braucht Playwright (wie verify-ui.mjs) — bewusst keine Projekt-
   Abhaengigkeit ausserhalb devDependencies.
   ============================================================ */

const BASE = process.env.BASE || "http://localhost:3210";
const ROUTES = [
  "/artists", "/artists/jojo", "/artists/platzhalter", "/artists/cyonic", "/artists/blaulicht",
  "/kollektiv",
  "/kontakt",
];
const WIDTHS = [360, 768, 1440];
const THEMES = ["space", "mars"];

/* Gleicher robuster Lader wie verify-ui.mjs: per Spezifizierer importieren,
   nicht per aufgeloestem Pfad (require.resolve) — sonst greifen die
   "exports"-Bedingungen des Pakets nicht und "chromium" bleibt undefined. */
async function ladeChromium() {
  const orte = ["playwright", "playwright-core", "@playwright/test"];
  for (const o of orte) {
    try {
      const mod = await import(o);
      const chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) return chromium;
    } catch { /* weiter */ }
  }
  try {
    const { globSync } = await import("node:fs");
    const home = process.env.HOME || "";
    const kandidaten = globSync(`${home}/.npm/_npx/*/node_modules/playwright/index.mjs`);
    if (kandidaten.length) return (await import(kandidaten[0])).chromium;
  } catch { /* weiter */ }
  console.error("Playwright nicht gefunden. Einmalig:  npx playwright install chromium");
  process.exit(2);
}
const chromium = await ladeChromium();

const fails = [];
const note = (ok, msg) => { console.log(`  ${ok ? "OK  " : "FAIL"} ${msg}`); if (!ok) fails.push(msg); };

const browser = await chromium.launch();

for (const theme of THEMES) {
  for (const day of [false, true]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(([t, d]) => {
      localStorage.setItem("takeoff-theme", t);
      localStorage.setItem("takeoff-day", d ? "on" : "off");
      localStorage.setItem("takeoff-fx", "l");
    }, [theme, day]);

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });

      for (const route of ROUTES) {
        await page.goto(BASE + route, { waitUntil: "load" });
        await page.waitForTimeout(1000);

        /* Element-Handles statt Selektor-String-Ausfuehrung IM Browser: das
           eigentliche Scrollen muss von der Playwright-Seite aus angestossen
           werden, ein Handle pro Ueberschrift, NACHEINANDER — nicht alle in
           einem einzigen synchronen evaluate()-Durchlauf.

           Anlauf 1 hatte h.scrollIntoView(...) fuer JEDE Ueberschrift
           synchron in einer .map()-Schleife INNERHALB EINES evaluate()-
           Aufrufs gemacht und produzierte massenhaft falsche FAILs:
           elementFromPoint(cx,cy) kam mit null zurueck, weil window.scrollY
           die ganze Schleife ueber bei 0 blieb — kein Yield zwischen den
           Aufrufen, lange Blueprint-Seiten mit >7000px Dokumenthoehe.

           Anlauf 2 nutzte locator.scrollIntoViewIfNeeded() (eigener
           Playwright-Roundtrip, wartet zuverlaessig) — aber OHNE block:
           "center"-Option (die kennt die Playwright-Methode nicht), dockt
           also am naechsten Rand an. Bei kurzen Seiten landete die letzte
           Ueberschrift dadurch am UNTEREN Viewport-Rand, exakt dort, wo das
           fixe Mission-Control-Panel sitzt (.mctrl, position:fixed;
           right/bottom, z-index:120, sitesweite Kopfleiste). Falsches
           Ergebnis aus derselben Ursache wie der sticky Topbar oben:
           Rand-Andocken statt Zentrieren.

           Deshalb hier: explizites scrollIntoView({block:"center",
           behavior:"instant"}) IN EINEM EIGENEN evaluate()-Aufruf (das
           erzwingt sofortiges statt gegebenenfalls per CSS smooth
           animiertes Scrollen UND der Aufrufwechsel selbst ist bereits der
           Yield, den Anlauf 1 nicht hatte) — danach separat gemessen. */
        const handles = await page.$$("main h1, main h2, main h3");
        for (const h of handles) {
          const box = await h.boundingBox(); // null bei display:none/visibility:hidden/zero-size
          if (!box || box.width <= 0 || box.height <= 0) continue;

          await page.evaluate(el => el.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }), h);
          const box2 = await h.boundingBox();
          if (!box2) continue;
          const cx = box2.x + box2.width / 2;
          const cy = box2.y + box2.height / 2;

          const r = await page.evaluate(([el, cx, cy]) => {
            const hit = document.elementFromPoint(cx, cy);
            const ok = !!hit && (hit === el || el.contains(hit) || hit.contains(el));
            return {
              ok,
              tag: el.tagName,
              text: (el.textContent || "").trim().slice(0, 60),
              hitTag: hit ? hit.tagName : null,
              hitClass: hit ? String(hit.className || "").slice(0, 80) : null,
              hitId: hit ? hit.id || null : null,
              cx, cy,
            };
          }, [h, cx, cy]);

          note(
            r.ok,
            `${route} @${width}px ${theme}/${day ? "Tag" : "Nacht"} <${r.tag.toLowerCase()}> "${r.text}"` +
              (r.ok ? "" : ` -> verdeckt von <${(r.hitTag || "?").toLowerCase()}${r.hitId ? "#" + r.hitId : ""} class="${r.hitClass}"> @(${Math.round(r.cx)},${Math.round(r.cy)})`)
          );
        }
      }
    }
    await ctx.close();
  }
}

await browser.close();
console.log(`\n==== ${fails.length ? fails.length + " FEHLER" : "ALLES GRUEN"} ====`);
if (fails.length) { fails.forEach(f => console.log("  - " + f)); process.exit(1); }
