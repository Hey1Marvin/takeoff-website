"use client";
/* Tag/Nacht als EIN Knopf.

   Warum kein Zweier-Segment wie beim Sprachumschalter: es kostet 64 statt
   32px und sprengt bei 320px die Zeile. Inhaltlich passt der eine Knopf
   ohnehin besser — DE/EN ist die Wahl zwischen zwei gleichrangigen Werten,
   Tag/Nacht die Abweichung von einem Standard (Nacht ist die Vorgabe).

   LESART: Zustand, nicht Ziel. Die Mondsichel heisst "es ist gerade Nacht".
   Beide Zeichen stehen im Markup, eines blendet CSS aus — nicht per
   JavaScript getauscht, sonst laege der Zustand an zwei Stellen.
   Die Beschriftung aendert sich NIE, damit kann eine Uebersetzung sie auch
   nicht ueberschreiben. */
import { useSyncExternalStore } from "react";
import { useT } from "./I18nProvider";

const subscribe = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => mo.disconnect();
};
const snapshot = () => document.documentElement.classList.contains("day-mode");

export default function DayToggle() {
  const t = useT();
  const day = useSyncExternalStore(subscribe, snapshot, () => false);

  const toggle = () => {
    const on = !document.documentElement.classList.contains("day-mode");
    document.documentElement.classList.toggle("day-mode", on);
    try { localStorage.setItem("takeoff-day", on ? "on" : "off"); } catch { /* egal */ }
  };

  return (
    <button className="nav-day" type="button" onClick={toggle}
      aria-pressed={day} aria-label={t("a11y.daymode")}>
      <svg className="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
      </svg>
      <svg className="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 3.4v2M12 18.6v2M3.4 12h2M18.6 12h2M6 6l1.5 1.5M16.5 16.5 18 18M18 6l-1.5 1.5M7.5 16.5 6 18" />
      </svg>
    </button>
  );
}
