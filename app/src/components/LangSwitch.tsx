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

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "./I18nProvider";
import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

/** "nav" = kompakt (DE/EN) fuer die Kopfleiste,
 *  "menu" = ausgeschrieben (Deutsch/English) fuers Overlay-Menue. */
export type LangSwitchVariant = "nav" | "menu";

const LABELS: Record<LangSwitchVariant, Record<Locale, string>> = {
  nav: { de: "DE", en: "EN" },
  menu: { de: "Deutsch", en: "English" },
};

/* Dieselbe Seite in der anderen Sprache. Deutsch laeuft praefixlos,
   Englisch unter /en/.

   ACHTUNG, hier lag ein Fehler: `usePathname()` liefert den INTERN
   umgeschriebenen Pfad, nicht den aus der Adressleiste. Der Proxy
   schreibt /awareness auf /de/awareness um — die Komponente sieht also
   "/de/awareness", obwohl im Browser "/awareness" steht. Wer nur "/en"
   abschneidet, baut daraus "/en/de/awareness". Deshalb wird JEDES
   bekannte Sprachpraefix entfernt, bevor das neue gesetzt wird. */
export function pfadInSprache(pfad: string, ziel: Locale): string {
  let ohne = pfad;
  for (const l of LOCALES) {
    if (ohne === `/${l}` || ohne.startsWith(`/${l}/`)) {
      ohne = ohne.slice(l.length + 1) || "/";
      break;
    }
  }
  if (ziel === DEFAULT_LOCALE) return ohne;
  return ohne === "/" ? "/en" : `/en${ohne}`;
}

export function LangSwitch({
  variant = "nav",
  className,
}: {
  variant?: LangSwitchVariant;
  className?: string;
}) {
  const { locale, locked, setLocale } = useI18n();
  const pfad = usePathname() || "/";

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
        /* Seit It. 18 ein LINK, kein Knopf mehr. Die Sprache steckt in
           der Adresse, also ist der Wechsel eine Navigation — und damit
           teilbar, per Rechtsklick in einem neuen Tab zu oeffnen und
           fuer Suchmaschinen sichtbar. Als Knopf war er beides nicht.
           `aria-current` statt `aria-pressed`: ein Link wird nicht
           gedrueckt, er ist der aktuelle. */
        <Link
          key={code}
          href={pfadInSprache(pfad, code)}
          /* data-set-lang bleibt im Markup: gleicher Schalter-Vertrag
             wie data-set-fx/data-set-theme, und Styles wie Tests im
             Prototyp greifen darauf zu. */
          data-set-lang={code}
          aria-current={locale === code ? "true" : undefined}
          lang={code}
          translate="no"
          /* Den Wunsch trotzdem merken: er entscheidet nichts an dieser
             Seite (das tut die Adresse), aber spaetere Einstiege ueber
             die Startseite koennen ihn auswerten. */
          onClick={() => setLocale(code)}
        >
          {LABELS[variant][code]}
        </Link>
      ))}
    </div>
  );
}

export default LangSwitch;
