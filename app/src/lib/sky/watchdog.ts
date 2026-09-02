/* ============================================================
   sky/watchdog.ts — FPS-Watchdog mit Sticky-Downgrade

   Portiert aus `prototype/assets/js/main.js` Z. 5512 ff. Er ist die
   Versicherung dafuer, dass die neue, deutlich teurere Szene schwache
   Geraete nicht ruiniert: faellt ein Viertel der Bilder ueber 33 ms,
   geht die Effektstufe eine Stufe runter.

   Aus dem Original bewusst uebernommen:
   · Er laeuft in JEDEM Tier > S und die ganze Sitzung lang. Frueher lief er
     nur kurz nach dem Start — dann gab es fuer thermisches Drosseln
     ueberhaupt keine Messung. Und jede manuelle Tier-Wahl schaltete ihn
     dauerhaft ab, auch wenn der Nutzer bewusst „Voll" waehlte und das
     Geraet danach einbrach.
   · `?perf=1` legt ihn still. Ohne das stuft er mitten in einem Messlauf
     herunter (er sieht ja lange Frames) und meldet danach Zahlen fuer eine
     ANDERE Effektstufe — der Vorher-Nachher-Vergleich misst dann zwei
     verschiedene Dinge.
   · Sticky: drei Downgrades in vierzehn Tagen machen das niedrigere Tier
     zum Default.

   Nicht uebernommen wurde `applyTier()`. Der Watchdog schreibt hier nur
   `html.dataset.fx` — den Rest (Engine start/stop/resize, Lenis, Panel)
   erledigen die Beobachter dieses Attributs. Genau dafuer gibt es
   `watchSky()`.
   ============================================================ */
import type { SkyEnv } from "./types";

/* Storage darf nie das ganze Skript killen: Safari Private Mode,
   Sandbox-iframes und geblockter Storage werfen bei jedem Zugriff. */
const store = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string): void { try { localStorage.setItem(k, v); } catch { /* egal */ } },
};

export function startWatchdog(env: SkyEnv): () => void {
  const html = document.documentElement;
  let raf = 0;
  let stopped = false;

  function downgrade(): void {
    const now = html.dataset.fx;
    const next = now === "l" ? "m" : now === "m" ? "s" : null;
    if (!next) return;
    html.dataset.fx = next;
    /* Sticky: wiederholte Downgrades machen das niedrigere Tier zum Default */
    try {
      const hist = (JSON.parse(store.get("takeoff-fx-downgrades") || "[]") as number[])
        .filter(ts => Date.now() - ts < 14 * 864e5);
      hist.push(Date.now());
      store.set("takeoff-fx-downgrades", JSON.stringify(hist));
      if (hist.length >= 3) store.set("takeoff-fx", next);
    } catch { /* egal */ }
    /* Neu bewaffnen: in Stufe „s" beendet sich der Watchdog dabei selbst. */
    arm();
  }

  function arm(): void {
    cancelAnimationFrame(raf);
    raf = 0;
    if (stopped) return;
    if (html.dataset.fx === "s" || env.reduced || env.perf) return;
    let frames = 0, slowFrames = 0, last = performance.now();
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) { last = t; return; }
      const ft = t - last; last = t;
      frames++; if (ft > 33) slowFrames++;
      if (frames < 180) return;
      if (slowFrames / frames > .25) downgrade();
      frames = slowFrames = 0;
    };
    raf = requestAnimationFrame(tick);
  }

  arm();

  /* Wechselt das Tier von aussen (Mission Control, Boot-Script), muss der
     Watchdog mitziehen: von „s" hoch heisst neu messen, nach „s" runter
     heisst aufhoeren. */
  const obs = new MutationObserver(() => arm());
  obs.observe(html, { attributes: true, attributeFilter: ["data-fx"] });

  return () => {
    stopped = true;
    obs.disconnect();
    cancelAnimationFrame(raf);
    raf = 0;
  };
}
