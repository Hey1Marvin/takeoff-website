import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageContent, team, history, past, settings, partners } from "@/lib/data";
import KollektivBlueprint from "@/components/pages/KollektivBlueprint";
import KollektivRig from "@/components/pages/KollektivRig";
import KollektivHistory from "@/components/pages/KollektivHistory";
import KollektivOrbit from "@/components/pages/KollektivOrbit";
import KollektivStats, { type StatCell } from "@/components/pages/KollektivStats";
import "@/styles/pages/kollektiv.css";
import { pageHref } from "@/lib/site";

export const metadata: Metadata = {
  title: "Kollektiv · takeoff potsdam",
  description: "Wer takeoff ist: ehrenamtliches Rave-Kollektiv aus Potsdam. Selbstgebaute Anlage, Themen-Deko, Awareness als Haltung.",
};

/* Spiegelt src/data/pages/kollektiv.json (siehe assets/js/pages/kollektiv.js
   im Prototyp für die 1:1-Referenz der Render-Logik). Der Contract
   page-kollektiv.json beschreibt dieselbe Idee als Admin-Formular; Quelle
   der Wahrheit für die Feldnamen ist hier die eingecheckte JSON. ethos.image/
   imageAlt sind im Contract vorgesehen, werden aber auf der Seite selbst im
   Prototyp nicht gerendert (die rechte Spalte zeigt das Rig-Diagramm) —
   deshalb hier bewusst nicht Teil des Typs. */
interface KollektivPageContent {
  hero: { eyebrow: string; h1: string; intro: string };
  foundedDate: string;
  ethos: { text1: string; text2: string };
  values: { icon: string; title: string; text: string }[];
  spendChart: { note: string; items: { label: string; percent: number }[] };
  stats: {
    founded: { label: string };
    missions: { label: string };
    systemsBuilt: { value: string; label: string };
    volunteerPercent: { value: string; label: string };
  };
  joinRoles: { label: string; mailSubject?: string }[];
  bookingFacts: { label: string; value: string }[];
  faq: { q: string; a: string }[];
}

/* H1 trägt den Glow auf dem letzten Wort; Satzzeichen am Ende bleiben
   außerhalb des Glow-Spans. Portierung von setGlowHeadline (kollektiv.js)
   als reine Render-Funktion statt DOM-Mutation. */
function glowify(text: string): ReactNode {
  const words = text.trim().split(/\s+/);
  if (!words.length) return text;
  const last = words.pop()!;
  const trailMatch = last.match(/([.!?…,;:]+)$/);
  const trail = trailMatch ? trailMatch[1] : "";
  const word = trail ? last.slice(0, -trail.length) : last;
  return (
    <>
      {words.length ? words.join(" ") + " " : ""}
      <span className="glow">{word}</span>
      {trail}
    </>
  );
}

/* Hebt eine „…"-Phrase mit <em> hervor. Portierung von setEmphasisText.
   Kein /s-Flag (dotAll) — Build-Target ist ES2017, und der Seitentext ist
   ohnehin einzeilig, [\s\S] deckt Zeilenumbrüche trotzdem sicher ab. */
function emphasize(text: string): ReactNode {
  const m = text.match(/^([\s\S]*?)(„[^“]*“)([\s\S]*)$/);
  if (!m) return text;
  return (
    <>
      {m[1]}
      <em style={{ color: "var(--ink)" }}>{m[2]}</em>
      {m[3]}
    </>
  );
}

function initialsFrom(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "??";
}

/* Icon-Sets (handgezeichnet, kein Icon-Framework) — identisch zu
   VALUE_ICONS/TEAM_ICONS in kollektiv.js, damit der Kachel-Look 1:1 bleibt. */
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

/* Bündelt das wiederkehrende "Blaupausen-Blatt"-Chrome (Registermarken +
   Titelblock) der BL.01–BL.07-Abschnitte. Rein präsentational, ohne
   Interaktion — deshalb Server-seitig, kein "use client" nötig.
   tight=true (Default) => padding-top:0, weil die Section direkt auf eine
   andere Section folgt (wie im Prototyp-Markup). "familie" folgt auf den
   freistehenden Orbit/Stats-Block und behält deshalb das normale
   .section-Padding — tight={false} lässt den Inline-Style ganz weg, statt
   ihn (wie ein bloßer style-Default es bei style={undefined} täte) doch
   auf paddingTop:0 zurückfallen zu lassen. */
function BpSheet({
  id, plate, tight = true, children,
}: {
  id?: string;
  plate: string;
  tight?: boolean;
  children: ReactNode;
}) {
  const style: CSSProperties | undefined = tight ? { paddingTop: 0 } : undefined;
  return (
    <section className="section" id={id} style={style}>
      <div className="wrap bp-sheet">
        <i className="bp-corner" data-pos="tl" aria-hidden="true" />
        <i className="bp-corner" data-pos="tr" aria-hidden="true" />
        <i className="bp-corner" data-pos="bl" aria-hidden="true" />
        <i className="bp-corner" data-pos="br" aria-hidden="true" />
        <span className="bp-plate" aria-hidden="true">{plate}</span>
        {children}
      </div>
    </section>
  );
}

export default async function KollektivPage() {
  const [page, crew, hist, gone, s, familie] = await Promise.all([
    pageContent<KollektivPageContent>("kollektiv"),
    team(),
    history(),
    past(),
    settings(),
    partners(),
  ]);
  if (!page) notFound();

  const foundedYear = page.foundedDate.slice(0, 4);
  const missionsCount = String(gone.length).padStart(2, "0");
  const statCells: StatCell[] = [
    { value: foundedYear, label: page.stats.founded.label },
    { value: missionsCount, label: page.stats.missions.label },
    { value: page.stats.systemsBuilt.value, label: page.stats.systemsBuilt.label },
    { value: page.stats.volunteerPercent.value, label: page.stats.volunteerPercent.label },
  ];

  return (
    <KollektivBlueprint>
      <section className="phero">
        <div className="wrap">
          <p className="eyebrow">{page.hero.eyebrow}</p>
          <h1>{glowify(page.hero.h1)}</h1>
          <p className="section-intro">{page.hero.intro}</p>
        </div>
      </section>

      {/* Ethos + Anlagen-Diagramm — 2-Spalten-Layout ab 860px (.bp-rig-inner) */}
      <section className="section" style={{ paddingTop: "clamp(30px, 5vh, 50px)" }}>
        <div className="wrap bp-rig-wrap">
          <div className="bp-rig-inner">
            <p style={{ color: "var(--ink-dim)", marginBottom: 18 }}>{page.ethos.text1}</p>
            <p style={{ color: "var(--ink-dim)" }}>{emphasize(page.ethos.text2)}</p>
            <KollektivRig />
          </div>
        </div>
      </section>

      <BpSheet id="werte" plate="BL. 01 · HALTUNG">
        <header className="section-head">
          <p className="eyebrow">Haltung</p>
          <h2 className="h2">Warum wir das <span className="glow">tun</span></h2>
          <p className="section-intro">Kein Businessplan — fünf Grundsätze, an denen wir jede Mission messen.</p>
        </header>
        <div className="werte-grid">
          {page.values.map(v => (
            <div className="wtile" key={v.title}>
              <span className="ico" aria-hidden="true">{VALUE_ICONS[v.icon]}</span>
              <b>{v.title}</b>
              <p>{v.text}</p>
            </div>
          ))}
        </div>
      </BpSheet>

      <BpSheet id="finanzen" plate="BL. 02 · KASSENBUCH">
        <header className="section-head">
          <p className="eyebrow">Kassenbuch</p>
          <h2 className="h2">Wohin das Geld <span className="glow">fliegt</span></h2>
          <p className="section-intro">{'„Nicht-Verlust-orientiert" ist kein Slogan — hier ist, wofür Einnahmen draufgehen.'}</p>
        </header>
        <div className="bp-spend">
          {page.spendChart.items.map(item => {
            const pct = Math.max(0, Math.min(100, item.percent));
            return (
              <div className="bp-spend-row" key={item.label}>
                <span className="bp-spend-label">{item.label}</span>
                <span className="bp-spend-track">
                  <span className="bp-spend-fill" style={{ "--pct": `${pct}%` } as CSSProperties} />
                </span>
                <span className="bp-spend-pct">{pct}%</span>
              </div>
            );
          })}
        </div>
        <p className="lu-note">{page.spendChart.note}</p>
      </BpSheet>

      <BpSheet id="history" plate="BL. 03 · LOGBUCH · M 1:1">
        <header className="section-head">
          <p className="eyebrow">Logbuch</p>
          <h2 className="h2">Wie alles <span className="glow">anfing</span></h2>
          <p className="section-intro">Kein Masterplan — nur eine kleine Gruppe, ein Lötkolben und die Idee, dass Potsdam mehr Trance verdient.</p>
        </header>
        <KollektivHistory history={hist} />
      </BpSheet>

      <BpSheet id="fotowand" plate="BL. 04 · FOTOWAND">
        <header className="section-head">
          <p className="eyebrow">Fotowand</p>
          <h2 className="h2">Momente</h2>
        </header>
        <div className="gallery-grid">
          <div className="gph"><span className="bp-fig" aria-hidden="true">FIG. 01</span>Foto folgt<br />nach Freigabe</div>
          <div className="gph"><span className="bp-fig" aria-hidden="true">FIG. 02</span>Foto folgt<br />nach Freigabe</div>
          <div className="gph"><span className="bp-fig" aria-hidden="true">FIG. 03</span>Foto folgt<br />nach Freigabe</div>
          <div className="gph"><span className="bp-fig" aria-hidden="true">FIG. 04</span>Foto folgt<br />nach Freigabe</div>
        </div>
        <p className="lu-note" style={{ marginTop: 14 }}>
          Kein Foto ohne Frage — die Wand füllt sich, sobald alle Abgebildeten zugestimmt haben. Das ganze Team:{" "}
          <Link href={pageHref("team")} style={{ color: "var(--acc-3-tint)" }}>Teamboard →</Link>
        </p>
      </BpSheet>

      <BpSheet id="crew" plate="BL. 05 · BESATZUNG">
        <header className="section-head">
          <p className="eyebrow">Crew Select</p>
          <h2 className="h2">Wer hier <span className="glow">funkt</span></h2>
        </header>
        <div className="crewgrid">
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
      </BpSheet>

      <div className="wrap">
        <KollektivOrbit foundedDate={page.foundedDate} />
        <KollektivStats stats={statCells} />
      </div>

      <BpSheet id="familie" plate="BL. 06 · VERBUND" tight={false}>
        <header className="section-head">
          <p className="eyebrow">Familie</p>
          <h2 className="h2">Mit wem wir <span className="glow">fliegen</span></h2>
          <p className="section-intro">Kollektive, Häuser und Menschen, ohne die unsere Nächte nicht gehen würden.</p>
        </header>
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
      </BpSheet>

      <BpSheet id="faq" plate="BL. 07 · BORDFRAGEN">
        <header className="section-head">
          <p className="eyebrow">Bordfragen</p>
          <h2 className="h2">Häufig <span className="glow">gefragt</span></h2>
        </header>
        <dl className="m-rows bp-faq">
          {page.faq.map(item => (
            <div className="m-row" key={item.q}>
              <dt>{item.q}</dt>
              <dd>{item.a}</dd>
            </div>
          ))}
        </dl>
      </BpSheet>

      <section className="section" id="mitmachen" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="transmission">
            <span className="tx-label">Crew-Anwärter*innen gesucht</span>
            <p>Bar, Einlass, Awareness, Deko-Bau oder Sani — klick deine Rolle an, wir schreiben zurück. takeoff wächst mit jeder Mission.</p>
            <div className="chips bp-roles" role="list" aria-label="Rollen zum Mitmachen">
              {page.joinRoles.map(r => (
                <a
                  className="chip" role="listitem" key={r.label}
                  href={`mailto:${s.email}?subject=${encodeURIComponent(r.mailSubject || `Mitmachen – ${r.label}`)}`}
                >
                  {r.label}
                </a>
              ))}
            </div>
            <p className="lu-note" style={{ marginTop: 16 }}>
              Lieber direkt reden?{" "}
              <a href={s.telegram} target="_blank" rel="noopener" style={{ color: "var(--acc-3-tint)" }}>Telegram</a>{" "}
              oder <a href={`mailto:${s.email}`} style={{ color: "var(--acc-3-tint)" }}>Mail</a>.
            </p>
          </div>
        </div>
      </section>

      <section className="section" id="booking" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="transmission">
            <span className="tx-label">Booking &amp; Partner</span>
            <p>Eigenes Soundsystem, eigenes Licht, eingespielte Schicht-Crews und Erfahrung mit Genehmigungen — wir supporten auch andere Veranstaltungen.</p>
            <div className="facts">
              {page.bookingFacts.map(f => (
                <span key={f.label}><b>{f.label}</b> · {f.value}</span>
              ))}
            </div>
            <p className="lu-note" style={{ marginTop: 16 }}>
              Presskit folgt: <a href={`mailto:${s.email}`} style={{ color: "var(--acc-3-tint)" }}>{s.email}</a>
            </p>
          </div>
        </div>
      </section>
    </KollektivBlueprint>
  );
}
