# takeøff — Website

Website des **takeøff-Kollektivs**, Potsdam — ehrenamtliches Rave-Kollektiv,
Trance · Hard Trance · Bounce. DIY: eigene Anlage, eigene Deko, eigene Nächte.

**[→ Design-Prototyp ansehen](https://hey1marvin.github.io/takeoff-website/)**

---

## Die zwei Teile

| Ordner | Was das ist |
|---|---|
| **`app/`** | Die echte Website. Next.js 16 (App Router), TypeScript, vanilla CSS. Hier entstehen neue Features. |
| **`prototype/`** | Das Design-Labor: statisches HTML/CSS/JS ohne Build-Schritt. War die Vorlage für `app/` und bleibt als visuelle Referenz stehen. Das ist auch das, was unter dem Link oben liegt. |

## Loslegen

```bash
npm install --prefix app
npm run dev --prefix app          # http://localhost:3000

python3 -m http.server 4173 --directory prototype   # http://localhost:4173
```

Weitere Kommandos, die Architektur-Verträge (Daten-Gateway, Link-Generator,
i18n, FX-Stufen) und die Fallen, die schon Zeit gekostet haben, stehen in
**[`app/AGENTS.md`](app/AGENTS.md)**.

## Wie es gebaut ist

- **Alle Inhalte über einen Gateway** (`app/src/lib/data.ts`, Adapter-Muster):
  heute JSON-Dateien, später Supabase — ohne dass eine Seite angefasst wird.
- **Contract-getrieben** (`app/src/data/contracts/*.json`): ein Datentyp wird
  dort beschrieben, daraus entstehen später Admin-Formulare und Tabellen.
- **Szenen-Engine** (`app/src/lib/sky/`): Sternenfeld mit echter Mondphase,
  Marsboden, gemalte Strandszene, Tag-Himmel — Canvas 2D, ohne Fremd-Bibliothek.
- **Drei Themes** (Space · Mars · Strand) × **Tag/Nacht**, dazu drei
  Effekt-Stufen für schwache Geräte und `prefers-reduced-motion`.
- **Zweisprachig** (DE/EN) mit Umschaltung ohne Neuladen.
- **Kein Tracking, keine Fremd-Requests.** Schriften und Medien liegen lokal,
  Einbettungen nur als Zwei-Klick-Lösung.

Prüfen, was ein Build nicht sieht (Konsolenfehler, Szenen-Ebenen, Overflow über
acht Bildschirmbreiten, Tag/Nacht, Sprache):

```bash
npm run build --prefix app && npm run start --prefix app -- -p 3210
node app/scripts/verify-ui.mjs
```

## Was hier bewusst fehlt

- **`research/`** — die interne Wissensbasis (Konzepte, Specs, Analysen) bleibt
  beim Kollektiv. Einige Dokumente verweisen darauf; diese Links laufen hier
  ins Leere.
- **Der Crew-Bereich** (`/crew`) — der interne Helferbereich enthält das
  Betriebshandbuch des Kollektivs (Schichtabläufe, Notfallplan) und ist
  deshalb nicht Teil dieses Repos. Der Footer verlinkt ihn trotzdem; in einem
  Klon läuft der Link ins Leere.
- **Geheimnisse und lokale Daten** — `.env*` und die SQLite-Datei.

## Hosting

Der Link oben ist eine **Vorschau über GitHub Pages** und zeigt den Prototyp.
Pages liefert nur statische Dateien aus; die App braucht für den Crew-Bereich
einen Node-fähigen Host — das kommt separat.

Prototyp neu veröffentlichen:

```bash
./scripts/publish-prototype.sh
```

## Stand

Der Prototyp ist als Vorlage abgelöst — die App trägt inzwischen alle Seiten,
die Szenen-Engine, Tag-/Nachtmodus und die Sprachumschaltung. Inhalte sind
teils Platzhalter, die Rechtstexte sind noch nicht final.
