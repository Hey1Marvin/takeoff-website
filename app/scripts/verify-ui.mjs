/* ============================================================
   verify-ui.mjs — die Pruefungen, die ein Build NICHT sieht.

   Der Build sagt nur, dass es kompiliert. Er sagt nichts ueber
   Konsolenfehler, fehlende Szenen-Ebenen, horizontalen Overflow,
   Tag/Nacht, FX-Tiers oder Ebenen-Lecks nach Client-Navigation.
   Genau daran ist It. 12 gescheitert: gruener Build, kaputte Seite.

   Dieses Skript hat beim ersten Lauf einen echten Fehler gefunden —
   ein Syntaxfehler im BOOT-Script (aus "\/" im Template-Literal wird
   "/", die Regex wurde zum Zeilenkommentar). Folge: FX-Tier, Theme,
   Tag/Nacht und reduced-motion griffen auf KEINER Seite. Der Build
   war dabei die ganze Zeit gruen.

   Aufruf:
     npm run build && npm run start -- -p 3210
     node scripts/verify-ui.mjs                 # BASE=... zum Umbiegen

   Braucht Playwright. Ist es nicht installiert:  npx playwright install chromium
   ============================================================ */

/* Playwright ist bewusst KEINE Projekt-Abhaengigkeit — es soll nicht ins
   Bundle und nicht in die Installation jedes Mitarbeitenden. Deshalb hier
   der Reihe nach suchen und sonst freundlich aussteigen. */
async function ladeChromium() {
  const orte = ["playwright", "playwright-core", "@playwright/test"];
  for (const o of orte) {
    /* Per Spezifizierer importieren (nicht per aufgeloestem Pfad!): nur so
       greift Node die "exports"-Bedingungen des Pakets und liefert die
       benannten Exporte. require_.resolve(o) liefert den rohen CJS-Haupt-
       eintrag, der "chromium" nur dynamisch re-exportiert — cjs-module-lexer
       kann das nicht statisch erkennen, .chromium landet als undefined,
       kein Fehler, die Schleife bricht trotzdem sofort ab. */
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

const BASE = process.env.BASE || "http://localhost:3210";
const ROUTES = ["/", "/events", "/events/freiraeume", "/events/marsmission", "/artists",
  "/artists/jojo", "/kollektiv", "/awareness", "/news", "/kalender", "/team",
  "/musik", "/kontakt", "/impressum", "/datenschutz"];

const fails = [];
const note = (ok, msg) => { console.log(`  ${ok ? "OK  " : "FAIL"} ${msg}`); if (!ok) fails.push(msg); };

const browser = await chromium.launch();

// ---------- 1) Jede Route: Konsole, Ebenen, Overflow, Flags ----------
console.log("\n== Routen ==");
for (const r of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", e => errs.push("pageerror: " + e.message));
  await page.goto(BASE + r, { waitUntil: "load" });
  await page.waitForTimeout(900);

  const d = await page.evaluate(() => ({
    layers: document.querySelectorAll("#stars,#skyback,#dayclouds,#horizon,#glints,#props").length,
    overflow: document.documentElement.scrollWidth - innerWidth,
    edges: document.documentElement.classList.contains("scene-edges"),
    event: document.documentElement.classList.contains("is-event"),
    hiddenReveals: [...document.querySelectorAll(".reveal")]
      .filter(e => getComputedStyle(e).opacity === "0").length,
    dead: [...document.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute("href")),
  }));
  const wantEdges = r === "/" || r.startsWith("/events");
  const wantEvent = r.startsWith("/events");

  note(errs.length === 0, `${r} keine Konsolenfehler${errs.length ? " -> " + errs.slice(0,2).join(" | ") : ""}`);
  note(d.layers === 6, `${r} sechs Szenen-Ebenen (ist ${d.layers})`);
  note(d.overflow <= 0, `${r} kein horizontaler Overflow (${d.overflow}px)`);
  note(d.edges === wantEdges, `${r} scene-edges=${d.edges} (erwartet ${wantEdges})`);
  note(d.event === wantEvent, `${r} is-event=${d.event} (erwartet ${wantEvent})`);
  await ctx.close();
}

// ---------- 2) Leck-Test: Ebenen nach Client-Navigation ----------
console.log("\n== Client-Navigation (Leck-Test) ==");
{
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "load" }); await page.waitForTimeout(700);
  for (const r of ["/events", "/kollektiv", "/"]) {
    await page.evaluate(p => { document.querySelector(`a[href="${p}"]`)?.click(); }, r).catch(()=>{});
    await page.waitForTimeout(700);
  }
  const n = await page.evaluate(() => document.querySelectorAll("#stars,#skyback,#dayclouds,#horizon,#glints,#props").length);
  note(n === 6, `nach 3 Navigationen weiterhin 6 Ebenen (ist ${n})`);
  await ctx.close();
}

// ---------- 3) Tag/Nacht x Theme ----------
console.log("\n== Tag/Nacht x Theme ==");
for (const theme of ["space", "mars", "strand"]) {
  for (const day of [false, true]) {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    const errs = []; page.on("pageerror", e => errs.push(e.message));
    await page.addInitScript(([t, d]) => {
      localStorage.setItem("takeoff-theme", t);
      localStorage.setItem("takeoff-day", d ? "on" : "off");
      localStorage.setItem("takeoff-fx", "l");
    }, [theme, day]);
    await page.goto(BASE + "/", { waitUntil: "load" }); await page.waitForTimeout(1100);
    const d2 = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme ?? "space",
      day: document.documentElement.classList.contains("day-mode"),
      painted: (() => { const c = document.getElementById("stars"); return c ? c.width > 0 && c.height > 0 : false; })(),
    }));
    note(errs.length === 0 && d2.day === day && d2.painted,
      `${theme} / ${day ? "Tag" : "Nacht"}: theme=${d2.theme} day=${d2.day} canvas=${d2.painted}${errs.length ? " ERR " + errs[0] : ""}`);
    await ctx.close();
  }
}

// ---------- 4) FX-Tiers ----------
console.log("\n== FX-Tiers ==");
for (const tier of ["s", "m", "l"]) {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  await page.addInitScript(t => localStorage.setItem("takeoff-fx", t), tier);
  await page.goto(BASE + "/", { waitUntil: "load" }); await page.waitForTimeout(900);
  const d3 = await page.evaluate(() => ({
    fx: document.documentElement.dataset.fx,
    starsVisible: getComputedStyle(document.getElementById("stars")).display !== "none",
    hiddenReveals: [...document.querySelectorAll(".reveal")].filter(e => getComputedStyle(e).opacity === "0").length,
  }));
  const starsOk = tier === "s" ? !d3.starsVisible : d3.starsVisible;
  note(errs.length === 0 && d3.fx === tier && starsOk,
    `Tier ${tier}: fx=${d3.fx} #stars sichtbar=${d3.starsVisible}${errs.length ? " ERR " + errs[0] : ""}`);
  await ctx.close();
}

// ---------- 5) reduced motion ----------
console.log("\n== prefers-reduced-motion ==");
{
  const ctx = await browser.newContext({ reducedMotion: "reduce" }); const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "load" }); await page.waitForTimeout(700);
  const fx = await page.evaluate(() => document.documentElement.dataset.fx);
  note(fx === "s", `reduced-motion erzwingt Tier s (ist ${fx})`);
  await ctx.close();
}

// ---------- 6) Sprache DE/EN + Tag/Nacht-Knopf ----------
console.log("\n== Sprache & Tag/Nacht-Knopf ==");
// 1) Umschalten ohne Reload
{
  const ctx=await browser.newContext(); const p=await ctx.newPage();
  const errs=[]; p.on("pageerror",e=>errs.push(e.message));
  await p.goto(BASE+"/",{waitUntil:"load"}); await p.waitForTimeout(700);
  const vorher=await p.evaluate(()=>({lang:document.documentElement.lang,
    nav:[...document.querySelectorAll(".nav-links a")].map(a=>a.textContent.trim()).join(","),
    tel:document.querySelector(".hud-link")?.textContent.trim()}));
  const hatSwitch=await p.evaluate(()=>!!document.querySelector(".nav-lang"));
  note(hatSwitch,"Sprachumschalter in der Kopfleiste vorhanden");
  await p.click('.nav-lang button:last-child');           // EN
  await p.waitForTimeout(500);
  const nachher=await p.evaluate(()=>({lang:document.documentElement.lang,
    tel:document.querySelector(".hud-link")?.textContent.trim(),
    ariaMarquee:document.querySelector(".marquee")?.getAttribute("aria-label"),
    reloaded:performance.getEntriesByType("navigation")[0]?.type}));
  note(nachher.lang==="en",`html.lang wechselt auf en (ist ${nachher.lang})`);
  note(nachher.reloaded==="navigate",`kein Reload beim Umschalten (${nachher.reloaded})`);
  note(nachher.ariaMarquee && nachher.ariaMarquee!=="Nächste Events",`aria-Label uebersetzt: "${nachher.ariaMarquee}"`);
  note(errs.length===0,"keine Fehler beim Umschalten"+(errs.length?": "+errs[0]:""));
  // 2) Persistenz ueber Reload
  await p.reload({waitUntil:"load"}); await p.waitForTimeout(600);
  const nachReload=await p.evaluate(()=>document.documentElement.lang);
  note(nachReload==="en",`Sprache ueberlebt Reload (ist ${nachReload})`);
  await ctx.close();
}
// 3) Rechtsseiten bleiben deutsch
{
  const ctx=await browser.newContext(); const p=await ctx.newPage();
  await p.addInitScript(()=>localStorage.setItem("takeoff-lang","en"));
  for (const r of ["/impressum","/datenschutz"]) {
    await p.goto(BASE+r,{waitUntil:"load"}); await p.waitForTimeout(600);
    const d=await p.evaluate(()=>({lang:document.documentElement.lang,
      lock:document.documentElement.hasAttribute("data-lang-lock"),
      switchVisible:(()=>{const e=document.querySelector(".nav-lang");return e?getComputedStyle(e).display!=="none":false})()}));
    note(d.lang==="de",`${r} bleibt deutsch trotz EN-Wunsch (ist ${d.lang})`);
    note(d.lock,`${r} setzt data-lang-lock`);
    note(!d.switchVisible,`${r} blendet den Umschalter aus`);
  }
  // 4) und danach wieder EN
  await p.goto(BASE+"/",{waitUntil:"load"}); await p.waitForTimeout(600);
  const zurueck=await p.evaluate(()=>document.documentElement.lang);
  note(zurueck==="en",`nach der Rechtsseite wieder EN (ist ${zurueck})`);
  await ctx.close();
}
// 5) Tag/Nacht-Knopf in der Kopfleiste
{
  const ctx=await browser.newContext(); const p=await ctx.newPage();
  await p.goto(BASE+"/",{waitUntil:"load"}); await p.waitForTimeout(700);
  const da=await p.evaluate(()=>!!document.querySelector(".nav-day"));
  note(da,"Tag/Nacht-Knopf in der Kopfleiste vorhanden");
  if(da){
    await p.click(".nav-day"); await p.waitForTimeout(400);
    const d=await p.evaluate(()=>({day:document.documentElement.classList.contains("day-mode"),
      pressed:document.querySelector(".nav-day")?.getAttribute("aria-pressed"),
      panel:document.querySelector('.mctrl .row:last-child button:last-child')?.getAttribute("aria-pressed")}));
    note(d.day,"Klick schaltet day-mode ein");
    note(d.pressed==="true",`aria-pressed folgt dem Zustand (${d.pressed})`);
    note(d.panel==="true",`Mission Control zieht mit (Tag-Knopf aria-pressed=${d.panel})`);
  }
  await ctx.close();
}

// ---------- 7) Kein horizontaler Overflow ueber alle Bildschirmbreiten ----------
/* Der Vertrag aus AGENTS.md lautet `scrollWidth <= innerWidth` — aber nur bei
   1280px zu messen faengt genau die Faelle nicht, die Nutzer treffen. Diese
   Schleife hat zwei echte Fehler gefunden: die Nacht-Traegerflaeche ragte
   ueber den Seitenrand hinaus (Spezifitaets-Falle in :is(), aus dem Prototyp
   geerbt), und die Kopfleiste sprengte bei 320px die Zeile, seit
   Sprachumschalter und Tag/Nacht-Knopf darin stehen. */
console.log("\n== Breiten (horizontaler Overflow) ==");
for (const r of ["/", "/kollektiv", "/events"]) {
  for (const w of [320, 360, 412, 560, 768, 900, 1100, 1440]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(BASE + r, { waitUntil: "load" });
    await page.waitForTimeout(900);
    const d = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    note(d <= 0, `${r} @${w}px kein Overflow (${d > 0 ? "+" + d + "px" : "ok"})`);
    await ctx.close();
  }
}

// ---------- 8) Lesbarkeit: Text ohne hinterlegte Flaeche ----------
/* Im Strand- und Mars-Theme liegt hinter dem Text eine helle Szene (Wasser,
   Bodenfoto). Text ohne eigene oder geerbte Flaeche verschwindet dort fast.
   scene-night.css legt deshalb weiche Traegerflaechen unter die Textbloecke —
   diese Pruefung findet, was dabei vergessen wurde. */
console.log("\n== Lesbarkeit (Text ohne Flaeche) ==");
/* Beide Modi. Vorher lief diese Pruefung ausschliesslich nachts — der
   Tagmodus wurde ueberhaupt nur auf "/" angefasst (Gruppe 3). Genau in
   dieser Luecke sassen die Tag-Fehler, die It. 14 gefunden hat: die
   fehlende Feder der hellen Spalte im Space-Theme und der helle Grund
   unter den vollflaechigen Deko-Ebenen von sechs Seiten. */
for (const [r, tag] of ["/", "/events/marsmission", "/artists", "/awareness", "/news",
                        "/kalender", "/team", "/musik", "/kontakt"]
                       .flatMap(r => [[r, false], [r, true]])) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(t => {
    localStorage.setItem("takeoff-theme", "strand");
    localStorage.setItem("takeoff-day", t ? "on" : "off");
  }, tag);
  await page.goto(BASE + r, { waitUntil: "load" });
  await page.waitForTimeout(1100);
  const offen = await page.evaluate(() => {
    const durchsichtig = c => !c || c === "transparent" || /rgba\(0, 0, 0, 0\)/.test(c);
    const hatFlaeche = el => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (!durchsichtig(cs.backgroundColor)) return true;
        if (cs.backgroundImage && cs.backgroundImage !== "none") return true;
        const be = getComputedStyle(n, "::before");
        if (be.content !== "none" && (!durchsichtig(be.backgroundColor) ||
            (be.backgroundImage && be.backgroundImage !== "none"))) return true;
      }
      return false;
    };
    let n = 0;
    /* h1 gehoert dazu — es fehlte, und genau deshalb ist die groesste
         Ueberschrift der Awareness-Seite jahrelang ohne Traegerflaeche
         durch diese Pruefung gerutscht. */
      for (const el of document.querySelectorAll("main h1, main p, main li, main dd, main dt, main h2, main h3")) {
      const t = (el.textContent || "").trim();
      if (t.length < 12 || el.querySelector("p,li,h2,h3")) continue;
      const rc = el.getBoundingClientRect();
      if (rc.width < 40 || rc.height < 8) continue;
      if (el.closest("button, .btn")) continue;      // Knoepfe tragen ihren Rahmen
      if (!hatFlaeche(el)) n++;
    }
    return n;
  });
  note(offen === 0, `${r} ${tag ? "Tag " : "Nacht"} kein Text ohne Traegerflaeche (${offen})`);
  await ctx.close();
}

// ---------- 9) Eine gemeinsame Textkante in Label-Wert-Listen ----------
/* `.m-rows` ist ein Subgrid: alle Werte einer Liste MUESSEN links auf
   derselben Linie beginnen. Vorher schob jede Zeile ihren Wert einzeln nach
   rechts — auf /kontakt lagen die Startpunkte 236px auseinander. */
console.log("\n== Textkanten in Label-Wert-Listen ==");
for (const r of ["/events/marsmission", "/awareness", "/news", "/kalender", "/musik", "/kontakt", "/datenschutz"]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + r, { waitUntil: "load" });
  await page.waitForTimeout(1000);
  const schlimmste = await page.evaluate(() => {
    let max = 0;
    document.querySelectorAll(".m-rows").forEach(liste => {
      const dds = [...liste.querySelectorAll(":scope > .m-row > dd, :scope > dd")];
      if (dds.length < 2) return;
      const xs = dds.map(d => Math.round(d.getBoundingClientRect().left));
      max = Math.max(max, Math.max(...xs) - Math.min(...xs));
    });
    return max;
  });
  note(schlimmste <= 2, `${r} Werte auf einer Kante (max ${schlimmste}px Versatz)`);
  await ctx.close();
}

// ---------- 10) Medien: erreichbar, nicht zu schwer, Zwei-Klick dicht ----------
/* Ein Tippfehler im Pfad endet als stummer schwarzer Kasten — der Build merkt
   davon nichts. Und der Zwei-Klick-Vertrag aus CLAUDE.md §6 ist eine Zusage an
   Besucher: vor der Zustimmung geht KEIN Byte an SoundCloud oder YouTube.
   Beides wird hier gemessen statt behauptet. */
console.log("\n== Medien & Zwei-Klick ==");
{
  const db = JSON.parse(await (await import("node:fs/promises")).readFile(
    new URL("../src/data/db.json", import.meta.url), "utf8"));
  const pfade = new Set();
  const sammle = o => (o?.media ?? []).forEach(m => { pfade.add(m.src); pfade.add(m.poster); });
  db.events.forEach(sammle); db.artists.forEach(sammle);
  Object.values(db.media ?? {}).forEach(l => l.forEach(m => { pfade.add(m.src); pfade.add(m.poster); }));

  let fehlend = 0, zuGross = [];
  for (const p of pfade) {
    const r = await fetch(BASE + p, { method: "HEAD" });
    if (!r.ok) { fehlend++; console.log(`       fehlt: ${p} (${r.status})`); continue; }
    const mb = Number(r.headers.get("content-length") || 0) / 1048576;
    if (p.endsWith(".mp4") && mb > 4) zuGross.push(`${p} ${mb.toFixed(1)}MB`);
  }
  note(fehlend === 0, `alle ${pfade.size} Mediendateien erreichbar (${fehlend} fehlend)`);
  note(zuGross.length === 0, `kein Video über 4 MB${zuGross.length ? " — " + zuGross.join(", ") : ""}`);
}
{
  const DRITTE = /soundcloud|sndcdn|youtube|youtu\.be|ytimg|googlevideo/i;
  for (const [route, name] of [["/artists/jojo", "YouTube"], ["/events/spartacus-nacht", "SoundCloud"]]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const extern = [];
    page.on("request", r => { if (DRITTE.test(r.url())) extern.push(r.url()); });
    await page.goto(BASE + route, { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const vorher = extern.length;
    const karte = await page.$(".setcard");
    if (karte) { await karte.click(); await page.waitForTimeout(900); }
    const nachErstem = extern.length;
    if (karte) { await page.click(".setcard.asked"); await page.waitForTimeout(2200); }
    const player = await page.evaluate(() => document.querySelector(".set-player")?.getAttribute("src") ?? "");
    note(vorher === 0 && nachErstem === 0,
      `${name}: kein Dritt-Request vor der Zustimmung (${nachErstem})`);
    note(player.length > 0 && extern.length > nachErstem,
      `${name}: Player lädt erst nach dem zweiten Klick`);
    await ctx.close();
  }
}

await browser.close();
console.log(`\n==== ${fails.length ? fails.length + " FEHLER" : "ALLES GRUEN"} ====`);
if (fails.length) { fails.forEach(f => console.log("  - " + f)); process.exit(1); }
