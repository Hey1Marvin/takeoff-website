"use client";
/* Textseite der 404 — Client, weil der Sprachumschalter sie erreichen
   muss. Das Einhorn ist reines SVG und liegt hinter dem Text; seine
   Bewegung steht in der CSS und ist dort an die FX-Stufen gebunden. */
import Link from "next/link";
import { useT } from "@/components/I18nProvider";
import { pageHref } from "@/lib/site";

export default function NotFoundInhalt() {
  const t = useT();

  return (
    <>
      {/* Die Rettungsleine: eine Kurve, an deren Ende das Einhorn haengt.
          Ein Pfad, kein Bild — er skaliert mit und kostet nichts. */}
      {/* Ring und gestrichelte Leine tragen die Komposition allein — das
          Einhorn ist die Pointe, nicht das Geruest. Deshalb ist es als
          Emoji vertretbar: fehlt der Emoji-Font, bleibt ein treibender
          Ring an einer Leine, und das Bild stimmt immer noch. */}
      <div className="nf-drift" aria-hidden="true">
        <svg viewBox="0 0 320 260" fill="none" role="presentation">
          <path className="nf-tether" d="M8 14C64 92 120 34 168 118c30 52 66 44 92 78"
                stroke="currentColor" strokeWidth="1" strokeLinecap="round"
                strokeDasharray="3 7" />
          <g className="nf-horn">
            <circle cx="262" cy="200" r="30" stroke="currentColor" strokeWidth="1" opacity=".45" />
            <text x="262" y="212" textAnchor="middle" fontSize="30"
                  fontFamily="'Noto Color Emoji','Apple Color Emoji','Segoe UI Emoji',sans-serif">🦄</text>
          </g>
        </svg>
      </div>

      <p className="eyebrow">{t("nf.eyebrow")}</p>
      <h1 className="nf-code" translate="no">404</h1>
      <h2 className="h2 nf-title">{t("nf.title")}</h2>
      <p className="section-intro nf-intro">{t("nf.intro")}</p>

      {/* Mission-Log statt Fehlermeldung: dieselbe Mono-Sprache wie das HUD.
          Sagt, was passiert ist, und was man tun kann — keine Entschuldigung. */}
      <dl className="m-rows nf-log">
        <div className="m-row"><dt>{t("nf.log.statusLabel")}</dt><dd>{t("nf.log.statusValue")}</dd></div>
        <div className="m-row"><dt>{t("nf.log.causeLabel")}</dt><dd>{t("nf.log.causeValue")}</dd></div>
        <div className="m-row"><dt>{t("nf.log.nextLabel")}</dt><dd>{t("nf.log.nextValue")}</dd></div>
      </dl>

      <div className="cta-row nf-cta">
        <Link className="btn btn-primary" href="/">{t("nf.back")}</Link>
        <Link className="btn btn-ghost" href={pageHref("events")}>{t("nf.events")}</Link>
        <Link className="btn btn-ghost" href={pageHref("kontakt")}>{t("nf.contact")}</Link>
      </div>
    </>
  );
}
