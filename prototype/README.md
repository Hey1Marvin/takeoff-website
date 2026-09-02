# takeoff — Design-Prototyp (Iteration 2)

Klickbarer Motion-Prototyp der Richtung **„Chrome Odyssey"** aus der Research ([../research/00-MASTER-MINDMAP.md](../research/00-MASTER-MINDMAP.md)). **Kein Produktions-Code** — Ziel ist, Look, Scroll-Gefühl, Theming und die adaptive Effekt-Logik erlebbar zu machen.

## Ansehen

```bash
python3 -m http.server 4173 --directory prototype
```

→ http://localhost:4173 (Startseite) · http://localhost:4173/event-marsmission.html (Event-Seite im fixierten Mars-Theme)

## Was der Prototyp zeigt

| Baustein | Umsetzung |
|---|---|
| **Wortmarke** | Echte **Planet-Kosmos**-Type mit Chrome-Verlauf + Sheen; Tier L: Liquid-Wobble via SVG-Displacement (Vorstufe zum WebGL-Liquid-Metal) |
| **Sternenfeld** | Canvas, 3 Parallax-Tiefen, Twinkle; Tier L: **Warp-Streifen bei Scroll-Geschwindigkeit** |
| **Scroll-Story** | GSAP + ScrollTrigger + Lenis: Hero-Intro, Section-Reveals, gestaffelte Karten, Flight-Log-Zündung, Lineup-„Raketenstufen" |
| **HUD** | Telemetrie-Marquee („NEXT LAUNCH …"), Neon-Scroll-Faden (links/oben) |
| **Event-Theming live** | Mission-Control-Panel unten rechts: **Space / Mars / Strand** wechseln nur CSS-Tokens — Layout bleibt, Stimmung kippt (These aus Research 13) |
| **FX-Tiers S/M/L** | Auto-Erkennung (reduced-motion, Save-Data, deviceMemory, hardwareConcurrency) + **FPS-Watchdog** (L→M bei Rucklern) + sichtbarer Schalter, persistiert |
| **Event-Seite** | Status-Hero mit Patch, Countdown, Lineup A–Z, Timetable-TBA-Zustand, ruhiger Awareness-Block, Venue mit Link-out-Routen (kein Karten-Embed), FAQ, Sticky-CTA |
| **Haltung** | Zwei-Klick-Facades statt Embeds, „Diese Seite trackt dich nicht", Fotoverbot-Kommunikation, Free-Water/„Hilfe holen hat nie Konsequenzen"-Ton |
| **Theme-Deko-Items** (It. 4) | Rand-Gimmicks pro Theme (Space: Satellit/Asteroiden/Rakete · Mars: Planet/Komet/Flagge · Strand: Cocktail/Ball/Schirm), Scroll-Parallax + Float, ab 760px Breite, `aria-hidden` |
| **Luxus-Pass** (It. 4, aus Research 42) | Chrome-Buttons statt Bonbon-Verlauf, 3-Schicht-Glows mit hellen Tint-Kernen (`--acc-*-tint`), tiefere Chrome-Rampe (`--chrome-shadow`), `-webkit-backdrop-filter`+`saturate()` (iOS-Fix), nahtloses Waben-Tile, Genre-/Stats-Bänder als Zwischen-Elemente |

## Bewusst NICHT drin (kommt erst im echten Bau)

Echter WebGL-Liquid-Metal-Shader (Paper Shaders) · echte Fotos (Consent!) · CMS-Anbindung · interner Bereich · View-Transitions zwischen Seiten · finales Wording.

## Lizenz-Notizen

- **Planet Kosmos** (`assets/fonts/planetkosmos.ttf`): „CD-Ware" — frei für nicht-kommerzielle Nutzung; für kommerzielle Nutzung schickt man dem Designer eine CD mit eigenem Kram (siehe `planetkosmos-readme.txt`). Für ein nicht-gewinnorientiertes Kollektiv vermutlich unkritisch — vor Launch kurz klären oder Wortmarke einmalig als SVG vektorisieren.
- **Unbounded / Space Grotesk / Space Mono**: SIL OFL (frei, auch kommerziell).
- **GSAP + ScrollTrigger**: seit 3.13 komplett kostenlos. **Lenis**: MIT.

## Struktur

```
prototype/
├── index.html               Startseite (Scroll-Story)
├── events.html              Events + Flight Log (It. 7)
├── artists.html             Residents (aufklappbar) + Sets + Gäste-Log (It. 7)
├── kollektiv.html           Über uns, Crew, Familie, Mitmachen, Booking (It. 7)
├── awareness.html           Awareness, Hilfe/Notfall, Hausregeln (It. 7)
├── event-marsmission.html   Event-Detail (Mars-Theme fixiert)
├── event-freiraeume.html    Event-Detail kommend (It. 8, generiert)
├── event-pride.html         Event-Recap vergangen (It. 8, generiert)
├── news/kalender/team/musik/kontakt/impressum/datenschutz.html  (It. 8, generiert)
├── artist-{jojo,platzhalter,cyonic}.html  Artist-Profile (It. 8, generiert)
├── tools/gen-pages.py       Generator für die It.-8-Seiten (ein Shell-Template)
├── assets/css/style.css     Tokens → Themes → Tiers → Komponenten
├── assets/js/main.js        Tier-Logik, Sternenfeld, Countdown, Scroll-FX, Mission Control
├── assets/fonts/            Planet Kosmos + OFL-Webfonts (lokal, kein Google-Request)
└── assets/vendor/           gsap, ScrollTrigger, lenis (lokal gepinnt)
```

## Bildquellen

**Mond** (`assets/img/moon-*.webp`) — NASA Goddard Scientific Visualization Studio,
CGI Moon Kit (https://svs.gsfc.nasa.gov/4720/): LROC-Farbmosaik + LOLA-Höhenkarte.
Gemeinfrei. Credit-Zeile „NASA/GSFC Scientific Visualization Studio" gehört vor dem
Launch ins Impressum.

**Mars-Szene** (`paintMarsFX()` in `main.js`) — Rover, Startturm und Traeger sind
vollstaendig gezeichnet, kein Bildmaterial. Proportionsgrundlage des Rovers sind die
veroeffentlichten Masse von **Perseverance** (Koerper 3,0 m, Raeder 52,5 cm mit 48
Grousern, Mastspitze 2,2 m, Arm 2,1 m); als Vorlage fuer Anordnung, Staublage und
Glanzlichter dienten Aufnahmen von **NASA/JPL-Caltech** (u. a. PIA24542, PIA22111,
gemeinfrei). Es wurde nichts davon ins Projekt kopiert. **NASA-Logos (Meatball, Worm)
kommen nicht vor.**

**Böden** (`assets/img/ground-*.webp`) — jeweils beschnitten, farblich gegradet und mit
eingebackenem Alpha-Verlauf versehen:

| Theme | Quelle | Lizenz | Namensnennung nötig |
|---|---|---|---|
| Mars | Perseverance, Jezero-Krater | NASA/JPL-Caltech, gemeinfrei | „Courtesy NASA/JPL-Caltech" |

Nur noch **Mars** benutzt ein Foto. **Space** ist wieder reiner Nachthimmel (kein Boden),
**Strand** ist eine vollständig in Canvas 2D gezeichnete Szene (`paintBeach()` in
`main.js`) — beide Fotos wurden entfernt.

**Sonne** (`assets/img/sun-detail.webp`) — Photosphäre im Weißlicht, Instrument HMI auf
dem Solar Dynamics Observatory (NASA), Aufnahme vom **09.05.2024, 12:00 UTC**.
**Gemeinfrei.** Freigestellt, in eine Luminanzkarte gewandelt, kreisförmig maskiert.

Das Datum ist bewusst gewählt: An diesem Tag stand die aktive Region **AR3664** auf der
erdzugewandten Seite — eine der größten Fleckengruppen seit Jahrzehnten. Eine Aufnahme
vom aktuellen Tag zeigt oft nur zwei winzige Flecken und wirkt neben dem kraterreichen
Mond leer. Anders als der Mond, dessen Phase mitgerechnet wird, ist die Sonne damit eine
feste historische Aufnahme — sichtbar ändert sie sich von Tag zu Tag ohnehin kaum.

Enthalten sind die echte Randverdunklung (gemessen: Mitte 242, Rand 197) und die
tatsächlichen Flecken dieses Tages. Das Orange der Originalaufnahme ist Falschfarbe —
die Photosphäre ist bei 5772 K weiß; eingefärbt wird zur Laufzeit nach Sonnenhöhe.

**Europa** (`assets/img/europa-color.webp`) — äquirektangulare Globalkarte aus Voyager-
und Galileo-Aufnahmen (NASA/JPL/USGS). **Gemeinfrei.** Die Vorlage ist graustufig;
eingefärbt als Duotone, Eis nach `#E9E4D6`, Bruchlinien nach `#6E4432`.

**Elon-Karikatur** (`assets/img/elon-head.webp`) — Wikimedia Commons,
„Elon Musk – Caricature" von **DonkeyHotey** (2026), **CC BY 4.0**
(https://creativecommons.org/licenses/by/4.0/), Datei
`Elon_Musk_-_Caricature_(55492158089).png`. Freigestellte Vorlage, auf Kopf und
Kragen beschnitten und als WebP verkleinert (440 × 553). Sie sitzt als Figur auf
der Raketenspitze im Mars-Theme.

⚠️ **Damit hat das Projekt wieder genau eine Lizenzauflage: die Karikatur.** Vor dem
Launch müssen „DonkeyHotey", der Lizenzlink und der Hinweis „bearbeitet" in die
Bildnachweise. Alles andere ist gemeinfrei. Das Erd-Bild (Nächtlicher Wald, Vyacheslav
Argenberg, CC BY 4.0) war die frühere Auflage und ist mit dem Space-Boden entfallen.

Zusätzlich zum Urheberrecht berührt eine Karikatur einer realen Person das Recht am
eigenen Bild. Bei einer Person der Zeitgeschichte in satirischem Zusammenhang ist das
in Deutschland regelmäßig zulässig; vor einer kommerziellen Nutzung wäre es zu prüfen.

Die Credit-Zeilen für die NASA-Aufnahmen (Mars, Mond, Sonne, Europa) sind Höflichkeit,
keine Pflicht.
NASA-Logos (Meatball, Worm) sind **nicht** gemeinfrei und dürfen nicht verwendet werden.
