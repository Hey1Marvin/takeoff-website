"use client";
/* Funkkanäle: Radar-Dial (ein Blip pro Kanal) + Kanal-Liste als zwei
   Ansichten derselben Daten (channels-Prop, serverseitig aus
   pageContent("kontakt") gebaut). Zeilen-Hover/-Focus hebt den passenden
   Blip hervor — Portierung von wireHighlightSync() aus kontakt.js, hier
   als lokaler React-State statt DOM-Klassen (beide Ansichten sind
   Geschwister im selben Baum, ein Ref-Umweg über den DOM ist unnötig).
   Ein Themen-Chip-Klick in der Wegweiser-Sektion (andere Client-Insel)
   markiert zusätzlich per CustomEvent einen Blip als "sticky" aktiv —
   siehe KontaktWegweiser/KontaktFx.

   Sweep/Scan/Idle-Puls der Dish laufen komplett über reines, Tier-gatetes
   CSS (kontakt.css). Hier steckt nur der einmalige Blip-Einflug beim
   ersten Sichtbarwerden — Portierung des GSAP-Teils aus buildMotionFX(),
   hier ohne GSAP als CSS-Transition (gleiches Muster wie KollektivRig). */
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { fxOn, TOPIC_SELECT_EVENT, type TopicSelectDetail } from "./KontaktFx";

export interface KontaktChannelVM {
  ch: string;
  label: string;
  text?: string;
  action: ReactNode;
  calm: boolean;
}

export default function KontaktFunkkanaele({ channels }: { channels: KontaktChannelVM[] }) {
  const radarRef = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  const [hoverCh, setHoverCh] = useState<string | null>(null);
  const [stickyCh, setStickyCh] = useState<string | null>(null);

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

  return (
    <div className="fs-funk">
      <div className="fs-radar" aria-hidden="true" ref={radarRef}>
        <svg className="fs-radar-face" viewBox="0 0 220 220">
          <circle cx="110" cy="110" r="96" className="fs-ring" />
          <circle cx="110" cy="110" r="64" className="fs-ring" />
          <circle cx="110" cy="110" r="32" className="fs-ring" />
          <line x1="14" y1="110" x2="206" y2="110" className="fs-cross" />
          <line x1="110" y1="14" x2="110" y2="206" className="fs-cross" />
        </svg>
        <div className="fs-sweep" />
        <div className="fs-blips">
          {channels.map((c, i) => {
            const isActive = hoverCh === c.ch || stickyCh === c.ch;
            return (
              <span
                key={c.ch}
                className={`fs-blip${entered ? " fs-blip-in" : ""}${isActive ? " is-active" : ""}`}
                data-ch={c.ch}
                style={{
                  "--ang": `${(360 / channels.length * i).toFixed(1)}deg`,
                  "--dl": `${(i * 0.15).toFixed(2)}s`,
                  "--fs-blip-delay": `${i * 60}ms`,
                } as CSSProperties}
              />
            );
          })}
        </div>
      </div>

      <dl className="m-rows fs-channels" aria-label="Funkkanäle — Kontaktwege" style={{ borderTop: "1px solid var(--bg-hairline)" }}>
        {channels.map(c => (
          <div
            key={c.ch}
            className={`m-row fs-ch-row${c.calm ? " fs-ch-calm" : ""}`}
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
