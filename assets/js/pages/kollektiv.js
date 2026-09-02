/* ============================================================
   kollektiv.js — Seiten-Logik fuer kollektiv.html

   1) Gateway-Hydration: Hero-Text, Ethos, Werte, Geld-Grafik, Logbuch
      (history()), Crew (team()), Stats/Orbit, Familie, FAQ, Mitmach-Rollen
      und Booking-Facts kommen aus TakeoffData (assets/js/data.js) +
      assets/data/pages/kollektiv.json. Das statische Markup ist der
      Fallback und bleibt korrekt, falls TakeoffData/fetch fehlschlaegt.
   2) Bauplan-Signaturmotiv: Odometer-Hochzaehlen (Stats), Rig-Diagramm
      (zeichnet sich in Bau-Reihenfolge: Sub -> Top -> Licht) und die
      Flightlog-Massline (zeichnet sich beim Scrollen). Reine
      IntersectionObserver/ScrollTrigger-Reveals, kein eigener rAF-Loop,
      keine Canvas-Ebene noetig.
   ============================================================ */
(function () {
  "use strict";

  const html = document.documentElement;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fxOn   = () => html.dataset.fx !== "s" && !reduced();
  const fxFull = () => html.dataset.fx === "l" && !reduced();

  const main = $("#main");
  if (!main) return;   /* laeuft nur auf kollektiv.html, Guard trotzdem */

  /* ---------- Helfer ---------- */
  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function safe(fn, ...args) {
    try { fn(...args); } catch (err) { console.warn("[kollektiv]", fn.name || "render", err); }
  }
  function initialsFrom(name) {
    return (name || "").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "??";
  }
  function daysSince(iso) {
    if (!iso) return null;
    const founded = new Date(iso + "T00:00:00");
    if (Number.isNaN(founded.getTime())) return null;
    return Math.max(0, Math.floor((Date.now() - founded.getTime()) / 86400000));
  }
  /* H1 traegt den 3-Schicht-Glow auf dem letzten Wort (.glow-Span). Ein
     einfaches textContent-Ersetzen (wie bindText) wuerde den Span killen —
     deshalb eigener Helfer statt TakeoffData.bindText fuer dieses Element. */
  function setGlowHeadline(el, text) {
    if (!el || !text) return;
    const words = text.trim().split(/\s+/);
    if (!words.length) return;
    let last = words.pop();
    /* Satzzeichen am Ende (z.B. der Punkt in "…selbst.") bleiben wie im
       statischen Original AUSSERHALB des Glow-Spans. */
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
  /* Der Ethos-Absatz #2 hebt die „…“-Phrase mit <em> hervor. Gleiches
     Prinzip wie oben: Struktur erhalten statt textContent zu ersetzen. */
  function setEmphasisText(el, text) {
    if (!el || !text) return;
    const m = text.match(/^(.*?)(„[^“]*“)(.*)$/s);
    if (!m) { el.textContent = text; return; }
    el.textContent = "";
    if (m[1]) el.append(document.createTextNode(m[1]));
    const em = document.createElement("em");
    em.style.color = "var(--ink)";
    em.textContent = m[2];
    el.append(em);
    if (m[3]) el.append(document.createTextNode(m[3]));
  }

  /* ---------- Icon-Sets (handgezeichnet, kein Icon-Framework) ----------
     Team-Icons identisch zu den bisherigen Inline-SVGs auf dieser Seite/
     team.html, damit die Crew-Karten visuell gleich bleiben. */
  const TEAM_ICONS = {
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 20s-7.2-4.6-9.2-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.2 11c-2 4.4-9.2 9-9.2 9z"/></svg>',
    cross: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 8.5v7M8.5 12h7"/></svg>',
    bolt:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M13 3 5.5 13.5H11L9.5 21 17.5 10H12z"/></svg>',
  };
  const VALUE_ICONS = {
    hand:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7.6 21h5.1c2.7 0 4.3-1.8 4.3-4.4v-5.7a1.3 1.3 0 0 0-2.6 0v3.1M14.4 11.9V6.5a1.3 1.3 0 0 0-2.6 0v5.3M11.8 11.7V5.2a1.3 1.3 0 0 0-2.6 0v7.6M9.2 12.6V8.1a1.3 1.3 0 0 0-2.6 0v6.7c0 .9-.3 1.5-1 2.1l-.7.7c-.6.6-.7 1.1-.4 1.9.4 1 1.4 1.7 2.5 1.9"/></svg>',
    scale:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v14M9 21h6M5 8h14M5 8 2.6 13h4.8L5 8ZM19 8l-2.4 5h4.8L19 8Z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3.3 19 6v5.5c0 5-3 8.4-7 9.2-4-.8-7-4.2-7-9.2V6z"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 17.5 15 9M17.5 4 20 6.5l-2.5 2.5L15 6.5zM4.5 19.5l2-2"/></svg>',
    door:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="11" height="18" rx="1"/><path d="M13.2 12h.01M3 21h18"/></svg>',
  };
  /* Stueckliste-Tags je Logbuch-Eintrag (siehe DATA.md-Bauplan §2) */
  const SPEC_TAGS = { "T0": "GRÜNDUNG", "S1": "1× SUB", "S2": "+2 TOP", "S3": "2× SUB", "L1": "DMX · 512CH", "▲": "LIVE" };

  /* ============================================================
     Render-Funktionen — jede prueft ihr Ziel-Element/ihre Daten selbst
     und laesst das statische Fallback-Markup unangetastet, wenn etwas
     fehlt (progressive enhancement, DATA.md §Dynamik-Prinzip).
     ============================================================ */
  function renderHero(page) {
    if (!page?.hero) return;
    setGlowHeadline($(".phero h1"), page.hero.h1);
  }
  function renderEthos(page) {
    if (!page?.ethos) return;
    setEmphasisText($("#ethos-emphasis"), page.ethos.text2);
  }
  function renderValues(values) {
    const grid = $("#werte-grid");
    if (!grid || !Array.isArray(values) || !values.length) return;
    grid.innerHTML = values.map(v => `
      <div class="wtile">
        <span class="ico" aria-hidden="true">${VALUE_ICONS[v.icon] || ""}</span>
        <b>${esc(v.title)}</b>
        <p>${esc(v.text)}</p>
      </div>`).join("");
  }
  function renderSpend(spend) {
    const list = $("#spend-list");
    if (!list || !spend || !Array.isArray(spend.items) || !spend.items.length) return;
    list.innerHTML = spend.items.map(item => {
      const pct = Math.max(0, Math.min(100, Number(item.percent) || 0));
      return `<div class="bp-spend-row">
        <span class="bp-spend-label">${esc(item.label)}</span>
        <span class="bp-spend-track"><span class="bp-spend-fill" style="--pct: ${pct}%"></span></span>
        <span class="bp-spend-pct">${pct}%</span>
      </div>`;
    }).join("");
    const note = $("#spend-note");
    if (note && spend.note) note.textContent = spend.note;
  }
  function renderHistory(history) {
    const list = $("#flog-list");
    if (!list || !Array.isArray(history) || !history.length) return;
    const lastIdx = history.length - 1;
    list.innerHTML = history.map((entry, i) => {
      const dim = SPEC_TAGS[entry.patch] || "";
      let note = esc(entry.note || "");
      if (i === lastIdx) {
        note += ` Weiter geht's im <a href="events.html#flightlog" style="color:var(--acc-3-tint)">Flight Log</a>.`;
      }
      return `<li><span class="fpatch" aria-hidden="true">${esc(entry.patch)}</span>` +
        `<span class="fdate">${esc(entry.date)}</span>` +
        `<span class="fname">${esc(entry.name)}</span>` +
        `<span class="fvenue">${esc(entry.venue)}</span>` +
        (dim ? `<span class="bp-dim" aria-hidden="true">${esc(dim)}</span>` : "") +
        `<span class="fnote">${note}</span></li>`;
    }).join("");
  }
  function renderCrew(team) {
    const grid = $("#crew-grid");
    if (!grid || !Array.isArray(team) || !team.length) return;
    grid.innerHTML = team.map(member => {
      const avatar = member.icon && TEAM_ICONS[member.icon]
        ? TEAM_ICONS[member.icon]
        : esc(member.initials || initialsFrom(member.name));
      return `<div class="ccard"><div class="avatar">${avatar}</div><b>${esc(member.name)}</b><span>${esc(member.role || "")}</span></div>`;
    }).join("");
  }
  function renderStats(page, pastCount) {
    const cells = $$(".stats > div");
    if (!cells.length) return;
    const cfg = page?.stats || {};
    const foundedYear = page?.foundedDate ? page.foundedDate.slice(0, 4) : null;
    const vals = [
      foundedYear ? { v: foundedYear, l: cfg.founded?.label } : null,
      Number.isFinite(pastCount) ? { v: String(pastCount).padStart(2, "0"), l: cfg.missions?.label } : null,
      cfg.systemsBuilt ? { v: cfg.systemsBuilt.value, l: cfg.systemsBuilt.label } : null,
      cfg.volunteerPercent ? { v: cfg.volunteerPercent.value, l: cfg.volunteerPercent.label } : null,
    ];
    cells.forEach((cell, i) => {
      const data = vals[i];
      if (!data) return;
      const b = cell.querySelector("b"), s = cell.querySelector("span");
      if (b && data.v != null && data.v !== "") b.textContent = data.v;
      if (s && data.l) s.textContent = data.l;
    });
  }
  function renderOrbit(page) {
    const el = $("#orbit-days");
    const days = daysSince(page?.foundedDate);
    if (el && days != null) el.textContent = String(days);
  }
  function renderFamily(family) {
    const grid = $("#family-grid");
    if (!grid || !Array.isArray(family) || !family.length) return;
    grid.innerHTML = family.map(f => {
      const inner = `<b>${esc(f.name)}</b>${f.note ? `<span>${esc(f.note)}</span>` : ""}`;
      return f.url
        ? `<li class="bp-fam-card"><a href="${esc(f.url)}" target="_blank" rel="noopener">${inner}</a></li>`
        : `<li class="bp-fam-card"><div class="bp-fam-inner">${inner}</div></li>`;
    }).join("");
  }
  function renderFaq(faq) {
    const list = $("#faq-list");
    if (!list || !Array.isArray(faq) || !faq.length) return;
    list.innerHTML = faq.map(item => `<div class="m-row"><dt>${esc(item.q)}</dt><dd>${esc(item.a)}</dd></div>`).join("");
  }
  function renderJoinRoles(roles) {
    const wrap = $("#join-roles");
    if (!wrap || !Array.isArray(roles) || !roles.length) return;
    wrap.innerHTML = roles.map(r => {
      const subject = encodeURIComponent(r.mailSubject || `Mitmachen – ${r.label}`);
      return `<a class="chip" role="listitem" href="mailto:info@takeoff-potsdam.de?subject=${subject}">${esc(r.label)}</a>`;
    }).join("");
  }
  function renderBookingFacts(facts) {
    const wrap = $("#booking-facts");
    if (!wrap || !Array.isArray(facts) || !facts.length) return;
    wrap.innerHTML = facts.map(f => `<span><b>${esc(f.label)}</b> · ${esc(f.value)}</span>`).join("");
  }

  /* ============================================================
     Gateway-Hydration
     ============================================================ */
  async function hydrate() {
    const TD = window.TakeoffData;
    if (!TD) return;
    const [page, team, history, past] = await Promise.all([
      TD.page("kollektiv"), TD.team(), TD.history(), TD.past(),
    ]);

    if (page) TD.bindText(main, page);   /* eyebrow/intro/ethos.text1 — einfache [data-bind]-Felder */
    safe(renderHero, page);
    safe(renderEthos, page);
    safe(renderValues, page?.values);
    safe(renderSpend, page?.spendChart);
    safe(renderHistory, history);
    safe(renderCrew, team);
    safe(renderStats, page, Array.isArray(past) ? past.length : null);
    safe(renderOrbit, page);
    safe(renderFamily, page?.family);
    safe(renderFaq, page?.faq);
    safe(renderJoinRoles, page?.joinRoles);
    safe(renderBookingFacts, page?.bookingFacts);
  }

  /* ============================================================
     Signaturmotiv: Odometer, Rig-Diagramm, Flightlog-Massline
     ============================================================ */
  function animateStat(el) {
    const raw = el.textContent.trim();
    const m = raw.match(/^(\d+)(.*)$/);
    if (!m || !window.gsap) return;
    const digits = m[1].length, target = parseInt(m[1], 10), suffix = m[2];
    const proxy = { v: 0 };
    gsap.to(proxy, {
      v: target, duration: 1.1, ease: "power2.out",
      onUpdate: () => { el.textContent = String(Math.round(proxy.v)).padStart(digits, "0") + suffix; },
    });
  }
  function setupOdometer() {
    const odo = $(".bp-odometer");
    if (!odo || !fxOn() || !window.gsap) return;
    const statObserver = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      statObserver.unobserve(e.target);
      if (!fxOn()) return;   /* Tier evtl. seit dem Observe-Aufruf runtergestuft */
      $$("b", e.target).forEach((el, i) => gsap.delayedCall(i * .09, () => animateStat(el)));
    }), { threshold: .4 });
    statObserver.observe(odo);
  }

  function setupRig() {
    const rig = $(".bp-rig");
    if (!rig || !fxOn() || !window.gsap) return;
    const rigObserver = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      rigObserver.unobserve(e.target);
      if (!fxOn()) return;   /* Tier evtl. seit dem Observe-Aufruf runtergestuft */
      gsap.set(rig.querySelectorAll(".bp-p"), { strokeDashoffset: 1 });
      gsap.set(rig.querySelectorAll(".bp-p-label"), { opacity: 0 });
      gsap.timeline({ defaults: { ease: "power2.inOut", duration: .8 } })
        .to(rig.querySelectorAll(".bp-p-sub"), { strokeDashoffset: 0, stagger: .12 })
        .to(rig.querySelectorAll(".bp-p-top"), { strokeDashoffset: 0, stagger: .12 }, "-=.45")
        .to(rig.querySelectorAll(".bp-p-truss, .bp-p-lead"), { strokeDashoffset: 0, stagger: .06 }, "-=.3")
        .to(rig.querySelectorAll(".bp-p-label"), { opacity: 1, duration: .5 }, "-=.2");
    }), { threshold: .35 });
    rigObserver.observe(rig);
  }

  /* Nach dem Abbau eines skrubbenden CSS-Var-Tweens (gsap.context().revert())
     bleibt die vom Tween zuletzt interpolierte Transform auf dem
     Pseudo-Element manchmal haengen — reproduzierbar in Chromium: die
     Custom Property ist nachweisbar entfernt (style.cssText === ""), die
     berechnete transform() bleibt trotzdem auf dem letzten Zwischenwert
     stehen (offenbar ein Compositor-Layer-Caching-Effekt der Scrub-Animation,
     kein Fehler in der var()-Fallback-Kaskade selbst — ein frischer,
     unbeteiligter Testknoten mit derselben Regel loest korrekt auf). Ein
     harter Reflow (display-Toggle) erzwingt zuverlaessig die Neuberechnung.
     Nur auf .flog angewandt (kleines, unkritisches Element): ein
     display-Toggle auf #main waere riskanter (Fokusverlust fuer
     Tastaturnutzer:innen, falls gerade ein Link in <main> fokussiert ist)
     und der optische Preis eines haengenden Grid-Versatzes von wenigen
     Pixeln ist ohnehin vernachlaessigbar — dort reicht ein einfaches Zuruecksetzen. */
  function hardResetVar(el, prop, value) {
    if (!el) return;
    el.style.setProperty(prop, value);
    const prevDisplay = el.style.display;
    el.style.display = "none";
    void el.offsetHeight;
    el.style.display = prevDisplay;
  }

  /* Scrub-Effekte (Flog-Massline, Tier-L Grid-Parallax) in eigenem
     GSAP-Context, damit ein Tier-Wechsel sauber killen/neu aufbauen kann
     (gleiches Muster wie main.js' buildScrollFX). */
  let scrubCtx;
  function buildScrollFX() {
    scrubCtx?.revert();
    scrubCtx = null;
    const flog = $(".flog");

    if (!fxOn() || !window.gsap || !window.ScrollTrigger) {
      /* Tier S / kein GSAP: Massline muss vollstaendig gezeichnet UND das
         Grundraster undriftet stehen — siehe hardResetVar-Kommentar oben. */
      hardResetVar(flog, "--bp-flog-p", "1");
      main.style.setProperty("--bp-drift", "0px");
      return;
    }

    gsap.registerPlugin(ScrollTrigger);
    scrubCtx = gsap.context(() => {
      if (flog) {
        gsap.fromTo(flog, { "--bp-flog-p": 0 }, {
          "--bp-flog-p": 1, ease: "none",
          scrollTrigger: { trigger: flog, start: "top 78%", end: "bottom 65%", scrub: .6 },
        });
      }
      if (fxFull()) {
        gsap.fromTo(main, { "--bp-drift": "0px" }, {
          "--bp-drift": "-46px", ease: "none",
          scrollTrigger: { trigger: main, start: "top top", end: "bottom bottom", scrub: .8 },
        });
      } else {
        /* Tier M (oder Downgrade von L auf M): Drift-Tween wird nicht neu
           erzeugt — evtl. haengengebliebenen Versatz aus einer vorherigen
           Tier-L-Sitzung zuruecksetzen (kein hartes Reflow noetig, siehe oben). */
        main.style.setProperty("--bp-drift", "0px");
      }
    });
    ScrollTrigger.refresh();
  }

  function initMotif() {
    setupOdometer();
    setupRig();
    buildScrollFX();
    /* Tier-Wechsel (Button, reduced-motion, Watchdog-Downgrade) landen alle
       als data-fx-Attributaenderung auf <html> — main.js macht es genauso. */
    new MutationObserver(buildScrollFX).observe(html, { attributes: true, attributeFilter: ["data-fx"] });
  }

  (async () => {
    await hydrate().catch(err => console.warn("[kollektiv] Gateway-Daten nicht ladbar — Fallback-Markup bleibt stehen.", err));
    initMotif();
  })();
})();
