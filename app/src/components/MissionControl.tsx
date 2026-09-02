"use client";
/* Mission Control — die fuenf Schalter des Prototyps.

   Vertrag mit der Szenen-Engine (src/lib/sky/): dieses Panel setzt NUR
   Attribute und Klassen auf <html> plus den localStorage-Eintrag. Die
   Engine hoert per MutationObserver zu (state.ts/watchSky) und baut selbst
   neu auf. Deshalb gibt es hier keinen Import aus sky/ — und keinen
   Doppelzustand zwischen React und Canvas ("Panel sagt Tag, Canvas malt
   Nacht"). Gleiche localStorage-Schluessel wie im Prototyp. */
import { useEffect, useId, useState, useSyncExternalStore } from "react";

const FX = [
  { v: "s", label: "Aus",    title: "Statisch — spart Akku & Daten" },
  { v: "m", label: "Normal", title: "Standard" },
  { v: "l", label: "Voll",   title: "Volle Show" },
];
const THEMES = [
  { v: "space",  label: "Space" },
  { v: "mars",   label: "Mars" },
  { v: "strand", label: "Strand" },
];

const html = () => document.documentElement;
const save = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* egal */ } };

/* Der Zustand LEBT auf <html>, nicht in React — das Boot-Script stempelt ihn
   vor dem ersten Paint, die Szenen-Engine liest ihn dort, und auch andere
   Schalter (Tag/Nacht in der Kopfleiste, spaeter das Admin) schreiben dorthin.
   `useSyncExternalStore` spiegelt genau so etwas: einmal abonnieren, immer den
   echten Wert lesen. Ein useEffect mit setState waere hier der falsche Griff —
   er erzeugt Kaskaden-Renders und ginge an Aenderungen von aussen vorbei. */
function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-fx", "data-theme", "data-video", "class"] });
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => { mo.disconnect(); mq.removeEventListener("change", cb); };
}

/* Ein einziger String als Momentaufnahme: useSyncExternalStore vergleicht mit
   Object.is, ein frisch gebautes Objekt waere bei jedem Aufruf "neu" und
   liefe in eine Endlosschleife. */
function snapshot(): string {
  const h = document.documentElement;
  return [
    h.dataset.fx ?? "m",
    h.dataset.theme ?? "space",
    h.classList.contains("ground-on") ? "1" : "0",
    h.classList.contains("day-mode") ? "1" : "0",
    h.dataset.video !== "off" ? "1" : "0",
    matchMedia("(prefers-reduced-motion: reduce)").matches ? "1" : "0",
  ].join("|");
}

/* Serverseitig gibt es weder <html>-Dataset noch Storage. Der Wert muss zum
   ersten Client-Render passen, sonst gibt es einen Hydration-Mismatch. */
const SERVER_SNAPSHOT = "m|space|1|0|1|0";

export default function MissionControl() {
  const snap = useSyncExternalStore(subscribe, snapshot, () => SERVER_SNAPSHOT);
  const [fx, theme, groundS, dayS, videoS, reducedS] = snap.split("|");
  const ground = groundS === "1", day = dayS === "1";
  const video = videoS === "1", reduced = reducedS === "1";

  /* Bei reduzierter Bewegung darf die Wahl "Voll" nicht durchkommen —
     dieselbe Sperre wie im Prototyp (main.js:6136-6142). */
  const applyFx = (v: string) => {
    if (reduced && v !== "s") return;
    html().dataset.fx = v; save("takeoff-fx", v);
  };
  const applyTheme = (v: string) => {
    if (v === "space") delete html().dataset.theme; else html().dataset.theme = v;
    save("takeoff-theme", v);
  };
  const applyGround = (on: boolean) => {
    html().classList.toggle("ground-on", on); save("takeoff-ground", on ? "on" : "off");
  };
  const applyDay = (on: boolean) => {
    html().classList.toggle("day-mode", on); save("takeoff-day", on ? "on" : "off");
  };
  const applyVideo = (on: boolean) => {
    html().dataset.video = on ? "on" : "off"; save("takeoff-video", on ? "on" : "off");
  };

  /* Space ist reiner Nachthimmel — dort gibt es keinen Boden zu schalten
     (main.js:6094-6104). Die Reihe bleibt sichtbar, aber gedimmt. */
  const groundOff = theme === "space";

  /* Eingeklappt als Standard. Das Panel ist `position: fixed` in der rechten
     unteren Ecke und war bisher IMMER offen — rund 330x230px, die auf jeder
     Seite ueber dem Inhalt lagen (auf /awareness neben dem Fliesstext, auf
     der 404 ueber dem Motiv). Es ist ein Einstellungswerkzeug, kein
     Seiteninhalt; es gehoert griffbereit, nicht dauerhaft im Bild.
     Der Zustand liegt im localStorage: wer es aufklappt, findet es beim
     naechsten Seitenaufruf offen vor. Bewusst NICHT auf <html> — es ist
     eine reine Bedien-Vorliebe, die die Szenen-Engine nichts angeht. */
  const [offen, setOffen] = useState(false);
  const panelId = useId();

  /* Nach der Hydration den gespeicherten Wunsch nachziehen. Direkt im
     useState-Initialisierer ginge das nicht: der Server kennt den Storage
     nicht, und ein abweichender erster Client-Render ist ein
     Hydration-Fehler. Einmalig, deshalb leere Abhaengigkeitsliste. */
  useEffect(() => {
    try {
      if (localStorage.getItem("takeoff-mctrl") === "open") setOffen(true);
    } catch { /* privater Modus — dann bleibt es zu */ }
  }, []);

  const umschalten = () => {
    setOffen(o => {
      const neu = !o;
      save("takeoff-mctrl", neu ? "open" : "closed");
      return neu;
    });
  };

  return (
    <div className={`mctrl${offen ? " is-open" : ""}`}>
      <button
        type="button"
        className="mctrl-toggle"
        aria-expanded={offen}
        aria-controls={panelId}
        onClick={umschalten}
        title={offen ? "Einstellungen schliessen" : "Darstellung einstellen"}
      >
        {/* Schieberegler-Symbol — dieselbe Strichstaerke wie die uebrigen
            Icons der Kopfleiste. */}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
             strokeLinecap="round" aria-hidden="true">
          <path d="M4 8h10M18 8h2M4 16h4M12 16h8" />
          <circle cx="16" cy="8" r="2" /><circle cx="10" cy="16" r="2" />
        </svg>
        <span className="mctrl-toggle-text">Darstellung</span>
      </button>

      <div className="mctrl-panel" id={panelId} role="group"
           aria-label="Darstellungs-Einstellungen" hidden={!offen}>
      <div className="row">
        <span className="lbl">FX</span>
        {FX.map(b => (
          <button key={b.v} type="button" title={b.title} disabled={reduced && b.v !== "s"}
            aria-pressed={fx === b.v} onClick={() => applyFx(b.v)}>{b.label}</button>
        ))}
      </div>

      <div className="row">
        <span className="lbl">Theme</span>
        {THEMES.map(b => (
          <button key={b.v} type="button"
            aria-pressed={theme === b.v} onClick={() => applyTheme(b.v)}>{b.label}</button>
        ))}
      </div>

      <div className={`row${groundOff ? " is-off" : ""}`}>
        <span className="lbl">Boden</span>
        <button type="button" title="Nur Sternenhimmel" disabled={groundOff}
          aria-pressed={!ground} onClick={() => applyGround(false)}>Aus</button>
        <button type="button" title="Horizont je nach Theme" disabled={groundOff}
          aria-pressed={ground} onClick={() => applyGround(true)}>An</button>
      </div>

      <div className="row row-video" role="group" aria-label="Video">
        <span className="lbl">Video</span>
        <button type="button" aria-pressed={!video} onClick={() => applyVideo(false)}>Aus</button>
        <button type="button" aria-pressed={video}  onClick={() => applyVideo(true)}>An</button>
      </div>

      <div className="row">
        <span className="lbl">Zeit</span>
        <button type="button" aria-pressed={!day} onClick={() => applyDay(false)}>Nacht</button>
        <button type="button" aria-pressed={day}  onClick={() => applyDay(true)}>Tag</button>
        </div>
      </div>
    </div>
  );
}
