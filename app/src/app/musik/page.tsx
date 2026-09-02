import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { artists, upcoming, settings, pageContent } from "@/lib/data";
import { artistHref, eventHref, pageHref } from "@/lib/site";
import type { Artist, TakeoffEvent } from "@/lib/types";
import MusikTaktgeber, {
  type MusikGenreVM,
  type MusikGuestsCopy,
  type MusikScaleCopy,
  type MusikTapCopy,
  type MusikWayfindCopy,
  type MusikWayfindLink,
} from "@/components/pages/MusikTaktgeber";
import MusikSetCard from "@/components/pages/MusikSetCard";
import MusikShareButton from "@/components/pages/MusikShareButton";
import "@/styles/pages/musik.css";

export const metadata: Metadata = {
  title: "Unser Sound · takeoff potsdam",
  description: "Trance, Hard Trance, Bounce — was das ist und wie es klingt.",
};

/* Spiegelt src/data/pages/musik.json. Quelle der Wahrheit für die Feldnamen
   ist die tatsächlich eingecheckte JSON, wie von AGENTS.md vorgegeben —
   ALLE deutschen Fliess- und Überschriftentexte dieser Seite stehen dort,
   im JSX steht keiner mehr. */
interface MusikPageContent {
  hero: { eyebrow: string; titleHtml: string; intro: string };
  scale: MusikScaleCopy;
  genres: { id: string; label: string; shortLabel: string; bpm: number | null; text: string }[];
  wayfind: MusikWayfindCopy;
  guests: MusikGuestsCopy;
  tapTempo: MusikTapCopy;
  listen: { eyebrow: string; titleHtml: string; intro: string; consentNote: string; emptyText: string; teaser: string };
  nightGuide: { eyebrow: string; titleHtml: string; phases: { time: string; label: string; genreIds: string[]; text: string }[] };
  glossary: { eyebrow: string; titleHtml: string; terms: { term: string; def: string }[] };
  trackId: { eyebrow: string; title: string; text: string; buttonLabel: string; mailSubject: string; mailBody: string };
  faq: { eyebrow: string; titleHtml: string; items: { q: string; a: string }[] };
  share: { label: string; text: string; copiedToast: string };
  transmission: { label: string; text: string };
}

/* Fallback, falls src/data/pages/musik.json einmal fehlt/kaputt ist
   (adapter.loadPage() faengt das ab und liefert dann null) — identischer
   Inhalt wie die JSON-Datei, gleiches Muster wie DEFAULT_CONTENT in
   artists/page.tsx. */
const DEFAULT_CONTENT: MusikPageContent = {
  hero: {
    eyebrow: "Frequenzkunde",
    titleHtml: 'Was läuft hier <span class="glow">eigentlich</span>?',
    intro: "Nie von Hard Bounce gehört? Macht nichts — dafür gibt's diese Seite. Drei Minuten Lesezeit, dann weißt du, was dich auf dem Floor erwartet.",
  },
  scale: {
    min: 60,
    max: 180,
    label: "Taktskala",
    caption: "So nah liegen unsere Kern-Tempi beieinander — und so deutlich hört man den Unterschied trotzdem.",
    coreLabel: "Kern-Tempi",
    youLabel: "Du",
  },
  genres: [
    { id: "trance", label: "Trance", shortLabel: "Trance", bpm: 138, text: "Hypnotische Melodien, lange Spannungsbögen, Gänsehaut-Momente. ~{bpm} BPM · das Herz von takeoff." },
    { id: "hard-trance", label: "Hard Trance", shortLabel: "Hard Trance", bpm: 145, text: "Trance mit Schub: härtere Kicks, treibender, euphorischer. ~{bpm} BPM." },
    { id: "bounce", label: "Bounce / Hard Bounce", shortLabel: "Bounce", bpm: 150, text: "Federnde Offbeat-Bässe, gute Laune mit Wumms. ~{bpm} BPM." },
    { id: "techno", label: "Techno", shortLabel: "Techno", bpm: null, text: "Der gerade, dunkle Puls — bei uns als Gastgeschenk befreundeter Kollektive." },
    { id: "psytrance", label: "Psytrance", shortLabel: "Psytrance", bpm: null, text: "Wenn's spät wird und die Muster tanzen. Gelegentlich, mit Liebe." },
  ],
  wayfind: { artistsLabel: "Live gespielt von", eventsLabel: "Nächste Termine" },
  guests: {
    label: "Gelegentlich zu Gast",
    note: "Kein fester Takt, kein fester Platz im Abend — deshalb stehen sie hier unten und nicht auf der Skala.",
  },
  tapTempo: {
    label: "Tipp mit",
    instruction: "Tippe im eigenen Takt — mindestens 4×, dann rechnen wir. Klick, Tap oder Leertaste.",
    button: "Tipp mit!",
    reset: "Zurücksetzen",
    againText: "Nochmal — beim zweiten Tipp erkennen wir den Takt.",
    resultTemplate: "Du tippst ~{bpm} BPM — das ist fast {genre}.",
    nearTemplate: "Nah an {genre} ({bpm} BPM) — eine Idee {richtung}.",
    fasterWord: "schneller",
    slowerWord: "langsamer",
    tooFastText: "Ordentlich Tempo drauf — schneller als alles, was bei uns läuft.",
    tooSlowText: "Eher gemütlich — bei uns geht's meist flotter zur Sache.",
    flavor: { trance: "genau unser Herzschlag.", "hard-trance": "mit ordentlich Schub.", bounce: "mit Wumms und Feder." },
  },
  listen: {
    eyebrow: "Reinhören",
    titleHtml: 'Sound of <span class="glow">takeoff</span>',
    intro: "Alle Sets & Podcast-Folgen an einem Ort — aus echten takeoff-Nächten.",
    consentNote: "Demo: Hier würde jetzt der SoundCloud-/YouTube-Player laden (Zwei-Klick, DSGVO-freundlich).",
    emptyText: "Noch keine Sets hinterlegt — die aktuelle Liste steht auf der Artists-Seite.",
    teaser: "Reinhören? Auf der Artists-Seite liegen Sets aus echten takeoff-Nächten — und der „| takeoff\"-Podcast liefert Nachschub.",
  },
  nightGuide: {
    eyebrow: "Für Neulinge",
    titleHtml: 'Der Ablauf <span class="glow">einer Nacht</span>',
    phases: [
      { time: "Einlass – Mitternacht", label: "Warm-up", genreIds: ["trance"], text: "Ruhiger Einstieg, Zeit anzukommen." },
      { time: "Mitternacht – 3 Uhr", label: "Peak-Time", genreIds: ["hard-trance", "bounce"], text: "Der Floor ist voll, das Tempo zieht an." },
      { time: "ab 3 Uhr", label: "Afterhour", genreIds: ["psytrance", "techno"], text: "Für alle, die bleiben — gelegentlich, mit Liebe." },
    ],
  },
  glossary: {
    eyebrow: "Vokabular",
    titleHtml: 'Szene-<span class="glow">Jargon</span>',
    terms: [
      { term: "B2B", def: "„Back to Back“ — zwei DJs legen abwechselnd im selben Set auf." },
      { term: "Warm-up", def: "Der ruhigere musikalische Einstieg zu Beginn des Abends." },
      { term: "Peak-Time", def: "Der Höhepunkt der Nacht, wenn der Floor am vollsten ist." },
      { term: "Liveset", def: "Mitschnitt eines echten Auftritts, nicht extra fürs Studio produziert." },
    ],
  },
  trackId: {
    eyebrow: "Ohrwurm ohne Namen?",
    title: "Track-ID gesucht",
    text: "Song gehört, Namen vergessen? Schreib uns Event, ungefähre Uhrzeit und was du noch weißt.",
    buttonLabel: "Track-ID anfragen",
    mailSubject: "Track-ID gesucht",
    mailBody: "Event:\nUngefähre Uhrzeit:\nWas ich noch weiß (Text, Melodie, Drop):",
  },
  faq: {
    eyebrow: "Bevor es losgeht",
    titleHtml: 'Kurz <span class="glow">gefragt</span>',
    items: [
      { q: "Muss ich tanzen können?", a: "Nein. Bei uns tanzt jede*r so, wie es sich gut anfühlt." },
      { q: "Ist das laut?", a: "Ja, wie auf jedem Rave — Ohrstöpsel gibt's am Awareness-Point." },
      { q: "Gibt's auch Techno?", a: "Gelegentlich, meist als Gastgeschenk befreundeter Kollektive — der Kern bleibt Trance." },
    ],
  },
  share: { label: "Genre-Guide teilen", text: "Was bei takeoff läuft: Trance, Hard Trance, Bounce erklärt.", copiedToast: "Link kopiert ✓" },
  transmission: { label: "Transmission incoming", text: "Echte 30-Sekunden-Hörproben pro Genre — sobald die Rechte mit den DJs geklärt sind." },
};

/* Kanonische Genre-IDs — Reihenfolge bestimmt die Sortierung der "Sound
   of takeoff"-Karten (primaryGenreRank). Portierung von GENRE_ORDER +
   normalizeGenre() aus assets/js/pages/musik.js. */
const GENRE_ORDER = ["trance", "hard-trance", "bounce", "techno", "psytrance"];

function normalizeGenre(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === "bounce" || /^hard[\s-]?bounce$/.test(t)) return "bounce";
  if (t === "trance") return "trance";
  if (/^hard[\s-]?trance$/.test(t)) return "hard-trance";
  if (t === "techno" || /^hard[\s-]?techno$/.test(t)) return "techno";
  if (t === "psytrance") return "psytrance";
  return t;
}

const splitGenres = (raw: string): string[] => raw.split(/\s*·\s*/).map(s => s.trim()).filter(Boolean);

function primaryGenreRank(genresStr: string): number {
  const first = splitGenres(genresStr)[0] ?? "";
  const idx = GENRE_ORDER.indexOf(normalizeGenre(first));
  return idx === -1 ? GENRE_ORDER.length : idx;
}

/* Wegweiser-Chips je Genre-Spalte: welche Artists spielen das (irgendein
   Genre-Token passt), welche kommenden Events führen es im Line-up. Nur
   upcoming() — vergangene Events sind für "wohin als Nächstes" irrelevant
   (Portierung von renderWayfind() aus musik.js). */
function wayfindFor(
  genreId: string,
  artistList: Artist[],
  eventList: TakeoffEvent[]
): { wayfindArtists: MusikWayfindLink[]; wayfindEvents: MusikWayfindLink[] } {
  const wayfindArtists = artistList
    .filter(a => splitGenres(a.genres).some(g => normalizeGenre(g) === genreId))
    .map(a => ({ slug: a.slug, label: a.name, href: artistHref(a.slug) }));
  const wayfindEvents = eventList
    .filter(e => e.genres.some(g => normalizeGenre(g) === genreId))
    .map(e => ({ slug: e.slug, label: e.title, href: eventHref(e.slug) }));
  return { wayfindArtists, wayfindEvents };
}

/* "Artists-Seite" steht im JSON-Text wörtlich drin (gleiches Vorgehen wie
   die FAQ-Antwort auf events/page.tsx) — hier wird daraus ein echter Link. */
function renderTeaser(text: string): ReactNode {
  const marker = "Artists-Seite";
  const idx = text.indexOf(marker);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <Link className="tg-inline-link" href={pageHref("artists")}>{marker}</Link>
      {text.slice(idx + marker.length)}
    </>
  );
}

const NO_TRANSLATE_TERMS = new Set(["B2B", "Liveset"]);

/* Beweis-Portierung: Wegweiser-Chips und die "Sound of takeoff"-Karten
   kommen komplett aus dem Gateway — ein neuer Artist mit passendem Genre
   oder ein neues Event taucht hier automatisch auf, ohne dass musik.json
   angefasst werden muss. */
export default async function MusikPage() {
  const [artistList, upcomingEvents, s, contentRaw] = await Promise.all([
    artists(),
    upcoming(),
    settings(),
    pageContent<MusikPageContent>("musik"),
  ]);
  const content = contentRaw ?? DEFAULT_CONTENT;

  const genreVMs: MusikGenreVM[] = content.genres.map(g => {
    const { wayfindArtists, wayfindEvents } = wayfindFor(g.id, artistList, upcomingEvents);
    return {
      id: g.id,
      label: g.label,
      shortLabel: g.shortLabel,
      bpm: g.bpm,
      beatMs: g.bpm != null ? Math.round(60000 / g.bpm) : null,
      text: g.text,
      wayfindArtists,
      wayfindEvents,
    };
  });

  const setItems = artistList
    .flatMap(a => a.sets.map((set, i) => ({ artist: a, set, key: `${a.slug}-${i}` })))
    .sort((x, y) => primaryGenreRank(x.artist.genres) - primaryGenreRank(y.artist.genres));

  const trackIdHref = `mailto:${s.email}?subject=${encodeURIComponent(content.trackId.mailSubject)}&body=${encodeURIComponent(content.trackId.mailBody)}`;

  return (
    <>
      <section className="phero">
        <div className="wrap">
          <p className="eyebrow">{content.hero.eyebrow}</p>
          <h1 dangerouslySetInnerHTML={{ __html: content.hero.titleHtml }} />
          <p className="section-intro">{content.hero.intro}</p>
        </div>
      </section>

      {/* Das Instrument. Volle Spaltenbreite, weil es die Aussage der Seite
          TRÄGT — nicht illustriert. */}
      <section className="section tg-sec tg-sec--console">
        <div className="wrap">
          <MusikTaktgeber
            scale={content.scale}
            genres={genreVMs}
            tap={content.tapTempo}
            wayfind={content.wayfind}
            guests={content.guests}
          />
          <p className="section-intro tg-teaser">{renderTeaser(content.listen.teaser)}</p>
        </div>
      </section>

      <section className="section tg-sec tg-sec--flow" id="hoerprobe">
        <div className="wrap">
          <header className="section-head">
            <p className="eyebrow">{content.listen.eyebrow}</p>
            <h2 className="h2" dangerouslySetInnerHTML={{ __html: content.listen.titleHtml }} />
            <p className="section-intro">{content.listen.intro}</p>
          </header>
          {setItems.length > 0 ? (
            <div className="setgrid">
              {setItems.map(({ artist, set, key }) => {
                const isPodcast = /podcast/i.test(`${set.title} ${set.meta}`);
                const metaBits = [set.meta, artist.genres].filter(Boolean).join(" · ");
                return (
                  <div className="tg-setitem" key={key}>
                    <MusikSetCard
                      title={set.title}
                      meta={metaBits}
                      consentText={content.listen.consentNote}
                      ariaLabel={`${isPodcast ? "Podcast" : "Set"} abspielen: ${set.title}`}
                    />
                    <Link className="tg-setlink" href={artistHref(artist.slug)}>{artist.name}</Link>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="lu-note">{content.listen.emptyText}</p>
          )}
          <div className="transmission tg-transmission">
            <span className="tx-label">{content.transmission.label}</span>
            <p>{content.transmission.text}</p>
          </div>
        </div>
      </section>

      <section className="section tg-sec tg-sec--flow" id="ablauf">
        <div className="wrap">
          <header className="section-head">
            <p className="eyebrow">{content.nightGuide.eyebrow}</p>
            <h2 className="h2" dangerouslySetInnerHTML={{ __html: content.nightGuide.titleHtml }} />
          </header>
          <ol className="tg-night">
            {content.nightGuide.phases.map(p => (
              <li className="tg-phase" key={p.time}>
                <span className="tg-phase-time">{p.time}</span>
                <span className="tg-phase-label">{p.label}</span>
                <span className="tg-phase-genres">
                  {p.genreIds.map(gid => {
                    const g = content.genres.find(x => x.id === gid);
                    return (
                      <Link key={gid} className="chip" href={`#g-${gid}`} translate="no">
                        {g?.shortLabel ?? gid}
                      </Link>
                    );
                  })}
                </span>
                <p className="tg-phase-text">{p.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Nachschlagteil: Jargon und FAQ stehen nebeneinander statt
          untereinander — beides ist Referenz, beides kurz, und zwei halbe
          Spalten füllen die Breite, die vorher rechts leer stand. */}
      <section className="section tg-sec tg-sec--flow">
        <div className="wrap">
          <div className="tg-ref">
            <div className="tg-ref-col" id="glossar">
              <header className="section-head tg-ref-head">
                <p className="eyebrow">{content.glossary.eyebrow}</p>
                <h2 className="tg-ref-title" dangerouslySetInnerHTML={{ __html: content.glossary.titleHtml }} />
              </header>
              <dl className="m-rows tg-glossary">
                {content.glossary.terms.map(item => (
                  <div className="m-row" key={item.term}>
                    <dt translate={NO_TRANSLATE_TERMS.has(item.term) ? "no" : undefined}>{item.term}</dt>
                    <dd>{item.def}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="tg-ref-col" id="faq">
              <header className="section-head tg-ref-head">
                <p className="eyebrow">{content.faq.eyebrow}</p>
                <h2 className="tg-ref-title" dangerouslySetInnerHTML={{ __html: content.faq.titleHtml }} />
              </header>
              <div className="tg-faqlist">
                {content.faq.items.map(item => (
                  <details className="faq" key={item.q}>
                    <summary>{item.q}</summary>
                    <div className="faq-body">{item.a}</div>
                  </details>
                ))}
              </div>
            </div>
          </div>

          <div className="tg-trackid">
            <div className="tg-trackid-text">
              <p className="tg-trackid-eyebrow">{content.trackId.eyebrow}</p>
              <h2 className="tg-trackid-title">{content.trackId.title}</h2>
              <p className="tg-trackid-body">{content.trackId.text}</p>
            </div>
            <a className="btn btn-primary tg-trackid-btn" href={trackIdHref}>{content.trackId.buttonLabel}</a>
          </div>

          <div className="tg-share-row">
            <MusikShareButton text={content.share.text} url="/musik" label={content.share.label} copiedToast={content.share.copiedToast} />
          </div>
        </div>
      </section>
    </>
  );
}
