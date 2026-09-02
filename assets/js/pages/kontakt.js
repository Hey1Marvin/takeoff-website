/* ============================================================
   kontakt.js — Seiten-Logik fuer kontakt.html

   1) Gateway-Hydration: Hero-Text, Bodenstations-Statuszeile, Funkkanaele
      (Radar + Liste), Anliegen-Wegweiser, Kanal-Vergleich und FAQ kommen
      aus TakeoffData (assets/js/data.js) + assets/data/pages/kontakt.json.
      Das statische Markup ist der Fallback und bleibt korrekt, falls
      TakeoffData/fetch fehlschlaegt — Render-Funktionen fassen die Liste
      nur an, wenn wirklich Daten da sind (progressive enhancement,
      DATA.md-Dynamik-Prinzip, gleiches Vorgehen wie kollektiv.js).
   2) Bodenstations-Signaturmotiv: Dach-Antenne (Scan statt Spin), Radar-
      Dial mit Blips, Sende-Puls (Ping-Ringe) beim Kontaktieren, Bodenuhr.
      Radar-Blips werden IMMER aus den (statischen oder gerenderten)
      .fs-ch-row-Zeilen abgeleitet — ein Datenpfad statt einer zweiten,
      separat gepflegten Fallback-Liste.
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
  if (!main) return;                     // laeuft nur auf kontakt.html, Guard trotzdem

  const ground = $(".fs-ground");
  const radar  = $(".fs-radar");

  /* ---------- Helfer ---------- */
  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function safe(fn, ...args) {
    try { fn(...args); } catch (err) { console.warn("[kontakt]", fn.name || "render", err); }
  }
  /* H1 traegt den 3-Schicht-Glow auf dem letzten Wort (.glow-Span). Ein
     einfaches textContent-Ersetzen (wie bindText) wuerde den Span killen —
     deshalb eigener Helfer statt TakeoffData.bindText fuer dieses Element
     (identisches Vorgehen wie kollektiv.js). */
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
     diesem Skript) uebersetzt [data-i18n]-Elemente inkl. Hero-Eyebrow/-Intro/
     -H1 nach Englisch. Diese Datei kennt nur die deutschen Werte aus
     kontakt.json — ohne Sprachpruefung wuerde hydrate() die englische
     Uebersetzung beim Laden sofort wieder ueberschreiben. Der Rest der
     Hydration (Funkkanaele, Wegweiser, Vergleich, FAQ, Statuszeile) hat
     keine Entsprechung im Woerterbuch und bleibt unabhaengig davon deutsch —
     wie heute schon, kein Regressionsrisiko. */
  const isGerman = () => !html.lang || html.lang === "de";

  /* ---------- Laufzeit-Zustand ---------- */
  let EMAIL = "info@takeoff-potsdam.de";
  let SEND_TOAST = "Signal unterwegs …";
  let TELEGRAM_TOAST = "Kanal wird geöffnet …";
  let COPY_TOAST = "Adresse kopiert ✓";
  const topicsById = new Map();

  /* ============================================================
     Funkkanaele — Liste rendern, Blips aus den Zeilen ableiten
     ============================================================ */
  const LINK_LABELS = {
    "kollektiv.html#booking": "Fact-Sheet ansehen",
    "kollektiv.html#mitmachen": "Offene Rollen ansehen",
    "awareness.html#hilfe": "Notfall & Soforthilfe",
  };
  function linkFragment(link) {
    if (!link) return "";
    if (/^mailto:/.test(link)) {
      const addr = link.replace(/^mailto:/, "").split("?")[0];
      return `<b><a href="${esc(link)}" style="color:var(--ink)">${esc(addr)}</a></b>`;
    }
    if (/t\.me\//.test(link)) {
      return `<b><a href="${esc(link)}" target="_blank" rel="noopener" style="color:var(--ink)">Telegram-Gruppe ↗</a></b>`;
    }
    const label = LINK_LABELS[link] || "Mehr dazu ansehen";
    return ` <a href="${esc(link)}" class="fs-ch-link">${esc(label)} ↗</a>`;
  }
  function channelRowHtml(c, i) {
    const ch = String(i + 1).padStart(2, "0");
    const calm = (c.label || "").trim().toLowerCase() === "awareness";
    const text = c.text ? `${esc(c.text)} ` : "";
    const link = linkFragment(c.link);
    const sig = calm ? "" : `<span class="fs-sig" aria-hidden="true"><i></i><i></i><i></i><i></i></span>`;
    return `<div class="m-row fs-ch-row${calm ? " fs-ch-calm" : ""}" data-ch="${ch}">
      <dt><span class="fs-ch-tag">CH-${ch}</span> ${esc(c.label)}</dt>
      <dd>${text}${link}${sig}</dd>
    </div>`;
  }
  function renderChannels(channels) {
    const list = $("#fs-channels");
    if (list && Array.isArray(channels) && channels.length) {
      list.innerHTML = channels.map(channelRowHtml).join("");
    }
    // buildBlipsFromRows()/wireHighlightSync() laufen NICHT hier, sondern
    // einmalig im Boot (siehe unten) — so entstehen Blips/Hover-Kopplung
    // auch dann, wenn TakeoffData ganz fehlt und renderChannels() nie
    // aufgerufen wird (die .fs-ch-row-Zeilen sind dann die statischen).
  }
  function buildBlipsFromRows() {
    const wrap = $("#fs-blips");
    const rows = $$(".fs-ch-row");
    if (!wrap || !rows.length) return;
    wrap.innerHTML = rows.map((row, i) => {
      const ang = (360 / rows.length * i).toFixed(1);
      return `<span class="fs-blip" data-ch="${esc(row.dataset.ch)}" style="--ang:${ang}deg; --dl:${(i * .15).toFixed(2)}s"></span>`;
    }).join("");
  }
  /* Liste <-> Radar: reine Hover/Focus-Kopplung, KEIN rAF — Interaktions-
     Feedback ist nicht an FX-Tiers gebunden, nur Ambient-Loops sind es. */
  function wireHighlightSync() {
    $$(".fs-ch-row").forEach(row => {
      const blip = $(`.fs-blip[data-ch="${row.dataset.ch}"]`);
      if (!blip) return;
      const on = () => blip.classList.add("is-active");
      const off = () => blip.classList.remove("is-active");
      row.addEventListener("mouseenter", on);
      row.addEventListener("mouseleave", off);
      row.addEventListener("focusin", on);
      row.addEventListener("focusout", off);
    });
  }
  function syncRadarActive(ch) {
    $$(".fs-blip").forEach(b => b.classList.toggle("is-active", b.dataset.ch === ch));
  }

  /* ============================================================
     Anliegen-Wegweiser — Themen-Chips bauen live einen mailto-Link
     und zeigen eine Kanal-Empfehlung. Chips bleiben echte <a href="mailto:…">
     -Links (No-JS-Fallback: oeffnet direkt den Mail-Client/Telegram),
     JS ergaenzt nur die Empfehlungs-Karte obendrauf.
     ============================================================ */
  function buildMailto(subject, body) {
    const parts = [];
    if (subject) parts.push("subject=" + encodeURIComponent(subject));
    if (body) parts.push("body=" + encodeURIComponent(body));
    return "mailto:" + EMAIL + (parts.length ? "?" + parts.join("&") : "");
  }
  function topicChipHtml(t) {
    const isTelegram = t.channel === "telegram";
    const href = isTelegram ? "https://t.me/takeoffpotsdam" : buildMailto(t.mailSubject, t.mailBody);
    const extra = isTelegram ? ' target="_blank" rel="noopener"' : "";
    return `<a class="chip" role="listitem" data-topic="${esc(t.id)}" data-fs-pulse="${isTelegram ? "telegram" : "mail"}" href="${esc(href)}"${extra}>${esc(t.label)}</a>`;
  }
  function renderTopics(topics) {
    const wrap = $("#fs-topics");
    if (wrap && Array.isArray(topics) && topics.length) {
      wrap.innerHTML = topics.map(topicChipHtml).join("");
    }
    topicsById.clear();
    if (Array.isArray(topics)) topics.forEach(t => t?.id && topicsById.set(t.id, t));
  }
  function chFromChip(a) {
    const idx = Array.prototype.indexOf.call(a.parentElement.children, a);
    return String(idx + 1).padStart(2, "0");
  }
  function topicFromRow(a) {
    const isTelegram = /t\.me\//.test(a.href);
    return {
      id: a.dataset.topic, label: a.textContent.trim(),
      channel: isTelegram ? "telegram" : "mail",
      mailSubject: "", mailBody: "", responseNote: "", text: "",
    };
  }
  function recoHtml(t) {
    const channelLabel = t.channel === "telegram" ? "Telegram" : "E-Mail";
    const note = t.responseNote ? ` · ${esc(t.responseNote)}` : "";
    const text = t.text ? `<p class="fs-reco-text">${esc(t.text)}</p>` : "";
    const actionHref = t.channel === "telegram" ? "https://t.me/takeoffpotsdam" : buildMailto(t.mailSubject, t.mailBody);
    const actionLabel = t.channel === "telegram" ? "Telegram öffnen" : "Mail öffnen";
    const actionExtra = t.channel === "telegram" ? ' target="_blank" rel="noopener"' : "";
    const crossLink = t.linkHref ? `<a class="head-link" href="${esc(t.linkHref)}">${esc(t.linkLabel || "Mehr dazu")}</a>` : "";
    return `<span class="tx-label">Empfehlung</span>
      <p class="fs-reco-line"><span class="fs-ch-tag">CH-${esc(t.ch)}</span>Empfehlung: <b>${channelLabel}</b>${note}</p>
      ${text}
      <div class="cta-row">
        <a class="btn btn-primary" data-fs-pulse="${t.channel === "telegram" ? "telegram" : "mail"}" href="${esc(actionHref)}"${actionExtra}>${actionLabel}</a>
        ${crossLink}
      </div>`;
  }
  function showReco(t) {
    const box = $("#fs-reco");
    if (box) box.innerHTML = recoHtml(t);
  }
  function wireTopics() {
    const wrap = $("#fs-topics");
    if (!wrap) return;
    wrap.addEventListener("click", e => {
      const a = e.target.closest("a[data-topic]");
      if (!a) return;
      // KEIN preventDefault(): mailto:/Telegram-Link feuert normal weiter.
      $$(".chip", wrap).forEach(c => c.classList.remove("is-active"));
      a.classList.add("is-active");
      const base = topicsById.get(a.dataset.topic) || topicFromRow(a);
      const t = { ...base, ch: chFromChip(a) };
      showReco(t);
      syncRadarActive(t.ch);
    });
  }

  /* ============================================================
     Kanal-Vergleich & FAQ — einfache Listen-Renderer, gleiches Muster
     wie kollektiv.js' renderFamily/renderFaq.
     ============================================================ */
  function renderCompare(list) {
    const wrap = $("#fs-compare");
    if (!wrap || !Array.isArray(list) || !list.length) return;
    wrap.innerHTML = list.map(c => `
      <div class="fs-compare-item">
        <b>${esc(c.name)}</b>
        <span>${esc(c.value)}</span>
        <small>${esc(c.note || "")}</small>
      </div>`).join("");
  }
  function renderFaq(faq) {
    const wrap = $("#fs-faqlist");
    if (!wrap || !Array.isArray(faq) || !faq.length) return;
    wrap.innerHTML = faq.map(item => `
      <details class="faq">
        <summary>${esc(item.q)}</summary>
        <div class="faq-body">${esc(item.a)}</div>
      </details>`).join("");
  }

  /* ============================================================
     Sende-Puls — eigene Toast-Instanz (gleiche CSS-Klasse wie main.js'
     Toast, main.js legt seine eigene nur an, wenn Sammel-Items existieren
     — auf kontakt.html gibt es keine, siehe kontakt.css/kontakt.html).
     ============================================================ */
  let toastEl, toastT;
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
    toastT = setTimeout(() => toastEl.classList.remove("show"), 2600);
  }
  /* Delegiert (statt pro Button gebunden): die Empfehlungs-Karte legt ihre
     eigenen [data-fs-pulse]-Buttons erst zur Laufzeit an. */
  function wirePulse() {
    document.addEventListener("click", e => {
      const btn = e.target.closest("[data-fs-pulse]");
      if (!btn || !main.contains(btn)) return;
      if (ground) {
        ground.classList.remove("is-sending");
        void ground.offsetWidth;
        ground.classList.add("is-sending");
      }
      toast(btn.dataset.fsPulse === "telegram" ? TELEGRAM_TOAST : SEND_TOAST);
      // KEIN preventDefault(): mailto:/Telegram-Link laeuft ungehindert weiter.
    });
  }

  /* ---------- E-Mail-Adresse kopieren ---------- */
  function wireCopyEmail() {
    const btn = $("#fs-copy-btn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const addr = btn.dataset.copyEmail || EMAIL;
      try {
        await navigator.clipboard.writeText(addr);
        toast(COPY_TOAST);
      } catch {
        toast(addr);   // letzter Ausweg, falls Clipboard-API fehlt/blockiert ist
      }
    });
  }

  /* ---------- Kontakt als vCard speichern ---------- */
  function buildVCard(page, settings) {
    const org = page?.vcard?.orgName || "takeoff Potsdam";
    const email = settings?.email || EMAIL;
    const telegram = settings?.telegram || "https://t.me/takeoffpotsdam";
    const instagram = settings?.instagram || "https://www.instagram.com/takeoff.potsdam/";
    return [
      "BEGIN:VCARD", "VERSION:3.0",
      `FN:${org}`, `ORG:${org}`,
      `EMAIL;TYPE=INTERNET:${email}`,
      `URL;TYPE=Telegram:${telegram}`,
      `URL;TYPE=Instagram:${instagram}`,
      "NOTE:Rave-Kollektiv Potsdam — ehrenamtlich unterwegs",
      "END:VCARD",
    ].join("\r\n");
  }
  function wireVCard(page, settings) {
    const btn = $("#fs-vcard-btn");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const blob = new Blob([buildVCard(page, settings)], { type: "text/vcard;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "takeoff-potsdam.vcf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    });
  }

  /* ---------- Bodenstations-Uhr: Text-Update, keine Animation ---------- */
  function tickClock() {
    const el = $("#fs-clock");
    if (el) el.textContent = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  }
  function startClock() {
    tickClock();
    if (!fxOn()) return;   // Tier s: einmal gesetzt, kein Intervall (wie events.js)
    const everyMs = fxFull() ? 15000 : 45000;
    setInterval(() => { if (!document.hidden) tickClock(); }, everyMs);
  }

  /* ============================================================
     Gateway-Hydration
     ============================================================ */
  /* Modulweit ablegen statt nur lokal in hydrate(): wireVCard() (siehe unten)
     wird UNBEDINGT beim Boot aufgerufen, auch wenn TakeoffData ganz fehlt —
     die vCard muss auch dann herunterladbar sein (buildVCard() faellt in
     dem Fall auf die hartkodierten EMAIL/Telegram/Instagram-Defaults zurueck). */
  let pageData = null, settingsData = null;
  async function hydrate() {
    const TD = window.TakeoffData;
    if (!TD) return;
    const [page, settings] = await Promise.all([TD.page("kontakt"), TD.settings()]);
    pageData = page; settingsData = settings;

    if (settings?.email) EMAIL = settings.email;
    if (isGerman()) {
      if (page) TD.bindText(main, page);   /* hero.eyebrow / hero.intro — [data-bind]-Felder */
      if (page?.hero?.h1) safe(setGlowHeadline, $(".phero h1"), page.hero.h1);
    }
    if (page?.station?.label) { const el = $("#fs-station-tag"); if (el) el.textContent = page.station.label; }
    if (page?.station?.statusNote) { const el = $("#fs-status-note"); if (el) el.textContent = page.station.statusNote; }
    if (page?.vcard?.note) { const el = $("#fs-vcard-note"); if (el) el.textContent = page.vcard.note; }
    if (page?.station?.sendPulseToast) SEND_TOAST = page.station.sendPulseToast;
    if (page?.station?.copyToast) COPY_TOAST = page.station.copyToast;

    safe(renderChannels, page?.channels);
    safe(renderTopics, page?.topics);
    safe(renderCompare, page?.channelCompare);
    safe(renderFaq, page?.faq);
  }

  /* ============================================================
     Tier-L-Kuer: Blip-Einflug beim Erstkontakt, leichtes Scroll-Drift
     ============================================================ */
  let ctx;
  function buildMotionFX() {
    ctx?.revert(); ctx = null;
    if (!fxOn() || !window.gsap) {
      if (ground) ground.style.setProperty("--fs-drift", "0px");
      return;
    }
    ctx = gsap.context(() => {
      if (radar && "IntersectionObserver" in window) {
        const io = new IntersectionObserver(es => es.forEach(e => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          if (!fxOn()) return;   /* Tier evtl. seit dem Observe-Aufruf runtergestuft */
          gsap.from(".fs-blip", { opacity: 0, scale: 0, duration: .5, stagger: .06, ease: "back.out(2)" });
        }), { threshold: .4 });
        io.observe(radar);
      }
      if (fxFull() && window.ScrollTrigger && ground) {
        gsap.registerPlugin(ScrollTrigger);
        gsap.fromTo(ground, { "--fs-drift": "0px" }, {
          "--fs-drift": "-18px", ease: "none",
          scrollTrigger: { trigger: main, start: "top top", end: "bottom bottom", scrub: .8 },
        });
      } else if (ground) {
        /* Downgrade von L auf M: Tween wird nicht neu erzeugt — evtl.
           haengengebliebenen Versatz aus einer vorherigen Tier-L-Sitzung
           zuruecksetzen (gleiches Vorgehen wie kollektiv.js' buildScrollFX). */
        ground.style.setProperty("--fs-drift", "0px");
      }
    });
  }

  (async () => {
    await hydrate().catch(err => console.warn("[kontakt] Gateway-Daten nicht ladbar — Fallback-Markup bleibt stehen.", err));
    buildBlipsFromRows();   // liest die .fs-ch-row-Zeilen — statisch oder von hydrate() gerendert
    wireHighlightSync();
    wireTopics();
    wirePulse();
    wireCopyEmail();
    safe(wireVCard, pageData, settingsData);   /* unbedingt, auch ohne TakeoffData */
    startClock();
    buildMotionFX();
    new MutationObserver(buildMotionFX).observe(html, { attributes: true, attributeFilter: ["data-fx"] });
  })();
})();
