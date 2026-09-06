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
     · saveData        — 1,1 MB sind ein Vielfaches der übrigen Seite

   Dazu die Sparleiter (src/lib/sky/qualitaet.ts): ab Stufe 2 hält das Video
   an, ohne abgeräumt zu werden. Das ist Priorität 1 der Leiter — bei
   Knappheit fällt hier zuerst etwas weg, vor den Sternen.

   Das Boot-Script in layout.tsx stempelt `data-video` (anders als im
   Prototyp) NICHT vor — das würde die geteilte Datei anfassen. Der
   Zustand wird deshalb hier nach dem Mount gesetzt; sichtbar wird das
   nicht, weil die Ebene ohnehin bei `opacity: 0` startet und erst mit
   `is-ready` aufblendet.
   ============================================================ */
import { useEffect, useRef } from "react";
import type { MediaItem } from "@/lib/types";

const KEY = "takeoff-video";

/* Dieselbe Grenze wie die Media Query in hero-video.css: darunter steht der
   Hero im Hochformat, und dort zeigt `object-fit: cover` von einem
   Querformat-Clip nur noch den mittleren Streifen — der Rest wird geladen
   und weggeschnitten. Deshalb gibt es zwei Fassungen. */
const SCHMAL = "(max-width: 700px)";

/* Unterhalb dieses Anteils sichtbarer Hero-Höhe darf der Boden (Mars-/
   Strandhorizont) wieder erscheinen — siehe hv-cover in hero-video.css. */
const COVER_AT = 0.55;

/* Nur EIN Format, und zwar H.264. Vorher standen hier zwei Quellen, WebM
   zuerst — und die WebM war mit 1 180 988 B GRÖSSER als die MP4 mit
   1 140 471 B. Chrome, Firefox und Edge luden also die teurere Fassung.
   Nachgemessen liesse sich VP9 zwar unter H.264 druecken (crf 36 → 1 048 kB,
   −8 %), aber der Aufwand lohnt den zweiten Satz Dateien nicht — und auf
   genau den schwachen Geräten, um die es hier geht, ist H.264 das bessere
   Format: es wird praktisch überall in Hardware dekodiert, VP9 auf älteren
   Telefonen nicht. Ein Hardware-Dekoder ist sparsamer als 8 % weniger Bytes. */
const TYP = "video/mp4";

const store = {
  get(k: string): string | null {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k: string, v: string) {
    try { localStorage.setItem(k, v); } catch { /* Safari Private Mode */ }
  },
};

/* Die Quellen kommen aus der Datenschicht (db.json → media.start, Rolle
   "hero") und werden von page.tsx hereingereicht. Vorher standen Pfad und
   Standbild hart in dieser Datei — das verletzte den Vertrag „Medien gehören
   in die Datenschicht" aus AGENTS.md, und derselbe Clip lag daneben schon
   korrekt als Galerie-Eintrag in db.json. */
export default function HeroVideo({ quellen }: { quellen: MediaItem[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const html = document.documentElement;
    const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
    const schmalQuery = matchMedia(SCHMAL);

    /* Die passende Fassung zur Bildschirmbreite. Die Wahl faellt in
       JavaScript und nicht ueber `<source media="…">`: das Attribut ist bei
       Video-Quellen nicht verlaesslich umgesetzt, und das Element entsteht
       hier ohnehin zur Laufzeit. */
    const passende = (): MediaItem | null => {
      const hoch = quellen.find(m => m.orientation === "hoch");
      const quer = quellen.find(m => m.orientation === "quer");
      return (schmalQuery.matches ? hoch ?? quer : quer ?? hoch) ?? null;
    };

    let video: HTMLVideoElement | null = null;
    /* Welche Fassung gerade im DOM haengt — damit ein Wechsel der
       Bildschirmbreite (Drehen des Telefons, Fenster ziehen) die richtige
       nachziehen kann, ohne bei jeder Kleinigkeit neu zu laden. */
    let geladen = "";
    const timers = new Set<number>();
    let inView = true;          /* der Hero steht beim Laden im Bild */
    let disposed = false;

    function allowed(): boolean {
      if (!passende()) return false;
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
      /* preload="auto" ist auf breiten Schirmen harmlos: das Element entsteht
         erst im Leerlauf nach dem Laden, und der Clip läuft in Schleife — ein
         nachladender Ruckler alle 18 s wäre teurer als die Übertragung.
         Auf schmalen Schirmen ist die Rechnung eine andere: dort steckt
         häufiger ein Mobilfunkvertrag dahinter, und die volle Datei im
         Voraus zu ziehen ist die teuerste der drei Möglichkeiten. */
      v.preload = schmalQuery.matches ? "metadata" : "auto";
      /* Das Poster ist das erste Bild des Clips — der Wechsel vom Standbild
         zum laufenden Video ist dadurch unsichtbar. */
      const m = passende()!;
      v.poster = m.poster;
      geladen = m.src;

      const el = document.createElement("source");
      el.src = m.src;
      el.type = TYP;
      v.appendChild(el);

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
      geladen = "";
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

    /* PRIORITÄT 1 der Sparleiter (src/lib/sky/qualitaet.ts): bei Knappheit
       hält als erstes das Video an — vor den Sternen, vor allem anderen. Ab
       Stufe 2 wird es nur PAUSIERT, nicht abgeräumt: ein pausiertes Video
       zeigt sein letztes Bild, kostet aber keinen Decoder mehr. Damit steht
       ein Standbild statt eines Lochs, und der Weg zurück ist ein einziger
       play()-Aufruf ohne neuen Download. Abgeräumt wird weiterhin nur, wenn
       es gar nicht laufen darf (Stufe "s", reduzierte Bewegung, Sparmodus). */
    const sparStufe = () => Number(html.dataset.spar || 0);

    /* Ein Video, das unsichtbar weiterläuft, kostet Akku ohne Gegenwert. */
    function resume() {
      if (!video || !inView || document.hidden || !wanted()) return;
      if (sparStufe() >= 2) return;
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
       Qualitätsregler). Das Attribut auf <html> ist die gemeinsame
       Schnittstelle — und seit der Sparleiter auch `data-spar`, das feiner
       greift: es hält das Video an, statt die ganze Stufe fallen zu lassen. */
    const fxObserver = new MutationObserver(records => {
      if (records.some(r => r.attributeName === "data-spar")) {
        if (sparStufe() >= 2) halt(); else resume();
      }
      if (wanted() !== (html.dataset.video === "on")) apply();
      else syncButtons();
    });
    fxObserver.observe(html, { attributes: true, attributeFilter: ["data-fx", "data-spar"] });

    const onMotionChange = () => apply();
    motionQuery.addEventListener("change", onMotionChange);

    /* Breite gewechselt (Telefon gedreht, Fenster gezogen): nur dann neu
       laden, wenn dadurch wirklich eine ANDERE Datei faellig wird. */
    const onSchmalChange = () => {
      const m = passende();
      if (!m || !video || m.src === geladen) { apply(); return; }
      teardown();
      apply();
    };
    schmalQuery.addEventListener("change", onSchmalChange);

    apply(true);

    return () => {
      disposed = true;
      teardown();
      io?.disconnect();
      fxObserver.disconnect();
      motionQuery.removeEventListener("change", onMotionChange);
      schmalQuery.removeEventListener("change", onSchmalChange);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("click", onClick);
      timers.forEach(t => clearTimeout(t));
      timers.clear();
      /* Beim Verlassen der Startseite bleibt sonst der Video-Zustand auf
         <html> stehen und Themes/Boden blieben ausgeblendet. */
      html.classList.remove("hv-cover");
      delete html.dataset.video;
    };
  }, [quellen]);

  return <div className="hero-video" aria-hidden="true" ref={wrapRef} />;
}
