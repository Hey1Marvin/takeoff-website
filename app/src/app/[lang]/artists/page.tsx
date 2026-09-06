import type { Metadata } from "next";
import { artists, event, events, guests, settings, pageContent, fmtDate } from "@/lib/data";
import type { TakeoffEvent } from "@/lib/types";
import ArtistsFreqBand from "@/components/pages/ArtistsFreqBand";
import ArtistsSectionHead from "@/components/pages/ArtistsSectionHead";
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
   fehlt oder nicht lesbar ist (gleiche Werte wie in der JSON-Datei).
   Seit It. 14 stehen dort AUCH die Ueberschriften — vorher standen vier
   davon als deutscher Text direkt im JSX. */
export interface ArtistsPageContent {
  hero: {
    eyebrow: string; title: string; titleGlow: string; intro: string;
    registerLabel: string; countArtists: string; countSets: string; countGuests: string;
    bandCaption: string;
  };
  residents: {
    eyebrow: string; title: string; filterAllLabel: string; filterAria: string;
    toggleLabel: string; roleLabel: string; sinceLabel: string;
    lastLabel: string; nextLabel: string; listenLabel: string;
    profileLabel: string; soundcloudLabel: string;
  };
  sets: {
    eyebrow: string; title: string; titleGlow: string; countLabel: string;
    randomLabel: string; randomHint: string; randomEmpty: string; consentText: string;
  };
  gaeste: {
    eyebrow: string; title: string; titleGlow: string; intro: string;
    appearanceLabel: string; appearanceEmpty: string;
  };
  opendecks: {
    label: string; title: string; text: string; checklistLabel: string;
    checklist: string[]; mailSubject: string; ctaLabel: string;
  };
}

const DEFAULT_CONTENT: ArtistsPageContent = {
  hero: {
    eyebrow: "Frequenzen",
    title: "Artists &",
    titleGlow: "Sets",
    intro: "Die Menschen hinterm Pult — Residents, Gäste und der takeoff-Podcast. Bei uns gibt's keine Headliner-Hierarchie, nur gute Musik.",
    registerLabel: "Archiv",
    countArtists: "Kanäle",
    countSets: "Aufzeichnungen",
    countGuests: "Gäste",
    bandCaption: "Eine Zacke je Aufzeichnung — das ist das Archiv, von der ersten Nacht bis heute.",
  },
  residents: {
    eyebrow: "Crew Select", title: "Residents",
    filterAllLabel: "Alle", filterAria: "Nach Genre filtern",
    toggleLabel: "Profil", roleLabel: "Rolle", sinceLabel: "seit",
    lastLabel: "Zuletzt", nextLabel: "Nächster Start", listenLabel: "Hören",
    profileLabel: "Zum Profil", soundcloudLabel: "SoundCloud ↗",
  },
  sets: {
    eyebrow: "Aufzeichnungen",
    title: "Sets &",
    titleGlow: "Podcast",
    countLabel: "Sets",
    randomLabel: "Random Transmission",
    randomHint: "Ein Klick, ein zufälliges Set aus dem Archiv.",
    randomEmpty: "Noch keine Sets im Archiv — check bald wieder rein.",
    consentText: "Demo: Hier würde jetzt der Player laden (Zwei-Klick, DSGVO-freundlich). Kein Klick = kein Tracking.",
  },
  gaeste: {
    eyebrow: "Gäste-Log",
    title: "Schon bei uns",
    titleGlow: "gefunkt",
    intro: "Danke an alle, die unsere Nächte mitgeprägt haben — ein Klick zeigt, wann wir zusammen gefunkt haben.",
    appearanceLabel: "Aufgetreten bei",
    appearanceEmpty: "Termin wird noch zugeordnet.",
  },
  opendecks: {
    label: "Open Decks",
    title: "Du willst bei uns auflegen?",
    text: "Schick uns dein Demo — wir hören uns alles an.",
    checklistLabel: "Was wir brauchen",
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

/* Zweistellig, wie auf einem Instrumentenbrett: "04 Kanäle", nicht "4". */
const readout = (n: number, label: string) => `${String(n).padStart(2, "0")} ${label}`;

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
        ? { label: content.residents.lastLabel, title: lastPast.title, dateLabel: fmtDate(lastPast.date) }
        : nextUpcoming
        ? { label: content.residents.nextLabel, title: nextUpcoming.title, dateLabel: fmtDate(nextUpcoming.date) }
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
     fuer Grid, "Random Transmission" UND die Form des Archivbands (eine
     Keule je Aufzeichnung). */
  const flatSets = artistList.flatMap(a =>
    a.sets.map((set, i) => ({
      id: `${a.slug}-${i}`, title: set.title, meta: set.meta,
      quelle: { platform: set.platform, id: set.id, url: set.url },
    }))
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
      {/* Kopf: links der Text, rechts das Register (wie gross ist das Archiv?),
          darunter ueber die volle Satzbreite das Archivband. Vorher war der
          Kopf eine 520px-Spalte mit 900px Schwarz daneben. */}
      <section className="phero ar-sec">
        <div className="wrap ar-hero">
          <div className="ar-hero-text">
            <p className="eyebrow">{content.hero.eyebrow}</p>
            <h1 className="txplate">
              {content.hero.title} <span className="glow">{content.hero.titleGlow}</span>
            </h1>
            <div className="ar-lead"><p className="txplate">{content.hero.intro}</p></div>
          </div>

          <aside className="ar-register" aria-label={content.hero.registerLabel}>
            <p className="ar-kicker txfit">{content.hero.registerLabel}</p>
            <dl className="m-rows">
              <div className="m-row">
                <dt>{content.hero.countArtists}</dt>
                <dd><b>{String(artistList.length).padStart(2, "0")}</b></dd>
              </div>
              <div className="m-row">
                <dt>{content.hero.countSets}</dt>
                <dd><b>{String(flatSets.length).padStart(2, "0")}</b></dd>
              </div>
              <div className="m-row">
                <dt>{content.hero.countGuests}</dt>
                <dd><b>{String(guestsVM.length).padStart(2, "0")}</b></dd>
              </div>
            </dl>
          </aside>
        </div>

        <div className="wrap">
          <ArtistsFreqBand segments={flatSets.length} caption={content.hero.bandCaption} />
        </div>
      </section>

      <section className="section ar-sec" id="residents">
        <div className="wrap">
          <ArtistsSectionHead
            eyebrow={content.residents.eyebrow}
            title={content.residents.title}
            note={readout(artistList.length, content.hero.countArtists)}
          />
          <ArtistsResidents
            artists={residentsVM}
            soundcloud={s.soundcloud}
            allLabel={content.residents.filterAllLabel}
            filterAria={content.residents.filterAria}
            labels={content.residents}
          />
        </div>
      </section>

      <section className="section ar-sec" id="sets">
        <div className="wrap">
          <ArtistsSetsSection
            sets={flatSets}
            eyebrow={content.sets.eyebrow}
            title={content.sets.title}
            titleGlow={content.sets.titleGlow}
            note={readout(flatSets.length, content.sets.countLabel)}
            randomLabel={content.sets.randomLabel}
            randomHint={content.sets.randomHint}
            randomEmpty={content.sets.randomEmpty}
            consentText={content.sets.consentText}
          />
        </div>
      </section>

      <section className="section ar-sec" id="gaeste">
        <div className="wrap">
          <ArtistsSectionHead
            eyebrow={content.gaeste.eyebrow}
            title={content.gaeste.title}
            glow={content.gaeste.titleGlow}
            note={readout(guestsVM.length, content.hero.countGuests)}
          >
            <div className="ar-lead ar-lead--aside"><p className="txplate">{content.gaeste.intro}</p></div>
          </ArtistsSectionHead>
          <ArtistsGuestLog
            guests={guestsVM}
            appearanceLabel={content.gaeste.appearanceLabel}
            appearanceEmpty={content.gaeste.appearanceEmpty}
          />
        </div>
      </section>

      <section className="section ar-sec">
        <div className="wrap">
          <div className="transmission ar-odl">
            <div className="ar-odl-main">
              <span className="tx-label">{content.opendecks.label}</span>
              <h3 className="ar-odl-title">{content.opendecks.title}</h3>
              <p>{content.opendecks.text}</p>
              <div className="cta-row">
                <a className="btn btn-primary" href={mailtoHref}>{content.opendecks.ctaLabel}</a>
              </div>
            </div>
            <div className="ar-odl-aside">
              <p className="ar-kicker">{content.opendecks.checklistLabel}</p>
              <ul className="ar-odl-list">
                {content.opendecks.checklist.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
