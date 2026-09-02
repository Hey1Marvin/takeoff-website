/* ============================================================
   events.js — Abflugtafel-Logik für events.html
   Datenhoheit: TakeoffData (assets/js/data.js). Ohne Gateway/Fetch
   bleibt das handgeschriebene Markup stehen (progressive enhancement) —
   es ist bereits vollständig und korrekt, JS synchronisiert nur die
   wirklich dynamischen Teile (Status, Genre-/Preis-Chips, Zähler,
   Leerzustand) und liefert reine Client-Features (Teilen, Patch-Log,
   BPM-Tap-Tempo, Board-Uhr, Flap-Choreografie).

   Bewusst NICHT hier: FAQ-Rendering — die Karteikarten kommen 1:1 aus
   assets/data/pages/events.json, aber als handgeschriebenes Markup in
   events.html ("null zusätzliches JS", siehe Aufgabenstellung).
   ============================================================ */
(() => {
  "use strict";
  const html = document.documentElement;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const fxOn    = () => html.dataset.fx !== "s";
  const fxFull  = () => html.dataset.fx === "l";
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  const board = $("[data-board]");
  if (!board) return;   // Guard: laeuft nur, wenn die Tafel im DOM ist (DATA.md-Pflicht)

  const DEFAULT_BOARDING_WINDOW_H = 48;
  const cssEsc = s => (window.CSS && CSS.escape) ? CSS.escape(String(s)) : String(s).replace(/["\\]/g, "\\$&");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Storage: darf nie das Skript killen (Safari Private Mode
     etc. werfen bei jedem Zugriff) — eigener Namespace, unabhängig von
     main.js' internem Egg-Storage. ---------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* egal */ } },
  };
  const PATCH_KEY = "takeoff-events-patchlog";
  const readPatches = () => {
    try { const v = JSON.parse(store.get(PATCH_KEY) || "[]"); return Array.isArray(v) ? v : []; }
    catch { return []; }
  };

  /* ---------- Eigener Toast --------------------------------------
     main.js legt sein .toast-Element nur an, wenn es Sammel-Items
     (.ditem[data-secret]) gibt — auf events.html existieren keine.
     Gleiches CSS-Pattern (.toast/.toast.show aus style.css), eigene
     Instanz. */
  let toastEl = null, toastT = 0;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("show"), 2800);
  }

  /* ============================================================
     Flap-Engine — worteweise, nicht zeichenweise (siehe Anti-Kitsch:
     Statuswörter bleiben als ein Textknoten erhalten, kein Zerlegen in
     Buchstaben-Spans).
     ============================================================ */
  function flapTo(el, text, { force = false } = {}) {
    if (!el) return;
    const live = $(".flap-face--live", el) ?? el;
    if (!force && live.textContent.trim() === text) return;
    if (el.classList.contains("is-flapping")) return;   // schon in Bewegung — nicht ueberlappend neu starten

    if (!fxOn() || reduced()) { live.textContent = text; return; }

    const stack = $(".flap-stack", el) ?? el;
    const incoming = document.createElement("span");
    incoming.className = "flap-face flap-face--incoming";
    incoming.textContent = text;
    stack.appendChild(incoming);
    el.classList.add("is-flapping");

    const finish = () => {
      live.textContent = text;
      incoming.remove();
      el.classList.remove("is-flapping");
      el.removeEventListener("animationend", onEnd);
    };
    /* Nur das SPAETER endende flap-in (auf .flap-face--incoming) beendet
       den Zyklus — animationend bubbelt von beiden Kindknoten, aber
       flap-out (auf .flap-face--live) ist bei .32s schon fertig, waehrend
       flap-in wegen des .28s-Delays erst bei .6s abschliesst. */
    const onEnd = e => { if (e.target === incoming) finish(); };
    el.addEventListener("animationend", onEnd);
    setTimeout(finish, 900);   // Sicherheitsnetz (versteckter Tab, verpasstes Event o.ä.)
  }

  /* ============================================================
     Statuslogik — TakeoffData ist Quelle der Wahrheit.
     db.json kennt nur 3 state-Werte (upcoming/tba/past); die vier
     Tafel-Stati ergeben sich daraus ohne Schema-Aenderung.
     ============================================================ */
  function computeLabel(ev, boardingWindowH) {
    if (ev.state === "tba") return "TBA 🤫";
    const doorsRaw = /^\d\d:\d\d$/.test(ev.doors || "") ? ev.doors : "00:00";
    const doorsMs = Date.parse(`${ev.date}T${doorsRaw}`);
    if (!Number.isNaN(doorsMs) && (doorsMs - Date.now()) / 36e5 <= boardingWindowH) return "Boarding";
    return "Announced";
  }
  const statusKey = label => label.toLowerCase().replace(/[^a-z]+/g, "") || "announced";

  /* ---------- Genre-/Preis-Chips aus event.genres/pricing ---------- */
  function chipsHtml(ev) {
    const parts = [];
    if (ev.pricing?.label) parts.push(`<span class="chip hot">${esc(ev.pricing.label)}</span>`);
    (ev.genres || []).forEach(g => parts.push(`<span class="chip">${esc(g)}</span>`));
    /* Nur kurze Altersmarken ("18+") werden zum Chip — db.json führt für
       Open Airs auch ausformulierte Sätze im selben Feld ("alle
       Altersgruppen (Open Air am Tag)"), die als Pille unlesbar würden. */
    if (ev.age && /^\d{1,2}\+$/.test(ev.age)) parts.push(`<span class="chip">${esc(ev.age)}</span>`);
    return parts.join("");
  }
  function syncChips(card, ev) {
    const meta = $(".m-meta", card);
    if (!meta) return;
    let chips = $(".chips", card);
    if (!chips) {
      chips = document.createElement("div");
      chips.className = "chips";
      meta.insertAdjacentElement("afterend", chips);
    }
    const html2 = chipsHtml(ev);
    if (html2) chips.innerHTML = html2;
  }

  function upgradeCard(ev, boardingWindowH) {
    const card = $(`.mcard[data-slug="${cssEsc(ev.slug)}"]`);
    if (!card) return;
    /* Kerninhalte aus der DB syncen — damit Admin-Draft-Änderungen
       (Titel, Datum, Ort, Preis, Kurztext) sofort sichtbar sind. */
    const h3 = $("h3", card);
    if (h3 && ev.title) h3.textContent = ev.title;
    const dateEl = $(".m-date", card);
    if (dateEl && ev.date && window.TakeoffData) {
      dateEl.innerHTML = `${esc(ev.weekday || "")} <em>${esc(TakeoffData.fmtDate(ev.date))}</em>`;
    }
    const meta = $(".m-meta", card);
    if (meta && ev.venue) {
      const l1 = [ev.venue.name, ev.doors && ev.doors !== "TBA" ? `ab ${ev.doors}` : "", ev.pricing?.label]
        .filter(Boolean).join(" · ");
      meta.innerHTML = `${esc(l1)}${ev.subtitle ? `<br>${esc(ev.subtitle)}` : ""}`;
    }
    const brief = $(".m-brief", card);
    if (brief && ev.brief) brief.textContent = ev.brief;
    if (ev.theme?.accent) {
      card.style.setProperty("--card-acc", ev.theme.accent);
      if (ev.theme.accentRgb) card.style.setProperty("--card-acc-rgb", ev.theme.accentRgb);
    }
    syncChips(card, ev);
    const pill = $(".status", card);
    if (!pill) return;
    const label = computeLabel(ev, boardingWindowH);
    const key = statusKey(label);
    card.dataset.status = key;
    pill.dataset.flapStatus = key;
    flapTo(pill, label);
  }

  /* Neue Events aus der DB (z. B. per Admin-Draft angelegt) bekommen
     automatisch eine Karte — Kernversprechen der Settings-Seite. */
  const PATCH_ICONS = {
    star: '<path d="M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9z"/>',
    planet: '<circle cx="12" cy="12" r="5.2"/><path d="M4.5 14.6c2.6 1.9 12.6 1.7 15-2.5"/>',
    umbrella: '<path d="M4 12.5a8 8 0 0 1 16 0z"/><path d="M12 4.5V3"/><path d="M12 12.5V18a2 2 0 0 0 4 .5"/>',
    heart: '<path d="M12 20s-7.2-4.6-9.2-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.2 11c-2 4.4-9.2 9-9.2 9z"/>',
  };
  function createCard(ev) {
    const grid = $("#kommend .card-grid");
    if (!grid) return;
    const card = document.createElement("article");
    card.className = "mcard";
    card.dataset.slug = ev.slug;
    card.setAttribute("data-expand", "");
    card.innerHTML = `
      <span class="status">Announced</span>
      <div class="patch" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${PATCH_ICONS[ev.theme?.patch] || PATCH_ICONS.star}</svg></div>
      <div class="m-date"></div>
      <h3></h3>
      <p class="m-meta"></p>
      <button class="m-toggle" type="button" aria-expanded="false">Briefing <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
      <div class="m-more"><div class="m-more-inner">
        <p class="m-brief"></p>
        <div class="cta-row"><a class="btn btn-ghost" href="https://t.me/takeoffpotsdam" target="_blank" rel="noopener">Telegram · Updates zuerst</a></div>
      </div></div>`;
    /* Aufklapp-Verhalten (main.js hat zum Boot-Zeitpunkt schon gebunden) */
    const btn = $(".m-toggle", card);
    card.addEventListener("click", e => {
      if (e.target.closest("a") || e.target.closest(".m-more button")) return;
      const open = !card.classList.contains("open");
      card.classList.toggle("open", open);
      btn?.setAttribute("aria-expanded", String(open));
    });
    grid.appendChild(card);
  }

  function createFlogRow(ev) {
    const list = $(".flog");
    if (!list) return;
    const li = document.createElement("li");
    li.dataset.slug = ev.slug;
    li.innerHTML = `
      <span class="fpatch" aria-hidden="true">${esc(ev.patchNo || "M?")}</span>
      <span class="fdate">${window.TakeoffData ? esc(TakeoffData.fmtDate(ev.date)) : ""}</span>
      <span class="fname">${esc(ev.title || "")}</span>
      <span class="fvenue">${esc(ev.venue?.name || "")}</span>
      ${ev.brief ? `<span class="fnote">${esc(ev.brief)}</span>` : ""}`;
    list.prepend(li);
  }

  function upgradeFlogRow(ev) {
    const row = $(`.flog li[data-slug="${cssEsc(ev.slug)}"]`);
    if (!row) return;
    const el = $(".fstatus", row);
    if (!el) return;
    el.dataset.flapStatus = "departed";
    flapTo(el, "Departed");
  }

  /* ============================================================
     Standby-Leerzustand — nur bei POSITIVER Bestätigung (upcoming.length
     === 0 laut TakeoffData) einblenden. Schlägt der Fetch fehl, bleibt
     das statische, korrekt befüllte Markup stehen statt fälschlich in
     Standby zu fallen.
     ============================================================ */
  function showEmptyState(pageData) {
    $(".board")?.setAttribute("hidden", "");
    $("#kommend .card-grid")?.setAttribute("hidden", "");
    const standby = $(".standby-state");
    if (!standby) return;
    const es = pageData?.emptyState;
    if (es) {
      const eyebrow = $(".tx-label", standby); if (eyebrow && es.eyebrow) eyebrow.textContent = es.eyebrow;
      const strong = $("strong", standby); if (strong && es.title) strong.textContent = es.title;
      const text = $(".es-text", standby); if (text && es.text) text.textContent = es.text;
      const cta = $(".btn", standby);
      if (cta) {
        if (es.ctaLabel) cta.textContent = es.ctaLabel;
        if (es.ctaHref) cta.href = es.ctaHref;
      }
    }
    standby.removeAttribute("hidden");
  }

  /* ============================================================
     Seiten-Texte hydrieren: page("events") > bindText für einfache
     Textfelder, gezieltes innerHTML nur für die zwei *Html-Felder
     (bindText selbst schreibt immer textContent, würde eingebettete
     <span class="glow"> also als Text ausgeben statt als Markup).
     ============================================================ */
  function hydrateText(pageData) {
    TakeoffData.bindText(document, pageData);
    const h1 = $(".phero h1");
    if (h1 && pageData.hero?.titleHtml) h1.innerHTML = pageData.hero.titleHtml;
    const flogH2 = $("#flightlog .h2");
    if (flogH2 && pageData.sections?.flightlogTitleHtml) flogH2.innerHTML = pageData.sections.flightlogTitleHtml;
  }
  function updateMenuCount(n) {
    const note = $('.menu-list a[href="events.html"] .m-note');
    if (note) note.textContent = `${n} geplant`;
  }

  /* ============================================================
     Teilen-Knopf — Web-Share-API mit Clipboard-Fallback.
     Markup liefert data-share-text/-url bereits statisch (aus
     eventExtras.shareText + Detailseite bzw. #slug-Anker).
     ============================================================ */
  function wireShareButtons(pageData) {
    const copiedMsg = pageData?.share?.copiedToast || "Link kopiert ✓";
    $$(".m-share[data-share-text]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const text = btn.dataset.shareText || document.title;
        const url = new URL(btn.dataset.shareUrl || location.href, location.href).href;
        if (navigator.share) {
          try { await navigator.share({ title: document.title, text, url }); return; }
          catch (err) { if (err && err.name === "AbortError") return; /* sonst: Clipboard-Fallback */ }
        }
        try {
          await navigator.clipboard.writeText(url);
          toast(copiedMsg);
        } catch {
          toast(url);   // letzter Ausweg, falls Clipboard-API fehlt/blockiert ist
        }
      });
    });
  }

  /* ============================================================
     Mission-Patch-Log — "war ich dabei"-Toggle, localStorage, ohne
     Account. Macht das bislang dekorative patchNo-Feld (M1–M6)
     nutzbar, unabhängig vom sitewide Theme-Sammel-System in main.js.
     ============================================================ */
  function wirePatchLog(pageData, knownTotal) {
    const buttons = $$(".fpin[data-slug]");
    if (!buttons.length) return;
    const cfg = pageData?.patchLog || {};
    const toastTpl = cfg.toastTemplate || "Patch gespeichert — {count}/{total} Missionen";
    const total = knownTotal ?? buttons.length;
    const resetBtn = $(".fpin-reset");

    const collected = () => new Set(readPatches());
    const paint = () => {
      const set = collected();
      buttons.forEach(btn => btn.setAttribute("aria-pressed", String(set.has(btn.dataset.slug))));
    };

    buttons.forEach(btn => {
      btn.addEventListener("click", () => {
        const set = collected();
        const slug = btn.dataset.slug;
        if (set.has(slug)) set.delete(slug); else set.add(slug);
        store.set(PATCH_KEY, JSON.stringify([...set]));
        paint();
        toast(toastTpl.replace("{count}", set.size).replace("{total}", total));
      });
    });

    resetBtn?.addEventListener("click", () => {
      store.set(PATCH_KEY, JSON.stringify([]));
      paint();
      toast("Patches zurückgesetzt");
    });

    paint();
  }

  /* ============================================================
     BPM-Tap-Tempo — reines Client-Feature, vergleicht Tap-Tempo mit
     Genre-BPM-Ranges aus events.json.
     ============================================================ */
  function wireBpmTool(pageData) {
    const pad = $(".bpm-pad");
    if (!pad) return;
    const genres = (pageData?.tapTempo?.genres?.length ? pageData.tapTempo.genres : [
      { name: "Trance", bpmMin: 130, bpmMax: 140 },
      { name: "Hard Trance", bpmMin: 140, bpmMax: 150 },
      { name: "Hard Bounce", bpmMin: 150, bpmMax: 160 },
      { name: "Techno", bpmMin: 125, bpmMax: 135 },
    ]);
    const bpmOut = $(".bpm-readout b");
    const matchOut = $(".bpm-match");
    const resetBtn = $(".bpm-reset");
    const IDLE_MS = 2200;
    let taps = [], idleT = 0;

    function matchGenre(bpm) {
      const hit = genres.find(g => bpm >= g.bpmMin && bpm <= g.bpmMax);
      if (hit) return `Du tickst wie ${hit.name} (${hit.bpmMin}–${hit.bpmMax} BPM)`;
      const mid = g => (g.bpmMin + g.bpmMax) / 2;
      const closest = genres.reduce((a, b) => (Math.abs(mid(a) - bpm) < Math.abs(mid(b) - bpm) ? a : b));
      return bpm < closest.bpmMin
        ? `Ruhiger als ${closest.name} — aber am nächsten dran`
        : `Schneller als jedes Genre hier — Atempause? 😅`;
    }
    function reset() {
      taps = [];
      if (bpmOut) bpmOut.textContent = "—";
      if (matchOut) matchOut.textContent = "";
      clearTimeout(idleT);
    }
    function tap() {
      const now = performance.now();
      taps.push(now);
      if (taps.length > 6) taps.shift();
      clearTimeout(idleT);
      idleT = setTimeout(reset, IDLE_MS);
      if (taps.length < 2) {
        if (bpmOut) bpmOut.textContent = "…";
        if (matchOut) matchOut.textContent = "";
        return;
      }
      const intervals = [];
      for (let i = 1; i < taps.length; i++) intervals.push(taps[i] - taps[i - 1]);
      const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round(60000 / avgMs);
      if (bpmOut) bpmOut.textContent = String(bpm);
      if (matchOut) matchOut.textContent = matchGenre(bpm);
    }
    pad.addEventListener("click", tap);
    resetBtn?.addEventListener("click", reset);
  }

  /* ============================================================
     Live-Uhr im Board-Header — rein dekorativ, aria-hidden, zeigt
     ehrlich die Client-Uhrzeit (kein simuliertes Backend).
     ============================================================ */
  function startClock() {
    const clock = $("[data-clock]");
    if (!clock) return;
    const fmt = d => d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    clock.textContent = fmt(new Date());
    if (!fxOn()) return;                       // Tier s: einmal gesetzt, kein Intervall
    const everyMs = fxFull() ? 1000 : 60000;    // m = 1×/Minute, l = Sekundentakt
    setInterval(() => { if (!document.hidden) clock.textContent = fmt(new Date()); }, everyMs);
  }

  /* ---------- Boot-Flap beim ersten Sichtbarwerden ---------- */
  function bootFlapOnView() {
    const els = $$(".status[data-flap], .fstatus[data-flap]");
    if (!els.length || !fxOn() || reduced() || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const live = $(".flap-face--live", el) ?? el;
      flapTo(el, live.textContent.trim(), { force: true });   // gleiche Phrase, spielt trotzdem
      io.unobserve(el);
    }), { rootMargin: "0px 0px -10% 0px" });
    els.forEach(el => io.observe(el));
  }

  /* ---------- Hover-Recheck: nur Tier l, nur Pointer fein ---------- */
  function hoverRecheck() {
    if (!fxFull() || !matchMedia("(pointer: fine)").matches) return;
    $$(".mcard[data-slug]").forEach(card => {
      const pill = $(".status", card);
      if (!pill) return;
      card.addEventListener("pointerenter", () => {
        const live = $(".flap-face--live", pill) ?? pill;
        flapTo(pill, live.textContent.trim(), { force: true });
      });
    });
  }

  /* ============================================================
     Boot
     ============================================================ */
  async function boot() {
    let pageData = null, upcoming = null, past = null;
    if (window.TakeoffData) {
      try {
        [pageData, upcoming, past] = await Promise.all([
          TakeoffData.page("events"),
          TakeoffData.upcoming(),
          TakeoffData.past(),
        ]);
      } catch (err) {
        console.warn("[events] TakeoffData nicht verfügbar — statisches Markup bleibt stehen.", err);
      }
    }

    if (pageData) hydrateText(pageData);
    const boardingWindowH = pageData?.board?.boardingWindowHours ?? DEFAULT_BOARDING_WINDOW_H;

    if (Array.isArray(upcoming)) {
      updateMenuCount(upcoming.length);
      if (upcoming.length === 0) showEmptyState(pageData);
      else upcoming.forEach(ev => {
        if (!$(`.mcard[data-slug="${cssEsc(ev.slug)}"]`)) createCard(ev);
        upgradeCard(ev, boardingWindowH);
      });
    }
    if (Array.isArray(past)) past.forEach(ev => {
      if (!$(`.flog li[data-slug="${cssEsc(ev.slug)}"]`)) createFlogRow(ev);
      upgradeFlogRow(ev);
    });

    wireShareButtons(pageData);
    wirePatchLog(pageData, Array.isArray(past) ? past.length : null);
    wireBpmTool(pageData);
    startClock();
    bootFlapOnView();
    hoverRecheck();
  }

  boot();
})();
