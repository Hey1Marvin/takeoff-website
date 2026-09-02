/* ############################################################################
   ##  ACHTUNG - ZWOELF DER ACHTZEHN SEITEN WERDEN GENERIERT  ##################
   ############################################################################

   Diese zwoelf HTML-Dateien entstehen aus tools/gen-pages.py und werden bei
   jedem Lauf des Generators vollstaendig ueberschrieben:

       impressum.html      datenschutz.html    kontakt.html      team.html
       news.html           musik.html          kalender.html     artist-jojo.html
       artist-cyonic.html  artist-platzhalter.html
       event-freiraeume.html                   event-pride.html

   Sie tragen seit It. 9 dieselben Auszeichnungen wie die sechs handgepflegten
   Seiten (index, events, artists, kollektiv, awareness, event-marsmission):
   data-i18n, data-i18n-html, data-i18n-aria, data-i18n-title und
   translate="no" auf Eigennamen. Der Generator kennt diese Attribute NICHT.

   → Wer gen-pages.py das naechste Mal laufen laesst, MUSS vorher das
     SHELL-Template (tools/gen-pages.py ab Z. 10) und die Seitenbausteine
     darunter auf denselben Stand bringen. Betroffen sind dort mindestens:

       * das Inline-Boot-Script im <head>  - der Block, der takeoff-lang aus
         dem localStorage liest und h.lang setzt (Sperrvermerk data-lang-lock
         auf <html> beachten, NICHT auf <body>)
       * Topbar, Navigation, Overlay-Menue, Footer - rund 40 Schluessel je
         Seite, plus die beiden Sprachumschalter (.nav-lang und .menu-lang
         mit data-set-lang="de"/"en" und aria-pressed)
       * der Mission-Control-Block (Z. 152) - seit It. 9 vier Zeilen:
         FX · Theme · Boden · Zeit, mit mctrl.*-Schluesseln auf Labels,
         Beschriftungen und title-Attributen
       * die Seitenbausteine phero(), artist_page() und die Eintraege in PAGES

   Was verlorengeht, wenn das jemand vergisst: die zwoelf Seiten fallen
   stumm auf Deutsch zurueck. Kein Fehler in der Konsole, kein leerer Text -
   der deutsche Quelltext steht ja weiterhin im Markup und bleibt lesbar.
   Genau das macht es gefaehrlich: die Umschaltung wirkt auf index.html,
   events.html, artists.html, kollektiv.html, awareness.html und
   event-marsmission.html weiter, und nur auf den zwoelf generierten Seiten
   passiert nichts. Zusaetzlich verschwinden dort der Sprachumschalter,
   der Sperrvermerk der beiden Rechtsseiten und die Boden-/Zeit-Zeile des
   Panels - der Tag-Modus waere auf zwoelf Seiten wieder unerreichbar.

   Pruefen laesst sich das in einem Schritt: jede Seite muss
   data-i18n-Attribute tragen (Groessenordnung 60-190 je Seite), und
   document.documentElement muss nach dem Setzen von localStorage
   "takeoff-lang" auf "en" mit lang="en" ausgeliefert werden.
   ############################################################################ */

/* Woerterbuch DE/EN. Bewusst eine JS-Datei statt JSON: der Prototyp muss auch
   ueber file:// laufen, und ein fetch() wuerde dort scheitern.

   ── Aufbau ────────────────────────────────────────────────────────────────
   Schluesselschema:  bereich.komponente.feld
   Ein Schluessel pro sichtbarem Textknoten. Zwei Stellen mit exakt gleichem
   Text teilen sich EINEN Schluessel — Navigation, Overlay-Menue, Footer und
   Mission Control sind ueber alle achtzehn Seiten byteidentisch, der Marquee-
   Ticker enthaelt jede Zeile doppelt (Loop-Technik). Ein Uebersetzer darf
   denselben Satz nie zweimal sehen.

   Platzhalter: durchgehend {name}-Syntax. Alle verwendeten Platzhalter sind
   am Ende der Datei dokumentiert.

   Inline-Markup: Wo der deutsche Satz <br>, <b>, <em>, <small> oder
   <span class="glow"> enthaelt, steht das Markup im Wert. Diese Schluessel
   brauchen spaeter data-i18n-html statt data-i18n; sie sind unten
   vollstaendig aufgelistet.

   Rechtsseiten: impressum.html und datenschutz.html tragen Pflichtangaben nach
   deutschem Recht. Die englischen Werte sind Verstaendnishilfe, keine
   Rechtsuebersetzung — legal.binding_note sagt das auf beiden Seiten in beiden
   Sprachen. Begruendung und Regeln dafuer: Anhang, Abschnitt 8.

   Datum, Uhrzeit und Zahlen sind KEINE Uebersetzung, sondern Formatierung.
   Wochentagskuerzel ("SA") und Datumsformate ("12.09.") haben deshalb
   bewusst keine Schluessel — die formatiert Intl.DateTimeFormat aus den
   ISO-Werten im EVENTS-Array (assets/js/main.js Z. 28–41). Betroffene
   Stellen: siehe Kommentarblock am Dateiende.
   ────────────────────────────────────────────────────────────────────────── */

window.TAKEOFF_I18N = {

  /* ==========================================================================
     DEUTSCH
     ========================================================================== */
  de: {

    /* ---------- Gemeinsame Bausteine (mehrfach verwendet) ---------- */
    "common.time": "{time} Uhr",
    "common.timerange": "{start}–{end} Uhr",
    "common.time_from": "ab {time} Uhr",
    "common.end_at": "Ende {time}",
    "common.since_year": "seit {year}",
    "common.since_day_one": "seit Tag 1",
    "common.details_follow": "Details folgen",
    "common.more": "Mehr:",
    "common.more_on_this": "Mehr dazu:",
    "common.about_us": "Über uns",
    "common.mail": "Mail",
    "common.age_18": "18+",
    "common.open_end": "open end",

    /* ---------- Gemeinsame Bausteine — Nachtrag It. 8 ---------- */
    "common.start_at": "Start {time}",
    "common.details": "Details",
    "common.note_label": "Hinweis",
    "common.reset": "Zurücksetzen",
    "common.share": "Teilen",
    "common.podcast": "Podcast",
    "common.floor": "Floor {n}",
    "common.all_floors": "alle Floors",
    "common.placeholder": "[Platzhalter]",
    "common.tbd": "[wird ergänzt]",
    "common.demo": "Demo",
    "common.demo_download": "Demo — echter Download kommt mit dem Backend",
    "common.demo_feed": "Demo — echter Feed kommt mit dem Backend",

    /* ---------- Meta: Seitentitel & Description ---------- */
    "meta.index.title": "takeoff — rave kollektiv potsdam · Design-Prototyp",
    "meta.index.desc": "takeøff — ehrenamtliches Rave-Kollektiv aus Potsdam. Trance · Hard Trance · Bounce. Design-Prototyp.",
    "meta.events.title": "Events & Missionen · takeoff potsdam",
    "meta.events.desc": "Alle takeoff-Events: kommende Missionen und das Flight Log der vergangenen Nächte.",
    "meta.artists.title": "Artists & Sets · takeoff potsdam",
    "meta.artists.desc": "Residents, Gäste, Sets und der takeoff-Podcast — die Frequenzen des Kollektivs.",
    "meta.kollektiv.title": "Kollektiv · takeoff potsdam",
    "meta.kollektiv.desc": "Wer takeoff ist: ehrenamtliches Rave-Kollektiv aus Potsdam. Selbstgebaute Anlage, Themen-Deko, Awareness als Haltung.",
    "meta.awareness.title": "Awareness & Hilfe · takeoff potsdam",
    "meta.awareness.desc": "Awareness bei takeoff: Team, Ersthelfer*innen, Free Water, Hausregeln — und wo du Hilfe bekommst.",
    "meta.event.mars.title": "takeoff: Marsmission · {date} · Spartacus Potsdam",
    "meta.event.mars.desc": "takeoff: Marsmission — {date}, Spartacus Potsdam. Free Entry. Trance / Hard Trance / Bounce. 18+.",

    /* ---------- Meta: die zwoelf neuen Seiten ---------- */
    "meta.event.pwest.title": "Open Air: Freiräume · {date} · takeoff potsdam",
    "meta.event.pwest.desc": "Open Air „Freiräume\" mit Schranzverbot & Stadtjugendring — {date}, Bastion am Schillerplatz, {time}, free.",
    "meta.event.pride.title": "Pride-Party · Recap · takeoff potsdam",
    "meta.event.pride.desc": "Recap der Pride-Party vom {date} im KuZe — drei Floors, 40 Grad, eine der besten Nächte.",
    "meta.team.title": "Team · takeoff potsdam",
    "meta.team.desc": "Wer bei takeoff was macht — DJs, Licht, Deko, Awareness, Sani, Orga.",
    "meta.news.title": "News · Mission Log · takeoff potsdam",
    "meta.news.desc": "Was bei takeoff passiert: Baulogs, Ankündigungen, Recaps und Podcast-Releases.",
    "meta.musik.title": "Unser Sound · takeoff potsdam",
    "meta.musik.desc": "Trance, Hard Trance, Bounce — was das ist und wie es klingt.",
    "meta.kalender.title": "Eventkalender · takeoff potsdam",
    "meta.kalender.desc": "Alle takeoff-Termine — einmal abonnieren, nie wieder ein Event verpassen.",
    "meta.kontakt.title": "Kontakt · takeoff potsdam",
    "meta.kontakt.desc": "Schreib uns — allgemein, Booking, Presse, Awareness oder Fundsachen.",
    "meta.impressum.title": "Impressum · takeoff potsdam",
    "meta.impressum.desc": "Anbieterkennzeichnung der takeoff-Website.",
    "meta.datenschutz.title": "Datenschutz · takeoff potsdam",
    "meta.datenschutz.desc": "Kurz: Diese Seite trackt dich nicht. Die Details stehen hier.",
    "meta.artist.jojo.title": "JOJO · Artist · takeoff potsdam",
    "meta.artist.jojo.desc": "JOJO — Hard Trance · Bounce · Resident bei takeoff.",
    "meta.artist.cyonic.title": "Cyonic · Artist · takeoff potsdam",
    "meta.artist.cyonic.desc": "Cyonic — Techno · Trance · seit Tag 1 bei takeoff.",
    "meta.artist.platzhalter.title": "DJ Platzhalter · Artist · takeoff potsdam",
    "meta.artist.platzhalter.desc": "DJ Platzhalter — Trance · Resident · Mitgründer bei takeoff.",

    /* ---------- Zugaenglichkeit: aria-label, title, Skip-Link ---------- */
    "a11y.skiplink": "Zum Inhalt springen",
    "a11y.brand": "takeoff — zur Startseite",
    "a11y.nav.main": "Hauptnavigation",
    "a11y.burger.open": "Menü öffnen",
  "a11y.daymode": "Tagmodus",
  "nav.news": "News",
  "nav.kalender": "Kalender",
    "a11y.burger.close": "Menü schließen",
    "a11y.marquee.events": "Nächste Events",
    "a11y.tminus.index": "Countdown zum nächsten Event",
    "a11y.tminus.event": "Countdown",
    "a11y.mctrl": "Darstellungs-Einstellungen",
    "a11y.sticky": "Event-Kurzinfo",
    "a11y.secret": "Verstecktes Item",
    "a11y.set.play": "Set abspielen: {artist}",
    "a11y.podcast.play": "Podcast abspielen: {artist}",
    "a11y.set.play_plain": "Set abspielen",
    "a11y.bpm.pad": "Hier im Takt tippen — Tap-Tempo-Werkzeug",
    "a11y.flog.pin": "War ich dabei — {event}",
    "a11y.join.roles": "Rollen zum Mitmachen",

    /* ---------- Topbar (HUD + Marquee-Ticker) ---------- */
    "topbar.hud.telegram": "TELEGRAM ↗",
    "topbar.hud.back": "← Basis",
    "topbar.marquee.next_launch": "NEXT LAUNCH →",
    "topbar.marquee.mission_status": "MISSION STATUS:",
    "topbar.marquee.boarding": "BOARDING",
    "topbar.marquee.crew_aboard": "CREW AN BORD:",
    "topbar.marquee.tba_more": "+TBA",

    /* ---------- Navigation ---------- */
    "nav.brand": "takeoff",
    "nav.events": "Events",
    "nav.artists": "Artists",
    "nav.kollektiv": "Kollektiv",
    "nav.awareness": "Awareness",
    "menu.label": "Menü",

    /* ---------- Overlay-Menue ---------- */
    "menu.eyebrow": "Bordcomputer · Navigation",
    "menu.events.note": "{n} geplant",
    "menu.artists.note": "Sets & Podcasts",
    "menu.kollektiv.note": "Wer hier funkt",
    "menu.awareness.note": "Hilfe & Regeln",
    "menu.flightlog.label": "Flight Log",
    "menu.flightlog.note": "Archiv",
    "menu.next.label": "Next Launch",
    "menu.go": "Ansehen →",
    "menu.close": "Schließen",

    /* ---------- Overlay-Menue: drei neue Eintraege (It. 8) ---------- */
    "menu.news.label": "News",
    "menu.news.note": "Mission Log",
    "menu.kalender.label": "Kalender",
    "menu.kalender.note": "Abo & Termine",
    "menu.kontakt.note": "Schreib uns",

    /* ---------- Social-Kanaele (Menue + Footer) ---------- */
    "social.instagram": "Instagram",
    "social.telegram": "Telegram",
    "social.soundcloud": "SoundCloud",
    "social.tiktok": "TikTok",
    "social.email": "info@takeoff-potsdam.de",

    /* ---------- Hero (index.html) ---------- */
    "hero.pretitle": "rave kollektiv · potsdam · est. 2024",
    "hero.tagline": "Wir bauen unsere Anlage selbst, unsere Deko selbst und unsere Nächte selbst.<br><b>Trance · Hard Trance · Bounce</b> — ehrenamtlich, DIY, für alle.",
    "hero.tminus.label": "T-Minus",
    "hero.scrollhint": "Scroll für Boarding",
    "hero.next.meta": "{venue}, {city} · {note}",
    "hero.cta.missions": "Nächste Missionen →",
    "hero.cta.telegram": "Telegram · Presale & Infos",

    /* ---------- Missionen / Event-Karten (index.html, events.html) ---------- */
    "missions.eyebrow": "Flugplan",
    "missions.h2": "Nächste <span class=\"glow\">Missionen</span>",
    "missions.intro": "Jedes takeoff-Event hat ein Thema — und die ganze Seite zieht sich das passende Gewand an. Tippe eine Karte an für das Briefing.",
    "missions.headlink": "Alle Events & Flight Log",
    "card.briefing": "Briefing",
    "card.row.boarding": "Boarding",
    "card.row.landing": "Landeplatz",
    "card.row.entry": "Eintritt",
    "card.row.sound": "Sound",
    "card.row.status": "Status",
    "card.row.motto": "Motto",
    "card.cta.telegram_updates": "Updates im Telegram",
    "card.cta.mission_page": "Zur Missionsseite",
    "card.cta.telegram_first": "Telegram · zuerst erfahren",
    "status.announced": "Announced",
    "status.tba": "TBA 🤫",
    "status.prep": "In Vorbereitung",
    "status.departed": "Departed",

    /* ---------- Genres (identisch in beiden Sprachen, Schluessel trotzdem) --- */
    "genre.trance": "Trance",
    "genre.hard_trance": "Hard Trance",
    "genre.bounce": "Bounce",
    "genre.hard_bounce": "Hard Bounce",
    "genre.techno": "Techno",
    "genre.hardtekk": "Hardtekk",
    "genre.psytrance": "Psytrance",
    "chip.open_air": "Open Air",

    /* ---------- Sound / Sets (index.html, artists.html) ---------- */
    "sound.eyebrow": "Frequenzen",
    "sound.h2": "Unser <span class=\"glow\">Sound</span>",
    "sound.intro": "Von hypnotisch bis hart: Das läuft bei uns — und das sind die Menschen hinterm Pult. Sets & Podcasts gibt's auf SoundCloud und YouTube.",
    "sound.headlink": "Alle Artists & Sets",
    "sets.liveset.title": "DJ Platzhalter — Live @ Spartacus",
    "sets.liveset.kind": "Liveset",
    "sets.guest.title": "mølly (on molly) — Live @ Spartacus",
    "sets.guest.kind": "Gast-Set",
    "sets.podcast.title": "JOJO | takeoff Podcast #1",
    "sets.podcast.kind": "Serie · YouTube & SoundCloud",
    "sets.consent.soundcloud": "Demo: Hier würde jetzt der SoundCloud-Player laden (Zwei-Klick, DSGVO-freundlich). Kein Klick = kein Tracking.",
    "sets.consent.soundcloud_short": "Demo: Hier würde jetzt der SoundCloud-Player laden (Zwei-Klick, DSGVO-freundlich).",
    "sets.consent.youtube": "Demo: Hier würde jetzt der YouTube-Player laden (Zwei-Klick, DSGVO-freundlich).",
    "sets.consent.player": "Demo: Hier würde jetzt der Player laden (Zwei-Klick, DSGVO-freundlich).",
    "sets.cyonic_b2b.title": "Cyonic B2B Niico — Out of Space",

    /* ---------- Crew (index.html, kollektiv.html) ---------- */
    "crew.eyebrow": "Crew Select",
    "crew.h2": "Wer hier <span class=\"glow\">funkt</span>",
    "crew.intro": "Residents, Licht, Sound, Awareness, Deko — takeoff ist Kollektivarbeit. (Prototyp: Platzhalter-Avatare, echte Profile folgen mit Consent.)",
    "crew.headlink": "Mehr übers Kollektiv",
    "crew.role.dj_resident": "DJ · Resident",
    "crew.role.dj": "DJ",
    "crew.light.name": "Licht & Deko",
    "crew.light.role": "DMX · Tubes · Requisiten",
    "crew.awareness.name": "Awareness-Team",
    "crew.awareness.role": "Für euch da · jede Nacht",
    "crew.sani.name": "Sani-Team",
    "crew.sani.role": "Ersthelfer*innen · vor Ort",

    /* ---------- Crew: Besatzungs-Kacheln auf kollektiv.html & team.html ---------- */
    "crew.role.dj_day_one": "DJ · seit Tag 1",
    "crew.nico.name": "Nico · DJ Platzhalter",
    "crew.nico.role": "Mitgründer · Orga · DJ",
    "crew.mik.name": "Mik · Blaulicht",
    "crew.mik.role": "Lichttechnik · DMX · DJ",
    "crew.awareness.role_vests": "Lila Westen · ansprechbar",
    "crew.sani.role_roaming": "Ersthelfer*innen · im Umlauf",
    "crew.deko.name": "Deko & Bau",
    "crew.deko.role": "Requisiten · Motto-Welten",
    "crew.bar.name": "Bar & Einlass",
    "crew.bar.role": "Schicht-Crews · jede Nacht",

    /* ---------- Stats-Band (index.html, kollektiv.html) ---------- */
    "stats.founded": "gegründet",
    "stats.missions": "Missionen",
    "stats.rigs": "Anlagen selbstgebaut",
    "stats.volunteer": "ehrenamtlich",

    /* ---------- Stats: Pride-Recap (event-pride.html) ---------- */
    "stats.floors": "Floors",
    "stats.celsius": "Celsius",
    "stats.capacity_outdoor": "outdoor-Kapazität",
    "stats.love": "Liebe",

    /* ---------- Awareness (index.html, awareness.html, Event-Seite) ---------- */
    "aware.headline": "Feiern, auf das ihr euch verlassen könnt.",
    "aware.tile.team.text": "Ansprechbar die ganze Nacht — erkennbar gekennzeichnet.",
    "aware.tile.team.text_full": "Ansprechbar die ganze Nacht — erkennbar gekennzeichnet. Sprich uns an, wir kümmern uns. Sofort.",
    "aware.tile.team.text_event": "Die ganze Nacht ansprechbar — schau nach den gekennzeichneten Westen.",
    "aware.tile.firstaid.title": "Ersthelfer*innen",
    "aware.tile.firstaid.text": "Auf jedem Event dabei. Hilfe holen hat nie Konsequenzen.",
    "aware.tile.sani.text_event": "Ersthelfer*innen vor Ort. Hilfe holen hat nie Konsequenzen — für niemanden.",
    "aware.tile.sani.text_full": "Ausgebildete Ersthelfer*innen auf jedem Event. <b>Hilfe holen hat nie Konsequenzen — für niemanden.</b>",
    "aware.tile.water.title": "Free Water",
    "aware.tile.water.text": "Kostenloses Wasser, immer. Passt aufeinander auf.",
    "aware.tile.water.text_event": "Am Awareness-Point. Trinkt, bevor ihr durstig seid.",
    "aware.tile.water.text_full": "Kostenloses Wasser am Awareness-Point. Trinkt, bevor ihr durstig seid — und passt aufeinander auf.",
    "aware.tile.photo.title": "Fotoverbot",
    "aware.tile.photo.text": "Kein Foto ohne Frage — was im Dunkeln passiert, bleibt da.",
    "aware.tile.photo.text_full": "Kein Foto ohne Frage. Ausnahmen nur nach Absprache — was im Dunkeln passiert, bleibt da.",
    "aware.tile.photo.text_event": "Fotoverbot auf dem Floor — Ausnahmen nur nach Absprache.",
    "aware.note.welcome": "Alle sind willkommen. Diskriminierung, Übergriffe und Grenzverletzungen sind es nicht — dann fliegst du.",
    "aware.principle": "Hilfe holen hat nie Konsequenzen.",
    "link.awareness_concept": "Awareness-Konzept",
    "link.help_drugs": "Hilfe & Drogennotfälle",
    "link.house_rules": "Hausregeln",

    /* ---------- Linktexte in Fliesstext (Platzhalter {link}) ---------- */
    "link.teamboard": "Teamboard →",
    "link.join": "Mach mit.",
    "link.kollektiv_log": "Kollektiv-Log",
    "link.artists_page": "Artists-Seite",
    "link.telegram_group": "Telegram-Gruppe ↗",
    "link.one_message": "Eine Nachricht genügt.",

    /* ---------- Flight Log (index.html, events.html) ---------- */
    "flightlog.h2": "Bisherige <span class=\"glow\">Missionen</span>",
    "flog.pin": "War ich dabei",

    /* ---------- Footer ---------- */
    "footer.channels": "Kanäle",
    "footer.contact": "Kontakt",
    "footer.join": "Mitmachen / Crew werden",
    "footer.booking": "Booking",
    "footer.imprint": "Impressum",
    "footer.privacy": "Datenschutz",
    "footer.no_track": "🛰️ Diese Seite trackt dich nicht",
    "footer.love": "Viel Liebe, euer takeoff Team",
    "footer.proto_note": "DESIGN-PROTOTYP · IT 8 · NICHTS HIER IST FINAL · INHALTE TEILS PLATZHALTER",
    "footer.proto_note.event": "DESIGN-PROTOTYP · EVENT-SEITE IM MARS-THEME (FIXIERT) · INHALTE TEILS PLATZHALTER",

    /* ---------- Footer: Spalte Kollektiv ist It. 8 gewachsen ---------- */
    "footer.team": "Team",
    "footer.news": "News / Mission Log",
    "footer.calendar": "Eventkalender",
    "footer.join_short": "Mitmachen",

    /* ---------- Mission Control (Panel unten rechts) ---------- */
    "mctrl.fx": "FX",
    "mctrl.theme": "Theme",
    "mctrl.ground": "Boden",
    "mctrl.time": "Zeit",
    "mctrl.off": "Aus",
    "mctrl.normal": "Normal",
    "mctrl.full": "Voll",
    "mctrl.on": "An",
    "mctrl.theme.space": "Space",
    "mctrl.theme.mars": "Mars",
    "mctrl.theme.strand": "Strand",
    "mctrl.night": "Nacht",
    "mctrl.day": "Tag",
    "mctrl.fx.off.title": "Statisch — spart Akku & Daten",
    "mctrl.fx.normal.title": "Standard",
    "mctrl.fx.full.title": "Volle Show",
    "mctrl.ground.off.title": "Nur Sternenhimmel",
    "mctrl.ground.on.title": "Horizont je nach Theme",

    /* ---------- Event-Seite (event-marsmission.html) ---------- */
    "event.page.cta.telegram": "Telegram · Updates zuerst",
    "event.page.cta.ics": "＋ In den Kalender (.ics)",
    "event.page.no_presale": "Kein VVK nötig — einfach kommen. Wer früh kommt, tanzt länger.",
    "event.page.briefing.h3": "Mission Briefing",
    "event.page.lineup.h3": "Crew an Bord · A–Z",
    "event.page.lineup.note": "Lineup alphabetisch — bei uns gibt's keine Headliner-Hierarchie.",
    "event.page.lineup.tba": "+ TBA",
    "event.page.lineup.tba.note": "Special Guests",
    "event.page.timetable.h3": "Timetable",
    "event.page.timetable.loading": "Wird geladen … 🤫",
    "event.page.timetable.note": "Die Running Order kommt kurz vor dem Start — Telegram-Crew erfährt's zuerst.",
    "event.page.aware.eyebrow": "Awareness an Bord",
    "event.page.aware.emergency": "Notfall? Sprich irgendjemanden von der Crew an — wir kümmern uns.",
    "event.page.maps.google": "Google Maps ↗",
    "event.page.maps.apple": "Apple Karten ↗",
    "event.page.maps.osm": "OSM ↗",
    "event.page.maps.note": "Karten öffnen extern in deiner App — hier lädt kein Tracker.",
    "event.page.faq.h3": "Bordbuch · FAQ",
    "event.page.faq.price.q": "Was kostet der Eintritt?",
    "event.page.faq.price.a": "Nichts — Free Entry. Wenn du magst, freut sich die Soli-Kasse: Davon bauen wir Deko, Anlage und das nächste Event.",
    "event.page.faq.age.q": "Ab wie viel Jahren?",
    "event.page.faq.age.a": "18+. Ausweis nicht vergessen — ohne kommst du leider nicht an Bord, auch nicht mit Muttizettel.",
    "event.page.faq.photo.q": "Darf ich fotografieren?",
    "event.page.faq.photo.a": "Auf dem Floor gilt Fotoverbot. Ausnahmen nur nach vorheriger Absprache mit uns — und mit allen, die aufs Bild sollen.",
    "event.page.faq.help.q": "Mir oder jemandem geht's nicht gut — was tun?",
    "event.page.faq.help.a": "Sprich sofort Awareness-Team, Sani oder irgendwen von der Crew an. Hilfe holen hat nie Konsequenzen. Free Water gibt's am Awareness-Point.",
    "event.page.faq.home.q": "Wie komme ich nachts wieder heim?",
    "event.page.faq.home.a": "Der Hbf ist 5 Minuten zu Fuß entfernt. Checkt die Nachtverbindungen vorher — und sagt jemandem Bescheid, wenn ihr euch auf den Weg macht.",
    "event.page.back": "← Zurück zur Basis",

    /* ---------- Event-Seiten: Bausteine fuer Freiraeume & Pride ---------- */
    "event.page.back_all": "← Alle Events",
    "event.page.good_to_know.h3": "Gut zu wissen",
    "event.page.row.for_whom": "Für wen",
    "event.page.row.weather": "Wetter",
    "event.page.debriefing.h3": "Debriefing",
    "event.page.numbers.h3": "Die Nacht in Zahlen",
    "event.page.gallery.h3": "Galerie",
    "event.page.gallery.consent_note": "Wir fragen jede abgebildete Person, bevor ein Foto online geht. Du bist auf einem Bild und willst das nicht? {link}",
    "event.page.lineup.h3_az": "Lineup · A–Z",
    "event.page.next.h3": "Nächster Start",
    "event.page.next.text": "Die nächste Mission wartet schon: {link}",
    "gallery.placeholder": "Foto folgt<br>nach Freigabe",

    /* ---------- Events-Seite (events.html) ---------- */
    "events.hero.h1": "Events & <span class=\"glow\">Missionen</span>",
    "events.hero.intro": "Alles, was ansteht — und alles, was war. Tippe eine Karte an für das Briefing.",
    "events.transmission.label": "Transmission incoming",
    "events.transmission.text": "Fotos, Aftermovies und Sets der vergangenen Missionen werden gerade gesichtet — die Galerien landen hier, sobald alle Abgebildeten gefragt wurden. Kein Foto ohne Frage, auch im Archiv.",

    /* ---------- Events-Seite: Abflugtafel, Standby, BPM-Tool, FAQ (It. 8) ---------- */
    "events.upcoming.eyebrow": "Kommende Missionen",
    "events.board.title": "Abflugtafel",
    "events.board.col.gate": "Gate",
    "events.board.col.date": "Datum",
    "events.board.col.mission": "Mission",
    "events.board.col.venue": "Ort",
    "events.calendar.subscribe": "Alle Termine abonnieren →",
    "events.standby.label": "Standby",
    "events.standby.title": "Nächster Start in Vorbereitung",
    "events.standby.text": "Kein Event angekündigt — aber startklar. Telegram weiß es zuerst.",
    "events.standby.cta": "Telegram beitreten",
    "events.bpm.eyebrow": "Sound-Check",
    "events.bpm.h2": "Finde deinen <span class=\"glow\">Rave-Rhythmus</span>",
    "events.bpm.intro": "Klopf mit — wir sagen dir, zu welchem Genre dein Tempo passt.",
    "events.bpm.tap": "Tap",
    "events.bpm.tap_note": "im Takt",
    "events.bpm.unit": "BPM",
    "events.faq.eyebrow": "Bevor du fragst",
    "events.faq.h2": "Häufige <span class=\"glow\">Fragen</span>",
    "events.faq.ticket.q": "Muss ich vorher ein Ticket kaufen?",
    "events.faq.ticket.a": "Bei Free-Entry-Events nicht — einfach kommen. Steht bei jedem Termin oben in der Karte, falls doch mal Eintritt fällig ist.",
    "events.faq.when.q": "Ab wann lohnt sich Kommen?",
    "events.faq.when.a": "Zum Einlass, wenn du sicher reinwillst — bei kleineren Locations war schon mal bei 200 Leuten Schluss. Line-up- und Timetable-Updates gibt's vorher im Telegram.",
    "events.faq.cloakroom.q": "Gibt's Garderobe?",
    "events.faq.cloakroom.a": "Nicht überall — wir sind ein DIY-Kollektiv, kein Club mit festem Personal. Steht in der jeweiligen Eventkarte, sonst gilt: leicht anziehen, warm tanzen.",
    "events.faq.photo.a": "Kein Foto ohne Frage — siehe Awareness.",
    "events.faq.under18.q": "Ich bin unter 18 — komme ich rein?",
    "events.faq.under18.a": "Kommt aufs Event an: Open Airs wie „Freiräume\" sind für alle Altersgruppen, Club- und Spätnächte meist ab 18. Steht immer in der Eventkarte.",
    "events.faq.help.q": "Ich will mithelfen!",
    "events.faq.help.a": "Immer her damit — Aufbau, Awareness, Bar, Deko. Schreib uns im Telegram oder schau auf {link} vorbei, wir melden uns.",

    /* ---------- Artists-Seite (artists.html) ---------- */
    "artists.hero.h1": "Artists & <span class=\"glow\">Sets</span>",
    "artists.hero.intro": "Die Menschen hinterm Pult — Residents, Gäste und der takeoff-Podcast. Bei uns gibt's keine Headliner-Hierarchie, nur gute Musik.",
    "artists.residents.h2": "Residents",
    "artists.card.profile": "Profil",
    "artists.row.role": "Rolle",
    "artists.row.last": "Zuletzt",
    "artists.row.listen": "Hören",
    "artists.row.debut": "Debüt",
    "artists.row.specialty": "Spezialität",
    "artists.role.resident": "Resident",
    "artists.jojo.listen": "„JOJO | takeoff\" Podcast #1",
    "artists.jojo.bio": "Bio & Foto folgen — mit Einverständnis, wie sich das gehört.",
    "artists.platzhalter.listen": "Liveset @ Spartacus",
    "artists.platzhalter.bio": "Der Name ist Programm — die Bio kommt trotzdem noch.",
    "artists.cyonic.specialty": "B2B-Sets",
    "artists.cyonic.bio": "Von der ersten Mission an dabei. Profil folgt.",
    "artists.sets.eyebrow": "Aufzeichnungen",
    "artists.sets.h2": "Sets & <span class=\"glow\">Podcast</span>",
    "artists.guests.eyebrow": "Gäste-Log",
    "artists.guests.h2": "Schon bei uns <span class=\"glow\">gefunkt</span>",
    "artists.guests.intro": "Danke an alle, die unsere Nächte mitgeprägt haben — Profile & Verlinkungen folgen.",
    "artists.transmission.text": "Die Artist-Profile entstehen gerade — mit Selbstauskunft, Foto-Einverständnis und verlinkten Sets. Du willst bei uns auflegen? Schick uns dein Demo:",

    /* ---------- Artist-Einzelseiten (artist-*.html) ---------- */
    "artists.card.to_profile": "Zum Profil",
    "artistpage.eyebrow": "Artist",
    "artistpage.sets.h2": "Sets",
    "artistpage.flog.h2": "Bei takeoff <span class=\"glow\">gespielt</span>",
    "artistpage.row.socials": "Socials",
    "artistpage.row.founding": "Gründung",
    "artistpage.back_all": "← Alle Artists",

    /* ---------- Kollektiv-Seite (kollektiv.html) ---------- */
    "kollektiv.hero.h1": "Wir bauen unsere Nächte <span class=\"glow\">selbst</span>.",
    "kollektiv.hero.intro": "takeoff ist ein ehrenamtliches Rave-Kollektiv aus Potsdam — gegründet 2024, gewachsen aus Freundschaft, Werkstattstaub und der Frage: Warum eigentlich nicht selber machen?",
    "kollektiv.text.diy": "Unsere Anlage haben wir selbst gebaut — Subwoofer, Hörner, alles. Unser Licht ist DMX aus eigener Hand, unsere Deko entsteht pro Motto neu.",
    "kollektiv.text.money": "Wir sind nicht gewinnorientiert — eher <em style=\"color: var(--ink)\">„nicht-Verlust-orientiert\"</em>. Deshalb sind unsere Events oft free, die Getränke solidarisch.",
    "kollektiv.familie.eyebrow": "Familie",
    "kollektiv.familie.h2": "Mit wem wir <span class=\"glow\">fliegen</span>",
    "kollektiv.familie.intro": "Kollektive, Häuser und Menschen, ohne die unsere Nächte nicht gehen würden.",
    "kollektiv.mitmachen.label": "Crew-Anwärter*innen gesucht",
    "kollektiv.mitmachen.text": "Bar, Einlass, Awareness, Deko-Bau oder Sani — klick deine Rolle an, wir schreiben zurück. takeoff wächst mit jeder Mission.",
    "kollektiv.booking.label": "Booking & Partner",
    "kollektiv.booking.text": "Eigenes Soundsystem, eigenes Licht, eingespielte Schicht-Crews und Erfahrung mit Genehmigungen — wir supporten auch andere Veranstaltungen.",

    /* ---------- Kollektiv-Seite: Blueprint-Blaetter BL. 01–07 (It. 8) ---------- */
    "kollektiv.rig.sub": "2× SUB · EIGENBAU '24/'25",
    "kollektiv.rig.top": "2× TOP · EIGENBAU '25",
    "kollektiv.rig.dmx": "DMX · EIGENBAU-PULT",
    "kollektiv.plate.werte": "BL. 01 · HALTUNG",
    "kollektiv.werte.eyebrow": "Haltung",
    "kollektiv.werte.h2": "Warum wir das <span class=\"glow\">tun</span>",
    "kollektiv.werte.intro": "Kein Businessplan — fünf Grundsätze, an denen wir jede Mission messen.",
    "kollektiv.wert.volunteer.title": "Ehrenamtlich",
    "kollektiv.wert.volunteer.text": "100% unbezahlt, aus Liebe zur Sache.",
    "kollektiv.wert.notforloss.title": "Nicht-Verlust-orientiert",
    "kollektiv.wert.notforloss.text": "Kein Gewinn, aber auch kein Draufzahlen.",
    "kollektiv.wert.awareness.title": "Awareness first",
    "kollektiv.wert.awareness.text": "Sicherheit ist Grundlage, keine Fußnote.",
    "kollektiv.wert.diy.title": "DIY",
    "kollektiv.wert.diy.text": "Anlage, Licht, Deko — alles aus eigener Hand.",
    "kollektiv.wert.open.title": "Offene Tür",
    "kollektiv.wert.open.text": "Free Entry, wo immer es geht.",
    "kollektiv.plate.finanzen": "BL. 02 · KASSENBUCH",
    "kollektiv.finanzen.eyebrow": "Kassenbuch",
    "kollektiv.finanzen.h2": "Wohin das Geld <span class=\"glow\">fliegt</span>",
    "kollektiv.finanzen.intro": "„Nicht-Verlust-orientiert\" ist kein Slogan — hier ist, wofür Einnahmen draufgehen.",
    "kollektiv.spend.rent": "Miete & Genehmigungen",
    "kollektiv.spend.decor": "Deko & Material",
    "kollektiv.spend.tech": "Technik-Pflege",
    "kollektiv.spend.awareness": "Awareness & Sani",
    "kollektiv.spend.reserve": "Rücklage",
    "kollektiv.finanzen.note": "Illustrative Werte, Stand {date} — wird durch echte Kassenzahlen ersetzt, sobald es eine feste Kassenführung gibt.",
    "kollektiv.plate.history": "BL. 03 · LOGBUCH · M 1:1",
    "kollektiv.history.eyebrow": "Logbuch",
    "kollektiv.history.h2": "Wie alles <span class=\"glow\">anfing</span>",
    "kollektiv.history.intro": "Kein Masterplan — nur eine kleine Gruppe, ein Lötkolben und die Idee, dass Potsdam mehr Trance verdient.",
    "kollektiv.plate.fotowand": "BL. 04 · FOTOWAND",
    "kollektiv.fotowand.eyebrow": "Fotowand",
    "kollektiv.fotowand.h2": "Momente",
    "kollektiv.fotowand.note": "Kein Foto ohne Frage — die Wand füllt sich, sobald alle Abgebildeten zugestimmt haben. Das ganze Team: {link}",
    "kollektiv.plate.crew": "BL. 05 · BESATZUNG",
    "kollektiv.orbit": "T+ {n} Tage im Orbit",
    "kollektiv.plate.familie": "BL. 06 · VERBUND",
    "kollektiv.plate.faq": "BL. 07 · BORDFRAGEN",
    "kollektiv.faq.eyebrow": "Bordfragen",
    "kollektiv.faq.h2": "Häufig <span class=\"glow\">gefragt</span>",
    "kollektiv.faq.verein.q": "Seid ihr ein eingetragener Verein?",
    "kollektiv.faq.verein.a": "Noch nicht — wir organisieren uns aktuell ohne feste Rechtsform, eine Vereinsgründung ist angedacht.",
    "kollektiv.faq.money.q": "Wie finanziert ihr euch?",
    "kollektiv.faq.money.a": "Über Spenden, Solipreise an der Bar und gelegentliche Türeinnahmen — nie gewinnorientiert.",
    "kollektiv.faq.join.q": "Kann ich ohne Erfahrung mitmachen?",
    "kollektiv.faq.join.a": "Ja. Bar, Einlass, Awareness, Deko-Bau — wir zeigen dir alles.",
    "kollektiv.faq.booking.q": "Bucht ihr auch andere Partys?",
    "kollektiv.faq.booking.a": "Ja, wir unterstützen mit Technik, Licht und eingespielten Crews — schreib uns.",
    "kollektiv.role.bar": "Bar",
    "kollektiv.role.einlass": "Einlass",
    "kollektiv.role.deko": "Deko-Bau",
    "kollektiv.role.sani": "Sani",
    "kollektiv.mitmachen.direct": "Lieber direkt reden? {telegram} oder {mail}.",
    "kollektiv.booking.tech.label": "Technik",
    "kollektiv.booking.tech.text": "2 Subwoofer + 2 Tops, selbstgebaut",
    "kollektiv.booking.light.label": "Licht",
    "kollektiv.booking.light.text": "Eigenes DMX-Setup, Schwarzlicht, Tubes",
    "kollektiv.booking.experience.label": "Erfahrung",
    "kollektiv.booking.experience.text": "{n} Missionen seit {year}",
    "kollektiv.booking.permits.label": "Genehmigungen",
    "kollektiv.booking.permits.text": "Erfahren im Umgang mit Ordnungsamt & Stadt",
    "kollektiv.booking.presskit": "Presskit folgt: {mail}",

    /* ---------- Awareness-Seite (awareness.html) ---------- */
    "awareness.hero.intro": "Awareness ist bei uns kein Aushang, sondern gelebte Praxis: eigenes Team, eigene Ersthelfer*innen, Free Water — auf jeder einzelnen Mission. Wir sagen ehrlich: Safer Space, nicht Safe Space. Aber wir tun alles dafür.",
    "awareness.help.eyebrow": "Hilfe & Notfall",
    "awareness.help.h2": "Wenn's ernst wird",
    "awareness.help.row.emergency": "Notruf",
    "awareness.help.emergency.text": "bei jedem medizinischen Notfall, ohne Zögern",
    "awareness.help.row.at_event": "Am Event",
    "awareness.help.at_event.text": "Awareness-Team & Sanis ansprechen — oder irgendwen von der Crew, wir sind vernetzt",
    "awareness.help.row.after": "Danach",
    "awareness.help.after.text": "Ist etwas passiert? Schreib uns:",
    "awareness.help.row.principle": "Grundsatz",
    "awareness.help.principle.text": "<b>Hilfe holen hat nie Konsequenzen.</b> Für niemanden. Nie.",
    "awareness.transmission.text": "Die ausführliche Seite zu <b>Drogennotfällen</b> entsteht gerade — mit Erste-Hilfe-Schritten, Warnzeichen und Links zu drugscouts & mindzone. Wir positionieren uns nicht gegen euch, sondern für eure Sicherheit.",
    "awareness.rules.h2": "Kurz & klar",
    "awareness.rule.consent": "Konsens ist Pflicht",
    "awareness.rule.no_discrimination": "Keine Diskriminierung",
    "awareness.rule.no_photo": "Kein Foto ohne Frage",
    "awareness.rule.age": "18+ mit Ausweis",
    "awareness.rule.ko": "Zero Tolerance bei K.-o.-Substanzen",
    "awareness.rule.reachable": "Awareness ist ansprechbar",
    "awareness.rules.text": "Wer Grenzen verletzt, fliegt — ohne Diskussion. Es gelten zusätzlich die Regeln der jeweiligen Location (z. B. der freiLand-Grundkonsens im Spartacus). Das vollständige Awareness-Konzept veröffentlichen wir hier, sobald es mit dem ganzen Team abgestimmt ist.",

    /* ---------- Team-Seite (team.html) ---------- */
    "team.eyebrow": "Teamboard",
    "team.h1": "Die <span class=\"glow\">Crew</span>",
    "team.intro": "takeoff ist Kollektivarbeit: Jede Nacht entsteht aus vielen Händen. Fotos folgen, sobald alle einverstanden sind — bis dahin: Rollen & Aufgaben.",
    "team.photoboard.label": "Foto-Board folgt",
    "team.photoboard.text": "Das Team-Fotoboard kommt, sobald alle Abgebildeten zugestimmt haben — Consent gilt auch für uns selbst. Du willst aufs Board? {link}",

    /* ---------- News / Mission Log (news.html) ---------- */
    "news.h1": "Was gerade <span class=\"glow\">passiert</span>",
    "news.intro": "Kein Blog, kein Geschwafel — kurze Funksprüche aus der Werkstatt und von den Floors. Ausführliche Posts gibt's auf Instagram, hier verlinkt.",
    "news.badge.announcement": "Announcement",
    "news.badge.buildlog": "Baulog",
    "news.badge.recap": "Recap",
    "news.insta.post": "Instagram-Post ansehen · lädt erst nach Klick",
    "news.insta.recap": "Instagram-Recap ansehen · lädt erst nach Klick",
    "news.transmission.text": "Instagram-Posts laden erst nach Klick (Zwei-Klick, DSGVO-freundlich) — im Prototyp als Demo-Knopf. Neue Einträge kommen später direkt aus dem Admin-Dashboard.",

    /* ---------- Musik-Seite (musik.html) ---------- */
    "musik.eyebrow": "Frequenzkunde",
    "musik.h1": "Was läuft hier <span class=\"glow\">eigentlich</span>?",
    "musik.intro": "Nie von Hard Bounce gehört? Macht nichts — dafür gibt's diese Seite. Drei Minuten Lesezeit, dann weißt du, was dich auf dem Floor erwartet.",
    "musik.row.bounce": "Bounce / Hard Bounce",
    "musik.trance.text": "Hypnotische Melodien, lange Spannungsbögen, Gänsehaut-Momente. <b>~{bpm} BPM</b> · das Herz von takeoff",
    "musik.hard_trance.text": "Trance mit Schub: härtere Kicks, treibender, euphorischer. <b>~{bpm} BPM</b>",
    "musik.bounce.text": "Federnde Offbeat-Bässe, gute Laune mit Wumms. <b>~{bpm} BPM</b>",
    "musik.techno.text": "Der gerade, dunkle Puls — bei uns als Gastgeschenk befreundeter Kollektive",
    "musik.psytrance.text": "Wenn's spät wird und die Muster tanzen. Gelegentlich, mit Liebe",
    "musik.outro": "Reinhören? Auf der {link} liegen Sets aus echten takeoff-Nächten — und der „| takeoff\"-Podcast liefert Nachschub.",

    /* ---------- Kalender-Seite (kalender.html) ---------- */
    "kalender.eyebrow": "Immer aktuell",
    "kalender.h1": "Der <span class=\"glow\">Eventkalender</span>",
    "kalender.intro": "Einmal abonnieren, für immer aktuell: Der Kalender-Feed aktualisiert sich selbst, wenn wir Termine ändern — in Google Kalender, Apple Kalender und Outlook.",
    "kalender.cta.subscribe": "＋ Kalender abonnieren (webcal)",
    "kalender.cta.single_ics": "Einzeltermin als .ics",
    "kalender.howto.label": "So funktioniert das Abo",
    "kalender.howto.text": "<b>Google Kalender:</b> Einstellungen → „Kalender hinzufügen\" → „Per URL\" → unsere Feed-Adresse einfügen. <b>iPhone/Mac & Outlook:</b> webcal-Link antippen, fertig. Danach erscheinen neue takeoff-Termine automatisch bei dir — ohne dass du irgendwas tun musst. (Im Prototyp Demo; der echte Feed wird automatisch aus der Event-Datenbank erzeugt.)",

    /* ---------- Kontakt-Seite (kontakt.html) ---------- */
    "kontakt.eyebrow": "Funkkontakt",
    "kontakt.h1": "Sag <span class=\"glow\">Hallo</span>.",
    "kontakt.intro": "Ein Postfach, echte Menschen dahinter. Wir sind ehrenamtlich — gib uns ein paar Tage, dann kommt was zurück. Für schnelle Fragen rund um Events ist Telegram der Turbo.",
    "kontakt.row.general": "Allgemein",
    "kontakt.row.booking": "Booking / Artists",
    "kontakt.booking.text": "Demo-Link oder Anfrage per Mail — Betreff „Booking\"",
    "kontakt.row.press": "Presse / Partner",
    "kontakt.press.text": "Mail mit Betreff „Presse\" · Presskit folgt",
    "kontakt.awareness.text": "Ist auf einem Event etwas passiert? Schreib uns — wir lesen sensibel und vertraulich.",
    "kontakt.row.lost": "Fundsachen",
    "kontakt.lost.text": "Was liegen geblieben? Sag uns Event + Beschreibung.",
    "kontakt.row.fast": "Schnell",
    "kontakt.fast.text": "— Fragen einfach reinschreiben",
    "kontakt.cta.mail": "Mail schreiben",
    "kontakt.cta.telegram": "Telegram öffnen",

    /* ---------- Rechtsseiten (impressum.html, datenschutz.html) ----------
       legal.binding_note gehoert auf BEIDE Seiten. Die englische Fassung ist
       Verstaendnishilfe, keine Rechtsuebersetzung — siehe Anhang, Abschnitt 8. */
    "legal.eyebrow": "Rechtliches",
    "legal.binding_note": "Verbindlich ist die deutsche Fassung dieser Seite.",
    "impressum.intro": "Pflichtangaben nach §5 TMG / §18 MStV. (Prototyp: Platzhalter, bis die Rechtsform geklärt ist.)",
    "impressum.row.provider": "Anbieter",
    "impressum.provider.name": "takeoff Kollektiv",
    "impressum.provider.text": "Rechtsform in Klärung",
    "impressum.row.address": "Anschrift",
    "impressum.address.text": "c/o {tbd} · Potsdam",
    "impressum.row.visdp": "V. i. S. d. P.",
    "impressum.credits.label": "Credits",
    "impressum.credits.text": "Mondkarten: NASA/GSFC Scientific Visualization Studio (CGI Moon Kit, gemeinfrei). Mars-Boden: Courtesy NASA/JPL-Caltech (gemeinfrei). Schriften: Planet Kosmos (Planet Typography), Unbounded, Space Grotesk, Space Mono (SIL OFL). Diese Seite lädt nichts von Drittservern.",
    "datenschutz.intro": "Die Kurzfassung: Diese Seite setzt keine Cookies, lädt nichts von Drittservern und legt keine Profile an. Die Langfassung folgt unten — sie ist erfreulich kurz.",
    "datenschutz.row.cookies": "Cookies",
    "datenschutz.cookies.text": "<b>Keine.</b> Deine FX-/Theme-Wahl bleibt nur lokal in deinem Browser (localStorage, verlässt dein Gerät nie)",
    "datenschutz.row.tracking": "Tracking",
    "datenschutz.tracking.text": "<b>Keins.</b> Keine Analytics-Pixel, keine Fingerprints, keine Werbenetzwerke",
    "datenschutz.row.thirdparty": "Drittserver",
    "datenschutz.thirdparty.text": "Schriften, Bilder, Skripte: alles liegt bei uns. SoundCloud/YouTube/Instagram laden <b>erst nach deinem Klick</b> (Zwei-Klick-Lösung)",
    "datenschutz.row.maps": "Karten",
    "datenschutz.maps.text": "Keine eingebetteten Karten — Routen öffnen als Link in deiner eigenen Karten-App",
    "datenschutz.row.logs": "Server-Logs",
    "datenschutz.logs.text": "Technisch übliche Zugriffslogs beim Hoster [Details folgen mit Hosting-Entscheidung]",
    "datenschutz.row.rights": "Deine Rechte",
    "datenschutz.rights.text": "Auskunft, Berichtigung, Löschung — schreib an {mail}",
    "datenschutz.row.photos": "Fotos",
    "datenschutz.photos.text": "Auf Events gilt Fotoverbot; veröffentlichte Fotos nur mit Einverständnis. Du bist auf einem Bild und willst das nicht? Eine Mail genügt — wir nehmen es runter",
    "datenschutz.proto_note": "[Prototyp-Gerüst — die finale Datenschutzerklärung wird vor Launch juristisch geprüft.]",

    /* ---------- JS-Laufzeit (assets/js/main.js) ---------- */
    "js.countdown.liftoff": "LIFTOFF",
    "js.countdown.running": "· läuft!",
    "js.countdown.unit.d": "d",
    "js.countdown.unit.h": "h",
    "js.countdown.unit.m": "m",
    "js.countdown.unit.s": "s",
    "js.toast.all_found": "🦄 Alle {total} Verstecke gefunden — Crew-Material!",
    "js.toast.found": "✨ Versteck gefunden — {n}/{total} Themes",
    "js.toast.already": "Schon entdeckt 🤫 — wechsel mal das Theme …",
    "js.toast.share_copied": "Link kopiert ✓",
    "js.toast.patch_saved": "Patch gespeichert — {count}/{total} Missionen",
    "js.toast.patch_reset": "Patches zurückgesetzt",
    "js.bpm.match": "Du tickst wie {genre} ({range} BPM)",
    "js.bpm.slower": "Ruhiger als {genre} — aber am nächsten dran",
    "js.bpm.faster": "Schneller als jedes Genre hier — Atempause? 😅",

    /* ==========================================================================
       ══════════════════ CMS-GRENZE ═══════════════════════════════════════════

       Ab hier: INHALTSDATEN, keine UI-Strings.

       Alles darueber beschreibt das Interface und wandert spaeter nicht in ein
       CMS. Alles darunter (Events, Flight Log, Artists, Partner) sind Datensaetze,
       die eines Tages aus einem Redaktionssystem kommen — pro Datensatz ein
       uebersetzbares Feld. Die Praefixe sind bewusst andere:
         event.<id>.<feld>   kommende Events, IDs: pwest · mars · strand
         flog.<id>.<feld>    vergangene Events (Flight Log)
         artist.<id>.<feld>  Personen & Acts
         venue.<id>.<feld>   Orte
         partner.<id>        Kollektive & Haeuser

       Uebersetzungsregel fuer diesen Block: Eigennamen bleiben stehen,
       beschreibende Felder werden uebersetzt.
       ══════════════════════════════════════════════════════════════════════════
       ========================================================================== */

    /* ---------- Event pwest — Open Air: Freiräume (12.09.) ---------- */
    "event.pwest.title": "Open Air: Freiräume",
    "event.pwest.venue": "Bastion am Schillerplatz",
    "event.pwest.city": "Potsdam West",
    "event.pwest.location_note": "Potsdam West · Grünfläche",
    "event.pwest.price": "Free",
    "event.pwest.genres": "Techno · Trance",
    "event.pwest.note": "mit Schranzverbot & Stadtjugendring",
    "event.pwest.brief": "Thema „Freiräume\" — Open Air mit dem Kollektiv Schranzverbot & dem Stadtjugendring. Tagsüber, draußen, für alle.",

    /* ---------- Event pwest — Detailseite event-freiraeume.html ---------- */
    "event.pwest.headline": "freiräume",
    "event.pwest.subtitle": "Open Air · mit Schranzverbot & Stadtjugendring",
    "event.pwest.brief_long": "Freie Räume für freie Beats: Zusammen mit dem Kollektiv <b>Schranzverbot</b> und dem <b>Stadtjugendring Potsdam</b> bespielen wir die Grünfläche an der Bastion — offiziell genehmigt, solidarisch organisiert, offen für alle. Techno und Trance, solange die Sonne mitspielt.",
    "event.pwest.no_presale": "Kein VVK — einfach vorbeikommen. Tagsüber, draußen, für alle.",
    "event.pwest.sound_note": "Techno · Trance — zwei Kollektive, eine Anlage",
    "event.pwest.audience": "Alle Altersgruppen — Open Air am Tag",
    "event.pwest.weather": "Bei Sturm/Unwetter: Update im Telegram & hier",
    "event.pwest.awareness_note": "Team in <b>lila Westen</b> + Ersthelfer*innen vor Ort · Free Water",

    /* ---------- Event mars — takeoff: Marsmission (19.09.) ---------- */
    "event.mars.title": "takeoff: Marsmission",
    "event.mars.headline": "marsmission",
    "event.mars.subtitle": "takeoff goes red planet",
    "event.mars.venue": "Spartacus",
    "event.mars.city": "Potsdam",
    "event.mars.venue_note": "im freiLand",
    "event.mars.transit": "5 min zu Fuß vom Hbf",
    "event.mars.price": "Free Entry",
    "event.mars.genres": "Trance · Hard Trance · Bounce",
    "event.mars.genres_slash": "Trance / Hard Trance / Bounce",
    "event.mars.note": "Free Entry · 18+",
    "event.mars.brief": "Wir schießen den Spartacus auf den roten Planeten — Pappmaché-Mars, Schwarzlicht, Leuchtschläuche als Weltraum-Materie.",
    "event.mars.brief_long": "Wir schießen den Spartacus auf den roten Planeten: selbstgebauter Pappmaché-Mars überm Floor, Schwarzlicht, Leuchtschläuche als Weltraum-Materie — und ein Abend lang Trance, Hard Trance und Bounce bis der Sauerstoff alle ist. Free Entry, weil Raves allen gehören.",
    "event.mars.doors_note": "Einlassstopp möglich — komm früh",

    /* ---------- Event strand — takeoff: Strandparty (14.11.) ---------- */
    "event.strand.title": "takeoff: Strandparty",
    "event.strand.venue": "Spartacus",
    "event.strand.city": "Potsdam",
    "event.strand.price": "TBA",
    "event.strand.genres": "Trance · Hard Bounce",
    "event.strand.teaser": "Cocktails gegen den Novemberregen",
    "event.strand.note": "Arbeitstitel · Cocktails gegen den Novemberregen",
    "event.strand.motto": "Strandparty",
    "event.strand.motto_note": "(Arbeitstitel)",
    "event.strand.brief": "Sommer mitten im November. Lineup, Zeiten und Deko-Geheimnisse gibt's zuerst im Telegram-Kanal.",

    /* ---------- Orte ---------- */
    "venue.spartacus.name": "Spartacus",
    "venue.spartacus.address": "Friedrich-Engels-Straße 22 · 14473 Potsdam (im freiLand)",
    "venue.spartacus.hint": "≈ 5 Minuten zu Fuß vom Potsdam Hbf",
    "venue.spartacus.hint_short": "5 Min zu Fuß vom Potsdam Hbf",
    "venue.bastion.name": "Bastion am Schillerplatz",
    "venue.bastion.address": "Grünfläche, Potsdam West",
    "venue.bastion.hint": "Tram bis Schillerplatz · Fahrrad ausdrücklich erwünscht",
    "venue.bastion.hint_short": "Tram bis Schillerplatz · Fahrrad erwünscht",

    /* ---------- Flight Log: vergangene Missionen ---------- */
    "flog.m6.name": "Pride-Party",
    "flog.m6.venue": "KuZe · 3 Floors",
    "flog.m6.note": "40 °C, Sturm, Demo abgesagt — Party fand trotzdem statt. „Bestes Event, das wir je hatten.\"",

    /* ---------- Pride-Party: Recap-Seite event-pride.html ---------- */
    "flog.m6.headline": "pride-party",
    "flog.m6.subtitle": "Mission M6 · abgeschlossen",
    "flog.m6.venue_name": "KuZe",
    "flog.m6.city": "Potsdam",
    "flog.m6.floors": "3 Floors",
    "flog.m6.price": "Free Entry",
    "flog.m6.thanks": "Danke an alle, die da waren, geholfen und aufeinander aufgepasst haben. ♥",
    "flog.m6.debrief": "40 °C, Sturmwarnung, die Demo wurde abgesagt — die Party nicht. Drei Floors („3 stages of love\"), Free Water gegen die Hitze, Sonnensegel-Abbau im Sturm, und am Ende der Satz, der bleibt: <em>„Bestes Event, das wir je hatten.\"</em>",
    "flog.m5.name": "Free Entry Rave",
    "flog.m5.venue": "Spartacus",
    "flog.m5.note": "Lokales Lineup A–Z, Eintritt auf Spendenbasis, Feuerschale & Steinofen-Pizza.",
    "flog.m4.name": "Unser größtes Event",
    "flog.m4.venue": "Spartacus",
    "flog.m3.name": "Spartacus-Nacht",
    "flog.m3.venue": "Spartacus",
    "flog.m3.note": "Antike trifft Trance — brennender Schriftzug überm Tempel.",
    "flog.m2.name": "Out of Space",
    "flog.m2.venue": "Nilkeller",
    "flog.m2.note": "Einlassstopp bei 200 — der Keller war voll.",
    "flog.m1.name": "Sky High",
    "flog.m1.venue": "Potsdam",
    "flog.m1.note": "Der erste takeoff. Hier ging alles los.",

    /* ---------- Bau-Logbuch (kollektiv.html #history) — eigener Datensatz ---------- */
    "hist.t0.name": "Die Gründung",
    "hist.t0.venue": "Potsdam",
    "hist.t0.dim": "GRÜNDUNG",
    "hist.t0.note": "Eine kleine Gruppe um Nico — heute besser bekannt als DJ Platzhalter — beschließt: Wir machen das selbst.",
    "hist.s1.name": "Der erste Subwoofer",
    "hist.s1.venue": "Werkstatt",
    "hist.s1.dim": "1× SUB",
    "hist.s1.note": "Selbst gesägt, selbst verleimt, selbst verkabelt.",
    "hist.s2.name": "Zwei Hörner obendrauf",
    "hist.s2.venue": "Werkstatt",
    "hist.s2.dim": "+2 TOP",
    "hist.s2.note": "Die magentafarbenen Tops komplettieren den ersten Stack.",
    "hist.s3.name": "Noch ein Subwoofer",
    "hist.s3.venue": "Werkstatt",
    "hist.s3.dim": "2× SUB",
    "hist.s3.note": "Mehr Fläche, mehr Menschen, mehr Bass.",
    "hist.l1.name": "Eigenes Licht",
    "hist.l1.venue": "DMX-Pult",
    "hist.l1.dim": "DMX · 512CH",
    "hist.l1.note": "Mik — als „Blaulicht\" unterwegs — baut die Lichttechnik auf.",
    "hist.now.date": "Heute",
    "hist.now.name": "Themen-Welten",
    "hist.now.venue": "Potsdam & Umgebung",
    "hist.now.dim": "LIVE",
    "hist.now.note": "Jedes Event bekommt sein eigenes Universum. Weiter geht's im {link}.",

    /* ---------- Artists & Acts ---------- */
    "artist.jojo.name": "JOJO",
    "artist.jojo.genres": "Hard Trance · Bounce",
    "artist.jojo.genres_slash": "Hard Trance / Bounce",
    "artist.jojo.initials": "JO",
    "artist.platzhalter.name": "DJ Platzhalter",
    "artist.platzhalter.initials": "PL",
    "artist.cyonic.name": "Cyonic",
    "artist.cyonic.genres": "Techno · Trance",
    "artist.cyonic.genres_slash": "Techno / Trance",
    "artist.cyonic.initials": "CY",
    "artist.molly.name": "mølly (on molly)",
    "artist.jojo.tagline": "Hard Trance · Bounce · Resident",
    "artist.jojo.podcast_ep": "„JOJO | takeoff\" · Folge 1",
    "artist.cyonic.tagline": "Techno · Trance · seit Tag 1",
    "artist.cyonic.since": "von der ersten Mission an",
    "artist.platzhalter.tagline": "Trance · Resident · Mitgründer",
    "artist.platzhalter.role": "Resident & Mitgründer",
    "artist.platzhalter.role_note": "(Nico)",
    "artist.platzhalter.founding": "Hat takeoff {year} mit aufgebaut",
    "artist.takeoff_crew.name": "takeoff-Crew",

    /* ---------- Gäste-Log ---------- */
    "guest.mimi404": "MIMI404",
    "guest.senaida": "SENAIDA",
    "guest.cedric_lawrence": "Cedric Lawrence",
    "guest.dj_trancesetter": "DJ Trancesetter",
    "guest.dj_loveletter": "DJ Loveletter",
    "guest.jacky_ickx": "Jacky Ickx",
    "guest.dj_st4rlight": "dj st4rlight",
    "guest.flava": "FLAVA",
    "guest.ochser": "ochser",
    "guest.emmy": "Emmy",
    "guest.kolja": "Kolja",

    /* ---------- Partner / Familie ---------- */
    "partner.schranzverbot": "Schranzverbot",
    "partner.no_gravity": "No Gravity Berlin",
    "partner.spartacus": "Spartacus",
    "partner.freiland": "freiLand Potsdam",
    "partner.kuze": "KuZe",
    "partner.nilkeller": "Nilkeller",
    "partner.stadtjugendring": "Stadtjugendring Potsdam",
    "partner.regenbogen": "Regenbogen Potsdam e.V.",

    /* ---------- Partner: Rolle im Verbund (kollektiv.html #familie) ---------- */
    "partner.schranzverbot.note": "Co-Host Open Air „Freiräume\"",
    "partner.no_gravity.note": "Partner-Kollektiv Berlin",
    "partner.spartacus.note": "Zweite Heimat im freiLand",
    "partner.kuze.note": "Location Pride-Party",
    "partner.stadtjugendring.note": "Genehmigungs-Partner „Freiräume\"",

    /* ---------- Mission-Log-Eintraege (news.html) ---------- */
    "post.freiraeume.title": "Genehmigung ist da — Open Air „Freiräume\" am {date}! 🎉",
    "post.freiraeume.text": "Die Stadt hat die Fläche an der Bastion am Schillerplatz bestätigt. {time}, free, mit Schranzverbot & Stadtjugendring.",
    "post.marsbau.title": "Der Mars nimmt Form an",
    "post.marsbau.text": "Hühnerdraht, Kleister, Schwarzlichtfarbe: Unser Planet für die Marsmission ist im Bau. Materialkosten: {amount}. Künstlerische Freiheit: unbezahlbar.",
    "post.pride.title": "Pride-Party: 40 °C, Sturm — und trotzdem die beste Nacht",
    "post.pride.text": "Demo abgesagt, Party nicht. Drei Floors im KuZe, Sonnensegel-Krimi inklusive. Danke an alle, die da waren und aufeinander aufgepasst haben. ♥",
    "post.podcast1.title": "„JOJO | takeoff\" — Folge 1 ist draußen",
    "post.podcast1.text": "Unsere Podcast-Serie startet: für alle, die ihre Ohren in exquisitem Trance baden wollen. Auf YouTube & SoundCloud.",
    "post.rig.title": "Vom ersten Subwoofer zur eigenen Anlage",
    "post.rig.text": "Erst ein Sub, dann zwei Hörner, dann noch ein Sub — Stück für Stück selbst gebaut, bis der Keller wackelte. Die ganze Geschichte steht im {link}.",
  },

  /* ==========================================================================
     ENGLISCH
     ========================================================================== */
  en: {

    /* ---------- Gemeinsame Bausteine ---------- */
    "common.time": "{time}",
    "common.timerange": "{start}–{end}",
    "common.time_from": "from {time}",
    "common.end_at": "ends {time}",
    "common.since_year": "since {year}",
    "common.since_day_one": "since day one",
    "common.details_follow": "Details to follow",
    "common.more": "More:",
    "common.more_on_this": "More on this:",
    "common.about_us": "About us",
    "common.mail": "email",
    "common.age_18": "18+",
    "common.open_end": "open end",

    /* ---------- Gemeinsame Bausteine — Nachtrag It. 8 ---------- */
    "common.start_at": "starts {time}",
    "common.details": "Details",
    "common.note_label": "Note",
    "common.reset": "Reset",
    "common.share": "Share",
    "common.podcast": "Podcast",
    "common.floor": "Floor {n}",
    "common.all_floors": "all floors",
    "common.placeholder": "[placeholder]",
    "common.tbd": "[to be added]",
    "common.demo": "Demo",
    "common.demo_download": "Demo — the real download comes with the backend",
    "common.demo_feed": "Demo — the real feed comes with the backend",

    /* ---------- Meta ---------- */
    "meta.index.title": "takeoff — rave collective potsdam · design prototype",
    "meta.index.desc": "takeøff — volunteer-run rave collective from Potsdam. Trance · Hard Trance · Bounce. Design prototype.",
    "meta.events.title": "Events & missions · takeoff potsdam",
    "meta.events.desc": "Every takeoff event: the missions coming up and the flight log of the nights behind us.",
    "meta.artists.title": "Artists & sets · takeoff potsdam",
    "meta.artists.desc": "Residents, guests, sets and the takeoff podcast — the frequencies of the collective.",
    "meta.kollektiv.title": "Collective · takeoff potsdam",
    "meta.kollektiv.desc": "Who takeoff is: a volunteer-run rave collective from Potsdam. Self-built sound system, themed decor, awareness as an attitude.",
    "meta.awareness.title": "Awareness & help · takeoff potsdam",
    "meta.awareness.desc": "Awareness at takeoff: the team, trained first aiders, free water, house rules — and where to get help.",
    "meta.event.mars.title": "takeoff: Mars Mission · {date} · Spartacus Potsdam",
    "meta.event.mars.desc": "takeoff: Mars Mission — {date}, Spartacus Potsdam. Free entry. Trance / Hard Trance / Bounce. 18+.",

    /* ---------- Meta: die zwoelf neuen Seiten ---------- */
    "meta.event.pwest.title": "Open Air: Free Spaces · {date} · takeoff potsdam",
    "meta.event.pwest.desc": "Open Air \"Free Spaces\" with Schranzverbot & Stadtjugendring — {date}, Bastion am Schillerplatz, {time}, free.",
    "meta.event.pride.title": "Pride Party · Recap · takeoff potsdam",
    "meta.event.pride.desc": "A recap of the Pride Party at KuZe on {date} — three floors, 40 degrees, one of the best nights we've had.",
    "meta.team.title": "Team · takeoff potsdam",
    "meta.team.desc": "Who does what at takeoff — DJs, lights, decor, awareness, first aid, organising.",
    "meta.news.title": "News · Mission Log · takeoff potsdam",
    "meta.news.desc": "What's going on at takeoff: build logs, announcements, recaps and podcast releases.",
    "meta.musik.title": "Our sound · takeoff potsdam",
    "meta.musik.desc": "Trance, Hard Trance, Bounce — what they are and how they sound.",
    "meta.kalender.title": "Event calendar · takeoff potsdam",
    "meta.kalender.desc": "Every takeoff date — subscribe once, never miss an event again.",
    "meta.kontakt.title": "Contact · takeoff potsdam",
    "meta.kontakt.desc": "Write to us — general, booking, press, awareness or lost property.",
    "meta.impressum.title": "Imprint · takeoff potsdam",
    "meta.impressum.desc": "Provider information for the takeoff website.",
    "meta.datenschutz.title": "Privacy · takeoff potsdam",
    "meta.datenschutz.desc": "In short: this site doesn't track you. The details are here.",
    "meta.artist.jojo.title": "JOJO · Artist · takeoff potsdam",
    "meta.artist.jojo.desc": "JOJO — Hard Trance · Bounce · resident at takeoff.",
    "meta.artist.cyonic.title": "Cyonic · Artist · takeoff potsdam",
    "meta.artist.cyonic.desc": "Cyonic — Techno · Trance · at takeoff since day one.",
    "meta.artist.platzhalter.title": "DJ Placeholder · Artist · takeoff potsdam",
    "meta.artist.platzhalter.desc": "DJ Placeholder — Trance · resident · co-founder of takeoff.",

    /* ---------- Zugaenglichkeit ---------- */
    "a11y.skiplink": "Skip to content",
    "a11y.brand": "takeoff — back to the start page",
    "a11y.nav.main": "Main navigation",
    "a11y.burger.open": "Open menu",
  "a11y.daymode": "Day mode",
  "nav.news": "News",
  "nav.kalender": "Calendar",
    "a11y.burger.close": "Close menu",
    "a11y.marquee.events": "Upcoming events",
    "a11y.tminus.index": "Countdown to the next event",
    "a11y.tminus.event": "Countdown",
    "a11y.mctrl": "Display settings",
    "a11y.sticky": "Event at a glance",
    "a11y.secret": "Hidden item",
    "a11y.set.play": "Play set: {artist}",
    "a11y.podcast.play": "Play podcast: {artist}",
    "a11y.set.play_plain": "Play set",
    "a11y.bpm.pad": "Tap along to the beat — tap tempo tool",
    "a11y.flog.pin": "I was there — {event}",
    "a11y.join.roles": "Roles you can take on",

    /* ---------- Topbar ---------- */
    "topbar.hud.telegram": "TELEGRAM ↗",
    "topbar.hud.back": "← Base",
    "topbar.marquee.next_launch": "NEXT LAUNCH →",
    "topbar.marquee.mission_status": "MISSION STATUS:",
    "topbar.marquee.boarding": "BOARDING",
    "topbar.marquee.crew_aboard": "CREW ABOARD:",
    "topbar.marquee.tba_more": "+TBA",

    /* ---------- Navigation ---------- */
    "nav.brand": "takeoff",
    "nav.events": "Events",
    "nav.artists": "Artists",
    "nav.kollektiv": "Collective",
    "nav.awareness": "Awareness",
    "menu.label": "Menu",

    /* ---------- Overlay-Menue ---------- */
    "menu.eyebrow": "Onboard computer · Navigation",
    "menu.events.note": "{n} coming up",
    "menu.artists.note": "Sets & podcasts",
    "menu.kollektiv.note": "Who's on air",
    "menu.awareness.note": "Help & rules",
    "menu.flightlog.label": "Flight Log",
    "menu.flightlog.note": "Archive",
    "menu.next.label": "Next Launch",
    "menu.go": "Take a look →",
    "menu.close": "Close",

    /* ---------- Overlay-Menue: drei neue Eintraege (It. 8) ---------- */
    "menu.news.label": "News",
    "menu.news.note": "Mission Log",
    "menu.kalender.label": "Calendar",
    "menu.kalender.note": "Subscribe & dates",
    "menu.kontakt.note": "Write to us",

    /* ---------- Social ---------- */
    "social.instagram": "Instagram",
    "social.telegram": "Telegram",
    "social.soundcloud": "SoundCloud",
    "social.tiktok": "TikTok",
    "social.email": "info@takeoff-potsdam.de",

    /* ---------- Hero ---------- */
    "hero.pretitle": "rave collective · potsdam · est. 2024",
    "hero.tagline": "We build our own sound system, our own decorations and our own nights.<br><b>Trance · Hard Trance · Bounce</b> — volunteer-run, DIY, for everyone.",
    "hero.tminus.label": "T-Minus",
    "hero.scrollhint": "Scroll to board",
    "hero.next.meta": "{venue}, {city} · {note}",
    "hero.cta.missions": "Upcoming missions →",
    "hero.cta.telegram": "Telegram · presale & info",

    /* ---------- Missionen / Event-Karten ---------- */
    "missions.eyebrow": "Flight plan",
    "missions.h2": "Upcoming <span class=\"glow\">missions</span>",
    "missions.intro": "Every takeoff event has a theme — and the whole site dresses to match. Tap a card for the briefing.",
    "missions.headlink": "All events & flight log",
    "card.briefing": "Briefing",
    "card.row.boarding": "Boarding",
    "card.row.landing": "Landing site",
    "card.row.entry": "Entry",
    "card.row.sound": "Sound",
    "card.row.status": "Status",
    "card.row.motto": "Theme",
    "card.cta.telegram_updates": "Updates on Telegram",
    "card.cta.mission_page": "To the mission page",
    "card.cta.telegram_first": "Telegram · hear it first",
    "status.announced": "Announced",
    "status.tba": "TBA 🤫",
    "status.prep": "In preparation",
    "status.departed": "Departed",

    /* ---------- Genres ---------- */
    "genre.trance": "Trance",
    "genre.hard_trance": "Hard Trance",
    "genre.bounce": "Bounce",
    "genre.hard_bounce": "Hard Bounce",
    "genre.techno": "Techno",
    "genre.hardtekk": "Hardtekk",
    "genre.psytrance": "Psytrance",
    "chip.open_air": "Open Air",

    /* ---------- Sound / Sets ---------- */
    "sound.eyebrow": "Frequencies",
    "sound.h2": "Our <span class=\"glow\">sound</span>",
    "sound.intro": "From hypnotic to hard: this is what we play — and these are the people behind the decks. Sets & podcasts live on SoundCloud and YouTube.",
    "sound.headlink": "All artists & sets",
    "sets.liveset.title": "DJ Placeholder — Live @ Spartacus",
    "sets.liveset.kind": "Live set",
    "sets.guest.title": "mølly (on molly) — Live @ Spartacus",
    "sets.guest.kind": "Guest set",
    "sets.podcast.title": "JOJO | takeoff Podcast #1",
    "sets.podcast.kind": "Series · YouTube & SoundCloud",
    "sets.consent.soundcloud": "Demo: the SoundCloud player would load here (two-click, GDPR-friendly). No click = no tracking.",
    "sets.consent.soundcloud_short": "Demo: the SoundCloud player would load here (two-click, GDPR-friendly).",
    "sets.consent.youtube": "Demo: the YouTube player would load here (two-click, GDPR-friendly).",
    "sets.consent.player": "Demo: the player would load here (two-click, GDPR-friendly).",
    "sets.cyonic_b2b.title": "Cyonic B2B Niico — Out of Space",

    /* ---------- Crew ---------- */
    "crew.eyebrow": "Crew Select",
    "crew.h2": "Who's <span class=\"glow\">on air</span>",
    "crew.intro": "Residents, lights, sound, awareness, decor — takeoff is collective work. (Prototype: placeholder avatars, real profiles will follow with consent.)",
    "crew.headlink": "More about the collective",
    "crew.role.dj_resident": "DJ · Resident",
    "crew.role.dj": "DJ",
    "crew.light.name": "Light & decor",
    "crew.light.role": "DMX · tubes · props",
    "crew.awareness.name": "Awareness team",
    "crew.awareness.role": "Here for you · every night",
    "crew.sani.name": "Medic team",
    "crew.sani.role": "Trained first aiders · on site",

    /* ---------- Crew: Besatzungs-Kacheln auf kollektiv.html & team.html ---------- */
    "crew.role.dj_day_one": "DJ · since day one",
    "crew.nico.name": "Nico · DJ Placeholder",
    "crew.nico.role": "Co-founder · organising · DJ",
    "crew.mik.name": "Mik · Blaulicht",
    "crew.mik.role": "Lighting · DMX · DJ",
    "crew.awareness.role_vests": "Purple vests · there to talk to",
    "crew.sani.role_roaming": "First aiders · doing the rounds",
    "crew.deko.name": "Decor & build",
    "crew.deko.role": "Props · themed worlds",
    "crew.bar.name": "Bar & door",
    "crew.bar.role": "Shift crews · every night",

    /* ---------- Stats-Band ---------- */
    "stats.founded": "founded",
    "stats.missions": "missions",
    "stats.rigs": "sound systems self-built",
    "stats.volunteer": "volunteer-run",

    /* ---------- Stats: Pride-Recap (event-pride.html) ---------- */
    "stats.floors": "Floors",
    "stats.celsius": "Celsius",
    "stats.capacity_outdoor": "outdoor capacity",
    "stats.love": "Love",

    /* ---------- Awareness ---------- */
    "aware.headline": "Partying you can count on.",
    "aware.tile.team.text": "There to talk to all night — clearly marked.",
    "aware.tile.team.text_full": "There to talk to all night — clearly marked. Come to us and we'll take care of it. Right away.",
    "aware.tile.team.text_event": "There to talk to all night — look out for the marked vests.",
    "aware.tile.firstaid.title": "First aiders",
    "aware.tile.firstaid.text": "At every event. Getting help never has consequences.",
    "aware.tile.sani.text_event": "Trained first aiders on site. Getting help never has consequences — for anyone.",
    "aware.tile.sani.text_full": "Trained first aiders at every event. <b>Getting help never has consequences — for anyone.</b>",
    "aware.tile.water.title": "Free Water",
    "aware.tile.water.text": "Free water, always. Look out for each other.",
    "aware.tile.water.text_event": "At the awareness point. Drink before you get thirsty.",
    "aware.tile.water.text_full": "Free water at the awareness point. Drink before you get thirsty — and look out for each other.",
    "aware.tile.photo.title": "No photos",
    "aware.tile.photo.text": "No photo without asking — what happens in the dark stays there.",
    "aware.tile.photo.text_full": "No photo without asking. Exceptions only by prior agreement — what happens in the dark stays there.",
    "aware.tile.photo.text_event": "No photos on the floor — exceptions only by prior agreement.",
    "aware.note.welcome": "Everyone is welcome. Discrimination, assault and boundary violations are not — cross that line and you're out.",
    "aware.principle": "Getting help never has consequences.",
    "link.awareness_concept": "Awareness policy",
    "link.help_drugs": "Help & drug emergencies",
    "link.house_rules": "House rules",

    /* ---------- Linktexte in Fliesstext (Platzhalter {link}) ---------- */
    "link.teamboard": "Team board →",
    "link.join": "Join in.",
    "link.kollektiv_log": "collective log",
    "link.artists_page": "artists page",
    "link.telegram_group": "Telegram group ↗",
    "link.one_message": "One message is enough.",

    /* ---------- Flight Log ---------- */
    "flightlog.h2": "Past <span class=\"glow\">missions</span>",
    "flog.pin": "I was there",

    /* ---------- Footer ---------- */
    "footer.channels": "Channels",
    "footer.contact": "Contact",
    "footer.join": "Get involved / join the crew",
    "footer.booking": "Booking",
    "footer.imprint": "Imprint",
    "footer.privacy": "Privacy",
    "footer.no_track": "🛰️ This site doesn't track you",
    "footer.love": "With love, your takeoff team",
    "footer.proto_note": "DESIGN PROTOTYPE · IT 8 · NOTHING HERE IS FINAL · CONTENT PARTLY PLACEHOLDER",
    "footer.proto_note.event": "DESIGN PROTOTYPE · EVENT PAGE LOCKED TO THE MARS THEME · CONTENT PARTLY PLACEHOLDER",

    /* ---------- Footer: Spalte Kollektiv ist It. 8 gewachsen ---------- */
    "footer.team": "Team",
    "footer.news": "News / Mission Log",
    "footer.calendar": "Event calendar",
    "footer.join_short": "Get involved",

    /* ---------- Mission Control ---------- */
    "mctrl.fx": "FX",
    "mctrl.theme": "Theme",
    "mctrl.ground": "Ground",
    "mctrl.time": "Time",
    "mctrl.off": "Off",
    "mctrl.normal": "Normal",
    "mctrl.full": "Full",
    "mctrl.on": "On",
    "mctrl.theme.space": "Space",
    "mctrl.theme.mars": "Mars",
    "mctrl.theme.strand": "Beach",
    "mctrl.night": "Night",
    "mctrl.day": "Day",
    "mctrl.fx.off.title": "Static — saves battery & data",
    "mctrl.fx.normal.title": "Standard",
    "mctrl.fx.full.title": "The full show",
    "mctrl.ground.off.title": "Starfield only",
    "mctrl.ground.on.title": "Horizon to match the theme",

    /* ---------- Event-Seite ---------- */
    "event.page.cta.telegram": "Telegram · updates first",
    "event.page.cta.ics": "＋ Add to calendar (.ics)",
    "event.page.no_presale": "No advance tickets needed — just come by. The earlier you get here, the longer you dance.",
    "event.page.briefing.h3": "Mission Briefing",
    "event.page.lineup.h3": "Crew aboard · A–Z",
    "event.page.lineup.note": "Line-up in alphabetical order — no headliner hierarchy here.",
    "event.page.lineup.tba": "+ TBA",
    "event.page.lineup.tba.note": "Special Guests",
    "event.page.timetable.h3": "Timetable",
    "event.page.timetable.loading": "Loading … 🤫",
    "event.page.timetable.note": "The running order lands shortly before we start — the Telegram crew hears it first.",
    "event.page.aware.eyebrow": "Awareness aboard",
    "event.page.aware.emergency": "Emergency? Talk to anyone from the crew — we'll take care of it.",
    "event.page.maps.google": "Google Maps ↗",
    "event.page.maps.apple": "Apple Maps ↗",
    "event.page.maps.osm": "OSM ↗",
    "event.page.maps.note": "Maps open externally in your own app — no tracker loads here.",
    "event.page.faq.h3": "Logbook · FAQ",
    "event.page.faq.price.q": "What does entry cost?",
    "event.page.faq.price.a": "Nothing — free entry. If you feel like it, the solidarity box is glad to take something: it pays for decor, the sound system and the next event.",
    "event.page.faq.age.q": "What's the minimum age?",
    "event.page.faq.age.a": "18+. Don't forget your ID — without one you can't come aboard, and a note from your parents won't help either.",
    "event.page.faq.photo.q": "Can I take photos?",
    "event.page.faq.photo.a": "No photos on the floor. Exceptions only by prior agreement with us — and with everyone who would be in the shot.",
    "event.page.faq.help.q": "I'm not doing well, or someone else isn't — what should I do?",
    "event.page.faq.help.a": "Talk to the awareness team, a medic or anyone from the crew straight away. Getting help never has consequences. Free water is at the awareness point.",
    "event.page.faq.home.q": "How do I get home at night?",
    "event.page.faq.home.a": "The main station is a five-minute walk away. Check the night connections beforehand — and tell someone when you set off.",
    "event.page.back": "← Back to base",

    /* ---------- Event-Seiten: Bausteine fuer Freiraeume & Pride ---------- */
    "event.page.back_all": "← All events",
    "event.page.good_to_know.h3": "Good to know",
    "event.page.row.for_whom": "Who for",
    "event.page.row.weather": "Weather",
    "event.page.debriefing.h3": "Debriefing",
    "event.page.numbers.h3": "The night in numbers",
    "event.page.gallery.h3": "Gallery",
    "event.page.gallery.consent_note": "We ask everyone in a photo before it goes online. You're in a picture and would rather not be? {link}",
    "event.page.lineup.h3_az": "Line-up · A–Z",
    "event.page.next.h3": "Next launch",
    "event.page.next.text": "The next mission is already waiting: {link}",
    "gallery.placeholder": "Photo to follow<br>once approved",

    /* ---------- Events-Seite ---------- */
    "events.hero.h1": "Events & <span class=\"glow\">missions</span>",
    "events.hero.intro": "Everything coming up — and everything that's been. Tap a card for the briefing.",
    "events.transmission.label": "Transmission incoming",
    "events.transmission.text": "Photos, aftermovies and sets from past missions are being sorted through — the galleries land here as soon as everyone in them has been asked. No photo without asking, in the archive too.",

    /* ---------- Events-Seite: Abflugtafel, Standby, BPM-Tool, FAQ (It. 8) ---------- */
    "events.upcoming.eyebrow": "Upcoming missions",
    "events.board.title": "Departure board",
    "events.board.col.gate": "Gate",
    "events.board.col.date": "Date",
    "events.board.col.mission": "Mission",
    "events.board.col.venue": "Venue",
    "events.calendar.subscribe": "Subscribe to all dates →",
    "events.standby.label": "Standby",
    "events.standby.title": "Next launch in preparation",
    "events.standby.text": "No event announced — but we're ready to go. Telegram hears it first.",
    "events.standby.cta": "Join us on Telegram",
    "events.bpm.eyebrow": "Sound check",
    "events.bpm.h2": "Find your <span class=\"glow\">rave rhythm</span>",
    "events.bpm.intro": "Tap along — we'll tell you which genre your tempo fits.",
    "events.bpm.tap": "Tap",
    "events.bpm.tap_note": "to the beat",
    "events.bpm.unit": "BPM",
    "events.faq.eyebrow": "Before you ask",
    "events.faq.h2": "Frequently asked <span class=\"glow\">questions</span>",
    "events.faq.ticket.q": "Do I need to buy a ticket in advance?",
    "events.faq.ticket.a": "Not for free-entry events — just come by. If there ever is an entry fee, it's at the top of that event's card.",
    "events.faq.when.q": "When is it worth turning up?",
    "events.faq.when.a": "Right at doors if you want to be sure you get in — at smaller venues we've had to stop at 200 people. Line-up and timetable updates go out on Telegram beforehand.",
    "events.faq.cloakroom.q": "Is there a cloakroom?",
    "events.faq.cloakroom.a": "Not everywhere — we're a DIY collective, not a club with permanent staff. It's noted on the event card; otherwise: dress light, dance warm.",
    "events.faq.photo.a": "No photo without asking — see Awareness.",
    "events.faq.under18.q": "I'm under 18 — can I get in?",
    "events.faq.under18.a": "Depends on the event: open airs like \"Free Spaces\" are for all ages, club nights and late nights are usually 18+. It's always on the event card.",
    "events.faq.help.q": "I want to help out!",
    "events.faq.help.a": "Yes please — build-up, awareness, bar, decor. Message us on Telegram or drop by {link}, we'll get back to you.",

    /* ---------- Artists-Seite ---------- */
    "artists.hero.h1": "Artists & <span class=\"glow\">sets</span>",
    "artists.hero.intro": "The people behind the decks — residents, guests and the takeoff podcast. No headliner hierarchy here, just good music.",
    "artists.residents.h2": "Residents",
    "artists.card.profile": "Profile",
    "artists.row.role": "Role",
    "artists.row.last": "Last played",
    "artists.row.listen": "Listen",
    "artists.row.debut": "Debut",
    "artists.row.specialty": "Specialty",
    "artists.role.resident": "Resident",
    "artists.jojo.listen": "\"JOJO | takeoff\" Podcast #1",
    "artists.jojo.bio": "Bio & photo to follow — with consent, the way it should be.",
    "artists.platzhalter.listen": "Live set @ Spartacus",
    "artists.platzhalter.bio": "The name says it all — the bio is still coming anyway.",
    "artists.cyonic.specialty": "B2B sets",
    "artists.cyonic.bio": "On board since the very first mission. Profile to follow.",
    "artists.sets.eyebrow": "Recordings",
    "artists.sets.h2": "Sets & <span class=\"glow\">podcast</span>",
    "artists.guests.eyebrow": "Guest log",
    "artists.guests.h2": "Already <span class=\"glow\">on our airwaves</span>",
    "artists.guests.intro": "Thanks to everyone who has shaped our nights — profiles & links to follow.",
    "artists.transmission.text": "The artist profiles are in the works — written by the artists themselves, with photo consent and linked sets. Want to play for us? Send us your demo:",

    /* ---------- Artist-Einzelseiten (artist-*.html) ---------- */
    "artists.card.to_profile": "View profile",
    "artistpage.eyebrow": "Artist",
    "artistpage.sets.h2": "Sets",
    "artistpage.flog.h2": "Played at <span class=\"glow\">takeoff</span>",
    "artistpage.row.socials": "Socials",
    "artistpage.row.founding": "Founding",
    "artistpage.back_all": "← All artists",

    /* ---------- Kollektiv-Seite ---------- */
    "kollektiv.hero.h1": "We build our nights <span class=\"glow\">ourselves</span>.",
    "kollektiv.hero.intro": "takeoff is a volunteer-run rave collective from Potsdam — founded in 2024, grown out of friendship, workshop dust and one question: why not just do it ourselves?",
    "kollektiv.text.diy": "We built our sound system ourselves — subwoofers, horns, all of it. Our lighting is DMX we wired by hand, our decor is made from scratch for every theme.",
    "kollektiv.text.money": "We're not for profit — more like <em style=\"color: var(--ink)\">\"not for loss\"</em>. That's why our events are often free and the drinks priced in solidarity.",
    "kollektiv.familie.eyebrow": "Family",
    "kollektiv.familie.h2": "Who we <span class=\"glow\">fly with</span>",
    "kollektiv.familie.intro": "Collectives, venues and people without whom our nights wouldn't happen.",
    "kollektiv.mitmachen.label": "New crew wanted",
    "kollektiv.mitmachen.text": "Bar, door, awareness, building decor or first aid — click your role and we'll write back. takeoff grows with every mission.",
    "kollektiv.booking.label": "Booking & partners",
    "kollektiv.booking.text": "Our own sound system, our own lighting, well-drilled shift crews and experience with permits — we support other events too.",

    /* ---------- Kollektiv-Seite: Blueprint-Blaetter BL. 01–07 (It. 8) ---------- */
    "kollektiv.rig.sub": "2× SUB · SELF-BUILT '24/'25",
    "kollektiv.rig.top": "2× TOP · SELF-BUILT '25",
    "kollektiv.rig.dmx": "DMX · SELF-BUILT DESK",
    "kollektiv.plate.werte": "SHT. 01 · ATTITUDE",
    "kollektiv.werte.eyebrow": "Attitude",
    "kollektiv.werte.h2": "Why we <span class=\"glow\">do this</span>",
    "kollektiv.werte.intro": "No business plan — five principles we measure every mission against.",
    "kollektiv.wert.volunteer.title": "Volunteer-run",
    "kollektiv.wert.volunteer.text": "100% unpaid, purely out of love for it.",
    "kollektiv.wert.notforloss.title": "Not for loss",
    "kollektiv.wert.notforloss.text": "No profit, but no paying out of our own pockets either.",
    "kollektiv.wert.awareness.title": "Awareness first",
    "kollektiv.wert.awareness.text": "Safety is the basis, not a footnote.",
    "kollektiv.wert.diy.title": "DIY",
    "kollektiv.wert.diy.text": "Sound system, lights, decor — all of it by our own hands.",
    "kollektiv.wert.open.title": "Open door",
    "kollektiv.wert.open.text": "Free entry wherever we can manage it.",
    "kollektiv.plate.finanzen": "SHT. 02 · CASH BOOK",
    "kollektiv.finanzen.eyebrow": "Cash book",
    "kollektiv.finanzen.h2": "Where the money <span class=\"glow\">flies</span>",
    "kollektiv.finanzen.intro": "\"Not for loss\" isn't a slogan — here's what the income goes on.",
    "kollektiv.spend.rent": "Rent & permits",
    "kollektiv.spend.decor": "Decor & materials",
    "kollektiv.spend.tech": "Gear upkeep",
    "kollektiv.spend.awareness": "Awareness & first aid",
    "kollektiv.spend.reserve": "Reserve",
    "kollektiv.finanzen.note": "Illustrative figures as of {date} — they'll be replaced by real accounts as soon as we keep proper books.",
    "kollektiv.plate.history": "SHT. 03 · LOGBOOK · SCALE 1:1",
    "kollektiv.history.eyebrow": "Logbook",
    "kollektiv.history.h2": "How it all <span class=\"glow\">started</span>",
    "kollektiv.history.intro": "No master plan — just a small group, a soldering iron and the idea that Potsdam deserves more trance.",
    "kollektiv.plate.fotowand": "SHT. 04 · PHOTO WALL",
    "kollektiv.fotowand.eyebrow": "Photo wall",
    "kollektiv.fotowand.h2": "Moments",
    "kollektiv.fotowand.note": "No photo without asking — the wall fills up as soon as everyone in the pictures has agreed. The whole team: {link}",
    "kollektiv.plate.crew": "SHT. 05 · CREW",
    "kollektiv.orbit": "T+ {n} days in orbit",
    "kollektiv.plate.familie": "SHT. 06 · NETWORK",
    "kollektiv.plate.faq": "SHT. 07 · ONBOARD QUESTIONS",
    "kollektiv.faq.eyebrow": "Onboard questions",
    "kollektiv.faq.h2": "Frequently <span class=\"glow\">asked</span>",
    "kollektiv.faq.verein.q": "Are you a registered association?",
    "kollektiv.faq.verein.a": "Not yet — for now we organise without a formal legal form; founding an association is on the table.",
    "kollektiv.faq.money.q": "How do you fund yourselves?",
    "kollektiv.faq.money.a": "Through donations, solidarity prices at the bar and the occasional door takings — never for profit.",
    "kollektiv.faq.join.q": "Can I join without any experience?",
    "kollektiv.faq.join.a": "Yes. Bar, door, awareness, building decor — we'll show you everything.",
    "kollektiv.faq.booking.q": "Do you work other parties too?",
    "kollektiv.faq.booking.a": "Yes, we help out with gear, lighting and well-drilled crews — write to us.",
    "kollektiv.role.bar": "Bar",
    "kollektiv.role.einlass": "Door",
    "kollektiv.role.deko": "Decor build",
    "kollektiv.role.sani": "First aid",
    "kollektiv.mitmachen.direct": "Rather talk to us directly? {telegram} or {mail}.",
    "kollektiv.booking.tech.label": "Gear",
    "kollektiv.booking.tech.text": "2 subwoofers + 2 tops, self-built",
    "kollektiv.booking.light.label": "Lighting",
    "kollektiv.booking.light.text": "Our own DMX setup, blacklight, tubes",
    "kollektiv.booking.experience.label": "Experience",
    "kollektiv.booking.experience.text": "{n} missions since {year}",
    "kollektiv.booking.permits.label": "Permits",
    "kollektiv.booking.permits.text": "Used to dealing with the city and its licensing office",
    "kollektiv.booking.presskit": "Press kit to follow: {mail}",

    /* ---------- Awareness-Seite ---------- */
    "awareness.hero.intro": "Awareness isn't a notice on the wall for us, it's daily practice: our own team, our own first aiders, free water — on every single mission. We'll say it straight: safer space, not safe space. But we do everything we can.",
    "awareness.help.eyebrow": "Help & emergencies",
    "awareness.help.h2": "When it gets serious",
    "awareness.help.row.emergency": "Emergency number",
    "awareness.help.emergency.text": "for any medical emergency, without hesitating",
    "awareness.help.row.at_event": "At the event",
    "awareness.help.at_event.text": "Talk to the awareness team & the medics — or anyone from the crew, we're all connected",
    "awareness.help.row.after": "Afterwards",
    "awareness.help.after.text": "Did something happen? Write to us:",
    "awareness.help.row.principle": "Principle",
    "awareness.help.principle.text": "<b>Getting help never has consequences.</b> For anyone. Ever.",
    "awareness.transmission.text": "The full page on <b>drug emergencies</b> is being written — with first-aid steps, warning signs and links to drugscouts & mindzone. We're not taking a stand against you, but for your safety.",
    "awareness.rules.h2": "Short & clear",
    "awareness.rule.consent": "Consent is mandatory",
    "awareness.rule.no_discrimination": "No discrimination",
    "awareness.rule.no_photo": "No photo without asking",
    "awareness.rule.age": "18+ with ID",
    "awareness.rule.ko": "Zero tolerance for spiking",
    "awareness.rule.reachable": "Awareness is there to talk to",
    "awareness.rules.text": "Cross someone's boundaries and you're out — no discussion. The rules of each venue apply on top of ours (e.g. the freiLand Grundkonsens at the Spartacus). We'll publish the full awareness policy here as soon as the whole team has signed off on it.",

    /* ---------- Team-Seite (team.html) ---------- */
    "team.eyebrow": "Team board",
    "team.h1": "The <span class=\"glow\">crew</span>",
    "team.intro": "takeoff is collective work: every night is made by many hands. Photos will follow once everyone agrees — until then: roles & jobs.",
    "team.photoboard.label": "Photo board to follow",
    "team.photoboard.text": "The team photo board arrives once everyone in the pictures has agreed — consent applies to us too. Want to be on it? {link}",

    /* ---------- News / Mission Log (news.html) ---------- */
    "news.h1": "What's <span class=\"glow\">happening</span>",
    "news.intro": "No blog, no waffle — short radio messages from the workshop and the dance floors. The long posts live on Instagram, linked from here.",
    "news.badge.announcement": "Announcement",
    "news.badge.buildlog": "Build log",
    "news.badge.recap": "Recap",
    "news.insta.post": "View the Instagram post · only loads after a click",
    "news.insta.recap": "View the Instagram recap · only loads after a click",
    "news.transmission.text": "Instagram posts only load after a click (two-click, GDPR-friendly) — a demo button in the prototype. New entries will come straight from the admin dashboard later.",

    /* ---------- Musik-Seite (musik.html) ---------- */
    "musik.eyebrow": "Frequency school",
    "musik.h1": "So what <span class=\"glow\">actually</span> plays here?",
    "musik.intro": "Never heard of Hard Bounce? Doesn't matter — that's what this page is for. Three minutes of reading and you'll know what's waiting on the floor.",
    "musik.row.bounce": "Bounce / Hard Bounce",
    "musik.trance.text": "Hypnotic melodies, long build-ups, goosebump moments. <b>~{bpm} BPM</b> · the heart of takeoff",
    "musik.hard_trance.text": "Trance with a push behind it: harder kicks, more driving, more euphoric. <b>~{bpm} BPM</b>",
    "musik.bounce.text": "Springy offbeat bass, good mood with some weight behind it. <b>~{bpm} BPM</b>",
    "musik.techno.text": "The straight, dark pulse — here as a gift from collectives we're friends with",
    "musik.psytrance.text": "For when it gets late and the patterns start dancing. Now and then, with love",
    "musik.outro": "Want a listen? The {link} has sets from real takeoff nights — and the \"| takeoff\" podcast keeps them coming.",

    /* ---------- Kalender-Seite (kalender.html) ---------- */
    "kalender.eyebrow": "Always up to date",
    "kalender.h1": "The <span class=\"glow\">event calendar</span>",
    "kalender.intro": "Subscribe once and stay up to date: the calendar feed updates itself whenever we change a date — in Google Calendar, Apple Calendar and Outlook.",
    "kalender.cta.subscribe": "＋ Subscribe to the calendar (webcal)",
    "kalender.cta.single_ics": "Single date as .ics",
    "kalender.howto.label": "How the subscription works",
    "kalender.howto.text": "<b>Google Calendar:</b> Settings → \"Add calendar\" → \"From URL\" → paste our feed address. <b>iPhone/Mac & Outlook:</b> tap the webcal link, done. New takeoff dates then turn up for you automatically — without you doing anything. (A demo in the prototype; the real feed will be generated from the event database.)",

    /* ---------- Kontakt-Seite (kontakt.html) ---------- */
    "kontakt.eyebrow": "Radio contact",
    "kontakt.h1": "Say <span class=\"glow\">hello</span>.",
    "kontakt.intro": "One inbox, real people behind it. We're all volunteers — give us a few days and you'll hear back. For quick questions about events, Telegram is the fast lane.",
    "kontakt.row.general": "General",
    "kontakt.row.booking": "Booking / artists",
    "kontakt.booking.text": "Demo link or enquiry by email — subject line \"Booking\"",
    "kontakt.row.press": "Press / partners",
    "kontakt.press.text": "Email with the subject line \"Presse\" · press kit to follow",
    "kontakt.awareness.text": "Did something happen at an event? Write to us — we read carefully and in confidence.",
    "kontakt.row.lost": "Lost property",
    "kontakt.lost.text": "Left something behind? Tell us the event and what it looks like.",
    "kontakt.row.fast": "Fast",
    "kontakt.fast.text": "— just post your question in there",
    "kontakt.cta.mail": "Write an email",
    "kontakt.cta.telegram": "Open Telegram",

    /* ---------- Rechtsseiten (impressum.html, datenschutz.html) ----------
       legal.binding_note gehoert auf BEIDE Seiten. Die englische Fassung ist
       Verstaendnishilfe, keine Rechtsuebersetzung — siehe Anhang, Abschnitt 8. */
    "legal.eyebrow": "Legal",
    "legal.binding_note": "The German version of this page is the legally binding one. This English text is a reading aid, not a legal translation.",
    "impressum.intro": "Mandatory provider information under §5 TMG / §18 MStV (German law). (Prototype: placeholders until the legal form is settled.)",
    "impressum.row.provider": "Provider",
    "impressum.provider.name": "takeoff Kollektiv",
    "impressum.provider.text": "legal form still being settled",
    "impressum.row.address": "Address",
    "impressum.address.text": "c/o {tbd} · Potsdam",
    "impressum.row.visdp": "V. i. S. d. P. (person responsible for the content)",
    "impressum.credits.label": "Credits",
    "impressum.credits.text": "Moon maps: NASA/GSFC Scientific Visualization Studio (CGI Moon Kit, public domain). Mars ground: Courtesy NASA/JPL-Caltech (public domain). Typefaces: Planet Kosmos (Planet Typography), Unbounded, Space Grotesk, Space Mono (SIL OFL). This page loads nothing from third-party servers.",
    "datenschutz.intro": "The short version: this page sets no cookies, loads nothing from third-party servers and builds no profiles. The long version is below — pleasingly short.",
    "datenschutz.row.cookies": "Cookies",
    "datenschutz.cookies.text": "<b>None.</b> Your FX and theme choice stays local in your browser (localStorage, it never leaves your device)",
    "datenschutz.row.tracking": "Tracking",
    "datenschutz.tracking.text": "<b>None.</b> No analytics pixels, no fingerprinting, no ad networks",
    "datenschutz.row.thirdparty": "Third-party servers",
    "datenschutz.thirdparty.text": "Fonts, images, scripts: all hosted by us. SoundCloud/YouTube/Instagram load <b>only after you click</b> (two-click solution)",
    "datenschutz.row.maps": "Maps",
    "datenschutz.maps.text": "No embedded maps — routes open as a link in your own maps app",
    "datenschutz.row.logs": "Server logs",
    "datenschutz.logs.text": "The access logs any host keeps [details to follow with the hosting decision]",
    "datenschutz.row.rights": "Your rights",
    "datenschutz.rights.text": "Access, correction, deletion — write to {mail}",
    "datenschutz.row.photos": "Photos",
    "datenschutz.photos.text": "Photos are not allowed at events; published photos only with consent. You're in a picture and would rather not be? One email is enough — we'll take it down",
    "datenschutz.proto_note": "[Prototype scaffolding — the final privacy policy will be reviewed by a lawyer before launch.]",

    /* ---------- JS-Laufzeit ---------- */
    "js.countdown.liftoff": "LIFTOFF",
    "js.countdown.running": "· it's on!",
    "js.countdown.unit.d": "d",
    "js.countdown.unit.h": "h",
    "js.countdown.unit.m": "m",
    "js.countdown.unit.s": "s",
    "js.toast.all_found": "🦄 Found all {total} hideouts — you're crew material!",
    "js.toast.found": "✨ Hideout found — {n}/{total} themes",
    "js.toast.already": "Already found 🤫 — try switching the theme …",
    "js.toast.share_copied": "Link copied ✓",
    "js.toast.patch_saved": "Patch saved — {count}/{total} missions",
    "js.toast.patch_reset": "Patches reset",
    "js.bpm.match": "Your tempo says {genre} ({range} BPM)",
    "js.bpm.slower": "Slower than {genre} — but that's the closest match",
    "js.bpm.faster": "Faster than any genre here — need a breather? 😅",

    /* ══════════════════ CMS-GRENZE · Inhaltsdaten ═══════════════════════════ */

    /* ---------- Event pwest ---------- */
    "event.pwest.title": "Open Air: Free Spaces",
    "event.pwest.venue": "Bastion am Schillerplatz",
    "event.pwest.city": "Potsdam West",
    "event.pwest.location_note": "Potsdam West · green space",
    "event.pwest.price": "Free",
    "event.pwest.genres": "Techno · Trance",
    "event.pwest.note": "with Schranzverbot & Stadtjugendring",
    "event.pwest.brief": "Theme \"Free Spaces\" — an open air with the collective Schranzverbot & the Stadtjugendring. Daytime, outdoors, for everyone.",

    /* ---------- Event pwest — Detailseite event-freiraeume.html ---------- */
    "event.pwest.headline": "free spaces",
    "event.pwest.subtitle": "Open air · with Schranzverbot & Stadtjugendring",
    "event.pwest.brief_long": "Free space for free beats: together with the collective <b>Schranzverbot</b> and the <b>Stadtjugendring Potsdam</b> we're taking over the green by the Bastion — officially permitted, organised in solidarity, open to everyone. Techno and trance for as long as the sun plays along.",
    "event.pwest.no_presale": "No advance tickets — just drop by. Daytime, outdoors, for everyone.",
    "event.pwest.sound_note": "Techno · Trance — two collectives, one sound system",
    "event.pwest.audience": "All ages — an open air in daylight",
    "event.pwest.weather": "If there's a storm: an update on Telegram and here",
    "event.pwest.awareness_note": "Team in <b>purple vests</b> + first aiders on site · free water",

    /* ---------- Event mars ---------- */
    "event.mars.title": "takeoff: Mars Mission",
    "event.mars.headline": "mars mission",
    "event.mars.subtitle": "takeoff goes red planet",
    "event.mars.venue": "Spartacus",
    "event.mars.city": "Potsdam",
    "event.mars.venue_note": "inside freiLand",
    "event.mars.transit": "5 min walk from the main station",
    "event.mars.price": "Free Entry",
    "event.mars.genres": "Trance · Hard Trance · Bounce",
    "event.mars.genres_slash": "Trance / Hard Trance / Bounce",
    "event.mars.note": "Free Entry · 18+",
    "event.mars.brief": "We're launching the Spartacus at the red planet — a papier-mâché Mars, blacklight, glow tubes standing in for outer space.",
    "event.mars.brief_long": "We're launching the Spartacus at the red planet: a self-built papier-mâché Mars above the floor, blacklight, glow tubes standing in for outer space — and a whole night of trance, hard trance and bounce until the oxygen runs out. Free entry, because raves belong to everyone.",
    "event.mars.doors_note": "We may have to stop letting people in — come early",

    /* ---------- Event strand ---------- */
    "event.strand.title": "takeoff: Beach Party",
    "event.strand.venue": "Spartacus",
    "event.strand.city": "Potsdam",
    "event.strand.price": "TBA",
    "event.strand.genres": "Trance · Hard Bounce",
    "event.strand.teaser": "Cocktails against the November rain",
    "event.strand.note": "working title · cocktails against the November rain",
    "event.strand.motto": "Beach party",
    "event.strand.motto_note": "(working title)",
    "event.strand.brief": "Summer in the middle of November. Line-up, times and decor secrets go out on the Telegram channel first.",

    /* ---------- Orte ---------- */
    "venue.spartacus.name": "Spartacus",
    "venue.spartacus.address": "Friedrich-Engels-Straße 22 · 14473 Potsdam (inside freiLand)",
    "venue.spartacus.hint": "≈ 5 minutes on foot from Potsdam main station",
    "venue.spartacus.hint_short": "5 min walk from Potsdam main station",
    "venue.bastion.name": "Bastion am Schillerplatz",
    "venue.bastion.address": "Green space, Potsdam West",
    "venue.bastion.hint": "Tram to Schillerplatz · bikes very welcome",
    "venue.bastion.hint_short": "Tram to Schillerplatz · bikes welcome",

    /* ---------- Flight Log ---------- */
    "flog.m6.name": "Pride Party",
    "flog.m6.venue": "KuZe · 3 floors",
    "flog.m6.note": "40 °C, a storm, the demo called off — the party happened anyway. \"Best event we've ever had.\"",

    /* ---------- Pride-Party: Recap-Seite event-pride.html ---------- */
    "flog.m6.headline": "pride party",
    "flog.m6.subtitle": "Mission M6 · completed",
    "flog.m6.venue_name": "KuZe",
    "flog.m6.city": "Potsdam",
    "flog.m6.floors": "3 floors",
    "flog.m6.price": "Free Entry",
    "flog.m6.thanks": "Thank you to everyone who was there, helped out and looked after each other. ♥",
    "flog.m6.debrief": "40 °C, a storm warning, the demo called off — the party wasn't. Three floors (\"3 stages of love\"), free water against the heat, taking down sun sails in a storm, and at the end the line that sticks: <em>\"Best event we've ever had.\"</em>",
    "flog.m5.name": "Free Entry Rave",
    "flog.m5.venue": "Spartacus",
    "flog.m5.note": "Local line-up A–Z, entry by donation, a fire bowl & stone-oven pizza.",
    "flog.m4.name": "Our biggest event yet",
    "flog.m4.venue": "Spartacus",
    "flog.m3.name": "Spartacus night",
    "flog.m3.venue": "Spartacus",
    "flog.m3.note": "Antiquity meets trance — a burning sign above the temple.",
    "flog.m2.name": "Out of Space",
    "flog.m2.venue": "Nilkeller",
    "flog.m2.note": "Doors closed at 200 — the cellar was full.",
    "flog.m1.name": "Sky High",
    "flog.m1.venue": "Potsdam",
    "flog.m1.note": "The first takeoff. Where it all began.",

    /* ---------- Bau-Logbuch (kollektiv.html #history) — eigener Datensatz ---------- */
    "hist.t0.name": "The founding",
    "hist.t0.venue": "Potsdam",
    "hist.t0.dim": "FOUNDED",
    "hist.t0.note": "A small group around Nico — better known today as DJ Placeholder — decides: we'll do this ourselves.",
    "hist.s1.name": "The first subwoofer",
    "hist.s1.venue": "Workshop",
    "hist.s1.dim": "1× SUB",
    "hist.s1.note": "Sawn, glued and wired by hand.",
    "hist.s2.name": "Two horns on top",
    "hist.s2.venue": "Workshop",
    "hist.s2.dim": "+2 TOP",
    "hist.s2.note": "The magenta tops complete the first stack.",
    "hist.s3.name": "Another subwoofer",
    "hist.s3.venue": "Workshop",
    "hist.s3.dim": "2× SUB",
    "hist.s3.note": "More space, more people, more bass.",
    "hist.l1.name": "Our own lighting",
    "hist.l1.venue": "DMX desk",
    "hist.l1.dim": "DMX · 512CH",
    "hist.l1.note": "Mik — who goes by \"Blaulicht\" — builds up the lighting rig.",
    "hist.now.date": "Today",
    "hist.now.name": "Themed worlds",
    "hist.now.venue": "Potsdam & around",
    "hist.now.dim": "LIVE",
    "hist.now.note": "Every event gets its own universe. It carries on in the {link}.",

    /* ---------- Artists & Acts ---------- */
    "artist.jojo.name": "JOJO",
    "artist.jojo.genres": "Hard Trance · Bounce",
    "artist.jojo.genres_slash": "Hard Trance / Bounce",
    "artist.jojo.initials": "JO",
    "artist.platzhalter.name": "DJ Placeholder",
    "artist.platzhalter.initials": "PL",
    "artist.cyonic.name": "Cyonic",
    "artist.cyonic.genres": "Techno · Trance",
    "artist.cyonic.genres_slash": "Techno / Trance",
    "artist.cyonic.initials": "CY",
    "artist.molly.name": "mølly (on molly)",
    "artist.jojo.tagline": "Hard Trance · Bounce · resident",
    "artist.jojo.podcast_ep": "\"JOJO | takeoff\" · episode 1",
    "artist.cyonic.tagline": "Techno · Trance · since day one",
    "artist.cyonic.since": "from the very first mission",
    "artist.platzhalter.tagline": "Trance · resident · co-founder",
    "artist.platzhalter.role": "Resident & co-founder",
    "artist.platzhalter.role_note": "(Nico)",
    "artist.platzhalter.founding": "Helped build takeoff in {year}",
    "artist.takeoff_crew.name": "takeoff crew",

    /* ---------- Gäste-Log ---------- */
    "guest.mimi404": "MIMI404",
    "guest.senaida": "SENAIDA",
    "guest.cedric_lawrence": "Cedric Lawrence",
    "guest.dj_trancesetter": "DJ Trancesetter",
    "guest.dj_loveletter": "DJ Loveletter",
    "guest.jacky_ickx": "Jacky Ickx",
    "guest.dj_st4rlight": "dj st4rlight",
    "guest.flava": "FLAVA",
    "guest.ochser": "ochser",
    "guest.emmy": "Emmy",
    "guest.kolja": "Kolja",

    /* ---------- Partner / Familie ---------- */
    "partner.schranzverbot": "Schranzverbot",
    "partner.no_gravity": "No Gravity Berlin",
    "partner.spartacus": "Spartacus",
    "partner.freiland": "freiLand Potsdam",
    "partner.kuze": "KuZe",
    "partner.nilkeller": "Nilkeller",
    "partner.stadtjugendring": "Stadtjugendring Potsdam",
    "partner.regenbogen": "Regenbogen Potsdam e.V.",

    /* ---------- Partner: Rolle im Verbund (kollektiv.html #familie) ---------- */
    "partner.schranzverbot.note": "Co-host of the Open Air: Free Spaces",
    "partner.no_gravity.note": "Partner collective in Berlin",
    "partner.spartacus.note": "Second home inside freiLand",
    "partner.kuze.note": "Venue of the Pride Party",
    "partner.stadtjugendring.note": "Permit partner for Free Spaces",

    /* ---------- Mission-Log-Eintraege (news.html) ---------- */
    "post.freiraeume.title": "The permit is here — Open Air: Free Spaces on {date}! 🎉",
    "post.freiraeume.text": "The city has confirmed the green at the Bastion am Schillerplatz. {time}, free, with Schranzverbot & Stadtjugendring.",
    "post.marsbau.title": "Mars is taking shape",
    "post.marsbau.text": "Chicken wire, paste, blacklight paint: our planet for the Mars Mission is under construction. Materials: {amount}. Artistic freedom: priceless.",
    "post.pride.title": "Pride Party: 40 °C, a storm — and still the best night",
    "post.pride.text": "Demo called off, party not. Three floors at KuZe, sun-sail drama included. Thanks to everyone who was there and looked after each other. ♥",
    "post.podcast1.title": "\"JOJO | takeoff\" — episode 1 is out",
    "post.podcast1.text": "Our podcast series kicks off: for everyone who wants to bathe their ears in exquisite trance. On YouTube & SoundCloud.",
    "post.rig.title": "From the first subwoofer to our own sound system",
    "post.rig.text": "First one sub, then two horns, then another sub — built piece by piece until the cellar shook. The whole story is in the {link}.",
  },
};

/* ============================================================================
   ANHANG — was ein spaeterer Agent wissen muss
   Stand It. 8 (18 Seiten). Aeltere Befunde sind stehengeblieben und mit
   "[It. 7]" markiert, wo sie sich seither geaendert haben.
   ============================================================================

   ── 1 · Platzhalter-Inventar ────────────────────────────────────────────────
   {time}    Uhrzeit, formatiert    common.time · common.time_from · common.end_at
                                    common.start_at · meta.event.pwest.desc
                                    post.freiraeume.text
                                    → in meta.event.pwest.desc und post.freiraeume.text
                                      nimmt {time} eine bereits formatierte SPANNE auf
                                      (das Ergebnis von common.timerange), keinen Einzelwert.
   {start}   Startzeit              common.timerange
   {end}     Endzeit                common.timerange
   {date}    Datum, formatiert      meta.event.mars.* · meta.event.pwest.* ·
                                    meta.event.pride.* · kollektiv.finanzen.note ·
                                    post.freiraeume.title
   {year}    Jahreszahl             common.since_year · artist.platzhalter.founding ·
                                    kollektiv.booking.experience.text
   {n}       Anzahl                 menu.events.note · js.toast.found · common.floor ·
                                    kollektiv.orbit · kollektiv.booking.experience.text
   {total}   Gesamtzahl             js.toast.found · js.toast.all_found · js.toast.patch_saved
   {count}   Anzahl (nur JS)        js.toast.patch_saved
                                    → assets/js/pages/events.js Z. 250 ersetzt woertlich
                                      "{count}" und "{total}". Deshalb hier bewusst NICHT {n}.
   {artist}  Act-Name               a11y.set.play · a11y.podcast.play
   {event}   Eventname              a11y.flog.pin
   {venue}   Ort                    hero.next.meta
   {city}    Stadt                  hero.next.meta
   {note}    Event-Zusatz           hero.next.meta
   {telegram}/{mail}  Link-Labels   kollektiv.mitmachen.direct · kollektiv.booking.presskit ·
                                    datenschutz.rights.text
   {link}    Linktext im Satz       events.faq.help.a · event.page.gallery.consent_note ·
                                    event.page.next.text · kollektiv.fotowand.note ·
                                    hist.now.note · team.photoboard.text · musik.outro ·
                                    post.rig.text
                                    → der Linktext selbst ist ein eigener Schluessel
                                      (link.*), damit er uebersetzbar bleibt.
   {bpm}     Tempo in BPM           musik.trance.text · musik.hard_trance.text ·
                                    musik.bounce.text
   {genre}   Genrename              js.bpm.match · js.bpm.slower
   {range}   BPM-Bereich            js.bpm.match
   {amount}  Geldbetrag             post.marsbau.text
   {tbd}     "[wird ergaenzt]"      impressum.address.text (Wert steht in common.tbd)


   ── 2 · Formatierung statt Uebersetzung ─────────────────────────────────────
   Fuer diese Stellen gibt es bewusst KEINE Schluessel. Sie kommen aus dem
   EVENTS-Array (assets/js/main.js Z. 28–41, ISO-Strings) bzw. aus
   assets/data/ durch Intl.DateTimeFormat und Intl.NumberFormat:

   Wochentag + Datum ("SA 12.09.", "Sa 12.09.", "SA 19.09.2026"):
     index.html          66–71 (Marquee, jede Zeile doppelt)
     index.html          87  (.nav-status .st-date)
     index.html          191 (.mn-when)
     index.html          221 (.nc-date)
     index.html          255, 277, 300 (.m-date)
     index.html          430, 435, 440, 444, 449, 454 (.fdate)
     event-marsmission.html  63, 65 (Marquee), 82, 186, 211, 333 (.sc-info)
     events.html         40–45, 61, 82, 113, 133, 156, 183–188 · Board-Uhr (data-clock)
     artists.html        40–45, 61, 82, 123, 140, 157 (Datum in dd)
     kollektiv.html      40–45, 61, 82 · 235–240 (.fdate "2024", "2024/25", "2025")
     awareness.html      40–45, 61, 82
     Die zwoelf neuen Seiten tragen denselben Kopf an identischen Stellen:
     Marquee Z. 40–45, .st-date Z. 61, .mn-when Z. 84, .mn-where Z. 86.
     news.html           112–135 (.n-date, u. a. der Bereich "2024–2025")
     kalender.html       111–113 (dt: "Sa 12.09." …)
     artist-jojo.html / artist-cyonic.html / artist-platzhalter.html
                         115–116 ("seit 2025", "Sky High · 15.06.2024"),
                         129 ("11.01. · Liveset", "09.05. · Liveset"), .fdate im Flight Log
     event-freiraeume.html   107–109 (.facts: Datum, 16:00, 22:00)
     event-pride.html    107–110 (.facts), 145–146 (Set-Zeiten "20:00", "21:00")

   Uhrzeiten ("16:00", "23:00", "16 Uhr", "16–22 Uhr", "ab 23 Uhr"):
     index.html          66, 69 (<em>16:00</em>), 67, 70 (<em>23:00</em>)
     index.html          193 (.mn-where), 221 (.nc-date), 257, 262, 279, 284
     event-marsmission.html  63, 65, 188, 212
     events.html         40–45, 84, 115, 120, 135, 140
     kalender.html       111–112 ("16–22 Uhr", "ab 23 Uhr")
   → Deutsch haengt "Uhr" an, Englisch nicht. Genau dafuer gibt es
     common.time / common.timerange / common.time_from / common.end_at /
     common.start_at.

   Zahlen ohne Uebersetzung (Stats-Baender, Patches, Prozente, Tempi):
     index.html          393–396 ("2024", "06", "02", "100%")
     kollektiv.html      291 (Orbit-Tage, #orbit-days), 294–297 (Stats-Band),
                         193–216 (Kassenbuch-Prozente 35/25/20/15/5)
     index.html          429, 434, 439, 443, 448, 453 (.fpatch "M6"…"M1", aria-hidden)
     events.html         183–188 (dieselben Patches), .bpm-readout b (getapptes Tempo)
     kollektiv.html      235–240 (.fpatch "T0", "S1", "S2", "S3", "L1", "▲")
     event-pride.html    124–127 ("03", "40°", "150", "∞")
     musik.html          111–113 ("~138 BPM", "~145 BPM", "~150 BPM" — die Zahl steht
                         im <b>, der Satz drumherum in musik.*.text mit {bpm})
     awareness.html      127 ("112" — Notrufnummer, laendergebunden, NICHT uebersetzen)
     post.marsbau.text   "~20 €" → {amount}, weil das Waehrungsformat sprachabhaengig ist


   ── 3 · Bewusst NICHT aufgenommen ───────────────────────────────────────────
   · Eigennamen: Instagram, Telegram, SoundCloud, TikTok, YouTube, Google Maps,
     OSM, Spartacus, freiLand, KuZe, Nilkeller, Stadtjugendring, Schranzverbot
     (Kollektivname!), Regenbogen Potsdam e.V., No Gravity Berlin, drugscouts,
     mindzone, Potsdam, Bastion am Schillerplatz, NASA/GSFC, NASA/JPL-Caltech,
     Planet Kosmos, Unbounded, Space Grotesk, Space Mono, Outlook, webcal.
     Wo sie allein in einem Element stehen, gibt es trotzdem einen Schluessel mit
     identischem Wert (partner.*, venue.*, social.*, guest.*), damit spaeter
     nichts fehlt.
   · Personen-/DJ-Namen: JOJO, Cyonic, mølly (on molly), Nico, Mik — Schluessel
     vorhanden, Wert identisch. "Blaulicht" ist Miks DJ-Name und bleibt deutsch
     (crew.mik.name, hist.l1.note).
   · Die Marke "takeoff" / "takeøff" in jeder Schreibweise.
   · E-Mail-Adresse info@takeoff-potsdam.de (social.email, beide Sprachen gleich).
   · Fachbegriffe, die im Deutschen schon englisch sind: DIY, DMX, BPM, localStorage,
     Consent, Floor, Free Water, Safer Space, Booking, Recap, Baulog→Build log.
   · Rein dekorative bzw. aria-hidden Zeichen: "✦" (Genre-Band, index.html 325f.),
     "▶" (.play), "♥" im Footer, "—" als Countdown-Platzhalter
     (index.html 217, event-marsmission.html 220), "…" als title der Secret-Buttons
     (index.html 419–421), "🚀" im Favicon-SVG.
   · Neu It. 8, gleiche Kategorie:
       "PDM"                events.html 123 — aria-hidden Flughafenkuerzel der Abflugtafel
       "FIG. 01"–"FIG. 04"  kollektiv.html 257–260 — Abbildungsnummerierung
       "T0", "S1"–"S3", "L1", "▲"  kollektiv.html 235–240 — Logbuch-Patches, wie M1–M6
       "Gate/Datum/Mission/Ort/Status" der Board-Spalten sind dagegen SICHTBARER Text
       trotz aria-hidden und haben Schluessel (events.board.col.*).
   · Fuehrende Deko-Zeichen an Textzeilen sind NICHT im Wert:
       "🌧 " vor events.html 167  → event.pwest.weather
       "⚠ "  vor events.html 210  → event.mars.doors_note
       "· "  vor kollektiv.html 368–371 → kollektiv.booking.*.text
     Sie gehoeren per ::before ins CSS. Umgekehrt BLEIBEN Zeichen im Wert, wenn sie
     Teil des Satzes sind: "🎉" (post.freiraeume.title), "♥" (flog.m6.thanks,
     post.pride.text), "🤫" (status.tba), "😅" (js.bpm.faster).
   · Die Pfeile ↗ → ← ＋ innerhalb von Linktexten: sprachneutral. Sie sind in den
     Werten belassen, wo der Quelltext sie fest im Element hat
     (topbar.hud.*, menu.go, event.page.maps.*, event.page.back, event.page.back_all,
     artistpage.back_all, hero.cta.missions, events.calendar.subscribe,
     kalender.cta.subscribe, link.teamboard, link.telegram_group).
     Bei den Footer-Kanaelen ("Instagram ↗") wurde dagegen NUR das Wort erfasst
     (social.instagram) — sonst haette derselbe Markenname zwei Schluessel.
     → Empfehlung: das ↗ dort per CSS ::after setzen oder ausserhalb des
       data-i18n-Elements halten. Betroffen: alle achtzehn Footer.
   · Marquee-Zeilen als Ganzes. Sie mischen UI-Label, Event-Daten und Datum.
     Erfasst sind nur die Label-Teile (topbar.marquee.*); Titel, Ort und Preis
     kommen aus event.<id>.*, Datum/Uhrzeit aus Intl.
     Achtung: der Ticker steht im Quelltext in VERSALIEN ("OPEN AIR „FREIRÄUME"").
     Das gehoert ins CSS (text-transform: uppercase auf .marquee span), nicht ins
     Woerterbuch — sonst braucht jeder Eventtitel zwei Schluessel.
   · data-share-text auf events.html 171/214/247: aus event.<id>.title + Datum +
     Ort + Preis zusammengesetzt. Das Template baut den Satz, nicht der Uebersetzer.
   · "kollektiv.html#mitmachen" als sichtbarer Linktext (events.html 390) — ein
     roher Pfad, kein Satzteil. Siehe Befund r) in Abschnitt 5.
   · CSS-Klassen, data-Attribute, Kommentare im Quelltext.


   ── 4 · Braucht data-i18n-html statt data-i18n ──────────────────────────────
   Werte mit Inline-Markup. Alles andere kann per textContent gesetzt werden.

   hero.tagline                      <br>, <b>   index.html 213
   missions.h2                       <span>      index.html 247
   sound.h2                          <span>      index.html 338
   crew.h2                           <span>      index.html 375, kollektiv.html 275
   flightlog.h2                      <span>      index.html 425, events.html 180
   events.hero.h1                    <span>      events.html 107
   events.bpm.h2                     <span>      events.html 345
   events.faq.h2                     <span>      events.html 365
   artists.hero.h1                   <span>      artists.html 102
   artists.sets.h2                   <span>      artists.html 173
   artists.guests.h2                 <span>      artists.html 199
   artistpage.flog.h2                <span>      artist-*.html 142
   kollektiv.hero.h1                 <span>      kollektiv.html 106
   kollektiv.werte.h2                <span>      kollektiv.html 146
   kollektiv.finanzen.h2             <span>      kollektiv.html 188
   kollektiv.history.h2              <span>      kollektiv.html 231
   kollektiv.familie.h2              <span>      kollektiv.html 309
   kollektiv.faq.h2                  <span>      kollektiv.html 334
   kollektiv.text.money              <em>        kollektiv.html 115
   team.h1                           <span>      team.html 104
   news.h1                           <span>      news.html 104
   musik.h1                          <span>      musik.html 104
   kalender.h1                       <span>      kalender.html 104
   kontakt.h1                        <span>      kontakt.html 104
   aware.tile.sani.text_full         <b>         awareness.html 112
   awareness.help.principle.text     <b>         awareness.html 130
   awareness.transmission.text       <b>         awareness.html 134
   gallery.placeholder               <br>        kollektiv.html 257–260, event-pride.html 132–137
   musik.trance.text                 <b>         musik.html 111
   musik.hard_trance.text            <b>         musik.html 112
   musik.bounce.text                 <b>         musik.html 113
   kalender.howto.text               <b>         kalender.html 121
   datenschutz.cookies.text          <b>         datenschutz.html 111
   datenschutz.tracking.text         <b>         datenschutz.html 112
   datenschutz.thirdparty.text       <b>         datenschutz.html 113
   event.pwest.brief_long            <b>         event-freiraeume.html 123
   event.pwest.awareness_note        <b>         event-freiraeume.html 131
   flog.m6.debrief                   <em>        event-pride.html 119

   Zusaetzlich markup-haltig, aber bewusst OHNE Schluessel, weil aus mehreren
   Bausteinen zusammengesetzt (Template baut das Markup, nicht der Uebersetzer):
     index.html 257, 279, 302  .m-meta         (<br> zwischen Ort-/Sound-Zeile)
     index.html 262–265, 284–287, 307–309      .m-row dd (<b> um Zeit/Ort/Preis)
     index.html 407–410, awareness.html 111–114, event-marsmission.html 271–274
                                     .atile    (<b> Titel + Fliesstext im selben Element
                                                → Titel und Text sind getrennte Schluessel,
                                                  der Text braucht einen eigenen Wrapper)
     index.html 353, 358, 363        .s-meta   (<b> Titel + <span> Datum/Art)
     index.html 412                  .note      (drei Links im Satz: aware.note.welcome
                                                 + common.more_on_this + link.*)
     event-marsmission.html 276      .note      (event.page.aware.emergency + common.more)
     event-marsmission.html 333      .sc-info  (<b> um Datum und Preis)
     awareness.html 127, 129         .m-row dd (Links auf tel:/mailto:)
     event-marsmission.html 244–247  .act      (<small> Genre unter dem Namen —
                                                artist.<id>.name und
                                                artist.<id>.genres_slash getrennt)
     event-pride.html 145–147        .act      (dito, hier guest.* + common.floor)
     event-marsmission.html 260–262  .tta      (<b> + <p> im selben Block)
     main.js 1562 / event-marsmission.html 369 Countdown-Ausgabe
                                     (<small> um jede Einheit — js.countdown.unit.*)
     kollektiv.html 166, 175, artists.html 223 .transmission p (Links im Satz)
     events.html 111–171             .m-row dd, .m-meta (wie index.html)
     events.html 128, 274            .board-cols (fuenf Spalten, fuenf Schluessel)
     kalender.html 111–113           .m-row dd (event.<id>.title + Ort + Zeit + Preis
                                                + common.details, per Template gefuegt)
     event-freiraeume.html 107–110   .facts    (common.start_at + common.end_at,
                                                event.pwest.venue + .city, .price)
     event-pride.html 107–110        .facts    (flog.m6.venue_name + .city + .floors + .price)
     artist-*.html 115–117           .m-row dd (artists.role.resident + common.since_year …)
     kollektiv.html 278–285          .ccard    (<b> Name + <span> Rolle — zwei Schluessel)
     kollektiv.html 291              .bp-orbit (kollektiv.orbit mit {n} um das <b>)
     kollektiv.html 313–319          .bp-fam-inner (<b> partner.<id> + <span> partner.<id>.note)
     kollektiv.html 368–371          .facts    (<b> kollektiv.booking.*.label + Text)
     news.html 112–137               .n-head   (Badge + Datum) und .ncard p mit Link
     impressum.html 111              .m-row dd (impressum.provider.name + .text +
                                                common.placeholder)
   · index.html 405 setzt in "Feiern, auf das ihr euch<br>verlassen könnt." einen
     harten Umbruch. aware.headline enthaelt ihn NICHT — im Englischen faellt er
     an eine andere Stelle. Der Umbruch gehoert ins CSS (max-inline-size / balance).
   · footer.love traegt im Quelltext ein "<b>♥</b>" hinter dem Satz
     (index.html 495 u. a.). Das Herz ist Deko und bleibt im Template.


   ── 5 · Befunde am deutschen Text ───────────────────────────────────────────
   a) Status-Schreibweise inkonsistent: HTML schreibt "Announced" (index.html 253,
      275; events.html 111, 131), main.js Z. 31/35 schreibt "ANNOUNCED", der
      Marquee der Event-Seite ebenfalls "ANNOUNCED" (event-marsmission.html 63/65).
      Ein Wert, drei Schreibweisen. Vorschlag: Datenwert "announced", Anzeige
      ueber status.announced + CSS text-transform. Dasselbe gilt seit It. 8 fuer
      "Departed" (events.html 289 ff., status.departed) — dort setzt
      .fstatus bereits text-transform: uppercase, der Quelltext schreibt aber
      trotzdem gross an.
   b) Dieselbe Doppelpflege bei "TBA": HTML "TBA 🤫" (index.html 298,
      events.html 154, kalender.html 113), main.js Z. 39 nur "TBA".
   c) Event-ID uneinheitlich: main.js Z. 33 nennt das Mars-Event "marsmission",
      die anderen beiden heissen kurz "pwest" / "strand". events.html vergibt
      wieder andere Slugs (data-slug="freiraeume" / "marsmission" / "strandparty"),
      der Flight Log dort noch andere ("pride", "free-entry-rave", …). Im
      Woerterbuch auftragsgemaess "pwest" / "mars" / "strand" bzw. "m1"…"m6" —
      beim Verdrahten angleichen. Vier Namensraeume fuer dieselben sechs Objekte.
   d) Die Podcast-Folge heisst an drei Stellen unterschiedlich:
      "JOJO | takeoff Podcast #1" (index.html 363, artists.html 188,
      artist-jojo.html 130) gegen "„JOJO | takeoff\" Podcast #1" (artists.html 124)
      gegen "„JOJO | takeoff\" · Folge 1" (artist-jojo.html 116) und
      "„JOJO | takeoff\" — Folge 1 ist draußen" (news.html 130).
   e) Datum des Marsmission-Events widerspruechlich: die Karten und der Marquee
      sagen "SA 19.09." ohne Jahr, die Facts-Zeile "SA 19.09.2026"
      (event-marsmission.html 218). Der 19.09.2026 ist tatsaechlich ein Samstag,
      der 12.09.2026 auch — die Kuerzel stimmen. Aber: das Flight Log fuehrt
      "27.06.26" und "17.01.26" als *vergangene* Events, obwohl beide nach dem
      heutigen Datum des Prototyps liegen. Testdaten, kein Uebersetzungsproblem.
   f) index.html 249 verlinkt "Alle Events & Flight Log" auf "index.html#missionen",
      also auf sich selbst statt auf events.html. Gleiches Muster bei 340
      ("Alle Artists & Sets" -> index.html#sound), 377 ("Mehr übers Kollektiv"
      -> index.html#crew), 412 ("Awareness-Konzept" -> index.html#awareness) und
      479. Auf den Unterseiten zeigen dieselben Labels korrekt auf artists.html
      usw. Kein i18n-Thema, aber es faellt beim Durchgehen auf.
   g) event-marsmission.html 276 verlinkt "Hilfe & Drogennotfälle" auf "#" statt
      auf awareness.html#hilfe.
   h) Das Overlay-Menue sagt fest "3 geplant" (menu.events.note). Die Zahl steht
      hart im HTML, obwohl EVENTS sie kennt — deshalb hier als {n} angelegt.
      Dasselbe Muster neu bei kollektiv.html: "T+ 809 Tage im Orbit" (Z. 291,
      #orbit-days wird per JS ueberschrieben) und "6 Missionen seit 2024"
      (Z. 370) → kollektiv.orbit und kollektiv.booking.experience.text mit {n}.
   i) Apostroph-Schreibweise wechselt: "gibt's", "erfährt's", "Wenn's" nutzen
      durchgehend das gerade ' (U+0027), die Anfuehrungszeichen dagegen die
      typografischen „…". Uneinheitlich, aber konsequent uneinheitlich.
   j) "Ersthelfer*innen" erscheint jetzt an fuenf Stellen in leicht anderer
      Einbettung (index.html 385/408, awareness.html 112, event-marsmission.html 272,
      kollektiv.html 283, team.html 114, event-freiraeume.html 131).
      Das Gendersternchen hat im Englischen kein Aequivalent; uebersetzt als
      "first aiders" bzw. "trained first aiders", die Form geht dabei verloren.
      Gleiches bei "Crew-Anwärter*innen" (kollektiv.html 347) -> "New crew wanted".
   k) Der Countdown der Event-Seite ist eine zweite, kopierte Implementierung
      (event-marsmission.html 360–372) mit denselben Strings wie main.js
      Z. 1557/1562. Beide brauchen dieselben js.countdown.*-Schluessel.
   l) awareness.html 156 nutzt ein geschuetztes Leerzeichen in "z. B." (&nbsp;).
      [It. 7] stand im Woerterbuchwert faelschlich ein normales Leerzeichen; seit
      It. 8 steht dort das U+00A0 wie im Quelltext. Englisch braucht es nicht ("e.g.").
   m) Das aria-label des zweiten Set-Buttons sagt "Set abspielen: mølly on molly"
      (index.html 356, artists.html 181), der sichtbare Titel dagegen
      "mølly (on molly)" — einmal mit, einmal ohne Klammern. a11y.set.play nimmt
      den Namen als {artist} entgegen, also artist.molly.name fuer beide.
   n) Der Ticker der Event-Seite nennt die Crew ("JOJO · DJ PLATZHALTER · CYONIC
      · +TBA", event-marsmission.html 64/66), das Lineup weiter unten dieselben
      Namen noch einmal (244–247). Doppelt gepflegt: aendert sich das Lineup,
      muessen zwei Stellen angefasst werden.
   o) index.html haelt die drei Event-Karten (252–317) und events.html dieselben
      drei Karten (110–171) als Kopie; einziger Unterschied sind die Link-Ziele.
      Auch das ist doppelt gepflegter Inhalt und ein Argument fuer die
      event.*-Datensaetze unterhalb der CMS-Grenze. Seit It. 8 kommt eine dritte
      Kopie dazu: kalender.html 111–113 listet dieselben drei Events noch einmal,
      und event-freiraeume.html wiederholt sie ein viertes Mal in Prosa.
      Ebenso die Crew-Kacheln: kollektiv.html 278–285 und team.html 108–115 sind
      byteidentisch — deshalb teilen sie sich hier EINEN Satz crew.*-Schluessel.

   Neu in It. 8:
   p) footer.proto_note steht auf siebzehn Seiten als "IT 8", nur index.html
      (Z. 496) sagt noch "IT 7". Der Woerterbuchwert ist auf IT 8 gesetzt (die
      Mehrheit); index.html zieht beim Verdrahten automatisch nach. Wer das nicht
      will, muss den Quelltext dort angleichen — zwei Werte fuer eine Zeile waeren
      der falsche Weg.
   q) Der Footer ist It. 8 in zwei Varianten unterwegs:
      · index.html, events.html, artists.html, kollektiv.html, awareness.html:
        "Mitmachen / Crew werden" + "Booking" + "Hilfe & Drogennotfälle"
      · die zwoelf neuen Seiten: nur "Mitmachen", ohne Booking, ohne Hilfe-Link
      Deshalb gibt es footer.join UND footer.join_short. Sobald der Footer
      vereinheitlicht ist, faellt einer der beiden weg.
      Dasselbe beim Overlay-Menue: index.html und event-marsmission.html haben die
      drei neuen Eintraege (News/Kalender/Kontakt) noch nicht.
   r) events.html 390 benutzt den rohen Pfad "kollektiv.html#mitmachen" als
      sichtbaren Linktext. Sollte "Mitmachen" heissen (footer.join_short) —
      bis dahin bleibt die Stelle bewusst ohne Schluessel.
   s) Drei Formulierungen fuer denselben Weg zum Hauptbahnhof:
      "5 min zu Fuß vom Hbf"            event.mars.transit      (event-marsmission.html)
      "5 Min zu Fuß vom Potsdam Hbf"    venue.spartacus.hint_short (events.html 208, 250)
      "≈ 5 Minuten zu Fuß vom Potsdam Hbf" venue.spartacus.hint (event-marsmission.html 300)
      Alle drei sind angelegt, weil alle drei im Quelltext stehen. Einer reicht.
      Genauso beim Schillerplatz: "Fahrrad erwünscht" (events.html 165) gegen
      "Fahrrad ausdrücklich erwünscht" (event-freiraeume.html 139) →
      venue.bastion.hint_short / venue.bastion.hint.
   t) Anfuehrungszeichen: der Quelltext schreibt 54× „…" (U+201E + ASCII ") und
      4× „…“ (U+201E + U+201C) — kollektiv.html 115, 313, 319 und das
      data-share-text in events.html 171. Das Woerterbuch normalisiert auf die
      Mehrheitsform „…". Wer typografisch sauber sein will, sollte den Quelltext
      auf „…“ umstellen und die Werte mitziehen.
   u) "Awareness-Team" traegt zwei verschiedene Rollenzeilen: "Für euch da ·
      jede Nacht" (index.html 386) und "Lila Westen · ansprechbar"
      (kollektiv.html 282, team.html 113). Gleiches beim Sani-Team
      ("Ersthelfer*innen · vor Ort" vs. "· im Umlauf"). Beide Varianten sind
      angelegt (crew.awareness.role / .role_vests, crew.sani.role / .role_roaming),
      inhaltlich ist es dieselbe Aussage.
   v) "Ehrenamtlich" steht zweimal: klein im Stats-Band ("100% ehrenamtlich",
      stats.volunteer) und gross als Wertekachel-Titel (kollektiv.wert.volunteer.title).
      Zwei Schluessel nur wegen der Gross-/Kleinschreibung — beim Aufraeumen
      zusammenlegen und die Kachel per CSS setzen.
   w) events.html trennt "Darf ich fotografieren?" (identisch zu
      event.page.faq.photo.q) von einer eigenen, viel kuerzeren Antwort. Die Frage
      teilt sich deshalb einen Schluessel mit der Event-Seite, die Antwort nicht
      (events.faq.photo.a). Das sieht im Woerterbuch schief aus, ist aber die
      korrekte Abbildung des Quelltextes.
   x) event-pride.html fuehrt die Pride-Party als Recap-Seite, obwohl sie im
      Flight Log unter flog.m6 gepflegt wird — Titel, Ort und Notiz stehen damit
      an zwei Orten. Die Recap-Felder haengen deshalb bewusst unter flog.m6.*,
      nicht unter einem neuen event.pride.*.
   y) kollektiv.html und events.html tragen data-bind-Attribute (hero.eyebrow,
      board.title, patchLog.resetLabel …) fuer den neuen Daten-Gateway aus
      assets/js/data.js. Das ist ein zweiter, unabhaengiger Namensraum. Er
      beschreibt Datenfelder, dieses Woerterbuch beschreibt Textknoten — nicht
      verwechseln, aber beim Verdrahten aufeinander abbilden.


   ── 6 · Uebersetzungsentscheidungen, die ein Muttersprachler pruefen sollte ──

   ★ ENTSCHIEDEN IN IT. 8: Eventtitel werden ALLE uebersetzt.
     Begruendung: sie sind beschreibend (Motto), nicht Markenname. Die Marke ist
     "takeoff". Wer das zurueckdrehen will, aendert genau diese Werte im
     en-Block — und sonst nichts:

       event.pwest.title        "Open Air: Free Spaces"   ← "Open Air: Freiräume"
       event.pwest.headline     "free spaces"             ← "freiräume"
       event.pwest.brief        …"Free Spaces"…           ← …„Freiräume" (open spaces)…
       event.mars.title         "takeoff: Mars Mission"   ← "takeoff: Marsmission"
       event.mars.headline      "mars mission"            ← "marsmission"
       event.strand.title       "takeoff: Beach Party"    ← "takeoff: Strandparty"
       event.strand.motto       "Beach party"             ← "Strandparty"
       flog.m6.name             "Pride Party"             ← "Pride-Party"
       flog.m6.headline         "pride party"             ← "pride-party"
       flog.m3.name             "Spartacus night"         ← "Spartacus-Nacht"
       flog.m4.name             "Our biggest event yet"   ← "Unser größtes Event"
       hist.*.name              (Logbuch-Etappen, ebenfalls beschreibend)
     Mitbetroffen, weil der Titel im Satz vorkommt:
       meta.event.pwest.title/desc · meta.event.pride.title/desc ·
       events.faq.under18.a · partner.schranzverbot.note ·
       partner.stadtjugendring.note · post.freiraeume.title
     Unveraendert bleiben: "Out of Space", "Sky High", "Free Entry Rave" —
     die stehen schon im deutschen Original englisch.
     "Freiräume" ist der schwierigste Fall: gemeint ist Freiraum/Spielraum, nicht
     "freie Zimmer". "Free Spaces" trifft das und ist im Kontext von Jugend- und
     Subkulturarbeit die uebliche Wendung. Alternativen: "Open Spaces" (verliert
     das Politische), "Room to Breathe" (poetischer, weiter weg vom Wortlaut).
     → Das ist die Zeile, die ein Muttersprachler zuerst ansehen sollte.

   · "Muttizettel" (event.page.faq.age.a) -> "a note from your parents won't help
     either". Bewusst umschrieben statt uebersetzt; die deutsche Rechtslage
     (§ 2 JuSchG) hat kein englisches Gegenstueck.
   · "VVK" (event.page.no_presale, event.pwest.no_presale) -> "advance tickets".
     Abkuerzung aufgeloest.
   · "Hilfe holen hat nie Konsequenzen" -> "Getting help never has consequences".
     Bewusst nuechtern, kein Werbeton. Alternativen waeren "you'll never get in
     trouble for getting help" (waermer, aber weniger grundsatzhaft).
   · "Feiern, auf das ihr euch verlassen könnt." -> "Partying you can count on."
     Der deutsche Satz nutzt "das Feiern" substantiviert; Englisch hat dafuer
     kein gleich kurzes Wort. Alternative: "Nights you can count on."
   · "Wer hier funkt" / "Schon bei uns gefunkt" -> "Who's on air" /
     "Already on our airwaves". Das Funk-Bild (Raumfahrt) traegt im Englischen
     nur halb — "funken" heisst hier zugleich "auflegen".
   · "nicht-Verlust-orientiert" -> "not for loss". Das deutsche Wortspiel
     (gewinnorientiert -> nicht-Verlust-orientiert) wurde auf das englische
     "not-for-profit" umgelegt. Klingt im Englischen sogar pointierter — bitte
     gegenlesen, ob das gewollt ist. Betrifft jetzt drei Stellen:
     kollektiv.text.money, kollektiv.wert.notforloss.title, kollektiv.finanzen.intro.
   · "DJ Platzhalter" -> "DJ Placeholder". Uebersetzt, weil der Witz
     ("Der Name ist Programm", artists.html 143) sonst verpufft. Wenn der Name
     als echter Kuenstlername stehenbleiben soll: artist.platzhalter.name,
     sets.liveset.title, crew.nico.name, hist.t0.note, meta.artist.platzhalter.*
     und a11y.set.play zurueckdrehen.
   · "Zero Tolerance bei K.-o.-Substanzen" -> "Zero tolerance for spiking".
     "Spiking" ist der gaengige englische Begriff; "K.-o.-Substanzen" waere
     woertlich "date-rape drugs" — haerter und enger.
   · "Soli-Kasse" -> "solidarity box", "Solipreise" -> "solidarity prices".
     Im UK/US-Kontext ggf. "donation box", das verliert aber die politische
     Konnotation.
   · "Safer Space, nicht Safe Space" bleibt unveraendert — der Begriff wird auch
     im Deutschen englisch gebraucht.
   · "Sani-Team" -> "Medic team", "Sanis" -> "the medics", die Rolle "Sani" in der
     Mitmach-Liste dagegen -> "First aid" (dort ist eine Taetigkeit gemeint, keine
     Gruppe). Im deutschen Raveslang ist "Sani" ein feststehender Begriff, im
     Englischen gibt es kein Pendant gleicher Waerme.
   · "Bordbuch · FAQ" -> "Logbook · FAQ", "Bordcomputer" -> "Onboard computer",
     "Bordfragen" -> "Onboard questions", "← Basis" / "← Zurück zur Basis" ->
     "← Base" / "← Back to base". Das Raumfahrt-Vokabular wurde durchgehend
     gehalten — auch bei "Abflugtafel" -> "Departure board" und
     "Nächster Start" -> "Next launch".
   · "Boarding", "Briefing", "Debriefing", "Timetable", "Flight Log", "Crew Select",
     "Transmission incoming", "Next Launch", "Free Water", "Announced", "Departed",
     "Standby", "TBA", "Awareness first", "DIY", "Mission Log", "Sound-Check"
     stehen schon im deutschen Original englisch und bleiben unveraendert
     (bei "Sound-Check" faellt nur der Bindestrich weg).

   Neu in It. 8 — bitte besonders ansehen:
   · "BL. 01 · HALTUNG" … -> "SHT. 01 · ATTITUDE" …
     "BL." ist die Blattnummer einer technischen Zeichnung. Im englischen
     Zeichnungswesen heisst das "SHT." (sheet). "M 1:1" -> "SCALE 1:1".
     Die Versalien bleiben hier im Wert (anders als beim Marquee), weil diese
     Strings nur an einer einzigen Stelle vorkommen — es gibt keine zweite
     Schreibweise, mit der sie kollidieren koennten. .bp-plate setzt zusaetzlich
     text-transform: uppercase; wer die Werte klein schreibt, verliert nichts.
   · "Frequenzkunde" (musik.eyebrow) -> "Frequency school". Das deutsche Wort ist
     eine Erfindung im Stil von "Warenkunde"; "Frequency school" ist die
     freieste Uebersetzung in dieser Datei. Alternativen: "Frequency 101",
     "Know your frequencies".
   · "Funkkontakt" (kontakt.eyebrow) -> "Radio contact". Haelt das Funk-Bild
     durch, klingt englisch aber technischer als deutsch.
   · "Was läuft hier eigentlich?" -> "So what actually plays here?" Das deutsche
     "eigentlich" ist eine Abtoenungspartikel ohne englisches Gegenstueck; "So …
     actually" ist der naechste Ersatz. Alternative: "What is it we play here?"
   · "Kein Blog, kein Geschwafel" -> "No blog, no waffle". "Waffle" ist britisch;
     im US-Englisch eher "no rambling". Bitte auf das Zielpublikum pruefen.
   · "kurze Funksprüche" -> "short radio messages". Woertlich; "dispatches" waere
     eleganter, verliert aber das Funk-Bild, das die ganze Seite traegt.
   · "Wenn's spät wird und die Muster tanzen" -> "For when it gets late and the
     patterns start dancing". Psytrance-Bild, absichtlich woertlich gelassen.
   · "Erfahren im Umgang mit Ordnungsamt & Stadt" -> "Used to dealing with the
     city and its licensing office". "Ordnungsamt" hat kein Gegenstueck; die
     Umschreibung trifft die Funktion, nicht die Behoerde.
   · "Solipreise an der Bar" -> "solidarity prices at the bar", siehe oben.
   · "Du tickst wie {genre}" (js.bpm.match) -> "Your tempo says {genre}".
     Das deutsche "ticken" spielt auf Metronom und auf "drauf sein" an; das
     Wortspiel geht verloren. Alternative: "You're ticking at {genre} speed".
   · "Lila Westen" -> "Purple vests". In UK-Englisch waere "hi-vis" gelaeufiger,
     das trifft aber die Farbe nicht, die hier die Erkennungsmarke ist.
   · "Fundsachen" -> "Lost property" (UK) statt "Lost and found" (US) — passt zum
     uebrigen Register, aber es ist eine Wahl.
   · "Blaulicht" (Miks DJ-Name) bleibt deutsch. In hist.l1.note steht er in
     Anfuehrungszeichen, im Englischen ohne Glosse — ein US-Leser wird nicht
     wissen, dass das "Blaulicht" am Einsatzfahrzeug gemeint ist.
   · "takeoff-Crew" (artist.takeoff_crew.name) -> "takeoff crew" ohne Bindestrich.
   · "Wohin das Geld fliegt" -> "Where the money flies". Das deutsche Wortspiel
     (fliessen/fliegen) ist im Englischen nur halb da. Alternative:
     "Where the money goes" — korrekter, aber ohne Raumfahrtbezug.


   ── 7 · Wiederverwendung: was bewusst EINEN Schluessel teilt ────────────────
   Navigation, Overlay-Menue, Footer, Mission Control und der Marquee-Ticker
   sind ueber alle achtzehn Seiten byteidentisch — jede dieser Zeilen hat genau
   einen Schluessel; der Ticker wiederholt jede Zeile zweimal (Loop-Technik),
   das bleibt EIN Schluessel. Weitere absichtliche Mehrfachnutzung:

   menu.label           Dialog-aria-label + sichtbarer Burger-Text ("Menü")
   nav.brand            Nav-Logo + Wortmarke im Hero ("takeoff")
   nav.kollektiv        Navigation + Footer-Spaltenueberschrift
   nav.awareness        Navigation + Eyebrow index/awareness + Kontakt-Zeile
                        (kontakt.html 114) + Mitmach-Chip (kollektiv.html 353)
   menu.flightlog.label Menue-Eintrag + Eyebrow der Flight-Log-Sektion
                        + Eyebrow auf den drei Artist-Seiten
   menu.news.note       Menue-Notiz "Mission Log" + Eyebrow auf news.html
   footer.contact       Footer-Spaltenueberschrift + Footer-Link + Menue-Eintrag
                        "Kontakt" + dt auf impressum.html
                        (deshalb gibt es KEIN menu.kontakt.label)
   footer.imprint       Footer-Link + h1 auf impressum.html
   footer.privacy       Footer-Link + h1 auf datenschutz.html
   common.about_us      Footer-Link + Eyebrow auf kollektiv.html
   common.reset         "Zurücksetzen" der Patch-Liste UND des BPM-Tools
   common.podcast       Badge auf news.html + dt auf artist-jojo.html
   card.row.landing     dt "Landeplatz" in den Karten + h3 auf beiden Event-Seiten
   card.row.status      dt "Status" + aria-label des Event-Marquees
                        + Spaltenkopf der Abflugtafel (events.board.col.* hat
                        deshalb nur vier Eintraege)
   card.row.sound       dt "Sound" in den Karten + auf event-freiraeume.html
   crew.awareness.name  Crew-Karte + Awareness-Kachel ("Awareness-Team")
   crew.sani.name       Crew-Karte + Awareness-Kachel ("Sani-Team")
   crew.*               kollektiv.html 278–285 UND team.html 108–115 (identisch)
   artists.row.role     dt "Rolle" auf artists.html + auf allen Artist-Seiten
   artists.row.listen   dd-Label "Hören" + Eyebrow der Sets-Sektion der Artist-Seiten
   artists.row.debut / .specialty / artists.cyonic.specialty / artists.*.bio
                        artists.html-Karte + zugehoerige Artist-Einzelseite
   artists.role.resident / crew.role.dj  Rollenwert in Karte und Einzelseite
   flog.m*.name / .venue Flight Log auf index/events + "Zuletzt"/"Debüt" bei den
                        Artists + Mini-Flight-Log auf den Artist-Seiten
   awareness.rule.no_photo   Hausregel-Chip + Kachel-Titel auf der Event-Seite
   missions.eyebrow     Eyebrow index.html + phero events.html ("Flugplan")
   sound.eyebrow        Eyebrow index.html + phero artists.html ("Frequenzen")
   crew.eyebrow         Eyebrow index.html + kollektiv.html ("Crew Select")
   aware.headline       h2 auf index.html + h1 auf awareness.html
   legal.eyebrow        Eyebrow auf impressum.html UND datenschutz.html
   legal.binding_note   Hinweiszeile auf impressum.html UND datenschutz.html
   gallery.placeholder  Fotowand kollektiv.html + Galerie event-pride.html
   event.page.cta.telegram / .cta.ics / .maps.* / .maps.note / .briefing.h3
                        event-marsmission.html + event-freiraeume.html
   event.pwest.price    Preis-Chip im Hero + .st-tag in der Nav + Karten-dd
                        + Facts-Zeile auf event-freiraeume.html
   event.pwest.venue    Karte + Hero + Landeplatz-Karte (venue.bastion.name ist
                        derselbe Text, aber ein anderer Datensatz — siehe unten)
   genre.trance         Genre-Chip + Genre-Angabe von DJ Platzhalter + dt auf musik.html
   genre.hard_trance / .techno / .psytrance   Chips + dt auf musik.html
   status.tba           Karten-Status + kalender.html-Zeile
   sets.liveset.title / .kind / sets.podcast.title / .kind
                        index.html + artists.html + Artist-Einzelseiten
   guest.emmy / guest.kolja  Gaeste-Log auf artists.html + Lineup auf event-pride.html
   mctrl.* / footer.*        auf allen achtzehn Seiten identisch

   Verbleibende identische Werte (geprueft, absichtlich getrennt) — acht Gruppen,
   alle unterhalb der CMS-Grenze in UNABHAENGIGEN Datensaetzen:
     "Spartacus"   event.mars.venue, event.strand.venue, venue.spartacus.name,
                   flog.m5.venue, flog.m4.venue, flog.m3.venue, partner.spartacus
     "Potsdam"     event.mars.city, event.strand.city, flog.m6.city,
                   flog.m1.venue, hist.t0.venue
     "Nilkeller"   flog.m2.venue, partner.nilkeller
     "KuZe"        flog.m6.venue_name, partner.kuze
     "Bastion am Schillerplatz"  event.pwest.venue, venue.bastion.name
     "Free Entry"  event.mars.price, flog.m6.price
     "Werkstatt"   hist.s1.venue, hist.s2.venue, hist.s3.venue
     "Techno · Trance"  event.pwest.genres, artist.cyonic.genres
   Sie zusammenzulegen wuerde unabhaengige Datensaetze aneinanderketten — beim
   Umzug ins CMS waere das ein Fehler (ein Event zieht um, das Kollektiv nicht).
   Oberhalb der CMS-Grenze gibt es KEINE Dublette.
   Eine Kollision nur im Englischen: card.row.motto und mctrl.theme heissen beide
   "Theme", im Deutschen "Motto" und "Theme". Das ist ein Homonym, keine Dublette —
   zusammenlegen waere falsch.


   ── 8 · Rechtsseiten: impressum.html und datenschutz.html ───────────────────
   Diese beiden Seiten enthalten Pflichtangaben nach deutschem Recht:
   § 5 TMG und § 18 MStV (Anbieterkennzeichnung) sowie die Informationspflichten
   der DSGVO. Die deutsche Fassung ist die rechtlich massgebliche.

   Die englischen Werte in diesem Woerterbuch sind eine VERSTAENDNISHILFE und
   ausdruecklich KEINE Rechtsuebersetzung. Sie duerfen nicht so gesetzt werden,
   als waeren sie eine — deshalb:

   · legal.binding_note steht in beiden Sprachen und gehoert sichtbar auf beide
     Seiten. Der englische Wert sagt es deutlicher als der deutsche, weil nur die
     englische Fassung den Hinweis wirklich braucht:
       de: "Verbindlich ist die deutsche Fassung dieser Seite."
       en: "The German version of this page is the legally binding one.
            This English text is a reading aid, not a legal translation."
     Der deutsche Wert ist bewusst kurz — auf der deutschen Seite ist er nur eine
     Fussnote, auf der englischen eine Warnung.
   · Paragraphenzeichen und Gesetzeskuerzel bleiben im englischen Wert stehen
     (§5 TMG / §18 MStV) und bekommen nur die Glosse "(German law)".
     Ein "§ 5 of the German Telemedia Act" waere schon eine Auslegung.
   · "V. i. S. d. P." bleibt als Abkuerzung stehen, englisch mit erklaerendem
     Zusatz "(person responsible for the content)". Es gibt kein Gegenstueck im
     angelsaechsischen Presserecht.
   · "Anbieter" -> "Provider", nicht "Owner" oder "Publisher": die Pflichtangabe
     heisst Anbieterkennzeichnung, nicht Eigentumsnachweis.
   · Die Rechtefolge der DSGVO ("Auskunft, Berichtigung, Löschung") ist als
     "Access, correction, deletion" uebersetzt — das sind die gaengigen englischen
     Bezeichnungen von Art. 15/16/17 DSGVO, aber sie sind hier beschreibend
     gemeint, nicht als Zitat der Norm.
   · datenschutz.proto_note und impressum.intro sagen in beiden Sprachen offen,
     dass es sich um ein Prototyp-Geruest handelt. Diese Ehrlichkeit ist Teil des
     Textes und darf beim Redigieren nicht wegfallen — sonst sieht der Prototyp
     aus wie eine gueltige Rechtsseite.
   · Bevor die Seite live geht: die deutsche Fassung juristisch pruefen lassen,
     die englische danach neu aus der geprueften Fassung ableiten. Nicht umgekehrt.
   ============================================================================ */
