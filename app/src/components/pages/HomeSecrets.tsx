"use client";
/* Versteckte Sammel-Items (Easter Egg) — Portierung von main.js Z. 6061–6086.

   Ein Versteck pro Theme (space / mars / strand); sichtbar ist immer nur das
   Item des gerade aktiven Themes (takeoff.css: html:not([data-theme]) .d-space
   usw., und erst ab 1200px Breite). Wer alle drei finden will, muss also das
   Theme wechseln — genau das ist der Witz.

   Fortschritt liegt lokal unter dem Schlüssel des Prototyps
   ("takeoff-eggs"), damit ein Fund die Seiten-Migration überlebt.
   Der Toast ist markup-los aus takeoff.css (.toast/.toast.show) bedient. */
import { useEffect, useState } from "react";

const KEY = "takeoff-eggs";
const TOTAL = 3;

interface Secret {
  id: string;
  themeClass: string;
  spd: string;
  icon: React.ReactNode;
}

/* SVGs 1:1 aus prototype/index.html (#flightlog). */
const SECRETS: Secret[] = [
  {
    id: "space", themeClass: "d-space", spd: "-95",
    icon: (
      <>
        <path d="M12 2.5c2.8 2.6 3.8 6 3.8 9.2l-1.3 4.1h-5L8.2 11.7c0-3.2 1-6.6 3.8-9.2z" />
        <circle cx="12" cy="9.5" r="1.7" />
        <path d="M8.6 13.2 5.8 15.8l1.7.9h2.2M15.4 13.2l2.8 2.6-1.7.9h-2.2" />
      </>
    ),
  },
  {
    id: "mars", themeClass: "d-mars", spd: "-45",
    icon: (
      <>
        <path d="M6 21V4" />
        <path d="M6 4h9l-2.2 3L15 10H6" />
      </>
    ),
  },
  {
    id: "strand", themeClass: "d-strand", spd: "-45",
    icon: (
      <>
        <path d="M4 12.5a8 8 0 0 1 16 0z" />
        <path d="M12 4.5V3M12 12.5V19a2 2 0 0 0 4 .5" />
      </>
    ),
  },
];

function readEggs(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function writeEggs(v: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* egal */ }
}

/* Der Fund-Pop (.ditem.found svg) ist eine CSS-Animation — bei Stufe "s" und
   bei reduzierter Bewegung bleibt sie aus, der Toast kommt trotzdem. */
function motionOk(): boolean {
  return document.documentElement.dataset.fx !== "s"
    && !matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function HomeSecrets({
  ariaLabel, foundTemplate, allFound, alreadyFound,
}: {
  ariaLabel: string;
  foundTemplate: string;
  allFound: string;
  alreadyFound: string;
}) {
  const [popped, setPopped] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (!popped) return;
    const id = setTimeout(() => setPopped(null), 950);
    return () => clearTimeout(id);
  }, [popped]);

  function collect(id: string) {
    const found = new Set(readEggs());
    const isNew = !found.has(id);
    if (isNew) {
      found.add(id);
      writeEggs([...found]);
    }
    if (motionOk()) setPopped(id);
    setToast(
      isNew
        ? (found.size >= TOTAL
            ? allFound
            : foundTemplate.replace("{found}", String(found.size)).replace("{total}", String(TOTAL)))
        : alreadyFound,
    );
  }

  return (
    <>
      {SECRETS.map(s => (
        <button
          key={s.id}
          className={`ditem ${s.themeClass}${popped === s.id ? " found" : ""}`}
          data-spd={s.spd}
          data-secret={s.id}
          style={{ "--top": "34%", "--left": "3vw" } as React.CSSProperties}
          aria-label={ariaLabel}
          title="…"
          type="button"
          onClick={() => collect(s.id)}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"
            strokeLinecap="round" strokeLinejoin="round">
            {s.icon}
          </svg>
        </button>
      ))}
      {/* aria-live statt stiller Klasse: der Toast ist die einzige Rückmeldung
          auf den Klick, und der Knopf selbst ändert sichtbar nur seine Größe. */}
      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}
