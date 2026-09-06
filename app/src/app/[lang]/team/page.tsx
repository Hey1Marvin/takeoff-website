import type { Metadata } from "next";
import Link from "next/link";
import { team, artists, past, nextEvent, pageContent, fmtDate } from "@/lib/data";
import { artistHref, pageHref } from "@/lib/site";
import type { TeamMember, Artist, LineupSlot } from "@/lib/types";
import TeamOrbit, { type TeamStationVM } from "@/components/pages/TeamOrbit";
import TeamMapPower from "@/components/pages/TeamMapPower";
import TeamCrewBoard, { type TeamDeptVM, type TeamCardVM } from "@/components/pages/TeamCrewBoard";
import "@/styles/pages/team.css";

export const metadata: Metadata = {
  title: "Team · takeoff potsdam",
  description: "Wer bei takeoff was macht — DJs, Licht, Deko, Awareness, Sani, Orga.",
};

/* Spiegelt src/data/pages/team.json. Referenz fuer die urspruengliche
   (nicht-flippende) Render-Logik: prototype/assets/js/pages/team.js —
   das Flip-Konzept (Aufgaben-Rueckseite, aria-korrekt, Tier-Guards,
   Einhorn-Easteregg) kommt aus scratchpad/spec-team.md. */
interface TeamStatDef { key: string; mode: "auto" | "manual"; value?: string; label: string }
interface TeamDepartmentDef { id: string; title: string; subtitle: string; intro: string; match: string[] }
interface TeamMemberExtra { tasks?: string[]; contact?: string }
interface TeamRoleLink { href: string; linkText: string }
interface TeamPageContent {
  hero: { eyebrow: string; h1: string; intro: string };
  stats: TeamStatDef[];
  crew: { eyebrow: string; h2: string; intro: string; flipOpenLabel: string; flipCloseLabel: string; sinceLabel: string; moreLabel: string };
  plan: { label: string; note: string; reserveLabel: string };
  departments: TeamDepartmentDef[];
  departmentFallbackTitle: string;
  members: Record<string, TeamMemberExtra>;
  tasksFallback: string[];
  roleLinks: Record<string, TeamRoleLink>;
  artistLink: { linkText: string };
  nextMission: { label: string; introTemplate: string; fallbackText: string };
  photoboard: { eyebrow: string; h2: string; slotNote: string; note: string; joinText: string; joinLabel: string };
  easterEgg: { toastText: string };
}

/* Initialen-Fallback (Portierung von initialsFrom() aus team.js) — trennt
   zusaetzlich an "-"/"&", nicht nur an Leerraum: "Awareness-Team" und
   "Deko & Bau" haben sonst keine Wortgrenze zum Trennen. */
function initialsFrom(name: string): string {
  return name.trim().split(/[\s\-&]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "??";
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[·&']/g, " ").trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "crew";
}

/* Bereichs-Zuordnung per Namens-Substring, ohne db.json anzufassen
   (Portierung von memberDeptId() aus team.js). */
function matchDept(name: string, departments: TeamDepartmentDef[]): string | null {
  const lower = name.toLowerCase();
  for (const dept of departments) {
    if (dept.match.some(tok => lower.includes(tok.toLowerCase()))) return dept.id;
  }
  return null;
}

/* Automatischer Artist-Abgleich (Portierung von findArtist() aus team.js):
   DJ-Karten verlinken auf Bio/Sets, ohne einen Link pro Person doppelt in
   team.json zu pflegen. */
function findArtist(name: string, artistList: Artist[]): Artist | null {
  const lower = name.toLowerCase();
  return artistList.find(a => a.name.length > 2 && lower.includes(a.name.toLowerCase())) ?? null;
}

/* Wer aus der Crew steht im Lineup der naechsten Mission? (Portierung von
   matchedLineupNames() aus team.js) */
function matchedLineupNames(lineup: LineupSlot[], teamList: TeamMember[]): string[] {
  const found = new Set<string>();
  for (const act of lineup) {
    const actName = (act.name || "").trim().toLowerCase();
    if (!actName) continue;
    for (const m of teamList) {
      if (m.name.toLowerCase().includes(actName)) found.add(m.name);
    }
  }
  return [...found];
}

function buildCard(m: TeamMember, page: TeamPageContent, artistList: Artist[]): TeamCardVM {
  const extra = page.members[m.name];
  const artistMatch = findArtist(m.name, artistList);
  const roleLink = page.roleLinks[m.name];
  const href = roleLink?.href ?? (artistMatch ? artistHref(artistMatch.slug) : undefined);
  const linkText = roleLink?.linkText ?? (artistMatch ? page.artistLink.linkText : undefined);
  return {
    id: slugify(m.name),
    name: m.name,
    role: m.role,
    avatarIcon: m.icon,
    avatarText: m.icon ? undefined : (m.initials || initialsFrom(m.name)),
    since: artistMatch?.since,
    tasks: extra?.tasks?.length ? extra.tasks : page.tasksFallback,
    contact: extra?.contact,
    href,
    linkText,
  };
}

function groupByDepartment(teamList: TeamMember[], departments: TeamDepartmentDef[]) {
  const buckets = new Map<string, TeamMember[]>(departments.map(d => [d.id, []]));
  const rest: TeamMember[] = [];
  for (const m of teamList) {
    const id = matchDept(m.name, departments);
    if (id && buckets.has(id)) buckets.get(id)!.push(m);
    else rest.push(m);
  }
  return { buckets, rest };
}

/* Team-Grid komplett aus dem Gateway gerendert — team() filtert unsichtbare
   Rollen automatisch (Beweis-Portierung wie events/page.tsx: neue Crew in
   db.json erscheint hier ohne Markup-Aenderung).

   AUFBAU (It. 14). Vorher: eine linksbuendige Textspalte, darunter drei
   Kartenreihen, dazwischen zwei freistehende <div class="wrap"> — und weil
   diese Seite als einzige KEIN paddingTop-Override auf ihren .section
   gesetzt hat, stand die kleine "Naechste Mission"-Notiz in rund 216px
   Leere (je ~108px ueber und unter ihr, gemessen bei 1440x900,
   .design-audit/befunde.json). Dazu kam: ein blankes .wrap als direktes
   Kind von <main> bekommt im Tagmodus seine helle Spalte nur so breit wie
   das .wrap selbst — links und rechts davon stand ein schwarzer Riegel quer
   ueber die helle Seite (im Tag-Screenshot nachgesehen, nicht erschlossen).

   Jetzt: vier vollbreite <section> als Kinder von <main> (keine nackten
   .wrap mehr), ein durchgehendes Redaktionsraster "breite Spalte + rechte
   Schiene" fuer Crew-Board und Foto-Board, und die Missionsnotiz sitzt in
   dieser Schiene statt allein in der Leere. Alle Abstaende ueber die
   Rollen-Tokens (--sp-*), keine style={{padding}}-Korrekturen mehr. */
export default async function TeamPage() {
  const [pageContentRaw, crew, artistList, pastEvents, next] = await Promise.all([
    pageContent<TeamPageContent>("team"),
    team(),
    artists(),
    past(),
    nextEvent(),
  ]);

  if (!pageContentRaw) {
    // Seiten-Text fehlt (AGENTS.md: "falls vorhanden") — ohne Bereichs-/
    // Aufgaben-Texte gibt es nichts sinnvoll Strukturiertes zu rendern.
    // Die Worte hier koennen NICHT aus der Datenschicht kommen: das ist
    // genau der Zweig, in dem sie fehlt.
    return (
      <section className="phero">
        <div className="wrap">
          <p className="eyebrow">Teamboard</p>
          <h1>Die <span className="glow">Crew</span></h1>
          <p className="section-intro">Team-Inhalte werden gerade vorbereitet.</p>
        </div>
      </section>
    );
  }
  const page = pageContentRaw;

  const { buckets, rest } = groupByDepartment(crew, page.departments);
  const departmentsVM: TeamDeptVM[] = page.departments
    .filter(d => (buckets.get(d.id) ?? []).length > 0)
    .map(d => ({
      id: d.id,
      title: d.title,
      subtitle: d.subtitle,
      intro: d.intro,
      members: (buckets.get(d.id) ?? []).map(m => buildCard(m, page, artistList)),
    }));
  if (rest.length > 0) {
    departmentsVM.push({
      id: "fallback",
      title: page.departmentFallbackTitle,
      subtitle: "",
      intro: "",
      members: rest.map(m => buildCard(m, page, artistList)),
    });
  }

  /* Der Bordplan liest dieselbe Liste wie das Board — Ringreihenfolge,
     Legendenreihenfolge und Bereichsreihenfolge koennen damit nicht
     auseinanderlaufen, und die Punktzahl je Ring ist die tatsaechliche
     Bereichsgroesse statt einer gepflegten Zahl. */
  const stations: TeamStationVM[] = departmentsVM.map(d => ({
    id: d.id,
    title: d.title,
    count: d.members.length,
  }));

  const statCells = page.stats.map(st => {
    let value = st.value ?? "—";
    if (st.mode === "auto") {
      if (st.key === "crewSize") value = String(crew.length).padStart(2, "0");
      else if (st.key === "missions") value = String(pastEvents.length).padStart(2, "0");
    }
    return { value, label: st.label };
  });

  const lineupMatches = next ? matchedLineupNames(next.lineup, crew) : [];
  const missionText = next && lineupMatches.length > 0
    ? page.nextMission.introTemplate
        .replace("{date}", `${next.weekday} ${fmtDate(next.date)}`)
        .replace("{lineup}", lineupMatches.join(", "))
    : page.nextMission.fallbackText;

  return (
    <>
      <TeamMapPower />

      <section className="phero">
        <div className="wrap">
          <p className="eyebrow">{page.hero.eyebrow}</p>
          <h1 dangerouslySetInnerHTML={{ __html: page.hero.h1 }} />
          <p className="section-intro">{page.hero.intro}</p>
        </div>
      </section>

      {/* Kennzahlenband. Die Luft steckt INNEN in .stats (takeoff.css:
          padding, nie margin) — ein Aussenabstand waere im Tagmodus ein
          Loch zwischen zwei hellen Spalten. */}
      <section className="kt-statsband">
        <div className="wrap">
          <div className="stats">
            {statCells.map(c => (
              <div key={c.label}><b>{c.value}</b><span>{c.label}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="section kt-crew" id="crew">
        <div className="wrap">
          <div className="kt-board">
            <header className="section-head">
              <p className="eyebrow">{page.crew.eyebrow}</p>
              <h2 className="h2" dangerouslySetInnerHTML={{ __html: page.crew.h2 }} />
              <p className="section-intro">{page.crew.intro}</p>
            </header>

            <TeamCrewBoard
              departments={departmentsVM}
              flipOpenLabel={page.crew.flipOpenLabel}
              flipCloseLabel={page.crew.flipCloseLabel}
              sinceLabel={page.crew.sinceLabel}
              moreLabel={page.crew.moreLabel}
              unicornToast={page.easterEgg.toastText}
            />

            {/* Rechte Schiene: Bordplan, Legende, Missionsnotiz — fuellt die
                Flaeche, die vorher neben der 640px-Textspalte leer stand.
                Steht im Markup NACH dem Board, damit Vorlese-Reihenfolge und
                Lesefluss auf schmalen Schirmen dieselben sind (Begleitspalte
                zuletzt); auf breiten Schirmen setzt sie das Raster explizit
                nach rechts oben, ohne dass die DOM-Reihenfolge luegt. */}
            <aside className="kt-plan" aria-label={page.plan.label}>
              <p className="kt-plan-label">{page.plan.label}</p>
              <TeamOrbit
                stations={stations}
                note={page.plan.note}
                reserveLabel={page.plan.reserveLabel}
              />
              <div className="transmission kt-mission">
                <span className="tx-label">{page.nextMission.label}</span>
                <p>{missionText}</p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Foto-Board. Vorher acht gestrichelte 4:3-Kaesten mit "Foto folgt
          nach Freigabe" — eine halbe Bildschirmhoehe Platzhalter. Jetzt
          eine Reihe leerer Plaetze im selben Rund wie die Karten-Avatare,
          daneben in der Schiene der Grund, warum sie leer sind. */}
      <section className="section kt-photos" id="fotoboard">
        <div className="wrap">
          <header className="section-head">
            <p className="eyebrow">{page.photoboard.eyebrow}</p>
            <h2 className="h2" dangerouslySetInnerHTML={{ __html: page.photoboard.h2 }} />
          </header>
          <div className="kt-photos-body">
            <div>
              <ul className="kt-strip">
                {crew.map(m => (
                  <li className="kt-slot" key={m.name}>
                    <span aria-hidden="true">{m.initials || initialsFrom(m.name)}</span>
                    <span className="kt-slot-name">{m.name}</span>
                  </li>
                ))}
              </ul>
              <p className="kt-strip-note txfit">{page.photoboard.slotNote}</p>
            </div>
            <p className="lu-note kt-consent">
              {page.photoboard.note} {page.photoboard.joinText}{" "}
              <Link className="kt-join" href={pageHref("kollektiv", "mitmachen")}>{page.photoboard.joinLabel}</Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
