"use client";
/* Signatur-Motiv "Bodenstation Potsdam", Teil 2 von 2: die KONSOLE.

   Bis It. 13 war das hier nur "Radar links, Liste rechts" — eine hübsche
   Scheibe, die nichts anzeigte, und daneben sieben Zeilen. Seit It. 14 ist
   es ein Instrument: Radarscheibe + Stationsanzeige stehen als eine
   klebende Instrumentensäule (.fs-instr) in der rechten Spalte der Seite,
   die Kanalliste läuft links daneben. Die Anzeige nennt Rufzeichen,
   Position, Lokalzeit, den gerade angepeilten Kanal und den Sendestatus.
   Damit hat die rechte Bildschirmhälfte einen Gegenstand, statt leer zu
   sein — der eigentliche Befund des Design-Audits für diese Seite.

   Die Aufteilung auf die Seitenspalten macht CSS, nicht dieses Modul:
   `.fs-funk` ist `display: contents` (kontakt.css), .fs-instr und
   .fs-channels sind dadurch direkte Raster-Elemente der Konsole und
   können in getrennten Spalten liegen, ohne dass hier ein zweiter
   Layout-Container entsteht.

   Zeilen-Hover/-Focus hebt den passenden Blip hervor (Portierung von
   wireHighlightSync() aus kontakt.js, hier als lokaler React-State).
   Ein Themen-Chip-Klick in der Wegweiser-Insel markiert zusätzlich per
   CustomEvent einen Blip als "sticky" aktiv (TOPIC_SELECT_EVENT), und ein
   Klick auf irgendeinen Mail-/Telegram-Knopf lässt die Scheibe im selben
   Moment wie die Dachantenne pingen (SEND_PULSE_EVENT) — das ist der EINE
   orchestrierte Bewegungsmoment dieser Seite, und er läuft nur auf
   Handlung, nie von selbst. */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import KontaktClock from "./KontaktClock";
import {
  fxOn,
  TOPIC_SELECT_EVENT, type TopicSelectDetail,
  SEND_PULSE_EVENT, type SendPulseDetail,
} from "./KontaktFx";

export interface KontaktChannelVM {
  ch: string;
  label: string;
  text?: string;
  action: ReactNode;
  calm: boolean;
}

/* Beschriftungen + feste Werte der Stationsanzeige — kommen aus
   src/data/pages/kontakt.json (station.readout), nicht aus dem Code. */
export interface KontaktReadoutVM {
  title: string;
  callsignLabel: string;
  callsign: string;
  positionLabel: string;
  position: string;
  timeLabel: string;
  statusLabel: string;
  statusIdle: string;
  statusSending: string;
  channelLabel: string;
  channelIdle: string;
}

/* So lange steht "Signal unterwegs" in der Anzeige. Deckt die 3 Ping-Ringe
   (1.15s + 2 * .22s Versatz) mit etwas Luft ab. */
const SENDING_MS = 1800;

export default function KontaktFunkkanaele({
  channels, readout,
}: {
  channels: KontaktChannelVM[];
  readout: KontaktReadoutVM;
}) {
  const radarRef = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  const [hoverCh, setHoverCh] = useState<string | null>(null);
  const [stickyCh, setStickyCh] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const activeCh = hoverCh ?? stickyCh;
  const activeChannel = activeCh ? channels.find(c => c.ch === activeCh) : undefined;

  /* Blip-Einflug: nur wenn fx erlaubt ist, sonst sofort sichtbar (Tier s /
     kein IntersectionObserver = Grundzustand, siehe fs-blip-in in
     kontakt.css — gleiches "Fallback zuerst"-Prinzip wie .reveal). */
  useEffect(() => {
    const el = radarRef.current;
    if (!el || !fxOn() || !("IntersectionObserver" in window)) {
      setEntered(true);
      return;
    }
    const io = new IntersectionObserver(
      entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        setEntered(true);
      }),
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* Radar-Kopplung von der Wegweiser-Sektion aus (anderes Client-Modul). */
  useEffect(() => {
    const onSelect = (e: Event) => {
      const ch = (e as CustomEvent<TopicSelectDetail>).detail?.ch;
      if (ch) setStickyCh(ch);
    };
    window.addEventListener(TOPIC_SELECT_EVENT, onSelect);
    return () => window.removeEventListener(TOPIC_SELECT_EVENT, onSelect);
  }, []);

  /* Sende-Puls: dieselbe Handlung, die an der Dachantenne die Ringe
     auslöst, lässt hier die Scheibe pingen und die Statuszeile umspringen.
     Die Textänderung läuft auch bei Tier s / reduzierter Bewegung — sie IST
     die Rückmeldung; nur die Ringe sind in kontakt.css FX-gegatet. */
  useEffect(() => {
    let id: ReturnType<typeof setTimeout> | undefined;
    const onPulse = (e: Event) => {
      const detail = (e as CustomEvent<SendPulseDetail>).detail;
      if (!detail) return;
      setSending(false);
      // Neustart erzwingen, falls zweimal hintereinander geklickt wird.
      requestAnimationFrame(() => setSending(true));
      clearTimeout(id);
      id = setTimeout(() => setSending(false), SENDING_MS);
    };
    window.addEventListener(SEND_PULSE_EVENT, onPulse);
    return () => { window.removeEventListener(SEND_PULSE_EVENT, onPulse); clearTimeout(id); };
  }, []);

  return (
    <div className="fs-funk">
      <div className={`fs-instr${sending ? " is-sending" : ""}`}>
        <p className="fs-instr-title">{readout.title}</p>

        <div className="fs-radar" aria-hidden="true" ref={radarRef}>
          <svg className="fs-radar-face" viewBox="0 0 220 220">
            <circle cx="110" cy="110" r="96" className="fs-ring" />
            <circle cx="110" cy="110" r="64" className="fs-ring" />
            <circle cx="110" cy="110" r="32" className="fs-ring" />
            <line x1="14" y1="110" x2="206" y2="110" className="fs-cross" />
            <line x1="110" y1="14" x2="110" y2="206" className="fs-cross" />
            {/* Sende-Ping: zwei Ringe, die nach außen laufen — dieselbe
                Choreografie wie an der Dachantenne, damit der Klick an
                beiden Enden des Motivs dasselbe tut. */}
            <circle cx="110" cy="110" r="8" className="fs-radar-ping" style={{ "--i": 0 } as CSSProperties} />
            <circle cx="110" cy="110" r="8" className="fs-radar-ping" style={{ "--i": 1 } as CSSProperties} />
          </svg>
          <div className="fs-sweep" />
          <div className="fs-blips">
            {channels.map((c, i) => {
              const isActive = activeCh === c.ch;
              return (
                <span
                  key={c.ch}
                  className={`fs-blip${entered ? " fs-blip-in" : ""}${isActive ? " is-active" : ""}`}
                  data-ch={c.ch}
                  style={{
                    "--ang": `${(360 / channels.length * i).toFixed(1)}deg`,
                    "--fs-blip-delay": `${i * 60}ms`,
                  } as CSSProperties}
                />
              );
            })}
          </div>
        </div>

        <dl className="m-rows fs-readout">
          <div className="m-row">
            <dt>{readout.callsignLabel}</dt>
            <dd>{readout.callsign}</dd>
          </div>
          <div className="m-row">
            <dt>{readout.positionLabel}</dt>
            <dd className="fs-num">{readout.position}</dd>
          </div>
          <div className="m-row">
            <dt>{readout.timeLabel}</dt>
            <dd className="fs-num"><KontaktClock /> Uhr</dd>
          </div>
          <div className="m-row">
            <dt>{readout.channelLabel}</dt>
            <dd>
              {activeChannel
                ? <><span className="fs-ch-tag">CH-{activeChannel.ch}</span>{activeChannel.label}</>
                : readout.channelIdle}
            </dd>
          </div>
          <div className="m-row">
            <dt>{readout.statusLabel}</dt>
            {/* Bewusst KEIN aria-live: den Sende-Puls meldet bereits der
                Toast in KontaktBodenstation. Zwei Live-Regionen zur selben
                Handlung lesen Screenreader doppelt vor. */}
            <dd className="fs-instr-status">
              <span className="fs-dot" aria-hidden="true" />
              {sending ? readout.statusSending : readout.statusIdle}
            </dd>
          </div>
        </dl>
      </div>

      <dl className="m-rows fs-channels" aria-label="Funkkanäle — Kontaktwege">
        {channels.map(c => (
          <div
            key={c.ch}
            className={`m-row fs-ch-row${c.calm ? " fs-ch-calm" : ""}${activeCh === c.ch ? " is-active" : ""}`}
            data-ch={c.ch}
            onMouseEnter={() => setHoverCh(c.ch)}
            onMouseLeave={() => setHoverCh(null)}
            onFocus={() => setHoverCh(c.ch)}
            onBlur={() => setHoverCh(null)}
          >
            <dt><span className="fs-ch-tag">CH-{c.ch}</span> {c.label}</dt>
            <dd>
              {c.text ? `${c.text} ` : ""}
              {c.action}
              {!c.calm && (
                <span className="fs-sig" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
