/* ============================================================
   Sprachumschaltung — Laufzeit

   Bewusst eine EIGENE Datei und nicht Teil von main.js: main.js ist eine
   geschlossene IIFE ohne Export, und an ihr arbeiten regelmaessig mehrere
   Leute gleichzeitig. Diese Datei haengt sich nur ueber das DOM ein und
   braucht nichts aus main.js.

   Vertrag im Markup (gesetzt ueber alle Seiten):
     data-i18n        -> ersetzt textContent
     data-i18n-html   -> ersetzt innerHTML (nur wo der Wert Markup enthaelt)
     data-i18n-aria   -> setzt aria-label
     data-i18n-title  -> setzt title
     data-set-lang    -> Schalter, wie die uebrigen data-set-*-Schalter
     <html data-lang-lock> -> Seite bleibt deutsch (Impressum, Datenschutz)

   Der deutsche Text steht weiterhin im HTML. Ohne JavaScript aendert sich
   dadurch nichts — genau das ist die Zusage, die der Prototyp seit jeher
   gibt.
   ============================================================ */
(function () {
  "use strict";

  var DICT = window.TAKEOFF_I18N;
  if (!DICT || !DICT.de || !DICT.en) return;      /* Woerterbuch fehlt: still aussteigen */

  var html = document.documentElement;
  var LANGS = ["de", "en"];
  var DEFAULT = "de";

  /* Storage darf nie das Skript killen — Safari Private Mode und
     Sandbox-iframes werfen hier. Gleiche Vorsichtsmassnahme wie in main.js,
     nur lokal, weil main.js nichts exportiert. */
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* egal */ } }
  };

  var locked = html.hasAttribute("data-lang-lock");

  function current() {
    var l = html.lang || DEFAULT;
    return LANGS.indexOf(l) === -1 ? DEFAULT : l;
  }

  /* Platzhalter der Form {name}. Werte, die einen Platzhalter enthalten, aber
     keine Variablen bekommen, werden NICHT gesetzt — sonst stuende woertlich
     "{time} Uhr" auf der Seite. Der bestehende Text bleibt dann stehen. */
  var VAR_RE = /\{(\w+)\}/g;
  function fill(str, vars) {
    if (str.indexOf("{") === -1) return str;
    if (!vars) return null;
    var missing = false;
    var out = str.replace(VAR_RE, function (_, k) {
      if (vars[k] === undefined) { missing = true; return "{" + k + "}"; }
      return vars[k];
    });
    return missing ? null : out;
  }

  function varsOf(el) {
    var raw = el.getAttribute("data-i18n-vars");
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  /* ---------- Deutsch aus dem Dokument ernten ----------
     Das Woerterbuch ist NICHT die Quelle fuer Deutsch — das HTML ist es.
     Gemessener Anlass: auf mehreren Seiten war der deutsche Text inzwischen
     ueberarbeitet worden, waehrend der Woerterbuch-Eintrag noch die aeltere
     Fassung trug. Ein Wechsel nach Englisch und zurueck haette den neueren
     Text still durch den aelteren ersetzt — stiller Textverlust, den
     niemand bemerkt haette. Auch typografische Anfuehrungszeichen waeren
     dabei durch gerade ersetzt worden.

     Deshalb wird beim Start einmal der Ist-Zustand jedes ausgezeichneten
     Knotens eingesammelt. Beim Zurueckschalten gewinnt dieser Wert; der
     Woerterbuch-Eintrag ist nur noch Rueckfall fuer Knoten, die es beim
     Start nicht gab (nachgeladene Inhalte). Damit ist die Rueckkehr nach
     Deutsch verlustfrei, unabhaengig davon, wie weit HTML und Woerterbuch
     auseinandergelaufen sind.

     Gespeichert wird PRO ELEMENT, nicht pro Schluessel: derselbe Schluessel
     steht an mehreren Stellen mit unterschiedlichem Inhalt — die
     Flight-Log-Nadeln heissen alle "a11y.flog.pin", tragen aber je einen
     eigenen Eventnamen im aria-label. Eine Ablage pro Schluessel haette das
     letzte Element ueber alle anderen geschrieben. */
  var HARVEST = new WeakMap();

  /* Wird bei JEDEM Verlassen des Deutschen aufgerufen, nicht nur beim Start.
     Grund: ein Teil der Inhalte wird nachtraeglich aus der Datenschicht
     gerendert (Eventkarten, Listen) und existiert beim Start noch gar
     nicht. Wer nur einmal erntet, hat fuer diese Knoten nichts und faellt
     auf das Woerterbuch zurueck — genau der stille Textverlust, den die
     Ernte verhindern soll. */
  function harvest() {
    var nodes = document.querySelectorAll("[data-i18n],[data-i18n-html],[data-i18n-aria],[data-i18n-title]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      HARVEST.set(el, {
        text:  el.hasAttribute("data-i18n")       ? el.textContent            : undefined,
        html:  el.hasAttribute("data-i18n-html")  ? el.innerHTML              : undefined,
        aria:  el.hasAttribute("data-i18n-aria")  ? el.getAttribute("aria-label") : undefined,
        title: el.hasAttribute("data-i18n-title") ? el.getAttribute("title")  : undefined
      });
    }
  }

  function value(key, lang, el, kind) {
    if (lang === DEFAULT) {
      var rec = HARVEST.get(el);
      var own = rec && rec[kind || "text"];
      if (own !== undefined && own !== null) return own;   /* Original schlaegt Woerterbuch */
    }
    var table = DICT[lang] || DICT[DEFAULT];
    var raw = table[key];
    if (raw === undefined) raw = DICT[DEFAULT][key];   /* Rueckfall auf Deutsch */
    if (raw === undefined) return null;                /* dann eben gar nichts */
    return fill(String(raw), varsOf(el));
  }

  /* ---------- Datum und Uhrzeit ----------
     Formate sind keine Uebersetzung. Jedes <time datetime="..."> wird neu
     formatiert; der deutsche Text im Element bleibt der Fallback ohne JS.
     Intl liefert von selbst 24h fuer de-DE und 12h mit AM/PM fuer en-US. */
  var TIME_STYLES = {
    weekday_short: { weekday: "short", day: "2-digit", month: "2-digit" },
    date_short:    { day: "2-digit", month: "2-digit" },
    date_full:     { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" },
    time:          { hour: "2-digit", minute: "2-digit" }
  };

  function applyTimes(lang) {
    var loc = lang === "en" ? "en-GB" : "de-DE";
    var nodes = document.querySelectorAll("time[datetime][data-time-style]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var style = TIME_STYLES[el.getAttribute("data-time-style")];
      if (!style) continue;
      var d = new Date(el.getAttribute("datetime"));
      if (isNaN(d)) continue;
      if (!el.hasAttribute("data-time-de")) el.setAttribute("data-time-de", el.textContent);
      /* Deutsch: den handgesetzten Originaltext zurueckgeben, nicht neu
         formatieren — er ist typografisch bewusst gewaehlt ("SA 12.09."). */
      el.textContent = lang === "de"
        ? el.getAttribute("data-time-de")
        : new Intl.DateTimeFormat(loc, style).format(d);
    }
  }

  /* ---------- Anwenden ---------- */
  function applyLang(lang, opts) {
    if (LANGS.indexOf(lang) === -1) lang = DEFAULT;
    if (locked) lang = DEFAULT;
    /* Solange noch Deutsch steht, ist der DOM die Wahrheit — jetzt sichern,
       bevor er ueberschrieben wird. */
    if (current() === DEFAULT) harvest();

    html.lang = lang;

    var n = 0, el, key, v, i;

    var text = document.querySelectorAll("[data-i18n]");
    for (i = 0; i < text.length; i++) {
      el = text[i]; key = el.getAttribute("data-i18n");
      v = value(key, lang, el, "text");
      if (v !== null && el.textContent !== v) { el.textContent = v; n++; }
    }

    var markup = document.querySelectorAll("[data-i18n-html]");
    for (i = 0; i < markup.length; i++) {
      el = markup[i]; key = el.getAttribute("data-i18n-html");
      v = value(key, lang, el, "html");
      if (v !== null && el.innerHTML !== v) { el.innerHTML = v; n++; }
    }

    var aria = document.querySelectorAll("[data-i18n-aria]");
    for (i = 0; i < aria.length; i++) {
      el = aria[i]; v = value(el.getAttribute("data-i18n-aria"), lang, el, "aria");
      if (v !== null) { el.setAttribute("aria-label", v); n++; }
    }

    var titles = document.querySelectorAll("[data-i18n-title]");
    for (i = 0; i < titles.length; i++) {
      el = titles[i]; v = value(el.getAttribute("data-i18n-title"), lang, el, "title");
      if (v !== null) { el.setAttribute("title", v); n++; }
    }

    applyTimes(lang);
    syncLangButtons(lang);

    /* Die Wortmarke und Event-Titel werden von main.js auf die Container-
       breite eingepasst (fitText). main.js exportiert nichts, haengt das
       Einpassen aber an resize — ein synthetisches resize ist deshalb der
       saubere Weg, es nach einem Sprachwechsel neu rechnen zu lassen.
       Ohne das steht der Titel nach dem Wechsel falsch skaliert. */
    if (!opts || !opts.initial) window.dispatchEvent(new Event("resize"));

    document.dispatchEvent(new CustomEvent("takeoff:lang", { detail: { lang: lang, applied: n } }));
    return n;
  }

  function syncLangButtons(lang) {
    var b = document.querySelectorAll("[data-set-lang]");
    for (var i = 0; i < b.length; i++) {
      b[i].setAttribute("aria-pressed", String(b[i].getAttribute("data-set-lang") === lang));
    }
  }

  /* ---------- Schalter ---------- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-set-lang]");
    if (!btn || locked) return;
    var lang = btn.getAttribute("data-set-lang");
    if (LANGS.indexOf(lang) === -1) return;
    store.set("takeoff-lang", lang);
    applyLang(lang);
    /* Ein offenes Overlay-Menue bleibt offen: der Wechsel ist kein
       Seitenwechsel, und es zuzuklappen wuerde die Auswahl verstecken. */
  });

  /* ---------- Start ----------
     Das Boot-Script im <head> hat lang bereits gestempelt (vor dem ersten
     Zeichnen, damit nichts aufblitzt). Hier wird nur noch der Text
     nachgezogen — und auch das nur, wenn ueberhaupt umgeschaltet ist.
     Bei Deutsch steht der richtige Text ja schon im HTML. */
  var start = current();
  if (start === DEFAULT) harvest();   /* Startzustand sichern */
  if (start !== DEFAULT) applyLang(start, { initial: true });
  else syncLangButtons(DEFAULT);

  window.TakeoffI18n = { apply: applyLang, current: current, dict: DICT };
})();
