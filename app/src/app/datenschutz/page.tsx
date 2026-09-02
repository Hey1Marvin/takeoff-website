import type { Metadata } from "next";
import { pageContent, settings } from "@/lib/data";
import { LangLock } from "@/components/I18nProvider";

export const metadata: Metadata = {
  title: "Datenschutz · takeoff potsdam",
  description: "Kurz: Diese Seite trackt dich nicht. Die Details stehen hier.",
};

/* Spiegelt src/data/pages/datenschutz.json (siehe prototype/datenschutz.html
   für die 1:1-Referenz). Kein eigener Contract — der Inhalt gehört dieser
   einen Seite (Regel aus ~/.claude/daten-contract.md), Admin bearbeitet
   ihn über die generische Seiten-Formular-Ansicht (page-generic).
   Der "Deine Rechte"-Punkt bekommt seinen Mail-Link aus settings(), nicht
   aus dieser JSON — dieselbe Begründung wie bei impressum/page.tsx. */
interface DatenschutzPageContent {
  hero: { eyebrow: string; h1: string; intro: string };
  rows: { label: string; text: string }[];
  protoNote: string;
}

export default async function DatenschutzPage() {
  const [page, s] = await Promise.all([
    pageContent<DatenschutzPageContent>("datenschutz"),
    settings(),
  ]);
  if (!page) return null;

  return (
    // data-lang-lock: Rechtsseite, bleibt immer Deutsch — Orchestrator
    // liest dieses Attribut beim Verdrahten des DE/EN-Umschalters
    // (siehe prototype/datenschutz.html Kopfkommentar zu data-lang-lock).
    <div data-lang-lock="1">
      {/* Sperrt die Seite auf Deutsch. Das Attribut oben am <div> dokumentiert
          die Absicht; wirksam wird sie erst ueber <LangLock />, denn der
          I18nProvider prueft <html> — dort sitzt die Sperre im Prototyp auch
          (prototype/impressum.html: <html data-lang-lock>). */}
      <LangLock />
      <section className="phero">
        <div className="wrap">
          <p className="eyebrow">{page.hero.eyebrow}</p>
          <h1>{page.hero.h1}</h1>
          <p className="section-intro">{page.hero.intro}</p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "clamp(24px, 4vh, 40px)" }}>
        <div className="wrap" style={{ maxWidth: 720 }}>
          <dl className="m-rows" style={{ borderTop: "1px solid var(--bg-hairline)" }}>
            {page.rows.map(row => (
              <div className="m-row" key={row.label}>
                <dt>{row.label}</dt>
                <dd>
                  {row.text}
                  {row.label === "Deine Rechte" && (
                    <> — schreib an <a href={`mailto:${s.email}`} style={{ color: "var(--ink)" }} translate="no">{s.email}</a></>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="section-intro" style={{ marginTop: 20, fontSize: 13.5, opacity: .7 }}>{page.protoNote}</p>
        </div>
      </section>
    </div>
  );
}
