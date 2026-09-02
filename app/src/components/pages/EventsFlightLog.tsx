"use client";
/* Flight Log: Departed-Status je Zeile (Split-Flap) + Mission-Patch-Log
   ("war ich dabei"-Toggle, localStorage, ohne Account) + Reset + Toast.
   Portierung von wirePatchLog()/upgradeFlogRow() aus assets/js/pages/
   events.js. Bekommt fertig aufbereitete Zeilen vom Server (Datum schon
   formatiert, Link schon über eventHref gebaut) — data.ts ist
   "server-only" und darf hier nicht importiert werden. */
import { useEffect, useState } from "react";
import Link from "next/link";

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
      {/* Hier stand eine zweite Spaltenkopfzeile (.board-cols--sub) mit
          Gate/Datum/Mission/Ort/Status. Sie rahmte nichts: .flog li ist
          eine Flex-Zeile, kein Raster mit diesen fuenf Spalten — genau
          der Fehler, der oben an der Abflugtafel behoben wurde. Ein
          Kopf ohne Tabelle ist ein Versprechen, das die Liste nicht
          einloest, also weg damit statt es zu wiederholen. */}
      <ul className="flog events-flog">
        {events.map(e => (
          /* Ohne .reveal: die Seite hat EINEN orchestrierten Bewegungs-
             moment (das Hochfahren der Abflugtafel). Ein zweiter
             Fade-up-Streusel auf jeder Log-Zeile war der generische
             Default und nahm dem Moment oben seine Wirkung. */
          <li key={e.slug}>
            <span className="fpatch" aria-hidden="true">{e.patchNo}</span>
            <span className="fdate txplate">{e.dateDisplay}</span>
            <Link className="fname txplate" href={e.href}>{e.title}</Link>
            <span className="fvenue txplate">{e.venue}</span>
            {/* Statisch statt Split-Flap: der Flap gehoert der Abflugtafel
                oben (dem einen Bewegungsmoment der Seite). Neun Log-Zeilen,
                die beim Scrollen einzeln umklappen, sind derselbe Streusel
                wie ein .reveal auf jedem Block — und „angekommen" darf
                ruhiger lesen als „kommend". */}
            <span className="fstatus chip">Departed</span>
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
