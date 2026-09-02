"use client";
/* ============================================================
   Eine Zeile der Abflugtafel.

   Loest die Doppelung "Tafel + Kartenraster" auf: bis It. 14 versprach
   der Tafelkopf (Gate · Datum · Mission · Ort · Status) eine Tabelle, die
   nie kam — die Events standen darunter noch einmal als eigenes
   Kartenraster mit einem ganz anderen Spaltenmass. Jetzt IST die Zeile
   das Event, und sie klappt zum Briefing auf.

   Aufklapp-Mechanik wie in ExpandCard (grid-template-rows 0fr -> 1fr,
   animierbar ohne Hoehenmessung), aber mit zwei Unterschieden:

   1. Der Zeilenkopf ist selbst der <button>, nicht ein zusaetzlicher
      Umschalter unter einer klickbaren Karte. Damit ist die ganze Zeile
      per Tastatur bedienbar und `aria-expanded` sitzt an dem Element,
      das man auch anfasst.
   2. Geschlossen ist das Briefing `inert`: Links und Knoepfe darin sind
      dann weder fokussierbar noch fuer Screenreader da. Der 0fr-Trick
      allein blendet nur optisch aus — die Inhalte blieben in der
      Tab-Reihenfolge.

   `--i` traegt den Zeilenindex fuer den gestaffelten Einlauf (Keyframes
   in events.css, Klasse kommt von EventsBoardPower).
   ============================================================ */
import { ReactNode, useId, useState } from "react";

export default function EventsBoardRow({
  index, accent, accentRgb, toggleLabel, head, more,
}: {
  index: number;
  accent: string;
  accentRgb: string;
  toggleLabel: string;
  /** Die fuenf Zellen der geschlossenen Zeile (serverseitig gerendert). */
  head: ReactNode;
  /** Das Briefing (serverseitig gerendert). */
  more: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <li
      className={`ev-row${open ? " is-open" : ""}`}
      style={{
        "--i": index,
        "--card-acc": accent,
        "--card-acc-rgb": accentRgb,
      } as React.CSSProperties}
    >
      <button
        type="button"
        className="ev-rowbtn"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(o => !o)}
      >
        {head}
        <span className="ev-c ev-c-toggle">
          <span className="ev-toggle-text">{toggleLabel}</span>
          <svg className="ev-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      <div className="ev-more" id={id} inert={!open || undefined}>
        <div className="m-more-inner ev-more-inner">{more}</div>
      </div>
    </li>
  );
}
