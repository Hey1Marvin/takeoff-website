/* ============================================================
   pruef-englisch.mjs — steht auf Englisch wirklich Englisch?

   WARUM ES DIESES SKRIPT GIBT
   `verify-ui.mjs` prueft seit jeher die Sprach-MECHANIK: kippt das
   `lang`-Attribut, gibt es keinen Reload, bleiben die Rechtsseiten
   deutsch. Es hat nie geprueft, ob der sichtbare TEXT englisch ist —
   und genau deshalb konnte die Seite monatelang "zweisprachig" heissen,
   waehrend auf Englisch praktisch alles deutsch blieb.

   Dasselbe Muster wie beim Scroll-Ruckeln: was niemand misst, faellt
   niemandem auf.

   WAS ES TUT
   Jede Route auf Englisch aufrufen, allen sichtbaren Text einsammeln
   (dazu aria-label, title, alt, placeholder und den Dokumenttitel) und
   auf deutsche Merkmale abklopfen. Jede Fundstelle wird mit Selektor
   und Wortlaut ausgegeben — es ist eine Arbeitsliste, kein blosses
   Ja/Nein.

   WIE "DEUTSCH" ERKANNT WIRD
   Zwei Signale, beide noetig, damit es weder blind noch hysterisch ist:
   · Funktionswoerter, die es im Englischen nicht gibt (und, oder,
     nicht, kein, fuer, mit, wird, sind, mehr, Uhr, ...). Sie sind das
     verlaessliche Signal — Inhaltswoerter koennen zufaellig gleich
     aussehen ("Sound", "Start", "Info").
   · Umlaute und Eszett. Allein aber nicht ausreichend, weil Eigennamen
     sie tragen duerfen (Freiraeume, KuZe, Strassennamen).

   Eigennamen stehen in ERLAUBT und werden vor der Pruefung entfernt.
   Diese Liste ist bewusst kurz zu halten: jeder Eintrag ist eine
   Stelle, an der das Skript wegsieht.

   BEDIENUNG
     npm run build && npx next start -p 3210
     node scripts/pruef-englisch.mjs           # Arbeitsliste
     node scripts/pruef-englisch.mjs --kurz    # nur die Zahlen je Route
   ============================================================ */
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3210";
const kurz = process.argv.includes("--kurz");

/* Der Praefix der englischen Fassung. Solange es noch keine /en-Routen
   gibt, bleibt er leer und die Sprache wird ueber den localStorage
   gesetzt — so misst dasselbe Skript vor und nach dem Umbau. */
const EN_PREFIX = process.env.EN_PREFIX ?? "";

const ROUTEN = [
  "/", "/events", "/events/freiraeume", "/events/marsmission", "/events/pride",
  "/artists", "/artists/jojo", "/kollektiv", "/awareness", "/news",
  "/kalender", "/team", "/musik", "/kontakt",
];

/* Rechtstexte bleiben absichtlich deutsch (LangLock) — sie werden nicht
   geprueft, sonst meldet das Skript dauerhaft einen Fehler, der keiner ist. */
const AUSGENOMMEN = ["/impressum", "/datenschutz"];

/* Eigennamen und Fachbegriffe, die auch auf Englisch deutsch bleiben.
   Kurz halten — jeder Eintrag ist eine blinde Stelle. */
const ERLAUBT = [
  "takeoff", "takeøff", "potsdam", "freiräume", "kuze", "kuze potsdam",
  "spartacus", "schranzverbot", "stadtjugendring", "bastion", "schillerplatz",
  "hermann-elflein", "nogravity", "no gravity", "blaulicht", "mampe",
  "kinder- und jugendbudget", "künstlicht", "friseurtelefon",
  "straße", "strasse", "str.", "platz", "berlin", "flinta", "über uns",
];

/* Deutsche Funktionswoerter. Nur solche, die im Englischen NICHT
   vorkommen. Die Liste ist zweimal geschrumpft, weil sie falsche Treffer
   erzeugte:
   · "die" ist ein englisches Verb.
   · "was" und "war" sind gewoehnliche englische Woerter — sie meldeten
     korrekt uebersetzte Saetze wie "I was there" als deutsch.
   · "wo" ist zwar kein englisches Wort, taucht aber in Eigennamen auf.
   Wer hier etwas ergaenzt: erst pruefen, ob das Wort im Englischen
   vorkommt. Ein Pruefer, der falsche Treffer meldet, wird ignoriert —
   und dann meldet er die echten auch umsonst. */
const MARKER = [
  "und", "oder", "nicht", "kein", "keine", "keinen", "für", "fuer", "mit",
  "wird", "werden", "sind", "ist", "waren", "mehr", "uhr", "seite",
  "sich", "auch", "noch", "schon", "immer", "wenn", "dann", "aber", "weil",
  "vom", "zum", "zur", "beim", "durch", "gegen", "ohne", "über", "unter",
  "jede", "jeder", "alle", "alles", "etwas", "wie", "wer",
  "ein", "eine", "einen", "einem", "eines", "dem", "den", "des", "das",
  "wir", "uns", "unser", "unsere", "euch", "eure", "dich", "dir", "dein",
  "abflug", "nächste", "naechste", "termine", "hören", "hoeren", "zurück",
];

const norm = s => (s || "").replace(/\s+/g, " ").trim();

function istDeutsch(text) {
  let t = " " + text.toLowerCase() + " ";
  for (const e of ERLAUBT) t = t.split(e).join(" ");
  const woerter = t.split(/[^a-zäöüß]+/).filter(Boolean);
  const treffer = woerter.filter(w => MARKER.includes(w));
  if (treffer.length) return treffer.slice(0, 3).join(", ");
  /* Umlaut allein zaehlt nur, wenn nach dem Entfernen der Eigennamen
     noch einer uebrig ist. */
  const rest = t.match(/[äöüß]/);
  return rest ? `Umlaut "${rest[0]}"` : null;
}

/* Der Text, den ein Besucher sieht — plus das, was eine Vorlesesoftware
   hoert. Bewusst am tiefsten Knoten gesammelt, damit die Meldung sagt,
   WO es steht, statt nur DASS es vorkommt. */
function sammleImBrowser() {
  const raus = [];
  const wegschauen = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "svg", "CANVAS"]);

  const pfad = el => {
    const teile = [];
    for (let n = el; n && n.nodeType === 1 && teile.length < 3; n = n.parentElement) {
      let s = n.tagName.toLowerCase();
      if (n.className && typeof n.className === "string") {
        const k = n.className.trim().split(/\s+/)[0];
        if (k) s += "." + k;
      }
      teile.unshift(s);
    }
    return teile.join(" > ");
  };

  /* Sichtbarer Text: nur Blattknoten, damit derselbe Satz nicht ueber
     jeden Vorfahren noch einmal gemeldet wird. */
  document.querySelectorAll("body *").forEach(el => {
    if (wegschauen.has(el.tagName)) return;
    if (el.closest("[aria-hidden='true']")) return;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return;
    const eigen = [...el.childNodes]
      .filter(n => n.nodeType === 3)
      .map(n => n.textContent)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (eigen.length > 1) raus.push({ art: "Text", wo: pfad(el), text: eigen });
  });

  /* Was nur die Vorlesesoftware hoert. */
  for (const attr of ["aria-label", "title", "alt", "placeholder"]) {
    document.querySelectorAll(`[${attr}]`).forEach(el => {
      const v = el.getAttribute(attr);
      if (v && v.trim().length > 1) raus.push({ art: attr, wo: pfad(el), text: v.trim() });
    });
  }

  raus.push({ art: "<title>", wo: "head", text: document.title });
  const md = document.querySelector('meta[name="description"]');
  if (md?.content) raus.push({ art: "meta", wo: "head", text: md.content });
  return raus;
}

const browser = await chromium.launch();
let gesamt = 0;
const proRoute = [];

console.log(`\nBasis: ${BASE}${EN_PREFIX ? `   EN-Praefix: ${EN_PREFIX}` : "   (Sprache ueber localStorage)"}\n`);

for (const route of ROUTEN) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { localStorage.setItem("takeoff-lang", "en"); } catch { /* egal */ }
  });
  const url = BASE + EN_PREFIX + route;
  const antwort = await page.goto(url, { waitUntil: "load" });
  if (!antwort || antwort.status() >= 400) {
    console.log(`  ${route.padEnd(26)} NICHT ERREICHBAR (${antwort?.status()})`);
    proRoute.push({ route, n: -1 });
    await ctx.close();
    continue;
  }
  await page.waitForTimeout(900);

  const lang = await page.evaluate(() => document.documentElement.lang);
  const gefunden = await page.evaluate(sammleImBrowser);

  /* Doppelte zusammenfassen: derselbe Text an mehreren Stellen ist EIN
     Uebersetzungsauftrag, nicht zehn. */
  const treffer = new Map();
  for (const g of gefunden) {
    const grund = istDeutsch(g.text);
    if (!grund) continue;
    const key = g.text;
    if (!treffer.has(key)) treffer.set(key, { ...g, grund, n: 0 });
    treffer.get(key).n++;
  }

  gesamt += treffer.size;
  proRoute.push({ route, n: treffer.size, lang });
  const marke = treffer.size === 0 ? "OK  " : "DE  ";
  console.log(`  ${marke} ${route.padEnd(26)} ${String(treffer.size).padStart(3)} deutsche Stellen   (html.lang=${lang})`);

  if (!kurz) {
    for (const t of [...treffer.values()].sort((a, b) => b.n - a.n).slice(0, 12)) {
      const txt = t.text.length > 78 ? t.text.slice(0, 75) + "…" : t.text;
      console.log(`         ${t.art.padEnd(11)} ${t.wo}`);
      console.log(`           „${txt}"   [${t.grund}]`);
    }
    if (treffer.size > 12) console.log(`         … und ${treffer.size - 12} weitere`);
  }
  await ctx.close();
}

/* Gegenprobe: die Rechtsseiten MUESSEN deutsch bleiben. */
console.log("\n== Gegenprobe: Rechtsseiten bleiben deutsch ==");
for (const route of AUSGENOMMEN) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { localStorage.setItem("takeoff-lang", "en"); } catch { /* egal */ }
  });
  await page.goto(BASE + route, { waitUntil: "load" });
  await page.waitForTimeout(500);
  const lang = await page.evaluate(() => document.documentElement.lang);
  console.log(`  ${lang === "de" ? "OK  " : "FAIL"} ${route} bleibt deutsch (html.lang=${lang})`);
  await ctx.close();
}

await browser.close();

console.log("\n== Zusammenfassung ==");
for (const r of proRoute) {
  if (r.n < 0) { console.log(`  ${r.route.padEnd(26)} nicht erreichbar`); continue; }
  console.log(`  ${r.route.padEnd(26)} ${String(r.n).padStart(3)}`);
}
console.log(`\n==== ${gesamt} deutsche Stellen im englischen Modus ====`);
if (gesamt > 0) process.exitCode = 1;
