/* ============================================================
   Hintergrundvideo im Hero — Laufzeit

   PLATZHALTER-MATERIAL. assets/video/hero-rave.{webm,mp4} und
   assets/img/hero-rave-poster.webp stammen von Mixkit (freie Lizenz, keine
   Namensnennung noetig) und sollen spaeter durch eigenes Material ersetzt
   werden. Ein Ersatz muss mitbringen: 16:9 (hier 1280x720), rund 8-12
   Sekunden, OHNE Tonspur, und nahtlos geschlossen (letzte Sekunde ueber den
   Anfang geblendet) — sonst springt die Schleife sichtbar. Beide Formate
   liefern (WebM/VP9 und MP4/H.264 mit faststart), dazu ein Poster als
   erstes Bild des Clips. Zielgroesse pro Datei unter 1,5 MB.

   Bewusst eine EIGENE Datei und nicht Teil von main.js — dasselbe Muster wie
   i18n-runtime.js: main.js ist eine geschlossene IIFE ohne Export, an der
   parallel gearbeitet wird. Diese Datei haengt sich nur ueber das DOM ein.

   Vertrag im Markup:
     .hero-video            leerer Container im Hero; wird hier gefuellt
     <html data-video>      "on" | "off", vom Boot-Script vorgestempelt
     data-set-video         Schalter, wie die uebrigen data-set-*-Schalter
     Schluessel im Storage  takeoff-video

   Ohne JavaScript passiert hier gar nichts: der Container bleibt leer, es
   wird keine einzige Datei angefordert, und der Hero sieht aus wie immer.
   ============================================================ */
(function () {
  "use strict";

  var html = document.documentElement;
  var wrap = document.querySelector(".hero-video");
  if (!wrap) return;                      /* nicht die Startseite: still aussteigen */

  var KEY = "takeoff-video";
  var POSTER = "assets/img/hero-rave-poster.webp";
  var SOURCES = [
    { src: "assets/video/hero-rave.webm", type: "video/webm" },
    { src: "assets/video/hero-rave.mp4",  type: "video/mp4"  }
  ];

  /* Storage darf nie das Skript killen — Safari Private Mode und
     Sandbox-iframes werfen hier. Gleiches Muster wie in main.js und
     i18n-runtime.js, nur lokal, weil main.js nichts exportiert. */
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* egal */ } }
  };

  var motionQuery = matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------- Darf ueberhaupt geladen werden? ----------
     Drei Sperren, und alle drei ueberstimmen die Nutzerwahl:

     · reduced motion — ein tanzendes Publikum ist genau die Art Bewegung,
       gegen die diese Einstellung existiert.
     · saveData — 1,4 MB sind kein Beiwerk, sondern das Vielfache der ganzen
       uebrigen Seite.
     · FX-Stufe "Aus" — die Seite hat eine durchdachte Abstufung nach Geraet
       und Netz. Ein Video, das sie unterlaeuft, macht sie wertlos. Diese
       Stufe wird auch vom FPS-Waechter in main.js gesetzt, wenn das Geraet
       einbricht; das Video geht dann von selbst mit aus.

     saveData und reduced-motion werden LIVE abgefragt, nicht beim Start
     gemerkt: das Boot-Script faltet sie zwar in die FX-Stufe, aber die
     FX-Schalter im Panel koennen die Stufe danach wieder anheben. */
  function allowed() {
    if (html.dataset.fx === "s") return false;
    if (motionQuery.matches) return false;
    var c = navigator.connection || {};
    if (c.saveData === true) return false;
    return true;
  }

  /* Voreinstellung ist AN: das Video ist der Grund, warum es diesen Schalter
     gibt. Wer es nicht will, schaltet es einmal ab — die Wahl haelt. */
  function pref() { return store.get(KEY) === "off" ? "off" : "on"; }
  function wanted() { return pref() === "on" && allowed(); }

  /* ---------- Das Element ----------
     Es wird ERST GEBAUT, wenn es gebraucht wird — nicht im HTML. Zwei
     Gruende: ohne JS soll nichts geladen werden, und das Video darf den
     kritischen Pfad (Schriften, CSS, main.js) nicht verstopfen. */
  var video = null;
  var inView = true;      /* der Hero steht beim Laden im Bild */

  function build() {
    if (video) return;
    video = document.createElement("video");
    /* Ohne muted UND playsinline verweigert jeder mobile Browser den
       Autostart — und zwar still, ohne Fehler: es bliebe schwarz.
       Beides doppelt setzen (Property und Attribut) ist kein Aberglaube:
       Safari wertet beim ersten Laden das Attribut aus, nicht die
       Property. */
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.loop = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("loop", "");
    video.setAttribute("aria-hidden", "true");
    video.setAttribute("tabindex", "-1");
    video.disablePictureInPicture = true;
    /* preload="auto": bewusst, aber erst zu diesem Zeitpunkt harmlos. Das
       Element entsteht nach dem load-Event im Leerlauf, der kritische Pfad
       ist da durch. Ab hier will man den Clip GANZ im Puffer haben — er
       laeuft in Schleife, und ein nachladender Ruckler alle 9 Sekunden
       waere deutlich teurer als die einmalige Uebertragung.
       "metadata" haette genau diesen Ruckler gebracht, "none" haette das
       Poster stehen lassen, bis irgendwer play() ruft. */
    video.preload = "auto";
    /* Das Poster ist das erste Bild des Clips. Dadurch ist der Wechsel vom
       Standbild zum laufenden Video unsichtbar. */
    video.poster = POSTER;

    for (var i = 0; i < SOURCES.length; i++) {
      var s = document.createElement("source");
      s.src = SOURCES[i].src;
      s.type = SOURCES[i].type;
      video.appendChild(s);
    }

    /* Aufblenden, sobald ueberhaupt etwas zu sehen ist. `loadeddata` ist der
       erste Zeitpunkt mit einem echten Videobild; kommt es nicht (Format
       nicht unterstuetzt, Netz weg), blendet der Fallback nach 1,2 s
       wenigstens das Poster auf. */
    var shown = false;
    var show = function () {
      if (shown) return;
      shown = true;
      wrap.classList.add("is-ready");
    };
    video.addEventListener("loadeddata", show, { once: true });
    setTimeout(show, 1200);

    /* Laesst sich das Video gar nicht abspielen, verschwindet die Ebene
       wieder vollstaendig — lieber der gewohnte Sternenhimmel als ein
       schwarzes Rechteck ueber dem halben Hero. */
    video.addEventListener("error", function () { teardown(); }, { once: true });

    wrap.appendChild(video);
    resume();
  }

  function teardown() {
    wrap.classList.remove("is-ready");
    if (!video) return;
    try { video.pause(); } catch (e) { /* egal */ }
    /* Quellen leeren und neu laden: erst dann gibt der Browser Decoder und
       Puffer frei. Ein blosses remove() laesst beides haengen. */
    while (video.firstChild) video.removeChild(video.firstChild);
    video.removeAttribute("src");
    try { video.load(); } catch (e) { /* egal */ }
    if (video.parentNode) video.parentNode.removeChild(video);
    video = null;
  }

  /* ---------- Abspielen nur, wenn es jemand sieht ----------
     Ein Video, das unsichtbar weiterlaeuft, kostet Akku ohne Gegenwert.
     Zwei Gruende zu pausieren: der Hero ist weggescrollt, oder der Tab liegt
     im Hintergrund. */
  function resume() {
    if (!video || !inView || document.hidden || !wanted()) return;
    var p = video.play();
    /* play() gibt ein Promise zurueck, das der Browser ablehnt, wenn er den
       Autostart verweigert. Unbehandelt steht das als Fehler in der Konsole
       jeder Seite. */
    if (p && p.catch) p.catch(function () { /* dann eben nicht */ });
  }
  function halt() {
    if (video) { try { video.pause(); } catch (e) { /* egal */ } }
  }

  /* Wieviel vom Hero noch im Bild steht, entscheidet ausserdem darueber, ob
     der Boden (Mars-/Strandhorizont) sichtbar sein darf — siehe die Regel zu
     `hv-cover` in hero-video.css. Der Beobachter liefert das Verhaeltnis
     gratis mit; ein Scroll-Listener mit getBoundingClientRect waere dieselbe
     Auskunft gegen Layout-Kosten in jedem Bild gewesen.
     0.55 ist bewusst kein knapper Wert: darunter ist der Hero so weit
     weggescrollt, dass der Boden gebraucht wird, bevor die naechste Sektion
     ganz steht. */
  var COVER_AT = 0.55;
  function setCover(on) {
    html.classList.toggle("hv-cover", on && html.dataset.video === "on");
  }
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        inView = e.isIntersecting;
        setCover(e.intersectionRatio >= COVER_AT);
        if (inView) resume(); else halt();
      }
    }, { threshold: [0, .3, COVER_AT, .8, 1] }).observe(wrap);
  } else {
    setCover(true);   /* ohne Beobachter lieber dauerhaft decken als flackern */
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) halt(); else resume();
  });

  /* ---------- Zustand anwenden ---------- */
  function apply(opts) {
    var on = wanted();
    html.dataset.video = on ? "on" : "off";
    if (on) {
      /* Beim Start nicht sofort: erst laden lassen, was die Seite
         ausmacht. Nach einem Klick dagegen sofort — dort wartet jemand. */
      if (opts && opts.initial) whenIdle(build); else build();
    } else {
      teardown();
      html.classList.remove("hv-cover");
    }
    syncButtons();
    document.dispatchEvent(new CustomEvent("takeoff:video", { detail: { on: on } }));
  }

  function whenIdle(fn) {
    var go = function () {
      if (window.requestIdleCallback) requestIdleCallback(fn, { timeout: 2000 });
      else setTimeout(fn, 300);
    };
    if (document.readyState === "complete") go();
    else addEventListener("load", go, { once: true });
  }

  /* ---------- Schalter ----------
     Exakt der Vertrag der uebrigen: data-set-video + aria-pressed. Ist das
     Laden gesperrt (reduced motion, Datensparmodus, Stufe "Aus"), wird die
     Zeile deaktiviert statt entfernt — genauso wie die Boden-Zeile bei
     Theme "space". Ein Bedienelement, das verschwindet, laesst das Panel
     springen. */
  function syncButtons() {
    var on = html.dataset.video === "on";
    var off = !allowed();
    var b = document.querySelectorAll("[data-set-video]");
    for (var i = 0; i < b.length; i++) {
      b[i].setAttribute("aria-pressed", String((b[i].getAttribute("data-set-video") === "on") === on));
      b[i].disabled = off;
      var row = b[i].closest ? b[i].closest(".row") : null;
      if (row) row.classList.toggle("is-off", off);
    }
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("[data-set-video]");
    if (!btn || btn.disabled) return;
    store.set(KEY, btn.getAttribute("data-set-video") === "on" ? "on" : "off");
    apply();
  });

  /* ---------- Fremde Zustandswechsel nachziehen ----------
     Die FX-Stufe kann sich ohne unser Zutun aendern: ueber das Panel oder
     ueber den FPS-Waechter in main.js, der bei anhaltend langsamen Bildern
     selbsttaetig herunterstuft. main.js exportiert nichts und ruft uns nicht;
     das Attribut auf <html> ist die gemeinsame Schnittstelle, die es gibt. */
  new MutationObserver(function () {
    var soll = wanted();
    if (soll !== (html.dataset.video === "on")) apply();
    else syncButtons();
  }).observe(html, { attributes: true, attributeFilter: ["data-fx"] });

  /* Systemeinstellung kann sich waehrend der Sitzung aendern */
  motionQuery.addEventListener("change", function () { apply(); });

  /* ---------- Start ----------
     Das Boot-Script im <head> hat data-video bereits gestempelt, vor dem
     ersten Zeichnen — sonst saehe man beim Laden kurz den falschen Zustand.
     Hier wird nur noch das Element nachgereicht. */
  apply({ initial: true });
})();
