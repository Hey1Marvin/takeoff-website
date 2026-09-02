/* ============================================================
   news.js — "Bodenstation"-Logik fuer news.html
   Datenhoheit: TakeoffData (assets/js/data.js) + assets/data/pages/
   news.json. Ohne Gateway/Fetch bleibt das handgeschriebene
   Fallback-Markup stehen (progressive enhancement) — JS ersetzt/
   hydriert nur, was wirklich dynamisch ist:
     · Hero-Texte (Headline mit Auto-Glow auf dem letzten Wort, wie
       kollektiv.js — der News-Contract (page-news-seite.json)
       definiert hero.h1 exakt so)
     · Eingehend-Karte + Log-Archiv aus TakeoffData.news()
     · Statuszeile + Signal-Stats-Readout (echte, berechnete Werte)
     · Kanal-Filter mit Icons + Live-Zaehlung
     · Jahres-Trennlinien, Permalink/Teilen, Cross-Links + Countdown,
       Feedback-Mailto, FAQ, Kanal-CTA, Leerzustand, Lage-Banner-Slot

   Kein eigener rAF-Loop: das Ambient-Motiv (Sweep/Ringe/Scanline) ist
   reines CSS ueber [data-fx] (siehe news.css) — hier laufen nur kurze
   IntersectionObserver-Trigger und der Typewriter-setTimeout-Zyklus.
   ============================================================ */
(() => {
  "use strict";
  const html = document.documentElement;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fxOn   = () => html.dataset.fx !== "s" && !reduced();
  const fxFull = () => html.dataset.fx === "l" && !reduced();
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const main = $("#main");
  if (!main || !$("#rx-latest")) return;   // Guard: laeuft nur auf news.html

  function safe(fn, ...args) {
    try { fn(...args); } catch (err) { console.warn("[news]", fn.name || "render", err); }
  }

  /* ---------- Icon-Sets (handgezeichnet, kein Icon-Framework) ----------
     Gleicher Strichstil wie kollektiv.js' VALUE_ICONS/TEAM_ICONS (viewBox
     24, stroke currentColor, stroke-width 1.6). "wrench" ist bewusst
     dasselbe Symbol wie kollektiv.js' DIY-Icon — ein Werkzeug-Zeichen quer
     durch die Seite statt einem zweiten, aehnlichen Symbol. */
  const BADGE_ICONS = {
    megaphone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10v4a1 1 0 0 0 1 1h2l7 4V5L6 9H4a1 1 0 0 0-1 1Z"/><path d="M17 9.5c1.1 1 1.1 4 0 5M20 7c2.2 2 2.2 8 0 10"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 17.5 15 9M17.5 4 20 6.5l-2.5 2.5L15 6.5zM4.5 19.5l2-2"/></svg>',
    camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5Z"/><circle cx="12" cy="12.5" r="3.4"/></svg>',
    headphones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.4"/><rect x="17" y="14" width="4" height="6" rx="1.4"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.47 5.24 5.53.65-4.1 3.88 1.1 5.66L12 16.1l-5 2.83 1.1-5.66-4.1-3.88 5.53-.65Z"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.6"/></svg>',
  };
  const DEFAULT_BADGE_ORDER = ["Announcement", "Baulog", "Recap", "Podcast", "Save-the-Date", "Teaser"];
  const DEFAULT_BADGE_ICONS = { Announcement: "megaphone", Baulog: "wrench", Recap: "camera", Podcast: "headphones", "Save-the-Date": "star", Teaser: "eye" };

  /* ---------- Bruecke zum sitewide EN/DE-System (i18n.js/i18n-runtime.js) ----------
     news.html traegt (generiert + i18n-Pass) fuer die 5 vorhandenen Meldungen
     bereits data-i18n-Schluessel (news.badge.*, post.*.title/.text, news.insta.*,
     link.kollektiv_log). Wir spiegeln GENAU diese Schluessel auf die JS-
     gerenderten Karten, damit boot() am Ende TakeoffI18n.apply() aufrufen und
     die frisch eingefuegten Knoten korrekt nachziehen kann. Neue Meldungen ohne
     Eintrag hier bleiben schlicht deutsch — exakt das dokumentierte
     Rueckfallverhalten des Systems (i18n.js-Kommentarkopf). */
  const NEWS_I18N_KEYS = {
    n5: { badge: "news.badge.announcement", insta: "news.insta.post" },
    n4: { badge: "news.badge.buildlog", title: "post.marsbau.title" },
    n3: { badge: "news.badge.recap", title: "post.pride.title", text: "post.pride.text", insta: "news.insta.recap" },
    n2: { badge: "common.podcast", title: "post.podcast1.title", text: "post.podcast1.text" },
    n1: { badge: "news.badge.buildlog", title: "post.rig.title" },
  };
  const BADGE_I18N_KEYS = {
    Announcement: "news.badge.announcement", Baulog: "news.badge.buildlog",
    Recap: "news.badge.recap", Podcast: "common.podcast",
  };
  const i18nAttr = key => key ? ` data-i18n="${key}"` : "";
  /* Teilen-Icon 1:1 aus events.html (.m-share) uebernommen — gleiches
     Symbol fuer "Teilen" quer durch die Seiten. */
  const SHARE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="M8.3 10.7l7.4-4.4M8.3 13.3l7.4 4.4"/></svg>';

  /* ---------- Eigener Toast (Muster: events.js) ---------- */
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

  /* ---------- Datum-Helfer ----------
     EINE Grundfunktion (signed days, auf lokale Mitternacht normiert)
     fuer beide Richtungen: "vor X Tagen" (Vorzeichen positiv, Vergangenheit)
     und "in X Tagen" (negiert, Zukunft) — vermeidet, dass ein Countdown je
     nach Tageszeit einen Tag zu wenig zaehlt (reines Date.now()-Diffing
     ohne Mitternachts-Normierung waere hier um bis zu einen Tag daneben). */
  function daysBetween(iso) {
    if (!iso) return null;
    const target = new Date(iso + "T00:00:00");
    if (Number.isNaN(target.getTime())) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.round((now - target) / 86400000);
  }
  function sinceLabel(days, cfg = {}) {
    if (days == null) return "";
    if (days <= 0) return cfg.todayLabel || "heute";
    if (days === 1) return cfg.dayLabel || "vor 1 Tag";
    return (cfg.daysTemplate || "vor {days} Tagen").replace("{days}", days);
  }
  function countdownLabel(days, cfg = {}) {
    if (days <= 0) return cfg.todayLabel || "→ heute!";
    if (days === 1) return cfg.tomorrowLabel || "→ morgen";
    return (cfg.template || "→ in {days} Tagen").replace("{days}", days);
  }

  /* ---------- H1 mit Auto-Glow auf dem letzten Wort (1:1 aus kollektiv.js —
     der News-Contract (page-news-seite.json) beschreibt hero.h1 exakt so:
     "Das letzte Wort wird auf der Seite automatisch leuchtend hervorgehoben."
     Ein simples textContent-Ersetzen wuerde den bestehenden .glow-Span
     killen, deshalb eigener Helfer statt TakeoffData.bindText. ---------- */
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
  function hydrateText(page) {
    TakeoffData.bindText(main, page);   /* hero.eyebrow / hero.intro — [data-bind] */
    setGlowHeadline($(".phero h1"), page?.hero?.h1);
  }

  /* ============================================================
     Kartenrendering — Fallback-Markup bleibt stehen, falls der Gateway
     fehlschlaegt; JS ersetzt #rx-latest/#rx-log komplett, sobald Daten da
     sind (gleiches Prinzip wie events.js/kollektiv.js).
     ============================================================ */
  function cardHtml(item, { featured = false, crosslink = null, isLatestRecap = false } = {}, page) {
    const badge = esc(item.badge), acc = esc(item.accentRgb || "119 97 209"), id = esc(item.id || "");
    const keys = NEWS_I18N_KEYS[item.id] || {};
    const heading = featured
      ? `<h2 class="rx-headline" data-rx-type${i18nAttr(keys.title)}>${esc(item.title)}</h2>`
      : `<h3${i18nAttr(keys.title)}>${esc(item.title)}</h3>`;

    let insta = "";
    if (item.instaUrl) {
      const label = esc(page?.instaCard?.buttonLabel || "Instagram-Post ansehen · lädt erst nach Klick");
      const note = esc(page?.instaCard?.consentNote || "Zwei-Klick-Schutz: Erst nach diesem Klick lädt Instagram nach (DSGVO-freundlich) — im Prototyp nur simuliert.");
      insta = `<button class="n-insta" type="button"${i18nAttr(keys.insta)}>${label}</button><p class="rx-consent">${note}</p>`;
    }

    const shareUrl = `news.html#${id}`;
    const absUrl = new URL(shareUrl, location.href).href;
    const shareLabel = esc(page?.share?.buttonLabel || "Teilen");
    const tgLabel = esc(page?.share?.telegramLabel || "Telegram");
    const showTg = page?.share?.telegramIntent !== false;
    const tgHref = `https://t.me/share/url?url=${encodeURIComponent(absUrl)}&text=${encodeURIComponent(item.title || "")}`;
    const share = `<div class="rx-share" role="group" aria-label="Diesen Funkspruch teilen">
        <button type="button" class="rx-share-btn" data-share-text="${esc(item.title)}" data-share-url="${esc(shareUrl)}">${SHARE_ICON}${shareLabel}</button>
        ${showTg ? `<a class="rx-share-tg" href="${esc(tgHref)}" target="_blank" rel="noopener">${tgLabel} ↗</a>` : ""}
      </div>`;

    let links = "";
    if (crosslink) {
      const cd = crosslink.countdownText ? `<span class="rx-cd">${esc(crosslink.countdownText)}</span>` : "";
      links = `<div class="rx-links"><a class="head-link rx-cross" href="${esc(crosslink.href)}"${i18nAttr(crosslink.i18nKey)}>${esc(crosslink.label)}</a>${cd}</div>`;
    }

    let feedback = "";
    if (isLatestRecap) {
      const fb = page?.feedback || {};
      const subject = (fb.mailSubjectTemplate || "Feedback – {event}").replace("{event}", item.title || "");
      const mailHref = `mailto:${esc(fb.mailTo || "info@takeoff-potsdam.de")}?subject=${encodeURIComponent(subject)}`;
      feedback = `<div class="rx-feedback"><b>${esc(fb.eyebrow || "Warst du dabei?")}</b>${esc(fb.prompt || "Wie war die letzte Mission?")} <a href="${mailHref}">${esc(fb.linkLabel || "Kurz Feedback schicken →")}</a></div>`;
    }

    return `<article class="ncard reveal" id="${id}" style="--n-acc: ${acc}" data-badge="${badge}">
      <div class="n-head">
        <span class="n-badge"${i18nAttr(keys.badge)}>${badge}</span>
        <span class="rx-sig" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span class="n-date">${esc(TakeoffData.fmtDate(item.date))}</span>
      </div>${heading}<p${i18nAttr(keys.text)}>${esc(item.text)}</p>${insta}${links}${share}${feedback}</article>`;
  }

  function buildLogHtml(items, page, crosslinkFor, latestRecapId) {
    const tpl = page?.yearDivider?.template || "— {year} —";
    /* lastYear startet auf dem Jahr des ERSTEN Eintrags (nicht null) — sonst
       bekaeme schon die erste Karte einen Marker "— {Jahr} —" spendiert.
       Die Marke soll nur an echten Jahresuebergaengen erscheinen (siehe
       Beispiel in der Aufgabenstellung: "— 2025 —" beim Wechsel), nicht vor
       dem allerersten Log-Eintrag. */
    let out = "", lastYear = items[0] ? (items[0].date || "").slice(0, 4) : null;
    items.forEach(item => {
      const year = (item.date || "").slice(0, 4);
      if (year && year !== lastYear) {
        out += `<p class="rx-yearmark">${esc(tpl.replace("{year}", year))}</p>`;
        lastYear = year;
      }
      out += cardHtml(item, { crosslink: crosslinkFor(item.id), isLatestRecap: item.id === latestRecapId }, page);
    });
    return out;
  }

  /* ---------- Statuszeile + Signal-Stats-Readout (echte Werte, keine
     Fantasie-Techno-Zeile) ---------- */
  function setStatus(page, isoDate) {
    const el = $("[data-rx-status]");
    if (!el || !isoDate) return;
    const cfg = page?.status || {};
    const prefix = cfg.prefix || "Letzte Transmission";
    el.textContent = `${prefix}: ${sinceLabel(daysBetween(isoDate), cfg)} (${TakeoffData.fmtDate(isoDate)})`;
  }
  function setStats(page, newsAll) {
    const root = $("[data-rx-readout]");
    if (!root || !Array.isArray(newsAll) || !newsAll.length) return;
    const counts = {};
    newsAll.forEach(n => { counts[n.badge] = (counts[n.badge] || 0) + 1; });
    let topBadge = newsAll[0].badge, topCount = 0;
    Object.entries(counts).forEach(([b, c]) => { if (c > topCount) { topBadge = b; topCount = c; } });
    const set = (key, val) => { const el = $(`[data-rx-stat="${key}"]`, root); if (el && val != null) el.textContent = val; };
    set("total", String(newsAll.length));
    set("topbadge", topCount > 1 ? `${topBadge} ×${topCount}` : topBadge);
    set("since", sinceLabel(daysBetween(newsAll[0].date), page?.status || {}));
  }

  /* ---------- Lage-Banner — Schema+Render-Slot fuer SPAETER, bleibt ohne
     aktives statusBanner.active unsichtbar (news.json: active:false). */
  function renderStatusBanner(page) {
    const el = $("[data-rx-banner]");
    const cfg = page?.statusBanner;
    if (!el || !cfg?.active) return;
    let inner = `<b>${esc(cfg.label || "Lage-Update")}</b><span>${esc(cfg.text || "")}</span>`;
    if (cfg.href) inner += `<a href="${esc(cfg.href)}">Mehr →</a>`;
    el.innerHTML = inner;
    el.hidden = false;
  }

  /* ============================================================
     Kanal-Filter — echtes Werkzeug: Chips werden aus badgeOrder ∩
     tatsaechlich vorkommenden Badges gebaut (erweiterbar: ein neues,
     vorregistriertes Badge in news[] taucht automatisch auf), Zaehlung
     bezieht sich auf das filterbare Log-Archiv (ohne die Eingehend-Karte).
     ============================================================ */
  function renderChannels(page, allNews, restItems) {
    const bar = $(".rx-channels");
    if (!bar) return;
    const order = page?.filter?.badgeOrder?.length ? page.filter.badgeOrder : DEFAULT_BADGE_ORDER;
    const icons = page?.filter?.badgeIcons && Object.keys(page.filter.badgeIcons).length ? page.filter.badgeIcons : DEFAULT_BADGE_ICONS;
    const present = order.filter(b => allNews.some(n => n.badge === b));
    const restCounts = {};
    restItems.forEach(n => { restCounts[n.badge] = (restCounts[n.badge] || 0) + 1; });
    const allLabel = esc(page?.filter?.allLabel || "Alle");
    let out = `<button type="button" class="rx-ch" data-ch="all" aria-pressed="true">${allLabel} <span class="rx-ch-n">${restItems.length}</span></button>`;
    out += present.map(b => {
      const ico = BADGE_ICONS[icons[b]] || "";
      const bKey = BADGE_I18N_KEYS[b];
      return `<button type="button" class="rx-ch" data-ch="${esc(b)}" aria-pressed="false">${ico}<span${i18nAttr(bKey)}>${esc(b)}</span> <span class="rx-ch-n">${restCounts[b] || 0}</span></button>`;
    }).join("");
    bar.innerHTML = out;
  }
  function wireChannels(page, total) {
    const bar = $(".rx-channels"), log = $("#rx-log"), consoleEl = bar?.closest(".rx-console");
    const emptyHint = $("#rx-log-empty");
    if (!bar || !log) return;
    bar.addEventListener("click", e => {
      const btn = e.target.closest(".rx-ch");
      if (!btn) return;
      $$(".rx-ch", bar).forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
      const ch = btn.dataset.ch;
      let shown = 0;
      $$("article.ncard", log).forEach(c => {
        const match = ch === "all" || c.dataset.badge === ch;
        c.hidden = !match;
        if (match) shown++;
      });
      $$(".rx-yearmark", log).forEach(y => { y.hidden = ch !== "all"; });
      const count = $(".rx-count");
      if (count) {
        const tpl = page?.filter?.countTemplate || "{shown} von {total} Funksprüchen";
        count.textContent = tpl.replace("{shown}", shown).replace("{total}", total);
      }
      if (emptyHint) emptyHint.hidden = shown !== 0;
      if (consoleEl && fxOn()) { consoleEl.classList.remove("rx-retune"); void consoleEl.offsetWidth; consoleEl.classList.add("rx-retune"); }
    });
  }

  /* ---------- Zwei-Klick-Consent fuer Instagram-Demo (Muster: .setcard) ---------- */
  function wireConsent() {
    document.addEventListener("click", e => {
      const btn = e.target.closest(".n-insta");
      if (!btn) return;
      btn.closest(".ncard")?.classList.toggle("asked");
    });
  }

  /* ---------- Teilen — Web-Share-API mit Zwischenablage-Fallback (Muster
     1:1 aus events.js). Delegiert auf document, weil #rx-latest/#rx-log per
     innerHTML neu gerendert werden — ein direkt gebundener Listener wuerde
     das ueberleben. ---------- */
  function wireShareButtons(page) {
    const copiedMsg = page?.share?.copiedToast || "Link kopiert ✓";
    document.addEventListener("click", async e => {
      const btn = e.target.closest(".rx-share-btn[data-share-text]");
      if (!btn) return;
      const text = btn.dataset.shareText || document.title;
      const url = new URL(btn.dataset.shareUrl || location.href, location.href).href;
      if (navigator.share) {
        try { await navigator.share({ title: document.title, text, url }); return; }
        catch (err) { if (err && err.name === "AbortError") return; }
      }
      try { await navigator.clipboard.writeText(url); toast(copiedMsg); }
      catch { toast(url); }
    });
  }

  /* ---------- FAQ + Kanal-CTA/Quer-Verweise ---------- */
  function renderFaq(page) {
    const list = $("#rx-faq");
    if (!list || !Array.isArray(page?.faq) || !page.faq.length) return;
    list.innerHTML = page.faq.map(item => `<div class="m-row"><dt>${esc(item.q)}</dt><dd>${esc(item.a)}</dd></div>`).join("");
  }
  function renderCta(page) {
    const cta = page?.channelCta;
    if (cta) {
      const eyebrow = $("#rx-cta-eyebrow"); if (eyebrow && cta.eyebrow) eyebrow.textContent = cta.eyebrow;
      const title = $("#rx-cta-title"); if (title && cta.title) title.textContent = cta.title;
      const text = $("#rx-cta-text"); if (text && cta.text) text.textContent = cta.text;
      const btn = $("#rx-cta-btn");
      if (btn) { if (cta.ctaLabel) btn.textContent = cta.ctaLabel; if (cta.ctaHref) btn.href = cta.ctaHref; }
    }
    const promo = page?.crossPromo;
    if (promo) {
      const h = $("#rx-promo-history"), c = $("#rx-promo-calendar");
      if (h) { if (promo.historyLabel) h.textContent = promo.historyLabel; if (promo.historyHref) h.href = promo.historyHref; }
      if (c) { if (promo.calendarLabel) c.textContent = promo.calendarLabel; if (promo.calendarHref) c.href = promo.calendarHref; }
    }
  }

  /* ============================================================
     Leerzustand — nur bei POSITIVER Bestaetigung (news().length === 0)
     einblenden, analog events.js: schlaegt der Fetch fehl, bleibt das
     statische, korrekt befuellte Fallback-Markup stehen.
     ============================================================ */
  function showEmptyState(page) {
    $("[data-rx-eingehend-group]")?.setAttribute("hidden", "");
    $("[data-rx-log-group]")?.setAttribute("hidden", "");
    const empty = $(".rx-empty");
    if (!empty) return;
    const es = page?.emptyState;
    if (es) {
      const label = $(".tx-label", empty); if (label && es.eyebrow) label.textContent = es.eyebrow;
      const strong = $("strong", empty); if (strong && es.title) strong.textContent = es.title;
      const text = $(".es-text", empty); if (text && es.text) text.textContent = es.text;
      const cta = $(".btn", empty);
      if (cta) { if (es.ctaLabel) cta.textContent = es.ctaLabel; if (es.ctaHref) cta.href = es.ctaHref; }
    }
    empty.removeAttribute("hidden");
  }

  /* ============================================================
     Gateway-Hydration: Liste + Cross-Links/Countdown + Stats + Filter
     ============================================================ */
  async function hydrateList(page) {
    const [newsAll, upcoming] = await Promise.all([
      TakeoffData.news(),
      TakeoffData.upcoming().catch(() => []),
    ]);
    if (!Array.isArray(newsAll)) return;
    if (newsAll.length === 0) { showEmptyState(page); return; }

    const upcomingBySlug = new Map((upcoming || []).map(e => [e.slug, e]));
    const crosslinkFor = id => {
      const cfg = page?.crosslinks?.[id];
      if (!cfg) return null;
      let countdownText = "";
      if (cfg.eventSlug && upcomingBySlug.has(cfg.eventSlug)) {
        const days = -daysBetween(upcomingBySlug.get(cfg.eventSlug).date);
        countdownText = countdownLabel(days, page?.countdown || {});
      }
      return { href: cfg.href, label: cfg.label, i18nKey: cfg.i18nKey, countdownText };
    };

    const [latest, ...rest] = newsAll;
    const latestRecap = newsAll.find(n => n.badge === "Recap");
    const latestRecapId = latestRecap?.id;

    $("#rx-latest").innerHTML = cardHtml(latest, { featured: true, crosslink: crosslinkFor(latest.id), isLatestRecap: latest.id === latestRecapId }, page);
    $("#rx-log").innerHTML = buildLogHtml(rest, page, crosslinkFor, latestRecapId);

    setStatus(page, latest.date);
    setStats(page, newsAll);
    renderChannels(page, newsAll, rest);
    wireChannels(page, rest.length);
  }

  /* ============================================================
     Typewriter — NUR die Eingehend-Headline, einmalig. Zeichenweises
     textContent-Slicing eines einzigen Textknotens, kein Zerlegen in
     Buchstaben-Spans (vgl. events.js-Flap-Engine-Kommentar).
     ============================================================ */
  function typewriter(el, stepMs, onDone) {
    const text = el.textContent.trim();
    el.textContent = ""; el.classList.add("rx-typing");
    let i = 0;
    (function step() {
      if (!fxOn()) { el.textContent = text; el.classList.remove("rx-typing"); onDone?.(); return; } // Tier evtl. seit Trigger runtergestuft
      i++; el.textContent = text.slice(0, i);
      if (i < text.length) setTimeout(step, stepMs);
      else {
        el.classList.remove("rx-typing"); el.classList.add("rx-locked");
        setTimeout(() => el.classList.remove("rx-locked"), 700);
        onDone?.();
      }
    })();
  }
  function pingArray() {
    if (!fxOn()) return;
    const arr = $("#rx-array");
    if (!arr) return;
    arr.classList.remove("rx-pulse"); void arr.offsetWidth; arr.classList.add("rx-pulse");
  }
  function bootTypewriter(page) {
    const h = $("#rx-latest [data-rx-type]");
    if (!h || !fxOn() || !("IntersectionObserver" in window)) return; // Tier s/reduced-motion: voller Text steht bereits da
    if (page?.terminal?.typewriter === false) return;
    const baseMs = Number(page?.terminal?.charMs) || 24;
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; io.unobserve(e.target);
      if (!fxOn()) { h.classList.remove("rx-typing"); return; }
      const stepMs = fxFull() ? baseMs : Math.max(10, Math.round(baseMs * .65));
      typewriter(h, stepMs, fxFull() ? pingArray : undefined);
    }), { rootMargin: "0px 0px -15% 0px", threshold: .4 });
    io.observe(h);
  }

  /* ---------- Power-On-Puls der Schuessel beim ersten Sichtbarwerden
     (Tier m: einmalig, Tier l: zusaetzlich zur CSS-Dauerschleife) ---------- */
  function bootArrayPowerOn() {
    const arr = $("#rx-array");
    if (!arr || !fxOn() || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; io.unobserve(e.target);
      arr.classList.add("rx-poweron");
    }), { threshold: .1 });
    io.observe($(".phero") || document.body);
  }

  /* ============================================================
     Boot
     ============================================================ */
  async function boot() {
    let page = null;
    if (window.TakeoffData) {
      try { page = await TakeoffData.page("news"); }
      catch (err) { console.warn("[news] Seiteninhalte nicht ladbar — Fallback-Markup bleibt stehen.", err); }
    }

    if (page) safe(hydrateText, page);
    safe(renderFaq, page);
    safe(renderCta, page);
    safe(renderStatusBanner, page);
    wireConsent();
    wireShareButtons(page);

    if (window.TakeoffData) {
      try { await hydrateList(page); }
      catch (err) { console.warn("[news] News-Liste nicht ladbar — Fallback-Markup bleibt stehen.", err); }
    }

    bootTypewriter(page);
    bootArrayPowerOn();

    /* ---------- i18n nachziehen ----------
       hydrateText()/hydrateList() schreiben deutschen TakeoffData-Text in
       Knoten, von denen einige data-i18n(-html) tragen (s.o.). War die Seite
       bereits auf Englisch umgeschaltet, ueberschreibt TakeoffI18n.apply()
       genau diese Knoten wieder korrekt — alles ohne Eintrag im Woerterbuch
       (neue rx-*-Bausteine) bleibt unangetastet deutsch stehen. i18n-
       runtime.js exportiert die Funktion global; ohne sie (Skript fehlt/
       Woerterbuch leer) passiert hier einfach nichts. */
    window.TakeoffI18n?.apply?.(window.TakeoffI18n.current());
  }

  boot();
})();
