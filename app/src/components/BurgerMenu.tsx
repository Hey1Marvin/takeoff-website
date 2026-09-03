"use client";
/* Burger-Knopf + Overlay-Menü (<dialog> = Focus-Trap & Escape gratis).
   Links kommen aus dem zentralen Generator (site.ts). */
import { useRef } from "react";
import Link from "next/link";
import { menuLinks, eventHref } from "@/lib/site";
import { useI18n } from "./I18nProvider";
import { formatEventDate, tLabel } from "@/lib/i18n";
import LangSwitch from "./LangSwitch";
import DayToggle from "./DayToggle";

/** `when` ist ein ISO-Datum — die Sprache entscheidet erst beim Rendern. */
interface NextInfo { slug: string; title: string; when: string; where: string }
interface Socials { instagram: string; telegram: string; soundcloud: string; email: string }

export default function BurgerMenu({ next, socials }: { next: NextInfo | null; socials: Socials }) {
  const { t, locale } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        className="nav-burger" type="button" aria-controls="menu"
        aria-label={t("a11y.burger.open")}
        onClick={() => ref.current?.showModal()}
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
          <path className="b-line" d="M2 6h16" /><path className="b-line" d="M2 14h16" />
        </svg>
        <span>{t("menu.label")}</span>
      </button>

      <dialog className="menu" id="menu" aria-label={t("menu.label")} ref={ref}
        onClick={e => { if (e.target === ref.current) ref.current?.close(); }}>
        <div className="menu-inner">
          <p className="menu-eyebrow">{t("menu.eyebrow")}</p>
          <ul className="menu-list">
            {menuLinks().map(l => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => ref.current?.close()}>
                  <span className="m-label">{tLabel(l.key, l.label, locale)}</span>{" "}
                  {l.note && <span className="m-note">{tLabel(l.noteKey, l.note, locale)}</span>}
                </Link>
              </li>
            ))}
          </ul>
          {next && (
            <Link className="menu-next" href={eventHref(next.slug)} onClick={() => ref.current?.close()}>
              <span>
                <span className="mn-when">{t("menu.next.label")} · {formatEventDate(next.when, locale)}</span>
                <span className="mn-title">{next.title}</span>
                <span className="mn-where">{next.where}</span>
              </span>
              <span className="mn-go">{t("menu.go")}</span>
            </Link>
          )}
          {/* Einstellungen im Menue. Auf schmalen Schirmen (<=560px) blendet
              takeoff.css die Kopfzeilen-Varianten von Sprache UND Tag/Nacht aus
              — beide sind ausschliesslich hier erreichbar, damit Burger, Marke
              und Status-Pille oben je ein 44px-Beruehrziel bekommen (der Header
              hatte bei 320-390px null Spielraum, nachgemessen). Auf breiteren
              Schirmen sind sie zusaetzlich oben — dieser Block schadet nie.
              Endonyme (Deutsch/English) statt uebersetzter Labels: in beiden
              Sprachen richtig. */}
          <div className="menu-settings">
            <p className="menu-eyebrow">{t("menu.settings")}</p>
            <div className="menu-set-row">
              <span className="menu-set-label">{t("menu.language")}</span>
              <LangSwitch variant="menu" />
            </div>
            <div className="menu-set-row">
              <span className="menu-set-label">{t("menu.view")}</span>
              <DayToggle />
            </div>
          </div>
          <div className="menu-social">
            <a href={socials.instagram} target="_blank" rel="noopener">Instagram</a>
            <a href={socials.telegram} target="_blank" rel="noopener">Telegram</a>
            <a href={socials.soundcloud} target="_blank" rel="noopener">SoundCloud</a>
            <a href={`mailto:${socials.email}`}>{socials.email}</a>
          </div>
          <button className="menu-close" type="button" onClick={() => ref.current?.close()}>
            {t("menu.close")}
          </button>
        </div>
      </dialog>
    </>
  );
}
