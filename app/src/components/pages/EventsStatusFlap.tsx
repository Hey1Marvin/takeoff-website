"use client";
/* Split-Flap-Status — Wort-Ebene Flap-Animation für Karten (.status) und
   Flight-Log-Zeilen (.fstatus). Label & Key kommen fertig berechnet vom
   Server (computeLabel-Logik lebt in events/page.tsx); hier läuft nur die
   Optik: beim ersten Sichtbarwerden einmal "einklappen" (Boarding-Pass-
   Anmutung) — respektiert FX-Tier + prefers-reduced-motion. Portierung
   von flapTo()/bootFlapOnView() aus assets/js/pages/events.js. */
import { useEffect, useRef } from "react";

export default function EventsStatusFlap({
  label, statusKey, variant = "status", className,
}: {
  label: string;
  statusKey: string;
  variant?: "status" | "fstatus";
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fxOn = document.documentElement.dataset.fx !== "s";
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fxOn || reduced || !("IntersectionObserver" in window)) return;

    const stack = el.querySelector<HTMLElement>(".flap-stack") ?? el;
    const live = el.querySelector<HTMLElement>(".flap-face--live") ?? el;

    const io = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          io.unobserve(el);
          if (el.classList.contains("is-flapping")) return;
          const text = live.textContent?.trim() ?? "";
          const incoming = document.createElement("span");
          incoming.className = "flap-face flap-face--incoming";
          incoming.textContent = text;
          stack.appendChild(incoming);
          el.classList.add("is-flapping");
          const finish = () => {
            incoming.remove();
            el.classList.remove("is-flapping");
            el.removeEventListener("animationend", onEnd);
          };
          const onEnd = (e: AnimationEvent) => { if (e.target === incoming) finish(); };
          el.addEventListener("animationend", onEnd);
          setTimeout(finish, 900); // Sicherheitsnetz (versteckter Tab o.ä.)
        });
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <span
      ref={ref}
      className={`${variant}${className ? ` ${className}` : ""}`}
      data-flap-status={statusKey}
    >
      <span className="flap-stack">
        <span className="flap-face flap-face--live">{label}</span>
      </span>
    </span>
  );
}
