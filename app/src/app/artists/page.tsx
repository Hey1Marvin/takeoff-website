import type { Metadata } from "next";
import { artists, event, events, guests, settings, pageContent, fmtDate } from "@/lib/data";
import type { TakeoffEvent } from "@/lib/types";
import ArtistsWaveCanvas from "@/components/pages/ArtistsWaveCanvas";
import ArtistsResidents, { type ResidentVM } from "@/components/pages/ArtistsResidents";
import ArtistsSetsSection from "@/components/pages/ArtistsSetsSection";
import ArtistsGuestLog, { type GuestVM } from "@/components/pages/ArtistsGuestLog";
import "@/styles/pages/artists.css";

export const metadata: Metadata = {
  title: "Artists & Sets · takeoff potsdam",
  description: "Residents, Gäste, Sets und der takeoff-Podcast — die Frequenzen des Kollektivs.",
};

/* Seiten-Texte kommen aus pageContent("artists") (src/data/pages/artists.json);
   dieser DEFAULT ist nur der Sicherheitsnetz-Fallback, falls die Datei mal
   fehlt oder nicht lesbar ist (gleiche Werte wie in der JSON-Datei). */
interface ArtistsPageContent {
  hero: { eyebrow: string; intro: string };
  residents: { eyebrow: string; filterAllLabel: string; filterAria: string };
  sets: { eyebrow: string; randomLabel: string; randomHint: string; randomEmpty: string; consentText: string };
  gaeste: { eyebrow: string; intro: string; appearanceLabel: string; appearanceEmpty: string };
  opendecks: { label: string; title: string; text: string; checklist: string[]; mailSubject: string; ctaLabel: string };
}

const DEFAULT_CONTENT: ArtistsPageContent = {
  hero: {
    eyebrow: "Frequenzen",
    intro: "Die Menschen hinterm Pult — Residents, Gäste und der takeoff-Podcast. Bei uns gibt's keine Headliner-Hierarchie, nur gute Musik.",
  },
  residents: { eyebrow: "Crew Select", filterAllLabel: "Alle", filterAria: "Nach Genre filtern" },
  sets: {
    eyebrow: "Aufzeichnungen",
    randomLabel: "Random Transmission",
    randomHint: "Ein Klick, ein zufälliges Set aus dem Archiv.",
    randomEmpty: "Noch keine Sets im Archiv — check bald wieder rein.",
    consentText: "Demo: Hier würde jetzt der Player laden (Zwei-Klick, DSGVO-freundlich). Kein Klick = kein Tracking.",
  },
  gaeste: {
    eyebrow: "Gäste-Log",
    intro: "Danke an alle, die unsere Nächte mitgeprägt haben — ein Klick zeigt, wann wir zusammen gefunkt haben.",
    appearanceLabel: "Aufgetreten bei",
    appearanceEmpty: "Termin wird noch zugeordnet.",
  },
  opendecks: {
    label: "Open Decks",
    title: "Du willst bei uns auflegen?",
    text: "Schick uns dein Demo — wir hören uns alles an.",
    checklist: [
      "Set-Link (SoundCloud/Mixcloud, 20–30 Min)",
      "2–3 Termine, an denen du Zeit hättest",
      "Ein, zwei Sätze zu dir & deinem Sound",
    ],
    mailSubject: "Open Decks Bewerbung",
    ctaLabel: "Demo schicken",
  },
};

const isPastEvent = (e: TakeoffEvent, todayStr: string) => e.state === "past" || e.date < todayStr;

/* Artists & Sets — komplett aus dem Gateway gerendert: neue Artists (auch
   ohne eigene Sets/Auftritte, z. B. Blaulicht) erscheinen automatisch bei
   den Residents; das Gäste-Log matcht guests() live gegen die Lineups
   aller sichtbaren Events. */
export default async function ArtistsPage() {
  const [artistList, guestNames, visibleEvents, s, contentRaw] = await Promise.all([
    artists(),
    guests(),
    events(),
    settings(),
    pageContent<ArtistsPageContent>("artists"),
  ]);
  const content = contentRaw ?? DEFAULT_CONTENT;
  const todayStr = new Date().toISOString().slice(0, 10);

  /* Residents: Auftritte (appearances -> event()) aufloesen fuer die
     "Zuletzt"/"Nächster Start"-Zeile. Nur sichtbare Events zaehlen. */
  const residentsVM: ResidentVM[] = await Promise.all(
    artistList.map(async a => {
      const apps = (await Promise.all(a.appearances.map(slug => event(slug))))
        .filter((e): e is TakeoffEvent => !!e && e.visible !== false)
        .sort((x, y) => y.date.localeCompare(x.date));
      const lastPast = apps.find(e => isPastEvent(e, todayStr));
      const nextUpcoming = [...apps]
        .filter(e => !isPastEvent(e, todayStr))
        .sort((x, y) => x.date.localeCompare(y.date))[0];
      const historyRow = lastPast
        ? { label: "Zuletzt", title: lastPast.title, dateLabel: fmtDate(lastPast.date) }
        : nextUpcoming
        ? { label: "Nächster Start", title: nextUpcoming.title, dateLabel: fmtDate(nextUpcoming.date) }
        : undefined;
      return {
        slug: a.slug,
        initials: a.initials,
        name: a.name,
        role: a.role,
        genres: a.genres,
        since: a.since,
        bio: a.bio,
        listenTitle: a.sets[0]?.title,
        historyRow,
      };
    })
  );

  /* Sets & Podcast: alle Sets aller sichtbaren Artists geflacht — Grundlage
     fuer Grid + "Random Transmission". */
  const flatSets = artistList.flatMap(a =>
    a.sets.map((set, i) => ({ id: `${a.slug}-${i}`, title: set.title, meta: set.meta }))
  );

  /* Gäste-Log: Auftritts-Zuordnung aus den Lineups aller sichtbaren Events —
     keine eigene Pflege am Gast noetig, ein Name im Lineup genuegt. */
  const findAppearances = (guestName: string) => {
    const norm = (v: string) => v.trim().toLowerCase();
    return visibleEvents
      .filter(e => e.lineup.some(slot => norm(slot.name) === norm(guestName)))
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(e => ({ slug: e.slug, title: e.title, dateLabel: fmtDate(e.date) }));
  };
  const guestsVM: GuestVM[] = guestNames.map(name => ({ name, appearances: findAppearances(name) }));

  const mailtoHref = `mailto:${s.email}?subject=${encodeURIComponent(content.opendecks.mailSubject)}`;

  return (
    <>
      <ArtistsWaveCanvas />

      <section className="phero">
        <div className="wrap">
          <p className="eyebrow">{content.hero.eyebrow}</p>
          <h1>Artists &amp; <span className="glow">Sets</span></h1>
          <p className="section-intro">{content.hero.intro}</p>
        </div>
      </section>

      <section className="section" id="residents" style={{ paddingTop: "clamp(30px, 5vh, 50px)" }}>
        <div className="wrap">
          <header className="section-head reveal">
            <p className="eyebrow">{content.residents.eyebrow}</p>
            <h2 className="h2">Residents</h2>
          </header>
          <ArtistsResidents
            artists={residentsVM}
            soundcloud={s.soundcloud}
            allLabel={content.residents.filterAllLabel}
            filterAria={content.residents.filterAria}
          />
        </div>
      </section>

      <section className="section" id="sets" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <header className="section-head reveal">
            <p className="eyebrow">{content.sets.eyebrow}</p>
            <h2 className="h2">Sets &amp; <span className="glow">Podcast</span></h2>
          </header>
          <ArtistsSetsSection
            sets={flatSets}
            randomLabel={content.sets.randomLabel}
            randomHint={content.sets.randomHint}
            randomEmpty={content.sets.randomEmpty}
            consentText={content.sets.consentText}
          />
        </div>
      </section>

      <section className="section" id="gaeste" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <header className="section-head reveal">
            <p className="eyebrow">{content.gaeste.eyebrow}</p>
            <h2 className="h2">Schon bei uns <span className="glow">gefunkt</span></h2>
            <p className="section-intro">{content.gaeste.intro}</p>
          </header>
          <ArtistsGuestLog
            guests={guestsVM}
            appearanceLabel={content.gaeste.appearanceLabel}
            appearanceEmpty={content.gaeste.appearanceEmpty}
          />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="transmission">
            <span className="tx-label">{content.opendecks.label}</span>
            <h3 className="odl-title">{content.opendecks.title}</h3>
            <p>{content.opendecks.text}</p>
            <ul className="odl-checklist">
              {content.opendecks.checklist.map(item => <li key={item}>{item}</li>)}
            </ul>
            <div className="cta-row" style={{ justifyContent: "center", marginTop: 20 }}>
              <a className="btn btn-primary" href={mailtoHref}>{content.opendecks.ctaLabel}</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
