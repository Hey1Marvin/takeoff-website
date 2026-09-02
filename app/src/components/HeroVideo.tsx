"use client";
/* ============================================================
   Hintergrundvideo im Hero — Portierung von
   prototype/assets/js/hero-video.js

   Der Container `.hero-video` steht als JSX im Baum, das <video> NICHT:
   es wird erst zur Laufzeit erzeugt. Das ist die Zusage des Prototyps —
   ohne JavaScript wird keine einzige Videodatei angefordert, und der
   kritische Pfad (Schriften, CSS, Hydration) bleibt frei.

   Drei Sperren, alle drei überstimmen die Nutzerwahl:
     · FX-Stufe "s"    — die Abstufung nach Gerät/Netz wäre sonst wertlos
     · reduced motion  — ein tanzendes Publikum ist genau diese Bewegung
     · saveData        — 1,4 MB sind ein Vielfaches der übrigen Seite

   Das Boot-Script in layout.tsx stempelt `data-video` (anders als im
   Prototyp) NICHT vor — das würde die geteilte Datei anfassen. Der
   Zustand wird deshalb hier nach dem Mount gesetzt; sichtbar wird das
   nicht, weil die Ebene ohnehin bei `opacity: 0` startet und erst mit
   `is-ready` aufblendet.
   ============================================================ */
import { useEffect, useRef } from "react";

const KEY = "takeoff-video";
const POSTER = "/img/hero-rave-poster.webp";
const SOURCES = [
  { src: "/video/hero-rave.webm", type: "video/webm" },
  { src: "/video/hero-rave.mp4", type: "video/mp4" },
];
/* Unterhalb dieses Anteils sichtbarer Hero-Höhe darf der Boden (Mars-/
   Strandhorizont) wieder erscheinen — siehe hv-cover in hero-video.css. */
const COVER_AT = 0.55;

const store = {
  get(k: string): string | null {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k: string, v: string) {
    try { localStorage.setItem(k, v); } catch { /* Safari Private Mode */ }
  },
};

export default function HeroVideo() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const html = document.documentElement;
    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");

    let video: HTMLVideoElement | null = null;
    const timers = new Set<number>();
    let inView = true;          /* der Hero steht beim Laden im Bild */
    let disposed = false;

    function allowed(): boolean {
      if (html.dataset.fx === "s") return false;
      if (motionQuery.matches) return false;
      const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      if (c?.saveData === true) return false;
      return true;
    }
    /* Voreinstellung ist AN — wer es nicht will, schaltet es einmal ab. */
    const pref = () => (store.get(KEY) === "off" ? "off" : "on");
    const wanted = () => pref() === "on" && allowed();

    function build() {
      if (video || disposed) return;
      const v = document.createElement("video");
      /* Ohne muted UND playsinline verweigert jeder mobile Browser den
         Autostart — still, ohne Fehler. Property und Attribut beide setzen:
         Safari wertet beim ersten Laden das Attribut aus. */
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.loop = true;
      v.setAttribute("muted", "");
      v.setAttribute("playsinline", "");
      v.setAttribute("loop", "");
      v.setAttribute("aria-hidden", "true");
      v.setAttribute("tabindex", "-1");
      v.disablePictureInPicture = true;
      /* preload="auto" ist hier harmlos: das Element entsteht erst im
         Leerlauf nach dem Laden. Der Clip läuft in Schleife — ein
         nachladender Ruckler alle 9 s wäre teurer als die Übertragung. */
      v.preload = "auto";
      /* Das Poster ist das erste Bild des Clips — der Wechsel vom Standbild
         zum laufenden Video ist dadurch unsichtbar. */
      v.poster = POSTER;

      for (const s of SOURCES) {
        const el = document.createElement("source");
        el.src = s.src;
        el.type = s.type;
        v.appendChild(el);
      }

      /* Aufblenden, sobald überhaupt etwas zu sehen ist. `loadeddata` ist der
         erste Zeitpunkt mit echtem Videobild; bleibt es aus, blendet der
         Fallback nach 1,2 s wenigstens das Poster auf. */
      let shown = false;
      const show = () => {
        if (shown || disposed) return;
        shown = true;
        wrap!.classList.add("is-ready");
      };
      v.addEventListener("loadeddata", show, { once: true });
      const showTimer = window.setTimeout(show, 1200);
      timers.add(showTimer);

      /* Lässt sich das Video gar nicht abspielen, verschwindet die Ebene
         wieder — lieber der gewohnte Sternenhimmel als ein schwarzes
         Rechteck über dem halben Hero. */
      v.addEventListener("error", () => teardown(), { once: true });

      video = v;
      wrap!.appendChild(v);
      resume();
    }

    function teardown() {
      wrap!.classList.remove("is-ready");
      const v = video;
      if (!v) return;
      video = null;
      try { v.pause(); } catch { /* egal */ }
      /* Quellen leeren und neu laden: erst dann gibt der Browser Decoder und
         Puffer frei. Ein bloßes remove() lässt beides hängen. */
      while (v.firstChild) v.removeChild(v.firstChild);
      v.removeAttribute("src");
      try { v.load(); } catch { /* egal */ }
      v.parentNode?.removeChild(v);
    }

    /* Ein Video, das unsichtbar weiterläuft, kostet Akku ohne Gegenwert. */
    function resume() {
      if (!video || !inView || document.hidden || !wanted()) return;
      const p = video.play();
      /* play() lehnt ab, wenn der Browser den Autostart verweigert —
         unbehandelt steht das als Fehler in jeder Konsole. */
      p?.catch(() => { /* dann eben nicht */ });
    }
    function halt() {
      if (video) { try { video.pause(); } catch { /* egal */ } }
    }

    function setCover(on: boolean) {
      html.classList.toggle("hv-cover", on && html.dataset.video === "on");
    }

    /* Der Schalter-Vertrag der übrigen Mission-Control-Zeilen: data-set-video
       + aria-pressed. Ist das Laden gesperrt, wird die Zeile deaktiviert
       statt entfernt — ein verschwindendes Bedienelement lässt das Panel
       springen. (Die Zeile selbst lebt in MissionControl.tsx; fehlt sie,
       läuft diese Funktion einfach über eine leere Liste.) */
    function syncButtons() {
      const on = html.dataset.video === "on";
      const off = !allowed();
      document.querySelectorAll<HTMLButtonElement>("[data-set-video]").forEach(b => {
        b.setAttribute("aria-pressed", String((b.dataset.setVideo === "on") === on));
        b.disabled = off;
        b.closest(".row")?.classList.toggle("is-off", off);
      });
    }

    function whenIdle(fn: () => void) {
      const go = () => {
        const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
        if (ric) ric(fn, { timeout: 2000 });
        else timers.add(window.setTimeout(fn, 300));
      };
      if (document.readyState === "complete") go();
      else addEventListener("load", go, { once: true });
    }

    function apply(initial = false) {
      if (disposed) return;
      const on = wanted();
      html.dataset.video = on ? "on" : "off";
      if (on) {
        /* Beim Start nicht sofort: erst laden lassen, was die Seite ausmacht.
           Nach einem Klick dagegen sofort — dort wartet jemand. */
        if (initial) whenIdle(build); else build();
      } else {
        teardown();
        html.classList.remove("hv-cover");
      }
      syncButtons();
    }

    /* ---------- Beobachter ---------- */
    let io: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(entries => {
        for (const e of entries) {
          inView = e.isIntersecting;
          setCover(e.intersectionRatio >= COVER_AT);
          if (inView) resume(); else halt();
        }
      }, { threshold: [0, 0.3, COVER_AT, 0.8, 1] });
      io.observe(wrap);
    } else {
      setCover(true);   /* ohne Beobachter lieber dauerhaft decken als flackern */
    }

    const onVisibility = () => { if (document.hidden) halt(); else resume(); };
    document.addEventListener("visibilitychange", onVisibility);

    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>("[data-set-video]");
      if (!btn || btn.disabled) return;
      store.set(KEY, btn.dataset.setVideo === "on" ? "on" : "off");
      apply();
    };
    document.addEventListener("click", onClick);

    /* Die FX-Stufe kann sich ohne unser Zutun ändern (Mission Control oder
       FPS-Wächter). Das Attribut auf <html> ist die gemeinsame Schnittstelle. */
    const fxObserver = new MutationObserver(() => {
      if (wanted() !== (html.dataset.video === "on")) apply();
      else syncButtons();
    });
    fxObserver.observe(html, { attributes: true, attributeFilter: ["data-fx"] });

    const onMotionChange = () => apply();
    motionQuery.addEventListener("change", onMotionChange);

    apply(true);

    return () => {
      disposed = true;
      teardown();
      io?.disconnect();
      fxObserver.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("click", onClick);
      timers.forEach(t => clearTimeout(t));
      timers.clear();
      /* Beim Verlassen der Startseite bleibt sonst der Video-Zustand auf
         <html> stehen und Themes/Boden blieben ausgeblendet. */
      html.classList.remove("hv-cover");
      delete html.dataset.video;
    };
  }, []);

  return <div className="hero-video" aria-hidden="true" ref={wrapRef} />;
}
