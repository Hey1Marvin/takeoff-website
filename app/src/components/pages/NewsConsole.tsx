"use client";
/* Signatur-Motiv "Funkspruch-Terminal", Teil 2: die Konsole.

   WARUM EIN BAUSTEIN STATT DREI
   Bis It. 13 lag die Seite als linksbuendige Textspalte von 780px auf
   einem 1440px-Schirm — rechts 45 % schwarze Flaeche. Gleichzeitig war der
   Kanalfilter eine Chipreihe, die beim Scrollen sofort aus dem Bild lief,
   obwohl sie das einzige echte Werkzeug der Seite ist.

   Beides hat dieselbe Ursache: Geraet und Ausgabe standen untereinander.
   Hier stehen sie NEBENEINANDER — links die Station (Schuessel, Statuszeile,
   Messwerte, Kanalwahl; klebt beim Scrollen), rechts der Papierstreifen
   (Eingehend, Archiv). Das braucht einen gemeinsamen Zustand: der Filter
   sitzt links, die Karten stehen rechts. Deshalb ein Baustein und nicht
   zwei — der Vorgaenger NewsLogSection baute Filter und Liste zusammen und
   konnte darum genau diese Komposition nicht.

   DER EINE BEWEGUNGSMOMENT
   Der neueste Funkspruch tippt sich einmal ein. Diese Komponente haelt den
   dazugehoerigen Zustand (`is-receiving` / `is-locked` auf dem Deck) und
   news.css haengt daran die ganze Choreografie: der Suchstrahl der
   Schuessel schwenkt einmal, die Wellenfronten laufen, der Live-Punkt
   pulst — und steht danach still. Kein Dauerloop, nirgends. Bei
   `data-fx="s"` und `prefers-reduced-motion` startet der Typewriter gar
   nicht erst (NewsCard), damit bleibt auch das Deck ohne Klasse und alles
   steht von Anfang an. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import NewsRxArray from "./NewsRxArray";
import NewsCard, {
  type NewsCardData, type NewsCrosslink, type NewsFeedback, type NewsShareCopy, type NewsInstaCopy,
} from "./NewsCard";

/* Handgezeichnete Icons, gleicher Strichstil wie in KollektivFx
   (viewBox 24, stroke currentColor, 1.6) — "wrench" ist bewusst dasselbe
   Symbol wie dort (ein Werkzeug-Zeichen quer durch die Seiten statt einem
   zweiten, aehnlichen). */
const BADGE_ICONS: Record<string, ReactNode> = {
  megaphone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10v4a1 1 0 0 0 1 1h2l7 4V5L6 9H4a1 1 0 0 0-1 1Z" />
      <path d="M17 9.5c1.1 1 1.1 4 0 5M20 7c2.2 2 2.2 8 0 10" />
    </svg>
  ),
  wrench: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.5 17.5 15 9M17.5 4 20 6.5l-2.5 2.5L15 6.5zM4.5 19.5l2-2" />
    </svg>
  ),
  camera: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5Z" />
      <circle cx="12" cy="12.5" r="3.4" />
    </svg>
  ),
  headphones: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
      <rect x="3" y="14" width="4" height="6" rx="1.4" />
      <rect x="17" y="14" width="4" height="6" rx="1.4" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5l2.47 5.24 5.53.65-4.1 3.88 1.1 5.66L12 16.1l-5 2.83 1.1-5.66-4.1-3.88 5.53-.65Z" />
    </svg>
  ),
  eye: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  ),
};
const DEFAULT_BADGE_ORDER = ["Announcement", "Baulog", "Recap", "Podcast", "Save-the-Date", "Teaser"];
const DEFAULT_BADGE_ICONS: Record<string, string> = {
  Announcement: "megaphone", Baulog: "wrench", Recap: "camera", Podcast: "headphones",
  "Save-the-Date": "star", Teaser: "eye",
};

function fxOn(): boolean {
  return document.documentElement.dataset.fx !== "s" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface NewsReadoutItem { label: string; value: string }

export interface NewsConsoleCopy {
  liveLabel: string;
  stationEyebrow: string;
  scopeCaption: string;
  readoutLabel: string;
  channelsLabel: string;
  channelsAria: string;
  allLabel: string;
  countTemplate: string;
  emptyText: string;
  yearTemplate: string;
  archiveTitle: string;
  hintLabel: string;
  hintText: string;
}

export default function NewsConsole({
  latest, items, crosslinks, feedbacks, share, insta,
  typewriter, charMs, copy, readout, badgeOrder, badgeIcons,
}: {
  latest: NewsCardData;
  items: NewsCardData[];
  crosslinks: Record<string, NewsCrosslink | null>;
  feedbacks: Record<string, NewsFeedback | null>;
  share: NewsShareCopy;
  insta: NewsInstaCopy;
  typewriter: boolean;
  charMs: number;
  copy: NewsConsoleCopy;
  readout: NewsReadoutItem[];
  badgeOrder?: string[];
  badgeIcons?: Record<string, string>;
}) {
  const [active, setActive] = useState("all");
  const [retuning, setRetuning] = useState(false);
  const [phase, setPhase] = useState<"idle" | "receiving" | "locked">("idle");
  const retuneTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lockTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /* Nur zum Aufraeumen beim Unmount — beide Timer starten in Handlern,
     nicht reaktiv ueber ein Effect (das feuerte auch beim ersten Rendern
     und braeuchte einen isFirst-Ref-Hack, um das zu unterdruecken). */
  useEffect(() => () => {
    clearTimeout(retuneTimeout.current);
    clearTimeout(lockTimeout.current);
  }, []);

  /* Der eine Bewegungsmoment: Anfang und Ende des Typewriters. Danach
     bleibt das Deck dauerhaft auf "idle" — nichts laeuft weiter. */
  const handleTyping = useCallback((activeNow: boolean) => {
    clearTimeout(lockTimeout.current);
    if (activeNow) { setPhase("receiving"); return; }
    setPhase("locked");
    lockTimeout.current = setTimeout(() => setPhase("idle"), 900);
  }, []);

  /* Kurzer "Blip" beim Umschalten — nicht beim ersten Rendern (weil hier
     nur bei einem echten Wechsel aufgerufen wird) und nicht erneut, wenn
     derselbe Kanal nochmal angeklickt wird. */
  const selectChannel = (next: string) => {
    if (next === active) return;
    setActive(next);
    if (!fxOn()) return;
    clearTimeout(retuneTimeout.current);
    setRetuning(true);
    retuneTimeout.current = setTimeout(() => setRetuning(false), 220);
  };

  const order = badgeOrder?.length ? badgeOrder : DEFAULT_BADGE_ORDER;
  const icons = badgeIcons && Object.keys(badgeIcons).length ? badgeIcons : DEFAULT_BADGE_ICONS;
  const present = order.filter(b => items.some(i => i.badge === b));
  const counts: Record<string, number> = {};
  items.forEach(i => { counts[i.badge] = (counts[i.badge] || 0) + 1; });

  const shownCount = active === "all" ? items.length : (counts[active] || 0);
  const countText = copy.countTemplate
    .replace("{shown}", String(shownCount))
    .replace("{total}", String(items.length));

  /* Jahres-Trennlinien als DIREKTE Geschwister der Karten — lastYear
     startet auf dem Jahr des ERSTEN Eintrags, damit die allererste Karte
     keine Marke vorangestellt bekommt (nur an echten Jahresuebergaengen).
     Seit It. 14 duerfen sie die Karten auch nicht mehr "verzaehlen": die
     Signalstaerke haengt an einem Attribut, nicht an :nth-of-type. */
  let lastYear = items[0] ? items[0].date.slice(0, 4) : null;
  const nodes: ReactNode[] = [];
  items.forEach(item => {
    const year = item.date.slice(0, 4);
    if (year && year !== lastYear) {
      nodes.push(
        <p className="rx-yearmark" key={`y-${year}`} hidden={active !== "all"}>
          <span>{copy.yearTemplate.replace("{year}", year)}</span>
        </p>
      );
      lastYear = year;
    }
    const match = active === "all" || item.badge === active;
    nodes.push(
      <NewsCard
        key={item.id}
        item={item}
        crosslink={crosslinks[item.id] ?? null}
        feedback={feedbacks[item.id] ?? null}
        share={share}
        insta={insta}
        hidden={!match}
      />
    );
  });

  const deckClass = [
    "rx-deck",
    phase === "receiving" ? "is-receiving" : "",
    phase === "locked" ? "is-locked" : "",
    retuning ? "rx-retune" : "",
  ].filter(Boolean).join(" ");

  return (
    <section className="section rx-sec rx-station" id="log">
      <div className="wrap">
        <div className={deckClass}>

          <aside className="rx-rail">
            <div className="rx-rail-inner">
              <p className="rx-rail-eyebrow">{copy.stationEyebrow}</p>
              <NewsRxArray caption={copy.scopeCaption} />

              <dl className="rx-readout" aria-label={copy.readoutLabel}>
                {readout.map(r => (
                  <div className="rx-ro-item" key={r.label}>
                    <dt>{r.label}</dt>
                    <dd>{r.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="rx-chgroup">
                <p className="rx-chtitle">{copy.channelsLabel}</p>
                <div className="rx-channels" role="group" aria-label={copy.channelsAria}>
                  {/* Der Icon-Platz ist IMMER da, auch bei „Alle" (dort als
                      Punkt). Sonst rutscht die Beschriftung in die
                      Icon-Spalte des Rasters und die Liste steht schief. */}
                  <button type="button" className="rx-ch" aria-pressed={active === "all"} onClick={() => selectChannel("all")}>
                    <i className="rx-ch-icon rx-ch-icon--all" aria-hidden="true"></i>
                    <span className="rx-ch-name">{copy.allLabel}</span>
                    <span className="rx-ch-n">{items.length}</span>
                  </button>
                  {present.map(b => (
                    <button type="button" className="rx-ch" key={b} aria-pressed={active === b} onClick={() => selectChannel(b)}>
                      <i className="rx-ch-icon" aria-hidden="true">{BADGE_ICONS[icons[b]] ?? null}</i>
                      <span className="rx-ch-name">{b}</span>
                      <span className="rx-ch-n">{counts[b] || 0}</span>
                    </button>
                  ))}
                </div>
                <p className="rx-count" aria-live="polite">{countText}</p>
              </div>
            </div>
          </aside>

          <div className="rx-feed">
            <p className="rx-rule rx-rule--live">
              <i className="rx-live-dot" aria-hidden="true"></i>
              <span>{copy.liveLabel}</span>
            </p>

            <div className="rx-latest">
              <NewsCard
                item={latest}
                featured
                typewriter={typewriter}
                charMs={charMs}
                crosslink={crosslinks[latest.id] ?? null}
                feedback={feedbacks[latest.id] ?? null}
                share={share}
                insta={insta}
                onTyping={handleTyping}
              />
            </div>

            <h2 className="rx-rule rx-arch-title" id="archiv"><span>{copy.archiveTitle}</span></h2>

            <div className="news-list rx-log">{nodes}</div>
            {shownCount === 0 && <p className="rx-nohits">{copy.emptyText}</p>}

            <div className="transmission rx-hint">
              <span className="tx-label">{copy.hintLabel}</span>
              <p>{copy.hintText}</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
