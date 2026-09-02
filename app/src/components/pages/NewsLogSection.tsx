"use client";
/* Log-Archiv: Kanal-Filter (echtes Werkzeug, Muster: renderChannels/
   wireChannels in news.js) + Karten-Liste mit Jahres-Trennlinien + kurzer
   "Retune"-Blip beim Umschalten. Baut bewusst den kompletten
   <section id="log">, nicht nur Filter+Liste — der Blip braucht eine
   Klasse auf genau diesem Abschnitt (.rx-console.rx-retune #rx-log,
   siehe news.css), und Karten müssen als DIREKTE Kinder von #rx-log
   stehen (auch die Jahres-Marken), damit die CSS-Signalbalken-Regeln
   (:nth-of-type auf article.ncard, siehe news.css Abschnitt 4)
   unverändert greifen. */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import NewsCard, {
  type NewsCardData, type NewsCrosslink, type NewsFeedback, type NewsShareCopy, type NewsInstaCopy,
} from "./NewsCard";

/* Handgezeichnete Icons, gleicher Strichstil wie kollektiv.js'
   VALUE_ICONS/TEAM_ICONS (viewBox 24, stroke currentColor, 1.6) —
   "wrench" ist bewusst dasselbe Symbol wie dort (ein Werkzeug-Zeichen
   quer durch die Seiten statt einem zweiten, ähnlichen). */
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

export default function NewsLogSection({
  items, crosslinks, feedbacks, share, insta,
  badgeOrder, badgeIcons, allLabel, countTemplate, emptyText, yearTemplate,
}: {
  items: NewsCardData[];
  crosslinks: Record<string, NewsCrosslink | null>;
  feedbacks: Record<string, NewsFeedback | null>;
  share: NewsShareCopy;
  insta: NewsInstaCopy;
  badgeOrder?: string[];
  badgeIcons?: Record<string, string>;
  allLabel: string;
  countTemplate: string;
  emptyText: string;
  yearTemplate: string;
}) {
  const [active, setActive] = useState("all");
  const [retuning, setRetuning] = useState(false);
  const retuneTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /* Nur zum Aufräumen beim Unmount — der Blip selbst startet direkt im
     Klick-Handler (siehe selectChannel), nicht reaktiv über ein Effect,
     das auf `active` lauscht (das feuert auch beim ersten Rendern und
     bräuchte einen isFirst-Ref-Hack, um das zu unterdrücken). */
  useEffect(() => () => clearTimeout(retuneTimeout.current), []);

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
  const countText = countTemplate.replace("{shown}", String(shownCount)).replace("{total}", String(items.length));

  /* Jahres-Trennlinien als DIREKTE Geschwister der Karten (kein </p> in
     einem eigenen Grid) — lastYear startet auf dem Jahr des ERSTEN
     Eintrags, damit die allererste Karte keine Marke vorangestellt
     bekommt (nur an echten Jahresübergängen). */
  let lastYear = items[0] ? items[0].date.slice(0, 4) : null;
  const nodes: ReactNode[] = [];
  items.forEach(item => {
    const year = item.date.slice(0, 4);
    if (year && year !== lastYear) {
      nodes.push(
        <p className="rx-yearmark" key={`y-${year}`} hidden={active !== "all"}>
          {yearTemplate.replace("{year}", year)}
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

  return (
    <section className={`section rx-console${retuning ? " rx-retune" : ""}`} id="log">
      <div className="wrap">
        <header className="section-head">
          <p className="eyebrow">Archiv</p>
          <h2 className="h2">Log-Archiv</h2>
        </header>

        <div className="rx-channels" role="group" aria-label="Nach Kanal filtern">
          <button type="button" className="rx-ch" aria-pressed={active === "all"} onClick={() => selectChannel("all")}>
            {allLabel} <span className="rx-ch-n">{items.length}</span>
          </button>
          {present.map(b => (
            <button type="button" className="rx-ch" key={b} aria-pressed={active === b} onClick={() => selectChannel(b)}>
              {BADGE_ICONS[icons[b]] ?? null}
              <span>{b}</span> <span className="rx-ch-n">{counts[b] || 0}</span>
            </button>
          ))}
        </div>
        <p className="rx-count" aria-live="polite">{countText}</p>
        {shownCount === 0 && <p className="rx-count">{emptyText}</p>}

        <div className="news-list" id="rx-log">{nodes}</div>

        <div className="transmission" style={{ marginTop: 28 }}>
          <span className="tx-label">Hinweis</span>
          <p>Instagram-Posts laden erst nach Klick (Zwei-Klick, DSGVO-freundlich) — im Prototyp als Demo-Knopf. Neue Einträge kommen später direkt aus dem Admin-Dashboard.</p>
        </div>
      </div>
    </section>
  );
}
