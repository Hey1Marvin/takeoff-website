# Contracts — Format & Auto-Registrierung

Dieser Ordner beschreibt **alle bearbeitbaren Datentypen** der Settings-Seite (`admin.html`). Jede Datei hier ist ein **Contract**: eine JSON-Beschreibung, aus der der Formular-Generator automatisch ein Bearbeiten-Formular + eine Übersichtstabelle baut. Niemand muss admin.html von Hand erweitern, wenn ein neuer Contract dazukommt — siehe „Auto-Registrierung" unten.

Diese Contracts sind bewusst **1:1 an der heutigen `db.json`-Struktur** gebaut: Was hier als Feld beschrieben ist, entspricht exakt einem Pfad in `db.json`. Wenn später gegen Supabase getauscht wird, werden aus diesen Feldlisten weitgehend direkt die Tabellenspalten.

## Grundformat einer Contract-Datei

```jsonc
{
  "$contract": "event",              // Dateiname ohne .json, technischer Bezeichner
  "version": 1,                       // hochzählen bei brechenden Änderungen am Feld-Set
  "label": "Event",                   // Singular, deutsch
  "labelPlural": "Events",            // Plural, deutsch
  "icon": "calendar",                 // kurzer Bezeichner fürs Nav-Icon (siehe unten)
  "description": "…",                 // optional: 1 Satz Einordnung, oben im Formular gezeigt
  "storage": {
    "scope": "db",                    // aktuell immer "db" (db.json) oder "page" (assets/data/pages/<slug>.json)
    "collection": "events",           // Schlüssel in db.json bzw. Seiten-Slug
    "key": "slug"                     // welches Feld identifiziert einen Datensatz eindeutig
  },
  "fields": [ /* siehe unten */ ],
  "list": { "columns": ["title", "date", "visible"], "sort": "date" },
  "actions": ["create", "edit", "toggleVisible", "delete"]
}
```

`storage.key` **fehlt bei Singleton-Contracts** (aktuell nur `settings.json`): Wenn `db.json[collection]` ein einzelnes Objekt ist statt einer Liste, gibt es kein `key`-Feld, kein `list`-Block und `actions` enthält üblicherweise nur `["edit"]`. Der Generator zeigt dann ein einzelnes Formular statt einer Tabelle.

## Feld-Grundgerüst

```jsonc
{
  "key": "title",           // Pfad in den Datensatz — siehe „Verschachtelte Felder" unten
  "type": "text",           // siehe Typenliste
  "label": "Titel",         // deutsch, laienverständlich
  "required": true,         // optional, Default: false
  "default": "…",           // optional, wird beim Anlegen vorbelegt
  "help": "…",               // optional, aber bei allem Nicht-Trivialen bitte ausfüllen
  "options": [ … ],          // bei select/multiselect (siehe unten), oder Sonderform bei theme
  "collection": "artists",   // bei relation, oder bei select/multiselect mit dynamischer Quelle
  "displayField": "name",    // optional bei relation/collection-multiselect: welches Feld der Zielsammlung als Label dient
  "of": [ … ],                // bei type "list": Sub-Feld-Definitionen (gleiche Form wie hier)
  "activates": "…"           // optional: Kurzsatz „was passiert automatisch, wenn dieses Feld gefüllt ist"
}
```

### Verschachtelte Felder (Dot-Paths)

`key` darf einen Punkt-Pfad enthalten, z. B. `"venue.name"` oder `"pricing.mode"`. Der Generator liest/schreibt dann `datensatz.venue.name` statt eines Top-Level-Felds. Gleiche Konvention wie bei `_labels` in `assets/data/pages/<slug>.json` (siehe DATA.md). Fehlende Zwischenobjekte beim Speichern werden vom Generator angelegt.

## Feld-Typen

| type | Beschreibung |
|---|---|
| `text` | Einzeiliges Textfeld |
| `textarea` | Mehrzeiliges Textfeld, kein Markup |
| `richtextLite` | Wie `textarea`, aber `**fett**` und Absätze (Leerzeile) werden beim Rendern umgesetzt |
| `date` | Echtes Datum (yyyy-mm-dd). Nur für Felder, die **immer** ein valides Datum sind — Freitext wie „TBA" oder „Heute" braucht `text`, nicht `date` |
| `time` | Uhrzeit (HH:MM). In diesen Contracts aktuell ungenutzt, weil reale Zeitfelder (`doors`, `end`) auch Freitext wie „TBA"/„open end" enthalten — dort bewusst `text` |
| `number` | Zahl |
| `toggle` | An/Aus-Schalter, Wert `true`/`false` |
| `select` | Auswahl aus `options` **oder** dynamisch aus einer `collection` (siehe unten) |
| `multiselect` | Wie `select`, aber Mehrfachauswahl |
| `color` | Farbwähler. Speichert je nach Feld entweder Hex (`#rrggbb`) oder ein „R G B"-Trio (für CSS `rgba()`) — erkennbar am `default`-Beispielwert im jeweiligen Contract. Der Formular-Generator wandelt Hex⇄RGB-Trio bei Bedarf um |
| `image` | Ein Bild: Pfad-Auswahl aus `assets/img/**` **oder** freies URL-Feld |
| `images` | Liste von `image` (Galerie) |
| `list` | Wiederholbare Unterobjekte, Felder über `of` definiert (siehe „Listen" unten) |
| `relation` | Auswahl **eines** Datensatzes aus einer anderen Collection (`collection`-Property Pflicht) |
| `theme` | Zusammengesetztes Widget: Preset (space/mars/strand/…) + Akzentfarbe + Patch-Symbol. Siehe „Theme-Feld" unten |
| `password` | Nur Stub: Feld wird `disabled` gerendert, Hinweistext „kommt mit Login" |

### `options`-Form

Immer ein Array von `{ "value": "…", "label": "…" }` — `value` ist der gespeicherte Rohwert (muss zu bestehenden `db.json`-Werten passen), `label` der deutsche Anzeigetext.

### Dynamische Optionen: `collection` auf `select`/`multiselect`

Ein `select`- oder `multiselect`-Feld kann statt einer festen `options`-Liste ein `collection`-Property tragen (genau wie `relation`) — die Auswahlliste wird dann live aus dieser anderen Entity-Collection gespeist, statt hart codiert zu sein:

- `select` + `collection` = Einzelauswahl aus einer anderen Collection (inhaltlich identisch zu `relation`; `relation` ist die Kurzform mit klarer Intention „das ist ein Bezug auf einen anderen Datensatz").
- `multiselect` + `collection` = Mehrfachauswahl aus einer anderen Collection (z. B. „welche Events zeigen diesen Partner").
- `displayField` bestimmt, welches Feld des Zieldatensatzes als Anzeigetext dient (z. B. `"title"` bei Events, `"name"` bei Artists). Fehlt es, sinnvollen Default nehmen (z. B. `title` oder `name`, falls vorhanden).

### `relation` mit Freitext-Fallback

Manche Bezüge sollen **entweder** ein bestehender Datensatz **oder** ein freier Text sein (z. B. Lineup-Einträge: entweder ein angelegter Artist, oder ein Gast-DJ ohne Profil). Dafür trägt das `relation`-Feld zusätzlich `"allowFreeText": true`. Die UI zeigt dann eine Auswahl mit Tippfunktion; wählt niemand einen bestehenden Datensatz, wird der eingegebene Text direkt als Wert gespeichert (genau wie es die bestehenden Lineup-Daten in `db.json` heute schon tun — dort steht überall ein reiner Namens-String, egal ob der Name zu einem Artist-Profil gehört oder nicht).

### Listen (`type: "list"`)

`of` beschreibt die Felder eines Listeneintrags (gleiche Feld-Form wie oben, rekursiv). Zwei Sonderfälle:

1. **Einfache Text-Listen** (z. B. Genres, Extras, HUD-Ticker): `of` enthält genau **ein** Feld vom Typ `text` mit `"key": "value"`. Der Generator speichert/liest dann ein **flaches String-Array** (`["Techno", "Trance"]`), nicht ein Array von `{ value: "…" }`-Objekten — passend zur bestehenden `db.json`-Form.
2. **Mehrfeldige Listen** (z. B. Lineup, Sets, Kennzahlen): `of` enthält mehrere Felder → Array von Objekten, ein Objekt pro Eintrag, Keys wie in `of` definiert.

Die Reihenfolge der Einträge im Formular entspricht der Array-Reihenfolge und damit meist der Anzeige-Reihenfolge auf der öffentlichen Seite.

### Ganze Collection als flache String-Liste (Sonderfall `guest.json`)

`db.json.guests` ist selbst schon ein reines String-Array (keine Objekte). `guest.json` bildet das ab, indem es **ein einziges Feld** deklariert, dessen `key` gleich `storage.key` ist (`"name"`). Trifft das zu, behandelt der Generator jeden Listeneintrag als reinen String statt als Objekt — analog zur Text-Listen-Regel oben, nur eine Ebene höher (auf ganze Collections statt auf ein einzelnes `list`-Feld angewandt).

### Theme-Feld

`type: "theme"` ist ein zusammengesetztes Widget, kein Klartext-Objekt-Feld. Es rendert einen Preset-Wähler (`options.presets`), eine Akzentfarbe (Hex) und einen Patch-Symbol-Wähler (`options.patches`). Beim Speichern schreibt der Generator sowohl `accent` (Hex) als auch das daraus abgeleitete `accentRgb` („R G B"-Trio) in den Datensatz — `accentRgb` muss nicht separat gepflegt werden. Fehlt `preset` in den Daten, gilt laut Gateway (`TakeoffData.activeTheme()`) automatisch `"space"`.

## Auto-Registrierungs-Konvention

**Neue Entity-Contracts:** Einfach eine neue `<name>.json`-Datei in diesem Ordner ablegen und in `manifest.json` unter `entities` eintragen (Dateiname). Kein Code in `admin.html`/`admin.js` muss angefasst werden — der Formular-Generator liest `manifest.json`, lädt jeden gelisteten Contract und baut Formular + Tabelle daraus.

**Seiten-Inhalte ohne eigenen Contract:** Jede `assets/data/pages/<slug>.json` (angelegt von den Seiten-Workflows) ist automatisch generisch bearbeitbar — **ganz ohne Contract-Datei**:

- `String` → Textfeld
- `Array` → Liste (wiederholbare Einträge, analog zu `type: "list"` oben)
- `Objekt` → Gruppe (verschachteltes Unterformular)
- Optionales `"_labels": { "pfad.zum.feld": "Schöner deutscher Name" }` am Dateianfang übersteuert die (sonst technischen) Feldbeschriftungen.

Damit eine Seite in der Settings-Seite auftaucht, wird ihr Slug in `manifest.json` unter `pages` eingetragen (siehe unten) — mehr braucht es nicht.

## `manifest.json`

```jsonc
{
  "entities": ["event.json", "artist.json", "…"],  // alle Dateien in diesem Ordner, die admin.html laden soll
  "pages": ["events", "artists", "…"]                // Slugs von assets/data/pages/<slug>.json, generisch bearbeitbar
}
```

## Icon-Bezeichner

Kurze, sprechende Kleinbuchstaben-Keywords (kein Emoji, kein SVG-Pfad) — die Zuordnung zu einem tatsächlichen Icon-Glyphen passiert im Admin-CSS/JS. Aktuell verwendet: `calendar`, `headphones`, `handshake`, `users`, `megaphone`, `timeline`, `star`, `sliders`. Neue Contracts dürfen neue Bezeichner einführen; Konsistenz (ein Wort, Englisch, generisch) ist wichtiger als eine feste Liste.

## Vor der Abgabe geprüft

Jede Contract-Datei wurde nach dem Schreiben zurückgelesen und ist striktes JSON (keine Kommentare, keine trailing commas) — die `jsonc`-Blöcke oben in diesem README sind nur zur Erklärung und keine echten Dateien.
