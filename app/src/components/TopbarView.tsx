"use client";
/* Die Darstellung der Kopfleiste.

   Getrennt von Topbar.tsx, weil die Sprachumschaltung ohne Reload laufen
   soll: jeder uebersetzte Text — auch in aria-Attributen — muss dafuer in
   einer Client-Komponente stehen. Die Daten holt weiterhin die Server-
   Komponente und reicht sie als Props herein (Standardmuster: Server holt,
   Client stellt dar). */
import Link from "next/link";
import { useI18n } from "./I18nProvider";
import { formatEventDate } from "@/lib/i18n";
import NavLinks from "./NavLinks";
import BurgerMenu from "./BurgerMenu";
import ProgressRocket from "./ProgressRocket";
import LangSwitch from "./LangSwitch";
import DayToggle from "./DayToggle";

export interface TopbarViewProps {
  ticker: string[];
  telegram: string;
  /** `date` und `burgerNext.when` sind ISO-Daten — die Sprache entscheidet erst hier. */
  status: { href: string; tag: string; date: string } | null;
  burgerNext: { slug: string; title: string; when: string; where: string } | null;
  socials: { instagram: string; telegram: string; soundcloud: string; email: string };
}

export default function TopbarView({ ticker, telegram, status, burgerNext, socials }: TopbarViewProps) {
  const { t, locale } = useI18n();
  return (
    <div className="topbar" role="banner">
      <div className="hud">
        <span className="dot" aria-hidden="true" />
        <div className="marquee" aria-label={t("a11y.marquee.events")}>
          <div className="marquee-track">
            {ticker.map((tx, i) => <span key={i}>{tx}</span>)}
          </div>
        </div>
        <a className="hud-link" href={telegram} target="_blank" rel="noopener">{t("topbar.hud.telegram")}</a>
      </div>
      <header className="nav">
        <Link className="nav-brand" href="/" aria-label={t("a11y.brand")}>takeoff</Link>
        <NavLinks />
        {/* Dehnfuge: traegt frueher .nav-links das flex:1, klebte ab 900px
            (wo die Liste ausgeblendet wird) alles links. */}
        <span className="nav-gap" aria-hidden="true" />
        {status && (
          <Link className="nav-status" href={status.href}>
            <span className="st-tag">{status.tag}</span>
            <span className="st-date">{formatEventDate(status.date, locale)}</span>
          </Link>
        )}
        <LangSwitch variant="nav" />
        <DayToggle />
        <BurgerMenu next={burgerNext} socials={socials} />
      </header>
      <ProgressRocket />
    </div>
  );
}
