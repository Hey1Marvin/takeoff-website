/* ============================================================
   team.js — Seiten-Logik fuer team.html

   1) Gateway-Hydration: Hero, Kennzahlen-Leiste, Bereichs-Cluster (Flugdeck/
      Bodencrew/Bau & Gastgeber + Auffang-Gruppe), Mission-Teaser und
      Foto-Board kommen aus TakeoffData (assets/js/data.js) + team().
      db.json bleibt unangetastet — das statische Markup ist der Fallback
      und bleibt korrekt, falls TakeoffData/fetch scheitert (DATA.md
      Dynamik-Prinzip: progressive enhancement).
   2) Automatischer Namensabgleich: Crew-Mitglieder werden per Substring
      (a) ihrem Bereich (team.json departments[].match) und
      (b) einem Artist-Eintrag (TakeoffData.artists()) zugeordnet, ohne
      db.json anzufassen — DJ-Karten verlinken dann auf Bio/Sets/Flight-Log.
   3) Signaturmotiv "Orbit-Stationsplan": reines SVG/CSS, kein Canvas, kein
      eigener rAF-Loop — nur die Punktzahl je Ring wird nach der Hydration
      an die tatsaechliche Bereichs-Groesse angepasst.
   4) Sammel-Easter-Egg: alle Karten anklicken schaltet einen Toast frei,
      Fortschritt in einem eigenen localStorage-Key (kein main.js-Zugriff).
   ============================================================ */
(function () {
  "use strict";

  const html = document.documentElement;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fx = () => html.dataset.fx;

  const main = $("#main");
  if (!main) return;   /* laeuft nur auf team.html, Guard trotzdem */

  /* ---------- Helfer (Muster wie kollektiv.js) ---------- */
  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function safe(fn, ...args) {
    try { fn(...args); } catch (err) { console.warn("[team]", fn.name || "render", err); }
  }
  function initialsFrom(name) {
    /* Trennt zusaetzlich an "-"/"&" (nicht nur Leerraum) — "Awareness-Team"
       und "Deko & Bau" haben keine Leerzeichen an der Wortgrenze, mit
       reinem \s+ waere die Kurzform sonst "A" bzw. "D&" statt "AT"/"DB".
       Betrifft nur den Fallback: alle heutigen Icon-Rollen (Awareness/Sani/
       Deko & Bau/Bar & Einlass) haben ohnehin ein Icon statt Initialen im
       Karten-Avatar (siehe TEAM_ICONS) — hier wirkt es nur fuer das
       Foto-Board, das keine Icons zeigt. */
    return (name || "").trim().split(/[\s\-&]+/).filter(Boolean)
      .slice(0, 2).map(w => w[0]).join("").toUpperCase() || "??";
  }
  function slugify(name) {
    return (name || "")
      .toLowerCase()
      .replace(/[·&']/g, " ")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "") || "crew";
  }
  /* Anders als kollektiv.json (dort ist hero.h1 reiner Fliesstext, und
     kollektiv.js baut den Glow-Span ums letzte Wort programmatisch) ist
     team.json's hero.h1 laut eigenem _labels-Hinweis bewusst "HTML erlaubt"
     — der <span class="glow"> steht schon in der JSON-Zeichenkette. Ein
     algorithmisches Nachbauen wie bei kollektiv.js wuerde das doppelt
     verschachteln; ein direktes innerHTML reicht (gleiche Vertrauensstufe
     wie i18n-runtime.js' data-i18n-html: eigene, redaktionell gepflegte
     Seiten-Datei, kein Nutzer-Input). */
  function setHeroHeadline(el, html) {
    if (!el || !html) return;
    el.innerHTML = html;
  }

  /* ---------- Icon-Set (identisch zu kollektiv.js/bisherigem team.html) ----------
     "star" ergaenzt den Satz — der team-Contract (assets/data/contracts/
     team.json) kennt das Symbol bereits als Option, bisher nutzt es nur
     kein Eintrag in db.json. */
  const TEAM_ICONS = {
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 20s-7.2-4.6-9.2-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.2 11c-2 4.4-9.2 9-9.2 9z"/></svg>',
    cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 8.5v7M8.5 12h7"/></svg>',
    bolt:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M13 3 5.5 13.5H11L9.5 21 17.5 10H12z"/></svg>',
    star:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8z"/></svg>',
  };

  /* Ringradien des Orbit-Stationsplans — muessen mit den <circle r="…">-
     Werten im HTML uebereinstimmen (siehe team.html .kt-orbit-svg). Eine
     Konstante an einer Stelle statt Magic Numbers doppelt zu pflegen. */
  const RING_R = { flugdeck: 58, boden: 94, bau: 130 };

  /* ============================================================
     Namensabgleich — Substring, ohne db.json anzufassen
     ============================================================ */
  function memberDeptId(member, departments) {
    const name = (member.name || "").toLowerCase();
    for (const dept of departments) {
      const tokens = Array.isArray(dept.match) ? dept.match : [];
      if (tokens.some(tok => String(tok).trim() && name.includes(String(tok).toLowerCase()))) return dept.id;
    }
    return null;
  }
  function findArtist(member, artists) {
    const name = (member.name || "").toLowerCase();
    return (artists || []).find(a => a.name && a.name.length > 2 && name.includes(a.name.toLowerCase())) || null;
  }
  function matchedLineupNames(lineup, team) {
    const found = new Set();
    (lineup || []).forEach(act => {
      const actName = (act && act.name || "").trim().toLowerCase();
      if (!actName) return;
      team.forEach(m => { if ((m.name || "").toLowerCase().includes(actName)) found.add(m.name); });
    });
    return [...found];
  }

  /* ============================================================
     Karten-Markup — <a> wenn es ein echtes Ziel gibt (Artist-Seite oder
     Awareness/Sani-Deep-Link), sonst <button> — beides echte, fokussierbare
     Bedienelemente (Konvention wie .setcard in style.css), damit Tastatur-
     Nutzer:innen dieselben Karten erreichen wie Maus/Touch.
     ============================================================ */
  function renderCard(member, artists, page) {
    const id = slugify(member.name);
    const avatar = member.icon && TEAM_ICONS[member.icon]
      ? TEAM_ICONS[member.icon]
      : esc(member.initials || initialsFrom(member.name));
    const roleLink = page && page.roleLinks ? page.roleLinks[member.name] : null;
    const artist = findArtist(member, artists);
    const href = (roleLink && roleLink.href) || (artist && artist.page) || null;
    const linkText = (roleLink && roleLink.linkText)
      || (artist && artist.page && page && page.artistLink && page.artistLink.linkText)
      || null;
    const sinceYear = artist && artist.since;
    const sinceLabel = (page && page.artistLink && page.artistLink.sinceLabel) || "seit";

    const bits = [
      `<span class="avatar">${avatar}</span>`,
      `<b>${esc(member.name)}</b>`,
      `<span>${esc(member.role || "")}</span>`,
      sinceYear ? `<span class="kt-since">${esc(sinceLabel)} ${esc(sinceYear)}</span>` : "",
      linkText ? `<span class="kt-cardlink">${esc(linkText)}</span>` : "",
    ].join("");

    return href
      ? `<a class="ccard" href="${esc(href)}" data-kt-id="${id}">${bits}</a>`
      : `<button type="button" class="ccard" data-kt-id="${id}">${bits}</button>`;
  }

  /* ============================================================
     Render-Funktionen — pruefen ihr Ziel/ihre Daten selbst, lassen das
     statische Fallback-Markup unangetastet, wenn etwas fehlt.
     ============================================================ */
  function renderStats(page, team, pastEvents) {
    const cells = $$("#team-stats > div");
    if (!cells.length) return;
    const items = Array.isArray(page && page.stats) ? page.stats : [];
    const auto = {
      crewSize: Array.isArray(team) ? String(team.length).padStart(2, "0") : null,
      missions: Array.isArray(pastEvents) ? String(pastEvents.length).padStart(2, "0") : null,
    };
    cells.forEach((cell, i) => {
      const def = items[i];
      if (!def) return;
      const val = def.mode === "auto" ? auto[def.key] : def.value;
      const b = $("b", cell), s = $("span", cell);
      if (b && val != null && val !== "") b.textContent = val;
      if (s && def.label) s.textContent = def.label;
    });
  }

  function fillGrid(wrap, members, artists, page) {
    const grid = $(".kt-grid", wrap);
    if (!grid || !members.length) return;
    grid.innerHTML = members.map(m => renderCard(m, artists, page)).join("");
  }

  function renderDepartments(team, artists, page) {
    const departments = Array.isArray(page && page.departments) ? page.departments : [];
    /* Ohne Bereichsregeln keine sinnvolle Gruppierung moeglich — statisches
       Fallback-Markup bleibt komplett unangetastet stehen, statt alle acht
       Rollen fehlerhaft in die Auffang-Gruppe zu kippen. */
    if (!departments.length || !Array.isArray(team) || !team.length) return;

    const buckets = new Map(departments.map(d => [d.id, []]));
    const rest = [];
    team.forEach(member => {
      const id = memberDeptId(member, departments);
      if (id && buckets.has(id)) buckets.get(id).push(member);
      else rest.push(member);
    });

    departments.forEach(dept => {
      const wrap = $(`.kt-dept[data-dept="${dept.id}"]`);
      if (!wrap) return;
      const titleEl = $(".kt-dept-title", wrap);
      if (titleEl && dept.title) titleEl.textContent = dept.title;
      const subEl = $(".kt-dept-sub", wrap);
      if (subEl && dept.subtitle) subEl.textContent = dept.subtitle;
      const introEl = $(".kt-dept-intro", wrap);
      if (introEl && dept.intro) introEl.textContent = dept.intro;
      fillGrid(wrap, buckets.get(dept.id) || [], artists, page);
    });

    const fbWrap = $('.kt-dept[data-dept="fallback"]');
    if (fbWrap) {
      if (rest.length) {
        const titleEl = $(".kt-dept-title", fbWrap);
        if (titleEl && page.departmentFallbackTitle) titleEl.textContent = page.departmentFallbackTitle;
        fillGrid(fbWrap, rest, artists, page);
        fbWrap.hidden = false;
      } else {
        fbWrap.hidden = true;
      }
    }

    safe(updateOrbitDots, departments, buckets);
  }

  /* Orbit-Ringe: Punktzahl je Ring nach der tatsaechlichen Bereichsgroesse —
     macht das Signaturmotiv "grundlegend" statt Deko-Sticker (DATA.md). */
  function updateOrbitDots(departments, buckets) {
    departments.forEach(dept => {
      const g = $(`.kt-orbit-dots[data-dept="${dept.id}"]`);
      const r = RING_R[dept.id];
      if (!g || !r) return;
      const n = (buckets.get(dept.id) || []).length;
      if (!n) { g.innerHTML = ""; return; }
      let out = "";
      for (let i = 0; i < n; i++) {
        const angle = ((360 / n) * i - 90) * Math.PI / 180;   /* ab 12 Uhr, im Uhrzeigersinn */
        const x = (r * Math.cos(angle)).toFixed(1);
        const y = (r * Math.sin(angle)).toFixed(1);
        out += `<circle cx="${x}" cy="${y}" r="2.6"/>`;
      }
      g.innerHTML = out;
    });
  }

  function renderMission(page, team, nextEvent) {
    const el = $("#kt-mission-text");
    if (!el) return;
    const cfg = (page && page.nextMission) || {};
    const lineup = nextEvent && nextEvent.lineup;
    const matches = (nextEvent && Array.isArray(lineup) && Array.isArray(team))
      ? matchedLineupNames(lineup, team) : [];
    if (nextEvent && matches.length && cfg.introTemplate) {
      const TD = window.TakeoffData;
      const dateStr = TD && nextEvent.date ? TD.fmtDate(nextEvent.date) : (nextEvent.date || "");
      el.textContent = cfg.introTemplate
        .replace("{date}", dateStr)
        .replace("{lineup}", matches.join(", "));
    } else if (cfg.fallbackText) {
      el.textContent = cfg.fallbackText;
    }
  }

  function renderGallery(team, page) {
    const grid = $("#kt-gallery");
    if (!grid || !Array.isArray(team) || !team.length) return;
    const note = (page && page.photoboard && page.photoboard.slotNote) || "Foto folgt nach Freigabe";
    grid.innerHTML = team.map(m => {
      const tag = esc(m.initials || initialsFrom(m.name));
      return `<div class="gph"><span class="kt-slot-tag" aria-hidden="true">${tag}</span>${esc(note)}</div>`;
    }).join("");
  }

  /* ============================================================
     Gateway-Hydration
     ============================================================ */
  let easterCfg = null;
  async function hydrate() {
    const TD = window.TakeoffData;
    if (!TD) return;
    const [page, team, artists, pastEvents, nextEvent] = await Promise.all([
      TD.page("team"), TD.team(), TD.artists(), TD.past(), TD.nextEvent(),
    ]);
    easterCfg = (page && page.easterEgg) || null;

    if (page) TD.bindText(main, page);   /* hero.eyebrow / hero.intro — [data-bind] */
    safe(setHeroHeadline, $(".phero h1"), page && page.hero && page.hero.h1);
    safe(renderStats, page, team, pastEvents);
    safe(renderDepartments, team, artists, page);
    safe(renderMission, page, team, nextEvent);
    safe(renderGallery, team, page);
  }

  /* ============================================================
     Sammel-Easter-Egg "Ganze Crew entdeckt"
     Eigener localStorage-Key (kein Zugriff auf main.js' "takeoff-eggs" —
     getrenntes System, keine Kopplung an dessen Annahmen). Fortschritt als
     einfacher String wie bei takeoff-fx/takeoff-theme, kein main.js-Zugriff.
     Bleibt bewusst nebensaechlich: kein Toast waehrend gesammelt wird, nur
     beim vervollstaendigenden Klick — und danach bei jedem weiteren Klick
     eine kurze Bestaetigung.
     ============================================================ */
  const CROWD_KEY = "takeoff-team-crew";
  function readFound() {
    try { return new Set(String(localStorage.getItem(CROWD_KEY) || "").split(",").filter(Boolean)); }
    catch { return new Set(); }
  }
  function writeFound(set) {
    try { localStorage.setItem(CROWD_KEY, [...set].join(",")); } catch { /* egal */ }
  }
  function showToast(msg) {
    const t = $("#kt-toast");
    if (!t || !msg) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._ktToastT);
    t._ktToastT = setTimeout(() => t.classList.remove("show"), 2800);
  }
  function pulseTouch(card) {
    if (fx() === "s" || reduced()) return;
    card.classList.add("kt-touched");
    clearTimeout(card._ktTouchT);
    card._ktTouchT = setTimeout(() => card.classList.remove("kt-touched"), 650);
  }
  function handleDiscovery(card) {
    const id = card.dataset.ktId;
    if (!id) return;
    const allIds = new Set($$(".ccard").map(c => c.dataset.ktId).filter(Boolean));
    if (!allIds.size) return;
    const found = readFound();
    const wasComplete = [...allIds].every(tid => found.has(tid));
    found.add(id);
    writeFound(found);
    const isComplete = [...allIds].every(tid => found.has(tid));
    const cfg = easterCfg || {};
    if (isComplete && !wasComplete) showToast(cfg.toastText || "Du kennst jetzt die ganze Crew ✦");
    else if (wasComplete) showToast(cfg.alreadyText || "Schon entdeckt ✦");
  }
  function wireEasterEgg() {
    const root = $("#kt-departments");
    if (!root) return;
    root.addEventListener("click", e => {
      const card = e.target.closest(".ccard");
      if (!card) return;
      pulseTouch(card);
      safe(handleDiscovery, card);
    });
  }

  wireEasterEgg();   /* deckt statisches Fallback-Markup UND spaeter ersetzte Karten ab (Delegation) */
  hydrate().catch(err => console.warn("[team] Gateway-Daten nicht ladbar — Fallback-Markup bleibt stehen.", err));
})();
