"use client";
/* ============================================================
   ArtistsSetCard — Set/Podcast von SoundCloud oder YouTube

   ── Die zwei Zustaende ─────────────────────────────────────
   ohne Zustimmung : eine gestaltete Flaeche, die SAGT, was passiert —
                     Plattform-Zeichen, Titel, ein Satz, der Hinweis auf
                     die Ruecknahme, ein Knopf und ein Ausweichlink.
                     Bis hierhin geht KEIN Byte nach draussen.
   mit Zustimmung  : der Player ist einfach DA. Kein Knopf mehr, kein
                     Zwischenschritt — man sieht die Wellenform bzw. das
                     Vorschaubild der Plattform und drueckt dort auf
                     Abspielen. Auch auf jeder weiteren Seite, ohne
                     erneut zu fragen.

   ── Warum das der springende Punkt ist ────────────────────
   Vorher galt die Zustimmung zwar projektweit, aber jede Karte wollte
   trotzdem noch einen eigenen Klick, bevor sie ueberhaupt etwas zeigte.
   Auf einer Event-Seite mit zehn Sets waren das zehn Klicks fuer eine
   Frage, die laengst beantwortet war. Wer zugestimmt hat, hat dem
   Laden zugestimmt — nicht dem Klicken.

   Abgespielt wird deshalb trotzdem nichts von allein: der Player laedt
   mit `auto_play=false`. Zehn Sets, die beim Scrollen gleichzeitig
   losspielen, waere die andere Art, es falsch zu machen. Nur der Klick
   aus der Fassade heraus ("Zustimmen und abspielen") startet sofort —
   dort hat man es ausdruecklich verlangt.

   `loading="lazy"` haelt die Karten unterhalb des Sichtfelds
   zurueck, bis man hinscrollt.

   ── Vollbild ──────────────────────────────────────────────
   Dem <iframe> fehlten `allowFullScreen` UND das `fullscreen`-Token in
   `allow`. YouTube blendet seinen Vollbild-Knopf nur ein, wenn BEIDES
   da ist — der Knopf fehlte also nicht wegen YouTube, sondern wegen uns.
   ============================================================ */
import { useState } from "react";
import type { MediaSet } from "@/lib/types";
import { useT } from "@/components/I18nProvider";
import {
  PlatformLogo,
  dienstName,
  useEmbedConsent,
  zustimmen,
  type EmbedPlatform,
} from "@/components/EmbedConsent";
import "@/styles/embeds.css";

export interface SetCardData {
  id: string;
  title: string;
  meta: string;
  /** Ohne Quelle bleibt es bei der reinen Fassade (wie bisher). */
  quelle?: Pick<MediaSet, "platform" | "id" | "url">;
}

/* Beide Einbettungen laufen ueber die datensparsame Variante:
   youtube-nocookie setzt vor dem Abspielen keine Werbe-Cookies, der
   SoundCloud-Player laeuft ohne verwandte Titel und ohne Kommentare. */
function playerSrc(q: NonNullable<SetCardData["quelle"]>, autoplay: boolean): string {
  if (q.platform === "youtube") {
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(q.id)}`
      + `?rel=0&modestbranding=1&playsinline=1&autoplay=${autoplay ? 1 : 0}`;
  }
  /* `visual=true` statt der flachen Wellenform: der kompakte Player ist
     ein WEISSER Kasten und schlaegt im Nachthimmel aus wie ein Loch.
     Die visuelle Variante legt die Wellenform ueber das Track-Artwork —
     dunkel, und dieselbe Bildsprache wie die YouTube-Vorschauen daneben.
     Sie braucht Breite, deshalb steht `.setgrid` auf 300px Grundspalte. */
  const track = encodeURIComponent(q.url);
  return `https://w.soundcloud.com/player/?url=${track}`
    + `&auto_play=${autoplay ? "true" : "false"}&hide_related=true&show_comments=false`
    + `&show_reposts=false&show_teaser=false&show_user=false&visual=true&color=%23e04fb4`;
}

export default function ArtistsSetCard({
  data,
  highlighted = false,
  consentText,
  ariaLabel,
}: {
  data: SetCardData;
  highlighted?: boolean;
  /** Fallback-Text fuer Karten ganz ohne Quelle (reine Platzhalter). */
  consentText?: string;
  ariaLabel: string;
}) {
  const t = useT();
  const zugestimmt = useEmbedConsent();
  /* Nur fuer den einen Fall "gerade eben aus der Fassade heraus
     zugestimmt" — dann soll es sofort losgehen. Sonst laedt der Player
     still. */
  const [sofort, setSofort] = useState(false);

  const q = data.quelle;
  const platform: EmbedPlatform = q?.platform === "youtube" ? "youtube" : "soundcloud";
  const dienst = dienstName(q?.platform);

  /* Zugestimmt und eine Quelle da: der Player IST die Karte.
     `zugestimmt` steht in der Bedingung, nicht nur im ersten Rendern —
     wer die Zustimmung in Mission Control zuruecknimmt, ist das iframe
     sofort los. Ohne diese Abfrage bliebe es stehen und die Ruecknahme
     waere eine Behauptung. */
  if (zugestimmt && q) {
    return (
      <div
        id={`set-${data.id}`}
        className={`setcard setcard--player is-playing${highlighted ? " hit" : ""}`}
      >
        <iframe
          className="set-player"
          src={playerSrc(q, sofort)}
          title={data.title}
          loading="lazy"
          /* `fullscreen` im allow-Token UND allowFullScreen: erst beides
             zusammen zeigt YouTube seinen Vollbild-Knopf. */
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        />
        <span className="s-meta">
          <b>{data.title}</b>
          <span>{data.meta} · {dienst}</span>
        </span>
      </div>
    );
  }

  return (
    <article
      id={`set-${data.id}`}
      className={`setcard setcard--facade${highlighted ? " hit" : ""}`}
    >
      <div className="ec-head">
        {q && <PlatformLogo platform={platform} />}
        <span className="ec-service">{q ? dienst : t("embed.consent.title")}</span>
      </div>

      <div className="ec-titles">
        <b className="ec-title">{data.title}</b>
        <span className="ec-meta">{data.meta}</span>
      </div>

      {!q ? (
        /* Platzhalter-Karte ohne hinterlegte Quelle: nur der Hinweis,
           nichts zum Klicken. So war es vorher auch. */
        <p className="ec-body">{consentText ?? t("embed.consent.body", { dienst })}</p>
      ) : (
        <>
          <p className="ec-body">{t("embed.consent.body", { dienst })}</p>
          <p className="ec-remember">{t("embed.consent.remember")}</p>
          <div className="ec-actions">
            <button
              type="button"
              className="ec-accept"
              aria-label={ariaLabel}
              onClick={() => { setSofort(true); zustimmen(); }}
            >
              <span className="ec-accept-icon" aria-hidden="true">▶</span>
              {t("embed.consent.accept")}
            </button>
            {/* Ein normaler Link — er laedt nichts nach, er geht weg. */}
            <a className="ec-alt" href={q.url} target="_blank" rel="noopener noreferrer">
              {t("embed.consent.open", { dienst })}
            </a>
          </div>
        </>
      )}
    </article>
  );
}
