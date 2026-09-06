import type { Metadata } from "next";
import { pageContent, settings } from "@/lib/data";
import { LangLock } from "@/components/I18nProvider";
import "@/styles/pages/legal.css";

export const metadata: Metadata = {
  title: "Impressum · takeoff potsdam",
  description: "Anbieterkennzeichnung der takeoff-Website.",
};

/* Spiegelt src/data/pages/impressum.json (siehe prototype/impressum.html
   für die 1:1-Referenz). Kein eigener Contract — der Inhalt gehört dieser
   einen Seite (Regel aus ~/.claude/daten-contract.md), Admin bearbeitet
   ihn über die generische Seiten-Formular-Ansicht (page-generic).
   Kontaktangaben kommen bewusst NICHT aus dieser JSON, sondern aus
   settings(), um keine zweite Quelle für dieselbe E-Mail-Adresse zu
   schaffen (Vertrag "Daten NUR über den Gateway"). */
interface ImpressumPageContent {
  hero: { eyebrow: string; h1: string; intro: string };
  provider: { name: string; legalFormNote: string };
  address: { line: string };
  visdp: string;
  credits: { label: string; text: string };
}

export default async function ImpressumPage() {
  const [page, s] = await Promise.all([
    pageContent<ImpressumPageContent>("impressum"),
    settings(),
  ]);
  if (!page) return null;

  return (
    /* Fragment statt eines umschliessenden <div>: der Tagmodus faerbt
       `main > *` ein und nimmt dabei `.hero`/`.ehero` aus. Lag die ganze
       Seite in EINEM div, traf die Regel genau dieses div — die Ausnahme
       lief ins Leere und die helle Platte lag auch ueber dem Hero.
       Die Sprachsperre haengt ohnehin nicht am Markup, sondern an
       <LangLock />, das <html> stempelt. */
    <>
      <LangLock />
      <section className="phero lg-page">
        <div className="wrap">
          <p className="eyebrow">{page.hero.eyebrow}</p>
          <h1>{page.hero.h1}</h1>
          <p className="section-intro">{page.hero.intro}</p>
          {/* Schriftfeld wie auf einer technischen Zeichnung — sagt in einer
              Zeile, was fuer ein Dokument das ist. */}
          <div className="lg-stamp">
            <span>Dok <b translate="no">DOC-01</b></span>
            <span>Geltung <b>takeoff-potsdam.de</b></span>
            <span>Sprache <b>Deutsch</b></span>
          </div>
        </div>
      </section>

      <section className="section lg-page lg-sec">
        <div className="wrap lg-body">
          <dl className="m-rows lg-rows">
            <div className="m-row">
              <dt>Anbieter</dt>
              <dd><b translate="no">{page.provider.name}</b> — {page.provider.legalFormNote} <span className="lg-note">[Platzhalter]</span></dd>
            </div>
            <div className="m-row">
              <dt>Anschrift</dt>
              <dd>{page.address.line}</dd>
            </div>
            <div className="m-row">
              <dt>Kontakt</dt>
              <dd><a href={`mailto:${s.email}`} translate="no">{s.email}</a></dd>
            </div>
            <div className="m-row">
              <dt>V. i. S. d. P.</dt>
              <dd>{page.visdp}</dd>
            </div>
          </dl>

          <div className="transmission lg-tx">
            <span className="tx-label">{page.credits.label}</span>
            <p>{page.credits.text}</p>
          </div>
        </div>
      </section>
    </>
  );
}
