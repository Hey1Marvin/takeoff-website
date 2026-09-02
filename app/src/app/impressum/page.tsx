import type { Metadata } from "next";
import { pageContent, settings } from "@/lib/data";
import { LangLock } from "@/components/I18nProvider";

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
    // data-lang-lock: Rechtsseite, bleibt immer Deutsch — Orchestrator
    // liest dieses Attribut beim Verdrahten des DE/EN-Umschalters
    // (siehe prototype/impressum.html Kopfkommentar zu data-lang-lock).
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
            <div className="m-row">
              <dt>Anbieter</dt>
              <dd><b translate="no">{page.provider.name}</b> — {page.provider.legalFormNote} <span style={{ opacity: .6 }}>[Platzhalter]</span></dd>
            </div>
            <div className="m-row">
              <dt>Anschrift</dt>
              <dd>{page.address.line}</dd>
            </div>
            <div className="m-row">
              <dt>Kontakt</dt>
              <dd><a href={`mailto:${s.email}`} style={{ color: "var(--ink)" }} translate="no">{s.email}</a></dd>
            </div>
            <div className="m-row">
              <dt>V. i. S. d. P.</dt>
              <dd>{page.visdp}</dd>
            </div>
          </dl>

          <div className="transmission" style={{ marginTop: 28 }}>
            <span className="tx-label">{page.credits.label}</span>
            <p>{page.credits.text}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
