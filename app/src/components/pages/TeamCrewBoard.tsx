"use client";
/* Bordkartei-Flip: Crew-Karten drehen sich per Klick zur Rückseite
   (Aufgaben-Manifest). Basis = Crossfade auf allen Tiers; Tier L bekommt
   zusätzlich die echte 3D-Y-Drehung (siehe team.css). Die sitewide Regel
   :root[data-fx="s"] * { transition-duration:.15s!important } (takeoff.css)
   macht den Wechsel auf Tier S praktisch verzugslos — "statische Karten",
   ohne dass hier ein eigener Tier-Zweig nötig wäre: Klick/Enter funktioniert
   auf jedem Tier identisch, nur das Drehgefühl unterscheidet sich rein
   über CSS. Portierung/Vertiefung von assets/js/pages/team.js (Original:
   Orbit-Stationsplan ohne Flip) + scratchpad/spec-team.md (Flip-Konzept).

   A11y: Vorderseite ist ein <button aria-expanded aria-controls>, klassisches
   Disclosure-Pattern (wie ExpandCard). Rückseite ist aria-hidden, solange
   zu — visibility:hidden (team.css) nimmt sie zusätzlich aus dem Tab-Index.
   Fokus wandert beim Öffnen zum "Zurück"-Button, beim Schließen zurück zur
   Vorderseite (sonst stünde man nach dem Öffnen auf einem unsichtbaren
   Element) — siehe pendingFocus-Effekt unten.

   Sammel-Easter-Egg: wer jede Karte einmal öffnet, entdeckt "die ganze
   Crew" — ein einziges Mal pro Browser (eigener localStorage-Key), danach
   dauerhaft still. Kein Konfetti, kein Dauer-Badge — nur ein Toast. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";

export interface TeamCardVM {
  id: string;
  name: string;
  role: string;
  avatarIcon?: string;
  avatarText?: string;
  since?: string;
  tasks: string[];
  contact?: string;
  href?: string;
  linkText?: string;
}

export interface TeamDeptVM {
  id: string;
  title: string;
  subtitle: string;
  intro: string;
  members: TeamCardVM[];
}

/* Identisches Icon-Set wie KollektivPage/team.js — "star" ergänzt den Satz,
   der Contract (team.json) kennt es bereits als Option. */
const ICONS: Record<string, ReactNode> = {
  heart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M12 20s-7.2-4.6-9.2-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.2 11c-2 4.4-9.2 9-9.2 9z" />
    </svg>
  ),
  cross: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.5" /><path d="M12 8.5v7M8.5 12h7" />
    </svg>
  ),
  bolt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M13 3 5.5 13.5H11L9.5 21 17.5 10H12z" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.8z" />
    </svg>
  ),
};

const CROWD_KEY = "takeoff-team-crew";

function readFound(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(CROWD_KEY) || "[]");
    return new Set(Array.isArray(v) ? v : []);
  } catch {
    return new Set();
  }
}
function writeFound(v: Set<string>) {
  try { localStorage.setItem(CROWD_KEY, JSON.stringify([...v])); } catch { /* egal, z. B. Safari Private Mode */ }
}

export default function TeamCrewBoard({
  departments, flipOpenLabel, flipCloseLabel, unicornToast,
}: {
  departments: TeamDeptVM[];
  flipOpenLabel: string;
  flipCloseLabel: string;
  unicornToast: string;
}) {
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  /* Fokusziel bis nach dem Re-Render merken. Bewusst ein Ref, kein State:
     der Wert wird nie gerendert, und ein State-Reset im Effekt loeste eine
     zusaetzliche Renderrunde aus (react-hooks/set-state-in-effect). */
  const pendingRef = useRef<{ id: string; to: boolean } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const foundRef = useRef<Set<string> | null>(null);
  const openRefs = useRef(new Map<string, HTMLButtonElement>());
  const closeRefs = useRef(new Map<string, HTMLButtonElement>());
  const allIdsRef = useRef(new Set(departments.flatMap(d => d.members.map(m => m.id))));

  // Fokus-Übergabe NACH dem Re-Render (erst dann ist das Ziel nicht mehr
  // visibility:hidden und damit fokussierbar).
  useEffect(() => {
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    (p.to ? closeRefs : openRefs).current.get(p.id)?.focus();
  }, [flipped]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  function discover(id: string) {
    if (!foundRef.current) foundRef.current = readFound();
    const found = foundRef.current;
    const allIds = allIdsRef.current;
    const wasComplete = allIds.size > 0 && [...allIds].every(i => found.has(i));
    if (wasComplete) return; // Überraschung nur einmal, kein Dauer-Hinweis danach
    found.add(id);
    writeFound(found);
    const isComplete = [...allIds].every(i => found.has(i));
    if (isComplete) setToast(unicornToast);
  }

  function flip(id: string, to: boolean) {
    setFlipped(prev => {
      const next = new Set(prev);
      if (to) next.add(id); else next.delete(id);
      return next;
    });
    pendingRef.current = { id, to };
    if (to) discover(id);
  }

  return (
    <div id="kt-departments">
      {departments.map(dept => dept.members.length > 0 && (
        <div className="kt-dept" data-dept={dept.id} key={dept.id}>
          <div className="kt-dept-head">
            <span className="kt-dept-dot" aria-hidden="true" />
            <h3 className="kt-dept-title">{dept.title}</h3>
            {dept.subtitle && <span className="kt-dept-sub">{dept.subtitle}</span>}
          </div>
          {dept.intro && <p className="kt-dept-intro">{dept.intro}</p>}
          <div className="crewgrid kt-grid" data-dept={dept.id}>
            {dept.members.map(m => {
              const backId = `kt-back-${m.id}`;
              const isOpen = flipped.has(m.id);
              return (
                <div className={`kt-card${isOpen ? " flipped" : ""}`} key={m.id}>
                  <div className="kt-card-inner">
                    <button
                      type="button"
                      className="ccard kt-face kt-face-front"
                      aria-expanded={isOpen}
                      aria-controls={backId}
                      // Tier L (3D-Flip) hält per CSS !important beide Seiten
                      // opacity:1/visibility:visible (sonst kein Fluchtpunkt
                      // fürs Drehen) — ohne inert bliebe die weggedrehte
                      // Vorderseite trotzdem per Tab erreichbar und für
                      // Screenreader sichtbar. inert deckt Fokus UND A11y-
                      // Baum unabhängig vom CSS-Zustand ab (ARIA-Regel:
                      // aria-hidden darf NIE auf einem fokussierbaren
                      // Element ohne begleitendes inert/tabIndex stehen).
                      inert={isOpen}
                      ref={el => { if (el) openRefs.current.set(m.id, el); }}
                      onClick={() => flip(m.id, true)}
                    >
                      <span className="kt-scan" aria-hidden="true" />
                      <span className="avatar" aria-hidden="true">
                        {m.avatarIcon && ICONS[m.avatarIcon] ? ICONS[m.avatarIcon] : m.avatarText}
                      </span>
                      <b>{m.name}</b>
                      <span>{m.role}</span>
                      {m.since && <span className="kt-since">seit {m.since}</span>}
                      <span className="kt-flip-hint" aria-hidden="true">{flipOpenLabel} →</span>
                    </button>
                    <div className="kt-face kt-face-back" id={backId} aria-hidden={!isOpen} inert={!isOpen}>
                      <ul className="kt-tasks">
                        {m.tasks.map(task => <li key={task}>{task}</li>)}
                      </ul>
                      {m.contact && <p className="kt-contact">{m.contact}</p>}
                      {m.href && <Link className="kt-more" href={m.href}>{m.linkText ?? "Mehr →"}</Link>}
                      <button
                        type="button"
                        className="kt-flip-close"
                        ref={el => { if (el) closeRefs.current.set(m.id, el); }}
                        onClick={() => flip(m.id, false)}
                      >
                        {flipCloseLabel}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">
        {toast && <span className="kt-unicorn-pop" aria-hidden="true">🦄</span>}
        {toast}
      </div>
    </div>
  );
}
