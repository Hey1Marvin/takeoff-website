# Daten- & Arbeits-Vertrag für Seiten-Ausbau (It. 9)

## Architektur

- **Zentraler Gateway:** `assets/js/data.js` → globales `TakeoffData`. ALLE dynamischen Inhalte laufen darüber — nie direkt `fetch()` in Seiten-Skripten. Heute liest er `assets/data/db.json` + optional `assets/data/pages/<slug>.json`; später wird nur der Adapter gegen Supabase getauscht (Skizze im Gateway-Code). Auch Login läuft später über den Gateway.
- **API:** `TakeoffData.settings() · events() · event(slug) · upcoming() · past() · nextEvent() · artists() · artist(slug) · guests() · team() · news() · history() · page(slug) · bindText(root, obj) · fmtDate(iso)` — alles async.
- **Dynamik-Prinzip:** Headlines, Intros, Texte, Bildpfade einer Seite kommen aus `page(slug)` (Datei `assets/data/pages/<slug>.json`, die DU anlegst). Listen (Events, Artists, News, Team, History) kommen aus den Gateway-Listen. **Das statische Markup bleibt als Fallback stehen** — JS ersetzt/ergänzt es nach dem Laden (progressive enhancement; ohne JS/Fetch bleibt die Seite les- und benutzbar).

## Datei-Regeln (Konflikt-Vermeidung — STRIKT)

Pro Seite `<slug>` darfst du anfassen/anlegen:
1. `<slug>.html` — NUR die eigene Seite
2. `assets/css/pages/<slug>.css` (neu; im `<head>` NACH style.css einbinden)
3. `assets/js/pages/<slug>.js` (neu; `defer`, NACH data.js und main.js einbinden)
4. `assets/data/pages/<slug>.json` (neu; alle editierbaren Texte/Headlines/Bilder der Seite)
5. Neue Bilder nur unter `assets/img/pages/<slug>/` (SVG selbst zeichnen oder vorhandene `assets/img/placeholders/*.svg` referenzieren)

**VERBOTEN:** Änderungen an `style.css`, `main.js`, `data.js`, `db.json`, `index.html`, `event-marsmission.html`, `tools/`, fremden Seiten, Vendor-Dateien. Brauchst du einen Shared-Style: definiere ihn im Seiten-CSS (Duplikat ist ok, Konflikt nicht).

Script-Einbindung im HTML der Seite (Reihenfolge!):
```html
<link rel="stylesheet" href="assets/css/pages/<slug>.css">
...
<script defer src="assets/js/data.js"></script>
<script defer src="assets/vendor/gsap.min.js"></script>
<script defer src="assets/vendor/ScrollTrigger.min.js"></script>
<script defer src="assets/vendor/lenis.min.js"></script>
<script defer src="assets/js/main.js"></script>
<script defer src="assets/js/pages/<slug>.js"></script>
```

## Design-System (bindend)

- Basis bleibt IMMER: Sternenhimmel-Canvas, dunkle Palette (`--bg-0:#07060f`), Chrome-Typo, Mono-HUD, Hairlines (`--bg-hairline`), gedämpfte Akzente (`--acc-1/2/3` + `--acc-*-tint` für helle Text-Kerne).
- **Ein Signatur-Motiv pro Seite** — grundlegend (wie der Mars-Boden), nicht ein Deko-Sticker. Umsetzung mit CSS/Canvas 2D/SVG/GSAP; KEINE neuen Libraries, keine CDN-Requests, keine Webfonts von außen.
- **Der HINTERGRUND der Seite DARF und SOLL verändert werden** (ausdrücklich vom Auftraggeber erlaubt, 02.09.) — so wie die Event-Seiten eigene Böden/Stimmungen haben: eigener Horizont, Farbschleier, Textur-Layer, eigene Canvas-Ebene. WICHTIG: **zusätzlich zum Sternenhimmel, nicht statt ihm** — der Basis-Himmel bleibt sichtbar (genau wie beim Mars-Boden, der UNTER dem Nachthimmel liegt). Technik: eigene Background-Layer per Seiten-CSS/JS zwischen Sternenhimmel und Inhalt legen; dezentes Tönen/Dimmen von `#stars` im Seiten-CSS ist ok, Ausblenden nicht. Die Familien-Zugehörigkeit muss erkennbar bleiben (dunkle Basis, Chrome-Typo, HUD) — aber der Ort darf ein anderer sein. Tier s bekommt eine statische Version des Hintergrunds.
- Kein Kitsch: keine text-shadow-Neon-Fließtexte, keine Regenbogen-Verläufe, keine particles.js-Optik, Glow nur mehrschichtig-dezent (Muster in style.css).
- Planet-Kosmos-Font NUR für Wortmarke/Event-Titel (`.etitle`); sonst Unbounded/Space Grotesk/Space Mono.
- **FX-Tiers respektieren:** `html[data-fx="s"]` = keine Animationen/kein Canvas (statischer Fallback!), `"m"` = dezent, `"l"` = volle Show. `prefers-reduced-motion` zusätzlich beachten. Eigene rAF-Loops: bei `document.hidden` pausieren, bei Tier s gar nicht starten.
- Mobile-first: kein horizontaler Overflow, Interaktives ≥44px Tap-Ziel, `aria-*` für alles Interaktive.
- Deutsch, Du-Form, takeoff-Ton (locker, warm; Safety-Themen ernst).

## Contracts & Settings-Seite (It. 10 — Auto-Registrierung)

Parallel entsteht `admin.html` (Settings-Seite): Sie rendert Bearbeitungs-Formulare **automatisch aus Contracts** (`assets/data/contracts/*.json`) und schreibt Änderungen als Draft-Overlay (`TakeoffData.admin.saveDraft(...)`), die der Gateway sofort über die DB mischt. **Konvention für Seiten-Bauer:** Deine `assets/data/pages/<slug>.json` IST automatisch bearbeitbar (String → Textfeld, Array → Liste, Objekt → Gruppe). Optional kannst du oben `"_labels": { "pfad.zum.feld": "Schöner deutscher Name" }` ergänzen — mehr brauchst du nicht zu tun, die Settings-Seite registriert deine Seite von selbst. Theme-Regel: `TakeoffData.activeTheme()` liefert das Theme des nächsten Events (Standard „space").

## Qualitäts-Check vor Abgabe

Datei nach dem Schreiben nochmal LESEN (Syntax!), auf `console.error`-Quellen prüfen (fehlende Guards, wenn Elemente auf anderen Seiten fehlen — dein JS läuft NUR auf deiner Seite, guard trotzdem mit `if (!el) return;`). JSON valide (keine Kommentare, keine trailing commas).
