/* ============================================================
   awareness.js — Seiten-Logik für awareness.html

   1) Gateway-Hydration: Hero, Team-Kacheln, "So erkennst du uns",
      Grundsätze + Eskalation, Notfallnummern, Substanzen, Spiking,
      Hausregeln, FAQ, "Sicher hin & zurück" (TakeoffData.nextEvent())
      kommen aus TakeoffData (assets/js/data.js) + assets/data/pages/
      awareness.json. Das statische Markup ist der Fallback und bleibt
      korrekt, falls TakeoffData/fetch fehlschlägt (DATA.md §Dynamik-
      Prinzip).
   2) Signatur-Motiv "Leuchtfeuer": #aw-sky atmet rein über CSS
      (@keyframes aw-breathe, siehe awareness.css) — hier nur zwei
      ereignisgetriebene Mechanismen: Wegpunkte (IntersectionObserver)
      und Pointer-Glow auf den Team-Kacheln. Kein eigener rAF-Loop:
      der Faden-Lichtpunkt liest --scrollp (main.js) direkt per CSS
      transform (siehe .aw-thread-escort in awareness.css).
   3) Teilen-Knopf: 1:1 das wireShareButtons()-Muster aus events.js
      (Web-Share-API mit Clipboard-Fallback).
   ============================================================ */
(() => {
  "use strict";
  const html = document.documentElement;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fx      = () => html.dataset.fx;

  const main = $(".aw-main");
  if (!main) return;   /* laeuft nur auf awareness.html, Guard trotzdem */

  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function safe(fn, ...args) {
    try { fn(...args); } catch (err) { console.warn("[awareness]", fn.name || "render", err); }
  }

  /* ---------- Icon-Set (handgezeichnet, identisch zu den bisherigen
     Inline-SVGs im statischen Markup — damit dynamisches Rendern und
     Fallback pixelgleich bleiben) ---------- */
  const TILE_ICONS = {
    team:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 20s-7.2-4.6-9.2-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.2 11c-2 4.4-9.2 9-9.2 9z"/></svg>',
    sani:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 8.5v7M8.5 12h7"/></svg>',
    water:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3.5c3.6 4.4 5.5 7.2 5.5 10a5.5 5.5 0 0 1-11 0c0-2.8 1.9-5.6 5.5-10z"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8.8 6h5.4l1.6 2H20v9.4M6 8H4v10h11.5"/><circle cx="12" cy="13" r="2.7"/><path d="M3.5 3.5l17 17"/></svg>',
  };

  /* ============================================================
     Render-Funktionen — jede prueft ihr Ziel-Element/ihre Daten
     selbst und laesst das statische Fallback-Markup unangetastet,
     wenn etwas fehlt (progressive enhancement).
     ============================================================ */
  function renderTeamTiles(tiles) {
    const grid = $("#aw-team-grid");
    if (!grid || !Array.isArray(tiles) || !tiles.length) return;
    grid.innerHTML = tiles.map(t => `
      <div class="atile"><span class="ico" aria-hidden="true">${TILE_ICONS[t.icon] || ""}</span><b>${esc(t.title)}</b>${esc(t.text)}</div>
    `).join("");
  }

  function renderReasons(ar) {
    const list = $("#aw-reasons-list");
    if (!list || !ar || !Array.isArray(ar.items) || !ar.items.length) return;
    list.innerHTML = ar.items.map(i => `<li>${esc(i)}</li>`).join("");
  }

  function renderPrinciples(list) {
    const grid = $("#aw-principles-grid");
    if (!grid || !Array.isArray(list) || !list.length) return;
    grid.innerHTML = list.map((p, i) => `
      <div class="aw-principle">
        <span class="aw-num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
        <b>${esc(p.title)}</b>
        <p>${esc(p.text)}</p>
      </div>`).join("");
  }

  function renderEmergencyNumbers(list) {
    const grid = $("#aw-tel-grid");
    if (!grid || !Array.isArray(list) || !list.length) return;
    grid.innerHTML = list.map(n => `
      <a class="aw-tel" href="tel:${esc(n.number)}">
        <span class="aw-tel-label">${esc(n.label)}</span>
        <span class="aw-tel-num">${esc(n.number)}</span>
        ${n.note ? `<span class="aw-tel-note">${esc(n.note)}</span>` : ""}
      </a>`).join("");
  }

  /* "Danach"-Mail: Adresse + Betreff kommen aus reportChannels.afterEvent,
     bindText() allein reicht hier nicht (der Betreff steckt im href, nicht
     im sichtbaren Text). */
  function renderReportChannels(rc) {
    const mail = $("#aw-after-mail");
    if (!mail || !rc?.afterEvent?.email) return;
    const { email, subject } = rc.afterEvent;
    mail.href = "mailto:" + email + (subject ? "?subject=" + encodeURIComponent(subject) : "");
    mail.textContent = email;
  }

  function renderSubstances(sub) {
    if (!sub) return;
    const tol = $("#aw-substances-tolerance"); if (tol && sub.toleranceText) tol.textContent = sub.toleranceText;
    const health = $("#aw-substances-health"); if (health && sub.healthText) health.textContent = sub.healthText;
    const links = $("#aw-substances-links");
    if (links && Array.isArray(sub.links) && sub.links.length) {
      links.innerHTML = sub.links.map(l => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("");
    }
    const disc = $("#aw-substances-disclaimer"); if (disc && sub.disclaimer) disc.textContent = sub.disclaimer;
  }

  function renderSpiking(spk) {
    if (!spk) return;
    const title = $("#aw-spiking-title"); if (title && spk.title) title.textContent = spk.title;
    const signs = $("#aw-spiking-signs");
    if (signs && Array.isArray(spk.signs) && spk.signs.length) {
      signs.innerHTML = spk.signs.map(s => `<li>${esc(s)}</li>`).join("");
    }
    const action = $("#aw-spiking-action"); if (action && spk.action) action.textContent = spk.action;
  }

  function renderHouseRules(hr) {
    if (!hr) return;
    const chips = $("#aw-rules-chips");
    if (chips && Array.isArray(hr.rules) && hr.rules.length) {
      chips.innerHTML = hr.rules.map(r => `<span class="chip${r.hot ? " hot" : ""}">${esc(r.text)}</span>`).join("");
    }
  }

  function renderHomeTips(tips) {
    const list = $("#aw-hometips-list");
    if (!list || !Array.isArray(tips) || !tips.length) return;
    list.innerHTML = tips.map(t => `<li>${esc(t)}</li>`).join("");
  }

  /* "Sicher hin & zurück": Venue/Transit/Extras der naechsten Mission.
     Erste echte Gateway-Nutzung dieser Seite ueber nextEvent(). Muster
     wie event-marsmission.html: Google/Apple/OSM oeffnen extern, kein
     eingebetteter Tracker. */
  function renderNextEventVenue(ev) {
    const wrap = $("#aw-home-venue");
    if (!wrap || !ev || !ev.venue) return;
    const v = ev.venue;
    const q = v.mapsQuery || v.address || v.name || "";
    const nameEl = $(".vname", wrap); if (nameEl && v.name) nameEl.textContent = v.name;
    const addrEl = $(".vaddr", wrap); if (addrEl) addrEl.textContent = v.address || "";
    const hintEl = $(".vhint", wrap); if (hintEl) hintEl.textContent = v.transit || "";

    const chips = $("#aw-home-extras");
    if (chips) {
      if (Array.isArray(ev.extras) && ev.extras.length) {
        chips.innerHTML = ev.extras.map(e => `<span class="chip">${esc(e)}</span>`).join("");
        chips.hidden = false;
      } else {
        chips.hidden = true;
      }
    }

    if (q) {
      const gm = $(".aw-map-google", wrap); if (gm) gm.href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(q);
      const am = $(".aw-map-apple", wrap);  if (am) am.href = "https://maps.apple.com/?daddr=" + encodeURIComponent(q);
      const om = $(".aw-map-osm", wrap);    if (om) om.href = "https://www.openstreetmap.org/search?query=" + encodeURIComponent(q);
    }

    const missionLink = $("#aw-home-mission-link");
    if (missionLink && ev.title) {
      missionLink.textContent = ev.title + (ev.date ? ` · ${TakeoffData.fmtDate(ev.date)}` : "") + " →";
      if (ev.page) missionLink.href = ev.page;
    }
  }

  function renderFaq(faq) {
    const list = $("#aw-faq-list");
    if (!list || !Array.isArray(faq) || !faq.length) return;
    list.innerHTML = faq.map(item => `
      <details class="faq">
        <summary>${esc(item.q)}</summary>
        <div class="faq-body">${esc(item.a)}</div>
      </details>`).join("");
  }

  function renderMeta(meta) {
    if (!meta) return;
    const note = $("#aw-meta-note");
    if (note) {
      const parts = [];
      if (meta.lastReviewed) parts.push(`Stand: ${TakeoffData.fmtDate(meta.lastReviewed)}`);
      if (meta.statusNote) parts.push(meta.statusNote);
      if (parts.length) note.textContent = parts.join(" · ");
    }
  }

  /* ============================================================
     Teilen-Knopf — Web-Share-API mit Clipboard-Fallback (1:1 das
     Muster aus events.js).
     ============================================================ */
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
     Gateway-Hydration
     ============================================================ */
  async function hydrate() {
    const TD = window.TakeoffData;
    if (!TD) return null;
    const [page, nextEvent] = await Promise.all([
      TD.page("awareness"),
      TD.nextEvent().catch(() => null),
    ]);

    if (page) TD.bindText(document, page);   /* hero.*, recognition.*, approachReasons.*, consequences.text, reportChannels.*, gettingHome.intro, houseRules.*, transmission.*, share.label — einfache [data-bind]-Felder */

    safe(renderTeamTiles, page?.teamTiles);
    safe(renderReasons, page?.approachReasons);
    safe(renderPrinciples, page?.principles);
    safe(renderEmergencyNumbers, page?.emergencyNumbers);
    safe(renderReportChannels, page?.reportChannels);
    safe(renderSubstances, page?.substances);
    safe(renderSpiking, page?.spiking);
    safe(renderHouseRules, page?.houseRules);
    safe(renderHomeTips, page?.gettingHome?.tips);
    if (page?.gettingHome?.useNextEventVenue !== false) safe(renderNextEventVenue, nextEvent);
    safe(renderFaq, page?.faq);
    safe(renderMeta, page?.meta);
    safe(wireShareButtons, page);

    return page;
  }

  /* ============================================================
     Signatur-Motiv "Leuchtfeuer": Wegpunkte + Pointer-Glow.
     Der Himmel selbst atmet rein per CSS (@keyframes aw-breathe).
     ============================================================ */
  function initMotif() {
    const nodes = [...document.querySelectorAll("[data-aw-node]")];
    const quiet = $(".aw-quiet");

    /* --- Wegpunkte: bei Tier s (oder ohne IntersectionObserver-Support)
       ist der CSS-Grundzustand ohnehin schon "erreicht" — hier also nur
       bei m/l ueberhaupt einen Observer aufsetzen, sonst sofort .is-lit
       setzen (identisches Muster wie main.js es fuer .reveal vormacht). */
    if (nodes.length) {
      if (fx() === "s" || reduced() || !("IntersectionObserver" in window)) {
        nodes.forEach(n => n.classList.add("is-lit"));
        if (quiet) html.classList.add("aw-quiet-active");   // statisch immer an bei s
      } else {
        const io = new IntersectionObserver(entries => {
          entries.forEach(e => {
            if (e.isIntersecting) e.target.classList.add("is-lit");
            if (e.target === quiet) html.classList.toggle("aw-quiet-active", e.isIntersecting);
          });
        }, { threshold: 0.35, rootMargin: "0px 0px -10% 0px" });
        nodes.forEach(n => io.observe(n));
      }
    }

    /* --- Pointer-Glow auf den Team-Kacheln: nur binden, wenn es einen
       sichtbaren Effekt gibt (m/l) — bei s ist die Transition ohnehin
       auf .15s gekappt und der Hover-Zustand traegt keine Information,
       die im Text fehlt. Nach jedem Re-Render (renderTeamTiles) erneut
       aufrufen, damit neu eingefuegte Kacheln denselben Effekt tragen. */
    if (fx() !== "s" && !reduced()) {
      $$(".aware .atile").forEach(el => {
        if (el.dataset.awGlowBound) return;
        el.dataset.awGlowBound = "1";
        el.addEventListener("pointermove", e => {
          const r = el.getBoundingClientRect();
          el.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
          el.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
        });
      });
    }
  }

  /* hydrate() rendert (u.a. renderTeamTiles) VOR seinem Promise-Abschluss —
     initMotif() nach dem await zaehlt die Kacheln also bereits korrekt neu
     ab, ein zweiter Aufruf ist nicht noetig. */
  (async () => {
    await hydrate().catch(err => {
      console.warn("[awareness] TakeoffData nicht verfügbar — statisches Markup bleibt stehen.", err);
      return null;
    });
    initMotif();
  })();
})();
