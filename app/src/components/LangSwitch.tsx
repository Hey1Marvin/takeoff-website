"use client";

/* ============================================================
   DE/EN-Umschalter.

   Markup-Vertrag 1:1 aus dem Prototyp (prototype/index.html
   Z. 118–121 fuer die Kopfleiste, Z. 253–256 fuer das Overlay-
   Menue): ein role="group" mit zwei Buttons, Zustand ueber
   aria-pressed, jeder Button traegt sein eigenes lang-Attribut
   und translate="no".

   Warum lang + translate="no" auf den Buttons:
   "EN"/"English" ist englischer Text auf einer deutschen Seite —
   ohne lang liest der Screenreader ihn deutsch vor. Und die
   Browser-Uebersetzung darf ausgerechnet den Sprachumschalter
   nicht umbenennen, sonst steht dort zweimal dasselbe.

   Warum in Kopfleiste UND Menue: es ist eine Besucherfunktion,
   kein Einstellungsdetail — deshalb sichtbar und nicht im
   Mission-Control-Panel versteckt.

   Die Klassennamen .nav-lang und .menu-lang kommen aus dem
   Prototyp-CSS (prototype/assets/css/style.css ab Z. 2829) und
   muessen beim Verdrahten nach app/src/styles/takeoff.css
   portiert werden — dort stehen sie noch nicht.
   ============================================================ */

/* Import mit explizitem "/index": solange die alte Datei
   src/lib/i18n.ts noch daneben liegt, gewinnt sie bei
   "@/lib/i18n" die Modulaufloesung. Sobald der Orchestrator sie
   entfernt hat, kann das "/index" hier weg. */
import { useI18n } from "./I18nProvider";
import { LOCALES, type Locale } from "@/lib/i18n";

/** "nav" = kompakt (DE/EN) fuer die Kopfleiste,
 *  "menu" = ausgeschrieben (Deutsch/English) fuers Overlay-Menue. */
export type LangSwitchVariant = "nav" | "menu";

const LABELS: Record<LangSwitchVariant, Record<Locale, string>> = {
  nav: { de: "DE", en: "EN" },
  menu: { de: "Deutsch", en: "English" },
};

export function LangSwitch({
  variant = "nav",
  className,
}: {
  variant?: LangSwitchVariant;
  className?: string;
}) {
  const { locale, locked, setLocale } = useI18n();

  /* Zweisprachiges aria-label, wie im Prototyp: der Umschalter
     wird von beiden Seiten aus gesucht, und ein Label in nur
     einer Sprache hilft immer nur der Haelfte. */
  const groupLabel = "Sprache / Language";

  return (
    <div
      className={[variant === "nav" ? "nav-lang" : "menu-lang", className]
        .filter(Boolean)
        .join(" ")}
      role="group"
      aria-label={groupLabel}
      /* Rechtstexte bleiben deutsch — die Gruppe verschwindet ueber
         :root[data-lang-lock] ohnehin per CSS; das hier ist der
         Gurt zum Hosentraeger, falls die Regel mal fehlt. */
      hidden={locked || undefined}
    >
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          /* data-set-lang bleibt im Markup: gleicher Schalter-Vertrag
             wie data-set-fx/data-set-theme, und Styles wie Tests im
             Prototyp greifen darauf zu. */
          data-set-lang={code}
          aria-pressed={locale === code}
          lang={code}
          translate="no"
          disabled={locked || undefined}
          onClick={() => setLocale(code)}
        >
          {LABELS[variant][code]}
        </button>
      ))}
    </div>
  );
}

export default LangSwitch;
