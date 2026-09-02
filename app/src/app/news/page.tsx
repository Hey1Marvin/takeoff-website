import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { pageContent, news, upcoming, fmtDate } from "@/lib/data";
import { eventHref, artistHref } from "@/lib/site";
import type { NewsPost } from "@/lib/types";
import NewsRxArray from "@/components/pages/NewsRxArray";
import NewsCard, { type NewsCardData, type NewsCrosslink, type NewsFeedback, type NewsShareCopy, type NewsInstaCopy } from "@/components/pages/NewsCard";
import NewsLogSection from "@/components/pages/NewsLogSection";
import "@/styles/pages/news.css";

export const metadata: Metadata = {
  title: "News · Mission Log · takeoff potsdam",
  description: "Was bei takeoff passiert: Baulogs, Ankündigungen, Recaps und Podcast-Releases.",
};

/* Spiegelt src/data/pages/news.json (siehe assets/js/pages/news.js im
   Prototyp für die 1:1-Referenz der Render-Logik: cardHtml/buildLogHtml/
   setStatus/setStats/renderChannels). Der Contract page-news-seite.json
   beschreibt dieselbe Idee als Admin-Formular; Quelle der Wahrheit für die
   Feldnamen ist hier die eingecheckte JSON, wie von AGENTS.md vorgegeben. */
interface NewsPageContent {
  hero: { eyebrow: string; h1: string; intro: string };
  status?: { prefix?: string; todayLabel?: string; dayLabel?: string; daysTemplate?: string; fallback?: string };
  terminal?: { label?: string; typewriter?: boolean; charMs?: number };
  stats?: { totalLabel?: string; topBadgeLabel?: string; sinceLabel?: string };
  filter?: {
    allLabel?: string;
    countTemplate?: string;
    emptyText?: string;
    badgeOrder?: string[];
    badgeIcons?: Record<string, string>;
  };
  yearDivider?: { template?: string };
  crosslinks?: Record<string, { eventSlug?: string; artistSlug?: string; href: string; label: string }>;
  countdown?: { template?: string; tomorrowLabel?: string; todayLabel?: string };
  share?: { buttonLabel?: string; copiedToast?: string; telegramIntent?: boolean; telegramLabel?: string };
  instaCard?: { buttonLabel?: string; consentNote?: string };
  channelCta: { eyebrow?: string; title?: string; text?: string; ctaLabel?: string; ctaHref?: string };
  crossPromo?: { historyLabel?: string; historyHref?: string; calendarLabel?: string; calendarHref?: string };
  feedback?: { eyebrow?: string; prompt?: string; linkLabel?: string; mailSubjectTemplate?: string; mailTo?: string };
  faq: { q: string; a: string }[];
  emptyState?: { eyebrow?: string; title?: string; text?: string; ctaLabel?: string; ctaHref?: string };
  statusBanner?: { active?: boolean; label?: string; text?: string; href?: string };
}

/* H1 trägt den Glow auf dem letzten Wort (Contract: "Das letzte Wort wird
   automatisch leuchtend hervorgehoben") — Portierung von setGlowHeadline
   (news.js/kollektiv.js) als reine Render-Funktion statt DOM-Mutation. */
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
   Tag zu wenig zählt. 1:1 die Idee aus daysBetween() (news.js), hier aber
   serverseitig einmal berechnet statt clientseitig bei jedem Reload. */
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
  });

  const shareCopy: NewsShareCopy = {
    buttonLabel: page.share?.buttonLabel || "Teilen",
    telegramLabel: page.share?.telegramLabel || "Telegram",
    showTelegram: page.share?.telegramIntent !== false,
    copiedToast: page.share?.copiedToast || "Link kopiert ✓",
  };
  const instaCopy: NewsInstaCopy = {
    buttonLabel: page.instaCard?.buttonLabel || "Instagram-Post ansehen · lädt erst nach Klick",
    consentNote: page.instaCard?.consentNote || "Zwei-Klick-Schutz: Erst nach diesem Klick lädt Instagram nach (DSGVO-freundlich).",
  };

  /* ============ FAQ + Kanal-CTA — unabhängig von News-Daten, in beiden
     Zweigen (leer/befüllt) identisch, deshalb einmal vorbereitet. ============ */
  const faqCta = (
    <section className="section" id="empfang">
      <div className="wrap">
        <header className="section-head">
          <p className="eyebrow">Bevor du fragst</p>
          <h2 className="h2">Häufige Fragen</h2>
        </header>
        <dl className="rx-faq" id="rx-faq">
          {page.faq.map(item => (
            <div className="m-row" key={item.q}><dt>{item.q}</dt><dd>{item.a}</dd></div>
          ))}
        </dl>

        <div className="rx-cta" style={{ marginTop: 48 }}>
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
    </section>
  );

  /* ============ Leerzustand — nur wenn news() wirklich nichts liefert.
     (Aktuell 5 Einträge; Zweig bleibt für spätere Admin-Löschungen.) ============ */
  if (allNews.length === 0) {
    const es = page.emptyState;
    return (
      <>
        <NewsRxArray />
        <section className="phero">
          <div className="wrap">
            <p className="eyebrow">{page.hero.eyebrow}</p>
            <h1>{glowify(page.hero.h1)}</h1>
            <p className="section-intro">{page.hero.intro}</p>
            <p className="rx-status">{page.status?.fallback || "Empfangsbereit — der neueste Funkspruch steht unten."}</p>
          </div>
        </section>

        <section className="section rx-console" id="log">
          <div className="wrap">
            <header className="section-head">
              <p className="eyebrow">Archiv</p>
              <h2 className="h2">Log-Archiv</h2>
            </header>
            <div className="transmission rx-empty">
              <span className="tx-label">{es?.eyebrow || "Funkstille"}</span>
              <p>
                <strong>{es?.title || "Noch keine Übertragung"}</strong><br />
                <span className="es-text">{es?.text || "Kein Funkspruch gerade — aber Telegram weiß es zuerst, wenn sich das ändert."}</span>
              </p>
              <div className="cta-row" style={{ justifyContent: "center", marginTop: 16 }}>
                <a className="btn btn-primary" href={es?.ctaHref || "https://t.me/takeoffpotsdam"} target="_blank" rel="noopener">
                  {es?.ctaLabel || "Telegram beitreten"}
                </a>
              </div>
            </div>
          </div>
        </section>

        {faqCta}
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

  const statusText = `${page.status?.prefix || "Letzte Transmission"}: ${sinceLabel(daysSince(latest.date), page.status)} (${fmtDate(latest.date)})`;

  return (
    <>
      <NewsRxArray />

      <section className="phero">
        <div className="wrap">
          <p className="eyebrow">{page.hero.eyebrow}</p>
          <h1>{glowify(page.hero.h1)}</h1>
          <p className="section-intro">{page.hero.intro}</p>
          <p className="rx-status">{statusText}</p>
          <div className="rx-readout" aria-label="Signal-Statistik">
            <span className="rx-ro-item"><i>{page.stats?.totalLabel || "Funksprüche gesamt"}</i><b>{allNews.length}</b></span>
            <span className="rx-ro-item"><i>{page.stats?.topBadgeLabel || "Häufigstes Badge"}</i><b>{topCount > 1 ? `${topBadge} ×${topCount}` : topBadge}</b></span>
            <span className="rx-ro-item"><i>{page.stats?.sinceLabel || "Letzte Übertragung"}</i><b>{sinceLabel(daysSince(latest.date), page.status)}</b></span>
          </div>
          {page.statusBanner?.active && (
            <div className="rx-banner">
              <b>{page.statusBanner.label || "Lage-Update"}</b>
              <span>{page.statusBanner.text}</span>
              {page.statusBanner.href && <a href={page.statusBanner.href}>Mehr →</a>}
            </div>
          )}
        </div>
      </section>

      <section className="section rx-console" style={{ paddingTop: "clamp(24px, 4vh, 40px)", paddingBottom: 0 }}>
        <div className="wrap">
          <span className="rx-live"><i className="rx-live-dot" aria-hidden="true"></i>{page.terminal?.label || "Eingehend"}</span>
          <div id="rx-latest">
            <NewsCard
              item={toCardData(latest)}
              featured
              typewriter={page.terminal?.typewriter !== false}
              charMs={Number(page.terminal?.charMs) || 24}
              crosslink={crosslinkFor(latest.id)}
              feedback={feedbackFor(latest, latestRecapId)}
              share={shareCopy}
              insta={instaCopy}
            />
          </div>
        </div>
      </section>

      <NewsLogSection
        items={rest.map(toCardData)}
        crosslinks={Object.fromEntries(rest.map(n => [n.id, crosslinkFor(n.id)]))}
        feedbacks={Object.fromEntries(rest.map(n => [n.id, feedbackFor(n, latestRecapId)]))}
        share={shareCopy}
        insta={instaCopy}
        badgeOrder={page.filter?.badgeOrder}
        badgeIcons={page.filter?.badgeIcons}
        allLabel={page.filter?.allLabel || "Alle"}
        countTemplate={page.filter?.countTemplate || "{shown} von {total} Funksprüchen"}
        emptyText={page.filter?.emptyText || "Nichts mit diesem Badge — versuch „Alle“."}
        yearTemplate={page.yearDivider?.template || "— {year} —"}
      />

      {faqCta}
    </>
  );
}
