"use client";
/* Eine Karte im Mission Log. Traegt pro Instanz drei kleine, unabhaengige
   Interaktionen:
     · Typewriter auf der Eingehend-Headline (nur featured, einmalig,
       Tier-gated, Text startet SSR-gleich voll da und wird erst NACH der
       Hydration geleert+neu getippt — kein Hydration-Mismatch)
     · Insta-Zwei-Klick-Fassade (der erste Klick schaltet nur den Hinweis
       samt echtem Link frei; bis dahin geht kein Request zu Instagram)
     · Teilen (Web-Share-API mit Zwischenablage-Fallback, Muster 1:1 aus
       AwarenessShareButton) + Telegram-Intent-Link (braucht location.href,
       daher erst nach dem Mount befuellt statt serverseitig vorgerechnet)
   Datum/Countdown/Crosslink-Href/Signalstaerke kommen bereits fertig
   berechnet von der Seite (page.tsx) — Datumsmathematik bleibt serverseitig,
   damit Server- und Client-Render exakt gleich aussehen.

   IT. 14 — der Typewriter meldet sich jetzt nach OBEN (`onTyping`), statt
   sich per `document.getElementById("rx-array")` selbst in eine fremde
   Komponente zu greifen. Damit haengt die ganze Choreografie der Seite an
   EINEM Zustand in NewsConsole und nicht an zwei Stellen, die sich
   auseinanderentwickeln koennen. */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";

export interface NewsCardData {
  id: string;
  badge: string;
  accentRgb: string;
  date: string;          // ISO yyyy-mm-dd — nur für Jahres-Gruppierung im Archiv
  dateFormatted: string; // fertig über fmtDate() formatiert
  title: string;
  text: string;
  instaUrl?: string;
  /* 4 = frisch, 1 = altes Signal. Kommt aus dem ALTER des Eintrags
     (page.tsx), nicht aus seiner Position in der Liste — die Liste wird
     clientseitig gefiltert, eine Positionsregel faerbt dann still falsch. */
  strength: 1 | 2 | 3 | 4;
}

export interface NewsCrosslink {
  href: string;
  label: string;
  countdownText?: string;
}

export interface NewsFeedback {
  eyebrow: string;
  prompt: string;
  linkLabel: string;
  mailHref: string;
}

export interface NewsShareCopy {
  buttonLabel: string;
  telegramLabel: string;
  showTelegram: boolean;
  copiedToast: string;
  groupAria: string;
}

export interface NewsInstaCopy {
  buttonLabel: string;
  consentNote: string;
  openLabel: string;
}

function fxOn(): boolean {
  return document.documentElement.dataset.fx !== "s" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function fxFull(): boolean {
  return document.documentElement.dataset.fx === "l" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function NewsCard({
  item, featured = false, typewriter = false, charMs = 24,
  crosslink = null, feedback = null, share, insta, hidden = false, onTyping,
}: {
  item: NewsCardData;
  featured?: boolean;
  typewriter?: boolean;
  charMs?: number;
  crosslink?: NewsCrosslink | null;
  feedback?: NewsFeedback | null;
  share: NewsShareCopy;
  insta: NewsInstaCopy;
  hidden?: boolean;
  onTyping?: (active: boolean) => void;
}) {
  const [headline, setHeadline] = useState(item.title); // SSR-gleich: voller Text
  const [typing, setTyping] = useState(false);
  const [locked, setLocked] = useState(false);
  const [asked, setAsked] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tgHref, setTgHref] = useState<string | undefined>(undefined);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const stepTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const instaNoteId = useId();

  /* Callback ueber einen Ref: sonst haengt der Typewriter-Effect an der
     Identitaet der Funktion und startet bei jedem Rendern der Elternliste
     (Filterklick!) von vorn. Zuweisung im Effect, nicht im Render — ein Ref
     waehrend des Renderns zu beschreiben ist unter React 19 ein Fehler. */
  const typingCb = useRef(onTyping);
  useEffect(() => { typingCb.current = onTyping; }, [onTyping]);
  const report = useCallback((active: boolean) => { typingCb.current?.(active); }, []);

  const shareUrl = `/news#${item.id}`;

  /* ---------- Typewriter: nur die Eingehend-Headline, einmalig ---------- */
  useEffect(() => {
    if (!featured || !typewriter) return;
    const el = headingRef.current;
    if (!el || !fxOn() || !("IntersectionObserver" in window)) return;

    const io = new IntersectionObserver(
      entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        if (!fxOn()) return; // Tier evtl. seit Trigger runtergestuft
        const full = fxFull();
        const stepMs = full ? charMs : Math.max(10, Math.round(charMs * 0.65));
        const text = item.title;
        let i = 0;
        setTyping(true);
        setHeadline("");
        report(true);
        const finish = () => {
          setTyping(false);
          report(false);
        };
        const step = () => {
          if (!fxOn()) { setHeadline(text); finish(); return; }
          i++;
          setHeadline(text.slice(0, i));
          if (i < text.length) {
            stepTimeout.current = setTimeout(step, stepMs);
          } else {
            finish();
            setLocked(true);
            stepTimeout.current = setTimeout(() => setLocked(false), 700);
          }
        };
        step();
      }),
      { rootMargin: "0px 0px -15% 0px", threshold: 0.4 }
    );
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(stepTimeout.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured, typewriter, charMs]);

  /* ---------- Toast nach "Link kopiert" ---------- */
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  /* ---------- Telegram-Intent braucht die absolute URL (location.href) —
     die gibt es erst im Browser, deshalb erst nach dem Mount befuellen
     statt serverseitig vorzurechnen (sonst Hydration-Mismatch). ---------- */
  useEffect(() => {
    if (!share.showTelegram) return;
    const absUrl = new URL(shareUrl, location.href).href;
    // location existiert erst im Browser (s. Kommentar oben) — muss darum
    // im Effect gesetzt werden, nicht als Lazy-Initializer im Render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTgHref(`https://t.me/share/url?url=${encodeURIComponent(absUrl)}&text=${encodeURIComponent(item.title)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [share.showTelegram, item.title]);

  const onShare = async () => {
    const absUrl = new URL(shareUrl, location.href).href;
    if (navigator.share) {
      try {
        await navigator.share({ title: document.title, text: item.title, url: absUrl });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        // sonst: Zwischenablage-Fallback unten
      }
    }
    try {
      await navigator.clipboard.writeText(absUrl);
      setToast(share.copiedToast);
    } catch {
      setToast(absUrl); // letzter Ausweg, falls Clipboard-API fehlt/blockiert ist
    }
  };

  /* KEIN `.reveal` direkt am `.ncard`: `.reveal` traegt bis zum Ende seiner
     .8s-Transition ein `transform` (translateY), und ein `transform` macht
     jedes Element zum Containing Block fuer `position: fixed`-Nachfahren —
     genau darin haengt `.toast` weiter unten (Kopfkommentar news.css nennt
     das bereits "ein echter Fehler", damals durch `.ncard:hover { transform
     }`). Der Archiv-Reveal sitzt deshalb auf einem WRAPPER um die Karte
     (NewsConsole.tsx), nicht auf der Karte selbst — die Karte bleibt ohne
     eigenen Stapel-/Containing-Block-Nebeneffekt. */
  return (
    <article
      className={`ncard${asked ? " asked" : ""}`}
      id={item.id}
      style={{ "--n-acc": item.accentRgb } as CSSProperties}
      data-badge={item.badge}
      hidden={hidden}
    >
      <div className="n-head">
        <span className="n-badge">{item.badge}</span>
        {/* Signalstaerke als Attribut, nicht als Listenposition — siehe
            NewsCardData.strength. */}
        <span className="rx-sig" data-strength={item.strength} aria-hidden="true">
          <i></i><i></i><i></i><i></i>
        </span>
        <span className="n-date">{item.dateFormatted}</span>
      </div>

      {featured ? (
        <h2 ref={headingRef} className={`rx-headline${typing ? " rx-typing" : ""}${locked ? " rx-locked" : ""}`}>
          {headline}
        </h2>
      ) : (
        <h3>{item.title}</h3>
      )}

      <p>{item.text}</p>

      {item.instaUrl && (
        <>
          <button
            type="button"
            className="n-insta"
            aria-expanded={asked}
            aria-controls={instaNoteId}
            onClick={() => setAsked(a => !a)}
          >
            {insta.buttonLabel}
          </button>
          {/* Immer im DOM (CSS zeigt/versteckt über .ncard.asked .rx-consent,
              siehe news.css) — hält aria-controls gültig, statt beim
              Einklappen auf ein verschwundenes Element zu zeigen. */}
          <p className="rx-consent" id={instaNoteId}>
            {insta.consentNote}{" "}
            <a href={item.instaUrl} target="_blank" rel="noopener">{insta.openLabel}</a>
          </p>
        </>
      )}

      {crosslink && (
        <div className="rx-links">
          <a className="head-link rx-cross" href={crosslink.href}>{crosslink.label}</a>
          {crosslink.countdownText && <span className="rx-cd">{crosslink.countdownText}</span>}
        </div>
      )}

      <div className="rx-share" role="group" aria-label={share.groupAria}>
        <button type="button" className="rx-share-btn" onClick={onShare}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" />
            <path d="M8.3 10.7l7.4-4.4M8.3 13.3l7.4 4.4" />
          </svg>
          {share.buttonLabel}
        </button>
        {share.showTelegram && (
          <a
            className="rx-share-tg"
            href={tgHref ?? "#"}
            target="_blank"
            rel="noopener"
            onClick={e => { if (!tgHref) e.preventDefault(); }}
          >
            {share.telegramLabel} ↗
          </a>
        )}
      </div>

      {feedback && (
        <div className="rx-feedback">
          <b>{feedback.eyebrow}</b>
          {feedback.prompt} <a href={feedback.mailHref}>{feedback.linkLabel}</a>
        </div>
      )}

      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </article>
  );
}
