"use client";
/* Aufklappbare Briefing-Karte — Portierung des data-expand-Musters. */
import { ReactNode, useId, useState } from "react";

export default function ExpandCard({
  className, style, toggleLabel = "Briefing", children, more,
}: {
  className?: string;
  style?: React.CSSProperties;
  toggleLabel?: string;
  children: ReactNode;   // Kopf der Karte
  more: ReactNode;       // aufklappbarer Inhalt
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <article
      className={`mcard${open ? " open" : ""}${className ? " " + className : ""}`}
      style={style}
      data-expand=""
      onClick={e => {
        const t = e.target as HTMLElement;
        if (t.closest("a") || t.closest(".m-more button")) return;
        setOpen(o => !o);
      }}
    >
      {children}
      <button className="m-toggle" type="button" aria-expanded={open} aria-controls={id}>
        {toggleLabel}{" "}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div className="m-more" id={id}>
        <div className="m-more-inner">{more}</div>
      </div>
    </article>
  );
}
