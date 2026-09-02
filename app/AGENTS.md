# AGENTS.md — Arbeiten an der takeoff-App

Für jeden Agent (und Menschen), der hier baut. Das Projekt wird wachsen
(interner Bereich, Supabase, mehr Seiten) — diese Regeln halten es dabei gesund.

## Kommandos

```bash
npm run dev --prefix app      # Dev-Server, Port 3000 (launch.json: "app")
npm run build --prefix app    # MUSS grün sein, bevor du fertig bist
cd app && npx tsc --noEmit    # schneller Typ-Check. MUSS aus app/ laufen — von der
                              # Wurzel findet npx das lokale tsc nicht und meldet
                              # fälschlich Erfolg. Bei Parallelarbeit nur diesen
                              # nutzen, nie zwei `next build` gleichzeitig (.next kollidiert)
npm run lint --prefix app
node app/scripts/verify-ui.mjs # UI-Prüfmatrix im echten Browser (s. u.)
```

## Verifizieren (Pflicht vor „fertig")

**Ein grüner Build beweist nur, dass es kompiliert.** In It. 12 war der Build die
ganze Zeit grün, während das Boot-Script auf jeder Seite an einem Syntaxfehler
starb — FX-Tier, Theme, Tag/Nacht und `prefers-reduced-motion` griffen nirgends.
Deshalb:

1. `npm run build` grün (bzw. `tsc --noEmit` bei Parallelarbeit; der Orchestrator baut dann).
2. **`node app/scripts/verify-ui.mjs`** — fährt die Seite in einem echten Browser
   und prüft in einem Durchlauf: Konsolenfehler auf allen Routen · die sechs
   Szenen-Ebenen · Ebenen-Lecks nach Client-Navigation · `scene-edges`/`is-event`
   je Route · alle sechs Theme×Tag/Nacht-Kombinationen · FX-Tiers s/m/l ·
   `prefers-reduced-motion` · Sprachumschaltung und Sperre der Rechtsseiten ·
   horizontaler Overflow über acht Bildschirmbreiten · Text ohne hinterlegte
   Fläche (Lesbarkeit über der hellen Strand-/Marsszene) · gemeinsame linke
   Textkante in allen Label-Wert-Listen.
   Vorher `npm run build && npm run start -- -p 3210`. Braucht Playwright
   (`npx playwright install chromium`), ist aber bewusst KEINE Projekt-Abhängigkeit.
   **Neue Seite gebaut? Trag sie in `ROUTES` im Skript ein.**
3. Eigene Interaktionen zusätzlich per Klick testen — das Skript kennt sie nicht.
4. A11y: aria auf Interaktivem, Tastatur-bedienbar, `aria-current` in Navs.

## Verträge (global, überall einhalten)

| Vertrag | Quelle |
|---|---|
| **Daten NUR über den Gateway** — nie direkt fs/fetch in Seiten | `src/lib/data.ts` (Adapter-Muster; Supabase kommt als Adapter-Tausch) |
| **Links NUR über den Generator** — neue Seite dort eintragen → Nav/Menü/Footer überall aktuell; Einzelverweise über `pageHref("kollektiv", "mitmachen")` statt roher Strings | `src/lib/site.ts` |
| **UI-Chrome-Texte über i18n**, DE **und** EN. Ein fehlender EN-Schlüssel ist ein Build-Fehler, kein stiller Textverlust. Sichtbarer Text gehört in eine Client-Komponente — sonst wechselt er beim Umschalten nicht mit | `src/lib/i18n/` + `I18nProvider` |
| **Inhalte gehören der Datenschicht**, nicht dem Wörterbuch: Events/Artists/News kommen aus `db.json`, Seitentexte aus `data/pages/<slug>.json` | `src/data/` |
| **Farben/Typo/Abstände NUR über die Tokens** — keine neuen Hex-Werte erfinden | `src/styles/takeoff.css` (`--acc-*`, `--bg-*`, `--chrome-*`, `--font-*`) |
| **Datentypen = Contracts** (werden später Supabase-Tabellen + Admin-Formulare) | `src/data/contracts/*.json` + `src/lib/types.ts` synchron halten |
| **Text braucht eine Fläche.** Über Strand- und Marsszene ist der Hintergrund hell. Neue Textblöcke in die `:is()`-Liste in `scene-night.css` eintragen — auf der ENGSTEN sinnvollen Ebene, sonst wird ein halber Bildschirm dunkel | `src/styles/scene-night.css` |
| **Label-Wert-Listen sind ein Subgrid** (`.m-rows`/`.m-row`): alle Werte beginnen links auf einer Linie. Keine eigenen Flex-Layouts dafür bauen | `src/styles/takeoff.css` |
| **Medien gehoeren in die Datenschicht.** Videos als `MediaItem` am Event/Artist bzw. in `db.json → media.<seite>`, nie als Pfad im TSX. Neue Clips entstehen aus `scripts/encode-reels.sh` + `reels-map.tsv`; das Rohmaterial in `InstaReels/` bleibt lokal | `src/data/db.json`, `MediaGallery.tsx` |
| **Fremd-Player nur in drei Stufen**: Ruhezustand → Hinweis → Embed. Vor der Zustimmung geht KEIN Request an SoundCloud/YouTube, auch kein Standbild. Prüfung 10 in `verify-ui.mjs` misst das | `ArtistsSetCard.tsx` |
| **FX-Tiers + reduced-motion** in jeder Client-Komponente respektieren | Boot-Script in `layout.tsx`, Muster in `Starfield.tsx` |
| **Darstellungs-Zustand lebt auf `<html>`**, nicht in React: `data-fx`, `data-theme`, `data-video`, `lang` und die Klassen `day-mode`, `ground-on`, `scene-edges`, `is-event`, `js`. Schalter schreiben nur dorthin, Leser abonnieren per `MutationObserver`/`useSyncExternalStore` — nie ein zweiter Zustand daneben („Panel sagt Tag, Canvas malt Nacht") | `layout.tsx` (BOOT), `src/lib/sky/state.ts`, `MissionControl.tsx` |
| Kein Tracking, keine Dritt-Requests, Embeds nur als Zwei-Klick-Facade | CLAUDE.md (Repo-Wurzel) |
| Deutsch, Du-Form, takeoff-Ton; Safety-Texte ernst | research/03 (Tonalität) |

## Struktur & Namensräume

```
src/app/<route>/page.tsx      Seiten (Server Components; Client nur wo nötig)
src/app/events/[slug]/        dynamische Event-Seiten (aus DB — Vorbild für neue dynamische Routen)
src/components/               geteilte Bausteine (Topbar, Footer, Starfield, ExpandCard …)
src/components/pages/<Slug>*  seitenspezifische Client-Komponenten (Canvas-Motive etc.)
src/styles/takeoff.css        das Design-System (GETEILT — nur mit Bedacht ändern)
src/styles/pages/<slug>.css   Seiten-Styles: eigene Datei, im page.tsx importieren
src/lib/                      Gateway, Typen, site, i18n (GETEILT — Änderungen abstimmen)
src/data/                     db.json, pages/*.json, contracts/ (Quelle: Sync aus prototype/, s. MIGRATION.md)
public/img|fonts              Assets (selbst gehostet, nichts von CDNs)
```

**Parallel-Arbeit:** Ein Agent = ein Routen-Namensraum (`src/app/<route>/**` +
`src/styles/pages/<slug>.css` + `src/components/pages/<Slug>*`). Geteilte Dateien
(layout, takeoff.css, lib/) verändert nur der Orchestrator.

## Der Prototyp ist eingefroren (ab It. 14)

`../prototype/` wird **nicht mehr angefasst** — auch nicht für Design-Experimente.
Er ist eingefrorene visuelle Referenz und wird ausschließlich gelesen. Die
Portierung ist abgeschlossen; die Regel „beim Portieren nicht neu designen" gilt
damit nicht mehr. **In `app/` wird gestaltet.**

## Ausblick (mitdenken, nicht vorbauen)

- **Supabase**: Adapter in data.ts, Tabellen = Contracts, Auth (E-Mail-OTP) für /admin
  und den internen Bereich (Spec: research/25) — Server Actions statt Draft-Overlay.
- **Interner Bereich**: eigene Route-Group `(intern)` mit Auth-Gate, Rollen helper/crew/orga/admin.
- **Admin**: /admin-Route, Contract-getriebener Formular-Generator (Vorbild: prototype/admin.html).

## Fallen, die uns schon Zeit gekostet haben

Alle vier sind echt passiert. Sie kosten jeweils eine halbe Stunde Suche, wenn
man sie nicht kennt.

- **Das BOOT-Script in `layout.tsx` ist ein Template-Literal.** `\/` wird darin
  zu `/`. Eine Regex wie `/\/+$/` verwandelt sich damit in einen Zeilenkommentar
  und verschluckt den Rest des Skripts — ohne Build-Fehler, ohne Konsolen-Hinweis
  auf die Ursache. Im BOOT deshalb Zeichenketten-Operationen statt regulärer
  Ausdrücke. Danach `node scripts/verify-ui.mjs` laufen lassen.
- **`:is()` erbt die Spezifität seines stärksten Arguments.** Steht in einer
  Liste ein `.a + .b`, zählt die ganze `:is()`-Gruppe als zwei Klassen. Eine
  spätere Media-Query mit lauter Einzelklassen verliert dann trotz Quellreihen-
  folge. Genau so griff die schmale Variante der Nacht-Trägerfläche nie.
- **`npx tsc --noEmit` aus der Repo-Wurzel findet das lokale TypeScript nicht**
  und meldet Erfolg, ohne etwas geprüft zu haben. Immer aus `app/` starten.
- **Ein laufender Dev-/Prod-Server bedient den ALTEN Build.** `pkill -f "next start"`
  greift nicht — der Prozess heißt `next-server`. Nach dem Bauen den Port prüfen
  (`ss -ltnp | grep 3210`) und den alten Prozess gezielt beenden, sonst prüfst du
  minutenlang einen Stand, den es nicht mehr gibt.

## Parallel arbeiten

Ein Agent = ein Namensraum. Geteilte Dateien (`layout.tsx`, `takeoff.css`,
`src/lib/{data,site,i18n,types}.ts`, `package.json`, `eslint.config.mjs`) ändert
NUR der Orchestrator. Bewährtes Muster: Agents legen Dateien ab, die noch
niemand importiert — der Build bleibt dabei grün und die Optik unverändert —,
und der Orchestrator verdrahtet sie danach in einzeln prüfbaren Schritten.

Das Repository **ist** seit dem 02.09.2026 ein Git-Repository. Vor größeren
Umbauten also: eigener Branch, Zwischenstände committen. Der Crew-Bereich liegt
bewusst außerhalb der Versionskontrolle (Wurzel-`.gitignore`) — dort schützt nur
eine Kopie.
