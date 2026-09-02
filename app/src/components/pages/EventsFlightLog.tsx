"use client";
/* Flight Log: Departed-Status je Zeile (Split-Flap) + Mission-Patch-Log
   ("war ich dabei"-Toggle, localStorage, ohne Account) + Reset + Toast.
   Portierung von wirePatchLog()/upgradeFlogRow() aus assets/js/pages/
   events.js. Bekommt fertig aufbereitete Zeilen vom Server (Datum schon
   formatiert, Link schon über eventHref gebaut) — data.ts ist
   "server-only" und darf hier nicht importiert werden. */
import { useEffect, useState } from "react";
import Link from "next/link";
import EventsStatusFlap from "./EventsStatusFlap";

export interface FlogEntry {
  slug: string;
  patchNo: string;
  dateDisplay: string;
  title: string;
  venue: string;
  brief?: string;
  href: string;
}

const PATCH_KEY = "takeoff-events-patchlog";

function readPatches(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(PATCH_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function writePatches(v: string[]) {
  try { localStorage.setItem(PATCH_KEY, JSON.stringify(v)); } catch { /* egal, z.B. Safari Private Mode */ }
}

export default function EventsFlightLog({
  events, eyebrow, titleHtml, toggleLabel, toastTemplate, resetLabel,
}: {
  events: FlogEntry[];
  eyebrow: string;
  titleHtml: string;
  toggleLabel: string;
  toastTemplate: string;
  resetLabel: string;
}) {
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    // localStorage existiert erst im Browser — Anfangszustand bleibt daher
    // serverseitig ein leeres Set (siehe useState oben) und wird erst nach
    // dem Mount mit dem echten Patch-Log befüllt (sonst Hydration-Mismatch
    // bei aria-pressed, falls schon Patches gesetzt waren).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPinned(new Set(readPatches()));
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  const toggle = (slug: string) => {
    setPinned(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      writePatches([...next]);
      setToast(toastTemplate.replace("{count}", String(next.size)).replace("{total}", String(events.length)));
      return next;
    });
  };

  const reset = () => {
    setPinned(new Set());
    writePatches([]);
    setToast("Patches zurückgesetzt");
  };

  return (
    <>
      <header className="section-head flog-head">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="h2" dangerouslySetInnerHTML={{ __html: titleHtml }} />
        </div>
        <button type="button" className="fpin-reset" onClick={reset}>{resetLabel}</button>
      </header>
      <div className="board-cols board-cols--sub" aria-hidden="true">
        <span>Gate</span><span>Datum</span><span>Mission</span><span>Ort</span><span>Status</span>
      </div>
      <ul className="flog events-flog">
        {events.map(e => (
          <li key={e.slug} className="reveal">
            <span className="fpatch" aria-hidden="true">{e.patchNo}</span>
            <span className="fdate txplate">{e.dateDisplay}</span>
            <Link className="fname txplate" href={e.href}>{e.title}</Link>
            <span className="fvenue txplate">{e.venue}</span>
            <EventsStatusFlap variant="fstatus" className="chip" label="Departed" statusKey="departed" />
            {e.brief && <span className="fnote"><span className="txplate">{e.brief}</span></span>}
            <button
              type="button"
              className="fpin"
              aria-pressed={pinned.has(e.slug)}
              aria-label={`${toggleLabel} — ${e.title}`}
              onClick={() => toggle(e.slug)}
            >
              <span className="fp-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </span>
              {toggleLabel}
            </button>
          </li>
        ))}
      </ul>
      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}
