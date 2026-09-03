import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { pageContent, news, upcoming, fmtDate } from "@/lib/data";
import { eventHref, artistHref } from "@/lib/site";
import type { NewsPost } from "@/lib/types";
import NewsRxArray from "@/components/pages/NewsRxArray";
import NewsConsole, { type NewsConsoleCopy, type NewsReadoutItem } from "@/components/pages/NewsConsole";
import type { NewsCardData, NewsCrosslink, NewsFeedback, NewsShareCopy, NewsInstaCopy } from "@/components/pages/NewsCard";
import "@/styles/pages/news.css";

export const metadata: Metadata = {
  title: "News · Mission Log · takeoff potsdam",
  description: "Was bei takeoff passiert: Baulogs, Ankündigungen, Recaps und Podcast-Releases.",
};

/* Spiegelt src/data/pages/news.json. Quelle der Wahrheit für die Feldnamen
   ist die eingecheckte JSON, wie von AGENTS.md vorgegeben — der Contract
   page-news-seite.json beschreibt dieselbe Idee als Admin-Formular. */
interface NewsPageContent {
  hero: { eyebrow: string; h1: string; intro: string };
  status?: { prefix?: string; todayLabel?: string; dayLabel?: string; daysTemplate?: string; fallback?: string };
  terminal?: { label?: string; typewriter?: boolean; charMs?: number };
  station?: { eyebrow?: string; scopeCaption?: string; readoutLabel?: string; channelsLabel?: string; channelsAria?: string };
  stats?: { totalLabel?: string; topBadgeLabel?: string; sinceLabel?: string };
  filter?: {
    allLabel?: string;
    countTemplate?: string;
    emptyText?: string;
    badgeOrder?: string[];
    badgeIcons?: Record<string, string>;
  };
  archive?: { eyebrow?: string; title?: string };
  hint?: { label?: string; text?: string };
  yearDivider?: { template?: string };
  crosslinks?: Record<string, { eventSlug?: string; artistSlug?: string; href: string; label: string }>;
  countdown?: { template?: string; tomorrowLabel?: string; todayLabel?: string };
  share?: { buttonLabel?: string; copiedToast?: string; telegramIntent?: boolean; telegramLabel?: string; groupAria?: string };
  instaCard?: { buttonLabel?: string; consentNote?: string; openLabel?: string };
  faqSection?: { eyebrow?: string; title?: string };
  channelCta: { eyebrow?: string; title?: string; text?: string; ctaLabel?: string; ctaHref?: string };
  crossPromo?: { historyLabel?: string; historyHref?: string; calendarLabel?: string; calendarHref?: string };
  feedback?: { eyebrow?: string; prompt?: string; linkLabel?: string; mailSubjectTemplate?: string; mailTo?: string };
  faq: { q: string; a: string }[];
  emptyState?: { eyebrow?: string; title?: string; text?: string; ctaLabel?: string; ctaHref?: string };
  statusBanner?: { active?: boolean; label?: string; text?: string; href?: string };
}

/* H1 trägt den Glow auf dem letzten Wort (Contract: "Das letzte Wort wird
   automatisch leuchtend hervorgehoben") — reine Render-Funktion statt
   DOM-Mutation. */
function glowify(text: string): ReactNode {
  const words = text.trim().split(/\s+/);
  if (!words.length) return text;
  const last = words.pop()!;
  const trailMatch = last.match(/([.!?…,;:]+)$/);
  const trail = trailMatch ? trailMatch[1] : "";
  const word = trail ? last.slice(0, -trail.length) : last;
  return (
    <>
      {words.length ? words.join(" ") + " " : ""}
      <span className="glow">{word}</span>
      {trail}
    </>
  );
}

/* Eine Grundfunktion (Tage seit/bis, auf lokale Mitternacht normiert) für
   beide Richtungen — vermeidet, dass ein Countdown je nach Tageszeit einen
   Tag zu wenig zählt. Serverseitig einmal berechnet. */
function daysSince(iso: string): number {
  const target = new Date(iso + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((now.getTime() - target.getTime()) / 86400000);
}
function daysUntil(iso: string): number {
  return -daysSince(iso);
}
function sinceLabel(days: number, cfg?: NewsPageContent["status"]): string {
  if (days <= 0) return cfg?.todayLabel || "heute";
  if (days === 1) return cfg?.dayLabel || "vor 1 Tag";
  return (cfg?.daysTemplate || "vor {days} Tagen").replace("{days}", String(days));
}
function countdownLabel(days: number, cfg?: NewsPageContent["countdown"]): string {
  if (days <= 0) return cfg?.todayLabel || "→ heute!";
  if (days === 1) return cfg?.tomorrowLabel || "→ morgen";
  return (cfg?.template || "→ in {days} Tagen").replace("{days}", String(days));
}

/* Signalstärke aus dem ALTER, nicht aus der Listenposition.
   Vorher färbte news.css die Balken über `article.ncard:nth-of-type(n)` ein.
   Das ist ein Positions-Selektor: sobald der Kanalfilter die Liste
   clientseitig ausdünnt (oder ein Nicht-<article> dazwischenrutscht),
   zeigt er still den falschen Wert an — die vierte sichtbare Karte trug
   dann die Stärke der vierten Karte im Quelltext. Die Stufen sind grob und
   bewusst nicht linear: "diesen Monat / dieses Quartal / dieses Jahr /
   älter". */
function signalStrength(iso: string): 1 | 2 | 3 | 4 {
  const d = daysSince(iso);
  if (d <= 45) return 4;
  if (d <= 120) return 3;
  if (d <= 400) return 2;
  return 1;
}

/* Prototyp-interne Querverweise ("kollektiv.html#history", "kalender.html")
   → Next-Routen. Event-/Artist-Slugs laufen über den Generator (@/lib/site),
   alles andere wird generisch abgebildet (kein Hardcoding einzelner Ziele). */
function protoHrefToRoute(href: string): string {
  const [file, hash] = href.split("#");
  const slug = file.replace(/\.html$/, "");
  const path = slug === "" || slug === "index" ? "/" : `/${slug}`;
  return hash ? `${path}#${hash}` : path;
}

export default async function NewsPage() {
  const [page, allNews, upcomingEvents] = await Promise.all([
    pageContent<NewsPageContent>("news"),
    news(),
    upcoming(),
  ]);
  if (!page) notFound();

  const upcomingBySlug = new Map(upcomingEvents.map(e => [e.slug, e]));

  function crosslinkFor(id: string): NewsCrosslink | null {
    const cfg = page!.crosslinks?.[id];
    if (!cfg) return null;
    const href = cfg.eventSlug
      ? eventHref(cfg.eventSlug)
      : cfg.artistSlug
      ? artistHref(cfg.artistSlug)
      : protoHrefToRoute(cfg.href);
    let countdownText: string | undefined;
    if (cfg.eventSlug && upcomingBySlug.has(cfg.eventSlug)) {
      countdownText = countdownLabel(daysUntil(upcomingBySlug.get(cfg.eventSlug)!.date), page!.countdown);
    }
    return { href, label: cfg.label, countdownText };
  }

  function feedbackFor(n: NewsPost, latestRecapId?: string): NewsFeedback | null {
    if (n.id !== latestRecapId) return null;
    const fb = page!.feedback || {};
    const subject = (fb.mailSubjectTemplate || "Feedback – {event}").replace("{event}", n.title);
    return {
      eyebrow: fb.eyebrow || "Warst du dabei?",
      prompt: fb.prompt || "Wie war die letzte Mission?",
      linkLabel: fb.linkLabel || "Kurz Feedback schicken →",
      mailHref: `mailto:${fb.mailTo || "info@takeoff-potsdam.de"}?subject=${encodeURIComponent(subject)}`,
    };
  }

  const toCardData = (n: NewsPost): NewsCardData => ({
    id: n.id,
    badge: n.badge,
    accentRgb: n.accentRgb,
    date: n.date,
    dateFormatted: fmtDate(n.date),
    title: n.title,
    text: n.text,
    instaUrl: n.instaUrl,
    strength: signalStrength(n.date),
  });

  const shareCopy: NewsShareCopy = {
    buttonLabel: page.share?.buttonLabel || "Teilen",
    telegramLabel: page.share?.telegramLabel || "Telegram",
    showTelegram: page.share?.telegramIntent !== false,
    copiedToast: page.share?.copiedToast || "Link kopiert ✓",
    groupAria: page.share?.groupAria || "Diesen Funkspruch teilen",
  };
  const instaCopy: NewsInstaCopy = {
    buttonLabel: page.instaCard?.buttonLabel || "Instagram-Post ansehen · lädt erst nach Klick",
    consentNote: page.instaCard?.consentNote || "Zwei-Klick-Schutz: Erst dieser zweite Klick geht zu Instagram.",
    openLabel: page.instaCard?.openLabel || "Bei Instagram öffnen ↗",
  };
  const station = page.station || {};

  /* ============ Empfangsschalter: FAQ + Kanal-CTA ============
     Zwei Spalten statt einer zentrierten 720px-Liste auf 1440px. Der
     redaktionelle Abschluss ist damit selbst eine Komposition und nicht
     noch ein Textstapel in der Mitte. In beiden Zweigen (leer/befüllt)
     identisch, deshalb einmal vorbereitet. */
  const empfang = (
    <section className="section rx-sec rx-reception" id="empfang">
      <div className="wrap">
        <div className="rx-desk">
          <div className="rx-desk-faq">
            {/* `.reveal`: die geteilte Scroll-Choreografie (SceneReveals.tsx,
                takeoff.css) — sonst hatte der Empfangsschalter als einzige
                Sektion der Seite keinerlei Bewegungsmoment, weder den
                Typewriter oben noch irgendeinen Übergang beim Reinscrollen. */}
            <header className="section-head reveal">
              <p className="eyebrow">{page.faqSection?.eyebrow || "Bevor du fragst"}</p>
              <h2 className="h2">{page.faqSection?.title || "Häufige Fragen"}</h2>
            </header>
            <dl className="rx-faq" id="rx-faq">
              {page.faq.map(item => (
                <div className="m-row" key={item.q}><dt>{item.q}</dt><dd>{item.a}</dd></div>
              ))}
            </dl>
          </div>

          <div className="rx-cta reveal">
            <p className="eyebrow">{page.channelCta.eyebrow}</p>
            <h2>{page.channelCta.title}</h2>
            <p>{page.channelCta.text}</p>
            <div className="cta-row">
              <a className="btn btn-primary" href={page.channelCta.ctaHref} target="_blank" rel="noopener">
                {page.channelCta.ctaLabel}
              </a>
            </div>
            {page.crossPromo && (
              <div className="rx-promo">
                {page.crossPromo.historyHref && (
                  <a href={protoHrefToRoute(page.crossPromo.historyHref)}>{page.crossPromo.historyLabel}</a>
                )}
                {page.crossPromo.calendarHref && (
                  <a href={protoHrefToRoute(page.crossPromo.calendarHref)}>{page.crossPromo.calendarLabel}</a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );

  const hero = (banner: boolean) => (
    <section className="phero rx-sec rx-hero">
      <div className="wrap">
        <p className="eyebrow">{page.hero.eyebrow}</p>
        <h1>{glowify(page.hero.h1)}</h1>
        <p className="section-intro">{page.hero.intro}</p>
        {banner && page.statusBanner?.active && (
          <div className="rx-banner">
            <b>{page.statusBanner.label || "Lage-Update"}</b>
            <span>{page.statusBanner.text}</span>
            {page.statusBanner.href && <a href={page.statusBanner.href}>Mehr →</a>}
          </div>
        )}
      </div>
    </section>
  );

  /* ============ Leerzustand — nur wenn news() wirklich nichts liefert.
     (Aktuell 5 Einträge; Zweig bleibt für spätere Admin-Löschungen.) ============ */
  if (allNews.length === 0) {
    const es = page.emptyState;
    return (
      <>
        {hero(false)}

        <section className="section rx-sec rx-station">
          <div className="wrap">
            <div className="rx-deck rx-deck--empty">
              <aside className="rx-rail">
                <div className="rx-rail-inner">
                  <p className="rx-rail-eyebrow">{station.eyebrow || "Bodenstation"}</p>
                  <NewsRxArray caption={station.scopeCaption} />
                  <p className="rx-status">{page.status?.fallback || "Empfangsbereit — der neueste Funkspruch steht unten."}</p>
                </div>
              </aside>
              <div className="rx-feed">
                <div className="transmission rx-empty">
                  <span className="tx-label">{es?.eyebrow || "Funkstille"}</span>
                  <p>
                    <strong>{es?.title || "Noch keine Übertragung"}</strong><br />
                    <span className="es-text">{es?.text || "Kein Funkspruch gerade — aber Telegram weiß es zuerst, wenn sich das ändert."}</span>
                  </p>
                  <div className="cta-row rx-empty-cta">
                    <a className="btn btn-primary" href={es?.ctaHref || "https://t.me/takeoffpotsdam"} target="_blank" rel="noopener">
                      {es?.ctaLabel || "Telegram beitreten"}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {empfang}
      </>
    );
  }

  /* ============ Regulärer Fall ============ */
  const [latest, ...rest] = allNews;
  const latestRecap = allNews.find(n => n.badge === "Recap");
  const latestRecapId = latestRecap?.id;

  const badgeCounts: Record<string, number> = {};
  allNews.forEach(n => { badgeCounts[n.badge] = (badgeCounts[n.badge] || 0) + 1; });
  let topBadge = allNews[0].badge, topCount = 0;
  Object.entries(badgeCounts).forEach(([b, c]) => { if (c > topCount) { topBadge = b; topCount = c; } });

  const readout: NewsReadoutItem[] = [
    { label: page.stats?.totalLabel || "Funksprüche gesamt", value: String(allNews.length) },
    { label: page.stats?.topBadgeLabel || "häufigstes Badge", value: topCount > 1 ? `${topBadge} ×${topCount}` : topBadge },
    /* Datum direkt am Wert: die frühere eigene Statuszeile
       ("Letzte Transmission: vor 11 Tagen (23.08.26)") sagte exakt
       dasselbe wie diese Zeile und stand zweimal untereinander. */
    {
      label: page.stats?.sinceLabel || "letzte Übertragung",
      value: `${sinceLabel(daysSince(latest.date), page.status)} · ${fmtDate(latest.date)}`,
    },
  ];

  const consoleCopy: NewsConsoleCopy = {
    liveLabel: page.terminal?.label || "Eingehend",
    stationEyebrow: station.eyebrow || "Bodenstation",
    scopeCaption: station.scopeCaption || "",
    readoutLabel: station.readoutLabel || "Signal-Statistik",
    channelsLabel: station.channelsLabel || "Kanäle",
    channelsAria: station.channelsAria || "Nach Kanal filtern",
    allLabel: page.filter?.allLabel || "Alle",
    countTemplate: page.filter?.countTemplate || "{shown} von {total} Funksprüchen",
    emptyText: page.filter?.emptyText || "Nichts mit diesem Badge — versuch „Alle“.",
    yearTemplate: page.yearDivider?.template || "— {year} —",
    archiveTitle: page.archive?.title || "Log-Archiv",
    hintLabel: page.hint?.label || "Hinweis",
    hintText: page.hint?.text || "",
  };

  return (
    <>
      {hero(true)}

      <NewsConsole
        latest={toCardData(latest)}
        items={rest.map(toCardData)}
        crosslinks={Object.fromEntries(allNews.map(n => [n.id, crosslinkFor(n.id)]))}
        feedbacks={Object.fromEntries(allNews.map(n => [n.id, feedbackFor(n, latestRecapId)]))}
        share={shareCopy}
        insta={instaCopy}
        typewriter={page.terminal?.typewriter !== false}
        charMs={Number(page.terminal?.charMs) || 24}
        copy={consoleCopy}
        readout={readout}
        badgeOrder={page.filter?.badgeOrder}
        badgeIcons={page.filter?.badgeIcons}
      />

      {empfang}
    </>
  );
}
