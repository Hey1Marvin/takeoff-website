import type { Metadata } from "next";
import { pageContent, settings } from "@/lib/data";
import { LangLock } from "@/components/I18nProvider";
import "@/styles/pages/legal.css";

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
    /* Fragment statt eines umschliessenden <div>: der Tagmodus faerbt
       `main > *` ein und nimmt `.hero`/`.ehero` aus. Lag die ganze Seite in
       EINEM div, traf die Regel genau dieses div, die Ausnahme lief ins
       Leere und die helle Platte lag auch ueber dem Hero. Die Sprachsperre
       haengt an <LangLock />, nicht am Markup. */
    <>
      <LangLock />
      <section className="phero lg-page">
        <div className="wrap">
          <p className="eyebrow">{page.hero.eyebrow}</p>
          <h1>{page.hero.h1}</h1>
          <p className="section-intro">{page.hero.intro}</p>
          <div className="lg-stamp">
            <span>Dok <b translate="no">DOC-02</b></span>
            <span>Tracking <b>keins</b></span>
            <span>Sprache <b>Deutsch</b></span>
          </div>
        </div>
      </section>

      <section className="section lg-page lg-sec">
        <div className="wrap lg-body">
          <dl className="m-rows lg-rows">
            {page.rows.map(row => (
              <div className="m-row" key={row.label}>
                <dt>{row.label}</dt>
                <dd>
                  {row.text}
                  {row.label === "Deine Rechte" && (
                    <> — schreib an <a href={`mailto:${s.email}`} translate="no">{s.email}</a></>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          <p className="lg-note">{page.protoNote}</p>
        </div>
      </section>
    </>
  );
}
