"use client";
/* Footer — Darstellung. Daten kommen als Props aus Footer.tsx (Server),
   damit die Sprachumschaltung ohne Reload greift. */
import Link from "next/link";
import { footerLinks } from "@/lib/site";
import { useI18n } from "./I18nProvider";
import { tLabel } from "@/lib/i18n";

export interface FooterViewProps {
  social: { instagram: string; telegram: string; soundcloud: string; tiktok: string; email: string };
}

export default function FooterView({ social: s }: FooterViewProps) {
  const { t, locale } = useI18n();
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <h4>Kanäle</h4>
            <ul>
              <li><a href={s.instagram} target="_blank" rel="noopener">Instagram ↗</a></li>
              <li><a href={s.telegram} target="_blank" rel="noopener">Telegram ↗</a></li>
              <li><a href={s.soundcloud} target="_blank" rel="noopener">SoundCloud ↗</a></li>
              <li><a href={s.tiktok} target="_blank" rel="noopener">TikTok ↗</a></li>
            </ul>
          </div>
          <div>
            <h4>Kollektiv</h4>
            <ul>
              {footerLinks("kollektiv").map(l => (
                <li key={l.href}><Link href={l.href}>{tLabel(l.key, l.label, locale)}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Kontakt</h4>
            <ul>
              {footerLinks("kontakt").map(l => (
                <li key={l.href}><Link href={l.href}>{tLabel(l.key, l.label, locale)}</Link></li>
              ))}
              <li><a href={`mailto:${s.email}`}>{s.email}</a></li>
            </ul>
            <p className="no-track">{t("footer.no_track")}</p>
          </div>
        </div>
        <p className="love">{t("footer.love")} <b>♥</b></p>
        <p className="proto-note">{t("footer.proto_note")}</p>
      </div>
    </footer>
  );
}
