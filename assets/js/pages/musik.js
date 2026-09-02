/* ============================================================
   musik.js — Seiten-Logik fuer musik.html ("Taktgeber")

   1) Gateway-Hydration: Hero-Text kommt aus TakeoffData.page("musik")
      (assets/data/pages/musik.json). Das statische Markup ist der
      Fallback und bleibt korrekt, falls TakeoffData/fetch fehlschlaegt —
      Render-Funktionen fassen eine Liste nur an, wenn wirklich Daten da
      sind (gleiches Vorgehen wie kontakt.js/news.js/awareness.js).
   2) Listen aus dem Gateway: "Sound of takeoff"-Grid aus
      TakeoffData.artists() (genre-first sortiert, zurueck zu den
      Artist-Profilen verlinkt) und Genre-Wegweiser-Chips (Artists +
      TakeoffData.upcoming(), inkl. Bounce/Hard-Bounce-Normalisierung).
   3) Taktgeber-Interaktion: Tap-Tempo-Pad schreibt das eigene Tempo als
      "Du"-Marker live auf die BPM-Skala und matcht gegen die naeheste
      Genre-BPM — Single Source of Truth ist dabei IMMER das DOM
      (.m-row[data-bpm]), nicht eine zweite JS-Konstante (siehe nearest()).
      Kein rAF/Canvas hier: die gesamte Ambient-Schicht (Dial-Zeiger,
      Puls-Punkte) ist reines CSS (musik.css) — dieses Skript reagiert nur
      auf echte Klicks/Taps.
   ============================================================ */
(function () {
  "use strict";

  const html = document.documentElement;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fxOn = () => html.dataset.fx !== "s" && !reduced();

  const main = $("#main");
  if (!main) return;                     // laeuft nur auf musik.html, Guard trotzdem

  /* ---------- Helfer (1:1 Muster aus kontakt.js/news.js/awareness.js) ---------- */
  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function safe(fn, ...args) {
    try { fn(...args); } catch (err) { console.warn("[musik]", fn.name || "render", err); }
  }
  /* H1 traegt den 3-Schicht-Glow auf dem letzten Wort (.glow-Span). Ein
     einfaches textContent-Ersetzen (wie bindText) wuerde den Span killen —
     deshalb eigener Helfer statt TakeoffData.bindText fuer dieses Element
     (identisches Vorgehen wie kollektiv.js/kontakt.js). */
  function setGlowHeadline(el, text) {
    if (!el || !text) return;
    const words = text.trim().split(/\s+/);
    if (!words.length) return;
    let last = words.pop();
    const trailMatch = last.match(/([.!?…,;:]+)$/);
    const trail = trailMatch ? trailMatch[1] : "";
    if (trail) last = last.slice(0, -trail.length);
    el.textContent = "";
    if (words.length) el.append(document.createTextNode(words.join(" ") + " "));
    const span = document.createElement("span");
    span.className = "glow";
    span.textContent = last;
    el.append(span);
    if (trail) el.append(document.createTextNode(trail));
  }
  /* Ein sitewide Sprachumschalter (assets/js/i18n-runtime.js, laeuft VOR
     diesem Skript) uebersetzt [data-i18n]-Elemente inkl. Hero-Eyebrow/
     -Intro/-H1 nach Englisch. Diese Datei kennt nur die deutschen Werte
     aus musik.json — ohne Sprachpruefung wuerde hydrate() eine bereits
     aktive EN-Uebersetzung beim Laden sofort wieder ueberschreiben. Der
     Rest der Hydration (Reinhoeren, Nachtguide, Glossar, FAQ, Track-ID,
     Share) hat keine Entsprechung im Woerterbuch und bleibt unabhaengig
     davon deutsch — wie bei kontakt.js schon heute. */
  const isGerman = () => !html.lang || html.lang === "de";

  /* ---------- Laufzeit-Zustand (Defaults = das, was ohnehin im
     statischen Markup steht; hydrate() aktualisiert nur bei Bedarf) ---------- */
  let EMAIL = "info@takeoff-potsdam.de";
  let TAP_INSTRUCTION = "Tippe im eigenen Takt — mindestens 4×, dann rechnen wir. Klick, Tap oder Leertaste.";
  let TAP_RESULT_TMPL = "Du tippst ~{bpm} BPM — das ist fast {genre}.";
  let TAP_TOO_FAST = "Ordentlich Tempo drauf — schneller als alles, was bei uns läuft.";
  let TAP_TOO_SLOW = "Eher gemütlich — bei uns geht's meist flotter zur Sache.";
  let TRACKID_SUBJECT = "Track-ID gesucht";
  let TRACKID_BODY = "Event:\nUngefähre Uhrzeit:\nWas ich noch weiß (Text, Melodie, Drop):";
  let COPIED_TOAST = "Link kopiert ✓";

  /* ============================================================
     Genre-Normalisierung — EINE Stelle fuer "Bounce"/"Hard Bounce" als
     eine Familie, genutzt vom Reinhoeren-Sort, den Wegweiser-Chips UND
     dem Tap-Tempo-Genrehinweis in der Nachtleiste.
     ============================================================ */
  const GENRE_ORDER = ["trance", "hard-trance", "bounce", "techno", "psytrance"];
  function normalizeGenre(s) {
    const t = String(s || "").trim().toLowerCase();
    if (t === "bounce" || /^hard[\s-]?bounce$/.test(t)) return "bounce";
    if (t === "trance") return "trance";
    if (/^hard[\s-]?trance$/.test(t)) return "hard-trance";
    if (t === "techno" || /^hard[\s-]?techno$/.test(t)) return "techno";
    if (t === "psytrance") return "psytrance";
    return t;
  }
  function primaryGenreRank(genresStr) {
    const first = String(genresStr || "").split(/\s*·\s*/)[0] || "";
    const idx = GENRE_ORDER.indexOf(normalizeGenre(first));
    return idx === -1 ? GENRE_ORDER.length : idx;
  }

  /* ============================================================
     "Sound of takeoff" — Reinhoeren-Grid aus TakeoffData.artists()
     ============================================================ */
  function renderListen(artists, consentNote) {
    const grid = $("#tg-setgrid");
    if (!grid || !Array.isArray(artists) || !artists.length) return;
    const items = [];
    artists.forEach(a => (a.sets || []).forEach(s => items.push({ artist: a, set: s })));
    if (!items.length) return;   // z.B. nur Blaulicht ohne sets[] geladen -> Fallback stehen lassen
    items.sort((x, y) => primaryGenreRank(x.artist.genres) - primaryGenreRank(y.artist.genres));

    const note = esc(consentNote || "Demo: Hier würde jetzt der SoundCloud-/YouTube-Player laden (Zwei-Klick, DSGVO-freundlich).");
    grid.innerHTML = items.map(({ artist, set }) => {
      const isPodcast = /podcast/i.test(`${set.title || ""} ${set.meta || ""}`);
      const label = esc((isPodcast ? "Podcast abspielen: " : "Set abspielen: ") + (set.title || artist.name));
      const metaBits = [set.meta, artist.genres].filter(Boolean).map(esc).join(" · ");
      const linkHtml = artist.page
        ? `<a class="tg-setlink" href="${esc(artist.page)}">${esc(artist.name)}</a>`
        : `<span class="tg-setlink is-static">${esc(artist.name)}</span>`;
      return `<div class="tg-setitem">
        <button class="setcard" type="button" aria-label="${label}">
          <span class="cover"><span class="play" aria-hidden="true">▶</span></span>
          <span class="s-meta"><b>${esc(set.title || artist.name)}</b><span>${metaBits}</span></span>
          <span class="consent-note">${note}</span>
        </button>
        ${linkHtml}
      </div>`;
    }).join("");
    /* Frische Knoten -> main.js' eigene $$(".setcard")-Bindung (laengst
       vor diesem async Render gelaufen) kennt sie nicht. Direkt binden
       statt Delegation: main.js bindet ebenfalls direkt pro Karte, und
       nur so bleibt garantiert GENAU ein Listener pro Karte (Delegation
       auf einem dauerhaft lebenden Container haette hier — solange die
       statischen Fallback-Karten noch sichtbar sind — zu einem
       doppelten, sich gegenseitig aufhebenden Toggle gefuehrt). */
    $$(".setcard", grid).forEach(card => {
      card.addEventListener("click", () => card.classList.toggle("asked"));
    });
  }

  /* ============================================================
     Genre-Wegweiser — Chips zu Artists (artists[].genres, an "·"
     gesplittet) und kommenden Events (TakeoffData.upcoming(), genres[]).
     Nur Ergaenzung: bleibt hidden, wenn nichts passt (kein Datenausfall-
     Risiko fuer den Kerninhalt der Genre-Erklaerungen).
     ============================================================ */
  function renderWayfind(artists, events) {
    const rows = $$(".tg-genres .m-row[data-genre]");
    if (!rows.length) return;
    const artistList = Array.isArray(artists) ? artists : [];
    const eventList = Array.isArray(events) ? events : [];
    rows.forEach(row => {
      const gid = row.dataset.genre;
      const target = $(".tg-wayfind", row);
      if (!target) return;
      const matchArtists = artistList.filter(a => a.page &&
        String(a.genres || "").split(/\s*·\s*/).some(g => normalizeGenre(g) === gid));
      const matchEvents = eventList.filter(e => (e.genres || []).some(g => normalizeGenre(g) === gid));
      if (!matchArtists.length && !matchEvents.length) return;
      let html = "";
      if (matchArtists.length) {
        html += `<span class="tg-wayfind-label">Live gespielt von</span>` +
          matchArtists.map(a => `<a class="chip" href="${esc(a.page)}">${esc(a.name)}</a>`).join("");
      }
      if (matchEvents.length) {
        html += `<span class="tg-wayfind-label">Naechste Termine</span>` +
          matchEvents.map(e => `<a class="chip" href="events.html#${esc(e.slug)}">${esc(e.title)}</a>`).join("");
      }
      target.innerHTML = html;
      target.hidden = false;
    });
  }

  /* ============================================================
     Ablauf einer Nacht — Zeitleiste aus page.nightGuide.phases[]
     ============================================================ */
  function renderNightGuide(phases) {
    const list = $("#tg-night");
    if (!list || !Array.isArray(phases) || !phases.length) return;
    list.innerHTML = phases.map(p => {
      const chips = String(p.genreHint || "").split(/\s*·\s*/).filter(Boolean).map(g => {
        const gid = normalizeGenre(g);
        return GENRE_ORDER.includes(gid)
          ? `<a class="chip" href="#g-${gid}">${esc(g)}</a>`
          : `<span class="chip">${esc(g)}</span>`;
      }).join("");
      return `<li class="tg-phase">
        <span class="tg-phase-time">${esc(p.time)}</span>
        <span class="tg-phase-label">${esc(p.label)}</span>
        <span class="tg-phase-genres">${chips}</span>
        <p class="tg-phase-text">${esc(p.text)}</p>
      </li>`;
    }).join("");
  }

  /* ============================================================
     Mini-Glossar & FAQ — einfache Listen-Renderer, gleiches Muster wie
     kontakt.js' renderFaq (nur ersetzen, wenn wirklich Daten da sind).
     ============================================================ */
  function renderGlossary(list) {
    const wrap = $("#tg-glossary");
    if (!wrap || !Array.isArray(list) || !list.length) return;
    wrap.innerHTML = list.map(item => `<div class="m-row"><dt>${esc(item.term)}</dt><dd>${esc(item.def)}</dd></div>`).join("");
  }
  function renderFaq(list) {
    const wrap = $("#tg-faqlist");
    if (!wrap || !Array.isArray(list) || !list.length) return;
    wrap.innerHTML = list.map(item => `
      <details class="faq">
        <summary>${esc(item.q)}</summary>
        <div class="faq-body">${esc(item.a)}</div>
      </details>`).join("");
  }

  /* ============================================================
     Track-ID-Anfrage — vorausgefuelltes Mailto (buildMailto 1:1 das
     Muster aus kontakt.js).
     ============================================================ */
  function buildMailto(subject, body) {
    const parts = [];
    if (subject) parts.push("subject=" + encodeURIComponent(subject));
    if (body) parts.push("body=" + encodeURIComponent(body));
    return "mailto:" + EMAIL + (parts.length ? "?" + parts.join("&") : "");
  }
  function wireTrackId() {
    const btn = $("#tg-trackid-btn");
    if (!btn) return;
    btn.href = buildMailto(TRACKID_SUBJECT, TRACKID_BODY);
  }

  /* ============================================================
     Teilen-Knopf — Web-Share-API mit Clipboard-Fallback (1:1 das Muster
     aus events.js/awareness.js/news.js).
     ============================================================ */
  let toastEl = null, toastT = 0;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      toastEl.setAttribute("aria-live", "polite");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("show"), 2800);
  }
  function wireShareButtons() {
    $$(".m-share[data-share-text]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const text = btn.dataset.shareText || document.title;
        const url = new URL(btn.dataset.shareUrl || location.href, location.href).href;
        if (navigator.share) {
          try { await navigator.share({ title: document.title, text, url }); return; }
          catch (err) { if (err && err.name === "AbortError") return; /* sonst: Clipboard-Fallback */ }
        }
        try { await navigator.clipboard.writeText(url); toast(COPIED_TOAST); }
        catch { toast(url); }   // letzter Ausweg, falls Clipboard-API fehlt/blockiert ist
      });
    });
  }

  /* ============================================================
     Gateway-Hydration
     ============================================================ */
  async function hydrate() {
    const TD = window.TakeoffData;
    if (!TD) return;
    const [page, settings, artists, upcoming] = await Promise.all([
      TD.page("musik"), TD.settings(), TD.artists(), TD.upcoming(),
    ]);

    if (settings?.email) EMAIL = settings.email;
    if (isGerman()) {
      /* Deckt hero.eyebrow/hero.intro (bestehende, i18n-gewirkte
         Elemente) UND die neuen [data-bind]-Felder ohne eigenen
         Woerterbucheintrag (listen.*, trackId.*, nightGuide.*,
         scale.caption, share.label, tapTempo.button/reset) in einem
         Aufwasch ab — fuer letztere ist die isGerman()-Klammer ein
         No-op (keine EN-Uebersetzung vorhanden, Ergebnis waere mit
         oder ohne Guard dasselbe deutsche Wort), schadet aber nicht
         und haelt genau eine Konvention fuers ganze Skript. */
      if (page) TD.bindText(main, page);
      if (page?.hero?.h1) safe(setGlowHeadline, $(".phero h1"), page.hero.h1);
    }

    /* tapTempo.instruction wird bewusst NICHT per data-bind gesetzt: der
       #tg-tap-match-Text wird gleich danach von wireTap()'s reset()
       ueberschrieben (das ist die einzige Quelle der Wahrheit fuer den
       Ruhetext) — hier nur die Modul-Variable aktualisieren, die
       reset() liest. */
    if (page?.tapTempo?.instruction) TAP_INSTRUCTION = page.tapTempo.instruction;
    if (page?.tapTempo?.resultTemplate) TAP_RESULT_TMPL = page.tapTempo.resultTemplate;
    if (page?.tapTempo?.tooFastText) TAP_TOO_FAST = page.tapTempo.tooFastText;
    if (page?.tapTempo?.tooSlowText) TAP_TOO_SLOW = page.tapTempo.tooSlowText;
    if (page?.trackId?.mailSubject) TRACKID_SUBJECT = page.trackId.mailSubject;
    if (page?.trackId?.mailBody) TRACKID_BODY = page.trackId.mailBody;
    if (page?.share?.copiedToast) COPIED_TOAST = page.share.copiedToast;

    safe(renderListen, artists, page?.listen?.consentNote);
    safe(renderWayfind, artists, upcoming);
    safe(renderNightGuide, page?.nightGuide?.phases);
    safe(renderGlossary, page?.glossary);
    safe(renderFaq, page?.faq);
  }

  /* ============================================================
     Tap-Tempo — misst ueber mind. 4 Klicks/Taps das mittlere Intervall,
     rechnet in BPM um, matcht gegen die naeheste Genre-BPM. Kein
     rAF/setTimeout-Loop: reagiert ausschliesslich auf echte Events.
     ============================================================ */
  const FLAVOR = {
    trance: "genau unser Herzschlag.",
    "hard-trance": "mit ordentlich Schub.",
    bounce: "mit Wumms und Feder.",
  };
  const SCALE_MIN = 60, SCALE_MAX = 180, GAP_RESET_MS = 2200;

  function wireTap() {
    const btn = $("#tg-tap-btn");
    if (!btn) return;                       // Guard: nur auf musik.html

    const numEl = $("#tg-tap-num"), matchEl = $("#tg-tap-match");
    const youMark = $("#tg-you"), youBpm = $("#tg-you-bpm"), resetBtn = $("#tg-tap-reset");

    /* Single Source of Truth: BPM kommt aus dem DOM (data-bpm), nicht aus
       einer zweiten, redundanten JS-Konstante -> musik.json/Admin kann
       die Zahl spaeter aendern, ohne dass dieses Script angefasst wird. */
    const genres = $$(".tg-genres .m-row[data-bpm]")
      .map(row => ({ row, bpm: parseFloat(row.dataset.bpm), label: row.querySelector("dt")?.textContent.trim() || "" }))
      .filter(g => !Number.isNaN(g.bpm));   // Techno/Psytrance (data-bpm="") fallen automatisch raus
    if (!genres.length) return;

    let taps = [];
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const nearest = bpm => genres.reduce((best, g) =>
      Math.abs(g.bpm - bpm) < Math.abs(best.bpm - bpm) ? g : best, genres[0]);

    function describe(bpm) {
      const g = nearest(bpm), dist = Math.abs(g.bpm - bpm);
      if (dist <= 4) {
        const flavor = FLAVOR[g.row.dataset.genre] || "";
        const filled = esc(TAP_RESULT_TMPL)
          .replace("{bpm}", `<b>${Math.round(bpm)}</b>`)
          .replace("{genre}", `<b>${esc(g.label)}</b>`);
        return flavor ? `${filled} ${esc(flavor)}` : filled;
      }
      if (dist <= 9) {
        return `Nah an <b>${esc(g.label)}</b> (${g.bpm} BPM) — eine Idee ${bpm < g.bpm ? "schneller" : "langsamer"}.`;
      }
      return esc(bpm < g.bpm ? TAP_TOO_SLOW : TAP_TOO_FAST);
    }

    function render(bpm) {
      numEl.textContent = Math.round(bpm);
      matchEl.innerHTML = describe(bpm);
      youMark.hidden = false;
      youMark.style.setProperty("--at", clamp(bpm, SCALE_MIN, SCALE_MAX));
      youBpm.textContent = Math.round(bpm);
      resetBtn.hidden = false;
      const g = nearest(bpm), dist = Math.abs(g.bpm - bpm);
      $$(".tg-genres .m-row").forEach(r => r.classList.toggle("is-matched", dist <= 4 && r === g.row));
    }

    function reset() {
      taps = [];
      youMark.hidden = true; resetBtn.hidden = true; numEl.textContent = "—";
      matchEl.textContent = TAP_INSTRUCTION;
      $$(".tg-genres .m-row.is-matched").forEach(r => r.classList.remove("is-matched"));
    }

    function tap() {
      const now = performance.now();
      if (taps.length && now - taps.at(-1) > GAP_RESET_MS) taps = [];   // alte Serie verwerfen, Anzeige bleibt stehen
      taps.push(now);
      if (taps.length > 8) taps.shift();                                 // gleitendes Fenster

      if (taps.length >= 2) {
        const gaps = taps.slice(1).map((t, i) => t - taps[i]);
        const bpm = 60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length);
        if (bpm >= 40 && bpm <= 300) render(bpm);                        // Ausreisser ignorieren
      } else {
        matchEl.textContent = "Nochmal — beim zweiten Tipp erkennen wir den Takt.";
      }

      if (fxOn()) { btn.classList.remove("is-tapped"); void btn.offsetWidth; btn.classList.add("is-tapped"); }
    }

    btn.addEventListener("click", tap);       // <button> loest bei Enter/Space automatisch click aus
    resetBtn.addEventListener("click", reset);
    reset();                                   // Startzustand
  }

  (async () => {
    await hydrate().catch(err => console.warn("[musik] Gateway-Daten nicht ladbar — Fallback-Markup bleibt stehen.", err));
    wireTap();
    safe(wireTrackId);
    wireShareButtons();
  })();
})();
