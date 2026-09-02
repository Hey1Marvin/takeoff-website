/* ============================================================
   kalender.js — Seiten-Logik für kalender.html ("Bordchronometer")

   Datenhoheit: TakeoffData (assets/js/data.js). Ohne Gateway/Fetch bleibt
   das handgeschriebene Markup stehen (progressive enhancement) — die
   Zeitleiste ist bereits vollständig und korrekt (alle 9 bekannten
   Missionen von Hand gepflegt, inkl. data-date/-doors/-end/-title/...),
   JS synchronisiert nur die wirklich dynamischen Teile (Bordzeit, T-Minus/
   T-Plus, Delta-Chips, Kalender-Downloads, Filter, Monatsgitter, Stats,
   Venues, FAQ, Teilen, Patch-Teaser) und ergänzt künftige Events, die nur
   im Gateway existieren, statt die Liste komplett neu zu rendern.

   Wichtig: T-Minus/T-Plus laufen über einen EIGENEN, kleinen Datums-Helfer
   (berlinDate) statt über main.js' #tminus-clock-Hook — dessen EVENTS-Kopie
   ist fest verdrahtet (+02:00 eingebrannt) und vom Gateway/Draft-Overlay
   nicht erreichbar. Da diese Seite verspricht "aktualisiert sich selbst,
   wenn wir Termine ändern", würde ausgerechnet ihr eigener Countdown das
   Versprechen brechen, wenn er an der eingefrorenen Kopie hinge. Die
   .tminus-Klassen werden trotzdem wiederverwendet (Optik) — nur mit
   eigenen data-bc-*-Hooks statt der main.js-IDs, damit sich dessen
   generischer Hook nicht versehentlich mit einklinkt.
   ============================================================ */
(() => {
  "use strict";
  const html = document.documentElement;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fxOn    = () => html.dataset.fx !== "s" && !reduced();
  const fxFull  = () => html.dataset.fx === "l" && !reduced();
  const isGerman = () => !html.lang || html.lang === "de";

  const main = $("#main");
  if (!main) return;   // Guard: läuft nur auf kalender.html (DATA.md-Pflicht)

  /* ---------- Kleinkram-Helfer ---------- */
  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  const cssEsc = s => (window.CSS && CSS.escape) ? CSS.escape(String(s)) : String(s).replace(/["\\]/g, "\\$&");
  function safe(fn, ...args) {
    try { return fn(...args); } catch (err) { console.warn("[kalender]", fn.name || "render", err); }
  }
  const pad = n => String(n).padStart(2, "0");
  const todayIso = () => new Date().toISOString().slice(0, 10);   // wie data.js' today() — Konsistenz mit upcoming()/past()

  /* ---------- Datums-Helfer: db.json liefert date+Zeit getrennt, ohne
     Offset, teils "TBA"/"open end"/"". Europe/Berlin ist die einzige
     gültige Auslegung dieser Website — Offset grob nach Sommerzeit-
     Fenster ergänzt (ausreichend für den Planungshorizont der Seite). ---- */
  const HHMM = /^\d{2}:\d{2}$/;
  function berlinDate(dateStr, timeStr) {
    const t = HHMM.test(timeStr || "") ? timeStr : "00:00";
    const month = Number(dateStr.split("-")[1]);
    const offset = (month > 3 && month < 10) ? "+02:00" : "+01:00";
    return new Date(`${dateStr}T${t}:00${offset}`);
  }

  /* ---------- Eigener Toast (Muster 1:1 aus events.js/kontakt.js) ---------- */
  let toastEl = null, toastTimer = 0;
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
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2800);
  }

  /* ============================================================
     1 · Bordzeit — großes HH:MM + tickende Sekunden. Minuten schreiben nur
     bei tatsächlichem Minutenwechsel. Tier s = einmal setzen, kein
     Intervall; m = alle 5s; l = Sekundentakt (Muster identisch zu events.js
     "Live-Uhr im Board-Header" / kontakt.js "Bodenstations-Uhr").
     ============================================================ */
  let lastMinute = null, clockTimer = null;
  function renderClock() {
    const hmEl = $("[data-bc-hm]");
    if (!hmEl) return;
    const now = new Date();
    const hm = now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
    if (hm !== lastMinute) { hmEl.textContent = hm; lastMinute = hm; }
    const secEl = $("[data-bc-sec]");
    if (!secEl) return;
    if (!fxOn()) { secEl.hidden = true; return; }
    secEl.hidden = false;
    secEl.textContent = now.toLocaleTimeString("de-DE", { second: "2-digit", timeZone: "Europe/Berlin" });
    if (fxFull()) { secEl.classList.remove("is-tick"); void secEl.offsetWidth; secEl.classList.add("is-tick"); }
  }
  function startClock() {
    const cluster = $(".bc-cluster");
    if (!cluster) return;
    renderClock();
    clearInterval(clockTimer);
    if (!fxOn()) return;                        // Tier s: einmalig, fertig
    const everyMs = fxFull() ? 1000 : 5000;      // l = 1×/s, m = alle 5s
    clockTimer = setInterval(() => { if (!document.hidden) renderClock(); }, everyMs);
  }

  /* ============================================================
     2 · Sweep — Phase EINMAL auf die echte Sekunde synchronisieren, danach
     läuft die 60s-CSS-Animation völlig JS-frei weiter.
     ============================================================ */
  function syncSweep() {
    const sweep = $(".bc-sweep");
    if (!sweep) return;
    if (!fxOn()) { sweep.style.animationPlayState = "paused"; return; }
    const s = new Date().getSeconds() + new Date().getMilliseconds() / 1000;
    sweep.style.animationDelay = `-${s}s`;
    sweep.style.animationPlayState = "running";
  }

  /* ============================================================
     3 · T-Minus / T-Plus (Subdials) — aus TakeoffData, nicht aus main.js.
     ============================================================ */
  function fmtDelta(ms, withSeconds) {
    ms = Math.max(0, ms);
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24,
          m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
    let out = `${d}<small>T</small> ${pad(h)}<small>h</small> ${pad(m)}<small>m</small>`;
    if (withSeconds) out += ` ${pad(s)}<small>s</small>`;
    return out;
  }
  let clusterTimer = null;
  function primeCluster(pageData, nextEv, lastPast) {
    const cluster = $(".bc-cluster");
    if (!cluster) return;
    const tEl = $("[data-bc-tminus]"), tgtEl = $("[data-bc-target]"), pEl = $("[data-bc-tplus]");
    const wrapEl = $("[data-bc-tminus-wrap]");
    if (wrapEl) wrapEl.setAttribute("aria-label", pageData?.clock?.label || "Countdown bis zum nächsten Launch");

    let nextTarget = null, lastPastDate = null;
    if (nextEv?.date) {
      nextTarget = berlinDate(nextEv.date, nextEv.doors || "");
      if (tgtEl && nextEv.title) tgtEl.textContent = nextEv.title;
    }
    if (lastPast?.date) lastPastDate = berlinDate(lastPast.date, lastPast.doors || "");

    function tick() {
      if (tEl && nextTarget) {
        const diff = nextTarget.getTime() - Date.now();
        tEl.innerHTML = diff <= 0 ? "LIFTOFF <small>· läuft</small>" : fmtDelta(diff, fxFull());
      }
      if (pEl && lastPastDate) pEl.innerHTML = fmtDelta(Date.now() - lastPastDate.getTime(), false);
    }
    tick();
    clearInterval(clusterTimer);
    if (fxOn()) clusterTimer = setInterval(() => { if (!document.hidden) tick(); }, fxFull() ? 1000 : 60000);
  }

  /* ============================================================
     4 · Bordskala — Ticks + "Heute"-Marker + Event-Punkte aus upcoming().
     Edge-to-edge (kein .wrap), deshalb rein zeitgetrieben, nicht scroll-
     gekoppelt (Anti-Kitsch-Vorgabe).
     ============================================================ */
  const SCALE_WINDOW_DAYS = 30;
  function buildScale(upcoming) {
    const windowEl = $("[data-bc-scale-window]");
    if (windowEl) windowEl.textContent = `+${SCALE_WINDOW_DAYS} Tage`;
    const svg = $(".bc-scale-svg");
    if (!svg) return;
    const H = 46, leftX = 6, rightX = 994, yBase = 8, yEnd = H - 4;
    let out = "";
    for (let i = 0; i <= SCALE_WINDOW_DAYS; i++) {
      const x = (leftX + (rightX - leftX) * (i / SCALE_WINDOW_DAYS)).toFixed(1);
      const isNow = i === 0, isMajor = i % 5 === 0;
      const y1 = isNow ? 2 : (isMajor ? yBase - 3 : yBase);
      out += `<line class="tick${isNow ? " now" : ""}" x1="${x}" y1="${y1}" x2="${x}" y2="${yEnd}"></line>`;
    }
    const baseline = berlinDate(todayIso(), "00:00").getTime();
    (upcoming || []).forEach(ev => {
      if (!ev.date) return;
      const days = Math.floor((berlinDate(ev.date, ev.doors || "").getTime() - baseline) / 864e5);
      if (days < 0 || days > SCALE_WINDOW_DAYS) return;
      const x = (leftX + (rightX - leftX) * (days / SCALE_WINDOW_DAYS)).toFixed(1);
      const circle = `<circle class="mark" cx="${x}" cy="${H / 2}" r="4"></circle>`;
      out += ev.slug
        ? `<a href="#ev-${esc(ev.slug)}" aria-label="${esc(ev.title || "Termin")}">${circle}</a>`
        : circle;
    });
    svg.innerHTML = out;
  }

  /* ============================================================
     5 · Delta-Chip + Kalender-Quick-Add — beide lesen NUR aus
     row.dataset.* (resilient, kein Gateway nötig). Rohdaten stehen im
     statischen Markup jeder .m-row (data-date/-doors/-end/-title/-venue/
     -address/-price), genau wie im Spec vorgesehen.
     ============================================================ */
  function rowInfo(row) {
    return {
      slug: row.dataset.slug || "", title: row.dataset.title || "",
      venueName: row.dataset.venue || "", address: row.dataset.address || "",
      date: row.dataset.date || "", doors: row.dataset.doors || "", end: row.dataset.end || "",
      price: row.dataset.price || "",
    };
  }
  function computeRowDelta(row) {
    if (!row.dataset.date) return null;
    const start = berlinDate(row.dataset.date, row.dataset.doors || "");
    const end = HHMM.test(row.dataset.end || "") ? berlinDate(row.dataset.date, row.dataset.end) : null;
    const now = Date.now();
    if (end && now >= start.getTime() && now <= end.getTime()) return { text: "LIVE", live: true, aria: "Läuft gerade" };
    const diff = start.getTime() - now;
    if (diff <= 0) return null;                              // vorbei/läuft ohne bekanntes Ende -> kein Chip
    const days = Math.floor(diff / 864e5);
    if (days >= 1) return { text: `T–${days}T`, live: false, aria: `Startet in ${days} Tag${days === 1 ? "" : "en"}` };
    const hours = Math.max(1, Math.floor(diff / 36e5));
    return { text: `T–${hours}H`, live: false, aria: `Startet in ${hours} Stunde${hours === 1 ? "" : "n"}` };
  }
  function renderDeltas() {
    $$(".m-row[data-date]").forEach(row => {
      const out = $(".m-delta", row);
      if (!out) return;
      const d = computeRowDelta(row);
      out.textContent = d ? d.text : "";
      out.classList.toggle("is-live", !!d?.live);
      if (d?.aria) out.setAttribute("aria-label", d.aria); else out.removeAttribute("aria-label");
    });
  }

  /* ---------- Google-Kalender-Link + .ics (client-seitig, RFC5545-schlank
     — bewusst ohne 75-Oktett-Zeilenfaltung: Prototyp-Umfang, alle
     Kalender-Apps im Test tolerieren die etwas längeren Zeilen). ---------- */
  function eventTiming(info) {
    if (!HHMM.test(info.doors || "")) return { hasTime: false, start: null, end: null };
    const start = berlinDate(info.date, info.doors);
    let end = HHMM.test(info.end || "") ? berlinDate(info.date, info.end) : new Date(start.getTime() + 4 * 3600e3);
    if (end.getTime() <= start.getTime()) end = new Date(end.getTime() + 864e5);   // Rollover über Mitternacht
    return { hasTime: true, start, end };
  }
  function googleCalUrl(info) {
    const { hasTime, start, end } = eventTiming(info);
    if (!hasTime) return null;
    const fmt = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const loc = [info.venueName, info.address].filter(Boolean).join(", ");
    const params = new URLSearchParams({ action: "TEMPLATE", text: `takeoff: ${info.title}`, dates: `${fmt(start)}/${fmt(end)}` });
    if (loc) params.set("location", loc);
    if (info.price) params.set("details", info.price);
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }
  function icsEscape(s) {
    return String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
  }
  const icsStamp = d => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  function icsVEvent(info) {
    const { hasTime, start, end } = eventTiming(info);
    const loc = [info.venueName, info.address].filter(Boolean).join(", ");
    const uid = `${info.slug || info.title.replace(/\s+/g, "-") || "termin"}-${info.date}@takeoff-potsdam.de`;
    const lines = ["BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${icsStamp(new Date())}`];
    if (hasTime) {
      lines.push(`DTSTART:${icsStamp(start)}`, `DTEND:${icsStamp(end)}`);
    } else {
      /* Datum bekannt, Uhrzeit nicht (z.B. "TBA") -> ganztägiger Eintrag
         statt Ausschluss, DTEND ist bei VALUE=DATE exklusiv (naechster Tag). */
      const startLocal = new Date(`${info.date}T00:00:00`);
      const endLocal = new Date(startLocal.getTime() + 864e5);
      const dPart = d => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
      lines.push(`DTSTART;VALUE=DATE:${dPart(startLocal)}`, `DTEND;VALUE=DATE:${dPart(endLocal)}`);
    }
    lines.push(`SUMMARY:${icsEscape("takeoff: " + info.title)}`);
    if (loc) lines.push(`LOCATION:${icsEscape(loc)}`);
    const descBits = [info.price, "Mehr: " + location.origin + location.pathname + (info.slug ? "#ev-" + info.slug : "")].filter(Boolean);
    lines.push(`DESCRIPTION:${icsEscape(descBits.join(" · "))}`, "END:VEVENT");
    return lines.join("\r\n");
  }
  function downloadIcs(filename, veventBlocks) {
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//takeoff potsdam//kalender//DE",
      "CALSCALE:GREGORIAN", "METHOD:PUBLISH", ...veventBlocks, "END:VCALENDAR"].join("\r\n");
    const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function buildRowCalActions(row, cal) {
    const out = $(".bc-caladd", row);
    if (!out || !row.dataset.date) return;
    const info = rowInfo(row);
    const { hasTime } = eventTiming(info);
    if (!hasTime) {
      out.textContent = cal.tbaNote || "Datum/Zeit steht noch nicht fest — Kalendereintrag folgt, sobald wir's wissen.";
      out.classList.add("is-tba");
      return;
    }
    out.classList.remove("is-tba");
    const gUrl = googleCalUrl(info);
    out.innerHTML =
      `<a href="${esc(gUrl)}" target="_blank" rel="noopener">${esc(cal.googleLabel || "Google Kalender")}</a>` +
      `<button type="button" data-ics-slug="${esc(info.slug)}">${esc(cal.icsLabel || "＋ .ics herunterladen")}</button>`;
  }
  function buildAllCalActions(cal) {
    $$(".bc-caladd").forEach(out => { const row = out.closest(".m-row"); if (row) buildRowCalActions(row, cal || {}); });
  }
  function wireIcsDelegation() {
    document.addEventListener("click", e => {
      const btn = e.target.closest("[data-ics-slug]");
      if (!btn) return;
      const row = btn.closest(".m-row");
      if (!row) return;
      downloadIcs(`takeoff-${row.dataset.slug || "termin"}.ics`, [icsVEvent(rowInfo(row))]);
    });
  }
  function wireIcsAll() {
    const btn = $("[data-bc-ics-all]");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const today = todayIso();
      const rows = $$(".m-row[data-date]").filter(r => r.dataset.date >= today);
      if (!rows.length) return;
      downloadIcs("takeoff-termine.ics", rows.map(r => icsVEvent(rowInfo(r))));
    });
  }

  /* ============================================================
     6 · Zeitleiste — Jahres-/Heute-Trenner (immer neu aus der sortierten
     .m-row[data-date]-Liste gebaut -> korrekt, egal wie viele Zeilen
     JS nachtraeglich ergaenzt hat), Filter, fehlende Events ergänzen.
     ============================================================ */
  function createRowFromEvent(ev) {
    const row = document.createElement("div");
    row.className = "m-row";
    if (ev.slug) row.id = `ev-${ev.slug}`;
    row.dataset.slug = ev.slug || "";
    row.dataset.date = ev.date;
    const isUpcoming = ev.date >= todayIso() && ev.state !== "past";
    const weekday = ev.weekday ? ev.weekday.charAt(0) + ev.weekday.slice(1).toLowerCase() : "";
    const dt = `${weekday} ${TakeoffData.fmtDate(ev.date)}`.trim();
    let dd = `<b>${esc(ev.title || "")}</b>`;
    if (ev.venue?.name) dd += ` · ${esc(ev.venue.name)}`;
    if (ev.pricing?.label) dd += ` · ${esc(ev.pricing.label)}`;
    if (ev.page) dd += ` · <a href="${esc(ev.page)}" style="color:var(--acc-3-tint)">Details</a>`;
    if (isUpcoming) {
      row.dataset.doors = ev.doors || "";
      row.dataset.end = ev.end || "";
      row.dataset.title = ev.title || "";
      row.dataset.venue = ev.venue?.name || "";
      row.dataset.address = ev.venue?.address || "";
      row.dataset.maps = ev.venue?.mapsQuery || "";
      row.dataset.price = ev.pricing?.label || "";
      dd += `<span class="m-delta"></span><div class="bc-caladd"></div>`;
    }
    row.innerHTML = `<dt>${esc(dt)}</dt><dd>${dd}</dd>`;
    return row;
  }
  function reconcileTimelineRows(rowsEl, upcoming, past) {
    [...(upcoming || []), ...(past || [])].forEach(ev => {
      if (!ev?.slug || !ev.date) return;
      if ($(`.m-row[data-slug="${cssEsc(ev.slug)}"]`, rowsEl)) return;   // schon von Hand gepflegt
      rowsEl.appendChild(createRowFromEvent(ev));
    });
  }
  function buildYearDivider(year, count, tpl, countTpl) {
    const row = document.createElement("div");
    row.className = "m-row bc-year";
    const label = (countTpl || "{n} Missionen").replace("{n}", count).replace(/^1 Missionen$/, "1 Mission");
    row.innerHTML = `<dt>${esc((tpl || "{year}").replace("{year}", year))}</dt><dd>${esc(label)}</dd>`;
    return row;
  }
  function buildTodayDivider(label) {
    const row = document.createElement("div");
    row.className = "m-row bc-today";
    row.innerHTML = `<dt>${esc(label || "Heute")}</dt><dd></dd>`;
    return row;
  }
  function rebuildTimelineOrder(rowsEl, pageData) {
    $$(".bc-year, .bc-today", rowsEl).forEach(el => el.remove());
    const rows = $$(".m-row[data-date]", rowsEl)
      .sort((a, b) => a.dataset.date < b.dataset.date ? -1 : a.dataset.date > b.dataset.date ? 1 : 0);
    const today = todayIso();
    const tl = pageData?.timeline || {};
    const yTpl = tl.yearDivider?.template, cTpl = tl.yearDivider?.countTemplate;
    const todayLabel = tl.todayDivider?.label || "Heute";
    let lastYear = null, todayInserted = false;
    rows.forEach(row => {
      if (!todayInserted && row.dataset.date >= today) {
        rowsEl.insertBefore(buildTodayDivider(todayLabel), row);
        todayInserted = true;
      }
      const year = row.dataset.date.slice(0, 4);
      if (year !== lastYear) {
        const count = rows.filter(r => r.dataset.date.slice(0, 4) === year).length;
        rowsEl.insertBefore(buildYearDivider(year, count, yTpl, cTpl), row);
        lastYear = year;
      }
      rowsEl.appendChild(row);   // an sortierte Position verschieben (appendChild bewegt bestehende Kinder)
    });
    if (!todayInserted) rowsEl.appendChild(buildTodayDivider(todayLabel));
  }
  let currentFilter = "all";
  function applyFilter(rowsEl, emptyEl, key) {
    currentFilter = key;
    const today = todayIso();
    let shown = 0;
    $$(".m-row[data-date]", rowsEl).forEach(row => {
      const isPast = row.dataset.date < today;
      const match = key === "all" || (key === "upcoming" && !isPast) || (key === "past" && isPast);
      row.hidden = !match;
      if (match) shown++;
    });
    $$(".bc-year, .bc-today", rowsEl).forEach(el => { el.hidden = key !== "all"; });
    if (emptyEl) emptyEl.hidden = shown !== 0;
  }
  function wireFilterBar(bar, rowsEl, emptyEl) {
    if (!bar) return;
    bar.addEventListener("click", e => {
      const btn = e.target.closest("[data-bc-filter]");
      if (!btn) return;
      $$("[data-bc-filter]", bar).forEach(b => {
        const active = b === btn;
        b.setAttribute("aria-pressed", String(active));
        b.classList.toggle("hot", active);
      });
      applyFilter(rowsEl, emptyEl, btn.dataset.bcFilter);
    });
  }
  function relabelFilterBar(bar, filters) {
    if (!bar || !Array.isArray(filters)) return;
    filters.forEach(f => {
      const btn = $(`[data-bc-filter="${cssEsc(f.key)}"]`, bar);
      if (btn && f.label) btn.textContent = f.label;
    });
  }

  /* ---------- Missions-Patch-Teaser: schreibgeschützter Blick auf den
     events.js-Patch-Log-Stand (localStorage), keine eigene Schreiblogik. -- */
  function renderPatchTeaser(container, pageData, pastCount) {
    if (!container) return;
    const link = $("[data-bc-patch-link]", container);
    if (!link) return;
    let collected = 0;
    try {
      const raw = JSON.parse(localStorage.getItem("takeoff-events-patchlog") || "[]");
      if (Array.isArray(raw)) collected = raw.length;
    } catch { /* bleibt 0 */ }
    const cfg = pageData?.patchTeaser || {};
    if (cfg.ctaHref) link.href = cfg.ctaHref;
    if (collected > 0 && Number.isFinite(pastCount) && pastCount > 0) {
      const tpl = cfg.template || "Du hast {count}/{total} Patches gesammelt →";
      link.textContent = tpl.replace("{count}", collected).replace("{total}", pastCount);
    } else {
      link.textContent = cfg.fallbackLabel || "Missions-Patches sammeln →";
    }
    container.hidden = false;
  }

  /* ============================================================
     7 · Monatsgitter "Wann geht's los" — nur Monate mit Terminen.
     ============================================================ */
  const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  function buildMonthCard(monthDate, events, eventLabel, todayLabelTxt, todayStr) {
    const year = monthDate.getFullYear(), month = monthDate.getMonth();
    const monthName = new Intl.DateTimeFormat("de-DE", { month: "long" }).format(monthDate);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;   // Montag = 0
    const byDay = new Map();
    events.forEach(ev => {
      const day = Number(ev.date.slice(8, 10));
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(ev);
    });
    let grid = "";
    for (let i = 0; i < firstDow; i++) grid += `<span class="bc-day is-pad" aria-hidden="true"></span>`;
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = `${year}-${pad(month + 1)}-${pad(day)}`;
      const dayEvents = byDay.get(day);
      const isToday = dayStr === todayStr;
      const cls = ["bc-day"];
      if (isToday) cls.push("is-today");
      if (dayEvents?.length) {
        cls.push("has-event");
        const titles = dayEvents.map(e => e.title).join(" · ");
        const label = `${day}. ${monthName}${isToday ? ` — ${todayLabelTxt}` : ""} — ${eventLabel}: ${titles}`;
        grid += `<a class="${cls.join(" ")}" href="#ev-${esc(dayEvents[0].slug || "")}" aria-label="${esc(label)}">${day}</a>`;
      } else if (isToday) {
        grid += `<span class="${cls.join(" ")}" aria-label="${esc(`${day}. ${monthName} — ${todayLabelTxt}`)}">${day}</span>`;
      } else {
        grid += `<span class="${cls.join(" ")}">${day}</span>`;
      }
    }
    const card = document.createElement("div");
    card.className = "bc-month";
    card.innerHTML =
      `<div class="bc-month-head"><b>${esc(monthName)}</b><span>${year}</span></div>` +
      `<div class="bc-weekdays" aria-hidden="true">${WEEKDAY_LABELS.map(w => `<span>${w}</span>`).join("")}</div>` +
      `<div class="bc-month-grid" aria-label="Kalender ${esc(monthName)} ${year}">${grid}</div>`;
    return card;
  }
  function buildMonthGrid(container, emptyEl, pageData, upcoming) {
    if (!container) return;
    const monthsAhead = Number.isFinite(pageData?.monthGrid?.monthsAhead) ? pageData.monthGrid.monthsAhead : 4;
    const eventLabel = pageData?.monthGrid?.eventLabel || "Mission";
    const todayLabelTxt = pageData?.monthGrid?.todayLabel || "Heute";
    const now = new Date();
    const byMonth = new Map();
    (upcoming || []).forEach(ev => {
      if (!ev.date) return;
      const key = ev.date.slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(ev);
    });
    const todayStr = todayIso();
    const cards = [];
    for (let i = 0; i < monthsAhead; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      const events = byMonth.get(key);
      if (!events?.length) continue;               // keine toten Monate
      cards.push(buildMonthCard(d, events, eventLabel, todayLabelTxt, todayStr));
    }
    container.innerHTML = "";
    cards.forEach(c => container.appendChild(c));
    container.hidden = cards.length === 0;
    if (emptyEl) {
      if (pageData?.monthGrid?.emptyMonthNote) emptyEl.textContent = pageData.monthGrid.emptyMonthNote;
      emptyEl.hidden = cards.length !== 0;
    }
  }

  /* ============================================================
     8 · Mini-Statistikband — mode:auto|manual, Muster wie kollektiv.json.
     ============================================================ */
  function renderStats(pageData, counts) {
    const cells = $$("#bc-stats > div");
    if (!cells.length) return;
    const items = Array.isArray(pageData?.stats?.items) ? pageData.stats.items : [];
    cells.forEach((cell, i) => {
      const item = items[i];
      if (!item) return;
      const val = item.mode === "manual" ? item.value : (item.key ? counts[item.key] : undefined);
      const b = $("b", cell), s = $("span", cell);
      if (b && val != null && val !== "") b.textContent = val;
      if (s && item.label) s.textContent = item.label;
    });
  }

  /* ============================================================
     9 · Venue-Kurzverzeichnis — aus upcoming() dedupliziert.
     ============================================================ */
  function renderVenues(container, pageData, upcoming) {
    if (!container || !Array.isArray(upcoming)) return;
    const notes = pageData?.venueNotes || {};
    const seen = new Map();
    upcoming.forEach(ev => {
      const v = ev.venue;
      if (!v?.name || seen.has(v.name)) return;
      seen.set(v.name, v);
    });
    seen.forEach((v, name) => {
      let card = $(`.bc-venue[data-venue-name="${cssEsc(name)}"]`, container);
      if (!card) {
        card = document.createElement("div");
        card.className = "bc-venue";
        card.dataset.venueName = name;
        card.innerHTML =
          `<div class="vcard"><span class="vname" translate="no"></span><span class="vaddr"></span><span class="vhint"></span></div>` +
          `<p class="bc-venue-note"></p>` +
          `<div class="route-row"><a class="btn btn-ghost" target="_blank" rel="noopener">Google Maps ↗</a></div>`;
        container.appendChild(card);
      }
      card.hidden = false;
      const nameEl = $(".vname", card); if (nameEl) nameEl.textContent = name;
      const addrEl = $(".vaddr", card); if (addrEl && v.address) addrEl.textContent = v.address;
      const hintEl = $(".vhint", card); if (hintEl && v.transit) hintEl.textContent = v.transit;
      const noteEl = $(".bc-venue-note", card);
      if (noteEl) {
        const note = notes[name];
        noteEl.textContent = note || "";
        noteEl.hidden = !note;
      }
      const mapsEl = $(".route-row a", card);
      const q = v.mapsQuery || v.address || name;
      if (mapsEl && q) mapsEl.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
    });
    $$(".bc-venue", container).forEach(card => { if (!seen.has(card.dataset.venueName)) card.hidden = true; });
  }

  /* ============================================================
     10 · FAQ — details.faq/.faq-body aus style.css (Muster 1:1 aus
     kontakt.js' renderFaq).
     ============================================================ */
  function renderFaq(list) {
    const wrap = $("#bc-faq-list");
    if (!wrap || !Array.isArray(list) || !list.length) return;
    wrap.innerHTML = list.map(item => `
      <details class="faq">
        <summary>${esc(item.q)}</summary>
        <div class="faq-body">${esc(item.a)}</div>
      </details>`).join("");
  }

  /* ============================================================
     11 · Teilen — Web-Share-API mit Zwischenablage-Fallback (Muster wie
     events.js' .m-share, eigener Hook statt der events.css-Klasse, die auf
     dieser Seite gar nicht geladen ist).
     ============================================================ */
  function wireShare(pageData) {
    const btn = $("[data-bc-share]");
    if (!btn) return;
    if (pageData?.share?.label) btn.textContent = pageData.share.label;
    const shareText = pageData?.share?.text || btn.dataset.shareText || document.title;
    const copiedMsg = pageData?.share?.copiedToast || "Link kopiert ✓";
    btn.addEventListener("click", async () => {
      const url = location.href.split("#")[0];
      if (navigator.share) {
        try { await navigator.share({ title: document.title, text: shareText, url }); return; }
        catch (err) { if (err && err.name === "AbortError") return; }
      }
      try { await navigator.clipboard.writeText(url); toast(copiedMsg); }
      catch { toast(url); }
    });
  }

  /* ============================================================
     12 · Statische Seiten-Texte hydrieren — NUR in Deutsch: die
     i18n-Runtime hat EN ggf. schon vor uns gesetzt (data-i18n auf
     denselben Elementen), bindText schriebe das sonst mit deutschem
     JSON-Text platt. Genau die Abwägung, die kontakt.js schon trifft.
     ============================================================ */
  function hydrateText(pageData) {
    if (!isGerman()) return;
    TakeoffData.bindText(main, pageData);
    const setHtml = (sel, html) => { const el = $(sel); if (el && html) el.innerHTML = html; };
    setHtml(".bc-phero h1", pageData.hero?.titleHtml);
    setHtml("#bc-months-h2", pageData.monthGrid?.titleHtml);
    setHtml("#bc-timeline-h2", pageData.timeline?.titleHtml);
    setHtml("#bc-venues-h2", pageData.venues?.titleHtml);
    setHtml("#bc-faq-h2", pageData.faqSection?.titleHtml);
    setHtml(".transmission p", pageData.howto?.textHtml);
  }

  /* ============================================================
     13 · Boot
     ============================================================ */
  async function boot() {
    const rowsEl = $("#bc-timeline-rows");
    const emptyEl = $("#bc-timeline-empty");
    const filterBar = $("#bc-filterbar");

    /* ---- Sofort, ohne Gateway: Uhr, Sweep, Deltas + Kalender-Aktionen aus
       dem statischen Markup (Rohdaten stehen schon in den data-*-Attributen
       jeder .m-row). ---- */
    startClock();
    syncSweep();
    if (rowsEl) {
      safe(rebuildTimelineOrder, rowsEl, null);
      safe(renderDeltas);
      safe(buildAllCalActions, {});
      safe(wireFilterBar, filterBar, rowsEl, emptyEl);
      safe(applyFilter, rowsEl, emptyEl, "all");
      setInterval(() => { if (!document.hidden) renderDeltas(); }, 60000);   // Tages/Stunden-Granularität reicht minütlich
    }
    wireIcsDelegation();
    safe(wireIcsAll);

    /* ---- Gateway: Text-Hydration, T-Minus/-Plus, fehlende Events
       ergänzen, Stats/Monatsgitter/Venues/FAQ/Teilen/Patch-Teaser. ---- */
    let pageData = null, upcoming = [], past = [], nextEv = null;
    const TD = window.TakeoffData;
    if (TD) {
      try {
        [pageData, upcoming, past, nextEv] = await Promise.all([
          TD.page("kalender"), TD.upcoming(), TD.past(), TD.nextEvent(),
        ]);
        const forcedSlug = pageData?.clock?.eventSlug;
        if (forcedSlug) { const forced = await TD.event(forcedSlug); if (forced) nextEv = forced; }
      } catch (err) {
        console.warn("[kalender] TakeoffData nicht ladbar — statisches Markup bleibt stehen.", err);
      }
    }

    if (pageData) safe(hydrateText, pageData);
    safe(primeCluster, pageData, nextEv, past?.[0]);

    const cal = pageData?.calendarActions || {};
    if (rowsEl && (upcoming?.length || past?.length)) {
      safe(reconcileTimelineRows, rowsEl, upcoming, past);
      safe(rebuildTimelineOrder, rowsEl, pageData);
      safe(renderDeltas);
      safe(buildAllCalActions, cal);
      safe(applyFilter, rowsEl, emptyEl, currentFilter);
    }
    safe(relabelFilterBar, filterBar, pageData?.timeline?.filters);
    if (cal.icsAllLabel) { const b = $("[data-bc-ics-all]"); if (b) b.textContent = cal.icsAllLabel; }

    safe(buildScale, upcoming);
    safe(buildMonthGrid, $("#bc-months"), $("#bc-months-empty"), pageData, upcoming);
    safe(renderVenues, $("#bc-venues"), pageData, upcoming);
    safe(renderFaq, pageData?.faq);
    safe(wireShare, pageData);

    const venueCount = new Set((upcoming || []).map(e => e.venue?.name).filter(Boolean)).size;
    safe(renderStats, pageData, {
      upcomingCount: Array.isArray(upcoming) ? upcoming.length : undefined,
      pastCount: Array.isArray(past) ? past.length : undefined,
      venueCount: venueCount || undefined,
    });
    safe(renderPatchTeaser, $("#bc-patch-teaser"), pageData, Array.isArray(past) ? past.length : undefined);
  }

  /* Live-Wechsel des FX-Tiers über das Mission-Control-Panel neu einregeln
     (Muster 1:1 aus kollektiv.js/kontakt.js). */
  new MutationObserver(() => { startClock(); syncSweep(); })
    .observe(html, { attributes: true, attributeFilter: ["data-fx"] });

  document.addEventListener("DOMContentLoaded", boot);
})();
