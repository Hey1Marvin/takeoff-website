"use client";
/* Ebene 2 des Bauplan-Signaturmotivs: die Flightlog-Massline zeichnet sich
   beim Scrollen (--bp-flog-p 0→1, siehe #bp-logbuch::before in
   kollektiv.css — die ID heisst absichtlich seitenspezifisch, siehe dort).
   Tier s/reduced-motion: sofort voll gezeichnet — CSS-Fallback
   var(--bp-flog-p, 1), hier zusätzlich explizit gesetzt für den Fall eines
   Live-Downgrades von m/l auf s. Rendert zugleich die Logbuch-Liste aus
   history() (Gateway) — Stückliste-Tags (SPEC_TAGS) sind reine Bauplan-
   Beschriftung ohne eigenes Datenfeld, identisch zu kollektiv.js. */
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { HistoryEntry } from "@/lib/types";
import { clamp01, fxOn, rafThrottle } from "./KollektivFx";
import { pageHref } from "@/lib/site";

const SPEC_TAGS: Record<string, string> = {
  T0: "GRÜNDUNG",
  S1: "1× SUB",
  S2: "+2 TOP",
  S3: "2× SUB",
  L1: "DMX · 512CH",
  "▲": "LIVE",
};

export default function KollektivHistory({ history, tail, tailLink }: {
  history: HistoryEntry[];
  /* Schlusssatz der letzten Zeile, mit {link}-Platzhalter. Stand vorher als
     deutscher Text im JSX; Redaktionstext gehoert in die Datenschicht
     (src/data/pages/kollektiv.json). */
  tail: string;
  tailLink: string;
}) {
  const ref = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = document.documentElement;
    let active = false;

    const update = rafThrottle(() => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const span = vh * 0.13 + rect.height;
      const p = span > 0 ? clamp01((vh * 0.78 - rect.top) / span) : 1;
      el.style.setProperty("--bp-flog-p", String(p));
    });

    const apply = () => {
      if (fxOn()) {
        if (!active) {
          active = true;
          addEventListener("scroll", update, { passive: true });
          addEventListener("resize", update, { passive: true });
        }
        update();
      } else {
        if (active) {
          active = false;
          removeEventListener("scroll", update);
          removeEventListener("resize", update);
          update.cancel();
        }
        el.style.setProperty("--bp-flog-p", "1");
      }
    };

    apply();
    const onVisibility = () => { if (!document.hidden) update(); };
    document.addEventListener("visibilitychange", onVisibility);
    const mo = new MutationObserver(apply);
    mo.observe(html, { attributes: true, attributeFilter: ["data-fx"] });

    return () => {
      removeEventListener("scroll", update);
      removeEventListener("resize", update);
      document.removeEventListener("visibilitychange", onVisibility);
      mo.disconnect();
      update.cancel();
    };
  }, []);

  const lastIdx = history.length - 1;

  return (
    <ul className="flog" id="bp-logbuch" ref={ref}>
      {history.map((entry, i) => (
        <li key={`${entry.patch}-${entry.date}`}>
          {/* .txplate (takeoff.css, geteilte Utility seit It. 14): enge
              Traegerflaeche direkt am Text statt einer Vollflaechen-Box
              hinter der ganzen Liste — gleiches Muster wie events-flog
              (EventsFlightLog.tsx). Nur .fdate/.fname/.fvenue/.fnote, nicht
              .fpatch (eigener Kreis-Hintergrund) oder .bp-dim (eigenes
              Badge). */}
          <span className="fpatch" aria-hidden="true">{entry.patch}</span>
          <span className="fdate txplate">{entry.date}</span>
          <span className="fname txplate">{entry.name}</span>
          <span className="fvenue txplate">{entry.venue}</span>
          {SPEC_TAGS[entry.patch] && (
            <span className="bp-dim" aria-hidden="true">{SPEC_TAGS[entry.patch]}</span>
          )}
          <span className="fnote">
            <span className="txplate">
              {entry.note}
              {i === lastIdx && (
                <> {tail.split(/(\{link\})/).map((part, k) =>
                  part === "{link}"
                    ? <Link key={k} href={pageHref("events", "flightlog")} className="bp-link">{tailLink}</Link>
                    : <span key={k}>{part}</span>,
                )}</>
              )}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
