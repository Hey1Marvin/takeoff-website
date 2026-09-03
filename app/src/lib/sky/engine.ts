/* eslint-disable */
// @ts-nocheck
/* ============================================================
   sky/engine.ts — die Szenen-Engine

   PORTIERT AUS `prototype/assets/js/main.js`, Zeilen 174-5460 (`initStars`),
   ABSICHTLICH UNVERAENDERT. Der Code ist ueber viele Iterationen auf
   physikalische Plausibilitaet getrimmt (Planckscher Ortsbogen,
   Magnitudenverteilung, Szintillation, Deferred Shading mit Albedo-,
   Normal- und Height-Puffern). Logik, Zahlenwerte und Kommentare sind
   1:1 uebernommen; geaendert wurden nur die unten aufgezaehlten
   mechanischen Punkte, die noetig sind, damit aus einer IIFE-internen
   Funktion ein importierbares Modul wird.

   Die Typisierung ist eine eigene, spaetere Aufgabe — bis dahin gilt hier
   `@ts-nocheck`. Wer das aufhebt, portiert nicht mehr, sondern schreibt um.

   Mechanische Aenderungen gegenueber dem Original:
     1. dieser Kopf (`@ts-nocheck`, `eslint-disable`, Herkunft)
     2. `function initStars()` -> `export function initStars(env, canvas)`;
        das `const canvas = $("#stars")` davor entfaellt (die App reicht das
        Canvas herein), `if (!canvas) return;` bleibt stehen
     3. Freivariablen der aeusseren IIFE (`html`, `dayMode`, `groundOn`,
        `reduced`, `PERF`) als lokale Aliase ganz oben aufgeloest
     4. Asset-Pfade: die relativen Prototyp-Pfade zeigen jetzt auf `/img/...`
        (Next liefert diese Dateien aus /public)
     5. `starsAPI = { ... }` -> `return { ... }`
     6. die zwei echten Lesestellen der Freivariablen `scrollP` -> `env.scrollP`
        (die gleichnamigen PARAMETER von paintMoon/sunPos/paintSun/paintPhobos
        sind bewusst unangetastet — Liste in `index.ts`)
     7. `moonPhaseNow`/`kelvinToRGB`/`sampleTemp` kommen jetzt per Import aus
        `./astro` statt aus dem IIFE-Scope
   ============================================================ */
import { moonPhaseNow, kelvinToRGB, sampleTemp } from "./astro";
/* It. 16: Die Zeichenschleife haengt am gemeinsamen Takt statt an einem
   eigenen requestAnimationFrame. Grund und Vertrag stehen in lib/frame.ts;
   das Wesentliche: alle Lesevorgaenge laufen vor allen Schreibvorgaengen,
   damit ein fremder Style-Write nicht mitten im Bild ein Layout erzwingt. */
import { taktAnmelden } from "@/lib/frame";
/* Der stufenlose Qualitaetsfaktor. Er greift an genau zwei Stellen in
   dieser Datei: an der Aufloesung (DPR, groesster Hebel — die Pixelzahl
   geht quadratisch ein) und an der Zahl der bewegten Sterne. */
import { qualitaet, dprFaktor } from "./qualitaet";

export function initStars(env, canvas) {
    if (!canvas) return;
    /* --- Portierungs-Bruecke: im Prototyp sind das Closure-Variablen der
       aeusseren IIFE. Hier werden sie EINMAL ganz oben als lokale Aliase
       aufgeloest, damit kein einziger Aufrufkoerper darunter angefasst
       werden muss. Semantik identisch: `dayMode`/`groundOn`/`reduced` sind
       LIVE-Abfragen, `PERF` ist eine Momentaufnahme. --- */
    const html = document.documentElement;
    const dayMode  = () => env.day;
    const groundOn = () => env.ground;
    const reduced  = () => env.reduced;
    const PERF     = env.perf;
    const ctx = canvas.getContext("2d");
    /* War bis It. 16 eine Konstante: einmal beim Start berechnet, von
       keiner Stufe und keinem Regler erreichbar. Die eigene
       Forschungsnotiz (research/31, §2.2) nennt das Senken der
       Aufloesung den groessten Einzelhebel ueberhaupt — er lag brach.
       Wird in resize() neu bestimmt, sonst nirgends. */
    const dprBasis = () => Math.min(devicePixelRatio || 1, 2);
    let DPR = dprBasis() * dprFaktor(qualitaet());
    let w = 0, h = 0, live = [], running = false;
    /* Wird in der LESE-Phase des Takts gefuellt und in der Zeichenphase
       nur noch verwendet. `scrollY` mitten im Zeichnen zu lesen war die
       Stelle, an der ein vorausgegangener fremder Style-Write ein
       synchrones Layout erzwingen konnte. */
    let sySnapshot = scrollY;
    let abmelden = null;
    let travel = 0, lastScroll = scrollY, lastT = performance.now();
    let t0 = performance.now();
    /* Nebel, Milchstrasse und Deep-Sky liegen auf einer EIGENEN Canvas-Ebene.
       Vorher wurden sie in jedem Frame als 1440x900-Bild in den Sternen-Canvas
       kopiert — eine Vollbild-Kopie pro Frame, die allein rund 18 ms kostete.
       Da sie sich (korrekterweise) nicht bewegen, reicht es, sie einmal zu
       zeichnen und vom Browser kompositieren zu lassen. */
    const backdrop = document.createElement("canvas");
    backdrop.id = "skyback";
    backdrop.setAttribute("aria-hidden", "true");
    canvas.parentNode.insertBefore(backdrop, canvas);
    /* Wolkenebene des Tag-Modus. Eigene Ebene, weil sie per CSS-Transform
       driftet: die Bewegung laeuft dadurch auf dem Compositor und kostet pro
       Frame nichts. Liegt zwischen Sternen und Boden. */
    const clouds = document.createElement("canvas");
    clouds.id = "dayclouds";
    clouds.setAttribute("aria-hidden", "true");
    canvas.parentNode.insertBefore(clouds, canvas.nextSibling);
    let meteors = [], nextMeteor = 0, moon = null;


    /* Vorgerenderte Hof-Sprites.
       `createRadialGradient` pro Stern und Frame war der Flaschenhals: bei
       ueber hundert hellen Sternen kostet das mehr als das gesamte restliche
       Zeichnen. Die Hoefe haengen nur von der Sternfarbe ab, also werden sie
       einmal in kleine Texturen gerendert und danach nur noch kopiert.
       Dasselbe Prinzip wie eine PSF-Textur im Astro-Rendering. */
    /* Sterne werden nach Farbe und Helligkeitsstufe gebuendelt gezeichnet.
       Vorher wurden `fillStyle` und `globalAlpha` fuer JEDEN der ~2600 Sterne
       einzeln gesetzt — Canvas-Zustandswechsel sind teuer, das kostete allein
       ueber 40 ms pro Frame. Mit 12 Farb- und 8 Helligkeitsstufen sind es
       jetzt hoechstens 96 Wechsel. */
    const COL_STEPS = 12, A_STEPS = 8;
    const palette = [], buckets = [];
    for (let i = 0; i < COL_STEPS; i++) {
      /* Farbrampe von blauweiss ueber weiss nach orange — der sichtbare
         Ausschnitt des Planckschen Ortsbogens */
      const k = i / (COL_STEPS - 1);
      const T = 2900 + Math.pow(k, 1.35) * 22000;
      const [r, g, b] = kelvinToRGB(T);
      palette.push({ r: Math.round(r), g: Math.round(g), b: Math.round(b) });
      buckets.push(Array.from({ length: A_STEPS }, () => []));
    }

    const GLOW_PX = 64;
    const glowSprites = new Map();
    function glowSprite(col) {
      let c = glowSprites.get(col);
      if (c) return c;
      c = document.createElement("canvas");
      c.width = c.height = GLOW_PX;
      const gc = c.getContext("2d");
      const R = GLOW_PX / 2;
      const gr = gc.createRadialGradient(R, R, 0, R, R, R);
      gr.addColorStop(0,   `rgb(${col} / .55)`);
      gr.addColorStop(.18, `rgb(${col} / .22)`);
      gr.addColorStop(.45, `rgb(${col} / .06)`);
      gr.addColorStop(1,   `rgb(${col} / 0)`);
      gc.fillStyle = gr;
      gc.fillRect(0, 0, GLOW_PX, GLOW_PX);
      glowSprites.set(col, c);
      return c;
    }

    /* ---- Hof-Sprites fuer Himmelskoerper ----
       Mond, Sonne und Phobos legten ihren Streulicht-Hof bis It. 16 in JEDEM
       Bild als frischen `createRadialGradient` an — der Mond einen, die Sonne
       drei, Phobos und Deimos zwei. Die zugehoerigen TEXTUREN waren laengst
       gecacht (moonKey, sunKey, phobosKey); nur die Hoefe nicht, weil sie an
       der Position haengen und die sich ja aendert.

       Sie haengen aber nur SCHEINBAR an der Position: ein Radialverlauf ist
       verschiebungsinvariant. Man kann ihn einmal in eine Textur malen und
       danach nur noch an die richtige Stelle kopieren — genau das, was
       glowSprite() daruber fuer die Sterne tut.

       Gecacht wird nach Radius (auf ganze Pixel gerundet) und den
       Farbstopps. Der Radius aendert sich nur mit der Fenstergroesse, die
       Stopps nur mit der Beleuchtung — beides selten. */
    const haloSprites = new Map();

    /* Zeichnet denselben Hof wie ein `createRadialGradient(x,y,r0, x,y,r1)`
       mit anschliessendem Kreis-fill — nur aus einer gecachten Textur.

       WICHTIG und die Stelle, an der man sich verrechnet: die Stopps eines
       Radialverlaufs liegen zwischen INNEN- und Aussenradius, nicht zwischen
       Null und Aussenradius. Ein Stopp bei .4 eines Verlaufs von r bis 4.2r
       sitzt in Wirklichkeit bei .238 + .4 * .762 = .543 des Aussenradius.
       Deshalb nimmt diese Funktion r0 und r1 entgegen und rechnet selbst um —
       die Aufrufe bleiben damit woertlich die des Originals. */
    function drawHalo(g, x, y, r0, r1, stops) {
      const R = Math.max(2, Math.round(r1));
      const k = Math.min(0.999, Math.max(0, r0 / r1));   // Innenradius, normiert
      const key = `${R}|${k.toFixed(4)}|` + stops.map(([o, c]) => o + ":" + c).join(",");
      let c = haloSprites.get(key);
      if (!c) {
        /* Der Cache darf nicht unbegrenzt wachsen: bei jeder Fenstergroesse
           und Mondphase entstuende sonst ein weiterer Eintrag. */
        if (haloSprites.size > 24) haloSprites.clear();
        c = document.createElement("canvas");
        c.width = c.height = R * 2;
        const gc = c.getContext("2d");
        const gr = gc.createRadialGradient(R, R, k * R, R, R, R);
        for (const [o, col] of stops) gr.addColorStop(o, col);
        gc.fillStyle = gr;
        gc.beginPath(); gc.arc(R, R, R, 0, 6.283); gc.fill();
        haloSprites.set(key, c);
      }
      g.drawImage(c, x - R, y - R);
    }

    /* ---- Magnituden-Sampling ueber die inverse Verteilungsfunktion ---- */
    const M_MIN = -1.4, M_MAX = 6.6, KSLOPE = .48;
    const A = Math.pow(10, KSLOPE * M_MIN), B = Math.pow(10, KSLOPE * M_MAX);
    const sampleMag = () => Math.log10(A + Math.random() * (B - A)) / KSLOPE;

    function makeStar(x, y) {
      const mag = sampleMag();
      const lum = Math.pow(10, -0.4 * (mag - M_MIN));            /* 1 … ~1/1500 */
      const temp = sampleTemp();
      /* Index in die Farbrampe. Saettigung folgt der Helligkeit: schwache
         Sterne sieht das Auge skotopisch, also farblos — deshalb ruecken sie
         zur Mitte der Rampe (weiss). */
      let ci = Math.round((Math.pow(Math.max(0, Math.min(1, (temp - 2900) / 22000)), 1 / 1.35)) * (COL_STEPS - 1));
      const desat = 1 - Math.min(1, Math.pow(lum, .38));
      ci = Math.round(ci * (1 - desat) + (COL_STEPS - 1) * .55 * desat);
      const pal = palette[ci];
      const [r, g, b] = [pal.r, pal.g, pal.b];
      const mix = v => Math.round(v);
      return {
        x, y, mag, lum, temp,
        /* norm wird nach dem Sampling gesetzt: die Leuchtkraft wird auf das
           hellste Objekt IM FELD normiert. Ohne das liegt der hellste von
           ~2500 Stichproben bei Magnitude 0.45 und damit bei Leuchtkraft 0.18 —
           jede feste Schwelle fuer Hof und Spikes greift dann nie. */
        norm: 0,
        ci,
        col: `${mix(r)} ${mix(g)} ${mix(b)}`,
        fill: `rgb(${mix(r)} ${mix(g)} ${mix(b)})`,
        /* Radius waechst VIEL langsamer als Helligkeit — helle Sterne fallen
           durch ihren Hof auf, nicht durch Flaeche */
        rad: (0.42 + 1.5 * Math.pow(lum, .28)) * DPR,
        alpha: Math.min(1, Math.pow(lum, .42) * 1.35),
        /* drei inkommensurable Frequenzen -> nie periodisch */
        f1: .9 + Math.random() * 1.5,
        p1: Math.random() * 6.283, p2: Math.random() * 6.283, p3: Math.random() * 6.283,
        flash: 0,
        depth: .3 + Math.random() * .7,
      };
    }

    /* ---- Wertrauschen fuer Milchstrasse und Staubbahnen ---- */
    function noise2(seed) {
      const g = new Float32Array(4096);
      for (let i = 0; i < 4096; i++) g[i] = Math.random();
      return (x, y) => {
        const xi = Math.floor(x), yi = Math.floor(y);
        const xf = x - xi, yf = y - yi;
        const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const at = (a, b) => g[((a * 73 + b * 179 + seed * 31) & 4095 + 0) & 4095];
        const n00 = at(xi, yi), n10 = at(xi + 1, yi), n01 = at(xi, yi + 1), n11 = at(xi + 1, yi + 1);
        return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v;
      };
    }
    function fbm(n, x, y, oct) {
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
    function pnoise2(seed) {
      const g = new Float32Array(4096);
      for (let i = 0; i < 4096; i++) g[i] = Math.random();
      return (x, y, P) => {
        const xi = Math.floor(x), yi = Math.floor(y);
        const xf = x - xi, yf = y - yi;
        const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const at = (a, b) => g[(((((a % P) + P) % P) * 73 + b * 179 + seed * 31) & 4095)];
        const n00 = at(xi, yi), n10 = at(xi + 1, yi), n01 = at(xi, yi + 1), n11 = at(xi + 1, yi + 1);
        return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v;
      };
    }
    /* Der Domain-Warp bleibt periodisch: verschiebt man x um P, verschiebt
       sich auch das (periodische) Warpfeld um P — das Argument wandert also
       um genau eine Periode weiter und liefert denselben Wert. */
    function pfbm(n, x, y, oct, P) {
      let s = 0, a = .5, f = 1;
      for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f, P * f); f *= 2; a *= .5; }
      return s;
    }

    /* ---- Statische Ebene ----
       Die Milchstrasse ist in Wirklichkeit UNAUFGELOESTE STERNDICHTE, keine
       Wolke. Deshalb wird sie hier primaer dadurch erzeugt, dass entlang des
       Bandes mehr schwache Sterne stehen — plus eine sehr flache Restglut fuer
       die Komponente, die das Auge wirklich nicht mehr trennt. Ein glatter
       Nebel allein liest sich als grauer Schmier.
       Wird nur bei resize neu gezeichnet. */
    const BAND = { angle: -0.42, cx: .62, cy: .36, width: .30 };
    function bandDensity(x, y, nDust) {
      const cos = Math.cos(BAND.angle), sin = Math.sin(BAND.angle);
      const dx = x - w * BAND.cx, dy = y - h * BAND.cy;
      const across = (-dx * sin + dy * cos) / (h * BAND.width);
      const core = Math.exp(-across * across * 1.5);
      const along = (dx * cos + dy * sin) / (340 * DPR);
      const clump = fbm(nDust.bright, along, across * 2.0, 4);
      /* Staubbahnen SUBTRAHIEREN — sie machen die Milchstrasse ueberhaupt
         erst erkennbar, und genau das lassen die meisten Umsetzungen weg. */
      const dust = Math.pow(fbm(nDust.dust, along * 1.6 + 11, across * 2.8 - 4, 3), 1.6);
      return Math.max(0, core * (.42 + .8 * clump) * (1 - .9 * dust));
    }


    /* ---- Deep-Sky-Objekte ----
       Das ist der Unterschied zwischen "Nachthimmel" und "durchs Teleskop":
       offene Sternhaufen, Kugelsternhaufen, Galaxien, Emissionsnebel.
       Alle sehr flach gehalten — durch ein Amateurteleskop sind das blasse
       Wattebaeusche, keine Hubble-Postkarten.

       Physikalisch mitgenommen: Galaxien werden in Milchstrassennaehe vom
       eigenen Staub verdeckt (Zone of Avoidance). Die Galaxie wird deshalb
       bewusst WEIT WEG vom Band platziert. */
    function paintDeepSky(b, nz) {
      /* Nahe am Mond ueberstrahlt das Streulicht jedes lichtschwache Objekt —
         dort wird deshalb nichts platziert. Und die Objekte halten Abstand
         voneinander, sonst klumpen sie zufaellig zusammen. */
      const placed = [];
      const minGap = Math.min(w, h) * .22;
      const moonGap = Math.min(w, h) * .30;
      const pick = (tries, wantBand) => {
        let best = null, bestScore = wantBand ? -1 : 2;
        for (let i = 0; i < tries; i++) {
          const x = w * (.08 + Math.random() * .84), y = h * (.08 + Math.random() * .84);
          if (moon && Math.hypot(x - moon.x, y - moon.y) < moonGap) continue;
          if (placed.some(pp => Math.hypot(x - pp.x, y - pp.y) < minGap)) continue;
          const d = bandDensity(x, y, nz);
          if (wantBand ? d > bestScore : d < bestScore) { bestScore = d; best = { x, y }; }
        }
        if (!best) best = { x: w * (.15 + Math.random() * .7), y: h * (.15 + Math.random() * .7) };
        placed.push(best);
        return best;
      };

      /* Offener Sternhaufen: junge, blauweisse Sterne, locker, mit einem
         Hauch Reflexionsnebel — Plejaden-Typ. Liegt in der Scheibe, also
         nahe am Band. */
      const oc = pick(40, true);
      const ocR = Math.min(w, h) * .052;
      let gg = b.createRadialGradient(oc.x, oc.y, 0, oc.x, oc.y, ocR * 1.5);
      gg.addColorStop(0, "rgb(168 196 255 / .07)");
      gg.addColorStop(1, "rgb(168 196 255 / 0)");
      b.fillStyle = gg;
      b.beginPath(); b.arc(oc.x, oc.y, ocR * 1.5, 0, 6.283); b.fill();
      for (let i = 0; i < 34; i++) {
        const a = Math.random() * 6.283, rr = Math.pow(Math.random(), .6) * ocR;
        const bright = .25 + Math.pow(Math.random(), 2.2) * .75;
        b.fillStyle = `rgb(214 228 255 / ${(bright * .8).toFixed(3)})`;
        b.beginPath();
        b.arc(oc.x + Math.cos(a) * rr, oc.y + Math.sin(a) * rr, (.5 + bright * 1.0) * DPR, 0, 6.283);
        b.fill();
      }

      /* Kugelsternhaufen: alte, gelbliche Sterne, zur Mitte hin extrem dicht.
         Aufgeloest wird nur der Rand — genau so sieht er im Okular aus. */
      const gc = pick(24, false);
      const gcR = Math.min(w, h) * .022;
      gg = b.createRadialGradient(gc.x, gc.y, 0, gc.x, gc.y, gcR);
      gg.addColorStop(0,   "rgb(248 240 214 / .34)");
      gg.addColorStop(.35, "rgb(240 230 204 / .14)");
      gg.addColorStop(1,   "rgb(240 230 204 / 0)");
      b.fillStyle = gg;
      b.beginPath(); b.arc(gc.x, gc.y, gcR, 0, 6.283); b.fill();
      for (let i = 0; i < 60; i++) {
        const a = Math.random() * 6.283, rr = Math.pow(Math.random(), 2.4) * gcR;
        b.fillStyle = `rgb(252 246 226 / ${(.14 + Math.random() * .34).toFixed(3)})`;
        b.beginPath();
        b.arc(gc.x + Math.cos(a) * rr, gc.y + Math.sin(a) * rr, .55 * DPR, 0, 6.283);
        b.fill();
      }

      /* Galaxie: geneigte Scheibe mit hellem Kern und Staubband.
         Weit weg vom Milchstrassenband (Zone of Avoidance). */
      const gx = pick(60, false);
      const gr = Math.min(w, h) * .055, tilt = -0.55;
      b.save();
      b.translate(gx.x, gx.y); b.rotate(tilt); b.scale(1, .34);
      gg = b.createRadialGradient(0, 0, 0, 0, 0, gr);
      gg.addColorStop(0,   "rgb(238 236 226 / .30)");
      gg.addColorStop(.18, "rgb(216 218 226 / .14)");
      gg.addColorStop(.55, "rgb(198 206 228 / .055)");
      gg.addColorStop(1,   "rgb(198 206 228 / 0)");
      b.fillStyle = gg;
      b.beginPath(); b.arc(0, 0, gr, 0, 6.283); b.fill();
      /* Staubband quer vor dem Kern */
      b.globalCompositeOperation = "destination-out";
      b.fillStyle = "rgb(0 0 0 / .35)";
      b.beginPath(); b.ellipse(0, gr * .10, gr * .82, gr * .07, 0, 0, 6.283); b.fill();
      b.globalCompositeOperation = "source-over";
      b.restore();

      /* Emissionsnebel: H-alpha, also rot — liegt in der Scheibe */
      const nb = pick(30, true);
      const nr = Math.min(w, h) * .07;
      gg = b.createRadialGradient(nb.x, nb.y, 0, nb.x, nb.y, nr);
      gg.addColorStop(0,   "rgb(224 138 150 / .085)");
      gg.addColorStop(.45, "rgb(198 120 148 / .04)");
      gg.addColorStop(1,   "rgb(180 120 160 / 0)");
      b.fillStyle = gg;
      b.beginPath(); b.arc(nb.x, nb.y, nr, 0, 6.283); b.fill();
      /* die jungen Sterne, die ihn anregen */
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * 6.283, rr = Math.random() * nr * .35;
        b.fillStyle = "rgb(236 242 255 / .55)";
        b.beginPath();
        b.arc(nb.x + Math.cos(a) * rr, nb.y + Math.sin(a) * rr, .9 * DPR, 0, 6.283);
        b.fill();
      }
    }

    /* ---- Tag-Himmel ----

       Palette je Theme. Alle Stufen liegen bewusst HELL (Luminanz ab .65):
       der Himmel-Canvas liegt fix hinter der gesamten Seite und ist damit im
       Tag-Modus die dunkelste Flaeche, gegen die ueberhaupt Text stehen
       kann. Ein Postkartenblau bei Luminanz .44 saehe eine Sekunde lang gut
       aus und wuerde die halbe Textrampe unter 4.5:1 druecken. Die Dramatik
       kommt deshalb aus Saettigung, Wolken und Sonne — nicht aus einem
       dunklen Zenit.

       Der Verlauf hat vier Stopps, nicht zwei: echte Himmel sind am Zenit
       deutlich GESAETTIGTER und werden zum Horizont hin blasser und WAERMER
       (laengerer Lichtweg durch die Atmosphaere, mehr Streuung, mehr
       Aerosole). Zwei Stopps geben einen Farbverlauf, vier geben Luft.

       Mars ist tagsueber BUTTERSCOTCH, nicht blau: Staub aus Eisenoxid und
       Magnetit streut vorwaerts ins Rote. Blau ist dort nur der Hof UM die
       Sonne, weil die Streuung an den vergleichsweise grossen Staubkoernern
       in Vorwaertsrichtung die kurzen Wellenlaengen bevorzugt — genau
       umgekehrt zur Erde. Deshalb hat die Mars-Sonne hier einen blauen Hof
       und ist ausserdem kleiner (Mars steht 1,52 AE von der Sonne). */
    const DAYSKY = {
      space:  { zenith: "#B1D7FF", upper: "#C1DFFF", mid: "#CDE5FF", horizon: "#E8E5DE",
                cloud: "250 252 255", cloudLo: "173 191 214", cloudA: 1,
                cloudY: .30, cloudSpread: .20, cover: .50,
                cirrusY: .13, cirrusSpread: .13, cirrus: .55,
                /* Sonne und Mond haben von der Erde aus fast exakt denselben
                   Winkeldurchmesser (~0,5 Grad) — deshalb passen totale
                   Sonnenfinsternisse so genau. Also sunR = 1. */
                sunR: 1, sun: "255 250 235", halo: "255 244 212",
                sunHigh: "#FFF6E4", sunLow: "#FFC489",
                glare: "255 248 232", glareA: .70 },
      mars:   { zenith: "#FFCA91", upper: "#FFD4A6", mid: "#FFDDB9", horizon: "#F6E6D6",
                cloud: "253 248 243", cloudLo: "214 196 182", cloudA: .5,
                cloudY: .24, cloudSpread: .16, cover: .36,
                cirrusY: .11, cirrusSpread: .11, cirrus: .26,
                /* Mars steht 1,52 AE von der Sonne — sie misst dort nur rund
                   zwei Drittel des irdischen Durchmessers. */
                sunR: .67, sun: "252 251 255", halo: "176 208 255",
                sunHigh: "#FFF8EC", sunLow: "#FFDCB4",
                /* BLAUER Hof auf butterscotchfarbenem Himmel: der feine
                   Marsstaub ist gross genug, um in Vorwaertsrichtung
                   bevorzugt kurze Wellenlaengen zu streuen. Genau umgekehrt
                   zur Erde, und in den Rover-Aufnahmen deutlich zu sehen. */
                glare: "150 190 255", glareA: .62 },
      strand: { zenith: "#93DDFF", upper: "#AAE4FF", mid: "#C4EAFA", horizon: "#EDE6DA",
                cloud: "255 255 255", cloudLo: "178 199 219", cloudA: 1,
                cloudY: .27, cloudSpread: .18, cover: .46,
                cirrusY: .12, cirrusSpread: .12, cirrus: .50,
                sunR: 1, sun: "255 252 240", halo: "255 243 208",
                sunHigh: "#FFF7E6", sunLow: "#FFC98A",
                glare: "255 250 236", glareA: .74 },
    };
    const daySky = () => DAYSKY[html.dataset.theme || "space"] || DAYSKY.space;

    /* WELTALL BEI TAG.
       Im Space-Theme bleibt der Himmel auch im Tag-Modus das, was er ist:
       schwarz, mit Sternen und Milchstrasse. Das ist nicht Bequemlichkeit,
       sondern richtig — ohne Atmosphaere gibt es keine Rayleigh-Streuung,
       also auch keinen blauen Himmel. Auf der ISS steht die Sonne vor
       schwarzem Grund, und die Sterne sind da. Getauscht wird nur der
       Himmelskoerper: Sonne statt Mond.
       Mars und Strand haben eine Atmosphaere und bekommen deshalb ihren
       gemalten Taghimmel (butterscotch bzw. blau). */
    const spaceDay = () => dayMode() && (html.dataset.theme || "space") === "space";

    /* Sonnenstand. Einmal zentral, damit Blendhof (statische Ebene) und
       Scheibe (bewegte Ebene) garantiert an derselben Stelle sitzen. */
    function sunPos(scrollP) {
      if (!moon) return null;
      return {
        x: moon.x + moon.drift * scrollP * .5,
        y: moon.y * .78 + moon.rise * scrollP * .5,
        r: moon.r * daySky().sunR,
      };
    }

    function paintDaySky(b, nz) {
      const P = daySky();
      const sky = b.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0,   P.zenith);
      sky.addColorStop(.34, P.upper);
      sky.addColorStop(.66, P.mid);
      sky.addColorStop(1,   P.horizon);
      b.fillStyle = sky;
      b.fillRect(0, 0, w, h);

      /* VORWAERTSSTREUUNG an Aerosolen: der Himmel hellt zur Sonne hin
         merklich auf und entsaettigt dabei. Ohne diesen Hof schwebt die
         Scheibe VOR dem Himmel statt in ihm zu stehen — es ist derselbe
         Aufbau wie der zarte Mondhof nachts, nur viel staerker und waermer.
         Auf dem Mars ist genau dieser Hof BLAU (siehe Palette). */
      const S0 = sunPos(0);
      if (S0) {
        const gl = b.createRadialGradient(S0.x, S0.y, 0, S0.x, S0.y, Math.max(w, h) * .62);
        gl.addColorStop(0,   `rgb(${P.glare} / ${P.glareA})`);
        gl.addColorStop(.14, `rgb(${P.glare} / ${(P.glareA * .46).toFixed(3)})`);
        gl.addColorStop(.44, `rgb(${P.glare} / ${(P.glareA * .13).toFixed(3)})`);
        gl.addColorStop(1,   `rgb(${P.glare} / 0)`);
        b.fillStyle = gl;
        b.fillRect(0, 0, w, h);
      }

    }

    /* ---- Wolkenebene ----

       Eigene Canvas-Ebene, DOPPELT so breit wie das Fenster, die per
       CSS-Transform langsam durchgeschoben wird. Das ist der entscheidende
       Punkt: die Bewegung laeuft auf dem Compositor und kostet pro Frame
       nichts. Die Alternative — Wolken in jedem Frame in den bewegten
       Sternen-Canvas kopieren — waere eine Vollbild-Kopie pro Frame und
       genau der Fehler, den die Milchstrasse hier schon einmal gemacht hat
       (rund 18 ms).

       Damit die Schleife nicht springt, ist das Feld in x exakt periodisch
       (pfbm), und die Ebene ist zwei Perioden breit: eine Verschiebung um
       -50 % landet wieder exakt auf dem Ausgangsbild.

       Gerechnet wird wie bei der Milchstrasse in einen VERKLEINERTEN Puffer,
       der hochskaliert gezeichnet wird — gleicher Codepfad, kostenloses
       Glaetten. */
    const CLOUD_FRAC = .62;
    function paintDayClouds(nz) {
      const P = daySky();
      /* Diese Ebene laeuft bewusst in CSS-Pixeln statt in Geraetepixeln:
         auf einem HiDPI-Schirm waere sie sonst 5760 x 1800 = 10 Mio Pixel
         (rund 41 MB Texturspeicher), nur fuer weiche Wolkenkanten, die aus
         einem 520 px breiten Rauschpuffer stammen. Beim Hochskalieren geht
         hier nichts verloren, was vorher da gewesen waere. */
      const cw = Math.max(2, Math.round(innerWidth));
      /* Die Ebene deckt nur das obere Drittel bis Zweidrittel des Fensters
         ab — tiefer liegt kein Wolkenband mehr, und eine dauerhaft bewegte
         Vollbild-Ebene kostet in jedem Frame Kompositing. Nachgemessen hat
         das im Strand-Theme rund 8 ms pro Frame gespart. */
      const ch = Math.max(2, Math.round(innerHeight * CLOUD_FRAC));
      clouds.width = cw * 2; clouds.height = ch;
      clouds.style.width = (innerWidth * 2) + "px";
      clouds.style.height = (innerHeight * CLOUD_FRAC) + "px";
      const g = clouds.getContext("2d");
      g.clearRect(0, 0, cw * 2, ch);

      const LOW = 520;
      const lw = LOW, lh = Math.max(1, Math.round(LOW * ch / cw));
      const low = document.createElement("canvas");
      low.width = lw; low.height = lh;
      const lc = low.getContext("2d");
      const img = lc.createImageData(lw, lh);
      const d = img.data;
      const cc = P.cloud.split(" ").map(Number);
      const cs = P.cloudLo.split(" ").map(Number);
      /* Periode in Rauschgitter-Einheiten. Sie muss ganzzahlig sein und die
         Bildbreite genau einmal ueberspannen. */
      const PER = 8;
      /* Schwelle im Rauschwert. pfbm() liefert Werte um .5 mit einer
         Streuung von rund .12, die Schwelle liegt also in diesem Bereich.
         Sie steigt, je weiter man aus dem Wolkenband herauskommt — dadurch
         bleibt die Kante INNERHALB des Bandes hart, statt vom Band selbst
         weichgezeichnet zu werden. */
      const base = .50 + (.5 - P.cover) * .5;
      for (let y = 0; y < lh; y++) {
        /* ny bleibt auf das FENSTER bezogen, nicht auf die verkuerzte Ebene —
           die Palettenwerte (cloudY, cirrusY) sind Fensteranteile. */
        const ny = y / lh * CLOUD_FRAC;
        const yl = (ny - P.cloudY) / P.cloudSpread;
        const belt = Math.exp(-yl * yl * 1.35);
        if (belt < .05) continue;
        /* Perspektive: zum Horizont hin werden die Ballen flacher und
           gedraengter, weil man sie zunehmend von der Seite sieht. */
        const squash = 1 + ny * 1.5;
        /* HARTE UNTERKANTE, WEICHE OBERKANTE. Ein symmetrischer Schwellwert
           macht Wattebaeusche. Cumulus kondensieren alle auf DERSELBEN Hoehe
           — dort, wo die aufsteigende Luft ihren Taupunkt erreicht — und
           haben deshalb eine fast lineale Basis, waehrend die Oberseite in
           die Turbulenz ausfranst. Genau diese Asymmetrie ist das, was ein
           Auge als "Wolke" statt als "Rauschfleck" liest.
           .030 und nicht weniger: darunter steigt die Deckkraft innerhalb
           EINES Pufferpixels von 0 auf 1, und beim Hochskalieren zeichnet
           sich dann das Puffergitter als Treppe ab. */
        const soft = .030 + .13 * Math.max(0, -yl);
        const thr = base + (1 - belt) * .30;
        const fy = ny * squash * 5.4 + 11.3;
        for (let x = 0; x < lw; x++) {
          const fx = x / lw * PER;
          /* DOMAIN-WARP. Wertrauschen auf einem ganzzahligen Gitter zeigt
             ohne Verzerrung achsenparallele Kanten — bei der Milchstrasse
             faellt das nicht auf, bei Wolken sofort. Dieselbe Technik
             benutzt ridge() weiter unten fuer die Bergsilhouetten. */
          const wx = pfbm(nz.pdust, fx * .5, fy * .5, 2, PER) - .5;
          const wy = pfbm(nz.pdust, fx * .5 + 5.7, fy * .5 + 2.3, 2, PER) - .5;
          const v = pfbm(nz.pbright, fx + wx * 1.4, fy + wy * 1.4, 6, PER);
          let a = (v - thr) / soft;
          if (a <= 0) continue;
          if (a > 1) a = 1;
          /* Selbstbeschattung: die Unterseite eines Cumulus ist grau, die
             Oberseite weiss. Ohne diesen Verlauf bleibt es eine Schablone. */
          let k = (yl + .30) * .8;
          k = k < 0 ? 0 : k > 1 ? 1 : k;
          /* quadratisch mit der Deckung: duenne Schleier bleiben hell,
             nur die dicken Ballen bekommen einen grauen Bauch. Linear
             gekoppelt sehen kleine Wolken wie Schmutzflecken aus. */
          k *= a * a * .62;
          const o = (y * lw + x) * 4;
          d[o]     = Math.round(cc[0] + (cs[0] - cc[0]) * k);
          d[o + 1] = Math.round(cc[1] + (cs[1] - cc[1]) * k);
          d[o + 2] = Math.round(cc[2] + (cs[2] - cc[2]) * k);
          d[o + 3] = Math.round(255 * a * P.cloudA);
        }
      }
      /* ---- Zweites Stockwerk: Cirrus ----
         Ein einzelnes Wolkendeck liest sich flach. Echte Himmel haben
         mindestens zwei Etagen, und die obere besteht aus Eiskristallen:
         Cirrus stehen in 8-12 km Hoehe, sind duenn, streifig und vom
         Hoehenwind stark in die Laenge gezogen. Sie kosten hier fast nichts
         (drei Oktaven, stark gestauchtes y) und geben dem Himmel die Tiefe,
         die den Unterschied zum Tapetenmuster ausmacht. */
      lc.putImageData(img, 0, 0);
      const cir = lc.getImageData(0, 0, lw, lh);
      const cd = cir.data;
      for (let y = 0; y < lh; y++) {
        const ny = y / lh * CLOUD_FRAC;
        const yl = (ny - P.cirrusY) / P.cirrusSpread;
        const belt = Math.exp(-yl * yl * 1.6);
        if (belt < .05) continue;
        for (let x = 0; x < lw; x++) {
          /* 5:1 in die Breite gezogen — das ist der Hoehenwind. */
          const v = pfbm(nz.pbright, x / lw * PER * .9 + 31.7, ny * 26 + 4.1, 3, Math.round(PER * .9));
          let a = (v - (.58 - P.cirrus * .3)) / .16;
          if (a <= 0) continue;
          if (a > 1) a = 1;
          a *= belt * P.cirrus;
          const o = (y * lw + x) * 4;
          const prev = cd[o + 3] / 255;
          const na = prev + a * (1 - prev);
          if (na <= 0) continue;
          /* Cirrus sind fast weiss und werfen keinen eigenen Schatten. */
          cd[o]     = Math.round((cd[o]     * prev + 255 * a * (1 - prev)) / na);
          cd[o + 1] = Math.round((cd[o + 1] * prev + 255 * a * (1 - prev)) / na);
          cd[o + 2] = Math.round((cd[o + 2] * prev + 255 * a * (1 - prev)) / na);
          cd[o + 3] = Math.round(na * 255);
        }
      }
      lc.putImageData(cir, 0, 0);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      /* Zweimal nebeneinander: weil das Feld periodisch ist, sind beide
         Haelften identisch und die Naht ist keine. */
      g.drawImage(low, 0, 0, cw, ch);
      g.drawImage(low, cw, 0, cw, ch);
    }

    function paintBackdrop(faint, nz) {
      backdrop.width = w; backdrop.height = h;
      backdrop.style.width = innerWidth + "px";
      backdrop.style.height = innerHeight + "px";
      const b = backdrop.getContext("2d");
      b.clearRect(0, 0, w, h);

      /* Tag: der Himmel ist deckend. Milchstrasse, Deep-Sky und die
         eingebackenen schwachen Sterne entfallen ersatzlos — sie waeren
         nicht nur unsichtbar, sie sind auch der teuerste Teil dieser
         Funktion. */
      if (dayMode() && !spaceDay()) { paintDaySky(b, nz); paintDayClouds(nz); return; }

      /* Sehr flache Restglut. Sie wird klein gerendert und hochskaliert
         gezeichnet — das glaettet sie kostenlos und vermeidet die harten
         Blockkanten, die ein direktes ImageData-Raster erzeugt. */
      const LOW = 96;
      const lw = LOW, lh = Math.max(1, Math.round(LOW * h / w));
      const low = document.createElement("canvas");
      low.width = lw; low.height = lh;
      const lc = low.getContext("2d");
      const img = lc.createImageData(lw, lh);
      const d = img.data;
      for (let y = 0; y < lh; y++) {
        for (let x = 0; x < lw; x++) {
          const v = bandDensity(x / lw * w, y / lh * h, nz);
          if (v < .04) continue;
          const a = Math.min(15, v * 17);
          const warm = Math.min(1, v * 1.4);
          const o = (y * lw + x) * 4;
          d[o] = 168 + 40 * warm;
          d[o + 1] = 164 + 32 * warm;
          d[o + 2] = 184 + 18 * (1 - warm);
          d[o + 3] = a;
        }
      }
      lc.putImageData(img, 0, 0);
      b.imageSmoothingEnabled = true;
      b.imageSmoothingQuality = "high";
      b.drawImage(low, 0, 0, w, h);

      paintDeepSky(b, nz);

      /* Die schwaechsten Sterne werden hier eingebacken. Das ist nicht nur
         billiger als sie zu animieren, es ist auch physikalisch richtig: die
         lichtschwaechsten sind die ENTFERNTESTEN, und entfernte Objekte zeigen
         die geringste Parallaxe. Sie duerfen also stehen bleiben, waehrend die
         naeheren vorbeiziehen.
         (Dieser Block fehlte: der Parameter `faint` wurde uebergeben, aber nie
         benutzt — rund 2000 von 2600 Sternen waren dadurch unsichtbar.) */
      for (const st of faint) {
        let a = st.alpha, r = st.rad;
        if (r < .6 * DPR) { a *= (r / (.6 * DPR)) ** 2; r = .6 * DPR; }
        b.globalAlpha = Math.min(1, a);
        const pal = palette[st.ci];
        b.fillStyle = `rgb(${pal.r} ${pal.g} ${pal.b})`;
        b.fillRect(st.x - r, st.y - r, r * 2, r * 2);
      }
      b.globalAlpha = 1;
    }

    /* ---- Mond: echte Kugel, pro Pixel gerechnet ----

       Statt einer Scheibe mit aufgemalten Flecken wird hier eine Kugel
       schattiert. Fuer jedes Pixel der Scheibe:
         · Normale aus den Scheibenkoordinaten:  z = sqrt(1 − x² − y²)
         · Ort auf der Kugel in Laenge/Breite, inklusive Libration
         · Albedo aus Rauschen + Maria + Kratern (Hoehenfeld)
         · Normale durch das Hoehenfeld gestoert -> echtes Relief
         · Beleuchtung nach LOMMEL-SEELIGER, nicht Lambert:
              I = A · µ₀ / (µ₀ + µ)
           Das ist das Standardmodell fuer Regolith und der Grund, warum ein
           Vollmond flach wie eine Scheibe aussieht, waehrend am Terminator
           jedes Relief lange Schatten wirft. Lambert wuerde den Vollmond
           faelschlich zur Billardkugel machen.
         · Nachtseite: Erdschein statt Schwarz.

       Gerendert wird in eine Offscreen-Textur und nur neu gerechnet, wenn
       sich Phase oder Libration merklich aendern. */

    /* Echte Mondkarten der NASA (Public Domain).
       Farbe: LROC Wide Angle Camera Hapke-Mosaik, aus >100.000 Aufnahmen.
       Hoehe: LOLA-Laseraltimeter des Lunar Reconnaissance Orbiter.
       Beide equirektangular, auf 0 Grad Laenge zentriert.
       Quelle: NASA/GSFC Scientific Visualization Studio, CGI Moon Kit. */
    const moonMaps = { color: null, height: null, ready: false };
    (function loadMoonMaps() {
      let pending = 2;
      const grab = (src, key, gray) => {
        const im = new Image();
        im.decoding = "async";
        im.onload = () => {
          const c = document.createElement("canvas");
          c.width = im.naturalWidth; c.height = im.naturalHeight;
          const g2 = c.getContext("2d", { willReadFrequently: true });
          g2.drawImage(im, 0, 0);
          const d = g2.getImageData(0, 0, c.width, c.height);
          moonMaps[key] = { w: c.width, h: c.height, data: d.data };
          /* Bis hierher lief in `surface()` der prozedurale Notpfad. Alles,
             was damit gerechnet wurde, ist jetzt ueberholt — Speicher leeren
             und die Leiter in den Leerlaufpausen neu aufbauen. */
          if (--pending === 0) { moonMaps.ready = true; moonKey = ""; moonCacheClear(); prewarmMoon(); }
        };
        im.onerror = () => { if (--pending === 0) moonMaps.ready = false; };
        im.src = src;
      };
      grab("/img/moon-color.webp", "color");
      grab("/img/moon-height.webp", "height");
    })();

    function sampleMap(map, u, v) {
      if (!map) return null;
      let x = ((u % 1) + 1) % 1 * map.w | 0;
      let y = Math.max(0, Math.min(map.h - 1, (v * map.h) | 0));
      const o = (y * map.w + x) * 4;
      return o;
    }

    const moonTex = document.createElement("canvas");
    let moonKey = "";
    let moonPx = 0;
    /* Librationsphase: einmal je Sitzung gewuerfelt (siehe resize) */
    const moonSeed = Math.random() * 6.283;

    function hash3(x, y, z) {
      let n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
      return n - Math.floor(n);
    }
    function vnoise3(x, y, z) {
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
    function fbm3(x, y, z, oct) {
      let s = 0, a = .5, f = 1;
      for (let i = 0; i < oct; i++) { s += a * vnoise3(x * f, y * f, z * f); f *= 2.07; a *= .5; }
      return s;
    }

    /* Maria in Laenge/Breite (Grad), grob nach der echten Nahseite */
    const MARIA3 = [
      { lon: -22, lat:  33, r: 20, d: .40 },  /* Imbrium      */
      { lon:  17, lat:  27, r: 14, d: .38 },  /* Serenitatis  */
      { lon:  31, lat:   8, r: 15, d: .40 },  /* Tranquillit. */
      { lon:  59, lat:  17, r:  8, d: .34 },  /* Crisium      */
      { lon: -55, lat:   5, r: 24, d: .30 },  /* Procellarum  */
      { lon: -16, lat: -20, r: 14, d: .28 },  /* Nubium       */
      { lon:  25, lat: -14, r: 10, d: .26 },  /* Fecunditatis */
      { lon:  -8, lat: -43, r:  9, d: .18 },
    ];
    /* Krater: Laenge, Breite, Radius (Grad), Tiefe, Strahlensystem? */
    const CRAT3 = [
      { lon: -11, lat: -43, r: 5.0, d: 1.0, rays: true  },  /* Tycho      */
      { lon: -20, lat: -10, r: 4.4, d: .9,  rays: true  },  /* Copernicus */
      { lon: -43, lat:  -8, r: 3.6, d: .8,  rays: true  },  /* Kepler     */
      { lon:  15, lat: -55, r: 4.0, d: .7,  rays: false },
      { lon: -35, lat:  40, r: 3.0, d: .6,  rays: false },
      { lon:  45, lat: -35, r: 3.4, d: .6,  rays: false },
      { lon:  10, lat:  55, r: 3.0, d: .5,  rays: false },
      { lon: -60, lat: -30, r: 2.6, d: .5,  rays: false },
      { lon:  35, lat:  45, r: 2.4, d: .4,  rays: false },
    ];
    const D2R = Math.PI / 180;

    /* Albedo, Farbe und Hoehe an einem Punkt der Kugel (Einheitsvektor).
       Liegen die NASA-Karten vor, werden sie gelesen; bis dahin greift die
       prozedurale Notloesung, damit der Mond nie fehlt. */
    /* Ergebnis-Objekt wird WIEDERVERWENDET statt pro Aufruf neu angelegt.
       computeMoonTexture ruft `surface` je Bildpunkt auf; bei rund 123.000
       Punkten waren das ebenso viele kurzlebige Objekte allein fuer die Farbe.
       Wer den Rueckgabewert ueber einen weiteren Aufruf hinaus braucht, muss
       die Felder vorher in lokale Variablen kopieren. */
    const SRF = { alb: 0, r: 0, g: 0, b: 0, hgt: 0 };

    function surface(nx, ny, nz) {
      const lon = Math.atan2(nx, nz) / D2R;
      const lat = Math.asin(Math.max(-1, Math.min(1, ny))) / D2R;

      if (moonMaps.ready) {
        const u = (lon + 180) / 360;
        const v = (90 - lat) / 180;
        const oc = sampleMap(moonMaps.color, u, v);
        const oh = sampleMap(moonMaps.height, u, v);
        const cd = moonMaps.color.data, hd = moonMaps.height.data;
        /* Albedo aus der Helligkeit der Farbkarte, Farbstich bleibt erhalten */
        const R = cd[oc] / 255, G = cd[oc + 1] / 255, B = cd[oc + 2] / 255;
        SRF.alb = Math.max(.06, .30 + (R * .30 + G * .59 + B * .11) * 1.55);
        SRF.r = R; SRF.g = G; SRF.b = B;
        SRF.hgt = (hd[oh] / 255 - .5) * 1.9;
        return SRF;
      }

      /* Grundtextur der Hochlaender */
      let alb = .58 + .14 * (fbm3(nx * 3.1, ny * 3.1, nz * 3.1, 4) - .5) * 2;
      let hgt = (fbm3(nx * 7.3 + 5, ny * 7.3, nz * 7.3, 3) - .5) * .5;

      /* Maria: dunkler Basalt, glatter als das Umland */
      for (const m of MARIA3) {
        const dl = ((lon - m.lon + 540) % 360) - 180;
        const dd = Math.hypot(dl * Math.cos(lat * D2R), lat - m.lat) / m.r;
        if (dd < 1.35) {
          const k = 1 - Math.min(1, Math.pow(dd, 2.2));
          alb -= m.d * k;
          hgt = hgt * (1 - .7 * k) - .06 * k;
        }
      }

      /* Krater: heller Wall, dunkler Boden, Strahlen bei jungen Kratern */
      for (const c of CRAT3) {
        const dl = ((lon - c.lon + 540) % 360) - 180;
        const dd = Math.hypot(dl * Math.cos(lat * D2R), lat - c.lat) / c.r;
        if (dd < 1.0) {                       /* Boden + Wall */
          hgt -= c.d * (1 - dd * dd) * .55;
          if (dd > .78) { hgt += c.d * .8 * (dd - .78) / .22; alb += .10 * c.d; }
          else alb -= .04 * c.d;
        } else if (c.rays && dd < 7) {        /* Strahlensystem */
          const ang = Math.atan2(lat - c.lat, dl);
          const spokes = Math.pow(Math.abs(Math.sin(ang * 7 + c.lon)), 6);
          alb += .16 * spokes * Math.max(0, 1 - (dd - 1) / 6);
        }
      }
      SRF.alb = Math.max(.12, Math.min(1, alb));
      SRF.r = 1; SRF.g = .985; SRF.b = .945;
      SRF.hgt = hgt;
      return SRF;
    }

    /* NUR die Hoehe an einem Punkt.
       computeMoonTexture braucht je Bildpunkt drei Werte: Farbe am Punkt und
       zweimal die Hoehe daneben, um daraus die Normale zu bilden. Fuer die
       beiden Nachbarn ist alles ausser der Hoehe verschenkte Arbeit — im
       Kartenpfad die halbe Zahl der Kartenzugriffe, im prozeduralen Pfad das
       gesamte Albedo samt Strahlensystemen der jungen Krater. */
    function surfaceHgt(nx, ny, nz) {
      const lon = Math.atan2(nx, nz) / D2R;
      const lat = Math.asin(Math.max(-1, Math.min(1, ny))) / D2R;

      if (moonMaps.ready) {
        const oh = sampleMap(moonMaps.height, (lon + 180) / 360, (90 - lat) / 180);
        return (moonMaps.height.data[oh] / 255 - .5) * 1.9;
      }

      let hgt = (fbm3(nx * 7.3 + 5, ny * 7.3, nz * 7.3, 3) - .5) * .5;
      for (const m of MARIA3) {
        const dl = ((lon - m.lon + 540) % 360) - 180;
        const dd = Math.hypot(dl * Math.cos(lat * D2R), lat - m.lat) / m.r;
        if (dd < 1.35) {
          const k = 1 - Math.min(1, Math.pow(dd, 2.2));
          hgt = hgt * (1 - .7 * k) - .06 * k;
        }
      }
      for (const c of CRAT3) {
        const dl = ((lon - c.lon + 540) % 360) - 180;
        const dd = Math.hypot(dl * Math.cos(lat * D2R), lat - c.lat) / c.r;
        /* Das Strahlensystem (dd < 7) faerbt nur, es hebt nicht — hier egal. */
        if (dd < 1.0) {
          hgt -= c.d * (1 - dd * dd) * .55;
          if (dd > .78) hgt += c.d * .8 * (dd - .78) / .22;
        }
      }
      return hgt;
    }

    /* `canvas.width = x` legt die Zeichenflaeche auch dann neu an, wenn der
       Wert gleich bleibt — und `px` aendert sich nur bei einem Resize.
       Der Bildpuffer wird bewusst NICHT wiederverwendet: er wandert in den
       Texturspeicher, und ein geteilter Puffer wuerde die dort abgelegten
       Eintraege beim naechsten Rechnen ueberschreiben. Da nur noch MOON_Q + 1
       Texturen je Sitzung entstehen, faellt die Allokation nicht ins Gewicht. */
    function computeMoonTexture(px, libLon, libLat, sunX) {
      const _pt0 = PERF ? performance.now() : 0;
      if (moonTex.width !== px || moonTex.height !== px) {
        moonTex.width = px; moonTex.height = px;
      }
      const g = moonTex.getContext("2d");
      const img = g.createImageData(px, px);
      const d = img.data;
      const R = px / 2;
      const cosLat = Math.cos(libLat), sinLat = Math.sin(libLat);
      const cosLon = Math.cos(libLon), sinLon = Math.sin(libLon);
      /* Sonnenrichtung: sunX von −1 (links) bis +1 (rechts) */
      const sz = Math.sqrt(Math.max(0, 1 - sunX * sunX));
      const eps = 1.6 / R;                     /* Schrittweite fuer die Ableitung */

      for (let j = 0; j < px; j++) {
        const y = (j - R + .5) / R;
        for (let i = 0; i < px; i++) {
          const x = (i - R + .5) / R;
          const d2 = x * x + y * y;
          const o = (j * px + i) * 4;
          if (d2 >= 1) { d[o + 3] = 0; continue; }
          const z = Math.sqrt(1 - d2);

          /* Libration: Kugel drehen, bevor die Textur gelesen wird */
          let rx = x * cosLon - z * sinLon;
          let rz = x * sinLon + z * cosLon;
          let ry = y * cosLat - rz * sinLat;
          rz = y * sinLat + rz * cosLat;

          /* `surface` gibt ein wiederverwendetes Objekt zurueck — die Werte
             muessen VOR dem naechsten Aufruf herausgezogen werden. */
          const s0 = surface(rx, ry, rz);
          const s0alb = s0.alb, s0r = s0.r, s0g = s0.g, s0b = s0.b, s0hgt = s0.hgt;

          /* Relief: Normale aus dem Hoehengradienten stoeren */
          const hx = surfaceHgt(rx + eps, ry, rz) - s0hgt;
          const hy = surfaceHgt(rx, ry + eps, rz) - s0hgt;
          const BUMP = 26;
          let nx2 = x - hx * BUMP, ny2 = y - hy * BUMP, nz2 = z;
          const len = Math.hypot(nx2, ny2, nz2) || 1;
          nx2 /= len; ny2 /= len; nz2 /= len;

          const mu0 = nx2 * sunX + nz2 * sz;    /* zur Sonne   */
          const mu  = nz2;                      /* zum Betrachter */

          let lum;
          if (mu0 <= 0) {
            lum = s0alb * .052;                 /* Erdschein */
          } else {
            /* Lommel-Seeliger: flacher Vollmond, harter Terminator */
            lum = s0alb * (mu0 / (mu0 + Math.max(.05, mu))) * 2.15;
            /* weicher Uebergang genau an der Schattengrenze */
            lum *= Math.min(1, mu0 * 7);
            lum = Math.max(lum, s0alb * .052);
          }
          lum = Math.max(0, Math.min(1, lum));

          /* Farbe kommt aus der Karte; die Nachtseite kippt ins Kuehle,
             weil Erdschein blaeulich ist. */
          const lit = mu0 > 0;
          d[o]     = Math.round(255 * lum * (lit ? s0r : s0r * .58));
          d[o + 1] = Math.round(255 * lum * (lit ? s0g : s0g * .70));
          d[o + 2] = Math.round(255 * lum * (lit ? s0b : s0b * 1.05));
          d[o + 3] = 255;
        }
      }
      if (PERF) {
        const _P = window.__moonPerf || (window.__moonPerf = { n: 0, ms: 0 });
        _P.n++; _P.ms += performance.now() - _pt0;
      }
      return img;
    }

    /* ---- Texturleiter ----
       Weil die Libration ueber scrollP quantisiert wird (siehe paintMoon), gibt
       es nur MOON_Q + 1 moegliche Texturen. Sie werden als ImageData gehalten —
       nicht als Canvas (jedes zaehlt auf iOS gegen ein hartes Speicherbudget)
       und nicht als ImageBitmap (dessen Erzeugung ist asynchron und damit im
       Frame nicht verfuegbar). Ein Treffer kostet ein putImageData statt einer
       vollstaendigen Rasterung.

       Gedeckelt wird in BYTE, nicht in Eintraegen: eine Textur misst px²·4, das
       sind rund 45 KB auf einem Handy, aber 630 KB auf 1920×1080 bei doppelter
       Pixeldichte und ueber 2 MB auf einem 4K-Schirm. Auf kleinen Geraeten
       passt die Leiter dadurch immer vollstaendig hinein. */
    const MOON_Q = 32;
    const MOON_CACHE_BYTES = 24 * 1024 * 1024;
    const moonCache = new Map();
    let moonCacheBytes = 0;

    function moonCacheGet(key) {
      const hit = moonCache.get(key);
      if (!hit) return null;
      /* Map behaelt die Einfuegereihenfolge: neu einsortieren heisst "zuletzt
         gebraucht", und die Verdraengung nimmt dann von vorne. */
      moonCache.delete(key); moonCache.set(key, hit);
      return hit;
    }
    function moonCachePut(key, img) {
      const size = img.data.length;
      if (size > MOON_CACHE_BYTES) return;          /* passt nie — gar nicht erst */
      moonCache.set(key, img);
      moonCacheBytes += size;
      for (const k of moonCache.keys()) {
        if (moonCacheBytes <= MOON_CACHE_BYTES) break;
        if (k === key) continue;                    /* nie den gerade Gesetzten */
        moonCacheBytes -= moonCache.get(k).data.length;
        moonCache.delete(k);
      }
    }
    function moonCacheClear() { moonCache.clear(); moonCacheBytes = 0; moonPrewarmQ = 0; }

    /* Alles, was eine Librationsstufe ausmacht: die beiden Winkel, die
       Texturgroesse und der Schluessel, unter dem sie im Speicher liegt.
       Wird von paintMoon und vom Vorwaermen gleichermassen gebraucht; das
       Ergebnisobjekt ist wiederverwendet und darf nicht aufgehoben werden. */
    const MOON_STEP = { key: "", px: 0, libLon: 0, libLat: 0, sunX: 0, illum: 0 };
    function moonStep(qP) {
      const libLon = Math.sin(qP * 2.4 + moon.seed) * (8 * D2R);
      const libLat = Math.cos(qP * 1.9 + moon.seed) * (7 * D2R);

      /* Echte Phase aus dem Datum */
      const ph = moonPhaseNow();
      const illum = (1 - Math.cos(ph * 6.283185307)) / 2;
      const waxing = ph < .5;
      /* Sonnenrichtung folgt der Phase: Vollmond = frontal, Neumond = seitlich */
      const sun0 = (waxing ? 1 : -1) * Math.sqrt(Math.max(0, 1 - Math.pow(2 * illum - 1, 2)));
      const sunX = illum > .5 ? sun0 * .999 : sun0;

      const px = Math.max(96, Math.round(moon.r * 2 * 2.0));
      MOON_STEP.key = `${moonMaps.ready ? 'nasa' : 'proc'}|${px}|${libLon.toFixed(2)}|${libLat.toFixed(2)}|${sunX.toFixed(3)}|${(2 * illum - 1).toFixed(2)}`;
      MOON_STEP.px = px;
      MOON_STEP.libLon = libLon; MOON_STEP.libLat = libLat;
      MOON_STEP.sunX = sunX; MOON_STEP.illum = illum;
      return MOON_STEP;
    }

    /* Eine Stufe holen: erst aus dem Speicher, sonst rechnen und ablegen. */
    function moonTexture(key, px, libLon, libLat, sunX) {
      let img = moonCacheGet(key);
      if (!img) { img = computeMoonTexture(px, libLon, libLat, sunX); moonCachePut(key, img); }
      return img;
    }

    /* ---- Vorwaermen in den Leerlaufpausen ----
       Ohne das rastert der ERSTE Durchgang durch die Seite die Leiter Stufe fuer
       Stufe waehrend des Scrollens — genau dann, wenn es stoert. In den Pausen
       davor faellt dieselbe Arbeit nicht auf.
       Erst wenn die NASA-Karten stehen: bis dahin laeuft in `surface()` der
       prozedurale Notpfad, und dessen Ergebnis wuerde sofort wieder verworfen. */
    let moonPrewarmQ = 0, moonPrewarmRaf = 0;
    function prewarmMoon() {
      if (!("requestIdleCallback" in window)) return;
      if (moonPrewarmRaf) return;
      const stepOn = deadline => {
        moonPrewarmRaf = 0;
        if (!moon || !moonMaps.ready || html.dataset.fx === "s" || reduced()) return;
        /* Nur vorwaermen, wo der Mond auch wirklich am Himmel steht: tagsueber
           steht dort die Sonne, im Mars-Theme Phobos. Beide haben eigene
           Texturen mit eigenen, scroll-unabhaengigen Schluesseln — die
           Mondleiter waere dort reine Arbeit fuer den Papierkorb. */
        if (dayMode() || (html.dataset.theme || "space") === "mars") return;
        do {
          if (moonPrewarmQ > MOON_Q) return;
          const s = moonStep(moonPrewarmQ / MOON_Q);
          moonTexture(s.key, s.px, s.libLon, s.libLat, s.sunX);
          moonPrewarmQ++;
        } while (deadline.timeRemaining() > 8);
        moonPrewarmRaf = requestIdleCallback(stepOn, { timeout: 2000 });
      };
      moonPrewarmRaf = requestIdleCallback(stepOn, { timeout: 2000 });
    }

    function paintMoon(g, scrollP) {
      if (!moon) return;
      const r = moon.r;
      /* Differentielle Parallaxe: Sterne stehen effektiv im Unendlichen, der
         Mond bei 384.000 km. Er verschiebt sich also leicht GEGEN sie. */
      const x = moon.x + moon.drift * scrollP;
      const y = moon.y + moon.rise * scrollP;

      /* Libration: real ±8° Laenge, ±7° Breite. Daran haengt die
         Perspektivaenderung beim Scrollen — nicht an einer erfundenen Drehung.

         QUANTISIERT WIRD DIE PHASE, NICHT DER WERT. Beide Winkel sind
         Funktionen DESSELBEN scrollP, laufen ueber die Seite aber nur 2,4 bzw.
         1,9 Radiant weit — also einen offenen Bogen ohne Wiederkehr. Bei freier
         Libration ist die Menge der gebrauchten Texturen dadurch unbeschraenkt,
         und ein Zwischenspeicher trifft beim Durchscrollen NIE: jeder Eintrag
         wird genau einmal gebraucht. Ueber scrollP quantisiert sind es dagegen
         exakt MOON_Q + 1 Texturen, unabhaengig vom Scrollverhalten.

         MOON_Q = 32 ist so gewaehlt, dass sich am Ist-Zustand nichts aendert:
         der groesste Librationssprung betraegt damit rund 0,010 rad — dasselbe
         Raster, das die bisherige Rundung auf zwei Nachkommastellen ohnehin
         erzeugt hat, und am Mondrand rund ein Bildpunkt. */
      const s = moonStep(Math.round(scrollP * MOON_Q) / MOON_Q);
      const illum = s.illum;

      if (s.key !== moonKey) {
        const hit = moonCacheGet(s.key);
        if (hit) {
          if (moonTex.width !== s.px) { moonTex.width = moonTex.height = s.px; }
          moonTex.getContext("2d").putImageData(hit, 0, 0);
          moonKey = s.key;
        } else if (!moonKey || Math.abs(travel) < 1.2) {
          /* Waehrend schneller Fahrt wird KEINE fehlende Stufe nachgerechnet:
             im Warp zieht ohnehin alles Streifen, Librationsdetails sieht dabei
             niemand. Die Stufe entsteht im ersten ruhigen Frame danach.
             Die erste Textur ueberhaupt (moonKey noch leer) muss trotzdem
             gerechnet werden, sonst steht der Himmel ohne Mond da. */
          const img = moonTexture(s.key, s.px, s.libLon, s.libLat, s.sunX);
          moonTex.getContext("2d").putImageData(img, 0, 0);
          moonKey = s.key;
        }
        /* sonst: die zuletzt fertige Textur bleibt stehen */
      }

      g.save();
      /* Hof: Streulicht in der Atmosphaere. Zurueckhaltend — der Mond soll den
         Himmel beglaubigen, nicht das Bild an sich reissen. */
      /* Der innere Radius war r (nicht 0) — im Sprite ist der Verlauf auf
         0..1 normiert, der Anfangsstopp sitzt deshalb bei r/(r*4.2).
         `illum` wird auf 32 Stufen gerundet, damit nicht jede Nachkommastelle
         der Beleuchtung eine eigene Textur erzeugt; sichtbar ist das nicht. */
      const illumQ = Math.round(illum * 32) / 32;
      drawHalo(g, x, y, r, r * 4.2, [
        [0,  `rgb(214 222 246 / ${(.10 * illumQ + .02).toFixed(3)})`],
        [.4, `rgb(196 208 240 / ${(.032 * illumQ).toFixed(3)})`],
        [1,  "rgb(196 208 240 / 0)"],
      ]);

      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(moonTex, x - r, y - r, r * 2, r * 2);
      g.restore();
    }

    /* ---- Sonne ----

       Auf demselben Anspruchsniveau wie der Mond, aber ueber einen anderen
       Weg. Grundlage ist eine echte Weisslicht-Aufnahme der Photosphaere vom
       Instrument HMI auf dem Solar Dynamics Observatory der NASA
       (gemeinfrei): freigestellte Scheibe, in eine Luminanzkarte gewandelt,
       kreisfoermig maskiert. Damit stecken die zwei Dinge im Bild, die eine
       Sonne echt aussehen lassen:

       · RANDVERDUNKLUNG. Der Rand hat nur rund 40 % der Helligkeit der
         Mitte, weil man dort schraeg durch die Photosphaere blickt und
         deshalb hoehere, kuehlere Schichten sieht. Eine gleichmaessig helle
         Scheibe liest sofort als aufgeklebter Kreis — derselbe Fehler wie
         eine kugelfoermig schattierte Mondscheibe beim Vollmond. Deshalb
         wird die Textur UNVERAENDERT gemalt und keine eigene Schattierung
         darueber gerechnet.
       · Die echten SONNENFLECKEN des Aufnahmetages, inklusive einer
         groesseren Gruppe links der Mitte.

       Nicht nachgebaut wird die Granulation: die Konvektionszellen messen
       rund 1000 km, das liegt bei einer Scheibe von ~200 Bildpunkten weit
       unter einem Pixel. Sichtbar gemacht saehe sie nach Rauschen aus, nicht
       nach Sonne. Sie steckt in der Aufnahme, wo sie hingehoert — unsichtbar
       klein.

       Billiger als der Mond ist sie trotzdem, und zwar aus einem sachlichen
       Grund: die Sonne leuchtet selbst. Kein Terminator, keine Phase, keine
       Libration — der gesamte teure Teil von paintMoon() (Pro-Pixel-
       Schattierung mit Hoehenfeld und Lommel-Seeliger) entfaellt. Es bleiben
       eine maskierte Textur und ein Hof. */
    const sunTex = document.createElement("canvas");
    let sunKey = "";
    const sunMap = { el: null, ready: false };
    (function loadSunMap() {
      const im = new Image();
      im.decoding = "async";
      im.onload = () => { sunMap.el = im; sunMap.ready = true; sunKey = ""; };
      im.onerror = () => { sunMap.ready = false; };
      im.src = "/img/sun-detail.webp";
    })();

    /* Zwei Hexwerte mischen, Rueckgabe als [r,g,b] */
    function mixHex(a, b2, t) {
      const p = s => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
      const A = p(a), B = p(b2);
      return [0, 1, 2].map(i => Math.round(A[i] + (B[i] - A[i]) * t));
    }

    function renderSunTexture(px, tint) {
      sunTex.width = sunTex.height = px;
      const g = sunTex.getContext("2d");
      g.clearRect(0, 0, px, px);
      const rgbStr = `rgb(${tint[0]} ${tint[1]} ${tint[2]})`;
      if (!sunMap.ready) {
        /* Fehlerpfad wie bei den Mondkarten: ohne Bild eine schlichte
           Scheibe, aber MIT gerechneter Randverdunklung (Rand auf 42 % der
           Mitte) — ohne sie waere es ein Aufkleber. */
        const dim = tint.map(c => Math.round(c * .42));
        const gr = g.createRadialGradient(px / 2, px / 2, 0, px / 2, px / 2, px / 2);
        gr.addColorStop(0,   rgbStr);
        gr.addColorStop(.55, rgbStr);
        gr.addColorStop(1,   `rgb(${dim[0]} ${dim[1]} ${dim[2]})`);
        g.fillStyle = gr;
        g.beginPath(); g.arc(px / 2, px / 2, px / 2 - 1, 0, 6.283); g.fill();
        return;
      }
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      /* Gemessen: mit brightness(1.24) stand die Scheibenmitte bei 255 —
         voll geklippt. Damit war die Randverdunklung im inneren Bereich
         weggebuegelt und die Sonnenflecken unsichtbar; die Sonne war ein
         weisser Kreis neben einem Mond voller Krater. Multiplikativ
         verflacht zwar nicht das VERHAELTNIS Mitte:Rand, aber sobald die
         Mitte in die Saettigung laeuft, ist genau das doch der Fall.
         Die Textur traegt jetzt echte Randverdunklung (Mitte 185, Rand 135),
         und die Blendwirkung kommt aus dem Hof, nicht aus einer
         ueberbelichteten Scheibe. */
      /* Die Textur liegt bereits im richtigen Helligkeitsband (Rand 217,
         Mitte 254) — ein weiterer Schub wuerde sie nur wieder ins Klippen
         treiben und die Randverdunklung loeschen. Deshalb kein Filter. */
      g.filter = "none";
      g.drawImage(sunMap.el, 0, 0, px, px);
      g.filter = "none";
      /* Einfaerben der Luminanzkarte: `multiply` legt den Farbton auf die
         Helligkeiten. Danach holt `destination-in` die kreisrunde Alphamaske
         des Bildes zurueck — ohne diesen zweiten Schritt liefe das
         Fuellrechteck ueber die ganze Kachel und die Ecken waeren deckend. */
      g.globalCompositeOperation = "multiply";
      g.fillStyle = rgbStr;
      g.fillRect(0, 0, px, px);
      g.globalCompositeOperation = "destination-in";
      g.drawImage(sunMap.el, 0, 0, px, px);
      g.globalCompositeOperation = "source-over";
    }

    function paintSun(g, scrollP) {
      const S = sunPos(scrollP);
      if (!S) return;
      const P = daySky();
      const { x, y, r } = S;

      /* Die Photosphaere ist WEISS — 5772 K ist per Definition der
         Weisspunkt; das Orange in SDO-Aufnahmen ist Falschfarbe. Gefaerbt
         wird deshalb nicht die Sonne, sondern der Weg des Lichts durch die
         Atmosphaere: hoch am Himmel sehr warmes Weiss, tief ueber dem
         Horizont deutlich roeter, weil dort viel mehr Luft im Weg liegt und
         der blaue Anteil weggestreut wird. Derselbe Effekt, der
         Sonnenuntergaenge rot macht — und er kostet nichts, weil die Hoehe
         ohnehin schon dasteht. */
      const alt = Math.max(0, Math.min(1, 1 - y / h));
      const tint = mixHex(P.sunLow, P.sunHigh, Math.min(1, alt / .72));

      /* Dreifache statt doppelte Aufloesung: die Sonnenflecken sind das
         Einzige, was auf der Scheibe ueberhaupt Struktur traegt, und bei
         2x fielen die kleineren beim Verkleinern schlicht weg. */
      const px = Math.min(768, Math.max(128, Math.round(r * 2 * 3)));
      const key = `${sunMap.ready ? "sdo" : "flat"}|${px}|${tint.join(",")}`;
      if (key !== sunKey) { renderSunTexture(px, tint); sunKey = key; }

      g.save();
      /* Der Hof ist wichtiger als die Scheibe: in einen echten Himmel kann
         man nicht hineinsehen, wahrgenommen wird ueberwiegend Blendung.
         Zwei Stufen, damit der Uebergang nicht als Ring bricht. Der weite
         Anteil des Hofs sitzt bereits auf der statischen Ebene (siehe
         paintDaySky), hier kommt nur der enge, harte Teil dazu. */
      drawHalo(g, x, y, r * .5, r * 8, [
        [0,   `rgb(${P.halo} / .58)`],
        [.10, `rgb(${P.halo} / .42)`],
        [.26, `rgb(${P.halo} / .22)`],
        [.60, `rgb(${P.halo} / .06)`],
        [1,   `rgb(${P.halo} / 0)`],
      ]);

      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      /* Die Freistellungsmaske der Aufnahme liegt 3 px INNERHALB der
         Scheibe. Bei 82 px Durchmesser auf dem Schirm wird daraus ein
         dunkler Ring, der die Sonne wie einen Aufkleber wirken laesst.
         Deshalb wird die Textur leicht ueberformatig gezeichnet und auf den
         Kreis beschnitten — der Maskenrand faellt dabei heraus. */
      g.save();
      g.beginPath(); g.arc(x, y, r, 0, 6.283); g.clip();
      g.drawImage(sunTex, x - r * 1.045, y - r * 1.045, r * 2.09, r * 2.09);
      g.restore();
      /* Randsaum: in der Atmosphaere ist die Sonnenkante nie hart, das
         Streulicht laeuft ueber sie hinweg. Ein additiver Saum genau auf
         dem Rand nimmt der Scheibe den Aufkleber-Charakter, ohne die
         Randverdunklung darunter zu loeschen. */
      g.globalCompositeOperation = "lighter";
      /* Der Saum muss AUSSERHALB der Scheibe bleiben. Vorher begann er bei
         0.82 r und hellte damit genau den Rand auf, der physikalisch der
         dunkelste Teil ist — die Randverdunklung war dadurch umgekehrt und
         die Sonne bekam einen hellen Ring wie ein Aufkleber. Jetzt setzt er
         erst auf der Kante an und laeuft nach aussen. */
      /* Die Kopie laeuft unter demselben `lighter`, das oben gesetzt wurde —
         drawImage respektiert die Composite-Einstellung wie ein fill(). */
      drawHalo(g, x, y, r * .995, r * 1.22, [
        [0,   `rgb(${P.sun} / .16)`],
        [.35, `rgb(${P.sun} / .08)`],
        [1,   `rgb(${P.sun} / 0)`],
      ]);
      g.globalCompositeOperation = "source-over";

      /* Blendung ueber der Mitte, ADDITIV. Additiv, weil dann die
         Randverdunklung als Abfall erhalten bleibt, waehrend die Mitte
         ausbrennt — genau das sieht man auch in Wirklichkeit. Ein deckender
         Kern darueber wuerde die Flecken mit ausloeschen. */
      g.globalCompositeOperation = "lighter";
      drawHalo(g, x, y, 0, r * 2.6, [
        [0,    `rgb(${P.sun} / .04)`],
        [.30,  `rgb(${P.sun} / .07)`],
        [.385, `rgb(${P.sun} / .17)`],
        [.52,  `rgb(${P.sun} / .09)`],
        [1,    `rgb(${P.sun} / 0)`],
      ]);
      g.restore();
    }


    /* ---- Phobos und Deimos ----
       Auf dem Mars stuende unser Mond nicht am Himmel. Die Zahlen:

       · Phobos misst 8,4′ am Horizont bis 12,0′ im Zenit — gut ein Drittel der
         Breite unseres Mondes (31′). Er ist KARTOFFELFOERMIG (ca. 27×22×18 km).
       · Seine Albedo ist 0,071, einer der dunkelsten Werte im Sonnensystem.
         Zusammen damit, dass der Mars nur ~43 % der Sonneneinstrahlung der Erde
         bekommt, liegt seine Flaechenhelligkeit bei rund einem Viertel des
         Vollmonds. Ein hell leuchtendes Scheibchen waere schlicht falsch.
       · Er geht im WESTEN auf und zieht in gut vier Stunden entgegen der
         Sternbewegung ueber den Himmel — das ist der staerkste Fremdheitseffekt.
       · Deimos misst maximal 2,5′. Das Auge loest etwa 1′ auf, er ist also ein
         sehr heller Punkt, keine Scheibe. Und wie alle ausgedehnten Koerper
         flimmert er nicht. */
    const phobosTex = document.createElement("canvas");
    let phobosKey = "";

    function renderPhobosTexture(px, sunX, seed) {
      phobosTex.width = px; phobosTex.height = px;
      const g = phobosTex.getContext("2d");
      const img = g.createImageData(px, px);
      const d = img.data;
      const R = px / 2;
      const sz = Math.sqrt(Math.max(0, 1 - sunX * sunX));
      /* Stickney: der grosse Krater sitzt nahe dem marszugewandten Pol */
      const stX = -.42, stY = .18, stR = .42;

      for (let j = 0; j < px; j++) {
        const y = (j - R + .5) / R;
        for (let i = 0; i < px; i++) {
          const x = (i - R + .5) / R;
          const o = (j * px + i) * 4;
          /* Unregelmaessige Silhouette statt Kreis: der Radius wird ueber den
             Winkel moduliert. Bei 12′ ist die Nichtkugelform gerade an der
             Wahrnehmungsgrenze — aber genau das liest sich als "nicht der Mond". */
          const ang = Math.atan2(y, x);
          const lim = .94 + .085 * Math.sin(ang * 2 + seed)
                          + .05 * Math.sin(ang * 3 - seed * 1.7)
                          + .03 * Math.sin(ang * 5 + seed * .6);
          const rr = Math.hypot(x, y) / lim;
          if (rr >= 1) { d[o + 3] = 0; continue; }
          const z = Math.sqrt(1 - rr * rr);
          const nx = x / lim, ny = y / lim;

          /* Regolith: feines Rauschen plus Stickney als flache Mulde */
          let alb = .55 + .30 * (fbm3(nx * 5.2 + seed, ny * 5.2, z * 5.2, 3) - .5);
          const ds = Math.hypot(nx - stX, ny - stY) / stR;
          if (ds < 1) { alb -= .16 * (1 - ds * ds); if (ds > .82) alb += .20 * (ds - .82) / .18; }
          /* ein paar kleinere Krater */
          for (let k = 0; k < 4; k++) {
            const cx = Math.sin(seed * (k + 2) * 2.3) * .55, cy = Math.cos(seed * (k + 3) * 1.9) * .55;
            const dd = Math.hypot(nx - cx, ny - cy) / (.13 + k * .03);
            if (dd < 1) alb -= .10 * (1 - dd * dd);
          }
          alb = Math.max(.1, Math.min(1, alb));

          const mu0 = nx * sunX + z * sz;
          const mu = z;
          let lum;
          if (mu0 <= 0) lum = alb * .03;
          else {
            lum = alb * (mu0 / (mu0 + Math.max(.05, mu)));
            lum *= Math.min(1, mu0 * 6);
            lum = Math.max(lum, alb * .03);
          }
          /* Albedo 0,071 und schwaechere Sonne: rund ein Viertel der
             Vollmondhelligkeit. */
          lum = Math.max(0, Math.min(1, lum * .62));
          d[o]     = Math.round(255 * lum * .96);
          d[o + 1] = Math.round(255 * lum * .93);
          d[o + 2] = Math.round(255 * lum * .88);
          d[o + 3] = 255;
        }
      }
      g.putImageData(img, 0, 0);
    }

    function paintPhobos(g, scrollP) {
      if (!moon) return;
      /* Phobos zieht von West nach Ost, also entgegen den Sternen. Der Scroll
         treibt diese Bewegung — sie laeuft der Sternbewegung sichtbar zuwider. */
      const x = moon.x + moon.drift * scrollP * -1.6;
      const y = moon.y + moon.rise * scrollP * .6;
      /* Physikalisch misst Phobos 12′ gegen 31′ des Erdmondes, also gut ein
         Drittel. Hier steht er bewusst groesser: er ist das Flugziel der
         Rakete und muss als KOERPER lesbar sein, nicht als Punkt. */
      const r = moon.r * .62;

      const ph = moonPhaseNow();
      const illum = (1 - Math.cos(ph * 6.283185307)) / 2;
      const sunX = (ph < .5 ? 1 : -1) * Math.sqrt(Math.max(0, 1 - Math.pow(2 * illum - 1, 2)));

      const px = Math.max(64, Math.round(r * 2 * 2.4));
      const key = `${px}|${sunX.toFixed(3)}|${moon.seed.toFixed(2)}`;
      if (key !== phobosKey) { renderPhobosTexture(px, sunX, moon.seed); phobosKey = key; }

      /* Nur ein sehr schwacher Hof — Phobos ist zu dunkel fuer mehr */
      drawHalo(g, x, y, r, r * 3.2, [
        [0, "rgb(210 200 190 / .045)"],
        [1, "rgb(210 200 190 / 0)"],
      ]);

      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(phobosTex, x - r, y - r, r * 2, r * 2);

      /* Deimos, der zweite Marsmond. Real misst er nur 2,5′ und liegt damit
         hart an der Aufloesungsgrenze des Auges — als reiner Punkt war er im
         Bild aber gar nicht als MOND lesbar. Er wird deshalb leicht
         ueberzeichnet: eine kleine Scheibe mit angedeuteter Phase, immer noch
         deutlich kleiner und dunkler als Phobos. Wie alle ausgedehnten
         Koerper flimmert er nicht. */
      const dx = x - moon.r * 5.5, dy = y + moon.r * 2.2;
      const dr = Math.max(1.6, r * .42);
      drawHalo(g, dx, dy, 0, dr * 5, [
        [0, "rgb(232 226 214 / .5)"],
        [1, "rgb(232 226 214 / 0)"],
      ]);
      g.fillStyle = "rgb(214 206 192 / .95)";
      g.beginPath(); g.arc(dx, dy, dr, 0, 6.283); g.fill();
      /* Nachtseite: derselbe Terminator wie bei Phobos, nur grob */
      g.fillStyle = "rgb(28 24 22 / .78)";
      g.beginPath();
      g.ellipse(dx - dr * (sunX > 0 ? .52 : -.52), dy, dr * .74, dr, 0, 0, 6.283);
      g.fill();
      g.fillStyle = "rgb(196 188 174 / .35)";
      g.beginPath(); g.arc(dx + dr * .22, dy - dr * .18, dr * .34, 0, 6.283); g.fill();
    }

    /* ============================================================
       Horizonte — drei Böden, einer je Theme

       Alles wird EINMAL gebacken. Bewegen darf sich nur der Glitzerpfad.

       Die Regeln, die über Realismus entscheiden:
       · Der Horizont wird NIE gezeichnet. Er entsteht als Kontrastgrenze
         zwischen zwei Verläufen. Eine gestrichene Linie ist das sicherste
         Erkennungszeichen für einen gemalten Horizont.
       · Das Meer ist IMMER dunkler als der Himmel — es spiegelt ihn ja nur.
         Und zwar stark nichtlinear: Wasser reflektiert bei senkrechtem Blick
         nur 2 %, erst bei streifendem Einfall wird es zum Spiegel
         (Fresnel/Schlick, R0 = 0.0204). Ein linearer Verlauf sieht sofort
         nach CSS-Gradient aus.
       · Tiefe entsteht über Verteilungsgesetze, nicht über Projektion:
         bei einer Ebene wächst die scheinbare GRÖSSE linear mit dem Abstand
         zur Horizontlinie, die DICHTE dagegen mit der dritten Potenz.
         Zieht man daraus die Umkehrfunktion, ergibt sich `u^0.25` als
         Stichprobenverteilung. Mit gleichverteiltem Zufall sieht der Boden
         wie eine Tapete aus.
       · Nachts versagt das Farbsehen (Purkinje). Der Marsboden ist bei Nacht
         fast achromatisch — die Wärme wird nur angedeutet, nicht ausgespielt.
       ============================================================ */
    const horizon = document.createElement("canvas");
    horizon.id = "horizon";
    horizon.setAttribute("aria-hidden", "true");
    canvas.parentNode.insertBefore(horizon, clouds.nextSibling);

    /* Eigene, transparente Ebene fuer den Glitzerpfad. Sonst muesste das Meer
       in jedem Frame neu gezeichnet werden, nur damit die Blitze verschwinden. */
    const glintLayer = document.createElement("canvas");
    glintLayer.id = "glints";
    glintLayer.setAttribute("aria-hidden", "true");
    horizon.parentNode.insertBefore(glintLayer, horizon.nextSibling);

    /* Requisiten (Palmen, Strandhafer, DJ-Pult) liegen auf einer eigenen
       Ebene UEBER dem Glitzer-Canvas. Grund: die Brandung laeuft animiert auf
       #glints, und ein Palmenstamm, der weiter vorne im Sand steht, kreuzt
       die Uferlinie im Bild — der Schaum lief bisher VOR dem Stamm durch.
       Diese Ebene wird wie #horizon nur einmal gebacken, kostet pro Frame
       also nichts ausser dem Kompositing. */
    const propLayer = document.createElement("canvas");
    propLayer.id = "props";
    propLayer.setAttribute("aria-hidden", "true");
    glintLayer.parentNode.insertBefore(propLayer, glintLayer.nextSibling);

    /* ---- Schnittkante fuer die Sterne ----
       Die bewegten Sterne schienen durch den oberen, halbdurchlaessigen Rand
       des Bodenbildes. Der frueher hier stehende Festwert HORIZON_Y = .775 war
       tot (er lag hinter einem `return;`) und traf die echte Bildoberkante
       ohnehin nicht: die liegt bei `h - dh`, und `dh` haengt vom
       Seitenverhaeltnis ab — zwischen 48 % und 100 % der Hoehe.

       Geschnitten wird per CSS-Maske, nicht per `destination-out` auf dem
       Canvas: der Canvas-Weg kostet in JEDEM Frame eine Vollbreiten-Fuellung
       ueber bis zu 52 % des Viewports. Die Maske dagegen ist ein einziger
       Schreibvorgang pro Resize, laeuft im GPU-Kompositing, bringt die weiche
       Rampe von selbst mit — und eine Regel erschlaegt #stars und #skyback
       gleichzeitig.

       Beide Werte sind Prozent der Viewporthoehe. 100/100 heisst "kein
       Schnitt": die Maske ist dann bis zur Unterkante voll deckend. */
    /* Der Boden deckt den Himmel ab — mit einem Verlauf auf der Bodenebene
       selbst, nicht mit einer CSS-Maske auf den Sternenebenen.

       Zuerst stand hier eine `mask-image`-Loesung: zwei Custom Properties auf
       <html>, eine Regel fuer #stars und #skyback. Sauber, aber GEMESSEN
       teuer — jede maskierte Vollbild-Ebene kostete auf dem Testgeraet rund
       4 bis 5 ms pro Frame, zusammen etwa 10 ms. Das ist die Haelfte eines
       60-Hz-Budgets fuer einen Effekt, der sich nie aendert.

       Der Ersatz ist aequivalent und kostet NICHTS pro Frame: #horizon liegt
       ohnehin ueber beiden Sternenebenen, also wird dort einfach der
       Seitengrund (--bg-void, dieselbe Farbe, die die Maske durchscheinen
       liesse) als Verlauf darueber gelegt. Das Ergebnis ist Pixel fuer Pixel
       dasselbe — body traegt eine FLACHE Hintergrundfarbe, keinen Verlauf —
       nur wird es einmal beim Backen gezeichnet statt in jedem Frame vom
       Compositor angewandt.

       `topPx` ist die Oberkante des Bodens, `fadePx` die Hoehe der Rampe
       darueber. Sie beginnt oberhalb der Kante, damit dort keine Linie
       stehen bleibt, wo die eingebackene Alpha-Rampe des Bildes noch
       durchlaessig ist. */
    function blockSky(g, topPx, fadePx) {
      if (!isFinite(topPx) || topPx >= h) return;
      /* Im Tag-Modus deckt der Abdeckverlauf gegen den HIMMEL ab, nicht gegen
         den Seitengrund: ueber der Bodenkante steht dort der Tag-Himmel, und
         --bg-void waere der (andersfarbige) Beton der Seite. Mit ihm bliebe
         genau die Naht stehen, die dieser Verlauf beseitigen soll. */
      const v = (dayMode() && !spaceDay())
        ? daySky().horizon
        : (getComputedStyle(html).getPropertyValue("--bg-void").trim() || "#07080e").slice(0, 7);
      /* Auf ganze Pixel runden: ein Rechteck mit gebrochener Oberkante wird
         antialiast, und diese eine halbdurchsichtige Zeile sass genau dort,
         wo der Verlauf schon voll deckend war — eine feine helle Linie quer
         durchs Bild, sichtbar nur auf hellem Boden. */
      const b = Math.round(topPx);
      const a = Math.max(0, Math.round(topPx - fadePx));
      const gr = g.createLinearGradient(0, a, 0, b);
      gr.addColorStop(0, v + "00");
      gr.addColorStop(1, v);
      g.fillStyle = gr;
      g.fillRect(0, a, w, b - a);
      g.fillStyle = v;
      g.fillRect(0, b, w, h - b);
    }

    /* Ober- und Unterkante der Wasserflaeche der gezeichneten Strandszene.
       Die Wellenlinien und der Glitzerpfad haengen daran (frueher am
       geloeschten Festwert HORIZON_Y). 0 = keine Szene. */
    let seaTop = 0, seaEnd = 0;
    /* Oberkante des Marsbodens in Geraetepixeln. Rover und Startrampe
       brauchen eine Standlinie; 0 heisst "kein Boden". */
    let groundTopY = 0;

    /* Höhenlinie mit Domain-Warp: ohne ihn verrät sich die Rauschperiode
       nach ein paar Sekunden Hinsehen. */
    function ridge(nz, x, scale, oct, seed) {
      const warp = fbm(nz, x / (scale * 3.1) + seed, seed * .61, 2);
      return fbm(nz, x / scale + warp * 1.6 + seed, seed * .37, oct);
    }

    /* Silhouettenzug zeichnen, mit hellem Streulichtsaum an der Oberkante */
    function ridgeBand(g, nz, seed, baseY, amp, scale, oct, fill, rimAlpha) {
      const pts = [];
      for (let x = 0; x <= w; x += 3 * DPR) {
        pts.push(x, Math.round(baseY - (ridge(nz, x, scale, oct, seed) - .5) * amp));
      }
      g.fillStyle = fill;
      g.beginPath(); g.moveTo(0, h);
      for (let i = 0; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
      g.lineTo(w, h); g.closePath(); g.fill();
      if (rimAlpha > 0) {
        g.strokeStyle = `rgb(190 200 225 / ${rimAlpha})`;
        g.lineWidth = 1 * DPR;
        g.beginPath();
        for (let i = 0; i < pts.length; i += 2) i === 0 ? g.moveTo(pts[0], pts[1]) : g.lineTo(pts[i], pts[i + 1]);
        g.stroke();
      }
    }

    /* ---- Boden ----
       Zurueck zur richtigen Aufteilung: Der interaktive Sternenhimmel bleibt
       der Hintergrund, ausgetauscht wird nur der Boden.

       Der erste Versuch scheiterte daran, dass ich den Uebergang zur LAUFZEIT
       einblenden wollte — Tonwert und Farbstich des Fotos passten nie zum
       gemalten Himmel, es blieb eine sichtbare Naht. Jetzt steckt der
       Uebergang IM Bild: die Aufnahmen sind dunkel gegradet und tragen einen
       eingebackenen Alpha-Verlauf, der nach oben in Transparenz auslaeuft.
       Damit kann zur Laufzeit gar keine Kante mehr entstehen — der Boden
       loest sich einfach in den Himmel auf, egal was dahinter steht.

       Quellen:
       · Mars   — Perseverance, Jezero-Krater, NASA/JPL-Caltech, gemeinfrei

       Space hat KEINEN Boden mehr. Das Theme ist wieder das, was es am Anfang
       war: reiner Nachthimmel. Das Erd-Foto war ausserdem das einzige Bild des
       Projekts mit Namensnennungspflicht (CC BY 4.0) — mit ihm faellt die
       letzte Lizenzauflage weg.
       Strand hat keinen Boden mehr AUS DEM BILD, sondern eine gezeichnete
       Szene (siehe paintBeach weiter unten). */
    const GROUNDS = {
      mars:   { night: "/img/ground-mars-night.webp",   day: "/img/ground-mars-day.webp"   },
    };
    const groundImgs = {};
    function loadGround(key, when) {
      const id = key + "-" + when;
      if (id in groundImgs) return groundImgs[id];
      groundImgs[id] = null;
      const im = new Image();
      im.decoding = "async";
      im.onload = () => { groundImgs[id] = im; paintHorizon(); };
      im.src = GROUNDS[key][when];
      return null;
    }

    function paintHorizon() {
      horizon.width = w; horizon.height = h;
      horizon.style.width = innerWidth + "px";
      horizon.style.height = innerHeight + "px";
      glintLayer.width = w; glintLayer.height = h;
      glintLayer.style.width = innerWidth + "px";
      glintLayer.style.top = "0px";
      glintLayer.style.height = innerHeight + "px";
      glintTop = 0;
      propLayer.width = w; propLayer.height = h;
      propLayer.style.width = innerWidth + "px";
      propLayer.style.height = innerHeight + "px";
      /* Leere Ebenen kosten trotzdem Kompositing: eine unbenutzte
         Vollbild-Canvas hat im Messlauf spuerbar Bildrate gekostet. Wer
         nichts traegt, wird abgeschaltet. */
      const th = html.dataset.theme || "space";
      const beachOn = groundOn() && th === "strand";
      const marsOn = groundOn() && th === "mars";
      propLayer.style.display = beachOn ? "block" : "none";
      /* Die bewegte Ebene traegt am Strand Brandung und Glitzer, auf dem Mars
         Rover und Rakete. Im Space-Theme gibt es nichts Bewegtes am Boden —
         dort bleibt sie aus, denn auch eine leere Vollbild-Canvas kostet
         Kompositing. */
      glintLayer.style.display = (beachOn || marsOn) ? "block" : "none";
      const g = horizon.getContext("2d");
      g.clearRect(0, 0, w, h);
      propLayer.getContext("2d").clearRect(0, 0, w, h);
      /* Ohne Boden bleibt der Himmel unangetastet — der Abdeckverlauf wird
         erst weiter unten gezeichnet, wenn wirklich ein Boden kommt. */
      seaTop = seaEnd = 0;
      groundTopY = 0;
      surf = null;
      if (!groundOn()) return;

      const key = html.dataset.theme || "space";
      const when = dayMode() ? "day" : "night";
      /* Wache: nicht jedes Theme hat noch ein Bodenbild. Space ist reiner
         Himmel, Strand wird gezeichnet. Ohne diese Wache griffe der Code auf
         GROUNDS["space"] zu, das es nicht mehr gibt. */
      if (key === "strand") { paintBeach(g); return; }
      if (!GROUNDS[key]) return;
      const im = loadGround(key, when) || groundImgs[key + "-" + when];
      if (!im) return;

      /* Der Boden fuellt die Breite; die Hoehe folgt dem Seitenverhaeltnis des
         Bildes. Eine Mindesthoehe zu erzwingen war ein Fehler — schmale Streifen
         wurden dadurch um Faktor 2,5 hochgezoomt und matschig. Nur nach oben
         wird gedeckelt, damit der Himmel die Szene behaelt. */
      let scale = w / im.naturalWidth;
      if (im.naturalHeight * scale > h * .52) scale = (h * .52) / im.naturalHeight;
      const dw = im.naturalWidth * scale;
      const dh = im.naturalHeight * scale;
      /* Echte Bildoberkante. Die Rampe beginnt 20 % der Bildhoehe DARUEBER —
         genau dort, wo die ins Bild eingebackene Alpha-Rampe noch
         durchlaessig ist. Endete sie erst an der Kante selbst, bliebe dort
         eine sichtbare Linie stehen. */
      blockSky(g, h - dh, dh * .20);
      groundTopY = h - dh;
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(im, (w - dw) / 2, h - dh, dw, dh);
      /* Ohne laufende Schleife wuerde die Marsszene schlicht FEHLEN: Rover
         und Rakete liegen auf der bewegten Ebene, und die wird in Stufe
         "Aus" nie gezeichnet. Also einmal in die stehende Ebene malen —
         statisch, aber vollstaendig. */
      if (html.dataset.fx === "s" || reduced()) paintMarsFX(g, 0, env.scrollP || 0, 16);
    }

    /* ============================================================
       Strandszene — gezeichnet, nicht fotografiert

       Das Foto ist raus, die gemalte Szene kommt zurueck. Sie wurde zweimal
       als "billig" abgelehnt; diesmal mit den Mitteln, die den Unterschied
       ausmachen:

       · FARBSTICHTRENNUNG. Licht warm, Schatten kalt-violett, NIE neutralgrau.
         Diese eine Regel trennt "gerendert" von "Clipart" zuverlaessiger als
         jede Filtertechnik. Ein Sandschatten ist nie ein dunkleres Sandbraun.
       · VERLAEUFE MIT VIER BIS SECHS STOPPS an UNGLEICHMAESSIGEN Positionen.
         Zwei-Stopp-Verlaeufe sind das sicherste Billig-Signal.
       · LICHTKANTE NUR AUF DER LICHTZUGEWANDTEN SEITE, nie eine gleichmaessige
         Kontur ringsum.
       · ZWEI SCHATTEN je Objekt: ein sehr kurzer, harter Kontaktschatten an
         der Auflagekante — das ist der Unterschied zwischen "schwebt" und
         "steht" — plus ein langer weicher Formschatten vom Licht weg.
       · DIE DUNKLE BANDE AN DER WASSERKANTE (nasser Sand). Sie fehlt in fast
         jedem gezeichneten Strand und ist der groesste Realismusgewinn fuer
         den geringsten Aufwand.

       Warum Canvas 2D und nicht SVG: der Glitzer-Code liegt hier schon, die
       Ebenentrennung (#horizon einmal gebacken, #glints pro Frame) auch,
       animierte feTurbulence ist pro Pixel UND Frame CPU-gebunden und fuer
       vollflaechige Hintergruende disqualifiziert — und die Szene muss
       zwischen Sternen und Schnittkante liegen, was der Canvas-Stapel
       ohnehin schon regelt.

       Alles hier wird EINMAL in #horizon gebacken. Pro Frame laeuft nur, was
       sich wirklich bewegt: Wellenstriche und Glitzerpfad auf #glints.
       ============================================================ */
    /* Eigenes Rauschfeld fuer die Szene. Es wird einmal erzeugt, damit die
       Wasserkante bei jedem Resize dieselbe Form behaelt statt zu springen. */
    const beachNz = noise2(23);

    const BEACH = {
      night: {
        /* Die Nacht ist DUNKEL. Nicht "blau eingefaerbter Tag": bei
           Mondlicht liegt die Leuchtdichte des Sandes rund vier Groessen-
           ordnungen unter Tageslicht, das Farbsehen setzt aus (Purkinje) und
           alles Ferne verschwindet. Genau deshalb funktioniert die Szene
           ueber SILHOUETTEN — es bleibt fast nur, was sich gegen Wasser und
           Himmel abzeichnet.
           Wasserkoerper, opak: Tuerkis am Ufer ueber Mittelblau zu Tiefblau
           am Horizont. Sechs Stopps an UNGLEICHMAESSIGEN Positionen. */
        body: [[0, "18 50 54"], [.13, "14 41 52"], [.31, "11 31 46"],
               [.55, "8 22 38"], [.79, "6 15 30"], [1, "5 11 24"]],
        /* reflMax ist nicht frei waehlbar: es entscheidet, ob am Horizont
           eine Linie steht. Meer und Himmel muessen sich dort im Tonwert
           TREFFEN — das Meer eine Spur dunkler, weil es den Himmel nur
           spiegelt und dabei Licht schluckt. */
        sky: "36 54 84", reflMax: .34,
        haze: "32 54 88", hazeA: .44,
        cap: "26 42 70", capA: .62,
        shallow: "52 122 118", shallowA: .26,
        glare: "196 218 252", glareA: .18,
        spec: "222 236 255", specA: .95,
        skyHor: "38 58 92", skyZen: "6 11 24",
        /* Sandgrund unter Wasser und Streufarbe des tiefen Wassers —
           daraus baut sich die Wasserfarbe nach Beer-Lambert auf. */
        bed: "58 78 74", deep: "5 11 26",
        wet: ["24 23 34", "13 12 21"], wetRim: .26,
        /* Der Sand faellt zum Betrachter hin fast ins Schwarze. Hell bleibt
           nur der schmale Streifen, den das Wasser zurueckwirft — davor
           stehen die Silhouetten. */
        sand: [[0, "34 31 40"], [.22, "43 38 44"], [.61, "28 25 31"], [1, "13 12 18"]],
        grain: ["132 128 128", "9 8 15"],
        foam: "216 232 248",
        warmPool: "186 132 76", warmA: .045,
        dark: "5 5 10", shadow: "12 9 24",
        rimWarm: "255 192 124", rimCool: "140 236 255",
        /* Mondlicht ist KALT. Die Palmen bekommen deshalb einen silbrigen
           Saum, kein goldenes. Warm bleibt nur, was tatsaechlich eine warme
           Quelle hat: Pult, Boxen und die Lichterkette. */
        rimCold: "170 198 232",
        rimA: .42,
      },
      day: {
        body: [[0, "104 206 190"], [.13, "68 172 178"], [.31, "44 134 168"],
               [.55, "30 100 150"], [.79, "22 74 128"], [1, "18 58 108"]],
        sky: "150 186 220", reflMax: .30,
        haze: "168 196 220", hazeA: .52,
        cap: "70 88 112", capA: .66,
        shallow: "140 218 200", shallowA: .38,
        glare: "255 250 232", glareA: .20,
        spec: "255 253 244", specA: .80,
        skyHor: "176 202 226", skyZen: "58 100 152",
        bed: "178 188 152", deep: "8 42 88",
        wet: ["122 112 116", "88 80 90"], wetRim: .46,
        sand: [[0, "170 150 130"], [.22, "198 176 148"], [.61, "214 192 160"], [1, "180 156 130"]],
        grain: ["252 240 216", "88 76 88"],
        foam: "246 251 252",
        warmPool: "255 214 150", warmA: .10,
        dark: "52 46 62", shadow: "46 40 74",
        rimWarm: "255 214 160", rimCool: "170 245 255",
        rimCold: "224 238 252",
        rimA: .34,
      },
    };

    /* Kleiner deterministischer Zufall. Die Requisiten sollen bei jedem
       Resize gleich aussehen und nicht neu wuerfeln — mit Math.random()
       wanderten Palmen und Steine bei jeder Fensteraenderung. */
    function rng(seed) {
      let a = seed >>> 0;
      return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    /* Additiver Radialverlauf. Ersatz fuer Verlaufsnetze (gradient meshes),
       die es im Web nicht gibt: drei bis vier grosse, weiche Lichtinseln mit
       `lighter` bei niedriger Deckkraft bringen die Flaechenmodulation, die
       ein einzelner Linearverlauf nie hat. */
    function lightPool(g, cx, cy, r, flat, col, a) {
      lightPoolMode(g, "lighter", cx, cy, r, flat, col, a);
    }
    function lightPoolMode(g, mode, cx, cy, r, flat, col, a) {
      g.save();
      g.globalCompositeOperation = mode;
      g.translate(cx, cy);
      g.scale(1, flat);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
      gr.addColorStop(0,   `rgb(${col} / ${a.toFixed(3)})`);
      gr.addColorStop(.26, `rgb(${col} / ${(a * .48).toFixed(3)})`);
      gr.addColorStop(.60, `rgb(${col} / ${(a * .14).toFixed(3)})`);
      gr.addColorStop(1,   `rgb(${col} / 0)`);
      g.fillStyle = gr;
      g.beginPath(); g.arc(0, 0, r, 0, 6.283); g.fill();
      g.restore();
    }

    /* Zwei Schatten je Objekt — die Regel, an der "steht" und "schwebt"
       auseinandergehen:
       1. ein sehr kurzer, HARTER Kontaktschatten direkt an der Auflagekante,
       2. ein langer, weicher Formschatten vom Licht weg.
       Beide kalt-violett. Ein Schatten in dunklerem Sandbraun ist das
       zuverlaessigste Clipart-Signal ueberhaupt. */
    function twoShadows(g, P, cx, baseY, size, dir, longF) {
      g.save();
      g.translate(cx - dir * size * longF, baseY + size * .012);
      g.scale(1, .15);
      const fs = g.createRadialGradient(0, 0, 0, 0, 0, size * (1.3 + longF));
      fs.addColorStop(0,   `rgb(${P.shadow} / .48)`);
      fs.addColorStop(.34, `rgb(${P.shadow} / .28)`);
      fs.addColorStop(.68, `rgb(${P.shadow} / .09)`);
      fs.addColorStop(1,   `rgb(${P.shadow} / 0)`);
      g.fillStyle = fs;
      g.beginPath(); g.arc(0, 0, size * (1.3 + longF), 0, 6.283); g.fill();
      g.restore();

      g.save();
      g.translate(cx, baseY + size * .004);
      g.scale(1, .075);
      const cs = g.createRadialGradient(0, 0, 0, 0, 0, size * .5);
      cs.addColorStop(0,  `rgb(${P.shadow} / .85)`);
      cs.addColorStop(.7, `rgb(${P.shadow} / .55)`);
      cs.addColorStop(1,  `rgb(${P.shadow} / 0)`);
      g.fillStyle = cs;
      g.beginPath(); g.arc(0, 0, size * .5, 0, 6.283); g.fill();
      g.restore();
    }

    /* ---- Palme ----
       Nachts ist eine Palme eine SILHOUETTE, kein Baum: das Auge sieht die
       Kontur, nicht die Struktur. Sie wird deshalb als geschlossene dunkle
       Form gebaut und bekommt Licht NUR an der mondzugewandten Kante. Wer
       nachts Blattadern malt, hat ein Icon gezeichnet.

       Was die Form glaubwuerdig macht, sind drei Dinge, die Icon-Palmen alle
       weglassen: der Stamm ist gebogen und verjuengt sich, die Wedel haengen
       unterschiedlich weit durch (die aelteren unten fast senkrecht), und
       ihre Raender sind gefiedert statt glatt. */
    function paintPalm(g, P, x, groundY, ht, lean, seed, lightX) {
      const R = rng(seed);
      const dir = lightX >= x ? 1 : -1;
      const tx = x + lean * ht, ty = groundY - ht;

      twoShadows(g, P, x, groundY, ht * .22, dir, 1.5);

      /* --- Stamm: quadratische Biegung, verjuengt, mit Narbenringen --- */
      const N = 20, L = [], Rt = [];
      const at = u => [
        x + 2 * (1 - u) * u * (lean * ht * .18) + u * u * (lean * ht),
        groundY - ht * (2 * (1 - u) * u * .60 + u * u),
      ];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const [px, py] = at(u);
        const [qx, qy] = at(Math.min(1, u + .02));
        const dx = qx - px, dy = qy - py, dl = Math.hypot(dx, dy) || 1;
        const wd = ht * (.042 - .024 * Math.pow(u, .7)) * (1 + .10 * Math.sin(u * 19));
        L.push([px - (dy / dl) * wd, py + (dx / dl) * wd]);
        Rt.push([px + (dy / dl) * wd, py - (dx / dl) * wd]);
      }
      g.fillStyle = `rgb(${P.dark})`;
      g.beginPath();
      g.moveTo(L[0][0], L[0][1]);
      for (const q of L) g.lineTo(q[0], q[1]);
      for (let i = Rt.length - 1; i >= 0; i--) g.lineTo(Rt[i][0], Rt[i][1]);
      g.closePath(); g.fill();

      /* --- Wedel. Jeder ist ein Polygon: auf der Aussenseite hinaus, auf der
         Innenseite zurueck, beide Raender gezackt (Fiederblaettchen). --- */
      /* Kronenmasse: der dunkle Ballen, in dem die Wedel zusammenlaufen.
         Ohne ihn strahlen die Blaetter aus einem Punkt und die Palme liest
         als Feuerwerk. */
      g.beginPath();
      g.ellipse(tx, ty + ht * .015, ht * .052, ht * .036, lean * .5, 0, 6.283);
      g.fill();

      const nF = 7 + (R() * 3 | 0);
      const fronds = [];
      g.lineCap = "round";
      g.lineJoin = "round";
      for (let f = 0; f < nF; f++) {
        const a0 = -Math.PI * (.04 + .92 * ((f + .5) / nF)) + (R() - .5) * .34;
        const len = ht * (.44 + R() * .34);
        /* Der Durchhang streut stark: die aelteren Wedel haengen fast
           senkrecht, die jungen stehen noch. Gleich stark gebogene Wedel sind
           das Icon-Merkmal. */
        const droop = .30 + Math.pow(R(), .6) * 1.25;
        const back = R() < .34;                       /* nach hinten weisend */
        const spine = u => [
          tx + Math.cos(a0) * len * u,
          ty + Math.sin(a0) * len * u * .62 + Math.pow(u, 1.9) * len * droop,
        ];
        /* Mittelrippe */
        g.strokeStyle = `rgb(${P.dark})`;
        g.lineWidth = Math.max(1, len * .016);
        g.beginPath();
        for (let i = 0; i <= 16; i++) {
          const q = spine(i / 16);
          i === 0 ? g.moveTo(q[0], q[1]) : g.lineTo(q[0], q[1]);
        }
        g.stroke();
        /* Fiederblaettchen: viele duenne, schraeg nach hinten stehende
           Striche. Ein gezackter Umriss allein liest als Raupe — es sind die
           EINZELNEN Blaettchen, an denen das Auge die Palme erkennt. */
        const K = 22;
        for (let i = 1; i <= K; i++) {
          const u = i / K;
          const [px, py] = spine(u);
          const [qx, qy] = spine(Math.min(1, u + .04));
          const ta = Math.atan2(qy - py, qx - px);
          const ll = len * .21 * Math.sin(Math.PI * Math.pow(u, .55));
          g.lineWidth = Math.max(1, len * .011 * (1.1 - .5 * u));
          for (const sgn of [-1, 1]) {
            const la = ta + sgn * (1.02 + .22 * Math.sin(u * 9 + f));
            g.beginPath();
            g.moveTo(px, py);
            g.quadraticCurveTo(px + Math.cos(la) * ll * .6, py + Math.sin(la) * ll * .6,
              px + Math.cos(la) * ll * .92 + Math.cos(ta) * ll * .34,
              py + Math.sin(la) * ll * .92 + Math.sin(ta) * ll * .34 + ll * .22);
            g.stroke();
          }
        }
        fronds.push({ spine, len, a0, back });
      }

      /* --- Kokosnuesse: drei kleine Kugeln in der Krone. Ohne sie liest die
         Krone als Farn. --- */
      for (let i = 0; i < 3; i++) {
        const a = -1.9 + i * .55, r = ht * .026;
        g.beginPath();
        g.arc(tx + Math.cos(a) * ht * .045, ty + ht * .035 + Math.sin(a) * ht * .02, r, 0, 6.283);
        g.fill();
      }

      /* --- Streiflicht, NUR auf der mondzugewandten Seite. Keine Kontur
         ringsum — die ist das Clipart-Signal schlechthin. Und kalt: ein
         goldener Saum an einem mondbeschienenen Stamm liest sofort als
         nachgezogene Outline. --- */
      g.strokeStyle = `rgb(${P.rimCold} / ${(P.rimA * .40).toFixed(3)})`;
      g.lineWidth = Math.max(1, ht * .005);
      g.lineJoin = "round";
      const side = dir > 0 ? Rt : L;
      g.beginPath();
      g.moveTo(side[0][0], side[0][1]);
      for (const q of side) g.lineTo(q[0], q[1]);
      g.stroke();
      /* Streiflicht auf den Wedeln: nur die Mittelrippen der lichtzugewandten
         Seite, und nur ihr oberes Stueck. Alles andere bleibt Silhouette. */
      g.strokeStyle = `rgb(${P.rimCold} / ${(P.rimA * .26).toFixed(3)})`;
      g.lineWidth = Math.max(1, ht * .004);
      for (const fr of fronds) {
        if (Math.cos(fr.a0) * dir < -.10) continue;
        g.beginPath();
        for (let i = 0; i <= 12; i++) {
          const q = fr.spine(i / 12 * .82);
          i === 0 ? g.moveTo(q[0], q[1] - ht * .004) : g.lineTo(q[0], q[1] - ht * .004);
        }
        g.stroke();
      }
    }

    /* ---- Strandhafer ----
       Vorher: drei bis sieben gerade Striche aus einem Punkt. Das ist ein
       Icon fuer "Gras", kein Gras. Was ein Bueschel ausmacht:
       · Die Halme entspringen NICHT einem Punkt, sondern einer kleinen
         Flaeche — ein Horst hat Durchmesser.
       · Jeder Halm knickt einmal um und haengt danach ueber; ein Bogen
         ueber die volle Laenge sieht nach Sichel aus.
       · Ein Teil traegt Samenaehren. Sie sind das, woran das Auge
         Strandhafer erkennt.
       · Die Halme sind unterschiedlich lang und unterschiedlich dunkel —
         die hinteren stehen im Schatten der vorderen. */
    function paintGrass(g, P, x, baseY, ht, seed, lightX) {
      const R = rng(seed);
      const dir = lightX >= x ? 1 : -1;
      const n = 7 + (R() * 8 | 0);
      /* Kontaktschatten des Horsts — ohne ihn schwebt auch ein Grasbueschel */
      g.fillStyle = `rgb(${P.shadow} / .40)`;
      g.beginPath();
      g.ellipse(x + dir * ht * .06, baseY, ht * .30, ht * .055, 0, 0, 6.283);
      g.fill();
      g.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const bx = x + (R() - .5) * ht * .30;          /* Horst hat Ausdehnung */
        const side = R() < .5 ? -1 : 1;
        const len = ht * (.55 + R() * .75);
        const bend = (.20 + R() * .55) * side;
        const knee = .48 + R() * .22;                  /* Knickpunkt */
        const kx = bx + bend * len * .30, ky = baseY - len * knee;
        const tx = bx + bend * len * 1.25, ty = baseY - len * (.72 + R() * .22);
        g.strokeStyle = `rgb(${P.dark} / ${(.55 + R() * .45).toFixed(2)})`;
        g.lineWidth = Math.max(1, ht * (.032 + R() * .022));
        g.beginPath();
        g.moveTo(bx, baseY);
        g.quadraticCurveTo(bx + bend * len * .10, baseY - len * knee * .6, kx, ky);
        g.quadraticCurveTo(kx + (tx - kx) * .5, ky - len * .10, tx, ty);
        g.stroke();
        /* Samenaehre: schmale Spindel in Halmrichtung */
        if (R() < .38) {
          const ax = Math.atan2(ty - ky, tx - kx);
          g.save(); g.translate(tx, ty); g.rotate(ax);
          g.fillStyle = `rgb(${P.dark} / .85)`;
          g.beginPath(); g.ellipse(ht * .08, 0, ht * .10, ht * .022, 0, 0, 6.283); g.fill();
          g.restore();
        }
        /* Streiflicht nur auf den lichtzugewandten Halmen, nur oben */
        if (side === dir && R() < .5) {
          g.strokeStyle = `rgb(${P.rimCold} / ${(P.rimA * .22).toFixed(3)})`;
          g.lineWidth = Math.max(1, ht * .018);
          g.beginPath();
          g.moveTo(kx, ky);
          g.quadraticCurveTo(kx + (tx - kx) * .5, ky - len * .10, tx, ty);
          g.stroke();
        }
      }
    }

    /* Duenenbusch: eine kompakte Masse aus vielen kurzen Strichen. Zwei
       davon reichen, um dem Strand Vordergrund zu geben — eine leere
       Sandflaeche liest immer als Flaeche, nie als Ort. */
    function paintBush(g, P, x, baseY, rad, seed, lightX) {
      const R = rng(seed);
      const dir = lightX >= x ? 1 : -1;
      twoShadows(g, P, x, baseY, rad * 1.5, dir, .7);
      const n = 90 + (R() * 60 | 0);
      g.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * (.05 + .90 * R());
        const rr = rad * (.25 + Math.pow(R(), .6) * .95);
        const ex = x + Math.cos(a) * rr, ey = baseY + Math.sin(a) * rr * .72;
        const lit = Math.cos(a) * dir > .25 && ey < baseY - rad * .35;
        g.strokeStyle = lit && R() < .28
          ? `rgb(${P.rimCold} / ${(P.rimA * .30).toFixed(3)})`
          : `rgb(${P.dark} / ${(.55 + R() * .45).toFixed(2)})`;
        g.lineWidth = Math.max(1, rad * .045);
        g.beginPath();
        g.moveTo(x + Math.cos(a) * rr * .25, baseY + Math.sin(a) * rr * .18);
        g.quadraticCurveTo((x + ex) / 2 + (R() - .5) * rad * .2,
                           (baseY + ey) / 2, ex, ey);
        g.stroke();
      }
    }

    /* ---- DJ-Pult ----
       Es gibt KEIN brauchbares freies DJ-Pult: game-icons.net, Openclipart
       und Wikimedia Commons durchgesehen, null verwendbare Treffer. Also
       gezeichnet. Die Silhouetten von game-icons.net sind zweifarbige
       Flat-Icons und taugen NUR als Proportionsvorlage (Pultbreite zu
       Geraetehoehe rund 8:1, Tischhoehe knapp die halbe Breite). Nichts davon
       ist eingebettet — sonst haenge sofort wieder eine Namensnennungspflicht
       (CC BY 3.0) am Projekt, die B3 gerade abgeschafft hat.

       Was ein gezeichnetes Pult von einem Icon trennt:
       · Die PLATTENOBERSEITE ist sichtbar (hinten schmaler als vorn). Ohne
         diese Flaeche bleibt jedes Pult ein Rechteck.
       · Die Geraete stehen DARAUF, mit eigener gekippter Deckflaeche.
       · Jogwheel und Fader werden nur ANGEDEUTET, und nur auf der Lichtseite.
         Eine geschlossene Kontur ringsum ist das Clipart-Signal schlechthin. */
    function paintBooth(g, P, cx, baseY, bw, lightX) {
      const dir = lightX >= cx ? 1 : -1;
      const legH = bw * .42;
      const topY = baseY - legH;          /* Vorderkante der Platte */
      const dd = bw * .105;               /* Tiefe der Platte in der Ansicht */
      const backY = topY - dd;
      const midY = topY - dd * .5;
      const rim = Math.max(1, bw * .009);
      const dark = P.dark;

      twoShadows(g, P, cx, baseY, bw, dir, .62);

      /* --- Frontschuerze. Kein reines Schwarz: eine Flaeche, die gar kein
         Licht abbekommt, liest als Loch im Bild. --- */
      const sk = g.createLinearGradient(0, topY, 0, baseY);
      sk.addColorStop(0,   `rgb(${dark})`);
      sk.addColorStop(.35, `rgb(${P.shadow} / .55)`);
      sk.addColorStop(1,   `rgb(${dark})`);
      g.fillStyle = `rgb(${dark})`;
      g.beginPath();
      g.moveTo(cx - bw * .46, topY); g.lineTo(cx + bw * .46, topY);
      g.lineTo(cx + bw * .50, baseY); g.lineTo(cx - bw * .50, baseY);
      g.closePath(); g.fill();
      g.fillStyle = sk; g.fill();
      /* Zwei Boecke andeuten: eine durchgehend schwarze Platte ist ein Loch
         im Bild, kein Moebel. */
      g.strokeStyle = `rgb(${P.rimCold} / ${(P.rimA * .16).toFixed(3)})`;
      g.lineWidth = Math.max(1, bw * .008);
      for (const q of [-.30, .30]) {
        g.beginPath();
        g.moveTo(cx + bw * q, topY + legH * .12);
        g.lineTo(cx + bw * q * 1.14, baseY);
        g.stroke();
      }

      /* --- Plattenoberseite: der Perspektivbeweis --- */
      g.fillStyle = `rgb(${P.rimCold} / ${(P.rimA * .16).toFixed(3)})`;
      g.beginPath();
      g.moveTo(cx - bw * .44, backY); g.lineTo(cx + bw * .44, backY);
      g.lineTo(cx + bw * .50, topY);  g.lineTo(cx - bw * .50, topY);
      g.closePath(); g.fill();
      g.fillStyle = `rgb(${dark} / .82)`; g.fill();

      /* --- Geraete: zwei CDJ und ein Mixer --- */
      const unit = (ux, uw, uh, kind) => {
        const bY = midY, tY = midY - uh;
        g.fillStyle = `rgb(${dark})`;
        g.beginPath();
        g.moveTo(ux - uw * .46, tY); g.lineTo(ux + uw * .46, tY);
        g.lineTo(ux + uw * .50, bY); g.lineTo(ux - uw * .50, bY);
        g.closePath(); g.fill();
        const fd = uh * .55;
        g.fillStyle = `rgb(${P.rimCool} / .07)`;
        g.beginPath();
        g.moveTo(ux - uw * .42, tY - fd); g.lineTo(ux + uw * .42, tY - fd);
        g.lineTo(ux + uw * .46, tY); g.lineTo(ux - uw * .46, tY);
        g.closePath(); g.fill();

        if (kind === "cdj") {
          /* Jogwheel nur als Teilbogen auf der Lichtseite. Eine geschlossene
             Ellipse las sich als aufgemalter Kreis. */
          g.strokeStyle = `rgb(${P.rimCool} / .32)`;
          g.lineWidth = Math.max(1, uw * .030);
          g.beginPath();
          g.ellipse(ux - uw * .10, tY - fd * .40, uw * .16, fd * .30, 0,
                    dir > 0 ? -1.3 : 1.85, dir > 0 ? 1.3 : 4.45);
          g.stroke();
          /* Display sitzt HINTER dem Wheel, nicht daneben */
          g.fillStyle = `rgb(${P.rimCool} / .42)`;
          g.fillRect(ux + uw * .10, tY - fd * .88, uw * .22, Math.max(1, fd * .22));
        } else {
          g.strokeStyle = `rgb(${P.rimCool} / .30)`;
          g.lineWidth = Math.max(1, uw * .035);
          for (let i = 0; i < 4; i++) {
            const fx = ux + (i - 1.5) * uw * .21;
            g.beginPath();
            g.moveTo(fx, tY - fd * .78); g.lineTo(fx, tY - fd * .20);
            g.stroke();
          }
          const leds = ["229 194 92", "111 201 232", "232 122 102"];
          for (let i = 0; i < 3; i++) {
            g.fillStyle = `rgb(${leds[i]} / .9)`;
            g.beginPath();
            g.arc(ux + (i - 1) * uw * .26, tY - fd * .92, Math.max(.8, uw * .045), 0, 6.283);
            g.fill();
          }
        }
        g.strokeStyle = `rgb(${P.rimWarm} / ${(P.rimA * .34).toFixed(2)})`;
        g.lineWidth = rim;
        g.beginPath();
        g.moveTo(ux + dir * uw * .46, tY - fd);
        g.lineTo(ux + dir * uw * .50, bY);
        g.stroke();
      };
      const uw = bw * .30, mw = bw * .24, gh = bw * .085;
      unit(cx - bw * .33, uw, gh, "cdj");
      unit(cx + bw * .33, uw, gh, "cdj");
      unit(cx, mw, gh * .84, "mix");

      /* Vorderkante der Platte: das einzige harte Licht am Pult. Warm, weil
         es von der Lichterkette darueber kommt — nicht vom Mond. */
      g.strokeStyle = `rgb(${P.rimWarm} / ${(P.rimA * .40).toFixed(2)})`;
      g.lineWidth = rim * 1.2;
      g.beginPath();
      g.moveTo(cx - bw * .50, topY); g.lineTo(cx + bw * .50, topY);
      g.stroke();
      g.strokeStyle = `rgb(${P.rimWarm} / ${(P.rimA * .22).toFixed(2)})`;
      g.lineWidth = rim;
      g.beginPath();
      g.moveTo(cx + dir * bw * .50, topY);
      g.lineTo(cx + dir * bw * .50, baseY * .5 + topY * .5);
      g.stroke();

      lightPool(g, cx, midY - gh, bw * .90, .50, P.rimCool, .11);
      lightPool(g, cx, topY, bw * .70, .55, P.rimWarm, .07);
    }

    /* Boxenstapel: Bass unten, Top oben. Die beiden Chassis sind das, woran
       eine PA im Gegenlicht ueberhaupt erkennbar ist — als glatte Kiste liest
       sie als Kuehlschrank. */
    function paintStack(g, P, cx, baseY, bwid, bht, lightX) {
      const dir = lightX >= cx ? 1 : -1;
      twoShadows(g, P, cx, baseY, bwid * 1.5, dir, .8);
      const parts = [[bht * .56, bwid, 0, "bass"], [bht * .40, bwid * .86, bht * .56, "top"]];
      for (const [ph, pw, off, kind] of parts) {
        const yb = baseY - off, yt = yb - ph;
        g.fillStyle = `rgb(${P.dark})`;
        g.beginPath();
        g.moveTo(cx - pw * .44, yt); g.lineTo(cx + pw * .44, yt);
        g.lineTo(cx + pw * .50, yb); g.lineTo(cx - pw * .50, yb);
        g.closePath(); g.fill();
        /* Chassis nur als Bogen auf der Lichtseite — eine volle Ellipse waere
           eine aufgemalte Kontur, und die verraet jedes Icon. */
        g.strokeStyle = `rgb(${P.rimCold} / ${(P.rimA * .30).toFixed(2)})`;
        g.lineWidth = Math.max(1, bwid * .035);
        g.beginPath();
        if (kind === "bass")
          g.ellipse(cx, (yt + yb) / 2, pw * .28, ph * .30, 0,
                    dir > 0 ? -1.25 : 1.9, dir > 0 ? 1.25 : 4.4);
        else
          g.ellipse(cx, yt + ph * .38, pw * .22, ph * .22, 0,
                    dir > 0 ? -1.25 : 1.9, dir > 0 ? 1.25 : 4.4);
        g.stroke();
        g.strokeStyle = `rgb(${P.rimWarm} / ${(P.rimA * .30).toFixed(2)})`;
        g.lineWidth = Math.max(1, bwid * .026);
        g.beginPath();
        g.moveTo(cx + (dir > 0 ? -pw * .10 : pw * .10), yt);
        g.lineTo(cx + dir * pw * .44, yt);
        g.lineTo(cx + dir * pw * .50, yt + ph * .45);
        g.stroke();
      }
    }

    /* Lichterkette. Die Schnur haengt als Kettenlinie durch (cosh), nicht als
       Kreisbogen — den Unterschied sieht das Auge sofort, auch wenn es ihn
       nicht benennen kann. */
    function paintLights(g, P, x0, y0, x1, y1, sag) {
      const N = 46;
      const yAt = u => y0 + (y1 - y0) * u
        + sag * (Math.cosh((u - .5) * 3.2) - Math.cosh(1.6)) / (1 - Math.cosh(1.6)) * -1 + sag;
      const xAt = u => x0 + (x1 - x0) * u;
      g.strokeStyle = `rgb(${P.dark} / .8)`;
      g.lineWidth = Math.max(1, sag * .012);
      g.beginPath();
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        i === 0 ? g.moveTo(xAt(u), yAt(u)) : g.lineTo(xAt(u), yAt(u));
      }
      g.stroke();
      const R = rng(9911);
      for (let i = 1; i < 18; i++) {
        const u = i / 18;
        const x = xAt(u), y = yAt(u) + sag * .05;
        const a = .55 + R() * .45;
        const gr = g.createRadialGradient(x, y, 0, x, y, sag * .10);
        gr.addColorStop(0, `rgb(255 208 140 / ${(a * .55).toFixed(2)})`);
        gr.addColorStop(1, "rgb(255 208 140 / 0)");
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, sag * .10, 0, 6.283); g.fill();
        g.fillStyle = `rgb(255 226 178 / ${a.toFixed(2)})`;
        g.beginPath(); g.arc(x, y, Math.max(.9, sag * .016), 0, 6.283); g.fill();
      }
    }

    /* Nahtlos kachelbares Steigungsfeld fuer die Kraeuselwelle.
       GANZZAHLIGE Frequenzvektoren ueber die Kachel garantieren, dass sie
       sich schliesst; zufaellige Phasen und ein Amplitudenabfall ~1/|k|^1.7
       ergeben ein realistisches Wellenspektrum. Gespeichert wird gleich die
       Steigung, nicht die Hoehe. Wird einmal je Groesse gebaut. */
    let chopCache = null;
    function beachChop(CN) {
      if (chopCache && chopCache.n === CN) return chopCache.d;
      const d = new Float32Array(CN * CN * 2);
      const R = rng(31337);
      const comps = [];
      for (let c = 0; c < 26; c++) {
        const nx = Math.round((R() - .5) * 24), nz = Math.round((R() - .5) * 24);
        const m = Math.hypot(nx, nz);
        if (m < 1.2 || m > 13) continue;
        comps.push({ nx, nz, a: 1 / Math.pow(m, 1.7), ph: R() * 6.283 });
      }
      let mx = 1e-6;
      for (let b = 0; b < CN; b++) {
        for (let a = 0; a < CN; a++) {
          let sx = 0, sz = 0;
          for (const c of comps) {
            const ph = 6.283185 * (c.nx * a / CN + c.nz * b / CN) + c.ph;
            const cv = Math.cos(ph) * c.a * 6.283185;
            sx += cv * c.nx; sz += cv * c.nz;
          }
          const o = (b * CN + a) * 2;
          d[o] = sx; d[o + 1] = sz;
          const m2 = Math.abs(sx) + Math.abs(sz);
          if (m2 > mx) mx = m2;
        }
      }
      for (let i = 0; i < d.length; i++) d[i] /= mx;      /* auf +-1 normieren */
      chopCache = { n: CN, d };
      return d;
    }

    /* ============================================================
       Meer — pro Pixel gerechnet, nicht gestrichelt

       Der erste Anlauf hat die Wasseroberflaeche aus zufaelligen waagerechten
       Strichen zusammengesetzt. Das sah aus wie Bildrauschen, und zwar
       zwangslaeufig: Striche haben keine NEIGUNG, und Wasser ist zu 100 %
       Neigung. Ein Meer ist eine Spiegelflaeche, deren Helligkeit an jedem
       Punkt allein davon abhaengt, WOHIN die Facette dort zeigt.

       Deshalb hier dasselbe Modell, das der Mond schon benutzt: ein
       Hoehenfeld, daraus die Normale, daraus die Beleuchtung.

       · PERSPEKTIVE. Der Bildpunkt (x,y) wird auf die Wasserebene
         zurueckprojiziert: Z = EYE·f/(y−hy), X = (x−w/2)·Z/f. Damit stauchen
         sich die Wellen zum Horizont hin von SELBST — richtig, nicht
         geschaetzt. Genau daran scheitern gemalte Meere fast immer.
       · DUENUNG als drei gerichtete Sinusse. Mehr waren es einmal — neun
         Sinusse erzeugen Schwebungen, und die legen sich als regelmaessiges
         Karomuster ueber das ganze Bild.
       · KRAEUSELWELLE aus einem stochastischen, gekachelten Steigungsfeld.
         Sie MUSS stochastisch sein, sonst entsteht wieder Interferenz.
       · LOD. Eine Welle, deren Wellenlaenge unter zwei Pixel faellt, wird
         AUSGEBLENDET statt gezeichnet. Ohne das rauscht der Horizont — und
         dieses Rauschen ist es, was man als "billig" sieht. Uebrig bleibt
         dort nur die grosse Duenung: so glatt wie ein echter Meereshorizont.
       · FARBE nach BEER-LAMBERT ueber die Wassertiefe, nicht als Verlauf.
       · FRESNEL pro Pixel (Schlick, R0 = 0,0204) am tatsaechlichen Winkel.
       · SPIEGELUNG des Himmels nach der Elevation des reflektierten Strahls —
         flache Facetten sehen den hellen Horizontdunst, steile den dunklen
         Zenit. Das erzeugt die waagerechte Baenderung echter Wasserflaechen,
         ohne dass eine einzige Linie gezeichnet wird.
       · GLANZLICHT nach Blinn-Phong gegen die Mondrichtung. Die Glanzstrasse
         entsteht dadurch von allein an der einzig moeglichen Stelle: in der
         Vertikalebene durch Mond und Auge.

       Gerechnet wird EINMAL beim Backen, bei Bedarf unterabgetastet.
       ============================================================ */
    function paintSea(g, P, hy, waterY, lightX, lightY) {
      const sea = Math.max(2, waterY - hy);
      /* Unterabtastung, damit das Backen auch bei DPR 2 im Rahmen bleibt.
         Der Verlust ist klein: die scharfen Anteile (Glitzer, Brandung)
         kommen ohnehin aus eigenen Ebenen darueber. */
      let sc = 1;
      while ((w / sc) * (sea / sc) > 620000) sc *= 2;
      const cw = Math.max(1, Math.ceil(w / sc)), ch = Math.max(1, Math.ceil(sea / sc));
      const cv = document.createElement("canvas");
      cv.width = cw; cv.height = ch;
      const cc = cv.getContext("2d");
      const img = cc.createImageData(cw, ch);
      const d = img.data;

      const f = h * 1.05;            /* Brennweite in Pixeln (~50 Grad FOV) */
      const EYE = 1.75;              /* Augenhoehe ueber dem Wasser, Meter   */
      const cxs = w * .5;

      /* Sichtbar bleiben nur drei DUENUNGS-Zuege. Die Laengen bekommen einen
         Zufallsversatz: eine exakte geometrische Reihe erzeugt Schwebungen. */
      const NW = 3;
      const WV = [];
      const Rq = rng(1971);
      for (let i = 0; i < NW; i++) {
        const wl = 52 / Math.pow(2.15, i) * (.82 + Rq() * .36);
        const amp = .21 / Math.pow(1.85, i);
        const ang = (i - 1) * .15 + (Rq() - .5) * .22;
        WV.push({
          wl, amp,
          dx: Math.cos(ang), dz: Math.sin(ang),
          k: 6.283185 / wl,
          ph: i * 1.913,
        });
      }

      const CN = 128;
      const chop = beachChop(CN);

      /* Mondrichtung als Einheitsvektor in Weltkoordinaten. y zeigt nach
         oben, z vom Betrachter weg. */
      let Lx = (lightX - cxs) / f, Ly = (hy - lightY) / f, Lz = 1;
      const Ll = Math.hypot(Lx, Ly, Lz); Lx /= Ll; Ly /= Ll; Lz /= Ll;

      /* ---- Wasserfarbe nach BEER-LAMBERT, nicht als Verlauf ----
         Vorn steht das Wasser knoecheltief ueber hellem Sand: das Licht
         laeuft nur ein paar Dezimeter hin und zurueck, Rot wird geschluckt,
         Gruen und Blau kommen wieder heraus — Tuerkis, fast durchsichtig.
         Hinten sind es Dutzende Meter, es kommt nichts mehr zurueck —
         Tiefblau. Die Extinktionskoeffizienten stehen im Verhaeltnis rund
         8 : 1,7 : 1 (Rot wird im Meerwasser etwa achtmal so stark geschluckt
         wie Blau); genau dieses Verhaeltnis macht die Farbe. Ein gemalter
         Verlauf trifft das nie, weil er die TIEFE nicht kennt. */
      const [bedR, bedG, bedB] = P.bed.split(" ").map(Number);
      const [dpR, dpG, dpB] = P.deep.split(" ").map(Number);
      const KR = .42, KG = .088, KB = .052;      /* je Meter */
      /* Ueberhoehte Bodenneigung. Ein echter Sandstrand faellt mit 3-6 % ab —
         damit laege der GESAMTE sichtbare Ausschnitt im Flachwasser und das
         Meer bliebe bis zum Horizont tuerkis; der Bildausschnitt zeigt eben
         nur die ersten paar hundert Meter. Ueberhoeht wird die GEOMETRIE,
         nicht das Farbmodell — die Farbe bleibt die physikalisch richtige
         Funktion der Tiefe. */
      const BED = .42;
      const Zsh = EYE * f / sea;                 /* Entfernung der Wasserkante */

      const [shR, shG, shB] = P.skyHor.split(" ").map(Number);
      const [szR, szG, szB] = P.skyZen.split(" ").map(Number);
      const [spR, spG, spB] = P.spec.split(" ").map(Number);

      const R0 = .0204;
      const amp = new Float32Array(NW), sn = new Float32Array(NW), cs = new Float32Array(NW);
      const rc = new Float32Array(NW), rs = new Float32Array(NW);

      for (let j = 0; j < ch; j++) {
        const ys = hy + (j + .5) * sc;
        const dy = Math.max(.75, ys - hy);
        const Z = EYE * f / dy;                     /* Entfernung in Metern */
        const dXdx = Z / f * sc;                    /* Meter je Ausgabepixel */

        /* Wassertiefe an dieser Stelle, daraus die Durchsicht */
        const depth = Math.min(30, Math.max(.06, (Z - Zsh) * BED));
        const path = 2 * depth;                     /* hin und zurueck */
        const trR = Math.exp(-KR * path), trG = Math.exp(-KG * path), trB = Math.exp(-KB * path);
        const bR = bedR * trR + dpR * (1 - trR);
        const bG = bedG * trG + dpG * (1 - trG);
        const bB = bedB * trB + dpB * (1 - trB);

        /* --- LOD fuer die Duenung: Komponenten unterhalb von zwei Pixeln
           Wellenlaenge ausblenden. Das ist der ganze Trick am glatten
           Horizont. --- */
        for (let i = 0; i < NW; i++) {
          const swl = WV[i].wl / Math.max(1e-6, Math.abs(WV[i].dx) * dXdx + 1e-6);
          amp[i] = WV[i].amp * Math.max(0, Math.min(1, (swl - 2.2) / 3.4));
        }

        /* Startphase am linken Rand + inkrementelle Drehung je Pixel: spart
           drei Sinus-Aufrufe pro Pixel. Die Phasenstoerung pro Zeile bricht
           die strenge Periodizitaet in Tiefenrichtung — ohne sie legen sich
           die Komponenten zu konzentrischen Boegen zusammen. */
        const X0 = (0 - cxs) * Z / f;
        for (let i = 0; i < NW; i++) {
          const warp = (fbm(beachNz, Z * (.020 + i * .012) + i * 31.7, i * 9.3, 3) - .44) * 9.5;
          const p0 = WV[i].k * (WV[i].dx * X0 + WV[i].dz * Z) + WV[i].ph + warp;
          sn[i] = Math.sin(p0); cs[i] = Math.cos(p0);
          const dp = WV[i].k * WV[i].dx * dXdx;
          rc[i] = Math.cos(dp); rs[i] = Math.sin(dp);
        }

        /* LOD fuer die beiden Kachelinstanzen der Kraeuselwelle */
        const CL1 = 6.0, CL2 = 1.55;
        const lod1 = Math.max(0, Math.min(1, ((CL1 / 9) / dXdx - 1.8) / 2.6));
        const lod2 = Math.max(0, Math.min(1, ((CL2 / 9) / dXdx - 1.8) / 2.6));
        const A1 = .105 * lod1, A2 = .095 * lod2;

        const row = j * cw * 4;
        for (let i = 0; i < cw; i++) {
          let hx = 0, hz = 0;
          for (let m = 0; m < NW; m++) {
            const a = amp[m];
            if (a > 0) {
              const c = cs[m], kk = WV[m].k * a;
              hx += kk * WV[m].dx * c;
              hz += kk * WV[m].dz * c;
            }
            const s2 = sn[m] * rc[m] + cs[m] * rs[m];
            cs[m] = cs[m] * rc[m] - sn[m] * rs[m];
            sn[m] = s2;
          }

          const Xn = (i * sc + .5 - cxs) * Z / f;
          /* Kraeuselung dazu — zwei Kacheln, bilinear abgetastet, in
             unterschiedlichem Massstab und gegeneinander versetzt, damit die
             Wiederholung nicht auffaellt. */
          if (A1 > 0) {
            const u = Xn / CL1 * CN, v = Z / CL1 * CN;
            const ax = u - Math.floor(u), az = v - Math.floor(v);
            const i0 = ((Math.floor(u) % CN) + CN) % CN, j0 = ((Math.floor(v) % CN) + CN) % CN;
            const i1 = (i0 + 1) % CN, j1 = (j0 + 1) % CN;
            const o00 = (j0 * CN + i0) * 2, o10 = (j0 * CN + i1) * 2;
            const o01 = (j1 * CN + i0) * 2, o11 = (j1 * CN + i1) * 2;
            hx += A1 * ((chop[o00] * (1 - ax) + chop[o10] * ax) * (1 - az)
                      + (chop[o01] * (1 - ax) + chop[o11] * ax) * az);
            hz += A1 * ((chop[o00 + 1] * (1 - ax) + chop[o10 + 1] * ax) * (1 - az)
                      + (chop[o01 + 1] * (1 - ax) + chop[o11 + 1] * ax) * az);
          }
          if (A2 > 0) {
            const u = Xn / CL2 * CN + 41.3, v = Z / CL2 * CN + 17.9;
            const ax = u - Math.floor(u), az = v - Math.floor(v);
            const i0 = ((Math.floor(u) % CN) + CN) % CN, j0 = ((Math.floor(v) % CN) + CN) % CN;
            const i1 = (i0 + 1) % CN, j1 = (j0 + 1) % CN;
            const o00 = (j0 * CN + i0) * 2, o10 = (j0 * CN + i1) * 2;
            const o01 = (j1 * CN + i0) * 2, o11 = (j1 * CN + i1) * 2;
            hx += A2 * ((chop[o00] * (1 - ax) + chop[o10] * ax) * (1 - az)
                      + (chop[o01] * (1 - ax) + chop[o11] * ax) * az);
            hz += A2 * ((chop[o00 + 1] * (1 - ax) + chop[o10 + 1] * ax) * (1 - az)
                      + (chop[o01 + 1] * (1 - ax) + chop[o11 + 1] * ax) * az);
          }

          /* Normale aus der Steigung */
          let nx = -hx, ny = 1, nz = -hz;
          const nl = Math.sqrt(nx * nx + 1 + nz * nz);
          nx /= nl; ny /= nl; nz /= nl;

          /* Blickrichtung vom Punkt zum Auge */
          let vx = -Xn, vy = EYE, vz = -Z;
          const vl = Math.sqrt(vx * vx + vy * vy + vz * vz);
          vx /= vl; vy /= vl; vz /= vl;

          const ndv = Math.max(.002, nx * vx + ny * vy + nz * vz);
          const F = R0 + (1 - R0) * Math.pow(1 - ndv, 5);

          /* reflektierter Strahl: seine Hoehe entscheidet, welchen Teil des
             Himmels die Facette zeigt */
          const ry = 2 * ndv * ny - vy;
          const el = Math.max(0, Math.min(1, ry / .58));
          const skR = shR + (szR - shR) * el;
          const skG = shG + (szG - shG) * el;
          const skB = shB + (szB - shB) * el;

          /* Glanzlicht nach Blinn-Phong gegen die Mondrichtung */
          const hxv = vx + Lx, hyv = vy + Ly, hzv = vz + Lz;
          const hl = Math.sqrt(hxv * hxv + hyv * hyv + hzv * hzv) || 1;
          const ndh = (nx * hxv + ny * hyv + nz * hzv) / hl;
          let spec = 0;
          if (ndh > .55) {
            const q = Math.pow(ndh, 900);
            if (q > 1e-4) spec = q * P.specA * F * 16;
          }

          const o = row + i * 4;
          d[o]     = Math.min(255, bR + (skR - bR) * F + spec * spR);
          d[o + 1] = Math.min(255, bG + (skG - bG) * F + spec * spG);
          d[o + 2] = Math.min(255, bB + (skB - bB) * F + spec * spB);
          d[o + 3] = 255;
        }
      }
      cc.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(cv, 0, 0, cw, ch, 0, hy, w, sea);
      /* unterhalb der Wasserkante weiterfuellen, damit unter dem nassen Sand
         keine Luecke steht */
      g.drawImage(cv, 0, ch - 1, cw, 1, 0, waterY, w, h - waterY);
    }

    /* ============================================================
       Mars-Bewegtszene: Rover, Startturm, Rakete

       Der Abstand zwischen "gezeichnet" und "fotografiert" entsteht nicht aus
       mehr Pfaden, sondern aus MATERIALVERHALTEN. Deshalb liegt unter dieser
       Szene ein kleiner aufgeschobener Renderer (deferred shading): jedes
       Bauteil wird EINMAL in drei Puffer gemalt —

         Albedo   die Grundfarbe ohne jedes Licht
         Normale  wohin die Oberflaeche zeigt (nx, ny im Rot-/Gruenkanal,
                  Glanzstaerke im Blaukanal)
         Hoehe    wie weit das Bauteil vorsteht

       — und danach in EINEM Durchgang pro Pixel beleuchtet: Lambert gegen die
       tatsaechliche Lichtrichtung der Szene, schmales Glanzlicht auf Metall,
       Fresnelsaum an jeder Silhouette, Umgebungsverdeckung in Fugen und
       Innenecken, roetliches Himmelslicht als Aufheller (auf dem Mars ist der
       Schatten WARM, nicht blau wie auf der Erde) und ein Staubbelag, der
       nach oben zeigende Flaechen am staerksten trifft.

       Kantenverrundung und Verdeckung kommen beide aus demselben Hoehenfeld:
       die erste aus seiner Steigung, die zweite aus der Differenz zweier
       Unschaerfen. Eine mathematisch scharfe Kante liest sofort als
       Vektorgrafik — reale Kanten haben einen schmalen Lichtsaum.

       Das ist teuer, aber nur EINMAL: Rover, Rakete und Turm aendern ihre
       FORM nie, nur ihre Lage. Sie werden bei zwei- bis dreifacher Aufloesung
       in Zwischenebenen gebacken und danach nur noch kopiert. Pro Bild bleibt
       das, was sich wirklich bewegt: Raeder, Arm, Flamme, Staub, Dampf.
       ============================================================ */

    /* Bodenprofil unter den Raedern. Dasselbe Rauschfeld wie am Strand,
       andere Frequenz — daraus kommt jede Radbewegung. */
    function marsTerrain(x, amp) {
      return (ridge(beachNz, x, 90 * DPR, 3, 101.7) - .5) * amp
           + (ridge(beachNz, x, 22 * DPR, 2, 55.3) - .5) * amp * .45;
    }

    /* ---------- Lichtmodell der Szene ----------
       Die Lichtrichtung ist nicht erfunden: Phobos (nachts) und die Sonne
       (tags) stehen laut sunPos()/paintPhobos() bei x = .855..93 w und
       y = .20..29 h — also rechts oben und maessig hoch. Genau das steht
       hier, einmal normiert. */
    const MARS_L = (() => {
      const x = .54, y = -.62, z = .57, l = Math.hypot(x, y, z);
      return { x: x / l, y: y / l, z: z / l };
    })();

    /* Farbstichtrennung: Licht warm-weiss, Fuelllicht roetlich. Auf dem Mars
       streut die Atmosphaere im Roten — der Himmel ist butterscotch, also
       ist auch das Fuelllicht in den Schatten warm. Das ist der auffaelligste
       Unterschied zu einer irdischen Szene, wo Schatten blau ausfallen. */
    function marsLight() {
      return dayMode()
        ? { key: [255, 246, 226], keyI: 1.26,
            sky: [216, 152,  98], skyI:  .38,
            gnd: [190, 104,  56], gndI:  .24,
            rim: [255, 224, 190], rimI:  .55,
            dust:[188, 124,  80], dustA: .40, gain: 1.00 }
        : { key: [216, 228, 255], keyI:  .98,
            sky: [ 92,  58,  52], skyI:  .32,
            gnd: [112,  56,  38], gndI:  .20,
            rim: [186, 202, 244], rimI:  .50,
            dust:[128,  84,  60], dustA: .34, gain: 1.16 };
    }

    /* ---------- Puffer und Pfadhelfer ---------- */
    function matBuf(pw, ph) {
      const mk = () => { const c = document.createElement("canvas"); c.width = pw; c.height = ph; return c; };
      const cA = mk(), cN = mk(), cH = mk();
      const B = { w: pw, h: ph, cA, cN, cH,
                  a: cA.getContext("2d"), n: cN.getContext("2d"), z: cH.getContext("2d") };
      /* Das Hoehenfeld braucht einen OPAKEN Grund: die Unschaerfe weiter
         unten liest sonst an der Silhouette Transparenz statt Hoehe, und
         genau dort soll die Kante ja verrunden. Schwarz = "nichts da". */
      B.z.fillStyle = "#000"; B.z.fillRect(0, 0, pw, ph);
      return B;
    }

    /* Ein Bauteil in alle drei Puffer schreiben. `p` zeichnet NUR den Pfad;
       die Stile sind Farbstrings oder Funktionen (ctx) => Stil, denn ein
       CanvasGradient gehoert dem Kontext, der ihn erzeugt hat, und darf nicht
       zwischen Puffern wandern. */
    function mPart(B, p, sA, sN, sH) {
      const cs = [B.a, B.n, B.z], ss = [sA, sN, sH];
      for (let i = 0; i < 3; i++) {
        const c = cs[i];
        c.beginPath(); p(c);
        c.fillStyle = typeof ss[i] === "function" ? ss[i](c) : ss[i];
        c.fill();
      }
    }
    function mLine(B, p, lw, sA, sN, sH, cap) {
      const cs = [B.a, B.n, B.z], ss = [sA, sN, sH];
      for (let i = 0; i < 3; i++) {
        const c = cs[i];
        c.save();
        c.lineWidth = lw; c.lineCap = cap || "butt"; c.lineJoin = "round";
        c.beginPath(); p(c);
        c.strokeStyle = typeof ss[i] === "function" ? ss[i](c) : ss[i];
        c.stroke(); c.restore();
      }
    }
    /* Nur Albedo aendern — Aufkleber, Russ, Staubfahnen, Beschriftung.
       Sie sitzen AUF der Oberflaeche und aendern weder Form noch Hoehe. */
    function mDecal(B, fn) { B.a.save(); fn(B.a); B.a.restore(); }

    const pRect = (x, y, ww, hh) => c => c.rect(x, y, ww, hh);
    const pRR = (x, y, ww, hh, r) => c => { if (c.roundRect) c.roundRect(x, y, ww, hh, r); else c.rect(x, y, ww, hh); };
    const pCirc = (x, y, r) => c => c.arc(x, y, r, 0, 6.283185);
    const pEll = (x, y, rx, ry, rot) => c => c.ellipse(x, y, rx, ry, rot || 0, 0, 6.283185);
    const pPoly = (...q) => c => { c.moveTo(q[0], q[1]); for (let i = 2; i < q.length; i += 2) c.lineTo(q[i], q[i + 1]); c.closePath(); };
    const pSeg = (x0, y0, x1, y1) => c => { c.moveTo(x0, y0); c.lineTo(x1, y1); };

    /* Normale als Farbe. Blau traegt die Glanzstaerke (0 = matt, 1 = Metall). */
    const nrm = (nx, ny, spec) =>
      "rgb(" + (((nx * .5 + .5) * 255) | 0) + " " + (((ny * .5 + .5) * 255) | 0) + " " + ((spec * 255) | 0) + ")";
    const nFlat = spec => nrm(0, 0, spec);
    /* Zylinder mit senkrechter Achse. Bei einem Zylinder ist nx = dx/r, also
       exakt linear ueber die Breite — ein Linearverlauf trifft das ohne
       Naeherung, es braucht keine Pixelrechnung. */
    const nCylX = (x0, x1, spec, k) => c => {
      const kk = k === undefined ? 1 : k;
      const g = c.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, nrm(-kk, 0, spec));
      g.addColorStop(.5, nrm(0, 0, spec));
      g.addColorStop(1, nrm(kk, 0, spec));
      return g;
    };
    const nCylY = (y0, y1, spec, k) => c => {
      const kk = k === undefined ? 1 : k;
      const g = c.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, nrm(0, -kk, spec));
      g.addColorStop(.5, nrm(0, 0, spec));
      g.addColorStop(1, nrm(0, kk, spec));
      return g;
    };
    /* Radial nach aussen — Radkranz, Duesenglocke, Tankboden. */
    const nRad = (cx, cy, spec, k) => c => {
      if (!c.createConicGradient) return nFlat(spec);
      const kk = k === undefined ? 1 : k;
      const g = c.createConicGradient(0, cx, cy);
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, a = t * 6.283185;
        g.addColorStop(t, nrm(Math.cos(a) * kk, Math.sin(a) * kk, spec));
      }
      return g;
    };
    const mH = v => { const q = Math.max(0, Math.min(255, v | 0)); return "rgb(" + q + " " + q + " " + q + ")"; };

    /* Rauschfeld fuer Gebrauchsspuren. 256er-Tabelle statt Rauschaufruf pro
       Pixel: nichts in der Wirklichkeit ist sauber, aber es muss auch nichts
       teuer sein. */
    let grimeLUT = null;
    function grimeField() {
      if (grimeLUT) return grimeLUT;
      const S = 256, arr = new Float32Array(S * S), nz = noise2(77);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) arr[y * S + x] = fbm(nz, x / 13, y / 13, 4);
      grimeLUT = arr;
      return arr;
    }

    /* ---------- der Beleuchtungsdurchgang ---------- */
    function matShade(B, opt) {
      const o = opt || {}, pw = B.w, ph = B.h, L = marsLight();
      const blurBuf = px => {
        const c = document.createElement("canvas");
        c.width = pw; c.height = ph;
        const x = c.getContext("2d");
        x.filter = "blur(" + px + "px)";
        x.drawImage(B.cH, 0, 0);
        return x.getImageData(0, 0, pw, ph).data;
      };
      const bevR = o.bevelR || Math.max(1, Math.round(pw * .0035 + 1));
      const H1 = blurBuf(bevR), H2 = blurBuf(bevR * 5.5);
      const IA = B.a.getImageData(0, 0, pw, ph), A = IA.data;
      const N = B.n.getImageData(0, 0, pw, ph).data;
      const GA = grimeField();

      const kr = L.key[0] / 255 * L.keyI, kg = L.key[1] / 255 * L.keyI, kb = L.key[2] / 255 * L.keyI;
      const sr = L.sky[0] / 255 * L.skyI, sg = L.sky[1] / 255 * L.skyI, sb = L.sky[2] / 255 * L.skyI;
      const gr = L.gnd[0] / 255 * L.gndI, gg = L.gnd[1] / 255 * L.gndI, gb = L.gnd[2] / 255 * L.gndI;
      const rr = L.rim[0] / 255 * L.rimI, rg = L.rim[1] / 255 * L.rimI, rb = L.rim[2] / 255 * L.rimI;
      const dr = L.dust[0], dg = L.dust[1], db = L.dust[2];
      const dustA = (o.dust === undefined ? 1 : o.dust) * L.dustA;
      const bev = o.bevel === undefined ? 2.6 : o.bevel;
      const aoK = o.ao === undefined ? 2.2 : o.ao;
      const gain = (o.gain || 1) * L.gain;
      const lx = MARS_L.x, ly = MARS_L.y, lz = MARS_L.z;
      const hl = Math.hypot(lx, ly, lz + 1), hx = lx / hl, hy = ly / hl, hz = (lz + 1) / hl;
      const row = pw * 4;

      for (let y = 0; y < ph; y++) {
        const ym = (y & 255) << 8;
        const up = y > 0 ? -row : 0, dn = y < ph - 1 ? row : 0;
        for (let x = 0; x < pw; x++) {
          const i = (y * pw + x) * 4;
          const cov = N[i + 3];
          if (cov < 6) { A[i + 3] = 0; continue; }
          const le = x > 0 ? -4 : 0, ri = x < pw - 1 ? 4 : 0;

          /* Normale aus dem Puffer, danach um die Steigung des Hoehenfelds
             gekippt: das gibt jeder Kante und jeder Fuge ihre Verrundung. */
          let nx = N[i] / 127.5 - 1, ny = N[i + 1] / 127.5 - 1;
          const spec = N[i + 2] / 255;
          nx -= (H1[i + ri] - H1[i + le]) / 255 * bev;
          ny -= (H1[i + dn] - H1[i + up]) / 255 * bev;
          let l2 = nx * nx + ny * ny;
          if (l2 > .9801) { const s = .99 / Math.sqrt(l2); nx *= s; ny *= s; l2 = .9801; }
          const nz = Math.sqrt(1 - l2);

          /* Hoehlenverdeckung: wo das feine Hoehenfeld unter dem groben
             liegt, sitzt eine Fuge oder eine Innenecke — dort ist es
             dunkler. Genau das erzeugt Volumen. */
          const cav = (H1[i] - H2[i]) / 255;
          let ao = .70 + cav * aoK;
          ao = ao < .12 ? .12 : ao > 1.18 ? 1.18 : ao;

          const gn = GA[ym | (x & 255)];
          /* Staub liegt auf dem, was nach oben zeigt — nach Monaten auf dem
             Mars ist das Deck roetlich zu, die Flanken sind es kaum. */
          let du = dustA * (.30 + .70 * Math.max(0, -ny)) * (.45 + 1.1 * gn);
          du = du < 0 ? 0 : du > .92 ? .92 : du;
          /* Gebrauchsspuren: fleckige Abdunklung, sonst liest jede Flaeche
             als frisch lackiert. */
          const wear = 1 - .26 * gn;

          let ar = A[i] * wear, ag = A[i + 1] * wear, ab = A[i + 2] * wear;
          ar += (dr - ar) * du; ag += (dg - ag) * du; ab += (db - ab) * du;

          const ndl = nx * lx + ny * ly + nz * lz;
          const dif = ndl > 0 ? ndl : 0;
          const ndh = nx * hx + ny * hy + nz * hz;
          let sp = 0;
          if (ndh > 0 && spec > .01) {
            const e = 5 + spec * spec * 170;
            sp = Math.pow(ndh, e) * spec * (1.1 + spec) * (dif > 0 ? 1 : 0) * (1 - du * .8);
          }
          const fre = Math.pow(1 - nz, 4.4) * (.35 + spec) * ao;
          const skyv = .55 + .45 * (-ny);      /* Halbraum von oben */
          const bnc = .40 + .60 * ny;          /* Bodenreflex von unten */

          let R = (ar * (dif * kr + ao * skyv * sr + ao * bnc * gr) + sp * 255 * kr + fre * 255 * rr) / 255 * gain;
          let G = (ag * (dif * kg + ao * skyv * sg + ao * bnc * gg) + sp * 255 * kg + fre * 255 * rg) / 255 * gain;
          let Bc= (ab * (dif * kb + ao * skyv * sb + ao * bnc * gb) + sp * 255 * kb + fre * 255 * rb) / 255 * gain;

          /* Filmische Schulter. Ein hartes Abschneiden bei 255 erzeugt die
             flachen weissen Flecken, an denen man Renderings erkennt. */
          R = (R * (2.51 * R + .03)) / (R * (2.43 * R + .59) + .14);
          G = (G * (2.51 * G + .03)) / (G * (2.43 * G + .59) + .14);
          Bc = (Bc * (2.51 * Bc + .03)) / (Bc * (2.43 * Bc + .59) + .14);

          A[i]     = R < 0 ? 0 : R > 1 ? 255 : R * 255;
          A[i + 1] = G < 0 ? 0 : G > 1 ? 255 : G * 255;
          A[i + 2] = Bc < 0 ? 0 : Bc > 1 ? 255 : Bc * 255;
          A[i + 3] = cov;
        }
      }
      B.a.putImageData(IA, 0, 0);
      return B.cA;
    }

    /* Einheitensystem der gebackenen Sprites: 1 Einheit = 1,5 m, der
       Wagenkasten ist also genau 2 Einheiten lang (3,0 m — die echte Laenge
       von Perseverance). Alle uebrigen Masse folgen daraus: Rad 52,5 cm
       Durchmesser = 0,35 Einheiten, Mastspitze 2,2 m = 1,47 Einheiten,
       Roboterarm 2,1 m = 1,40 Einheiten. Der alte Rover hatte fast doppelt
       so grosse Raeder — daran lag ein guter Teil des Spielzeugeindrucks. */
    function mXform(B, U, ox, oy) {
      for (const c of [B.a, B.n, B.z]) c.setTransform(U, 0, 0, U, ox, oy);
    }

    const MAT = {
      deck:   ["rgb(224 218 202)", .22, 168],   /* Thermodecke, matt      */
      panel:  ["rgb(172 168 162)", .34, 150],
      dark:   ["rgb(72 70 70)",    .30, 140],
      black:  ["rgb(40 38 40)",    .22, 136],
      ti:     ["rgb(196 194 190)", .82, 172],   /* Titanrohr, blank       */
      alu:    ["rgb(160 158 154)", .62, 158],
      gold:   ["rgb(196 158 74)",  .55, 148],
      glass:  ["rgb(26 34 48)",    .95, 130],
      steel:  ["rgb(184 188 196)", .94, 160],
      soot:   ["rgb(46 42 42)",    .12, 132],
      paint:  ["rgb(214 212 206)", .30, 156],
      rust:   ["rgb(132 82 54)",   .18, 146],
      cop:    ["rgb(168 112 66)",  .60, 150],
    };
    /* Bauteil mit Werkstoff m; nSt ist der Normalenstil, dh eine Hoehen-
       verschiebung gegen den Werkstoffgrundwert. */
    function mp(B, p, m, nSt, dh) {
      const M = MAT[m];
      mPart(B, p, M[0], nSt || nFlat(M[1]), mH(M[2] + (dh || 0)));
    }
    function ml(B, p, lw, m, nSt, dh, cap) {
      const M = MAT[m];
      mLine(B, p, lw, M[0], nSt || nFlat(M[1]), mH(M[2] + (dh || 0)), cap);
    }

    /* ---------- Rover: Wagenkasten, Mast, MMRTG, Antennen ----------
       Seitenansicht nach dem Perseverance-Layout. Was den Unterschied macht,
       ist nicht die Silhouette, sondern das Gewimmel auf dem Deck: ein
       glatter Kasten liest immer als Illustration. */
    function bakeRoverBody(U) {
      const x0 = -1.52, x1 = 1.10, y0 = -1.86, y1 = .10;
      const B = matBuf(Math.ceil((x1 - x0) * U), Math.ceil((y1 - y0) * U));
      mXform(B, U, -x0 * U, -y0 * U);

      /* --- MMRTG hinten, schraeg abstehend, mit Kuehlrippen --- */
      for (const c of [B.a, B.n, B.z]) { c.save(); c.translate(-.90, -.70); c.rotate(.40); }
      mp(B, pRR(-.60, -.125, .58, .25, .055), "panel", nCylY(-.125, .125, .40), 4);
      for (let i = 0; i < 7; i++) {
        const fx = -.545 + i * .076;
        ml(B, pSeg(fx, -.148, fx, .148), .030, "panel", nFlat(.50), 13);
      }
      ml(B, pSeg(-.575, -.148, -.015, -.148), .016, "dark", nFlat(.3), 10);
      ml(B, pSeg(-.575, .148, -.015, .148), .016, "dark", nFlat(.3), 10);
      mp(B, pRR(-.60, -.045, .58, .09, .03), "dark", nFlat(.3), -8);
      mp(B, pRR(-.685, -.095, .09, .19, .035), "alu", nCylY(-.095, .095, .5), 8);
      mp(B, pRR(-.02, -.075, .06, .15, .02), "dark", nFlat(.35), 2);
      for (const c of [B.a, B.n, B.z]) c.restore();

      /* --- Wagenkasten (WEB). Unten leicht angeschraegt, damit die
             Silhouette nicht als Rechteck liest. --- */
      mp(B, pPoly(-.95, -.90, .86, -.90, .86, -.50, .79, -.43, -.88, -.43, -.95, -.51),
         "panel", nCylY(-.90, -.43, .34, .55), 0);
      /* Deckplatte: das hellste Element des Rovers, weisse Thermodecke */
      mp(B, pRR(-.99, -.955, 1.90, .07, .018), "deck", nCylY(-.955, -.885, .22, .5), 16);
      /* vertiefte Seitenplatte — die Fuge bringt die Verdeckung ins Bild */
      mp(B, pRR(-.74, -.86, .62, .30, .02), "panel", nFlat(.30), -14);
      for (let i = 0; i < 5; i++)
        ml(B, pSeg(-.71, -.83 + i * .058, -.15, -.83 + i * .058), .016, "dark", nFlat(.28), -20);
      /* Goldene Isolationsdecke — ein Farbakzent, den jeder Rover hat */
      mp(B, pPoly(.28, -.86, .70, -.86, .72, -.54, .30, -.56), "gold", nFlat(.50), -4);
      for (let i = 0; i < 6; i++)
        ml(B, pSeg(.29 + i * .002, -.84 + i * .052, .715, -.845 + i * .052), .008, "gold", nFlat(.72), 2);
      /* Elektronikblock und Steckerleiste hinten */
      mp(B, pRR(-.92, -.78, .17, .22, .015), "black", nFlat(.24), 10);
      for (let i = 0; i < 4; i++)
        mp(B, pCirc(-.835 + (i % 2) * .09, -.735 + ((i / 2) | 0) * .10, .022), "cop", nRad(-.835 + (i % 2) * .09, -.735 + ((i / 2) | 0) * .10, .6), 14);
      /* Probenkarussell unter dem Bauch */
      mp(B, pRR(-.30, -.46, .62, .15, .03), "dark", nCylY(-.46, -.31, .3), -6);
      mp(B, pCirc(.10, -.375, .058), "dark", nRad(.10, -.375, .40), 2);
      mp(B, pCirc(.10, -.375, .030), "alu", nRad(.10, -.375, .60), 6);
      /* Nietreihen: zwei Details, die "gebaut" sagen */
      for (let i = 0; i < 18; i++) {
        const rx = -.90 + i * .098;
        mp(B, pCirc(rx, -.875, .011), "alu", nFlat(.7), 6);
        mp(B, pCirc(rx, -.465, .010), "alu", nFlat(.7), 5);
      }
      /* Aufkleber: Wortmarke statt Hoheitszeichen — NASA-Logos sind nicht
         gemeinfrei und haben hier nichts zu suchen. */
      mDecal(B, c => {
        c.globalAlpha = .55;
        c.fillStyle = "rgb(64 60 62)";
        c.font = "600 .13px system-ui, sans-serif";
        c.fillText("takeoff", -.66, -.50);
        c.globalAlpha = .30;
        c.fillStyle = "rgb(150 60 90)";
        c.fillRect(-.14, -.60, .30, .022);
      });

      /* --- Deckaufbauten --- */
      /* Differentialstange ueber dem Deck: das Bauteil, an dem man eine
         Rocker-Bogie-Aufhaengung von jeder anderen unterscheidet. */
      ml(B, c => { c.moveTo(-.62, -1.00); c.lineTo(-.10, -1.045); c.lineTo(.42, -1.00); }, .028, "ti", nFlat(.8), 26, "round");
      mp(B, pCirc(-.10, -1.045, .034), "alu", nRad(-.10, -1.045, .6), 30);
      /* Rundstrahlantenne */
      ml(B, pSeg(-.70, -.95, -.72, -1.30), .028, "ti", nFlat(.8), 22, "round");
      mp(B, pRR(-.755, -1.40, .075, .11, .035), "deck", nCylX(-.755, -.68, .3), 24);
      /* Hexagonale Richtantenne, leicht gekippt */
      ml(B, pSeg(-.36, -.95, -.34, -1.12), .036, "alu", nFlat(.6), 20, "round");
      (() => {
        const cx = -.34, cy = -1.24, R = .19, sq = .40, tl = -.34;
        const pt = k => {
          const a = k * 1.0471976 + .5236;
          const px = Math.cos(a) * R, py = Math.sin(a) * R * sq;
          return [cx + px * Math.cos(tl) - py * Math.sin(tl), cy + px * Math.sin(tl) + py * Math.cos(tl)];
        };
        const q = []; for (let k = 0; k < 6; k++) q.push(...pt(k));
        mp(B, pPoly(...q), "deck", nFlat(.28), 22);
        const q2 = []; for (let k = 0; k < 6; k++) { const p = pt(k); q2.push(cx + (p[0] - cx) * .62, cy + (p[1] - cy) * .62); }
        mp(B, pPoly(...q2), "panel", nFlat(.35), 18);
      })();
      /* Instrumentenkaesten */
      mp(B, pRR(.00, -1.06, .21, .11, .015), "deck", nCylY(-1.06, -.95, .25), 20);
      mp(B, pRR(.24, -1.02, .15, .07, .012), "dark", nFlat(.3), 18);
      mp(B, pRR(-.60, -1.01, .13, .06, .012), "black", nFlat(.25), 18);
      /* Kabelstrang laengs ueber das Deck */
      ml(B, c => { c.moveTo(-.86, -.97); c.bezierCurveTo(-.4, -1.01, .1, -.94, .58, -.99); }, .020, "black", nFlat(.35), 22, "round");
      ml(B, c => { c.moveTo(-.80, -.955); c.bezierCurveTo(-.3, -.99, .2, -.93, .60, -.965); }, .013, "cop", nFlat(.5), 21, "round");

      /* --- Mast mit Kamerakopf. Hoehe = Augenhoehe eines Menschen. --- */
      mp(B, pRR(.54, -1.10, .22, .16, .03), "dark", nCylX(.54, .76, .35), 12);
      mp(B, pRR(.605, -1.52, .095, .43, .02), "ti", nCylX(.605, .70, .80), 20);
      ml(B, pSeg(.65, -1.44, .65, -1.14), .012, "black", nFlat(.2), 24);
      /* Mastcam-Z-Kopf */
      mp(B, pRR(.44, -1.70, .44, .19, .025), "deck", nCylY(-1.70, -1.51, .26, .55), 26);
      mp(B, pRR(.44, -1.735, .46, .045, .018), "panel", nFlat(.4), 30);   /* Sonnenblende */
      for (const ex of [.545, .715]) {
        mp(B, pCirc(ex, -1.60, .050), "black", nRad(ex, -1.60, .3), 22);
        mp(B, pCirc(ex, -1.60, .036), "glass", nFlat(.95), 20);
        mDecal(B, c => {
          const g = c.createRadialGradient(ex - .012, -1.615, 0, ex, -1.60, .038);
          g.addColorStop(0, "rgb(150 200 246 / .85)"); g.addColorStop(.6, "rgb(40 70 110 / .3)"); g.addColorStop(1, "rgb(12 18 30 / 0)");
          c.fillStyle = g; c.beginPath(); c.arc(ex, -1.60, .038, 0, 6.283); c.fill();
        });
      }
      /* SuperCam-Kopf obenauf */
      mp(B, pRR(.55, -1.845, .24, .145, .045), "panel", nCylX(.55, .79, .45), 30);
      mp(B, pCirc(.67, -1.775, .056), "black", nRad(.67, -1.775, .35), 26);
      mp(B, pCirc(.67, -1.775, .040), "glass", nFlat(.9), 24);

      matShade(B, { dust: 1.15, ao: 2.4, bevel: 2.9 });
      return { cv: B.cA, ox: -x0 * U, oy: -y0 * U, upx: U };
    }

    /* ---------- Roboterarm, 2,1 m ----------
       Eigenes Sprite, weil er sich als Einziges am Rover wirklich bewegt.
       Er dreht um die Schulter, die im Sprite bei (0,0) liegt. */
    function bakeRoverArm(U) {
      const x0 = -.16, x1 = 1.20, y0 = -.24, y1 = .78;
      const B = matBuf(Math.ceil((x1 - x0) * U), Math.ceil((y1 - y0) * U));
      mXform(B, U, -x0 * U, -y0 * U);
      mp(B, pCirc(0, 0, .085), "dark", nRad(0, 0, .4), 6);
      mp(B, pCirc(0, 0, .050), "ti", nRad(0, 0, .7), 12);
      /* Oberarm */
      mp(B, pPoly(.00, -.062, .52, .10, .52, .20, .00, .062), "ti", nCylY(-.062, .062, .78), 8);
      ml(B, pSeg(.06, -.03, .50, .12), .012, "black", nFlat(.2), 12);
      /* Ellenbogen */
      mp(B, pCirc(.53, .152, .085), "dark", nRad(.53, .152, .4), 10);
      mp(B, pCirc(.53, .152, .046), "alu", nRad(.53, .152, .65), 14);
      /* Unterarm */
      mp(B, pPoly(.50, .09, .92, .40, .88, .48, .47, .20), "ti", nFlat(.78), 6);
      /* Handgelenk und Werkzeugkopf (Bohrer, Kamera, Spektrometer) */
      mp(B, pCirc(.92, .445, .075), "dark", nRad(.92, .445, .4), 10);
      mp(B, pRR(.86, .49, .30, .19, .03), "panel", nCylY(.49, .68, .42), 8);
      mp(B, pRR(1.00, .60, .07, .16, .02), "alu", nCylX(1.00, 1.07, .6), 12);
      mp(B, pCirc(.92, .585, .034), "glass", nFlat(.9), 6);
      mp(B, pRR(.88, .655, .05, .10, .02), "soot", nFlat(.2), 4);
      matShade(B, { dust: .9, ao: 2.2, bevel: 2.6 });
      return { cv: B.cA, ox: -x0 * U, oy: -y0 * U, upx: U };
    }

    /* ---------- Rad ----------
       52,5 cm Durchmesser, 30 cm breit, Aluminium, 48 keilfoermige Grouser.
       Die Stollenform ist das Erkennungsmerkmal: Perseverance bekam sie
       nachgeschaerft, nachdem Curiositys gerade Stollen eingerissen waren.
       Das Rad wird in ZWEI Teilen gebacken — die drehende Struktur einerseits
       (kopfseitig beleuchtet, damit die Beleuchtung beim Drehen nicht
       mitwandert), die stehende Lichtstimmung andererseits. */
    function bakeWheel(U) {
      const R = .175, pad = .020;
      const S = Math.ceil((R + pad) * 2 * U);
      const B = matBuf(S, S);
      mXform(B, U, S / 2, S / 2);
      /* Die Trommel ist DUNKEL — eloxiertes Aluminium im Marsstaub, nicht
         blankes Blech. Auf den NASA-Aufnahmen sind die Raeder das dunkelste
         Bauteil des Rovers; sie hell zu malen war der Grund, warum sie wie
         Fahrradfelgen aussahen. */
      mp(B, pCirc(0, 0, R * .955), "dark", nRad(0, 0, .40, .55), 6);
      /* 48 keilfoermige Grouser. Sie stehen ueber den Kranz hinaus, also ist
         schon die SILHOUETTE verzahnt — genau daran erkennt man ein Marsrad.
         Perseverance bekam sie nachgeschaerft, nachdem Curiositys gerade
         Stollen eingerissen waren. */
      for (let i = 0; i < 48; i++) {
        const a0 = i * .1309;
        const rO = R, rI = R * .90;
        mp(B, c => {
          c.moveTo(Math.cos(a0 - .026) * rI, Math.sin(a0 - .026) * rI);
          c.lineTo(Math.cos(a0 - .013) * rO, Math.sin(a0 - .013) * rO);
          c.lineTo(Math.cos(a0 + .013) * rO, Math.sin(a0 + .013) * rO);
          c.lineTo(Math.cos(a0 + .026) * rI, Math.sin(a0 + .026) * rI);
          c.closePath();
        }, "alu", nRad(0, 0, .62, .8), 26);
      }
      /* Eingezogener Radtopf: die Perseverance-Raeder sind gemuldet, und
         diese Mulde ist es, die im Gegenlicht als dunkler Ring steht. */
      mp(B, pCirc(0, 0, R * .82), "black", nRad(0, 0, .22, .25), -26);
      /* gebogene Federspeichen aus Titan, schmal und zurueckhaltend */
      for (let i = 0; i < 12; i++) {
        const a = i * .5236;
        ml(B, c => {
          const r0 = R * .22, r1 = R * .80, bend = .60;
          c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
          c.quadraticCurveTo(Math.cos(a + bend * .5) * r1 * .60, Math.sin(a + bend * .5) * r1 * .60,
                             Math.cos(a + bend) * r1, Math.sin(a + bend) * r1);
        }, .016, "panel", nFlat(.5), 12, "round");
      }
      /* Nabe */
      mp(B, pCirc(0, 0, R * .24), "alu", nRad(0, 0, .55, .8), 20);
      mp(B, pCirc(0, 0, R * .15), "dark", nRad(0, 0, .3), 14);
      for (let i = 0; i < 6; i++) {
        const a = i * 1.0472 + .3;
        mp(B, pCirc(Math.cos(a) * R * .195, Math.sin(a) * R * .195, R * .028), "black", nFlat(.4), 24);
      }
      /* Der Beleuchtungsdurchgang laeuft hier mit Licht von VORN: eine
         Richtung, die beim Drehen mitwandern wuerde, saehe falsch aus. Die
         Szenenbeleuchtung kommt gleich als stehende Ebene darueber. */
      const kx = MARS_L.x, ky = MARS_L.y, kz = MARS_L.z;
      MARS_L.x = 0; MARS_L.y = 0; MARS_L.z = 1;
      matShade(B, { dust: 1.35, ao: 3.0, bevel: 3.2, gain: .82 });
      MARS_L.x = kx; MARS_L.y = ky; MARS_L.z = kz;
      return { cv: B.cA, r: (R + pad) * U, upx: U, rad: R };
    }

    /* Stehende Lichtstimmung ueber dem drehenden Rad: Kernschatten auf der
       lichtabgewandten Seite, schmaler Fresnelsaum auf der zugewandten. */
    function bakeWheelLight(U) {
      const R = .175, pad = .020, S = Math.ceil((R + pad) * 2 * U);
      const mk = () => { const c = document.createElement("canvas"); c.width = c.height = S; return c; };
      const L = marsLight();
      const cs = mk(), c1 = cs.getContext("2d");
      c1.setTransform(U, 0, 0, U, S / 2, S / 2);
      const sh = c1.createLinearGradient(MARS_L.x * R, MARS_L.y * R, -MARS_L.x * R * 1.25, -MARS_L.y * R * 1.25);
      sh.addColorStop(0, "rgb(0 0 0 / 0)");
      sh.addColorStop(.5, "rgb(24 12 10 / .28)");
      sh.addColorStop(1, "rgb(18 8 8 / .72)");
      c1.fillStyle = sh; c1.beginPath(); c1.arc(0, 0, R * 1.005, 0, 6.283); c1.fill();
      const cl = mk(), c2 = cl.getContext("2d");
      c2.setTransform(U, 0, 0, U, S / 2, S / 2);
      const gl = c2.createRadialGradient(0, 0, R * .70, 0, 0, R * 1.01);
      gl.addColorStop(0, "rgb(0 0 0 / 0)");
      gl.addColorStop(1, `rgb(${L.rim[0]} ${L.rim[1]} ${L.rim[2]} / ${(.42 * L.rimI + .12).toFixed(3)})`);
      c2.fillStyle = gl;
      c2.beginPath();
      c2.arc(0, 0, R * 1.01, Math.atan2(MARS_L.y, MARS_L.x) - 1.25, Math.atan2(MARS_L.y, MARS_L.x) + 1.25);
      c2.lineTo(0, 0); c2.closePath(); c2.fill();
      return { shade: cs, lit: cl, r: (R + pad) * U };
    }

    /* ---------- Traeger ----------
       Zweistufig, damit die Trennung ueberhaupt etwas zu trennen hat: unten
       die Unterstufe mit Gitterrudern und Triebwerksbuendel, oben die Stufe
       mit Klappen und Bugkonus. Beide in Einheiten der Gesamthoehe R
       gebacken, Duesenaustritt bei y = +0.5, Bugspitze bei y = -0.5 — dieselbe
       Bezugsachse, die paintRocket schon benutzt hat. */
    const RKW = .058;                    /* halber Rumpfdurchmesser        */

    function bakeBooster(U) {
      const x0 = -.100, x1 = .100, y0 = -.036, y1 = .520;
      const B = matBuf(Math.ceil((x1 - x0) * U), Math.ceil((y1 - y0) * U));
      mXform(B, U, -x0 * U, -y0 * U);
      const nCyl = nCylX(-RKW, RKW, .88, .96);

      /* Kein Gitterruder: bei 6 mbar Aussendruck traegt eine aerodynamische
         Steuerflaeche praktisch nichts. Was hier sitzt, ist der Zwischen-
         stufenring mit den Trennbolzen. */
      mp(B, pRect(-RKW * 1.055, -.030, RKW * 2.11, .046), "steel", nCylX(-RKW * 1.055, RKW * 1.055, .78, .96), -6);
      for (let i = 0; i < 9; i++)
        mp(B, pCirc(-RKW * .90 + i * RKW * .225, -.008, .0045), "dark", nFlat(.4), -14);
      /* Rumpf */
      mp(B, pRect(-RKW, .010, RKW * 2, .432), "steel", nCyl, 0);
      /* Schweissnaehte der Ringsegmente. Jeder Ring bekommt einen eigenen
         Tonwert — echtes Edelstahlblech ist von Ring zu Ring unterschiedlich
         angelassen. Der Effekt muss SEHR schwach bleiben: zu kraeftig liest
         die Wand als Mauerwerk. */
      for (let i = 0; i < 16; i++) {
        const yy = .014 + i * .0268;
        mDecal(B, c => {
          c.globalAlpha = .012 + .018 * Math.abs(Math.sin(i * 2.7));
          c.fillStyle = i % 2 ? "rgb(255 255 255)" : "rgb(74 78 88)";
          c.fillRect(-RKW, yy, RKW * 2, .0268);
        });
        ml(B, pSeg(-RKW * .985, yy, RKW * .985, yy), .0018, "steel", nFlat(.55), -2);
      }
      /* Kabelkanal: eine sehr SCHMALE Leiste nahe der Lichtkante. Breiter
         gezeichnet bildet sie mit den Ringnaehten und der Schattenkante eine
         Leiter — das war der auffaelligste Fehler der ersten Fassung. */
      mp(B, pRect(.040, .012, .006, .428), "steel", nCylX(.040, .046, .8), 8);
      /* Haltebolzen-Beschlaege unten */
      for (const s of [-1, 1]) mp(B, pRR(s * RKW - (s > 0 ? .016 : 0), .372, .016, .036, .003), "dark", nFlat(.4), 8);
      /* Triebwerksschuerze */
      mp(B, pPoly(-RKW, .442, RKW, .442, RKW * .94, .466, -RKW * .94, .466), "soot", nCylX(-RKW, RKW, .3), -6);
      /* Duesenglocken: hintere Reihe angeschnitten, vordere voll */
      for (const s of [-.020, .020]) {
        mp(B, pPoly(s - .012, .458, s + .012, .458, s + .020, .494, s - .020, .494), "soot", nCylX(s - .02, s + .02, .3), -12);
        mp(B, pEll(s, .492, .019, .006), "black", nRad(s, .492, .2), -24);
      }
      for (const s of [-.038, 0, .038]) {
        mp(B, pPoly(s - .014, .462, s + .014, .462, s + .024, .518, s - .024, .518), "soot", nCylX(s - .024, s + .024, .38), -4);
        mp(B, pEll(s, .516, .023, .008), "black", nRad(s, .516, .25), -20);
        mDecal(B, c => {
          const g = c.createLinearGradient(s - .024, 0, s + .024, 0);
          g.addColorStop(0, "rgb(18 14 14 / .82)"); g.addColorStop(.42, "rgb(128 112 100 / .28)"); g.addColorStop(1, "rgb(14 10 10 / .88)");
          c.fillStyle = g; c.beginPath(); c.ellipse(s, .516, .023, .008, 0, 0, 6.283); c.fill();
        });
      }
      mDecal(B, c => {
        const g = c.createLinearGradient(0, .442, 0, .010);
        g.addColorStop(0, "rgb(58 52 50 / .30)");
        g.addColorStop(.55, "rgb(90 86 88 / .10)");
        g.addColorStop(1, "rgb(228 232 240 / .07)");
        c.fillStyle = g; c.fillRect(-RKW, .010, RKW * 2, .432);
      });
      /* Russfahne ueber der Schuerze: nichts an einem geflogenen Traeger ist
         sauber, und die Glocken sind die schmutzigste Stelle ueberhaupt. */
      mDecal(B, c => {
        const g = c.createLinearGradient(0, .470, 0, .290);
        g.addColorStop(0, "rgb(26 22 22 / .80)");
        g.addColorStop(.42, "rgb(48 40 38 / .28)");
        g.addColorStop(1, "rgb(60 50 46 / 0)");
        c.fillStyle = g; c.fillRect(-RKW, .290, RKW * 2, .186);
      });
      matShade(B, { dust: .55, ao: 2.0, bevel: 2.4 });
      return { cv: B.cA, ox: -x0 * U, oy: -y0 * U, upx: U };
    }

    function bakeShip(U) {
      const x0 = -.150, x1 = .150, y0 = -.525, y1 = .066;
      const B = matBuf(Math.ceil((x1 - x0) * U), Math.ceil((y1 - y0) * U));
      mXform(B, U, -x0 * U, -y0 * U);
      const nCyl = nCylX(-RKW, RKW, .88, .96);

      /* Klappen — zuerst, damit der Rumpf davor steht. Auf dem Mars traegt
         die Luft kaum; sie sind entsprechend klein und dienen der Rueckkehr,
         nicht dem Aufstieg. */
      for (const s of [-1, 1]) {
        mp(B, pPoly(s * RKW * .82, -.146, s * .118, -.036, s * .106, -.006, s * RKW * .82, -.022),
           "steel", nFlat(.6), -8);
        ml(B, pSeg(s * RKW * .82, -.142, s * .114, -.034), .0040, "dark", nFlat(.3), -16);
      }
      for (const s of [-1, 1]) {
        mp(B, pPoly(s * RKW * .86, -.386, s * .096, -.320, s * .088, -.298, s * RKW * .86, -.312),
           "steel", nFlat(.6), -8);
        ml(B, pSeg(s * RKW * .86, -.382, s * .093, -.318), .0035, "dark", nFlat(.3), -16);
      }
      /* Rumpf mit langem Bugkonus */
      mp(B, c => {
        c.moveTo(-RKW, .050);
        c.lineTo(-RKW, -.290);
        c.bezierCurveTo(-RKW, -.408, -RKW * .80, -.478, -RKW * .16, -.516);
        c.quadraticCurveTo(0, -.524, RKW * .16, -.516);
        c.bezierCurveTo(RKW * .80, -.478, RKW, -.408, RKW, -.290);
        c.lineTo(RKW, .050);
        c.closePath();
      }, "steel", nCyl, 0);
      /* Der Konus ist eine gekruemmte Flaeche: die Normale kippt zusaetzlich
         nach oben. Ohne das liest die Spitze als ausgeschnittenes Blech. */
      mPart(B, c => { c.moveTo(-RKW, -.290);
                      c.bezierCurveTo(-RKW, -.408, -RKW * .80, -.478, -RKW * .16, -.516);
                      c.quadraticCurveTo(0, -.524, RKW * .16, -.516);
                      c.bezierCurveTo(RKW * .80, -.478, RKW, -.408, RKW, -.290); c.closePath(); },
        "rgb(0 0 0 / 0)", c => { const g = c.createLinearGradient(0, -.290, 0, -.520);
          g.addColorStop(0, nrm(0, 0, .88)); g.addColorStop(1, nrm(0, -.78, .88)); return g; }, mH(160));
      for (let i = 0; i < 13; i++) {
        const yy = .044 - i * .0268;
        mDecal(B, c => {
          c.globalAlpha = .012 + .018 * Math.abs(Math.sin(i * 3.4 + 1));
          c.fillStyle = i % 2 ? "rgb(255 255 255)" : "rgb(70 74 84)";
          c.fillRect(-RKW, yy - .0268, RKW * 2, .0268);
        });
        ml(B, pSeg(-RKW * .985, yy, RKW * .985, yy), .0018, "steel", nFlat(.55), -2);
      }
      /* Reifband ueber dem kryogenen Kopftank: kalt genug, dass die duenne
         Marsatmosphaere daran ausfriert. */
      mDecal(B, c => {
        const g = c.createLinearGradient(0, -.470, 0, -.320);
        g.addColorStop(0, "rgb(236 244 252 / 0)");
        g.addColorStop(.45, "rgb(230 240 252 / .30)");
        g.addColorStop(1, "rgb(230 240 252 / 0)");
        c.fillStyle = g; c.fillRect(-RKW, -.470, RKW * 2, .150);
      });
      /* Kabelkanal, Luke, Fenster */
      mp(B, pRect(.040, -.290, .006, .336), "steel", nCylX(.040, .046, .8), 8);
      mp(B, pEll(.026, -.386, .013, .010, 0), "glass", nFlat(.95), -6);
      ml(B, pEll(.026, -.386, .013, .010, 0), .003, "steel", nFlat(.6), 6);
      mp(B, pRR(-.040, -.232, .036, .046, .006), "panel", nFlat(.4), -8);
      /* Triebwerke der Oberstufe (nach der Trennung sichtbar) */
      for (const s of [-.026, 0, .026]) {
        mp(B, pPoly(s - .010, .046, s + .010, .046, s + .017, .064, s - .017, .064), "soot", nCylX(s - .017, s + .017, .3), -6);
        mp(B, pEll(s, .062, .016, .005), "black", nRad(s, .062, .25), -18);
      }
      /* Wortmarke, verblasst — Beschriftung ist nach ein paar Fluegen nie
         mehr satt. */
      mDecal(B, c => {
        c.save(); c.translate(-.040, -.140); c.rotate(-1.5708);
        c.globalAlpha = .42; c.fillStyle = "rgb(56 58 68)";
        c.font = "700 .038px system-ui, sans-serif";
        c.fillText("takeoff", 0, 0);
        c.restore();
        c.globalAlpha = .24; c.fillStyle = "rgb(210 70 150)";
        c.fillRect(-.024, -.102, .048, .005);
      });
      matShade(B, { dust: .45, ao: 2.0, bevel: 2.4 });
      return { cv: B.cA, ox: -x0 * U, oy: -y0 * U, upx: U };
    }

    /* ---------- Startturm ----------
       Ohne Bezugsobjekt sieht jede startende Rakete wie ein Spielzeug aus:
       der Turm ist das Einzige im Bild, an dem man Hoehe und Massstab
       ablesen kann. Er steht HINTER der Rakete und bleibt beim Aufstieg
       sichtbar zurueck. */
    function bakeTower(U) {
      const HT = 1.14, WT = .098;
      const x0 = -.44, x1 = .18, y0 = -HT - .175, y1 = .085;
      const B = matBuf(Math.ceil((x1 - x0) * U), Math.ceil((y1 - y0) * U));
      mXform(B, U, -x0 * U, -y0 * U);
      const BAY = HT / 14;

      /* hintere Saeulenreihe zuerst und dunkler — daraus liest das Auge die
         Tiefe des Gitterquerschnitts. */
      for (const s of [-1, 1])
        mp(B, pRect(s * WT * .50 - .008, -HT + .05, .016, HT), "soot", nFlat(.25), -34);
      for (let i = 0; i < 14; i++)
        ml(B, pSeg(-WT * .50, -.03 - i * BAY, WT * .50, -.03 - i * BAY), .009, "soot", nFlat(.2), -34);
      /* Aufzugsschacht — direkt an den Saeulen, sonst liest er als zweiter Turm */
      mp(B, pRect(WT - .004, -HT + .09, .030, HT - .10), "panel", nCylX(WT - .004, WT + .026, .35), -8);
      for (let i = 0; i < 12; i++)
        ml(B, pSeg(WT - .002, -.11 - i * .085, WT + .024, -.11 - i * .085), .005, "dark", nFlat(.3), -16);
      /* vordere Saeulen */
      for (const s of [-1, 1])
        mp(B, pRect(s * WT - .012, -HT, .024, HT + .03), "paint", nCylX(s * WT - .012, s * WT + .012, .5), 6);
      /* Riegel und wechselnde Diagonalen */
      for (let i = 0; i <= 14; i++) {
        const yy = -.01 - i * BAY;
        ml(B, pSeg(-WT, yy, WT, yy), .012, "paint", nFlat(.45), 4);
        if (i < 14) {
          const y2 = yy - BAY;
          const d = i % 2 ? [-WT, yy, WT, y2] : [WT, yy, -WT, y2];
          ml(B, pSeg(d[0], d[1], d[2], d[3]), .009, "paint", nFlat(.45), 2, "round");
        }
      }

      /* Fangarme: zwei schwere Traeger, die den Traeger umgreifen. Sie sitzen
         auf Hoehe des Zwischenstufenrings — dort wird ein Traeger gefangen. */
      for (const [ay, len, th] of [[-.505, .335, .040], [-.445, .300, .030]]) {
        mp(B, pPoly(-WT + .01, ay, -WT - len, ay + .014, -WT - len, ay + th, -WT + .01, ay + th + .016),
           "paint", nCylY(ay, ay + th, .42), 16);
        for (let i = 1; i < 7; i++) {
          const t = i / 7, xx = -WT + .01 - (len + .01) * t;
          ml(B, pSeg(xx, ay + .014 * t, xx, ay + th + .016 * (1 - t)), .005, "dark", nFlat(.3), 8);
        }
        mp(B, pCirc(-WT - .004, ay + th * .5 + .010, .030), "dark", nRad(-WT - .004, ay + th * .5, .4), 20);
        mp(B, pCirc(-WT - .004, ay + th * .5 + .010, .015), "alu", nRad(-WT - .004, ay + th * .5, .6), 26);
        mp(B, pRR(-WT - len - .012, ay + .006, .022, th + .014, .006), "alu", nCylX(-WT - len - .012, -WT - len + .010, .55), 22);
      }
      /* Versorgungsarm mit Schnelltrennkupplungen */
      mp(B, pPoly(-WT + .01, -.245, -WT - .255, -.232, -WT - .255, -.202, -WT + .01, -.208), "paint", nCylY(-.245, -.202, .4), 12);
      mp(B, pRR(-WT - .296, -.250, .044, .068, .008), "dark", nFlat(.35), 16);
      for (const yy of [-.240, -.224, -.210])
        ml(B, c => { c.moveTo(-WT - .256, yy); c.quadraticCurveTo(-WT - .278, yy + .020, -WT - .294, yy + .005); }, .008, "cop", nFlat(.5), 18, "round");
      /* Zugangsarm fuer die Besatzung, auf Hoehe der Luke */
      mp(B, pPoly(-WT + .01, -.815, -WT - .195, -.807, -WT - .195, -.785, -WT + .01, -.791), "panel", nCylY(-.815, -.785, .35), 10);
      ml(B, pSeg(-WT - .195, -.826, -WT - .195, -.775), .007, "paint", nFlat(.4), 12);
      for (let i = 1; i < 5; i++)
        ml(B, pSeg(-WT - .04 * i, -.812, -WT - .04 * i, -.788), .004, "dark", nFlat(.3), 6);

      /* Blitzableiter auf der Spitze, mit durchhaengendem Fangseil */
      for (const s of [-1, 0, 1]) {
        ml(B, pSeg(s * WT, -HT, s * WT * .92, -HT - .155), .008, "alu", nFlat(.6), 12, "round");
        mp(B, pCirc(s * WT * .92, -HT - .158, .007), "alu", nRad(s * WT * .92, -HT - .158, .6), 16);
      }
      ml(B, c => { c.moveTo(-WT * .92, -HT - .158); c.quadraticCurveTo(0, -HT - .118, WT * .92, -HT - .158); }, .0035, "black", nFlat(.3), 8, "round");
      /* Warnleuchten */
      mDecal(B, c => {
        for (const yy of [-HT + .06, -.70, -.34]) {
          const g = c.createRadialGradient(WT + .028, yy, 0, WT + .028, yy, .042);
          g.addColorStop(0, "rgb(255 96 72 / .85)"); g.addColorStop(1, "rgb(255 60 40 / 0)");
          c.fillStyle = g; c.beginPath(); c.arc(WT + .028, yy, .042, 0, 6.283); c.fill();
        }
      });
      /* Betonsockel */
      mp(B, pPoly(-.185, .020, .165, .020, .155, .078, -.175, .078), "rust", nCylY(.020, .078, .2), -12);
      /* Russ und Staub am Fuss */
      mDecal(B, c => {
        const g = c.createLinearGradient(0, .078, 0, -.28);
        g.addColorStop(0, "rgb(34 24 20 / .58)");
        g.addColorStop(1, "rgb(60 42 34 / 0)");
        c.fillStyle = g; c.fillRect(-.22, -.28, .40, .36);
      });
      matShade(B, { dust: .85, ao: 1.8, bevel: 2.2 });
      return { cv: B.cA, ox: -x0 * U, oy: -y0 * U, upx: U, ht: HT };
    }

    /* ---------- Backvorrat ----------
       Rover, Rakete und Turm aendern ihre Form nie. Sie werden bei rund
       doppelter Zielaufloesung EINMAL gerendert und danach nur noch skaliert
       kopiert; das Ueberabtasten macht sie nebenbei sauberer, als jeder
       Pfad pro Bild es koennte. Neu gebacken wird nur, wenn sich die
       Beleuchtung (Tag/Nacht) oder die Groessenordnung aendert — und dann
       hoechstens EIN Objekt pro Bild, damit kein Ruckler entsteht. */
    let MB = { key: "", q: [] };
    function marsBakes(Su, Ru) {
      const uR = Math.max(150, Math.min(330, Math.round(Su * 2.0)));
      const uK = Math.max(500, Math.min(1080, Math.round(Ru * 2.0)));
      const key = (dayMode() ? "d" : "n") + ":" + uR + ":" + uK;
      if (MB.key !== key) MB = { key, uR, uK, q: ["ship", "booster", "tower", "rover", "wheel", "arm"] };
      if (MB.q.length) {
        const job = MB.q.shift();
        if (job === "rover") MB.rover = bakeRoverBody(MB.uR);
        else if (job === "arm") MB.arm = bakeRoverArm(MB.uR);
        else if (job === "wheel") { MB.wheel = bakeWheel(MB.uR); MB.wheelL = bakeWheelLight(MB.uR); }
        else if (job === "ship") MB.ship = bakeShip(MB.uK);
        else if (job === "booster") MB.booster = bakeBooster(MB.uK);
        else if (job === "tower") MB.tower = bakeTower(Math.round(MB.uK * .80));
      }
      return MB;
    }
    /* Ein gebackenes Sprite an seinem Ursprung absetzen. `u` ist die
       Bildschirmgroesse einer Sprite-Einheit. */
    function blit(g, T, u, a) {
      if (!T) return;
      const k = u / T.upx;
      if (a !== undefined) g.globalAlpha = a;
      g.drawImage(T.cv, -T.ox * k, -T.oy * k, T.cv.width * k, T.cv.height * k);
      if (a !== undefined) g.globalAlpha = 1;
    }

    /* ---------- Partikel ----------
       Ein Ballen ist innen dicht, aussen zerfranst und beschattet sich
       selbst. Ein glatter Radialverlauf gibt eine Perlenkette; die Struktur
       kommt deshalb aus dem Rauschfeld, und es gibt vier Varianten, damit
       sich nicht dasselbe Sprite hundertfach wiederholt. */
    const PUFFCOL = {
      dust:  [206, 152, 116],
      steam: [242, 248, 255],
      soot:  [ 78,  70,  68],
    };
    const PUFFS = {};
    function puffSprite(kind, v) {
      const id = kind + v;
      if (PUFFS[id]) return PUFFS[id];
      const S = 96, cv = document.createElement("canvas");
      cv.width = cv.height = S;
      const c = cv.getContext("2d");
      const im = c.createImageData(S, S), d = im.data;
      const col = PUFFCOL[kind] || PUFFCOL.dust;
      const GA = grimeField(), ox = v * 67, oy = v * 113;
      for (let y = 0; y < S; y++) {
        const dy = (y - S / 2) / (S / 2);
        for (let x = 0; x < S; x++) {
          const dx = (x - S / 2) / (S / 2);
          const r = Math.sqrt(dx * dx + dy * dy);
          if (r >= 1) continue;
          const n = GA[(((y * 2 + oy) & 255) << 8) | ((x * 2 + ox) & 255)];
          let a = Math.pow(1 - r, 1.35) * (.35 + 1.30 * n) * (1 - r * r * r);
          const sh = .58 + .70 * (n - .45) - .40 * dy;   /* von oben beleuchtet */
          const o = (y * S + x) * 4;
          d[o]     = Math.min(255, col[0] * sh);
          d[o + 1] = Math.min(255, col[1] * sh);
          d[o + 2] = Math.min(255, col[2] * sh);
          d[o + 3] = a < 0 ? 0 : a > 1 ? 255 : a * 255;
        }
      }
      c.putImageData(im, 0, 0);
      PUFFS[id] = cv;
      return cv;
    }
    function puff(g, kind, v, x, y, r, a) {
      if (a < .004 || r <= 0) return;
      g.globalAlpha = a > 1 ? 1 : a;
      g.drawImage(puffSprite(kind, v & 3), x - r, y - r, r * 2, r * 2);
      g.globalAlpha = 1;
    }
    /* Partikelzahl nach Effektstufe. In "Aus" und bei reduzierter Bewegung
       bleibt alles stehen. */
    function fxAmt() {
      const t = html.dataset.fx;
      return reduced() || t === "s" ? 0 : t === "m" ? .55 : 1;
    }

    /* Zwei Schatten je Objekt: ein kurzer harter Kontaktschatten an der
       Auflagekante — der Unterschied zwischen "schwebt" und "steht" — plus
       ein langer weicher Formschatten vom Licht weg. */
    function marsShadow(g, cx, y, rx, ry, a) {
      g.save();
      g.globalAlpha = a * .55;
      g.fillStyle = dayMode() ? "rgb(74 34 22)" : "rgb(16 8 10)";
      g.beginPath(); g.ellipse(cx - rx * 1.5, y, rx * 2.6, ry * 1.5, 0, 0, 6.283); g.fill();
      g.globalAlpha = a;
      g.beginPath(); g.ellipse(cx, y, rx, ry, 0, 0, 6.283); g.fill();
      g.restore();
    }

    /* ============================================================
       Rover — Perseverance, massstaeblich
       Koerper 3,0 m lang, Raeder 52,5 cm Durchmesser, Rocker-Bogie ohne
       Federn. Die Kinematik bleibt, wie sie war, und sie ist der Grund,
       warum er ueber Steine kippelt statt zu huepfen: jedes Rad tastet das
       Bodenprofil an SEINER Stelle ab, der Wagenkasten nimmt Hoehe und
       Neigung aus dem Mittel.
       ============================================================ */
    function paintRover(g, cx, baseY, S, secs, sp) {
      const M = MB;
      const rw = S * .175;
      const amp = S * .17;
      const wp = [-.80, .02, .80];
      const ys = [], wx = [];
      for (let i = 0; i < 3; i++) { wx.push(cx + wp[i] * S); ys.push(baseY + marsTerrain(wx[i], amp)); }
      const gy = (ys[0] + ys[1] + ys[2]) / 3;
      const tilt = Math.atan2(ys[2] - ys[0], (wp[2] - wp[0]) * S);
      const cs = Math.cos(tilt), sn = Math.sin(tilt);
      const PT = (ux, uy) => [cx + (ux * cs - uy * sn) * S, gy + (ux * sn + uy * cs) * S];
      const amt = fxAmt();

      /* Fahrspur: der Staub behaelt die Stollenabdruecke eine Weile. */
      if (amt > 0) {
        g.save(); g.globalAlpha = .10;
        g.fillStyle = dayMode() ? "rgb(96 52 34)" : "rgb(20 12 12)";
        for (let i = 1; i < 9; i++) {
          const tx = wx[0] - i * rw * .95 * Math.sign(roverV || 1);
          const ty = baseY + marsTerrain(tx, amp) + rw * .06;
          g.beginPath(); g.ellipse(tx, ty, rw * .38, rw * .13, 0, 0, 6.283); g.fill();
        }
        g.restore();
      }

      /* Staubfahne hinter den Raedern — nur, wenn er sich wirklich bewegt */
      const dust = Math.min(1, Math.abs(roverV) * .06) * amt;
      if (dust > .02) {
        const n = amt > .8 ? 7 : 4;
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          const dx = cx - Math.sign(roverV || 1) * S * (.9 + t * 2.2);
          const dy = ys[0] + rw * .5 - t * t * S * .20;
          puff(g, "dust", i, dx, dy, S * (.07 + t * .34), .17 * dust * (1 - t));
        }
      }

      /* Schatten: erst der lange weiche, dann die harten Kontaktflecken */
      marsShadow(g, cx, gy + rw * .10, S * .95, rw * .20, dayMode() ? .30 : .42);
      for (let i = 0; i < 3; i++) {
        g.save();
        g.globalAlpha = dayMode() ? .40 : .52;
        g.fillStyle = dayMode() ? "rgb(58 26 18)" : "rgb(10 5 7)";
        g.beginPath(); g.ellipse(wx[i], ys[i] + rw * .06, rw * .62, rw * .16, 0, 0, 6.283); g.fill();
        g.restore();
      }

      /* Die drei Raeder der ABGEWANDTEN Seite, versetzt und abgedunkelt —
         daran liest man, dass es sechs sind. */
      if (M.wheel) for (let i = 0; i < 3; i++) drawWheel(g, M, wx[i] + S * .155, ys[i] - rw - S * .070, S, .60);
      /* Aufhaengung */
      drawSuspension(g, PT, wx, ys, rw, S);
      /* Wagenkasten */
      g.save(); g.translate(cx, gy); g.rotate(tilt);
      blit(g, M.rover, S);
      /* Roboterarm: er dreht langsam um die Schulter, wie ein echter Arm,
         der eine Probe absetzt — nicht wie ein Pendel. */
      const sw = Math.sin(secs * .32) * .13 + Math.sin(secs * .11 + 2) * .07;
      g.translate(.86 * S, -.56 * S); g.rotate(sw - .10);
      blit(g, M.arm, S);
      g.restore();
      /* Raeder der zugewandten Seite */
      if (M.wheel) for (let i = 0; i < 3; i++) drawWheel(g, M, wx[i], ys[i] - rw, S, 1);
    }

    function drawWheel(g, M, x, y, S, dim) {
      const k = S / M.wheel.upx, r = M.wheel.r * k;
      g.save();
      g.translate(x, y);
      if (dim < 1) g.globalAlpha = dim;
      g.rotate(roverRot);
      g.drawImage(M.wheel.cv, -r, -r, r * 2, r * 2);
      g.rotate(-roverRot);
      /* Die Lichtstimmung dreht sich NICHT mit: sie kommt als stehende
         Ebene darueber, sonst wandert der Kernschatten mit dem Rad. */
      if (M.wheelL) {
        g.drawImage(M.wheelL.shade, -r, -r, r * 2, r * 2);
        g.globalCompositeOperation = "lighter";
        g.drawImage(M.wheelL.lit, -r, -r, r * 2, r * 2);
        g.globalCompositeOperation = "source-over";
      }
      if (dim < 1) {
        g.globalAlpha = .34; g.fillStyle = "rgb(18 10 12)";
        g.beginPath(); g.arc(0, 0, r * .92, 0, 6.283); g.fill();
      }
      g.restore();
    }

    /* Rocker-Bogie als Rohrwerk: dunkler Kern, heller Koerper, schmales
       Glanzlicht auf der Lichtseite. Drei Striche statt einem — ein
       einzelner Strich ist eine Linie, drei sind ein Rohr. */
    function drawSuspension(g, PT, wx, ys, rw, S) {
      const RP = PT(-.10, -.50);
      const BP = [(wx[1] + wx[2]) / 2, (ys[1] + ys[2]) / 2 - rw - S * .22];
      const segs = [
        [RP, [wx[0], ys[0] - rw]],
        [RP, BP],
        [BP, [wx[1], ys[1] - rw]],
        [BP, [wx[2], ys[2] - rw]],
      ];
      const L = marsLight();
      g.save(); g.lineCap = "round";
      for (const [c0, wd, dx, dy] of [
        ["rgb(38 30 30 / .75)", .062, 0, 0],
        [`rgb(${Math.round(148 * L.gain)} ${Math.round(146 * L.gain)} ${Math.round(142 * L.gain)})`, .046, 0, 0],
        [`rgb(${L.rim[0]} ${L.rim[1]} ${L.rim[2]} / ${(.55 * L.rimI + .18).toFixed(2)})`, .016, -.010, -.013],
      ]) {
        g.strokeStyle = c0; g.lineWidth = Math.max(1, wd * S);
        g.beginPath();
        for (const [p, q] of segs) { g.moveTo(p[0] + dx * S, p[1] + dy * S); g.lineTo(q[0] + dx * S, q[1] + dy * S); }
        g.stroke();
      }
      /* Drehpunkte */
      g.fillStyle = "rgb(96 92 90)";
      for (const p of [RP, BP]) { g.beginPath(); g.arc(p[0], p[1], S * .045, 0, 6.283); g.fill(); }
      g.fillStyle = `rgb(${L.rim[0]} ${L.rim[1]} ${L.rim[2]} / .5)`;
      for (const p of [RP, BP]) { g.beginPath(); g.arc(p[0] - S * .012, p[1] - S * .014, S * .020, 0, 6.283); g.fill(); }
      g.restore();
    }

    /* ============================================================
       Rakete — Startsequenz nach dem echten Ablauf, nicht nach einer Kurve

         0.000-0.055  auf dem Startmount, Abblasen (Boil-off aus den Tanks)
         0.055-0.095  Zuendsequenz: die Glocken glimmen, Staub wirbelt auf
         0.095-0.150  Schub baut auf, Niederhalter noch zu: der Strahl wird
                      vom Mount SEITLICH abgelenkt (Flammengraben)
         0.150-0.360  Abheben. Ein Traeger mit Schub-Gewicht-Verhaeltnis
                      knapp ueber 1 kriecht die ersten Sekunden.
         0.360-0.470  Drosselung im Staudruckmaximum: die Flamme wird kurz
                      sichtbar kuerzer — der einzige Moment eines Starts, den
                      man an der Flamme ablesen kann.
         0.470-0.600  Stufentrennung: Schubabbruch, Trennimpuls, Unterstufe
                      kippt weg und faellt zurueck
         0.600-1.000  Oberstufe im Vakuum. Kein Staub mehr, keine Rauten.
       ============================================================ */
    function rocketPhase(sp) {
      const seg = (a, b) => Math.max(0, Math.min(1, (sp - a) / (b - a)));
      const vent   = 1 - seg(.045, .075);
      const preign = seg(.055, .095);
      const build  = seg(.095, .150);
      const fly    = seg(.150, 1);
      const climb  = Math.pow(fly, 1.22) * .84 + Math.pow(fly, 2.6) * .16;
      const maxq   = 1 - .42 * Math.sin(Math.PI * Math.max(0, Math.min(1, (sp - .36) / .11)));
      const sepT   = Math.max(0, Math.min(1, (sp - .47) / .13));
      const sep    = sepT > 0 && sepT < 1 ? Math.sin(Math.PI * sepT) : 0;
      const vac    = seg(.60, .78);
      return { vent, preign, build, fly, climb, maxq, sep, sepT, vac };
    }
    /* Schub zu einem BELIEBIGEN Zeitpunkt. Die Staubsaeule fragt ihn fuer
       jeden Ballen zu dessen Entstehungszeitpunkt ab — dadurch steht die
       Schubgeschichte sichtbar in der Saeule: dick beim Abheben, duenn im
       Drosselfenster, mit einer Luecke an der Stufentrennung. */
    function rocketThrust(sp) {
      const q = rocketPhase(sp);
      return Math.max(0, Math.min(1, q.preign * .25 + q.build * .75)) * q.maxq * (1 - q.sep * .92);
    }

    /* ---------- Abgasstrahl ----------
       Methan-Sauerstoff: die Verbrennung ist weitgehend DURCHSCHEINEND und
       blaeulich mit hell leuchtender Stossstruktur. Das kraeftige Orange
       kennt man von kerosingetriebenen Triebwerken, wo Russ glueht — hier
       gaebe es keinen. Der aeussere Saum laeuft ins Magenta: bei
       sauerstoffreicher Verbrennung physikalisch vertretbar und der Punkt,
       an dem die Rakete unverwechselbar wird.

       Gezeichnet wird die Fahne NICHT als Polygonzug: ein gefuellter Pfad hat
       eine harte Kante, und eine harte Kante ist das Gegenteil von Gas. Sie
       besteht aus additiv ueberlagerten weichen Keulen entlang der Achse —
       vier Schalen von aussen (magenta) nach innen (weissgluehend). */
    const FLAMECOL = { mag: "232 84 188", blu: "92 148 255", hot: "168 210 255", core: "255 252 244" };
    const FLAMES = {};
    function flameSprite(k) {
      if (FLAMES[k]) return FLAMES[k];
      const S = 64, cv = document.createElement("canvas");
      cv.width = cv.height = S;
      const c = cv.getContext("2d");
      const col = FLAMECOL[k];
      const gr = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      gr.addColorStop(0, `rgb(${col} / 1)`);
      gr.addColorStop(.30, `rgb(${col} / .72)`);
      gr.addColorStop(.60, `rgb(${col} / .34)`);
      gr.addColorStop(.84, `rgb(${col} / .09)`);
      gr.addColorStop(1, `rgb(${col} / 0)`);
      c.fillStyle = gr; c.fillRect(0, 0, S, S);
      FLAMES[k] = cv;
      return cv;
    }

    function paintPlume(g, R, ny, thrust, secs, P, amt, groundLocal) {
      if (thrust <= .012) return;
      const flick = .90 + .07 * Math.sin(secs * 41) + .05 * Math.sin(secs * 67 + 1.3);
      const grounded = P.fly < .02;
      /* Aussendruck Mars: rund 6 mbar, 0,6 % des irdischen. Die Duese ist
         damit von der ersten Sekunde an stark unterexpandiert — die Fahne
         blaeht sofort auf und steht NIE als schlanker Strahl. Das ist der
         auffaelligste Unterschied zu jedem Startvideo von der Erde. */
      const bloom = 1.85 + 1.5 * P.vac;
      const kW = R * .062;
      const FL = R * (.34 + 1.55 * thrust) * (grounded ? .30 : 1) * flick;
      const turb = u => 1
        + .16 * Math.sin(u * 13 - secs * 22) * u
        + .10 * Math.sin(u * 27 - secs * 34 + 1.7) * u
        + .06 * Math.sin(u * 41 - secs * 51 + .4) * u * u;
      const shape = u => (.90 + bloom * Math.sin(Math.PI * Math.pow(u, .22))) * (1 - .40 * u * u);

      g.save();
      /* Der Strahl endet am Boden — darunter steht der Flammengraben, nicht
         die Fahne. Ohne diesen Schnitt laeuft sie durch die Rampe hindurch. */
      if (groundLocal !== undefined && groundLocal < ny + FL * 1.2) {
        g.beginPath();
        g.rect(-R * 6, ny - R * 4, R * 12, groundLocal - ny + R * 4);
        g.clip();
      }
      g.globalCompositeOperation = "lighter";
      const N = amt > .8 ? 7 : 5;
      const shells = amt > .8
        ? [["mag", 1.78, 1.16, .40], ["blu", 1.22, 1.00, .44], ["core", .34, .40, .40]]
        : [["blu", 1.30, 1.02, .52], ["core", .34, .40, .40]];
      for (const [k, kx, ext, a0] of shells) {
        const sp = flameSprite(k);
        for (let i = 0; i < N; i++) {
          const u = (i + .45) / N;
          const ww = kW * kx * shape(u) * turb(u);
          const yy = ny + FL * ext * u;
          const hh = FL * ext / N * 3.0;
          const a = a0 * thrust * Math.pow(1 - u, .45) * (.30 + .70 * Math.sin(Math.PI * Math.pow(u, .55)));
          if (a < .004) continue;
          g.globalAlpha = a;
          g.drawImage(sp, -ww, yy - hh * .5, ww * 2, hh);
        }
      }
      g.globalAlpha = 1;

      /* Duesenhals: ueber 3000 K, weissgluehend. Ohne diesen Kern bleibt jede
         Flamme ein farbiger Lappen. */
      const th = g.createRadialGradient(0, ny + R * .008, 0, 0, ny + R * .008, kW * 1.6);
      th.addColorStop(0,   `rgb(255 255 254 / ${(.95 * thrust).toFixed(2)})`);
      th.addColorStop(.28, `rgb(212 236 255 / ${(.66 * thrust).toFixed(2)})`);
      th.addColorStop(.68, `rgb(128 150 255 / ${(.22 * thrust).toFixed(2)})`);
      th.addColorStop(1,   "rgb(180 90 220 / 0)");
      g.fillStyle = th;
      g.beginPath(); g.arc(0, ny + R * .008, kW * 1.6, 0, 6.283); g.fill();

      /* Blendhof. Nachts ist die Fahne die hellste Quelle im Bild; eine
         Lichtquelle ohne Streuhof liest als ausgeschnittene Form. */
      const bly = ny + FL * .14, blr = FL * (amt > .8 ? .42 : .28);
      g.globalAlpha = .30 * thrust;
      g.drawImage(flameSprite("blu"), -blr, bly - blr, blr * 2, blr * 2);
      g.globalAlpha = .16 * thrust;
      g.drawImage(flameSprite("mag"), -blr * .78, bly - blr * .78, blr * 1.56, blr * 1.56);
      g.globalAlpha = 1;

      /* Mach'sche Rauten entstehen an Druckspruengen im Strahl und nur,
         solange ueberhaupt Aussendruck da ist; ihr ABSTAND waechst mit dem
         Druckverhaeltnis, also mit der Hoehe. Im Vakuum verschwinden sie
         ganz. Bei 6 mbar sind es entsprechend wenige und sehr grosse Zellen. */
      const amb = 1 - P.vac;
      if (amb > .06 && !grounded) {
        for (let i = 1; i <= 2; i++) {
          const u = (.18 + .30 * P.vac) * i;
          if (u > .80) break;
          const yy = ny + FL * u, ww = kW * shape(u) * .60;
          const gl = g.createRadialGradient(0, yy, 0, 0, yy, ww);
          gl.addColorStop(0, `rgb(255 255 250 / ${(.40 / i * amb * thrust).toFixed(3)})`);
          gl.addColorStop(.5, `rgb(196 224 255 / ${(.16 / i * amb * thrust).toFixed(3)})`);
          gl.addColorStop(1, "rgb(150 190 255 / 0)");
          g.fillStyle = gl;
          g.beginPath(); g.ellipse(0, yy, ww, FL * .055, 0, 0, 6.283); g.fill();
        }
      }
      g.restore();
    }

    function paintRocket(g, sp, secs, padX, padY, R, tgt) {
      const P = rocketPhase(sp), M = MB, amt = fxAmt();
      /* Der Duesenaustritt sitzt auf dem Mount, nicht im Boden — sonst
         verschwindet der Strahl in der Rampe statt in den Flammengraben. */
      const y0 = padY - R * .565;
      const x = padX + (tgt.x - padX) * Math.pow(P.fly, 2.2);
      const y = y0 - (y0 - tgt.y) * P.climb;
      const lean = Math.atan2(tgt.x - padX, y0 - tgt.y) * Math.pow(P.fly, 2.2);
      const thrust = rocketThrust(sp);
      /* Nach der Trennung sitzt die Duese der Oberstufe viel weiter oben */
      const noz = R * (.50 - .438 * Math.min(1, P.sepT * 5));

      /* ---------- Startturm, Mount und Flammengraben ----------
         Der Turm steht HINTER der Rakete und bleibt beim Aufstieg zurueck —
         er ist das Einzige im Bild, an dem Hoehe und Massstab ablesbar sind. */
      if (M.tower) {
        g.save(); g.translate(padX + R * .30, padY);
        blit(g, M.tower, R);
        g.restore();
      }
      /* Startmount mit Niederhaltern. Er bleibt stehen, auch nach dem Start. */
      g.save();
      const mTop = padY - R * .065, LT = marsLight();
      /* Kontaktschatten: er macht aus "schwebt" ein "steht". */
      g.globalAlpha = dayMode() ? .34 : .48;
      g.fillStyle = dayMode() ? "rgb(58 26 18)" : "rgb(10 5 7)";
      g.beginPath(); g.ellipse(padX - R * .07, padY + R * .006, R * .30, R * .030, 0, 0, 6.283); g.fill();
      g.globalAlpha = 1;
      /* Betonsockel mit Verlauf statt Vollton — ein flacher Block liest als
         ausgeschnittenes Rechteck. */
      const mg = g.createLinearGradient(0, mTop, 0, padY);
      mg.addColorStop(0, dayMode() ? "rgb(134 104 86)" : "rgb(58 44 42)");
      mg.addColorStop(1, dayMode() ? "rgb(72 50 40)" : "rgb(22 16 16)");
      g.fillStyle = mg;
      g.beginPath();
      g.moveTo(padX - R * .155, mTop); g.lineTo(padX + R * .155, mTop);
      g.lineTo(padX + R * .185, padY); g.lineTo(padX - R * .185, padY);
      g.closePath(); g.fill();
      /* Deckplatte mit Flammenloch */
      g.fillStyle = dayMode() ? "rgb(158 122 98)" : "rgb(74 57 54)";
      g.fillRect(padX - R * .168, mTop - R * .013, R * .336, R * .017);
      g.fillStyle = `rgb(${LT.rim[0]} ${LT.rim[1]} ${LT.rim[2]} / ${(.30 * LT.rimI + .16).toFixed(2)})`;
      g.fillRect(padX - R * .168, mTop - R * .015, R * .336, Math.max(1, R * .005));
      g.fillStyle = "rgb(10 7 7 / .9)";
      g.beginPath(); g.ellipse(padX, mTop + R * .002, R * .072, R * .013, 0, 0, 6.283); g.fill();
      /* Niederhalter */
      for (const s of [-1, 1]) {
        g.fillStyle = dayMode() ? "rgb(126 98 82)" : "rgb(52 40 39)";
        g.fillRect(padX + s * R * .086 - R * .011, mTop - R * .052, R * .022, R * .052);
        g.fillStyle = `rgb(${LT.rim[0]} ${LT.rim[1]} ${LT.rim[2]} / .3)`;
        g.fillRect(padX + s * R * .086 + R * .006, mTop - R * .052, Math.max(1, R * .004), R * .052);
      }
      g.restore();

      /* ---------- Abdampf aus den Ventilen ----------
         Der weisse Schwaden bei irdischen Starts kommt aus der Wasser-
         berieselung zur Schallschutzdaempfung — die gibt es hier nicht.
         ECHTEN Dampf gibt es trotzdem: die kryogenen Tanks sieden ab, und
         dieser Abdampf faellt an der Flanke TRAEGE NACH UNTEN, weil er
         kaelter und dichter ist als die Umgebung. */
      if (P.vent > .02 && P.fly < .03 && amt > 0) {
        const n = amt > .8 ? 6 : 4;
        for (let i = 0; i < n; i++) {
          const t = (secs * .30 + i / n) % 1;
          const s = i % 2 ? 1 : -1;
          const vx = x + s * (R * .082 + t * R * .055);
          const vy = y - R * .21 + t * t * R * .40;
          puff(g, "steam", i, vx, vy, R * (.015 + t * .062), .34 * P.vent * (1 - t) * (1 - t));
        }
      }

      /* ---------- Bodenstaub ----------
         Er bleibt UNTEN stehen, waehrend die Rakete steigt: Staub hat keinen
         Antrieb. Solange die Niederhalter geschlossen sind, wird der Strahl
         am Mount seitlich abgelenkt — die Wolke schiesst flach nach beiden
         Seiten. Und weil die Schwerkraft hier nur 3,71 m/s2 betraegt und die
         Luft duenn ist, faellt der Staub langsamer und haengt laenger. */
      if (P.preign > 0 && amt > 0) {
        const age = Math.max(0, sp - .075);
        const grow = Math.min(1, age * 3.0);
        const fade = Math.max(0, 1 - Math.max(0, age - .46) * 1.6);
        const flat = P.fly < .02 ? .30 : .78;
        /* Der Staub ist nachts nur durch die Flamme beleuchtet — er wird
           also mit dem Schub hell, nicht mit der Zeit. */
        const lit = .45 + 1.35 * rocketThrust(sp);
        const N = amt > .8 ? 14 : 8;
        for (let i = 0; i < N; i++) {
          const t = i / (N - 1);
          const s = i % 2 ? 1 : -1;
          const hs = Math.sin(i * 12.9898) * 43758.5453, rnd = hs - Math.floor(hs);
          const dx = padX + s * R * (.06 + t * 1.35) * grow + (rnd - .5) * R * .10;
          const dy = padY - R * .03 - Math.pow(t, 1.25) * R * .40 * grow * flat + (rnd - .5) * R * .04;
          puff(g, "dust", i, dx, dy, R * (.06 + t * .26) * grow * (.7 + rnd * .6),
               .30 * lit * fade * (1 - t * .5) * (.6 + rnd * .7));
        }
      }

      /* ---------- Staubsaeule laengs der Bahn ---------- */
      if (P.fly > 0 && amt > 0) {
        const air = 1 - P.vac;
        const N = amt > .8 ? 20 : 12;
        for (let i = 0; i < N; i++) {
          const t = i / (N - 1);
          const spE = .15 + (sp - .15) * (1 - t);
          const thE = rocketThrust(spE);
          const c = Math.pow(P.fly * (1 - t), 1.22) * .84 + Math.pow(P.fly * (1 - t), 2.6) * .16;
          const hs = Math.sin(i * 12.9898) * 43758.5453, rnd = hs - Math.floor(hs);
          const roll = Math.sin(t * 7.5 + i * .9) * (.5 + rnd);
          const px = padX + (tgt.x - padX) * Math.pow(P.fly * (1 - t), 2.2)
                   + roll * R * .13 * Math.pow(t, .7) + (rnd - .5) * R * .08;
          const py = y0 - (y0 - tgt.y) * c + (rnd - .5) * R * .04;
          const rr = R * (.035 + t * .21) * (.55 + thE * .8) * (.7 + rnd * .6);
          const dens = thE * thE;
          const a = .40 * dens * Math.pow(1 - t, .9) * (.6 + rnd * .8)
                  * Math.min(1, P.fly * 3) * (t > .65 ? 1 : air + (1 - air) * .25);
          puff(g, "dust", i, px, py, rr, a);
        }
      }

      /* ---------- abgetrennte Unterstufe ----------
         Sie bekommt beim Trennen einen Impuls, kippt aus der Bahn und faellt
         zurueck. Ohne dieses Wegkippen liest die Trennung als Schnittfehler. */
      if (P.sepT > 0 && M.booster) {
        const t = P.sepT;
        const bx = x - Math.sin(lean) * R * (.42 + t * .3) - t * R * .55;
        const by = y + Math.cos(lean) * R * .30 + t * t * R * 2.6;
        g.save();
        g.translate(bx, by);
        g.rotate(lean + t * 1.5);
        g.globalAlpha = Math.max(0, 1 - t * 1.1);
        blit(g, M.booster, R);
        g.restore();
        g.globalAlpha = 1;
      }

      /* ---------- Lichtschein der Flamme auf dem Boden ---------- */
      if (thrust > .05 && P.fly < .20) {
        const f = thrust * (1 - P.fly / .20), gr3 = R * (amt > .8 ? 1.15 : .78);
        g.save(); g.globalCompositeOperation = "lighter";
        g.globalAlpha = .30 * f;
        g.drawImage(flameSprite("blu"), padX - gr3, padY - gr3 * .55, gr3 * 2, gr3 * 1.10);
        g.globalAlpha = .14 * f;
        g.drawImage(flameSprite("mag"), padX - gr3 * 1.15, padY - gr3 * .40, gr3 * 2.3, gr3 * .80);
        g.restore();
      }

      /* ---------- Rakete ---------- */
      g.save();
      g.translate(x, y);
      g.rotate(lean);

      /* Am Mount abgelenkt: zwei flache Strahlen in den Flammengraben */
      if (thrust > .03) {
        g.save(); g.globalCompositeOperation = "lighter";
        for (const s of [-.038, 0, .038]) {
          const gy2 = R * .512, gr2 = g.createRadialGradient(s * R, gy2, 0, s * R, gy2, R * .034);
          gr2.addColorStop(0, `rgb(255 236 210 / ${(.55 * thrust).toFixed(2)})`);
          gr2.addColorStop(1, "rgb(255 150 90 / 0)");
          g.fillStyle = gr2;
          g.beginPath(); g.arc(s * R, gy2, R * .034, 0, 6.283); g.fill();
        }
        g.restore();
      }
      if (thrust > .02 && P.fly < .04) {
        /* Solange die Niederhalter zu sind, geht der Strahl in den
           Flammengraben und schiesst FLACH nach beiden Seiten heraus. Auch
           das aus weichen Keulen: eine gefuellte Kurve haette eine Kante,
           und eine Kante ist das Gegenteil von Gas. */
        g.save(); g.globalCompositeOperation = "lighter";
        const gy3 = R * (.565 - .04);
        for (const side of [-1, 1]) {
          for (const [k, a0, ky] of (amt > .8 ? [["mag", .20, .085], ["blu", .24, .055]] : [["blu", .30, .070]])) {
            const spr = flameSprite(k);
            for (let i = 0; i < 5; i++) {
              const u = (i + .5) / 5;
              const rx = R * (.10 + u * .52), ry = R * ky * (.45 + u);
              const cx2 = side * R * (.06 + u * .86);
              const cy2 = gy3 - R * .012 - u * u * R * .05;
              g.globalAlpha = a0 * thrust * (1 - u * .72);
              g.drawImage(spr, cx2 - rx, cy2 - ry, rx * 2, ry * 2);
            }
          }
        }
        g.globalAlpha = 1;
        g.restore();
      }
      paintPlume(g, R, noz, thrust, secs, P, amt,
                 P.fly < .05 ? (padY - y) / Math.max(.2, Math.cos(lean)) + R * .10 : undefined);
      /* Oberstufe zuerst, die Unterstufe verdeckt danach deren Triebwerke —
         genau so sitzt ein Zwischenstufenring. */
      blit(g, M.ship, R);
      if (P.sepT <= 0) blit(g, M.booster, R);
      paintRider(g, R, secs);
      g.restore();

      /* Vordergrund-Staubbank. Sie liegt VOR dem Strahlfuss und verschluckt
         ihn — auf echten Startaufnahmen sieht man den unteren Meter der
         Flamme nie, er steht in der aufgewirbelten Wolke. Auf dem Mars ist
         das Staub, nicht der weisse Dampf irdischer Berieselungsanlagen. */
      if (P.preign > 0 && P.fly < .42 && amt > 0) {
        const age = Math.max(0, sp - .075);
        const dens = Math.min(1, age * 4) * Math.max(0, 1 - Math.max(0, age - .30) * 2.2);
        const N = amt > .8 ? 8 : 5;
        for (let i = 0; i < N; i++) {
          const t = i / (N - 1);
          const hs = Math.sin(i * 78.233) * 43758.5453, rnd = hs - Math.floor(hs);
          const s2 = i % 2 ? 1 : -1;
          const dx = padX + s2 * R * (.05 + t * 1.15) + (rnd - .5) * R * .14;
          const dy = padY - R * (.02 + Math.pow(t, 1.4) * .22) + (rnd - .5) * R * .05;
          puff(g, "dust", i + 1, dx, dy, R * (.10 + t * .24) * (.8 + rnd * .5),
               .46 * (.5 + 1.2 * thrust) * dens * (1 - t * .40) * (.6 + rnd * .7));
        }
      }
    }

    /* Die Figur auf der Spitze. Bewusst Karikatur: der Kopf ist eine
       freigestellte CC-BY-Zeichnung (Nachweis in der README), der Rest sind
       drei Striche im Druckanzug. Ein fotorealistisches Gesicht einer real
       existierenden Person hat auf einer Website nichts verloren. */
    let elonImg = null, elonTried = false;
    function elonHead() {
      if (elonTried) return elonImg;
      elonTried = true;
      const im = new Image();
      im.decoding = "async";
      im.onload = () => { elonImg = im; };
      im.src = "/img/elon-head.webp";
      return null;
    }
    function paintRider(g, R, secs) {
      /* Wackelkopf-Prinzip: winziger Anzugkoerper, riesiger Karikaturkopf.
         Der Kopf ist absichtlich breiter als die Rakete — das ist die Pointe,
         und es ist zugleich die ehrlichste Loesung: ein massstaeblicher
         Passagier waere bei dieser Raketenhoehe drei Pixel gross. */
      const hw = R * .105, hh = hw * 2 * (553 / 440);
      const base = -R * .500;                 /* Kinn sitzt auf der Spitze */
      const wave = Math.sin(secs * 3.4) * .40;
      g.save();
      /* Koerper: Beine links und rechts der Spitze, ein winkender Arm */
      g.strokeStyle = "rgb(40 42 52)";
      g.lineCap = "round";
      g.lineWidth = Math.max(1.2, hw * .22);
      g.beginPath();
      g.moveTo(0, base + hw * .10); g.lineTo(hw * .62, base + hw * .95);
      g.moveTo(0, base + hw * .10); g.lineTo(-hw * .55, base + hw * 1.00);
      g.stroke();
      g.fillStyle = "rgb(46 48 60)";
      g.beginPath(); g.ellipse(0, base - hw * .04, hw * .44, hw * .34, 0, 0, 6.283); g.fill();
      const im = elonHead();
      if (im) g.drawImage(im, -hw, base - hh + hw * .34, hw * 2, hh);
      else {
        g.fillStyle = "rgb(226 198 178)";
        g.beginPath(); g.ellipse(0, base - hh * .5, hw * .92, hh * .46, 0, 0, 6.283); g.fill();
      }
      /* Der winkende Arm kommt NACH dem Kopf — sonst steckt er dahinter. */
      g.strokeStyle = "rgb(46 48 60)";
      g.lineWidth = Math.max(1.1, hw * .20);
      g.beginPath();
      g.moveTo(hw * .55, base - hw * .05);
      g.lineTo(hw * (1.30 + wave), base - hw * (.95 + wave * .6));
      g.stroke();
      g.fillStyle = "rgb(52 54 66)";
      g.beginPath();
      g.arc(hw * (1.30 + wave), base - hw * (.95 + wave * .6), hw * .16, 0, 6.283);
      g.fill();
      g.restore();
    }

    /* Fahrposition und Radwinkel des Rovers. Beides wird integriert, nicht
       aus dem Scroll gerechnet: so laeuft er weich aus, statt am Scrollrad zu
       kleben — und die Raeder drehen sich genau so weit, wie er faehrt. */
    let roverX = null, roverV = 0, roverRot = 0;

    function paintMarsFX(g, secs, sp, dt) {
      if (!groundTopY) return;
      /* S ist die Rover-Einheit: 1 S = 1,5 m, der Wagenkasten ist 2 S lang. */
      const S = Math.max(14 * DPR, Math.min(w * .048, h * .070));
      const baseY = groundTopY + (h - groundTopY) * .46;
      /* Der Auftraggeber hat ausdruecklich eine GROSSE Rakete verlangt. Ein
         zwischenzeitlich eingebautes .190 hat sie auf Briefmarkengroesse
         gebracht — zurueck auf einen Wert, bei dem sie das Bild traegt.
         Die Breitenschranke bleibt, damit sie auf schmalen Schirmen nicht
         ueber den halben Bildschirm laeuft. */
      /* Groesse bewusst zurueckhaltend: die Rakete steht jetzt im rechten
         Rand NEBEN der Inhaltsspalte, wo die Vignette sie nicht mehr
         abdunkelt — dort wirkt dieselbe Hoehe deutlich groesser als vorher
         hinter den Karten. */
      /* Die Groesse ist mehrfach hin und her gegangen. Endstand nach
         ausdruecklicher Ansage des Auftraggebers: klein. Sie ist Teil der
         Szene, nicht ihr Hauptdarsteller — der Turm daneben liefert den
         Massstab, und beides zusammen soll die Karten nicht ueberlagern.
         Die Breitenschranke bindet auf schmalen Anzeigen statt der Hoehe;
         dort bleibt sie eine Silhouette am Rand. */
      const RH = Math.min(h * .082, w * .046);
      /* Hoechstens EIN Objekt pro Bild backen — der Rest wird nur kopiert.
         Ausnahme: in Stufe "Aus" (und bei reduzierter Bewegung) laeuft gar
         keine Schleife, dort muss der ganze Satz sofort stehen. */
      const once = fxAmt() === 0;
      do { marsBakes(S, RH); } while (once && MB.q.length);

      /* Ziel aus dem Scroll, Bewegung gedaempft (Traegheit) */
      /* Er faehrt von links ins Bild hinein, statt beim Laden schon
         mittendrin zu stehen. */
      const target = w * (-.16 + .78 * sp);
      if (roverX === null) roverX = target;
      const prev = roverX;
      roverX += (target - roverX) * .035;
      const step = roverX - prev;
      roverV = roverV * .8 + step * .2 * (dt ? 16 / dt : 1);
      roverRot += step / (S * .175);         /* Weg / Radradius = Drehwinkel */

      paintRover(g, roverX, baseY, S, secs, sp);

      /* ---- Rakete: Rampe steht rechts, Ziel ist Phobos ---- */
      const padX = w * .885;
      const padY = groundTopY + (h - groundTopY) * .40;
      /* Phobos wandert selbst mit dem Scroll — das Ziel wird deshalb aus
         derselben Formel geholt, mit der paintPhobos ihn setzt. */
      /* Ziel ist Phobos — aber leicht daneben, sonst parkt die Rakete genau
         auf ihm und verdeckt den Mond, auf den sie zufliegt. */
      const tgt = moon
        ? { x: moon.x + moon.drift * sp * -1.6 - moon.r * 1.6,
            y: moon.y + moon.rise * sp * .6 + moon.r * 1.5 }
        : { x: w * .8, y: h * .2 };
      paintRocket(g, sp, secs, padX, padY, RH, tgt);
    }

    function paintBeach(g) {
      const P = dayMode() ? BEACH.day : BEACH.night;

      /* ---- Geometrie ----
         Die Szene nimmt 40 % der Hoehe ein, etwas mehr als der Marsboden:
         das Wasser braucht Raum, sonst gibt es keine Tiefenstaffelung. */
      const SH = h * .40;
      const hy = Math.round(h - SH);                /* Horizontlinie        */
      const waterY = Math.round(hy + SH * .545);    /* mittlere Wasserkante */
      const wetH = Math.max(5 * DPR, h * .042);     /* nasser Sand: 4,2 %   */
      const sandY = Math.round(waterY + wetH);
      const span = Math.max(1, h - sandY);
      const sea = waterY - hy;
      const lightX = moon ? moon.x : w * .30;

      seaTop = hy; seaEnd = waterY;
      /* Glitzer-Streifen zuschneiden: von knapp ueber der Horizontlinie bis
         so weit den Strand hinauf, wie die Brandung laufen kann. */
      const stripTop = Math.max(0, hy - Math.round(sea * .06));
      const stripBot = Math.min(h, sandY + Math.round(span * .42));
      glintTop = stripTop;
      glintLayer.width = w; glintLayer.height = Math.max(1, stripBot - stripTop);
      glintLayer.style.top = (stripTop / DPR) + "px";
      glintLayer.style.height = ((stripBot - stripTop) / DPR) + "px";
      /* Sterne enden AN der Horizontlinie. Anders als beim Foto gibt es hier
         keine eingebackene Alpha-Rampe, also reicht ein kurzer Ausklang — und
         der ist ohnehin richtig: horizontnahe Sterne daempft die Atmosphaere
         (Extinktion), sie verschwinden nie hart. */
      blockSky(g, hy, h * .035);

      /* ---- 1 · Wasser ----
         Kein Verlaufsstapel mehr: die Flaeche wird pro Pixel aus Wellenfeld,
         Fresnel und Mondrichtung gerechnet (siehe paintSea). Alles, was
         darueber liegt — Dunst, Flachwasser, Brandung, Glitzer — kommt
         danach. */
      paintSea(g, P, hy, waterY, lightX, moon ? moon.y : hy - SH * .8);

      /* Reflexionskegel, weiter unten fuer Wellenlinien und Schlieren
         gebraucht: nur Facetten nahe der Vertikalebene durch Mond und Auge
         werfen Licht ins Auge. */
      const lobe = (x, t) => Math.exp(-Math.pow((x - lightX) / (sea * (.55 + 3.2 * t)), 2) * .9);

      /* ---- 7a · Ferndunst ueber der Horizontlinie ----
         #horizon liegt UEBER den Sternen, der Dunst daempft also die
         horizontnahen Sterne mit — genau das tut die Atmosphaere auch. Er ist
         der Grund, warum hier keine Horizontlinie gemalt werden muss: Himmel
         und Meer treffen sich in einem Tonwert. */
      const hazeTop = Math.max(0, hy - SH * 1.25);
      const hz = g.createLinearGradient(0, hazeTop, 0, hy);
      hz.addColorStop(0,   `rgb(${P.haze} / 0)`);
      hz.addColorStop(.50, `rgb(${P.haze} / ${(P.hazeA * .07).toFixed(3)})`);
      hz.addColorStop(.80, `rgb(${P.haze} / ${(P.hazeA * .28).toFixed(3)})`);
      hz.addColorStop(.94, `rgb(${P.haze} / ${(P.hazeA * .68).toFixed(3)})`);
      hz.addColorStop(1,   `rgb(${P.haze} / ${P.hazeA.toFixed(3)})`);
      g.fillStyle = hz;
      g.fillRect(0, hazeTop, w, hy - hazeTop);
      /* … und derselbe Dunst ein Stueck INS Wasser hinein, sonst steht die
         Kante doch wieder da. */
      const hz2 = g.createLinearGradient(0, hy, 0, hy + sea * .22);
      hz2.addColorStop(0, `rgb(${P.haze} / ${(P.hazeA * .55).toFixed(3)})`);
      hz2.addColorStop(1, `rgb(${P.haze} / 0)`);
      g.fillStyle = hz2;
      g.fillRect(0, hy, w, sea * .22);

      /* Die ferne Landzunge ist wieder entfallen. Sie sass genau auf der
         Nahtstelle zwischen Wasser und Sternenhimmel und las sich dort als
         Schatten ueber dem Wasser statt als Kueste — an dieser Kante darf
         nichts stehen, was Aufmerksamkeit zieht. */

      /* ---- 7b · Mondglanz auf dem Wasser ----
         Liegt zwingend in der Vertikalebene durch Lichtquelle und Auge, also
         exakt unter dem Mond — genau wie der Glitzerpfad darauf. */
      lightPool(g, lightX, hy + sea * .40, SH * 1.45, .34, P.glare, P.glareA);
      lightPool(g, lightX, hy + sea * .06, SH * .95, .10, P.haze, P.hazeA * .34);

      /* Das frueher hier liegende Flachwasser-Overlay ist entfallen: die
         Beer-Lambert-Rechnung in paintSea erzeugt den tuerkisen Uferstreifen
         jetzt aus der Tiefe. Ein zusaetzlicher Verlauf darueber hat ihn nur
         milchig gemacht. */

      /* ---- 2 · Nasser Sand ----
         Das wichtigste Einzelelement der Szene. Deutlich dunkler als
         trockener Sand — der Wasserfilm schliesst die Poren und schluckt das
         Streulicht — und kalt-violett statt braun, weil er den Himmel
         spiegelt. Der helle Saum an seiner Oberkante ist die stehende
         Wasserhaut; ridgeBand() bringt ihn schon mit. */
      const wetG = g.createLinearGradient(0, waterY, 0, sandY + wetH * .5);
      wetG.addColorStop(0,   `rgb(${P.wet[0]})`);
      wetG.addColorStop(.30, `rgb(${P.wet[0]})`);
      wetG.addColorStop(.74, `rgb(${P.wet[1]})`);
      wetG.addColorStop(1,   `rgb(${P.wet[1]})`);
      ridgeBand(g, beachNz, 3.1, waterY, SH * .030, w / 16, 4, wetG, P.wetRim);

      /* Spiegelbild des Mondes auf dem Wasserfilm — schmal und senkrecht,
         nicht rund. Nasser Sand ohne Spiegelung ist nur dunkler Sand. */
      lightPool(g, lightX, waterY + wetH * .55, wetH * 5.2, .30, P.glare, P.glareA * .85);

      /* Der Wasserfilm ist ein Spiegel, also traegt er waagerechte
         Schlieren: Reste ablaufenden Wassers, jede mit heller Ober- und
         dunkler Unterkante. Ein gleichmaessig dunkler Streifen liest als
         Asphalt — genau das war er vorher. */
      const Rwet = rng(7373);
      for (let i = 0, n = Math.round(w / DPR / 9); i < n; i++) {
        /* u = 0 an der Wasserkante (Film noch nass und spiegelnd),
           u = 1 am trockenen Sand. Die Schlieren sitzen fast nur oben und
           fast nur im Reflexionskegel — flaechendeckend sahen sie aus wie
           gebuerstetes Metall. */
        const u = Math.pow(Rwet(), 2.2);
        const y = (waterY + wetH * (.04 + u * .9)) | 0;
        const x = (Rwet() * w) | 0;
        const len = ((5 + 34 * Rwet()) * DPR) | 0;
        const f = lobe(x, 1) * .85 + .15;
        g.fillStyle = `rgb(${P.spec} / ${(.02 + .16 * f * (1 - u)).toFixed(3)})`;
        g.fillRect(x, y, len, Math.max(1, DPR * .8) | 0);
      }
      /* Der Wasserfilm selbst: oben ein heller Spiegel, nach unten ins
         Dunkle. Ohne diesen Verlauf ist der nasse Sand nur ein Balken. */
      const mir = g.createLinearGradient(0, waterY, 0, sandY);
      mir.addColorStop(0,   `rgb(${P.spec} / .16)`);
      mir.addColorStop(.22, `rgb(${P.spec} / .06)`);
      mir.addColorStop(.62, `rgb(2 5 12 / .10)`);
      mir.addColorStop(1,   `rgb(2 5 12 / .26)`);
      g.fillStyle = mir;
      g.fillRect(0, waterY, w, sandY - waterY);

      /* ---- 3 · Trockener Sand ----
         Die Kante zum Wasser ist NIE gerade. Vier Stopps an ungleichen
         Positionen: zum Betrachter hin faellt der Sand ins Kalte ab, damit
         die Silhouetten davor stehen koennen. */
      const sandG = g.createLinearGradient(0, sandY, 0, h);
      for (const [pos, col] of P.sand) sandG.addColorStop(pos, `rgb(${col})`);
      ridgeBand(g, beachNz, 8.7, sandY, SH * .075, w / 9, 4, sandG, 0);

      /* Mondschimmer auf dem Sand direkt hinter der Wasserkante: das Licht,
         das die Wasserflaeche zurueckwirft. Nur ein schmaler Streifen — er
         ist es, vor dem die Silhouetten stehen. */
      const shn = g.createLinearGradient(0, sandY - wetH * .2, 0, sandY + span * .30);
      shn.addColorStop(0,   `rgb(${P.grain[0]} / ${(.075 * (dayMode() ? .55 : 1)).toFixed(3)})`);
      shn.addColorStop(.34, `rgb(${P.grain[0]} / ${(.032 * (dayMode() ? .55 : 1)).toFixed(3)})`);
      shn.addColorStop(1,   `rgb(${P.grain[0]} / 0)`);
      g.fillStyle = shn;
      g.fillRect(0, sandY - wetH * .2, w, span * .30 + wetH * .2);

      /* Duenen statt Tapete. Fuenf sehr flache Waelle, jeder mit einer
         beleuchteten Luv- und einer KALTEN Leeseite — dieselbe
         Farbstichtrennung wie beim Pult, nur ueber die ganze Breite. Erst
         diese Modulation macht aus der Sandflaeche ein Gelaende; waagerechte
         Linien in gleichem Abstand saehen dagegen nach Scanlines aus. */
      for (let i = 0; i < 3; i++) {
        const t = Math.pow((i + .55) / 3, 1.75);
        const y = sandY + t * span;
        const amp = span * (.020 + .045 * t);
        const line = x => y + (ridge(beachNz, x + i * 823, w / (5 + i * 1.4), 3, 41.3 + i * 2.7) - .5) * amp;
        /* Leeseite: kalt-violetter Schatten, weich nach unten auslaufend */
        const shg2 = g.createLinearGradient(0, y, 0, y + span * (.10 + .13 * t));
        shg2.addColorStop(0, `rgb(${P.shadow} / ${(.10 + .13 * t).toFixed(3)})`);
        shg2.addColorStop(1, `rgb(${P.shadow} / 0)`);
        g.fillStyle = shg2;
        g.beginPath();
        g.moveTo(0, h);
        for (let x = 0; x <= w; x += 9 * DPR) g.lineTo(x, line(x));
        g.lineTo(w, h); g.closePath(); g.fill();
        /* Luvseite: KEIN durchgezogener Saum. Er lief als helle Linie quer
           durchs ganze Bild und las sich als Scanline. Stattdessen kurze,
           unterbrochene Stuecke — so bricht ein Duenenkamm wirklich. */
        g.strokeStyle = `rgb(${P.grain[0]} / ${(.05 + .08 * t).toFixed(3)})`;
        g.lineWidth = Math.max(1, (.7 + 1.6 * t) * DPR);
        const Rk = rng(500 + i);
        for (let x = 0; x <= w;) {
          const seg = w * (.02 + Rk() * .10);
          if (Rk() < .55) {
            g.beginPath();
            for (let q = x; q <= x + seg; q += 9 * DPR) q === x ? g.moveTo(q, line(q)) : g.lineTo(q, line(q));
            g.stroke();
          }
          x += seg + w * (.01 + Rk() * .06);
        }
      }

      /* Grossflaechige Modulation quer zum Strand. Waagerechte Baender allein
         lesen als Schichttorte — was die Flaeche bricht, sind weiche Inseln
         mit schraeger Achse: warme Kuppen, kalt-violette Mulden. */
      const Rm = rng(6060);
      for (let i = 0; i < 9; i++) {
        const warm = Rm() < .45;
        const t = Math.pow(Rm(), .7);
        lightPoolMode(g, "source-over", Rm() * w, sandY + span * (.06 + t * .95),
          (.10 + Rm() * .26) * w, .10 + Rm() * .22,
          warm ? P.warmPool : P.shadow, warm ? .05 : .12);
      }

      /* ---- Sandoberflaeche, perspektivisch gerechnet ----
         Der Sand liegt in DERSELBEN Ebene wie das Wasser, also gilt fuer ihn
         dieselbe Rueckprojektion: Z = EYE·f/(y−hy). Damit wird die
         Oberflaechenstruktur zum Betrachter hin groeber und zum Wasser hin
         feiner — von allein, nicht geschaetzt. Genau das fehlt gemalten
         Straenden: ihr Korn ist ueberall gleich gross, und deshalb liegt es
         als Filter ueber dem Bild statt als Struktur darin.
         Beleuchtet wird wie beim Wasser ueber die Neigung: Luvseite hell,
         Leeseite kalt-violett. Gerechnet klein, hochskaliert gezeichnet. */
      {
        const f2 = h * 1.05, EYE2 = 1.75;
        const dw = Math.max(1, Math.round(w / 3)), dhh = Math.max(1, Math.round(span / 3));
        const sc2 = document.createElement("canvas");
        sc2.width = dw; sc2.height = dhh;
        const s2 = sc2.getContext("2d");
        const im = s2.createImageData(dw, dhh);
        const dd = im.data;
        const litR = parseInt(P.grain[0].split(" ")[0]), litG = parseInt(P.grain[0].split(" ")[1]), litB = parseInt(P.grain[0].split(" ")[2]);
        const shR = parseInt(P.shadow.split(" ")[0]), shG = parseInt(P.shadow.split(" ")[1]), shB = parseInt(P.shadow.split(" ")[2]);
        const lxw = (lightX - w * .5) / f2, lyw = .55;
        const ln = Math.hypot(lxw, lyw, 1);
        for (let jj = 0; jj < dhh; jj++) {
          const ys = sandY + (jj + .5) * (span / dhh);
          const Zs = EYE2 * f2 / Math.max(1, ys - hy);
          const t2 = jj / dhh;
          for (let ii = 0; ii < dw; ii++) {
            const Xs = ((ii + .5) * (w / dw) - w * .5) * Zs / f2;
            /* zwei Oktaven Rippel plus eine grobe Duenenlage */
            const e = .06;
            const H = (X, Z) => fbm(beachNz, X * 2.6 + 40, Z * 2.6, 2) * .55
                              + fbm(beachNz, X * .42 + 11, Z * .42, 3) * 1.15;
            const h0 = H(Xs, Zs);
            const gx = (H(Xs + e, Zs) - h0) / e;
            const gz = (H(Xs, Zs + e) - h0) / e;
            /* Neigung -> Beleuchtung. Nur die Abweichung vom Mittel faerbt. */
            const nl = Math.sqrt(gx * gx + 1 + gz * gz);
            const nd = (-gx * lxw + lyw - gz) / (nl * ln);
            const k = Math.max(-1, Math.min(1, (nd - .82) * 6.5));
            const a = Math.abs(k) * (.10 + .16 * t2);
            const o = (jj * dw + ii) * 4;
            if (k >= 0) { dd[o] = litR; dd[o + 1] = litG; dd[o + 2] = litB; }
            else        { dd[o] = shR;  dd[o + 1] = shG;  dd[o + 2] = shB; }
            dd[o + 3] = Math.min(255, a * 255) | 0;
          }
        }
        s2.putImageData(im, 0, 0);
        g.imageSmoothingEnabled = true;
        g.drawImage(sc2, 0, 0, dw, dhh, 0, sandY, w, span);
      }

      /* Feine Rippel: KURZE Boegen, zufaellig verteilt und leicht verdreht.
         Durchgezogene waagerechte Linien in gleichem Abstand haetten wie
         Scanlines ausgesehen — Windrippel im Sand reissen staendig ab und
         setzen versetzt wieder an. Jeder Bogen bekommt eine helle Luv- und
         eine kalt-violette Leeseite; erst dieses Paar ergibt Relief. */
      const Rr = rng(3311);
      const nRip = Math.round((w / DPR) * (span / DPR) / 2600);
      for (let i = 0; i < nRip; i++) {
        const t = Math.pow(Rr(), .62);
        const y = sandY + span * (.04 + t * .94);
        const x = Rr() * w;
        const len = span * (.06 + Rr() * .16) * (.45 + t);
        const tilt = (Rr() - .5) * .22;
        const arc = (Rr() - .5) * span * .035 * (.4 + t);
        const lw = Math.max(1, (.55 + 1.5 * t) * DPR);
        for (const [dy, col, a] of [[0, P.grain[0], .07 + .10 * t], [lw * 1.3, P.grain[1], .08 + .13 * t]]) {
          g.strokeStyle = `rgb(${col} / ${a.toFixed(3)})`;
          g.lineWidth = lw;
          g.beginPath();
          g.moveTo(x, y + dy);
          g.quadraticCurveTo(x + len * .5, y + dy + arc + len * tilt * .5, x + len, y + dy + len * tilt);
          g.stroke();
        }
      }

      /* Spuelsaum: die dunkle Linie aus Tang und Muschelbruch, die die letzte
         Flut hinterlassen hat. Ein trockener Strand ohne sie sieht gekehrt
         aus. */
      const tideY = sandY + span * .24;
      const Rt2 = rng(90210);
      for (let i = 0, n = Math.round(w / DPR / 2.4); i < n; i++) {
        const x = Rt2() * w;
        const y = tideY + (ridge(beachNz, x, w / 8, 3, 21.5) - .5) * span * .10
                + (Rt2() - .5) * span * .05;
        g.fillStyle = `rgb(${P.grain[1]} / ${(.22 + Rt2() * .40).toFixed(3)})`;
        g.fillRect(x | 0, y | 0, (1 + Rt2() * 3.4) * DPR, Math.max(1, DPR * .8) | 0);
      }

      /* Korn: einige tausend Ein-Pixel-Punkte, zum Betrachter hin dichter —
         nahe Koerner loest das Auge einzeln auf, ferne verschmelzen zum
         glatten Ton. Zwei Toene: ein heller Glanzpunkt UND ein kalt-violettes
         Schattenkorn, immer paarweise dicht nebeneinander. Genau dieses Paar
         ergibt Relief; ein einzelner heller Ton laege nur als Rauschfilter
         ueber dem Sand statt als Korn darin. */
      const edge = new Float32Array(193);
      for (let i = 0; i <= 192; i++)
        edge[i] = sandY - (ridge(beachNz, (i / 192) * w, w / 9, 4, 8.7) - .5) * (SH * .075);
      const grains = Math.min(14000, Math.round((w / DPR) * (span / DPR) / 62));
      const Rg = rng(1337);
      for (let i = 0; i < grains; i++) {
        const x = Rg() * w;
        const y = sandY + Math.pow(Rg(), .48) * span;
        if (y < edge[Math.min(192, (x / w * 192) | 0)]) continue;
        const t = (y - sandY) / span;
        const sz = Math.max(1, ((t > .5 && Rg() < .34 ? 2 : 1) * DPR) | 0);
        g.fillStyle = `rgb(${P.grain[0]} / ${(.08 + .30 * t).toFixed(3)})`;
        g.fillRect(x | 0, y | 0, sz, sz);
        g.fillStyle = `rgb(${P.grain[1]} / ${(.07 + .30 * t).toFixed(3)})`;
        g.fillRect((x + sz) | 0, (y + sz * .8) | 0, sz, sz);
      }

      /* Treibholz: laengliche, fast schwarze Formen mit hartem
         Kontaktschatten und einem einzigen hellen Streiflicht oben. Vier
         Stueck reichen — es geht um Massstab, nicht um Deko. */
      const Rd = rng(4242);
      for (let i = 0; i < 4; i++) {
        const t = .25 + Rd() * .62;
        const x = w * (.10 + Rd() * .82), y = sandY + span * t;
        const L = span * (.06 + Rd() * .09), th = L * (.10 + Rd() * .09);
        const rot = (Rd() - .5) * .5;
        g.save(); g.translate(x, y); g.rotate(rot);
        g.fillStyle = `rgb(${P.shadow} / .60)`;
        g.beginPath(); g.ellipse(th * .8, th * .7, L * .58, th * .55, 0, 0, 6.283); g.fill();
        g.fillStyle = `rgb(${P.dark})`;
        g.beginPath(); g.ellipse(0, 0, L * .5, th * .5, 0, 0, 6.283); g.fill();
        /* zwei Aeste — eine glatte Ellipse allein liest als Kieselstein */
        g.beginPath(); g.ellipse(L * .34, -th * .5, L * .18, th * .22, -.6, 0, 6.283); g.fill();
        g.beginPath(); g.ellipse(-L * .30, -th * .4, L * .14, th * .18, .5, 0, 6.283); g.fill();
        g.strokeStyle = `rgb(${P.rimCold} / ${(P.rimA * .32).toFixed(2)})`;
        g.lineWidth = Math.max(1, th * .13);
        g.beginPath(); g.ellipse(0, -th * .12, L * .44, th * .34, 0, 3.5, 6.0); g.stroke();
        g.restore();
      }

      /* Ein paar Steine und Muschelbruch mit eigenem Kontaktschatten. Drei
         Groessen, nach hinten kleiner — das ist billiger Tiefenbeweis. */
      const Rs = rng(555);
      for (let i = 0, n = 26; i < n; i++) {
        const t = Math.pow(Rs(), .5);
        const y = sandY + span * (.08 + t * .9);
        const x = Rs() * w;
        const r = (1 + Rs() * 3.2) * DPR * (.4 + t);
        g.fillStyle = `rgb(${P.shadow} / .55)`;
        g.beginPath(); g.ellipse(x + r * .5, y + r * .5, r * 1.5, r * .38, 0, 0, 6.283); g.fill();
        g.fillStyle = `rgb(${P.dark} / .82)`;
        g.beginPath(); g.ellipse(x, y, r, r * .72, Rs() * 3, 0, 6.283); g.fill();
        g.fillStyle = `rgb(${P.grain[0]} / ${(.12 + .18 * t).toFixed(2)})`;
        g.beginPath(); g.ellipse(x + r * .2, y - r * .28, r * .5, r * .22, 0, 0, 6.283); g.fill();
      }

      /* ---- 7c · warmer Sandpool ----
         Gegengewicht zum kalten Wasser. Ohne ihn kippt der ganze untere
         Bildteil in ein einziges Grau. */
      lightPool(g, w * .58, sandY + span * .52, Math.max(w, span) * .70, .56, P.warmPool, P.warmA);

      /* ---- 4 · Brandung ----
         Die Brandung ist NICHT eingebacken: sie laeuft auf #glints als
         Animation (siehe paintSurf/paintWater). Hier wird nur der Vorrat an
         Schaum-Sprites gebaut. In Stufe "Aus" gibt es kein rAF — dann wird
         ein Sprite einmal fest gezeichnet, sonst haette der Strand gar keine
         Brandung. */
      buildSurf(P, waterY, SH, wetH, span);
      if (html.dataset.fx === "s" && surf) {
        g.globalAlpha = .85;
        g.drawImage(surf.layers[0].img, 0, surf.layers[0].baseY + surf.layers[0].range * .45);
        g.globalAlpha = 1;
      }

      /* ---- 5 · Requisiten: Palmen, Strandhafer, DJ-Pult ----
         Alle im Gegenlicht, alle mit zwei Schatten. Die Palmen stehen NICHT
         symmetrisch und nicht alle gleich gross — zwei gleich hohe Palmen
         links und rechts sind die Bildmarke jedes Ferienkatalogs. */
      /* Massstab der Requisiten. Er darf NICHT allein an `span` haengen: auf
         einem 390er Viewport ist der Sandstreifen fast so hoch wie auf einem
         1440er, die Palmen wuchsen dadurch dem schmalen Bild ueber den Kopf.
         Das geometrische Mittel aus Breite und Sandtiefe haelt die Proportion
         ueber alle Formate. */
      const pu = Math.sqrt(span * w * .085);
      const bw = pu * 1.35;
      const boothX = w * .175, boothY = sandY + span * .58;

      /* Fuenf Palmen in DREI Tiefen: zwei kleine weit hinten (kurz ueber der
         Wasserkante, entsprechend blasser), drei grosse vorn. Gleich grosse
         Palmen links und rechts sind die Bildmarke jedes Ferienkatalogs —
         hier steht keine wie die andere. */
      const palms = [
        { x: w * .062, y: sandY + span * .50, ht: pu * 1.58, lean:  .20, seed: 11, far: 0 },
        { x: w * .305, y: sandY + span * .21, ht: pu *  .90, lean: -.15, seed: 61, far: .48 },
        { x: w * .958, y: sandY + span * .82, ht: pu * 2.06, lean: -.25, seed: 27, far: 0 },
        { x: w * .806, y: sandY + span * .34, ht: pu * 1.15, lean:  .14, seed: 43, far: .18 },
        { x: w * .612, y: sandY + span * .19, ht: pu *  .73, lean:  .22, seed: 83, far: .62 },
      ];
      /* Strandhafer zuerst — er steht hinter den Palmen */
      const pg = propLayer.getContext("2d");
      pg.clearRect(0, 0, w, h);
      const Rgr = rng(808);
      for (let i = 0, n = Math.round(w / DPR / 34); i < n; i++) {
        const t = Math.pow(Rgr(), .8);
        paintGrass(pg, P, Rgr() * w, sandY + span * (.16 + t * .66),
                   span * (.07 + t * .15), 100 + i, lightX);
      }
      paintBush(pg, P, w * .46, sandY + span * .90, pu * .30, 71, lightX);
      paintBush(pg, P, w * .72, sandY + span * .70, pu * .21, 73, lightX);
      /* hinten zuerst, und mit Luftperspektive: was weiter weg steht, wird
         nicht kleiner gezeichnet und fertig — es verliert auch Kontrast. */
      for (const pm of [...palms].sort((a, b) => b.far - a.far)) {
        pg.save();
        pg.globalAlpha = 1 - pm.far * .55;
        paintPalm(pg, P, pm.x, pm.y, pm.ht, pm.lean, pm.seed, lightX);
        pg.restore();
      }
      {
        /* Boxenstapel links und rechts vom Pult. Ein Rave-Strand ohne PA ist
           eine Postkarte. Sie stehen leicht angewinkelt zum Publikum, also
           nicht spiegelsymmetrisch. */
        paintStack(pg, P, boothX - bw * .92, boothY + bw * .045, bw * .34, bw * .70, lightX);
        paintStack(pg, P, boothX + bw * .88, boothY + bw * .02, bw * .30, bw * .60, lightX);
        paintBooth(pg, P, boothX, boothY, bw, lightX);
        /* Lichterkette zwischen den beiden linken Palmen, ueber dem Pult.
           Winzige warme Punkte auf einer Kettenlinie — kein Bogen aus dem
           Zirkel: eine haengende Schnur ist ein cosh, und das sieht das Auge. */
        paintLights(pg, P, palms[0].x + palms[0].lean * palms[0].ht * .78,
                    palms[0].y - palms[0].ht * .62,
                    palms[1].x + palms[1].lean * palms[1].ht * .8,
                    palms[1].y - palms[1].ht * .70, span * .16);
      }
    }

    /* ---- Brandungs-Sprites ----
       Der Schaum wird auf EIGENEN Ebenen gebaut und dort mit
       `destination-out` ausgefranst. Auf dem Szenen-Canvas wuerde
       `destination-out` Loecher bis auf den Seitengrund schlagen — das ist
       der Fehler, den man hier genau einmal macht.
       Ein glatter Schaumrand ist ein sicheres Clipart-Signal; erodiert wird
       deshalb SPALTENWEISE mit rauschgesteuerter Hoehe. Runde Bisse waeren
       nur Konfetti.

       Pro Frame wird jedes Sprite genau EINMAL kopiert — ein Blit statt einer
       Neuberechnung. Das ist der Grund, warum die Brandung laufen darf, ohne
       das Frame-Budget zu sprengen. */
    let surf = null;
    function buildSurf(P, waterY, SH, wetH, span) {
      surf = null;
      const full = html.dataset.fx === "l";
      const nLayer = full ? 2 : 1;
      const fh = Math.max(6 * DPR, Math.round(SH * .052));
      const layers = [];
      for (let l = 0; l < nLayer; l++) {
        const c = document.createElement("canvas");
        c.width = w; c.height = Math.ceil(fh * 1.4 + wetH);
        const fg = c.getContext("2d");
        const yBase = Math.round(fh * 1.1);
        const seed = 3.1 + l * 7.7;
        const mid = x => yBase - (ridge(beachNz, x, w / 16, 4, seed) - .5) * (SH * .030);
        const step = Math.max(1, DPR | 0);

        for (let x = 0; x <= w; x += step) {
          const m = mid(x);
          /* Drei teilerfremde Rauschskalen. Die groebste entscheidet, OB an
             dieser Stelle ueberhaupt ein Kamm bricht — echte Brandung ist
             eine Kette einzelner Brecher mit Luecken, kein durchgezogener
             Strich. Genau dieses Durchziehen war das Clipart-Signal. */
          const brk = ridge(beachNz, x, w / 4.2, 2, 61.7 + l * 9);
          const pres = Math.max(0, Math.min(1, (brk - .13) * 2.8));
          if (pres <= .02) continue;
          const n = ridge(beachNz, x, w / 34, 3, 5.9 + l * 3) * .68
                  + ridge(beachNz, x, w / 120, 2, 17.4 + l * 3) * .42;
          const up = fh * (.22 + .80 * Math.pow(Math.max(0, n - .12), 1.4));
          /* Kern schmal und fast deckend, Auslauf kurz: ein Schaumsaum ist
             eine KANTE mit Struktur, kein Verlauf. */
          const gr = fg.createLinearGradient(0, m - up, 0, m + wetH * .38);
          gr.addColorStop(0,    `rgb(${P.foam} / 0)`);
          gr.addColorStop(.52,  `rgb(${P.foam} / ${(.16 * pres).toFixed(3)})`);
          gr.addColorStop(.80,  `rgb(${P.foam} / ${(.72 * pres).toFixed(3)})`);
          gr.addColorStop(.875, `rgb(${P.foam} / ${(1.00 * pres).toFixed(3)})`);
          gr.addColorStop(.925, `rgb(${P.foam} / ${(.55 * pres).toFixed(3)})`);
          gr.addColorStop(.975, `rgb(${P.foam} / ${(.16 * pres).toFixed(3)})`);
          gr.addColorStop(1,    `rgb(${P.foam} / 0)`);
          fg.fillStyle = gr;
          fg.fillRect(x, m - up, step, up + wetH * .38);
        }

        fg.globalCompositeOperation = "destination-out";
        for (let x = 0; x <= w; x += step) {
          const m = mid(x);
          const n = ridge(beachNz, x + 900, w / 52, 3, 31.2 + l * 5);
          fg.fillStyle = "#000";
          fg.fillRect(x, m - fh * 1.45, step, Math.max(0, fh * (.55 + 1.0 * Math.pow(n, 1.25))));
        }
        const Rb = rng(2024 + l);
        for (let i = 0, n = Math.round(w / DPR / 6); i < n; i++) {
          const x = Rb() * w, m = mid(x), r = (1 + Rb() * 3.6) * DPR;
          fg.globalAlpha = .3 + Rb() * .6;
          fg.fillStyle = "#000";
          fg.beginPath();
          fg.ellipse(x, m - fh * Rb() * .7, r * (.6 + Rb() * 1.8), r * .5, 0, 0, 6.283);
          fg.fill();
        }
        fg.globalAlpha = 1;
        fg.globalCompositeOperation = "source-over";

        layers.push({
          img: c,
          baseY: Math.round(waterY - yBase - fh * .25),
          /* Auflaufweite: bis knapp ueber den nassen Sand hinaus */
          range: wetH * 1.25 + span * .05,
          period: 8.4 + l * 3.3,
          phase: l * .43,
          a: l === 0 ? 1 : .34,
        });
      }
      surf = { layers };
    }

    /* ---- Wasserbewegung ----
       Zwei Dinge bewegen sich auf dem Strandfoto, sonst nichts:

       1. WELLEN. Nahe am Horizont erscheinen Undulationen durch die
          Verkuerzung als horizontale Striche, unabhaengig von der tatsaechlichen
          Wellenrichtung — deshalb Striche, keine Kringel. Drei ueberlagerte
          Frequenzen mit teilerfremdem Verhaeltnis, damit die Periode nie
          sichtbar wird.
       2. GLITZERPFAD. Kein Leuchtband, sondern viele Einzelblitze: Facetten
          der bewegten Oberflaeche, die kurz den richtigen Neigungswinkel haben.
          Er liegt zwingend in der Vertikalebene durch Mond und Auge, also exakt
          unter dem Mond. Der Exponent 8 auf dem Sinus macht daraus ein
          Aufblitzen mit langen Dunkelphasen — mit `sin` allein saehe es nach
          blinkendem Lametta aus. */
    let glints = [], waveLines = [], crestGrad = null;
    /* Schaum-Verlaeufe je Hoehe und Brechgrad, grob gestuft — Begruendung
       an der Verwendungsstelle in paintWater. Wird bei seedGlints nicht
       geleert: die Eintraege haengen nicht an der Fenstergroesse, sondern
       nur an Werten, die ohnehin im Cache-Schluessel stehen. */
    const schaumGrads = new Map();
    /* Oberkante des Glitzer-Streifens in Geraetepixeln.
       #glints war eine Vollbild-Canvas. Sie wird in JEDEM Frame geloescht und
       neu zur GPU hochgeladen — bei 1440x900 und DPR 2 sind das 5,2 Millionen
       Pixel pro Frame, von denen hoechstens ein Drittel ueberhaupt bemalt
       wird. Jetzt ist die Canvas nur noch so hoch wie das, was darauf laeuft
       (Wasser plus Brandungsweg), und wird per CSS an die richtige Stelle
       geschoben. Gezeichnet wird unveraendert in Viewport-Koordinaten: der
       Kontext bekommt einmal pro Frame die passende Verschiebung. */
    let glintTop = 0;

    function seedGlints() {
      glints = []; waveLines = []; crestGrad = null;
      /* Hier stand lange ein `return;` vor dem gesamten Rumpf: ueber dem
         Strandfoto gab es nichts zu spiegeln, das Bild brachte seine eigene
         Wasseroberflaeche mit. Mit der gezeichneten Szene ist das Wasser
         wieder unseres — jetzt entscheidet die Geometrie statt eines
         Festwerts. seaTop/seaEnd setzt paintBeach(); 0 heisst "kein Wasser". */
      if (!seaTop || seaEnd <= seaTop) return;
      const hy = seaTop, gh = h - hy;
      const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * .8;

      /* Wellenstriche und Glitzer sind das EINZIGE, was pro Frame laeuft.
         Deshalb nach FX-Stufe gestaffelt — in "Voll" die volle Dichte, in
         "Normal" gut die Haelfte. */
      const full = html.dataset.fx === "l";
      const nGlint = full ? 300 : 190;
      const nWave = full ? 46 : 28;

      for (let i = 0; i < nGlint; i++) {
        const u = Math.random();
        const y = hy + Math.pow(u, .38) * (seaEnd - hy);
        const t = (y - hy) / Math.max(1, seaEnd - hy);
        glints.push({
          y: y | 0,
          dx: gauss() * (gh * .17) * (.45 + 2.4 * t),
          phase: Math.random() * 6.283,
          speed: .6 + Math.random() * 2.2,
          /* kurz und fast quadratisch: die BREITE Glanzstrasse kommt jetzt
             aus dem Shading, hier blitzt nur noch die einzelne Facette auf.
             Lange Striche lasen sich als Schnittfehler im Bild. */
          len: Math.max(1, (1.2 + 6.5 * t) * DPR) | 0,
          th: Math.max(1, (.7 + 1.3 * t) * DPR) | 0,
        });
      }
      /* Wellenstriche: dichter und flacher zum Horizont hin */
      for (let i = 0; i < nWave; i++) {
        waveLines.push({
          /* jeder Kamm laeuft seinen eigenen Weg vom Horizont zum Ufer */
          per: 9.5 + Math.random() * 7,
          off: i / nWave + Math.random() * .04,
          f1: .008 + Math.random() * .006,
          f2: .021 + Math.random() * .010,
          ph: Math.random() * 6.283,
        });
      }
      buildWaveTables();
    }

    /* ---- Formtabellen der Duenungskaemme ----
       In `paintWater` sah die Kammlinie so aus:

         yy(x) = y + sin(x·f1/DPR + ph)·amp + sin(x·f2/DPR + ph·1.7)·amp·.42

       Zeitabhaengig sind darin NUR `y` und `amp` — die beiden Sinus haengen
       allein an x und an den festen Kennwerten des Kamms. Bei 46 Kaemmen, zwei
       Linien je Kamm und rund 87 Stuetzstellen waren das ueber 16.000
       Sinus-Aufrufe in JEDEM Bild, die immer wieder dieselben Zahlen ergaben.
       Sie werden deshalb einmal bei `seedGlints` berechnet.

       Dasselbe gilt fuer die Schaumabschnitte: die Kette der Abschnittslaengen
       ist eine reine Funktion von x, und ob ein Abschnitt bricht, entscheidet
       `ridge()` aus x und der Phase des Kamms. Auch das steht von vornherein
       fest.

       ZWEI Tabellen je Linie, nicht eine zusammengefasste: `amp·(s1 + .42·s2)`
       waere zwar mathematisch dasselbe, rundet im Gleitkomma aber anders als
       `s1·amp + s2·amp·.42`. Getrennt gehalten bleibt das Ergebnis Bit fuer Bit
       identisch zu vorher.

       Die Stuetzstellen der Schaumabschnitte liegen NICHT auf dem Grundraster:
       sie laufen vom Abschnittsanfang aus, und der wandert in unregelmaessigen
       Schritten. Sie brauchen deshalb eigene Tabellen. */
    function waveTab(xs, wl) {
      const n = xs.length;
      const x = new Float64Array(n), s1 = new Float64Array(n), s2 = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        x[i] = xs[i];
        s1[i] = Math.sin(xs[i] * wl.f1 / DPR + wl.ph);
        s2[i] = Math.sin(xs[i] * wl.f2 / DPR + wl.ph * 1.7);
      }
      return { n, x, s1, s2 };
    }

    function buildWaveTables() {
      const step = 22 * DPR;
      for (const wl of waveLines) {
        const grid = [];
        for (let x = 0; x <= w + step; x += step) grid.push(x);
        wl.grid = waveTab(grid, wl);

        const segs = [];
        for (let x = 0; x <= w; ) {
          const seg = w * (.03 + .12 * ((x * 9301 + 49297) % 233280) / 233280);
          if (ridge(beachNz, x + wl.ph * 900, w / 5.5, 2, 55.1) > .40) {
            const up = [], dn = [];
            for (let q = x; q <= x + seg; q += step) up.push(q);
            for (let q = x + seg; q >= x; q -= step) dn.push(q);
            segs.push({
              x,
              s1x: Math.sin(x * wl.f1 / DPR + wl.ph),
              s2x: Math.sin(x * wl.f2 / DPR + wl.ph * 1.7),
              up: waveTab(up, wl), dn: waveTab(dn, wl),
            });
          }
          x += seg;
        }
        wl.segs = segs;
      }
    }

    /* ============================================================
       Techno-Boot

       Es liegt draussen auf dem Wasser und wandert mit dem Scroll durch das
       Bild — dieselbe Kopplung, die schon Mond und Phobos benutzen: alles,
       was weit weg ist, verschiebt sich beim Vorwaertsgehen langsamer als
       der Vordergrund (differentielle Parallaxe).

       Gezeichnet wird es auf #glints, nicht in den gebackenen Hintergrund:
       es bewegt sich. Zuerst die Spiegelung, dann der Rumpf — die Spiegelung
       liegt IM Wasser, also darunter.

       Was ein gezeichnetes Boot glaubwuerdig macht:
       · Der Rumpf ist keine Banane. Er hat eine gerade Deckslinie, einen
         hochgezogenen Bug und ein abfallendes Heck.
       · Es liegt IM Wasser, nicht darauf: die Wasserlinie schneidet den
         Rumpf, darunter ist nichts.
       · Die Spiegelung ist nicht das gespiegelte Bild, sondern ein
         AUSEINANDERGEZOGENER, zitternder Streifen — bewegtes Wasser
         zerlegt sie in waagerechte Baender.
       · Die farbigen Lichtsaeulen auf dem Wasser sind laenger als das Boot
         hoch ist. Das ist der Effekt, den jede Hafenaufnahme bei Nacht zeigt
         und den fast jede Zeichnung weglaesst.
       ============================================================ */
    const BOAT_LIGHTS = ["255 92 176", "96 224 255", "255 196 96", "160 255 150"];
    /* Gedaempfte Position: der Scroll gibt nur das ZIEL vor, das Boot laeuft
       ihm nach. Ohne diese Traegheit springt es bei jedem Radschub mit, und
       ein Schiff, das sofort auf eine Eingabe reagiert, wiegt nichts. */
    let boatX = null;
    function paintBoat(g, secs, sp) {
      if (!seaTop || !seaEnd) return;
      const sea = seaEnd - seaTop;
      /* Kurzer Fahrweg: ueber die ganze Breite zu wandern sah aus wie ein
         Rennboot. Ein Sound-System-Boot treibt. */
      const target = w * (.70 - .17 * sp) + Math.sin(secs * .045) * w * .012;
      boatX = boatX === null ? target : boatX + (target - boatX) * .022;
      const bx = boatX;

      const L = sea * .50;                       /* halbe Rumpflaenge */
      const hh = L * .105;                       /* Bordwandhoehe      */
      const bob = Math.sin(secs * .85) * sea * .005 + Math.sin(secs * .53) * sea * .003;
      const by = seaTop + sea * .32 + bob;       /* Wasserlinie        */
      const roll = Math.sin(secs * .67) * .014;
      /* Bei Tag ist ein Boot im Gegenlicht dunkel, aber nicht schwarz: die
         Atmosphaere zwischen Auge und Objekt hellt es auf (Luftperspektive),
         und der Himmel wirft Licht auf alle nach oben zeigenden Flaechen.
         Drei Tonwerte statt einem — Rumpf, Aufbau, Boxen. */
      const day = dayMode();
      const dark  = day ? "58 62 78" : "5 5 11";     /* Rumpf   */
      const dark2 = day ? "44 48 62" : "7 7 14";     /* Boxen   */
      const dark3 = day ? "74 80 96" : "10 10 18";   /* Aufbau  */

      /* ---------- Spiegelung im Wasser ---------- */
      /* Der Verlauf wird EINMAL im Einheitsraum 0..1 gebaut und je Streifen
         nur noch skaliert und verschoben. Vorher waren es 52 Verlaufsobjekte
         pro Frame allein fuer die Rumpfspiegelung. */
      const rl = sea * .30, NS = 52;
      const rg = g.createLinearGradient(0, 0, 1, 0);
      rg.addColorStop(0, "rgb(5 8 18 / 0)");
      rg.addColorStop(.18, "rgb(5 8 18 / 1)");
      rg.addColorStop(.82, "rgb(5 8 18 / 1)");
      rg.addColorStop(1, "rgb(5 8 18 / 0)");
      for (let i = 0; i < NS; i++) {
        const t = i / (NS - 1);
        const yy = by + t * rl;
        const wob = Math.sin(secs * 1.7 + i * .36) * L * .06 * (.3 + t);
        const a = (1 - t) * (1 - t) * .30 * (.55 + .45 * Math.sin(i * 2.1 + secs * 2.4));
        const ww = L * 2 * (1 + t * .18), x0 = bx - ww / 2 + wob;
        g.save();
        g.globalAlpha = a;
        g.translate(x0, 0); g.scale(ww, 1);
        g.fillStyle = rg;
        g.fillRect(0, yy | 0, 1, Math.max(1, rl / NS + 1) | 0);
        g.restore();
      }
      for (let k = 0; k < 4; k++) {
        const lx = bx + (k - 1.5) * L * .42, col = BOAT_LIGHTS[k];
        for (let i = 0; i < 40; i++) {
          const t = i / 39;
          const yy = by + t * rl * 1.6;
          const wob = Math.sin(secs * 2.2 + i * .42 + k * 2.1) * L * .09 * (.25 + t);
          const ww = L * (.06 + t * .20);
          const fl = .40 + .60 * Math.pow(Math.abs(Math.sin(i * 1.7 + secs * 2.9 + k)), 2);
          g.fillStyle = `rgb(${col} / ${((1 - t) * (1 - t) * .30 * fl).toFixed(3)})`;
          g.fillRect((lx - ww / 2 + wob) | 0, yy | 0, ww | 0, Math.max(1, rl * 1.6 / 40 + 1) | 0);
        }
      }

      g.save();
      g.translate(bx, by);
      g.rotate(roll);

      /* ---------- Rumpf: langes, flaches Boot mit hochgezogenen Enden ----------
         Ein Kanu ist keine Ellipse: die Bordwand laeuft gerade durch und
         schwingt erst auf den letzten zehn Prozent nach oben. Genau daran
         erkennt man ein Boot statt einer Banane. */
      /* Die Deckslinie liegt bei -hh, NICHT knapp ueber der Wasserlinie:
         vorher standen die Boxen fast eine Bordwandhoehe ueber dem Rumpf und
         dazwischen klaffte das Wasser durch. Die Sprung-Linie (Sheer) steigt
         zu beiden Enden an — daran erkennt man ein Boot statt einer Kiste. */
      g.fillStyle = `rgb(${dark})`;
      g.beginPath();
      g.moveTo(-L * 1.00, -hh * 1.85);                      /* Heckspitze */
      g.bezierCurveTo(-L * .82, -hh * 1.18, -L * .55, -hh * 1.02, -L * .20, -hh * 1.00);
      g.lineTo(L * .40, -hh * 1.03);
      g.bezierCurveTo(L * .80, -hh * 1.16, L * .96, -hh * 1.62, L * 1.06, -hh * 2.10);
      /* Unterkante: sie liegt IM Wasser, also nur eine flache Andeutung */
      g.lineTo(L * .94, hh * .26);
      g.bezierCurveTo(L * .40, hh * .74, -L * .45, hh * .74, -L * .90, hh * .18);
      g.closePath(); g.fill();

      /* ---------- Boxenwand ----------
         Ein Sound-System stapelt: unten die Baesse, darauf die Tops, und die
         Stapel sind NICHT gleich hoch. Eine gleichmaessige Reihe liest als
         Zaun. */
      const deck = -hh * .98;   /* Boxen stehen AUF der Deckslinie */
      const cols = 9;
      const RB = rng(6161);
      for (let i = 0; i < cols; i++) {
        const cxx = -L * .84 + (L * 1.16) * (i / (cols - 1));
        const cw2 = L * .155;
        const rows = 1 + (RB() < .62 ? 1 : 0) + (RB() < .28 ? 1 : 0);
        let yb = deck;
        for (let r = 0; r < rows; r++) {
          const ch2 = hh * (r === 0 ? 1.15 : .78) * (.85 + RB() * .3);
          const cw3 = cw2 * (r === 0 ? 1 : .86);
          g.fillStyle = `rgb(${dark2})`;
          g.fillRect(cxx - cw3 / 2, yb - ch2, cw3, ch2);
          /* Chassis nur als Bogen zur Lichtseite, keine Kontur ringsum */
          g.strokeStyle = "rgb(150 178 214 / .09)";
          g.lineWidth = Math.max(1, cw3 * .08);
          g.beginPath();
          g.ellipse(cxx, yb - ch2 * .5, cw3 * .28, ch2 * .28, 0, -1.2, 1.2);
          g.stroke();
          yb -= ch2;
        }
        /* Oberkante des Stapels: das einzige harte Licht */
        g.strokeStyle = "rgb(255 208 152 / .30)";
        g.lineWidth = Math.max(1, cw2 * .07);
        g.beginPath(); g.moveTo(cxx - cw2 * .40, yb); g.lineTo(cxx + cw2 * .48, yb); g.stroke();
      }

      /* Steuerhaus achtern */
      g.fillStyle = `rgb(${dark3})`;
      g.fillRect(-L * 1.00, deck - hh * 1.5, L * .22, hh * 1.5);
      g.fillStyle = "rgb(255 210 150 / .34)";
      g.fillRect(-L * .96, deck - hh * 1.22, L * .13, hh * .34);   /* Fenster */

      /* Mast mit Rah und zwei Wanten */
      const mastH = Math.min(hh * 5.2, sea * .16);
      g.fillStyle = `rgb(${dark})`;
      g.fillRect(-L * .03, deck - mastH, Math.max(1, L * .018), mastH);
      g.fillRect(-L * .34, deck - mastH * .86, L * .66, Math.max(1, L * .014));
      g.strokeStyle = `rgb(${dark})`;
      g.lineWidth = Math.max(1, L * .008);
      g.beginPath();
      g.moveTo(-L * .02, deck - mastH); g.lineTo(-L * .80, deck - hh * .1);
      g.moveTo(-L * .02, deck - mastH); g.lineTo(L * .86, deck - hh * .1);
      g.stroke();

      /* ---------- Menschen an Deck ----------
         Sechs Silhouetten. Nichts beglaubigt den Massstab eines Fahrzeugs so
         zuverlaessig wie ein Mensch daneben. */
      const RP = rng(717);
      for (let i = 0; i < 6; i++) {
        const px = L * (.30 + .58 * RP());
        const ph = hh * (1.05 + RP() * .3);
        const sway = Math.sin(secs * (1.6 + RP() * 1.4) + i * 2.2) * ph * .07;
        g.fillStyle = `rgb(${dark})`;
        g.fillRect(px + sway * .4, deck - ph, Math.max(1, ph * .17), ph);
        g.beginPath();
        g.arc(px + sway * .4 + ph * .085, deck - ph - ph * .10, Math.max(1, ph * .11), 0, 6.283);
        g.fill();
        /* erhobene Arme — es ist ein Rave, kein Fischkutter */
        g.strokeStyle = `rgb(${dark})`;
        g.lineWidth = Math.max(1, ph * .07);
        g.beginPath();
        g.moveTo(px + sway * .4, deck - ph * .78);
        g.lineTo(px + sway - ph * .22, deck - ph * (1.05 + .06 * Math.sin(secs * 3 + i)));
        g.moveTo(px + sway * .4 + ph * .17, deck - ph * .78);
        g.lineTo(px + sway + ph * .38, deck - ph * (1.05 + .06 * Math.cos(secs * 3.3 + i)));
        g.stroke();
      }

      /* Deckslinie: warmes Streiflicht, nur oben */
      g.strokeStyle = day ? "rgb(226 236 248 / .45)" : "rgb(255 206 150 / .40)";
      g.lineWidth = Math.max(1, L * .012);
      g.beginPath();
      g.moveTo(-L * .90, -hh * 1.02); g.lineTo(L * .92, -hh * 1.06);
      g.stroke();

      /* Scheinwerfer und Reling-Lichter */
      for (let k = 0; k < 4; k++) {
        const lx = (k - 1.5) * L * .42;
        const ly = deck - hh * (k === 1 ? 3.2 : 2.3);
        const r = L * .12;
        const gr = g.createRadialGradient(lx, ly, 0, lx, ly, r);
        gr.addColorStop(0, `rgb(${BOAT_LIGHTS[k]} / .8)`);
        gr.addColorStop(.32, `rgb(${BOAT_LIGHTS[k]} / .18)`);
        gr.addColorStop(1, `rgb(${BOAT_LIGHTS[k]} / 0)`);
        g.fillStyle = gr;
        g.beginPath(); g.arc(lx, ly, r, 0, 6.283); g.fill();
        g.fillStyle = `rgb(${BOAT_LIGHTS[k]})`;
        g.beginPath(); g.arc(lx, ly, Math.max(.8, L * .012), 0, 6.283); g.fill();
      }
      for (let i = 0; i <= 16; i++) {
        const lx = -L * .90 + (L * 1.82) * (i / 16);
        g.fillStyle = "rgb(255 218 172 / .75)";
        g.fillRect(lx | 0, (deck + hh * .18) | 0, Math.max(1, L * .014), Math.max(1, L * .014));
      }
      g.restore();
    }

    function paintWater(g, secs, sp) {
      /* ---- Brandung ----
         Die Wellen laufen wirklich: der Schaumsaum schiebt sich den Strand
         hinauf und zieht sich wieder zurueck. Die Bewegung ist bewusst
         UNSYMMETRISCH — echte Brandung laeuft schnell auf und sickert langsam
         zurueck. Eine Sinusbewegung saehe nach Atmung aus.
         Gezeichnet wird nur EIN drawImage je Schicht: die Sprites sind
         vorgebacken, pro Frame faellt keine Geometrie mehr an. */
      /* Das Boot liegt DRAUSSEN, die Brandung liegt DAVOR — also zuerst das
         Boot, dann der Schaum. */
      if ((html.dataset.theme || "space") === "strand") paintBoat(g, secs, sp || 0);
      if (surf) {
        for (const l of surf.layers) {
          const ph = ((secs / l.period) + l.phase) % 1;
          const e = ph < .30 ? Math.pow(ph / .30, .55)
                             : 1 - Math.pow((ph - .30) / .70, 1.7);
          g.globalAlpha = Math.min(1, .32 + .85 * e) * l.a;
          g.drawImage(l.img, 0, Math.round(l.baseY + e * l.range));
        }
        g.globalAlpha = 1;
      }
      if (!waveLines.length) return;
      /* Wandernde Duenungskaemme. Der Fortschritt ist LINEAR in der Zeit,
         die Bildposition aber quadratisch — genau so verkuerzt die
         Perspektive eine gleichfoermige Bewegung: am Horizont kriecht der
         Kamm, kurz vor dem Ufer schiesst er los. Fruehen stand hier ein Feld
         zufaelliger Striche, das an Ort und Stelle wackelte; das las sich als
         Bildrauschen, nicht als Seegang. */
      const span2 = seaEnd - seaTop;
      const mx = moon ? moon.x : w * .3;
      g.save();
      for (const wl of waveLines) {
        const p = ((secs / wl.per) + wl.off) % 1;
        const t = Math.pow(p, 2.3);
        const y = seaTop + span2 * t;
        const amp = (.5 + t * 11) * DPR;
        const th = Math.max(1, (.5 + t * 2.1) * DPR);
        const fade = Math.sin(Math.PI * Math.min(1, p * 1.12)) * (.10 + .9 * t);
        /* Unsichtbare Kaemme kosten sonst den vollen Preis. Kurz nach dem
           Horizont ist `fade` noch fast null, und ab p > .893 ist es EXAKT
           null: `min(1, p·1.12)` steht dann auf 1, und `sin(pi)` ist 0. Solche
           Kaemme wurden bisher trotzdem zweimal ueber die volle Breite
           gestrichelt — mit Verlaufskontur — und liefen, weil t dort gross ist,
           zusaetzlich durch die teure Schaumschleife. Gezeichnet wurde davon
           nichts. */
        if (fade < .012) continue;
        const grid = wl.grid;
        /* Helligkeit folgt dem Reflexionskegel: ein Kamm leuchtet nur dort,
           wo er den Mond ins Auge spiegelt.
           Der Verlauf haengt NUR an Mondposition und Wasserbreite, also wird
           er einmal gebaut und danach wiederverwendet; das zeitabhaengige
           Auf- und Abblenden uebernimmt globalAlpha. Vorher entstanden hier
           ein Verlaufsobjekt je Kamm und Frame — bei 46 Kaemmen und 60 Hz
           sind das 2760 Allokationen je Sekunde, nur um dieselben fuenf
           Farbstopps neu zu schreiben. */
        if (!crestGrad) {
          crestGrad = g.createLinearGradient(mx - span2 * 2.4, 0, mx + span2 * 2.4, 0);
          crestGrad.addColorStop(0,   "rgb(206 226 255 / .03)");
          crestGrad.addColorStop(.42, "rgb(224 238 255 / .20)");
          crestGrad.addColorStop(.5,  "rgb(238 246 255 / .34)");
          crestGrad.addColorStop(.58, "rgb(224 238 255 / .20)");
          crestGrad.addColorStop(1,   "rgb(206 226 255 / .03)");
        }
        g.globalAlpha = fade;
        g.strokeStyle = crestGrad;
        g.lineWidth = th;
        g.beginPath();
        for (let i = 0; i < grid.n; i++) {
          const v = y + grid.s1[i] * amp + grid.s2[i] * amp * .42;
          i === 0 ? g.moveTo(grid.x[i], v) : g.lineTo(grid.x[i], v);
        }
        g.stroke();
        /* abgewandte Flanke direkt darunter — der Hell-Dunkel-Sprung IST der
           Glanz; eine einzelne helle Linie liest als Kratzer. */
        g.strokeStyle = "rgb(3 8 20 / .16)";
        g.lineWidth = th * 1.15;
        g.beginPath();
        for (let i = 0; i < grid.n; i++) {
          const v = y + grid.s1[i] * amp + grid.s2[i] * amp * .42 + th * 1.2;
          i === 0 ? g.moveTo(grid.x[i], v) : g.lineTo(grid.x[i], v);
        }
        g.stroke();

        /* BRECHEN. Sobald der Kamm ins Flachwasser laeuft, kippt er vornueber
           und wird weiss — und zwar nicht auf ganzer Breite gleichzeitig,
           sondern in Abschnitten. Der Schaumkamm sitzt AUF der Kammlinie und
           laeuft nach unten aus, weil der Brecher nach vorne faellt. */
        if (t > .52) {
          const br = Math.min(1, (t - .52) / .34);
          const fh2 = th * (1.2 + 5.5 * br);
          /* EIN Verlauf je Kamm, nicht je Abschnitt: er wird am Bezugspunkt y
             gebaut und fuer jeden Abschnitt nur verschoben. Vorher entstand
             hier pro Frame ein Verlaufsobjekt je Schaumstueck — der teuerste
             Einzelposten der ganzen Szene. */
          /* Der Verlauf haengt am Kamm — und der wandert in jedem Bild.
             Damit war er nicht cachebar und wurde je Kamm und Bild neu
             gebaut; bei bis zu 46 Kaemmen der teuerste verbliebene Posten
             der Strandszene (gemessen war Strand/Stufe m der schlechteste
             Fall im ganzen Bestand: p95 116 ms, Spitze 166 ms).

             Der Ausweg ist ein Wechsel des Bezugspunkts: der Verlauf wird um
             NULL herum gebaut statt um y, und die Verschiebung um y
             uebernimmt die Transformationsmatrix, die hier je Abschnitt
             ohnehin gesetzt wird. Damit haengt er nur noch an Hoehe und
             Brechgrad, beide grob gestuft.
             Gezeichnet wird exakt dasselbe: jeder Pfadpunkt ist um dieselbe
             Konstante y verschoben wie der Verlauf. */
          const brQ = Math.round(br * 32) / 32;
          const fhQ = Math.round(fh2);
          const schaumKey = `${fhQ}|${brQ}`;
          let gr = schaumGrads.get(schaumKey);
          if (!gr) {
            if (schaumGrads.size > 64) schaumGrads.clear();
            gr = g.createLinearGradient(0, -fhQ, 0, fhQ * .7);
            gr.addColorStop(0,   "rgb(236 246 255 / 0)");
            gr.addColorStop(.42, `rgb(236 246 255 / ${(.42 * brQ).toFixed(3)})`);
            gr.addColorStop(.62, `rgb(248 252 255 / ${(.86 * brQ).toFixed(3)})`);
            gr.addColorStop(.80, `rgb(226 240 255 / ${(.34 * brQ).toFixed(3)})`);
            gr.addColorStop(1,   "rgb(226 240 255 / 0)");
            schaumGrads.set(schaumKey, gr);
          }
          g.fillStyle = gr;
          /* Welche Abschnitte brechen und wo sie liegen, steht seit
             `buildWaveTables` fest — hier bleibt nur noch das Zeichnen. */
          for (const sg of wl.segs) {
            const dy = sg.s1x * amp + sg.s2x * amp * .42;
            g.save(); g.translate(0, y + dy);
            g.beginPath();
            g.moveTo(sg.x, -fh2);
            const up = sg.up, dn = sg.dn;
            for (let k = 0; k < up.n; k++)
              g.lineTo(up.x[k], up.s1[k] * amp + up.s2[k] * amp * .42 - dy - fh2 * .35);
            for (let k = 0; k < dn.n; k++)
              g.lineTo(dn.x[k], dn.s1[k] * amp + dn.s2[k] * amp * .42 - dy + fh2 * .55);
            g.closePath(); g.fill();
            g.restore();
          }
        }
      }
      g.restore();
      g.globalAlpha = 1;
      if (!moon) return;
      g.fillStyle = "rgb(236 244 255)";
      for (const gl of glints) {
        const sv = Math.sin(gl.phase + secs * gl.speed);
        if (sv <= 0) continue;
        const a = Math.pow(sv, 8);
        if (a < .02) continue;
        g.globalAlpha = a * .95;
        g.fillRect((moon.x + gl.dx) | 0, gl.y, gl.len, gl.th || (DPR | 0));
      }
      g.globalAlpha = 1;
    }

    /* ---- Sternschnuppen ---- */
    function spawnMeteor() {
      const fromLeft = Math.random() < .55;
      const ang = (fromLeft ? 0.42 : 2.72) + (Math.random() - .5) * .3;
      return {
        x: fromLeft ? Math.random() * w * .5 : w * (.5 + Math.random() * .5),
        y: Math.random() * h * .45,
        vx: Math.cos(ang), vy: Math.sin(ang),
        speed: (11 + Math.random() * 9) * DPR,
        len: (90 + Math.random() * 150) * DPR,
        life: 0, ttl: 62 + Math.random() * 46,
        bright: .5 + Math.random() * .5,
      };
    }
    function paintMeteors(g, dt) {
      const now = performance.now();
      if (now > nextMeteor && meteors.length < 2) {
        meteors.push(spawnMeteor());
        /* im Schnitt alle ~9 s eine — haeufiger wirkt wie Feuerwerk */
        nextMeteor = now + 5200 + Math.random() * 9000;
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.life += dt / 16;
        m.x += m.vx * m.speed * (dt / 16);
        m.y += m.vy * m.speed * (dt / 16);
        const k = m.life / m.ttl;
        if (k >= 1 || m.x < -400 || m.x > w + 400 || m.y > h + 400) { meteors.splice(i, 1); continue; }
        /* an- und abschwellen, nicht hart ein/aus */
        const fade = Math.sin(Math.min(1, k) * Math.PI) * m.bright;
        const tx = m.x - m.vx * m.len, ty = m.y - m.vy * m.len;
        const gr = g.createLinearGradient(m.x, m.y, tx, ty);
        gr.addColorStop(0, `rgb(255 252 244 / ${(.95 * fade).toFixed(3)})`);
        gr.addColorStop(.25, `rgb(206 220 255 / ${(.42 * fade).toFixed(3)})`);
        gr.addColorStop(1, "rgb(180 200 255 / 0)");
        g.strokeStyle = gr;
        g.lineWidth = 1.5 * DPR;
        g.lineCap = "round";
        g.beginPath(); g.moveTo(tx, ty); g.lineTo(m.x, m.y); g.stroke();
        /* Kopf */
        g.fillStyle = `rgb(255 253 248 / ${(.9 * fade).toFixed(3)})`;
        g.beginPath(); g.arc(m.x, m.y, 1.5 * DPR, 0, 6.283); g.fill();
      }
    }

    function resize() {
      DPR = dprBasis() * dprFaktor(qualitaet());
      w = canvas.width = Math.max(1, Math.floor(innerWidth * DPR));
      h = canvas.height = Math.max(1, Math.floor(innerHeight * DPR));
      canvas.style.width = innerWidth + "px";
      canvas.style.height = innerHeight + "px";

      const tier = html.dataset.fx;
      const full = tier === "l";
      const still = tier === "s";                 /* "Aus": alles statisch */
      const area = (innerWidth * innerHeight) / (1440 * 900);
      /* Deckel von 2.2 auf 1.4: auf einem grossen, hochaufloesenden
         Schirm multiplizierte sich diese Skalierung mit DPR 2 — mehr
         Sterne UND mehr Pixel je Stern. Genau dort ruckelte es. */
      const scale = Math.min(1.4, Math.max(.55, area));
      /* Auch in der ruhigsten Stufe bleibt der Himmel gut gefuellt — er wird
         nur einmal gezeichnet statt animiert. */
      /* Tag: ein stark ausgeduennter Sternenhimmel bleibt stehen. Streng
         genommen sieht man tagsueber keine Sterne — aber die Bewegung des
         Feldes beim Scrollen ist ein Kernmerkmal dieser Seite, und ohne sie
         steht der Tag-Himmel still. Also wenige, sehr schwache, additiv
         gezeichnete Punkte: sie lesen sich als Flimmern in der Hoehe, nicht
         als Nachthimmel. Wenige heisst auch: der teure Teil (das
         Rueckweisungsverfahren zieht bei 2600 Sternen bis zu 36.000
         Stichproben) faellt praktisch weg. */
      const total = (dayMode() && !spaceDay())
        ? Math.round((full ? 110 : still ? 70 : 90) * scale)
        : Math.round((full ? 2600 : still ? 2100 : 1700) * scale);

      /* Weniger Sterne wuerden den Himmel leer wirken lassen. Deshalb werden
         die verbliebenen etwas groesser und heller — die Gesamthelligkeit
         bleibt dadurch ungefaehr erhalten. */
      const density = total / (2600 * scale);
      const sizeComp = Math.pow(1 / Math.max(.35, density), .34);

      const nz = { bright: noise2(1), dust: noise2(7), pbright: pnoise2(3), pdust: pnoise2(11) };

      /* Positionen per Rueckweisungsverfahren: entlang des Bandes stehen mehr
         Sterne. Das erzeugt die Milchstrasse aus Sternen statt aus Farbe. */
      const all = [];
      let guard = 0;
      while (all.length < total && guard < total * 14) {
        guard++;
        const x = Math.random() * w, y = Math.random() * h;
        const dens = bandDensity(x, y, nz);
        if (Math.random() > .30 + .70 * dens) continue;   /* 30 % Grundrauschen */
        all.push(makeStar(x, y));
      }

      /* auf das hellste Objekt im Feld normieren */
      let maxLum = 0;
      for (const s of all) if (s.lum > maxLum) maxLum = s.lum;
      for (const s of all) {
        s.norm = s.lum / maxLum;
        s.alpha = Math.min(1, Math.pow(s.norm, .40) * 1.05 * (1 + (sizeComp - 1) * .45));
        /* Tagsueber WENIGE und dafuer deutlich. Der Grund ist rechnerisch:
           der Taghimmel liegt bei rund (190 215 245), ein Punkt muss also
           erst einmal HELLER als das werden, um ueberhaupt aufzufallen. Bei
           Deckkraft .1 verschiebt sich das Pixel um ganze sechs Stufen und
           liest sich als Schmutz, nicht als Stern. Also Grundhelligkeit .38
           und von dort mit der Leuchtkraft nach oben — dann sind es wenige
           klar erkennbare Punkte statt hundert Andeutungen. Genau so sieht
           man tagsueber ja auch nur die hellsten Objekte. */
        if (dayMode() && !spaceDay()) {
          s.alpha = Math.min(1, .38 + .62 * s.norm);
          /* Und WEISS. Die Sternfarben folgen nachts dem Planckschen
             Ortsbogen, der kaelteste Ton ist ein blasses Blau um
             (180 200 255). Auf dem Taghimmel (rund 190 215 245) ist das im
             Rotkanal DUNKLER als der Grund — die Punkte lesen sich dann als
             blaue Flecken statt als Lichter. Tagsueber ist ohnehin nur
             sichtbar, was heller ist als der Himmel, und das ist per
             Definition weiss. */
          s.col = "255 255 255";
          s.fill = "rgb(255 255 255)";
        }
        s.rad = (0.40 + 1.9 * Math.pow(s.norm, .30)) * DPR * sizeComp;
      }

      /* Der Mond verschwindet in niedrigeren Stufen nicht, er wird kleiner.
         Er ist statisch und kostet nur beim Neuzeichnen der Textur. */
      /* Im Strand-Theme steht der Mond ueber dem Wasser: sein Glitzerpfad muss
         auf der Wasserflaeche des Fotos landen, nicht auf dem Sand. */
      const themeNow = html.dataset.theme || "space";
      const moonXF = themeNow === "strand" ? .30 : themeNow === "mars" ? .90 : .855;
      moon = {
        /* Kleiner und weiter in die Ecke: der Mond soll den Himmel
           beglaubigen, nicht das Bild an sich reissen. */
        x: w * moonXF, y: h * .26,
        r: Math.max(11, Math.min(w, h) * (full ? .046 : .034)),
        /* Parallaxe gegen den Sternenhintergrund — klein, aber vorhanden */
        drift: -w * .045, rise: h * .05,
        /* Der Wuerfelwurf faellt EINMAL je Sitzung, nicht bei jedem Resize.
           Der Seed verschiebt die Librationsphase; wuerde er neu gezogen,
           waere die ganze Texturleiter nach jedem Resize ungueltig — und auf
           Mobilgeraeten feuert jede Bewegung der Adressleiste ein Resize.
           Sichtbar ist der Unterschied nicht: die Neigung des Mondes wuerfelt
           sich nach einem Resize dann eben nicht neu. */
        seed: moonSeed,
      };

      /* Die Texturgroesse haengt am Mondradius, der Mondradius am Fenster.
         Aendert sie sich, sind die abgelegten Texturen wertlos — sonst nicht,
         und dann ueberlebt die Leiter das Resize. */
      const pxNow = Math.max(96, Math.round(moon.r * 2 * 2.0));
      if (pxNow !== moonPx) { moonPx = pxNow; moonCacheClear(); }
      prewarmMoon();

      /* Die helleren Sterne bewegen sich (nahe Objekte, viel Parallaxe), die
         schwaecheren werden eingebacken (ferne Objekte, kaum Parallaxe).
         Canvas 2D traegt zuverlaessig einige hundert bewegte Objekte —
         Tausende brauchen WebGL. */
      paintHorizon();
      seedGlints();

      all.sort((a, b) => b.norm - a.norm);
      /* Der Qualitaetsfaktor greift hier als zweiter Hebel nach der
         Aufloesung. Nie unter 40 % der Sterne: darunter wird der Himmel
         sichtbar leer, und dann hat man Qualitaet gegen nichts getauscht. */
      const qNow = 0.4 + 0.6 * qualitaet();
      const liveCount = still ? 0
        : (dayMode() && !spaceDay()) ? all.length
        : Math.min(Math.round((full ? 620 : 300) * qNow), all.length);
      live = all.slice(0, liveCount);
      paintBackdrop(all.slice(liveCount), nz);
      meteors = [];

      /* In Stufe "Aus" kommt der Mond mit in die statische Ebene, damit ohne
         laufende Animation trotzdem der ganze Himmel steht. */
      if (still && moon) {
        const bg = backdrop.getContext("2d");
        if (dayMode()) paintSun(bg, 0);
        else ((html.dataset.theme || "space") === "mars" ? paintPhobos : paintMoon)(bg, 0);
      }
    }

    function frame(t) {
      if (w === 0 || h === 0) ensureSize();
      const dt = Math.min(48, t - lastT); lastT = t;
      const secs = (t - t0) / 1000;
      /* Fluchtpunkt leicht ueber der Bildmitte — wir steigen ja auf */
      const vpX = w * .5, vpY = h * .34;

      /* Zurueckgelegter Weg seit dem letzten Frame, in Pixeln. Daraus
         entsteht die Vorwaertsfahrt — nicht aus einer geglaetteten
         Momentangeschwindigkeit, die immer traege nachhinkt. */
      const sy = sySnapshot;
      const rawDelta = sy - lastScroll;
      lastScroll = sy;
      travel += (rawDelta * .11 - travel) * .22;
      if (Math.abs(travel) < .004) travel = 0;

      ctx.clearRect(0, 0, w, h);

      const sp = env.scrollP;
      /* Tag: statt eines Mondes die Sonne. Die Sterne sind schon in resize()
         weggefallen (live ist leer), die Schleife darunter laeuft also ins
         Leere und muss nicht extra uebersprungen werden. */
      if (dayMode()) paintSun(ctx, sp);
      /* Im Mars-Theme stehen Phobos und Deimos am Himmel, nicht unser Mond. */
      else if ((html.dataset.theme || "space") === "mars") paintPhobos(ctx, sp);
      else paintMoon(ctx, sp);

      const warp = Math.abs(travel);
      for (const bs of buckets) for (const lv of bs) lv.length = 0;

      for (const s of live) {
        /* Hoehengradient: horizontnah (unten) turbulenter als zenitnah */
        const alt = 1 - s.y / h;
        const amp = .07 + .30 * (1 - alt);
        const n = .55 * Math.sin(secs * s.f1 * 6.283 + s.p1)
                + .30 * Math.sin(secs * s.f1 * 2.31 * 6.283 + s.p2)
                + .15 * Math.sin(secs * s.f1 * 5.70 * 6.283 + s.p3);
        if (Math.random() < .00035 * (1 - alt + .3)) s.flash = 1;
        s.flash *= .84;
        /* multiplikativ, nicht additiv */
        let a = s.alpha * (1 + amp * n) * (1 + 1.8 * s.flash);
        a = Math.max(0, Math.min(1, a));

        /* PERSPEKTIVE. Wer sich vorwaerts bewegt, sieht die Sterne von einem
           Fluchtpunkt radial nach aussen stroemen — nicht alle gleichfoermig
           nach oben schieben. Derselbe Effekt wie Schnee im Scheinwerferlicht.
           Die Verschiebung waechst mit dem Abstand zum Fluchtpunkt und mit der
           scheinbaren Naehe des Sterns. */
        const vx = s.x - vpX, vy = s.y - vpY;
        const vd = Math.sqrt(vx * vx + vy * vy) || 1;
        /* Vorwaertsfahrt: die Verschiebung waechst mit dem Abstand zum
           Fluchtpunkt — genau so sieht Bewegung auf einen Punkt zu aus.
           Nahe Sterne (grosses depth) ziehen schneller vorbei als ferne. */
        const push = travel * s.depth * (0.06 + 1.35 * (vd / (h * .55)));
        s.x += (vx / vd) * push;
        s.y += (vy / vd) * push;
        s.y -= s.depth * .05 * DPR * (dt / 16);      /* sehr langsame Grunddrift */

        /* am Rand neu einsetzen, damit das Feld nicht ausduennt */
        if (s.x < -30 || s.x > w + 30 || s.y < -30 || s.y > h + 30) {
          const a = Math.random() * 6.283;
          const rr = (.05 + Math.random() * .22) * Math.min(w, h);
          s.x = vpX + Math.cos(a) * rr;
          s.y = vpY + Math.sin(a) * rr;
        }

        /* Warp-Streifen zeigen in die Bewegungsrichtung, also radial */
        const stretch = Math.abs(travel) * s.depth * (vd / (h * .55)) * .85;
        let r = s.rad;
        if (r < .62 * DPR) { a *= (r / (.62 * DPR)) ** 2; r = .62 * DPR; }

        /* Die schwachen Sterne — rund 95 % — wandern in Buckets und werden
           weiter unten gebuendelt gezeichnet. Unter ~1.5 px Durchmesser ist
           ein Rechteck von einem Kreis nicht zu unterscheiden. */
        if (s.norm < .05 && stretch <= 2) {
          const lvl = a >= .999 ? A_STEPS - 1 : (a * A_STEPS) | 0;
          const bk = buckets[s.ci][lvl];
          bk.push(s.x - r, s.y - r, r * 2);
          continue;
        }

        ctx.globalAlpha = a;
        ctx.fillStyle = ctx.strokeStyle = s.fill;

        if (stretch > 2) {
          ctx.lineWidth = Math.max(.7, s.rad);
          ctx.beginPath();
          ctx.moveTo(s.x - (vx / vd) * stretch, s.y - (vy / vd) * stretch);
          ctx.lineTo(s.x, s.y);
          ctx.stroke();
          continue;
        }
        ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 6.283); ctx.fill();

        /* Nur die wirklich hellen bekommen Hof und Spikes */
        if (s.norm > .18) {
          const gs = r * 9;
          ctx.globalAlpha = a;
          ctx.drawImage(glowSprite(s.col), s.x - gs, s.y - gs, gs * 2, gs * 2);
          if (s.norm > .45) {
            const sp = r * (5 + 5 * s.flash);
            ctx.globalAlpha = a * .34;
            ctx.strokeStyle = s.fill;
            ctx.lineWidth = Math.max(.6, r * .32);
            ctx.beginPath();
            ctx.moveTo(s.x - sp, s.y); ctx.lineTo(s.x + sp, s.y);
            ctx.moveTo(s.x, s.y - sp); ctx.lineTo(s.x, s.y + sp);
            ctx.stroke();
          }
        }
      }

      /* Gebuendelte Ausgabe: ein Zustandswechsel je Farbe und Helligkeitsstufe */
      for (let c = 0; c < COL_STEPS; c++) {
        const pal = palette[c];
        let styleSet = false;
        for (let l = 0; l < A_STEPS; l++) {
          const bk = buckets[c][l];
          if (!bk.length) continue;
          /* Tagsueber weiss statt Planck-Farbe — siehe Begruendung bei der
             Alpha-Anhebung in resize(). Die gebuendelte Ausgabe greift auf
             die Palette zu, nicht auf s.fill, und muss deshalb mit. */
          if (!styleSet) { ctx.fillStyle = (dayMode() && !spaceDay()) ? "rgb(255 255 255)" : `rgb(${pal.r} ${pal.g} ${pal.b})`; styleSet = true; }
          ctx.globalAlpha = (l + .5) / A_STEPS;
          for (let i = 0; i < bk.length; i += 3) ctx.fillRect(bk[i], bk[i + 1], bk[i + 2], bk[i + 2]);
        }
      }
      ctx.globalAlpha = 1;

      /* Der Glitzerpfad ist das Einzige, was sich am Boden bewegt. Er wird auf
         die Horizontebene gezeichnet und nur dort geloescht, wo er liegt. */
      const themeNow = html.dataset.theme || "space";
      if (themeNow === "mars" && groundTopY) {
        /* Auf dem Mars traegt die bewegte Ebene Rover und Rakete. Sie
           erstreckt sich ueber das ganze Bild, weil die Rakete bis zu Phobos
           steigt. */
        const gg = glintLayer.getContext("2d");
        gg.setTransform(1, 0, 0, 1, 0, 0);
        gg.clearRect(0, 0, w, h);
        const _mt0 = PERF ? performance.now() : 0;
        paintMarsFX(gg, secs, sp, dt);
        if (PERF) {
          const _M = window.__marsPerf || (window.__marsPerf = { n: 0, ms: 0 });
          _M.n++; _M.ms += performance.now() - _mt0;
        }
      } else if (glints.length || waveLines.length || surf) {
        const gg = glintLayer.getContext("2d");
        gg.setTransform(1, 0, 0, 1, 0, -glintTop);
        gg.clearRect(0, glintTop, w, glintLayer.height);
        const _wt0 = PERF ? performance.now() : 0;
        paintWater(gg, secs, sp);
        if (PERF) {
          const _W = window.__waterPerf || (window.__waterPerf = { n: 0, ms: 0 });
          _W.n++; _W.ms += performance.now() - _wt0;
        }
      }

      /* Meteore pausieren tagsueber — man sieht sie am Taghimmel nicht. */
      if (html.dataset.fx === "l" && !dayMode()) paintMeteors(ctx, dt);
    }

    function ensureSize() {
      if (w === 0 || h === 0 || Math.abs(w - innerWidth * DPR) > 2) resize();
    }
    function start() {
      if (html.dataset.fx === "s") { stop(); return; }   /* statisch: kein Takt */
      if (!running) {
        ensureSize(); running = true; lastT = performance.now();
        abmelden = taktAnmelden({
          /* Lesen: nur die Scroll-Position. Mehr braucht die Szene nicht
             aus dem Layout — alles andere sind eigene Zustandswerte. */
          lesen: () => { sySnapshot = scrollY; },
          schreiben: t => frame(t),
        });
      }
    }
    function stop() { running = false; abmelden?.(); abmelden = null; }

    /* resize entprellen: auf Mobile feuert jede Bewegung der URL-Leiste */
    let rt = 0;
    addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 180); }, { passive: true });
    document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else { ensureSize(); start(); } });
    resize(); start();
    /* Vorher war `refreshAccents` eine leere Funktion — das Canvas reagierte
       ueberhaupt nicht auf Themewechsel. Jetzt wird der Himmelskoerper neu
       bestimmt und der Boden neu gebacken. */
    function refreshTheme() {
      resize();
      if (html.dataset.fx === "s") { paintHorizon(); seedGlints(); }
    }
    return { resize, stop, start, refreshTheme, paintHorizon, seedGlints };
  }

