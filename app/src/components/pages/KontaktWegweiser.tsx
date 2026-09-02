"use client";
/* Anliegen-Wegweiser: Themen-Chips bauen live eine Kanal-Empfehlung.
   Portierung von wireTopics()/showReco() aus assets/js/pages/kontakt.js.
   Chips bleiben echte <a href="mailto:…">-/Telegram-Links (kein
   preventDefault) — der Mail-Client bzw. Telegram öffnet ganz normal,
   React aktualisiert nur die Empfehlungskarte daneben.

   Die Radar-Kopplung (Funkkanäle-Sektion, eigene Client-Komponente
   KontaktFunkkanaele) läuft über ein CustomEvent (TOPIC_SELECT_EVENT,
   siehe KontaktFx) statt geteiltem State oder DOM-Querying — die
   Prototyp-Lösung `syncRadarActive()` griff direkt auf die
   .fs-blip-Elemente im DOM zu; hier würde ein React-Re-Render der
   Radar-Komponente diese von außen gesetzte Klasse wieder verwerfen,
   ein Event ist deshalb die robustere Brücke zwischen den beiden Inseln. */
import { useState } from "react";
import Link from "next/link";
import { TOPIC_SELECT_EVENT, type TopicSelectDetail } from "./KontaktFx";

export interface KontaktTopicVM {
  id: string;
  label: string;
  href: string;
  pulse: "mail" | "telegram";
  ch: string;
  text?: string;
  responseNote?: string;
  crossHref?: string;
  crossLabel?: string;
}

const DEFAULT_HINT = "↑ Wähl ein Anliegen — wir zeigen dir den passenden Kanal und die Antwortzeit.";

export default function KontaktWegweiser({ topics }: { topics: KontaktTopicVM[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = topics.find(t => t.id === activeId) ?? null;

  const select = (t: KontaktTopicVM) => {
    setActiveId(t.id);
    window.dispatchEvent(new CustomEvent<TopicSelectDetail>(TOPIC_SELECT_EVENT, { detail: { ch: t.ch } }));
  };

  return (
    <div className="fs-router">
      <div className="chips fs-topics" role="list" aria-label="Anliegen wählen">
        {topics.map(t => (
          <a
            key={t.id}
            className={`chip${activeId === t.id ? " is-active" : ""}`}
            role="listitem"
            data-fs-pulse={t.pulse}
            href={t.href}
            {...(t.pulse === "telegram" ? { target: "_blank", rel: "noopener" } : {})}
            onClick={() => select(t)}
          >
            {t.label}
          </a>
        ))}
      </div>

      <div className="fs-reco transmission" aria-live="polite">
        <span className="tx-label">Empfehlung</span>
        {!active ? (
          <p className="fs-reco-hint">{DEFAULT_HINT}</p>
        ) : (
          <>
            <p className="fs-reco-line">
              <span className="fs-ch-tag">CH-{active.ch}</span>
              Empfehlung: <b>{active.pulse === "telegram" ? "Telegram" : "E-Mail"}</b>
              {active.responseNote ? ` · ${active.responseNote}` : ""}
            </p>
            {active.text && <p className="fs-reco-text">{active.text}</p>}
            <div className="cta-row">
              <a
                className="btn btn-primary"
                data-fs-pulse={active.pulse}
                href={active.href}
                {...(active.pulse === "telegram" ? { target: "_blank", rel: "noopener" } : {})}
              >
                {active.pulse === "telegram" ? "Telegram öffnen" : "Mail öffnen"}
              </a>
              {active.crossHref && (
                <Link className="head-link" href={active.crossHref}>{active.crossLabel || "Mehr dazu"}</Link>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
