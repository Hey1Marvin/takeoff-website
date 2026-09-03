"use client";
/* ============================================================
   MediaPlayer — ein Clip, gross, auf der Seite, mit Vollbild

   ── Warum eine Bibliothek und nicht wieder selbst ──────────
   Die eigene Loesung konnte genau das nicht, was verlangt war:
   `controls={false}` in der Kachel, kein Spulen, kein Ton-Regler, kein
   Vollbild. Und die Teile, die dabei fehlen, sind genau die teuren:
   Vollbild ueber Safari/iOS hinweg (dort kann NUR das <video> selbst
   ins Vollbild, nicht sein Rahmen), Tastaturbedienung, ARIA-Rollen an
   Schiebereglern, Zeitformatierung, Pufferanzeige.

   Genommen: `media-chrome` (Mux, MIT). Gepruefte Gruende —
   · Es ist eine Sammlung von Web Components OHNE mitgeliefertes
     Aussehen: jeder Knopf ist ein leeres Gehaeuse, das sein Icon aus
     einem Slot bezieht und sich mit normalem CSS gestalten laesst.
     Ein fertig geskinnter Player (Plyr, Video.js) haette hier ein
     zweites, fremdes Design neben das Space-System gestellt.
   · Es bringt keine Laufzeit-Requests mit — alles wird gebuendelt.
     Das ist Bedingung, nicht Vorliebe (CLAUDE.md §6).
   · Es wird gepflegt (4.19.2, August 2026) und ist eines der drei
     Projekte, aus denen gerade Video.js v10 entsteht. Plyr 3.8 zieht
     dagegen core-js und drei Polyfills mit, Vidstack steht seit Juni
     bei 0.6.x, Video.js v10 ist Alpha.

   Der <media-controller> ist zugleich das Wurzelelement fuers Vollbild.
   Deshalb bleibt unsere eigene Leiste im Vollbild sichtbar — bei einem
   `video.requestFullscreen()` waere sie weg und man saehe die nackten
   Browser-Bedienelemente.

   ── Ton ───────────────────────────────────────────────────
   Clips mit `ton: true` starten hoerbar. Das darf man hier, weil ein
   Klick vorausgegangen ist (ohne Geste blockt jeder Browser). Clips
   ohne hoerenswerten Ton starten stumm und zeigen keinen Ton-Knopf.
   ============================================================ */
import {
  MediaControlBar,
  MediaController,
  MediaFullscreenButton,
  MediaLoadingIndicator,
  MediaMuteButton,
  MediaPlayButton,
  MediaTimeDisplay,
  MediaTimeRange,
} from "media-chrome/react";
import type { MediaItem } from "@/lib/types";
import { useT } from "@/components/I18nProvider";
import "@/styles/embeds.css";

/* Die Icons folgen der Strichstaerke der uebrigen Seite (1.6, runde
   Enden) — dieselbe Handschrift wie in MissionControl und der
   Kopfleiste. media-chrome erwartet sie in benannten Slots. */
const ICON = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const PlayIcon = () => <svg {...ICON} fill="currentColor" stroke="none"><path d="M8 5.2v13.6L19 12z" /></svg>;
const PauseIcon = () => <svg {...ICON} fill="currentColor" stroke="none"><path d="M7.5 5h3.2v14H7.5zM13.3 5h3.2v14h-3.2z" /></svg>;
const MutedIcon = () => <svg {...ICON}><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" /><path d="M16.5 9.5l4 5M20.5 9.5l-4 5" /></svg>;
const SoundIcon = () => <svg {...ICON}><path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" /><path d="M15.5 9.2a4 4 0 0 1 0 5.6M18 7a7.5 7.5 0 0 1 0 10" /></svg>;
const EnterFsIcon = () => <svg {...ICON}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>;
const ExitFsIcon = () => <svg {...ICON}><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>;

export default function MediaPlayer({
  item,
  autoPlay = false,
  className,
}: {
  item: MediaItem;
  /** Nach einem Klick auf die Kachel: sofort loslegen. */
  autoPlay?: boolean;
  className?: string;
}) {
  const t = useT();

  return (
    <MediaController
      className={`tp${className ? " " + className : ""}`}
      data-orientation={item.orientation}
      /* Die Leiste erst nach kurzer Ruhe ausblenden — bei 8s-Clips ist
         Wegblenden nach 2s reine Zappelei. */
      autohide="3"
    >
      <video
        slot="media"
        src={item.src}
        poster={item.poster}
        playsInline
        preload="metadata"
        muted={!item.ton}
        autoPlay={autoPlay}
        loop={item.dauer <= 12}
      />

      <MediaLoadingIndicator slot="centered-chrome" noAutohide />

      <MediaControlBar className="tp-bar">
        <MediaPlayButton className="tp-btn" aria-label={t("player.play")}>
          <span slot="play"><PlayIcon /></span>
          <span slot="pause"><PauseIcon /></span>
        </MediaPlayButton>

        <MediaTimeRange className="tp-range" />
        <MediaTimeDisplay className="tp-time" showDuration />

        {/* Nur wo es etwas zu hoeren gibt. Ein Ton-Knopf an einem
            tonlosen Clip ist ein Versprechen, das der Clip nicht haelt. */}
        {item.ton && (
          <MediaMuteButton className="tp-btn" aria-label={t("player.sound")}>
            <span slot="off"><MutedIcon /></span>
            <span slot="low"><SoundIcon /></span>
            <span slot="medium"><SoundIcon /></span>
            <span slot="high"><SoundIcon /></span>
          </MediaMuteButton>
        )}

        <MediaFullscreenButton className="tp-btn" aria-label={t("player.fullscreen")}>
          <span slot="enter"><EnterFsIcon /></span>
          <span slot="exit"><ExitFsIcon /></span>
        </MediaFullscreenButton>
      </MediaControlBar>
    </MediaController>
  );
}
