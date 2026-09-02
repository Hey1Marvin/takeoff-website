#!/usr/bin/env python3
"""Generiert die It.-8-Unterseiten aus einem gemeinsamen Shell-Template.
Aufruf:  python3 tools/gen-pages.py   (aus dem prototype/-Ordner)
Bewusst NICHT generiert: index.html (eingefroren), events/artists/kollektiv/
awareness.html (It. 7, handgepflegt), event-marsmission.html (It. 6)."""
import os

os.chdir(os.path.join(os.path.dirname(__file__), ".."))

SHELL = """<!doctype html>
<html lang="de"{THEME}>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>
  (function () {{
    var h = document.documentElement;
    h.classList.add("js");
    var get = function (k) {{ try {{ return localStorage.getItem(k); }} catch (e) {{ return null; }} }};
    var c = navigator.connection || {{}};
    var mem = navigator.deviceMemory, cores = navigator.hardwareConcurrency;
    var tier = "m";
    if (mem !== undefined && cores !== undefined && mem > 4 && cores > 4) tier = "l";
    var stored = get("takeoff-fx");
    if (stored === "s" || stored === "m" || stored === "l") tier = stored;
    if (c.saveData === true) tier = "s";
    if (/(^|\\b)(slow-2g|2g|3g)\\b/.test(c.effectiveType || "")) tier = "s";
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) tier = "s";
    h.dataset.fx = tier;
    var th = get("takeoff-theme");
    if (!h.dataset.theme && th && th !== "space") h.dataset.theme = th;
  }})();
  </script>
  <title>{TITLE}</title>
  <meta name="description" content="{DESC}">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>">
  <link rel="stylesheet" href="assets/css/style.css">
  <noscript><style>#stars{{display:none!important}}.nav-progress{{display:none!important}}.marquee-track,.band-track{{animation:none!important}}</style></noscript>
</head>
<body{BODYATTR}>
  <a class="skip-link" href="#main">Zum Inhalt springen</a>
  <canvas id="stars" aria-hidden="true"></canvas>

  <div class="topbar" role="banner">
    <div class="hud">
      <span class="dot" aria-hidden="true"></span>
      <div class="marquee" aria-label="Nächste Events">
        <div class="marquee-track">
          <span>NEXT LAUNCH → <b>SA 12.09.</b> OPEN AIR „FREIRÄUME" · BASTION AM SCHILLERPLATZ · <em>16:00</em> · FREE</span>
          <span><b>SA 19.09.</b> TAKEOFF: MARSMISSION · SPARTACUS · <em>23:00</em> · FREE ENTRY</span>
          <span><b>SA 14.11.</b> TAKEOFF: STRANDPARTY · SPARTACUS · <em>TBA</em></span>
          <span>NEXT LAUNCH → <b>SA 12.09.</b> OPEN AIR „FREIRÄUME" · BASTION AM SCHILLERPLATZ · <em>16:00</em> · FREE</span>
          <span><b>SA 19.09.</b> TAKEOFF: MARSMISSION · SPARTACUS · <em>23:00</em> · FREE ENTRY</span>
          <span><b>SA 14.11.</b> TAKEOFF: STRANDPARTY · SPARTACUS · <em>TBA</em></span>
        </div>
      </div>
      <a class="hud-link" href="https://t.me/takeoffpotsdam" target="_blank" rel="noopener">TELEGRAM ↗</a>
    </div>
    <header class="nav">
      <a class="nav-brand" href="index.html" aria-label="takeoff — zur Startseite">takeoff</a>
      <nav class="nav-links" aria-label="Hauptnavigation">
        <ul>
          <li><a href="events.html"{CUR_events}>Events</a></li>
          <li><a href="artists.html"{CUR_artists}>Artists</a></li>
          <li><a href="kollektiv.html"{CUR_kollektiv}>Kollektiv</a></li>
          <li><a href="awareness.html"{CUR_awareness}>Awareness</a></li>
        </ul>
      </nav>
      <a class="nav-status" href="event-marsmission.html">
        <span class="st-tag">Free</span><span class="st-date">Sa 12.09.</span>
      </a>
      <button class="nav-burger" type="button" aria-expanded="false" aria-controls="menu" aria-label="Menü öffnen">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path class="b-line" d="M2 6h16"/><path class="b-line" d="M2 14h16"/></svg>
        <span>Menü</span>
      </button>
    </header>
  </div>

  <dialog class="menu" id="menu" aria-label="Menü">
    <div class="menu-inner">
      <p class="menu-eyebrow">Bordcomputer · Navigation</p>
      <ul class="menu-list">
        <li><a href="events.html"><span class="m-label">Events</span> <span class="m-note">3 geplant</span></a></li>
        <li><a href="artists.html"><span class="m-label">Artists</span> <span class="m-note">Sets &amp; Podcasts</span></a></li>
        <li><a href="kollektiv.html"><span class="m-label">Kollektiv</span> <span class="m-note">Wer hier funkt</span></a></li>
        <li><a href="awareness.html"><span class="m-label">Awareness</span> <span class="m-note">Hilfe &amp; Regeln</span></a></li>
        <li><a href="news.html"><span class="m-label">News</span> <span class="m-note">Mission Log</span></a></li>
        <li><a href="kalender.html"><span class="m-label">Kalender</span> <span class="m-note">Abo &amp; Termine</span></a></li>
        <li><a href="kontakt.html"><span class="m-label">Kontakt</span> <span class="m-note">Schreib uns</span></a></li>
      </ul>
      <a class="menu-next" href="event-marsmission.html">
        <span>
          <span class="mn-when">Next Launch · Sa 12.09.</span>
          <span class="mn-title">Open Air: Freiräume</span>
          <span class="mn-where">Bastion am Schillerplatz · 16 Uhr · Free</span>
        </span>
        <span class="mn-go">Ansehen →</span>
      </a>
      <div class="menu-social">
        <a href="https://www.instagram.com/takeoff.potsdam/" target="_blank" rel="noopener">Instagram</a>
        <a href="https://t.me/takeoffpotsdam" target="_blank" rel="noopener">Telegram</a>
        <a href="https://soundcloud.com/takeoff-potsdam" target="_blank" rel="noopener">SoundCloud</a>
        <a href="mailto:info@takeoff-potsdam.de">info@takeoff-potsdam.de</a>
      </div>
      <button class="menu-close" type="button">Schließen</button>
    </div>
  </dialog>

  <main id="main">
{MAIN}
  </main>

  <footer>
    <div class="wrap">
      <div class="foot-grid">
        <div>
          <h4>Kanäle</h4>
          <ul>
            <li><a href="https://www.instagram.com/takeoff.potsdam/" target="_blank" rel="noopener">Instagram ↗</a></li>
            <li><a href="https://t.me/takeoffpotsdam" target="_blank" rel="noopener">Telegram ↗</a></li>
            <li><a href="https://soundcloud.com/takeoff-potsdam" target="_blank" rel="noopener">SoundCloud ↗</a></li>
            <li><a href="https://www.tiktok.com/@takeoff.potsdam" target="_blank" rel="noopener">TikTok ↗</a></li>
          </ul>
        </div>
        <div>
          <h4>Kollektiv</h4>
          <ul>
            <li><a href="kollektiv.html">Über uns</a></li>
            <li><a href="team.html">Team</a></li>
            <li><a href="news.html">News / Mission Log</a></li>
            <li><a href="kalender.html">Eventkalender</a></li>
            <li><a href="awareness.html">Awareness-Konzept</a></li>
            <li><a href="kollektiv.html#mitmachen">Mitmachen</a></li>
          </ul>
        </div>
        <div>
          <h4>Kontakt</h4>
          <ul>
            <li><a href="kontakt.html">Kontakt</a></li>
            <li><a href="mailto:info@takeoff-potsdam.de">info@takeoff-potsdam.de</a></li>
            <li><a href="impressum.html">Impressum</a></li>
            <li><a href="datenschutz.html">Datenschutz</a></li>
          </ul>
          <p class="no-track">🛰️ Diese Seite trackt dich nicht</p>
        </div>
      </div>
      <p class="love">Viel Liebe, euer takeoff Team <b>♥</b></p>
      <p class="proto-note">DESIGN-PROTOTYP · IT 8 · NICHTS HIER IST FINAL · INHALTE TEILS PLATZHALTER</p>
    </div>
  </footer>

  <div class="mctrl" role="group" aria-label="Darstellungs-Einstellungen">
    <div class="row">
      <span class="lbl">FX</span>
      <button type="button" data-set-fx="s" aria-pressed="false" title="Statisch — spart Akku &amp; Daten">Aus</button>
      <button type="button" data-set-fx="m" aria-pressed="false" title="Standard">Normal</button>
      <button type="button" data-set-fx="l" aria-pressed="false" title="Volle Show">Voll</button>
    </div>
    <div class="row">
      <span class="lbl">Theme</span>
      <button type="button" data-set-theme="space" aria-pressed="false">Space</button>
      <button type="button" data-set-theme="mars" aria-pressed="false">Mars</button>
      <button type="button" data-set-theme="strand" aria-pressed="false">Strand</button>
    </div>
  </div>

  <script defer src="assets/vendor/gsap.min.js"></script>
  <script defer src="assets/vendor/ScrollTrigger.min.js"></script>
  <script defer src="assets/vendor/lenis.min.js"></script>
  <script defer src="assets/js/main.js"></script>
</body>
</html>
"""

CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>'


def phero(eyebrow, h1, intro):
    return f'''    <section class="phero">
      <div class="wrap">
        <p class="eyebrow">{eyebrow}</p>
        <h1>{h1}</h1>
        <p class="section-intro">{intro}</p>
      </div>
    </section>
'''


def artist_page(slug, initials, name, genres, facts, brief, appearances, set_title, set_meta):
    rows = "\n".join(
        f'            <div class="m-row"><dt>{k}</dt><dd>{v}</dd></div>' for k, v in facts)
    apps = "\n".join(
        f'          <li><span class="fpatch" aria-hidden="true">{p}</span><span class="fdate">{d}</span><span class="fname">{n}</span><span class="fvenue">{v}</span></li>'
        for p, d, n, v in appearances)
    return {
        "file": f"artist-{slug}.html",
        "title": f"{name} · Artist · takeoff potsdam",
        "desc": f"{name} — {genres} bei takeoff.",
        "current": "artists",
        "main": f'''    <section class="phero">
      <div class="wrap" style="display:flex; flex-wrap:wrap; align-items:center; gap:26px">
        <div class="avatar ccard-solo" style="width:96px;height:96px;border-radius:50%;display:grid;place-items:center;font-family:var(--font-display);font-weight:700;font-size:26px;color:var(--ink);background:radial-gradient(circle at 30% 25%, rgb(255 255 255 / .09), rgb(11 9 24 / .95) 65%);border:1px solid rgb(255 255 255 / .22);box-shadow:inset 0 0 0 3px rgb(var(--acc-2-rgb) / .16)" aria-hidden="true">{initials}</div>
        <div>
          <p class="eyebrow">Artist</p>
          <h1>{name}</h1>
          <p class="section-intro" style="margin-top:8px">{genres}</p>
        </div>
      </div>
    </section>

    <section class="section" style="padding-top: clamp(24px, 4vh, 40px)">
      <div class="wrap" style="max-width: 760px">
        <dl class="m-rows reveal" style="border-top: 1px solid var(--bg-hairline)">
{rows}
        </dl>
        <p class="section-intro reveal" style="margin-top:18px">{brief}</p>
      </div>
    </section>

    <section class="section" style="padding-top: 0">
      <div class="wrap">
        <header class="section-head reveal"><p class="eyebrow">Hören</p><h2 class="h2">Sets</h2></header>
        <div class="setgrid" style="max-width:520px">
          <button class="setcard" type="button" aria-label="Set abspielen">
            <span class="cover"><span class="play" aria-hidden="true">▶</span></span>
            <span class="s-meta"><b>{set_title}</b><span>{set_meta}</span></span>
            <span class="consent-note">Demo: Hier würde jetzt der Player laden (Zwei-Klick, DSGVO-freundlich).</span>
          </button>
        </div>
        <div class="cta-row" style="margin-top:20px">
          <a class="btn btn-ghost" href="https://soundcloud.com/takeoff-potsdam" target="_blank" rel="noopener">SoundCloud ↗</a>
          <a class="btn btn-ghost" href="artists.html">← Alle Artists</a>
        </div>
      </div>
    </section>

    <section class="section" style="padding-top: 0">
      <div class="wrap">
        <header class="section-head reveal"><p class="eyebrow">Flight Log</p><h2 class="h2">Bei takeoff <span class="glow">gespielt</span></h2></header>
        <ul class="flog">
{apps}
        </ul>
      </div>
    </section>
''',
    }


PAGES = [
    # ---------- Kontakt ----------
    {
        "file": "kontakt.html",
        "title": "Kontakt · takeoff potsdam",
        "desc": "Schreib uns — allgemein, Booking, Presse, Awareness oder Fundsachen.",
        "current": None,
        "main": phero("Funkkontakt", 'Sag <span class="glow">Hallo</span>.',
                      "Ein Postfach, echte Menschen dahinter. Wir sind ehrenamtlich — gib uns ein paar Tage, dann kommt was zurück. Für schnelle Fragen rund um Events ist Telegram der Turbo.")
        + '''    <section class="section" style="padding-top: clamp(24px, 4vh, 40px)">
      <div class="wrap" style="max-width: 760px">
        <dl class="m-rows reveal" style="border-top: 1px solid var(--bg-hairline)">
          <div class="m-row"><dt>Allgemein</dt><dd><b><a href="mailto:info@takeoff-potsdam.de" style="color:var(--ink)">info@takeoff-potsdam.de</a></b></dd></div>
          <div class="m-row"><dt>Booking / Artists</dt><dd>Demo-Link oder Anfrage per Mail — Betreff „Booking"</dd></div>
          <div class="m-row"><dt>Presse / Partner</dt><dd>Mail mit Betreff „Presse" · Presskit folgt</dd></div>
          <div class="m-row"><dt>Awareness</dt><dd>Ist auf einem Event etwas passiert? Schreib uns — wir lesen sensibel und vertraulich.</dd></div>
          <div class="m-row"><dt>Fundsachen</dt><dd>Was liegen geblieben? Sag uns Event + Beschreibung.</dd></div>
          <div class="m-row"><dt>Schnell</dt><dd><b><a href="https://t.me/takeoffpotsdam" target="_blank" rel="noopener" style="color:var(--ink)">Telegram-Gruppe ↗</a></b> — Fragen einfach reinschreiben</dd></div>
        </dl>
        <div class="cta-row reveal" style="margin-top: 24px">
          <a class="btn btn-primary" href="mailto:info@takeoff-potsdam.de">Mail schreiben</a>
          <a class="btn btn-ghost" href="https://t.me/takeoffpotsdam" target="_blank" rel="noopener">Telegram öffnen</a>
        </div>
      </div>
    </section>
''',
    },
    # ---------- News / Mission Log ----------
    {
        "file": "news.html",
        "title": "News · Mission Log · takeoff potsdam",
        "desc": "Was bei takeoff passiert: Baulogs, Ankündigungen, Recaps und Podcast-Releases.",
        "current": None,
        "main": phero("Mission Log", 'Was gerade <span class="glow">passiert</span>',
                      "Kein Blog, kein Geschwafel — kurze Funksprüche aus der Werkstatt und von den Floors. Ausführliche Posts gibt's auf Instagram, hier verlinkt.")
        + '''    <section class="section" style="padding-top: clamp(24px, 4vh, 40px)">
      <div class="wrap">
        <div class="news-list">
          <article class="ncard reveal" style="--n-acc: 111 201 232">
            <div class="n-head"><span class="n-badge">Announcement</span><span class="n-date">23.08.2026</span></div>
            <h3>Genehmigung ist da — Open Air „Freiräume" am 12.09.! 🎉</h3>
            <p>Die Stadt hat die Fläche an der Bastion am Schillerplatz bestätigt. 16–22 Uhr, free, mit Schranzverbot &amp; Stadtjugendring.</p>
            <button class="n-insta" type="button">Instagram-Post ansehen · lädt erst nach Klick</button>
          </article>
          <article class="ncard reveal" style="--n-acc: 232 90 52">
            <div class="n-head"><span class="n-badge">Baulog</span><span class="n-date">13.08.2026</span></div>
            <h3>Der Mars nimmt Form an</h3>
            <p>Hühnerdraht, Kleister, Schwarzlichtfarbe: Unser Planet für die Marsmission ist im Bau. Materialkosten: ~20 €. Künstlerische Freiheit: unbezahlbar.</p>
          </article>
          <article class="ncard reveal" style="--n-acc: 224 79 180">
            <div class="n-head"><span class="n-badge">Recap</span><span class="n-date">28.06.2026</span></div>
            <h3>Pride-Party: 40 °C, Sturm — und trotzdem die beste Nacht</h3>
            <p>Demo abgesagt, Party nicht. Drei Floors im KuZe, Sonnensegel-Krimi inklusive. Danke an alle, die da waren und aufeinander aufgepasst haben. ♥</p>
            <button class="n-insta" type="button">Instagram-Recap ansehen · lädt erst nach Klick</button>
          </article>
          <article class="ncard reveal" style="--n-acc: 161 143 224">
            <div class="n-head"><span class="n-badge">Podcast</span><span class="n-date">05.08.2025</span></div>
            <h3>„JOJO | takeoff" — Folge 1 ist draußen</h3>
            <p>Unsere Podcast-Serie startet: für alle, die ihre Ohren in exquisitem Trance baden wollen. Auf YouTube &amp; SoundCloud.</p>
          </article>
          <article class="ncard reveal" style="--n-acc: 229 194 92">
            <div class="n-head"><span class="n-badge">Baulog</span><span class="n-date">2024–2025</span></div>
            <h3>Vom ersten Subwoofer zur eigenen Anlage</h3>
            <p>Erst ein Sub, dann zwei Hörner, dann noch ein Sub — Stück für Stück selbst gebaut, bis der Keller wackelte. Die ganze Geschichte steht im <a href="kollektiv.html#history" style="color:var(--acc-3-tint)">Kollektiv-Log</a>.</p>
          </article>
        </div>
        <div class="transmission reveal" style="margin-top: 28px">
          <span class="tx-label">Hinweis</span>
          <p>Instagram-Posts laden erst nach Klick (Zwei-Klick, DSGVO-freundlich) — im Prototyp als Demo-Knopf. Neue Einträge kommen später direkt aus dem Admin-Dashboard.</p>
        </div>
      </div>
    </section>
''',
    },
    # ---------- Kalender ----------
    {
        "file": "kalender.html",
        "title": "Eventkalender · takeoff potsdam",
        "desc": "Alle takeoff-Termine — einmal abonnieren, nie wieder ein Event verpassen.",
        "current": "events",
        "main": phero("Immer aktuell", 'Der <span class="glow">Eventkalender</span>',
                      "Einmal abonnieren, für immer aktuell: Der Kalender-Feed aktualisiert sich selbst, wenn wir Termine ändern — in Google Kalender, Apple Kalender und Outlook.")
        + '''    <section class="section" style="padding-top: clamp(24px, 4vh, 40px)">
      <div class="wrap" style="max-width: 760px">
        <dl class="m-rows reveal" style="border-top: 1px solid var(--bg-hairline)">
          <div class="m-row"><dt>Sa 12.09.</dt><dd><b>Open Air: Freiräume</b> · Bastion am Schillerplatz · 16–22 Uhr · Free · <a href="event-freiraeume.html" style="color:var(--acc-3-tint)">Details</a></dd></div>
          <div class="m-row"><dt>Sa 19.09.</dt><dd><b>takeoff: Marsmission</b> · Spartacus · ab 23 Uhr · Free Entry · 18+ · <a href="event-marsmission.html" style="color:var(--acc-3-tint)">Details</a></dd></div>
          <div class="m-row"><dt>Sa 14.11.</dt><dd><b>takeoff: Strandparty</b> · Spartacus · TBA 🤫</dd></div>
        </dl>
        <div class="cta-row reveal" style="margin-top: 26px">
          <a class="btn btn-primary" href="#" onclick="return false" title="Demo — echter Feed kommt mit dem Backend">＋ Kalender abonnieren (webcal)</a>
          <a class="btn btn-ghost" href="#" onclick="return false" title="Demo">Einzeltermin als .ics</a>
        </div>
        <div class="transmission reveal" style="margin-top: 30px">
          <span class="tx-label">So funktioniert das Abo</span>
          <p><b>Google Kalender:</b> Einstellungen → „Kalender hinzufügen" → „Per URL" → unsere Feed-Adresse einfügen. <b>iPhone/Mac &amp; Outlook:</b> webcal-Link antippen, fertig. Danach erscheinen neue takeoff-Termine automatisch bei dir — ohne dass du irgendwas tun musst. (Im Prototyp Demo; der echte Feed wird automatisch aus der Event-Datenbank erzeugt.)</p>
        </div>
      </div>
    </section>
''',
    },
    # ---------- Team ----------
    {
        "file": "team.html",
        "title": "Team · takeoff potsdam",
        "desc": "Wer bei takeoff was macht — DJs, Licht, Deko, Awareness, Sani, Orga.",
        "current": "kollektiv",
        "main": phero("Teamboard", 'Die <span class="glow">Crew</span>',
                      "takeoff ist Kollektivarbeit: Jede Nacht entsteht aus vielen Händen. Fotos folgen, sobald alle einverstanden sind — bis dahin: Rollen &amp; Aufgaben.")
        + '''    <section class="section" style="padding-top: clamp(24px, 4vh, 40px)">
      <div class="wrap">
        <div class="crewgrid">
          <div class="ccard"><div class="avatar">NI</div><b>Nico · DJ Platzhalter</b><span>Mitgründer · Orga · DJ</span></div>
          <div class="ccard"><div class="avatar">MI</div><b>Mik · Blaulicht</b><span>Lichttechnik · DMX · DJ</span></div>
          <div class="ccard"><div class="avatar">JO</div><b>JOJO</b><span>DJ · Resident</span></div>
          <div class="ccard"><div class="avatar">CY</div><b>Cyonic</b><span>DJ · seit Tag 1</span></div>
          <div class="ccard"><div class="avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 20s-7.2-4.6-9.2-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.2 11c-2 4.4-9.2 9-9.2 9z"/></svg></div><b>Awareness-Team</b><span>Lila Westen · ansprechbar</span></div>
          <div class="ccard"><div class="avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 8.5v7M8.5 12h7"/></svg></div><b>Sani-Team</b><span>Ersthelfer*innen · im Umlauf</span></div>
          <div class="ccard"><div class="avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M13 3 5.5 13.5H11L9.5 21 17.5 10H12z"/></svg></div><b>Deko &amp; Bau</b><span>Requisiten · Motto-Welten</span></div>
          <div class="ccard"><div class="avatar">♥</div><b>Bar &amp; Einlass</b><span>Schicht-Crews · jede Nacht</span></div>
        </div>
        <div class="transmission reveal" style="margin-top: 30px">
          <span class="tx-label">Foto-Board folgt</span>
          <p>Das Team-Fotoboard kommt, sobald alle Abgebildeten zugestimmt haben — Consent gilt auch für uns selbst. Du willst aufs Board? <a href="kollektiv.html#mitmachen" style="color:var(--acc-3-tint)">Mach mit.</a></p>
        </div>
      </div>
    </section>
''',
    },
    # ---------- Musik ----------
    {
        "file": "musik.html",
        "title": "Unser Sound · takeoff potsdam",
        "desc": "Trance, Hard Trance, Bounce — was das ist und wie es klingt.",
        "current": "artists",
        "main": phero("Frequenzkunde", 'Was läuft hier <span class="glow">eigentlich</span>?',
                      "Nie von Hard Bounce gehört? Macht nichts — dafür gibt's diese Seite. Drei Minuten Lesezeit, dann weißt du, was dich auf dem Floor erwartet.")
        + '''    <section class="section" style="padding-top: clamp(24px, 4vh, 40px)">
      <div class="wrap" style="max-width: 800px">
        <dl class="m-rows reveal" style="border-top: 1px solid var(--bg-hairline)">
          <div class="m-row"><dt>Trance</dt><dd>Hypnotische Melodien, lange Spannungsbögen, Gänsehaut-Momente. <b>~138 BPM</b> · das Herz von takeoff</dd></div>
          <div class="m-row"><dt>Hard Trance</dt><dd>Trance mit Schub: härtere Kicks, treibender, euphorischer. <b>~145 BPM</b></dd></div>
          <div class="m-row"><dt>Bounce / Hard Bounce</dt><dd>Federnde Offbeat-Bässe, gute Laune mit Wumms. <b>~150 BPM</b></dd></div>
          <div class="m-row"><dt>Techno</dt><dd>Der gerade, dunkle Puls — bei uns als Gastgeschenk befreundeter Kollektive</dd></div>
          <div class="m-row"><dt>Psytrance</dt><dd>Wenn's spät wird und die Muster tanzen. Gelegentlich, mit Liebe</dd></div>
        </dl>
        <p class="section-intro reveal" style="margin-top: 22px">Reinhören? Auf der <a href="artists.html" style="color:var(--acc-3-tint)">Artists-Seite</a> liegen Sets aus echten takeoff-Nächten — und der „| takeoff"-Podcast liefert Nachschub.</p>
      </div>
    </section>
''',
    },
    # ---------- Impressum ----------
    {
        "file": "impressum.html",
        "title": "Impressum · takeoff potsdam",
        "desc": "Anbieterkennzeichnung der takeoff-Website.",
        "current": None,
        "main": phero("Rechtliches", "Impressum",
                      "Pflichtangaben nach §5 TMG / §18 MStV. (Prototyp: Platzhalter, bis die Rechtsform geklärt ist.)")
        + '''    <section class="section" style="padding-top: clamp(24px, 4vh, 40px)">
      <div class="wrap" style="max-width: 720px">
        <dl class="m-rows reveal" style="border-top: 1px solid var(--bg-hairline)">
          <div class="m-row"><dt>Anbieter</dt><dd><b>takeoff Kollektiv</b> — Rechtsform in Klärung <span style="opacity:.6">[Platzhalter]</span></dd></div>
          <div class="m-row"><dt>Anschrift</dt><dd>c/o [wird ergänzt] · Potsdam</dd></div>
          <div class="m-row"><dt>Kontakt</dt><dd><a href="mailto:info@takeoff-potsdam.de" style="color:var(--ink)">info@takeoff-potsdam.de</a></dd></div>
          <div class="m-row"><dt>V. i. S. d. P.</dt><dd>[wird ergänzt]</dd></div>
        </dl>
        <div class="transmission reveal" style="margin-top: 28px">
          <span class="tx-label">Credits</span>
          <p>Mondkarten: NASA/GSFC Scientific Visualization Studio (CGI Moon Kit, gemeinfrei). Mars-Boden: Courtesy NASA/JPL-Caltech (gemeinfrei). Schriften: Planet Kosmos (Planet Typography), Unbounded, Space Grotesk, Space Mono (SIL OFL). Diese Seite lädt nichts von Drittservern.</p>
        </div>
      </div>
    </section>
''',
    },
    # ---------- Datenschutz ----------
    {
        "file": "datenschutz.html",
        "title": "Datenschutz · takeoff potsdam",
        "desc": "Kurz: Diese Seite trackt dich nicht. Die Details stehen hier.",
        "current": None,
        "main": phero("Rechtliches", "Datenschutz",
                      "Die Kurzfassung: Diese Seite setzt keine Cookies, lädt nichts von Drittservern und legt keine Profile an. Die Langfassung folgt unten — sie ist erfreulich kurz.")
        + '''    <section class="section" style="padding-top: clamp(24px, 4vh, 40px)">
      <div class="wrap" style="max-width: 720px">
        <dl class="m-rows reveal" style="border-top: 1px solid var(--bg-hairline)">
          <div class="m-row"><dt>Cookies</dt><dd><b>Keine.</b> Deine FX-/Theme-Wahl bleibt nur lokal in deinem Browser (localStorage, verlässt dein Gerät nie)</dd></div>
          <div class="m-row"><dt>Tracking</dt><dd><b>Keins.</b> Keine Analytics-Pixel, keine Fingerprints, keine Werbenetzwerke</dd></div>
          <div class="m-row"><dt>Drittserver</dt><dd>Schriften, Bilder, Skripte: alles liegt bei uns. SoundCloud/YouTube/Instagram laden <b>erst nach deinem Klick</b> (Zwei-Klick-Lösung)</dd></div>
          <div class="m-row"><dt>Karten</dt><dd>Keine eingebetteten Karten — Routen öffnen als Link in deiner eigenen Karten-App</dd></div>
          <div class="m-row"><dt>Server-Logs</dt><dd>Technisch übliche Zugriffslogs beim Hoster [Details folgen mit Hosting-Entscheidung]</dd></div>
          <div class="m-row"><dt>Deine Rechte</dt><dd>Auskunft, Berichtigung, Löschung — schreib an <a href="mailto:info@takeoff-potsdam.de" style="color:var(--ink)">info@takeoff-potsdam.de</a></dd></div>
          <div class="m-row"><dt>Fotos</dt><dd>Auf Events gilt Fotoverbot; veröffentlichte Fotos nur mit Einverständnis. Du bist auf einem Bild und willst das nicht? Eine Mail genügt — wir nehmen es runter</dd></div>
        </dl>
        <p class="section-intro reveal" style="margin-top: 20px; font-size: 13.5px; opacity: .7">[Prototyp-Gerüst — die finale Datenschutzerklärung wird vor Launch juristisch geprüft.]</p>
      </div>
    </section>
''',
    },
    # ---------- Event: Freiräume (kommend) ----------
    {
        "file": "event-freiraeume.html",
        "title": "Open Air: Freiräume · Sa 12.09. · takeoff potsdam",
        "desc": 'Open Air „Freiräume" mit Schranzverbot & Stadtjugendring — Sa 12.09., Bastion am Schillerplatz, 16–22 Uhr, free.',
        "current": "events",
        "bodyattr": ' class="has-sticky"',
        "main": '''    <section class="ehero">
      <div class="wrap">
        <div class="patch-hero" style="color:#6fc9e8; box-shadow: inset 0 0 0 4px rgb(111 201 232 / .18), 0 0 22px rgb(111 201 232 / .25)" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9z"/></svg></div>
        <h1 class="etitle">freiräume</h1>
        <p class="esub">Open Air · mit Schranzverbot &amp; Stadtjugendring</p>
        <div class="facts">
          <span><b>SA 12.09.2026</b></span>
          <span>Start <b>16:00</b> · Ende <b>22:00</b></span>
          <span><b>Bastion am Schillerplatz</b>, Potsdam West</span>
          <span><b>Free</b></span>
        </div>
        <div class="cta-row" style="justify-content:center; margin-top: 26px">
          <a class="btn btn-primary" href="https://t.me/takeoffpotsdam" target="_blank" rel="noopener">Telegram · Updates zuerst</a>
          <a class="btn btn-ghost" href="#" onclick="return false">＋ In den Kalender (.ics)</a>
        </div>
        <p class="lu-note" style="margin-top:16px">Kein VVK — einfach vorbeikommen. Tagsüber, draußen, für alle.</p>
      </div>
    </section>

    <div class="wrap section" style="padding-top:clamp(40px,6vh,70px)">
      <div class="eblock reveal">
        <h3>Mission Briefing</h3>
        <p>Freie Räume für freie Beats: Zusammen mit dem Kollektiv <b>Schranzverbot</b> und dem <b>Stadtjugendring Potsdam</b> bespielen wir die Grünfläche an der Bastion — offiziell genehmigt, solidarisch organisiert, offen für alle. Techno und Trance, solange die Sonne mitspielt.</p>
      </div>
      <div class="eblock reveal">
        <h3>Gut zu wissen</h3>
        <dl class="m-rows" style="border-top: 1px solid var(--bg-hairline)">
          <div class="m-row"><dt>Sound</dt><dd>Techno · Trance — zwei Kollektive, eine Anlage</dd></div>
          <div class="m-row"><dt>Für wen</dt><dd>Alle Altersgruppen — Open Air am Tag</dd></div>
          <div class="m-row"><dt>Wetter</dt><dd>Bei Sturm/Unwetter: Update im Telegram &amp; hier</dd></div>
          <div class="m-row"><dt>Awareness</dt><dd>Team in <b>lila Westen</b> + Ersthelfer*innen vor Ort · Free Water</dd></div>
        </dl>
      </div>
      <div class="eblock reveal">
        <h3>Landeplatz</h3>
        <div class="vcard">
          <span class="vname">Bastion am Schillerplatz</span>
          <span class="vaddr">Grünfläche, Potsdam West</span>
          <span class="vhint">Tram bis Schillerplatz · Fahrrad ausdrücklich erwünscht</span>
        </div>
        <div class="route-row">
          <a class="btn btn-ghost" href="https://www.google.com/maps/search/?api=1&query=Schillerplatz%20Potsdam" target="_blank" rel="noopener">Google Maps ↗</a>
          <a class="btn btn-ghost" href="https://maps.apple.com/?q=Schillerplatz%20Potsdam" target="_blank" rel="noopener">Apple Karten ↗</a>
          <a class="btn btn-ghost" href="https://www.openstreetmap.org/search?query=Schillerplatz%20Potsdam" target="_blank" rel="noopener">OSM ↗</a>
        </div>
        <p class="lu-note">Karten öffnen extern in deiner App — hier lädt kein Tracker.</p>
      </div>
      <a class="back-link" href="events.html">← Alle Events</a>
    </div>
''',
        "sticky": '''  <div class="sticky-cta" role="complementary" aria-label="Event-Kurzinfo">
    <span class="sc-info"><b>SA 12.09.</b> · BASTION AM SCHILLERPLATZ · <b>FREE</b></span>
    <a class="btn btn-primary" href="https://t.me/takeoffpotsdam" target="_blank" rel="noopener">Telegram ↗</a>
  </div>
''',
    },
    # ---------- Event: Pride (vergangen / Recap) ----------
    {
        "file": "event-pride.html",
        "title": "Pride-Party · Recap · takeoff potsdam",
        "desc": "Recap der Pride-Party vom 27.06.2026 im KuZe — drei Floors, 40 Grad, eine der besten Nächte.",
        "current": "events",
        "main": '''    <section class="ehero">
      <div class="wrap">
        <div class="patch-hero" style="color:#e04fb4" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 20s-7.2-4.6-9.2-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.2 11c-2 4.4-9.2 9-9.2 9z"/></svg></div>
        <h1 class="etitle">pride-party</h1>
        <p class="esub">Mission M6 · abgeschlossen</p>
        <div class="facts">
          <span><b>SA 27.06.2026</b></span>
          <span><b>KuZe</b>, Potsdam</span>
          <span><b>3 Floors</b></span>
          <span><b>Free Entry</b></span>
        </div>
        <p class="lu-note" style="margin-top:20px">Danke an alle, die da waren, geholfen und aufeinander aufgepasst haben. ♥</p>
      </div>
    </section>

    <div class="wrap section" style="padding-top:clamp(40px,6vh,70px)">
      <div class="eblock reveal">
        <h3>Debriefing</h3>
        <p>40 °C, Sturmwarnung, die Demo wurde abgesagt — die Party nicht. Drei Floors („3 stages of love"), Free Water gegen die Hitze, Sonnensegel-Abbau im Sturm, und am Ende der Satz, der bleibt: <em>„Bestes Event, das wir je hatten."</em></p>
      </div>
      <div class="eblock reveal">
        <h3>Die Nacht in Zahlen</h3>
        <div class="stats" style="border: 0; padding: 10px 0">
          <div><b>03</b><span>Floors</span></div>
          <div><b>40°</b><span>Celsius</span></div>
          <div><b>150</b><span>outdoor-Kapazität</span></div>
          <div><b>∞</b><span>Liebe</span></div>
        </div>
      </div>
      <div class="eblock reveal">
        <h3>Galerie</h3>
        <div class="gallery-grid">
          <div class="gph">Foto folgt<br>nach Freigabe</div>
          <div class="gph">Foto folgt<br>nach Freigabe</div>
          <div class="gph">Foto folgt<br>nach Freigabe</div>
          <div class="gph">Foto folgt<br>nach Freigabe</div>
          <div class="gph">Foto folgt<br>nach Freigabe</div>
          <div class="gph">Foto folgt<br>nach Freigabe</div>
        </div>
        <p class="lu-note" style="margin-top:14px">Wir fragen jede abgebildete Person, bevor ein Foto online geht. Du bist auf einem Bild und willst das nicht? <a href="kontakt.html" style="color:var(--acc-3-tint)">Eine Nachricht genügt.</a></p>
      </div>
      <div class="eblock reveal">
        <h3>Lineup · A–Z</h3>
        <div class="lineup">
          <span class="act">Emmy<small>Floor 3 · 20:00</small></span>
          <span class="act">Kolja<small>Floor 3 · 21:00</small></span>
          <span class="act">takeoff-Crew<small>alle Floors</small></span>
        </div>
      </div>
      <div class="eblock reveal">
        <h3>Nächster Start</h3>
        <p>Die nächste Mission wartet schon: <a href="event-freiraeume.html" style="color:var(--acc-3-tint)"><b>Open Air „Freiräume" · Sa 12.09.</b></a></p>
      </div>
      <a class="back-link" href="events.html">← Alle Events</a>
    </div>
''',
    },
]

# ---------- Artist-Seiten ----------
PAGES.append(artist_page(
    "jojo", "JO", "JOJO", "Hard Trance · Bounce · Resident",
    [("Rolle", "<b>Resident</b> · seit 2025"), ("Podcast", '„JOJO | takeoff" · Folge 1'),
     ("Socials", '<a href="https://soundcloud.com/takeoff-potsdam" target="_blank" rel="noopener" style="color:var(--ink)">SoundCloud ↗</a>')],
    "Bio &amp; Foto folgen — mit Einverständnis, wie sich das gehört.",
    [("M5", "17.01.26", "Free Entry Rave", "Spartacus")],
    "JOJO | takeoff Podcast #1", "Serie · YouTube &amp; SoundCloud"))
PAGES.append(artist_page(
    "platzhalter", "PL", "DJ Platzhalter", "Trance · Resident · Mitgründer",
    [("Rolle", "<b>Resident &amp; Mitgründer</b> (Nico)"), ("Gründung", "Hat takeoff 2024 mit aufgebaut"),
     ("Socials", '<a href="https://soundcloud.com/takeoff-potsdam" target="_blank" rel="noopener" style="color:var(--ink)">SoundCloud ↗</a>')],
    "Der Name ist Programm — die Bio kommt trotzdem noch.",
    [("M3", "09.05.25", "Spartacus-Nacht", "Spartacus"), ("M1", "15.06.24", "Sky High", "Potsdam")],
    "DJ Platzhalter — Live @ Spartacus", "09.05. · Liveset"))
PAGES.append(artist_page(
    "cyonic", "CY", "Cyonic", "Techno · Trance · seit Tag 1",
    [("Rolle", "<b>DJ</b> · von der ersten Mission an"), ("Debüt", "Sky High · 15.06.2024"),
     ("Spezialität", "B2B-Sets")],
    "Von der ersten Mission an dabei. Profil folgt.",
    [("M5", "17.01.26", "Free Entry Rave", "Spartacus"), ("M3", "09.05.25", "Spartacus-Nacht", "Spartacus"),
     ("M2", "11.01.25", "Out of Space", "Nilkeller"), ("M1", "15.06.24", "Sky High", "Potsdam")],
    "Cyonic B2B Niico — Out of Space", "11.01. · Liveset"))


def build(page):
    cur = {k: "" for k in ("events", "artists", "kollektiv", "awareness")}
    if page.get("current") in cur:
        cur[page["current"]] = ' aria-current="true"'
    main = page["main"]
    if page.get("sticky"):
        main = main  # sticky wird nach </main> eingesetzt — via BODY-Anhang unten
    html = SHELL.format(
        TITLE=page["title"], DESC=page["desc"], MAIN=main.rstrip(),
        THEME=page.get("theme", ""), BODYATTR=page.get("bodyattr", ""),
        CUR_events=cur["events"], CUR_artists=cur["artists"],
        CUR_kollektiv=cur["kollektiv"], CUR_awareness=cur["awareness"],
    )
    if page.get("sticky"):
        html = html.replace("  <div class=\"mctrl\"", page["sticky"] + "\n  <div class=\"mctrl\"")
    with open(page["file"], "w", encoding="utf-8") as f:
        f.write(html)
    print("✓", page["file"])


for p in PAGES:
    build(p)
print(f"\n{len(PAGES)} Seiten generiert.")
