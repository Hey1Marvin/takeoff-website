import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageContent, team, history, past, settings, partners, pageMedia } from "@/lib/data";
import KollektivBlueprint from "@/components/pages/KollektivBlueprint";
import KollektivSheet, { type SheetMeta } from "@/components/pages/KollektivSheet";
import KollektivRig from "@/components/pages/KollektivRig";
import KollektivHistory from "@/components/pages/KollektivHistory";
import KollektivOrbit from "@/components/pages/KollektivOrbit";
import KollektivStats, { type StatCell } from "@/components/pages/KollektivStats";
import KollektivSpend from "@/components/pages/KollektivSpend";
import "@/styles/pages/kollektiv.css";
import { pageHref } from "@/lib/site";
import MediaGallery from "@/components/pages/MediaGallery";

export const metadata: Metadata = {
  title: "Kollektiv · takeoff potsdam",
  description: "Wer takeoff ist: ehrenamtliches Rave-Kollektiv aus Potsdam. Selbstgebaute Anlage, Themen-Deko, Awareness als Haltung.",
};

/* Spiegelt src/data/pages/kollektiv.json. Seit It. 14 liegen ALLE deutschen
   Redaktionstexte dieser Seite dort — vorher standen sieben Ueberschriften,
   beide Funkspruch-Bloecke und die Fotowand-Texte als Literal im JSX.
   ethos.image/imageAlt sind im Contract vorgesehen, werden auf der Seite
   aber nicht gerendert (die rechte Spalte des Deckblatts zeigt das
   Anlagen-Diagramm) — deshalb hier bewusst nicht Teil des Typs.

   ACHTUNG Contract: `sheet`, `sections`, `fotowand`, `mitmachen`, `booking`
   und `spendChart.sumLabel` sind neu und stehen NOCH NICHT in
   src/data/contracts/page-kollektiv.json (nicht mein Namensraum, siehe
   Abschlussbericht). Bis das nachgezogen ist, kann ein Speichern aus dem
   Admin diese Felder verlieren. */
interface SectionCopy extends SheetMeta {
  eyebrow?: string;
  title?: string;
  intro?: string;
  /* nur Logbuch: Schlusssatz der letzten Zeile, mit {link}-Platzhalter */
  tail?: string;
  tailLink?: string;
}

interface KollektivPageContent {
  hero: { eyebrow: string; h1: string; intro: string };
  foundedDate: string;
  ethos: { text1: string; text2: string };
  sheet: { rows: { label: string; value: string }[] };
  sections: Record<
    "cover" | "werte" | "finanzen" | "history" | "fotowand" | "crew" | "familie" | "faq" | "funkspruch",
    SectionCopy
  >;
  values: { icon: string; title: string; text: string }[];
  spendChart: { note: string; sumLabel: string; items: { label: string; percent: number }[] };
  stats: {
    founded: { label: string };
    missions: { label: string };
    systemsBuilt: { value: string; label: string };
    volunteerPercent: { value: string; label: string };
  };
  fotowand: {
    mediaIntro: string;
    mediaLabel: string;
    placeholderLabel: string;
    placeholders: { fig: string; text: string }[];
    note: string;
    noteLink: string;
  };
  joinRoles: { label: string; mailSubject?: string }[];
  mitmachen: {
    label: string; text: string; rolesLabel: string;
    direct: string; telegramLabel: string; mailLabel: string;
  };
  booking: { label: string; text: string; presskit: string };
  bookingFacts: { label: string; value: string }[];
  faq: { q: string; a: string }[];
}

/* Das letzte Wort einer Ueberschrift leuchtet — dieselbe Regel, die der
   Contract fuer hero.h1 bereits beschreibt, gilt jetzt auch fuer die
   Blatt-Ueberschriften. Satzzeichen am Ende bleiben ausserhalb des Spans.

   EINWORT-TITEL leuchten NICHT: "Momente" waere sonst komplett magenta,
   und eine ganz leuchtende Zeile ist kein Akzent mehr, sondern nur eine
   andere Farbe. Ein Akzent braucht etwas, wogegen er steht. */
function glowify(text: string): ReactNode {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return text;
  const last = words.pop()!;
  const trailMatch = last.match(/([.!?…,;:]+)$/);
  const trail = trailMatch ? trailMatch[1] : "";
  const word = trail ? last.slice(0, -trail.length) : last;
  return (
    <>
      {words.join(" ") + " "}
      <span className="glow">{word}</span>
      {trail}
    </>
  );
}

/* Hebt eine „…"-Phrase hervor. Kein /s-Flag (dotAll) — Build-Target ist
   ES2017; [\s\S] deckt Zeilenumbrueche ohnehin ab. */
function emphasize(text: string): ReactNode {
  const m = text.match(/^([\s\S]*?)(„[^“]*“)([\s\S]*)$/);
  if (!m) return text;
  return (
    <>
      {m[1]}
      <em className="bp-em">{m[2]}</em>
      {m[3]}
    </>
  );
}

/* Redaktionstext mit Platzhaltern: "… Das ganze Team: {link}" wird zu
   Text + React-Knoten + Text. Gleiche {token}-Konvention wie in
   src/lib/i18n/de.ts, damit ein spaeterer Umzug in die i18n-Schicht kein
   neues Format braucht. Unbekannte Tokens bleiben als Text stehen — das
   ist beim Redigieren die ehrlichere Rueckmeldung als ein leerer String. */
function tpl(text: string, slots: Record<string, ReactNode>): ReactNode {
  return text.split(/(\{[a-zA-Z]+\})/).map((part, i) => {
    const key = part.startsWith("{") && part.endsWith("}") ? part.slice(1, -1) : null;
    if (key && key in slots) return <span key={i}>{slots[key]}</span>;
    return <span key={i}>{part}</span>;
  });
}

function initialsFrom(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "??";
}

/* Blatt-Kopf: Kicker, Ueberschrift, Einleitung. Immer dieselbe Reihenfolge,
   immer dieselben Abstaende (--sp-head-body ueber .section-head). */
function SheetHead({ copy }: { copy: SectionCopy }) {
  return (
    <header className="section-head">
      {copy.eyebrow && <p className="eyebrow">{copy.eyebrow}</p>}
      {copy.title && <h2 className="h2">{glowify(copy.title)}</h2>}
      {copy.intro && <p className="section-intro">{copy.intro}</p>}
    </header>
  );
}

/* Icon-Sets (handgezeichnet, kein Icon-Framework). */
const VALUE_ICONS: Record<string, ReactNode> = {
  hand: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.6 21h5.1c2.7 0 4.3-1.8 4.3-4.4v-5.7a1.3 1.3 0 0 0-2.6 0v3.1M14.4 11.9V6.5a1.3 1.3 0 0 0-2.6 0v5.3M11.8 11.7V5.2a1.3 1.3 0 0 0-2.6 0v7.6M9.2 12.6V8.1a1.3 1.3 0 0 0-2.6 0v6.7c0 .9-.3 1.5-1 2.1l-.7.7c-.6.6-.7 1.1-.4 1.9.4 1 1.4 1.7 2.5 1.9" />
    </svg>
  ),
  scale: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v14M9 21h6M5 8h14M5 8 2.6 13h4.8L5 8ZM19 8l-2.4 5h4.8L19 8Z" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M12 3.3 19 6v5.5c0 5-3 8.4-7 9.2-4-.8-7-4.2-7-9.2V6z" />
    </svg>
  ),
  wrench: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 17.5 15 9M17.5 4 20 6.5l-2.5 2.5L15 6.5zM4.5 19.5l2-2" />
    </svg>
  ),
  door: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="3" width="11" height="18" rx="1" /><path d="M13.2 12h.01M3 21h18" />
    </svg>
  ),
};

const TEAM_ICONS: Record<string, ReactNode> = {
  heart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M12 20s-7.2-4.6-9.2-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.2 11c-2 4.4-9.2 9-9.2 9z" />
    </svg>
  ),
  cross: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.5" /><path d="M12 8.5v7M8.5 12h7" />
    </svg>
  ),
  bolt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M13 3 5.5 13.5H11L9.5 21 17.5 10H12z" />
    </svg>
  ),
};

export default async function KollektivPage() {
  const [page, crew, hist, gone, s, familie, clips] = await Promise.all([
    pageContent<KollektivPageContent>("kollektiv"),
    team(),
    history(),
    past(),
    settings(),
    partners(),
    pageMedia("kollektiv"),
  ]);
  if (!page) notFound();

  const sec = page.sections;
  const foundedYear = page.foundedDate.slice(0, 4);
  const missionsCount = String(gone.length).padStart(2, "0");
  const statCells: StatCell[] = [
    { value: foundedYear, label: page.stats.founded.label },
    { value: missionsCount, label: page.stats.missions.label },
    { value: page.stats.systemsBuilt.value, label: page.stats.systemsBuilt.label },
    { value: page.stats.volunteerPercent.value, label: page.stats.volunteerPercent.label },
  ];
  const spendSum = page.spendChart.items.reduce((n, i) => n + i.percent, 0);
  const mailLink = (label: string) => (
    <a className="bp-link" href={`mailto:${s.email}`}>{label}</a>
  );

  return (
    <KollektivBlueprint>
      {/* ---------- BL. 00 · Deckblatt ----------
          Kopf und Schriftfeld nebeneinander, darunter die Uebersichts-
          zeichnung der Anlage. Das ist die Antwort auf "linksbuendige
          Spalte, rechts 55 % leer": der Bogen hat jetzt einen Kopfbereich
          mit zwei Feldern statt einer Spalte im Nichts. */}
      <KollektivSheet meta={sec.cover} className="phero bp-cover">
        <div className="bp-cover-head">
          <div className="bp-cover-title">
            <p className="eyebrow">{page.hero.eyebrow}</p>
            <h1>{glowify(page.hero.h1)}</h1>
            <p className="section-intro">{page.hero.intro}</p>
          </div>
          <dl className="bp-titleblock">
            {page.sheet.rows.map(row => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value.replace("{year}", foundedYear)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="bp-rig-inner">
          <div className="bp-rig-text">
            <p>{page.ethos.text1}</p>
            <p>{emphasize(page.ethos.text2)}</p>
          </div>
          <KollektivRig />
        </div>
      </KollektivSheet>

      {/* ---------- BL. 01 · Haltung ----------
          Frueher fuenf Kacheln in einem auto-fit-Raster: bei 1120px lief
          das auf 4 + 1 Waise hinaus, bei 768px auf 3 + 2. Fuenf Elemente
          haben in einem elastischen Raster IMMER eine Waise, ausser bei
          genau einer oder genau fuenf Spalten. Jetzt eine Stueckliste —
          POS., Symbol, Bezeichnung, Text: eine Zeile pro Grundsatz, keine
          Waise bei keiner Breite, und dem Bogen angemessener als Kacheln. */}
      <KollektivSheet meta={sec.werte} id="werte">
        <SheetHead copy={sec.werte} />
        <ol className="bp-specs">
          {page.values.map((v, i) => (
            <li className="bp-spec" key={v.title}>
              <span className="bp-spec-pos" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
              <span className="bp-spec-ico" aria-hidden="true">{VALUE_ICONS[v.icon]}</span>
              {/* .txfit (geteilte Utility, takeoff.css): enge Traegerflaeche
                  fuer Grid-Kinder. Ueber Mars-/Strandboden ist der Grund
                  hell — die Stueckliste hat, anders als die frueheren
                  Kacheln, keine eigene Flaeche mehr. */}
              <b className="bp-spec-title txfit">{v.title}</b>
              <p className="bp-spec-text txfit">{v.text}</p>
            </li>
          ))}
        </ol>
      </KollektivSheet>

      {/* ---------- BL. 02 · Kassenbuch ----------
          Balken links, Summenfeld rechts: der Hinweis stand vorher als
          volle Zeile unter der Grafik und lief bei 1440px ueber 900px
          Breite als eine einzige Mono-Zeile durch. */}
      <KollektivSheet meta={sec.finanzen} id="finanzen">
        <SheetHead copy={sec.finanzen} />
        <div className="bp-ledger">
          <div className="bp-ledger-chart">
            <KollektivSpend items={page.spendChart.items} />
          </div>
          <aside className="bp-ledger-side">
            <div className="bp-sum">
              <span className="bp-sum-label">{page.spendChart.sumLabel}</span>
              <b className="bp-sum-value">{spendSum} %</b>
            </div>
            <p className="lu-note">{page.spendChart.note}</p>
          </aside>
        </div>
      </KollektivSheet>

      {/* ---------- BL. 03 · Logbuch — der eine Bewegungsmoment ---------- */}
      <KollektivSheet meta={sec.history} id="history">
        <SheetHead copy={sec.history} />
        <KollektivHistory
          history={hist}
          tail={sec.history.tail ?? ""}
          tailLink={sec.history.tailLink ?? ""}
        />
      </KollektivSheet>

      {/* ---------- BL. 04 · Fotowand ----------
          Was da ist (Clips) und was noch fehlt (freie Felder) stehen
          nebeneinander statt untereinander — sonst liest die Sektion sich
          als "zwei Videos, dann vier leere Kaesten". */}
      <KollektivSheet meta={sec.fotowand} id="fotowand">
        <SheetHead copy={sec.fotowand} />
        <div className="bp-wall">
          {clips.length > 0 && (
            <div className="bp-wall-media">
              <p className="section-intro bp-wall-intro">{page.fotowand.mediaIntro}</p>
              <MediaGallery items={clips} label={page.fotowand.mediaLabel} />
            </div>
          )}
          <div className="bp-wall-free">
            <p className="bp-wall-label">{page.fotowand.placeholderLabel}</p>
            <div className="gallery-grid">
              {page.fotowand.placeholders.map(ph => (
                <div className="gph" key={ph.fig}>
                  <span className="bp-fig" aria-hidden="true">{ph.fig}</span>
                  <span className="bp-gph-text">{ph.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="lu-note bp-wall-note">
          {tpl(page.fotowand.note, {
            link: <Link href={pageHref("team")} className="bp-link">{page.fotowand.noteLink}</Link>,
          })}
        </p>
      </KollektivSheet>

      {/* ---------- BL. 05 · Besatzung ---------- */}
      <KollektivSheet meta={sec.crew} id="crew">
        <SheetHead copy={sec.crew} />
        <div className="crewgrid bp-crew">
          {crew.map(member => (
            <div className="ccard" key={member.name}>
              <div className="avatar">
                {member.icon && TEAM_ICONS[member.icon]
                  ? TEAM_ICONS[member.icon]
                  : (member.initials || initialsFrom(member.name))}
              </div>
              <b>{member.name}</b>
              <span>{member.role}</span>
            </div>
          ))}
        </div>
      </KollektivSheet>

      {/* ---------- Kennwerte-Leiste ----------
          Bewusst OHNE Blattnummer: es ist keine eigene Zeichnung, sondern
          die Legende zwischen zweien. Sie laeuft trotzdem im selben Raster
          mit, damit der Heftrand nicht abreisst. */}
      <KollektivSheet meta={{}} className="bp-metrics">
        <KollektivOrbit foundedDate={page.foundedDate} />
        <KollektivStats stats={statCells} />
      </KollektivSheet>

      {/* ---------- BL. 06 · Verbund ---------- */}
      <KollektivSheet meta={sec.familie} id="familie">
        <SheetHead copy={sec.familie} />
        <ul className="bp-family-grid">
          {familie.map(f => (
            <li className="bp-fam-card" key={f.name}>
              {f.url ? (
                <a href={f.url} target="_blank" rel="noopener">
                  <b>{f.name}</b>{f.beschreibung && <span>{f.beschreibung}</span>}
                </a>
              ) : (
                <div className="bp-fam-inner">
                  <b>{f.name}</b>{f.beschreibung && <span>{f.beschreibung}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      </KollektivSheet>

      {/* ---------- BL. 07 · Bordfragen ---------- */}
      <KollektivSheet meta={sec.faq} id="faq">
        <SheetHead copy={sec.faq} />
        <dl className="m-rows bp-faq">
          {page.faq.map(item => (
            <div className="m-row" key={item.q}>
              <dt>{item.q}</dt>
              <dd>{item.a}</dd>
            </div>
          ))}
        </dl>
      </KollektivSheet>

      {/* ---------- BL. 08 · Funkspruch ----------
          Vorher zwei zentrierte Kaesten untereinander, jeder mit 45 %
          leerer Flaeche daneben. Nebeneinander bilden sie den Schlussbund
          des Bogens. */}
      <KollektivSheet meta={sec.funkspruch} className="bp-signals-sheet">
        <div className="bp-signals">
          <div className="transmission" id="mitmachen">
            <span className="tx-label">{page.mitmachen.label}</span>
            <p>{page.mitmachen.text}</p>
            <div className="chips bp-roles" role="list" aria-label={page.mitmachen.rolesLabel}>
              {page.joinRoles.map(r => (
                <a
                  className="chip" role="listitem" key={r.label}
                  href={`mailto:${s.email}?subject=${encodeURIComponent(r.mailSubject || `Mitmachen – ${r.label}`)}`}
                >
                  {r.label}
                </a>
              ))}
            </div>
            <p className="lu-note bp-tx-note">
              {tpl(page.mitmachen.direct, {
                telegram: <a className="bp-link" href={s.telegram} target="_blank" rel="noopener">{page.mitmachen.telegramLabel}</a>,
                mail: mailLink(page.mitmachen.mailLabel),
              })}
            </p>
          </div>

          <div className="transmission" id="booking">
            <span className="tx-label">{page.booking.label}</span>
            <p>{page.booking.text}</p>
            <div className="facts">
              {page.bookingFacts.map(f => (
                <span key={f.label}><b>{f.label}</b> · {f.value}</span>
              ))}
            </div>
            <p className="lu-note bp-tx-note">
              {tpl(page.booking.presskit, { mail: mailLink(s.email) })}
            </p>
          </div>
        </div>
      </KollektivSheet>
    </KollektivBlueprint>
  );
}
