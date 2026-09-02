import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageContent, settings } from "@/lib/data";
import type { Settings } from "@/lib/types";
import KontaktBodenstation from "@/components/pages/KontaktBodenstation";
import KontaktClock from "@/components/pages/KontaktClock";
import KontaktWegweiser, { type KontaktTopicVM } from "@/components/pages/KontaktWegweiser";
import KontaktFunkkanaele, { type KontaktChannelVM } from "@/components/pages/KontaktFunkkanaele";
import KontaktCopyButton from "@/components/pages/KontaktCopyButton";
import KontaktVCard from "@/components/pages/KontaktVCard";
import "@/styles/pages/kontakt.css";
import { pageHref } from "@/lib/site";

export const metadata: Metadata = {
  title: "Kontakt · takeoff potsdam",
  description: "Schreib uns — allgemein, Booking, Presse, Awareness oder Fundsachen.",
};

/* Spiegelt src/data/pages/kontakt.json (siehe assets/js/pages/kontakt.js im
   Prototyp für die 1:1-Referenz der Render-/Sync-Logik). Der Contract
   page-kontakt.json beschreibt dieselbe Idee als Admin-Formular; Quelle der
   Wahrheit für die Feldnamen ist hier die eingecheckte JSON. */
interface KontaktPageContent {
  hero: { eyebrow: string; h1: string; intro: string };
  station: { label: string; statusNote: string; sendPulseToast: string; copyToast: string };
  topics: {
    id: string;
    label: string;
    text?: string;
    channel: "mail" | "telegram";
    mailSubject?: string;
    mailBody?: string;
    responseNote?: string;
    linkLabel?: string;
    linkHref?: string;
  }[];
  channels: { label: string; text?: string; link?: string }[];
  channelCompare: { name: string; value: string; note?: string }[];
  faq: { q: string; a: string }[];
  vcard: { buttonLabel: string; orgName: string; note: string };
}

/* Prototyp-interne Anker (kollektiv.html#x) → echte Next-Routen. Geteilt
   zwischen Themen-Chips (topics[].linkHref) und Kanal-Zeilen
   (channels[].link), gleiche Zuordnung wie LINK_LABELS in kontakt.js.

   Die Zielpfade kommen aus dem Link-Generator, nicht als Zeichenketten —
   sonst stuende dieselbe Zuordnung ein zweites Mal im Projekt und liefe beim
   ersten Umbenennen still auseinander. */
const ROUTE_MAP: Record<string, string> = {
  "kollektiv.html#booking": pageHref("kollektiv", "booking"),
  "kollektiv.html#mitmachen": pageHref("kollektiv", "mitmachen"),
  "awareness.html#hilfe": pageHref("awareness", "hilfe"),
};
/* Beschriftung interner Kanal-Links — Portierung von LINK_LABELS aus
   kontakt.js (nur für die Funkkanäle-Liste; Themen-Chips führen ihr
   linkLabel bereits selbst im JSON). */
const CHANNEL_LINK_LABELS: Record<string, string> = {
  "kollektiv.html#booking": "Fact-Sheet ansehen",
  "kollektiv.html#mitmachen": "Offene Rollen ansehen",
  "awareness.html#hilfe": "Notfall & Soforthilfe",
};

function buildMailto(email: string, subject?: string, body?: string): string {
  const parts: string[] = [];
  if (subject) parts.push(`subject=${encodeURIComponent(subject)}`);
  if (body) parts.push(`body=${encodeURIComponent(body)}`);
  return `mailto:${email}${parts.length ? "?" + parts.join("&") : ""}`;
}

/* Portierung von linkFragment() aus kontakt.js — mit einem Unterschied:
   mailto:/Telegram lösen IMMER aus settings() auf, nicht aus dem Link-Feld
   im JSON. So pflegt man die echte Adresse an genau einer Stelle
   (Vertrag "Daten NUR über den Gateway"), das JSON entscheidet nur noch,
   OB eine Zeile eine Mail-/Telegram-/interne Verlinkung bekommt. */
function channelAction(link: string | undefined, s: Settings): ReactNode {
  if (!link) return null;
  if (link.startsWith("mailto:")) {
    return <b><a href={`mailto:${s.email}`} style={{ color: "var(--ink)" }}>{s.email}</a></b>;
  }
  if (/t\.me\//.test(link)) {
    return <b><a href={s.telegram} target="_blank" rel="noopener" style={{ color: "var(--ink)" }}>Telegram-Gruppe ↗</a></b>;
  }
  const href = ROUTE_MAP[link] ?? link;
  const label = CHANNEL_LINK_LABELS[link] ?? "Mehr dazu ansehen";
  return <Link href={href} className="fs-ch-link">{label} ↗</Link>;
}

/* H1 trägt den Glow auf dem letzten Wort; Satzzeichen bleiben außerhalb
   des Glow-Spans. Portierung von setGlowHeadline() (kontakt.js) als reine
   Render-Funktion statt DOM-Mutation — 1:1 dieselbe Logik wie glowify()
   in kollektiv/page.tsx (eigene Kopie, eigener Seiten-Namensraum). */
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

/* Deko-Item "Trümmerteil" (assets/css/style.css .ditem — theme-bedingt
   sichtbar, reines CSS-Float). Der GSAP-Scroll-Parallax aus dem Prototyp
   (data-spd) entfällt hier bewusst: kein GSAP in dieser App, und die
   Section-gebundene Deko bleibt ohne ihn genauso an ihrem Platz. */
function DitemIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v4M9 6.5h6" />
      <path d="M7 20 12 8l5 12" />
      <path d="M8.6 16h6.8" />
    </svg>
  );
}

const DITEM_STYLE = { "--top": "4%", "--left": "auto", "--right": "1vw" } as CSSProperties;

export default async function KontaktPage() {
  const [page, s] = await Promise.all([
    pageContent<KontaktPageContent>("kontakt"),
    settings(),
  ]);
  if (!page) notFound();

  /* Kanal-Zeilen (Radar + Liste) — dynamisch aus pageContent("kontakt"). */
  const channels: KontaktChannelVM[] = page.channels.map((c, i) => ({
    ch: String(i + 1).padStart(2, "0"),
    label: c.label,
    text: c.text || undefined,
    action: channelAction(c.link, s),
    calm: c.label.trim().toLowerCase() === "awareness",
  }));

  /* Themen-Chips — mailto/Telegram-Hrefs aus settings(), CH-Tag parallel
     zur Kanal-Liste (gleiche Reihenfolge/Länge in kontakt.json, wie schon
     im Prototyp über die Chip-Position statt eine explizite Fremdreferenz
     bestimmt — siehe chFromChip() in kontakt.js). */
  const topics: KontaktTopicVM[] = page.topics.map((t, i) => {
    const isTelegram = t.channel === "telegram";
    return {
      id: t.id,
      label: t.label,
      href: isTelegram ? s.telegram : buildMailto(s.email, t.mailSubject, t.mailBody),
      pulse: isTelegram ? "telegram" : "mail",
      ch: String(i + 1).padStart(2, "0"),
      text: t.text,
      responseNote: t.responseNote,
      crossHref: t.linkHref ? (ROUTE_MAP[t.linkHref] ?? t.linkHref) : undefined,
      crossLabel: t.linkLabel,
    };
  });

  return (
    <>
      <KontaktBodenstation stationLabel={page.station.label} sendToast={page.station.sendPulseToast} />

      <section className="phero">
        <div className="wrap">
          <p className="eyebrow">{page.hero.eyebrow}</p>
          <h1>{glowify(page.hero.h1)}</h1>
          <p className="section-intro">{page.hero.intro}</p>
          <p className="fs-status">
            <span className="fs-dot" aria-hidden="true" />
            {/* Extra Hülle noetig: .fs-status ist display:inline-flex, direkte
                Flex-Items werden von der Blockification-Regel der Flexbox-Spec
                automatisch zu display:block gezwungen (nachgemessen) — genau
                das wuerde .txplate seinen inline-Charakter nehmen und
                box-decoration-break wirkungslos machen. Eine Ebene tiefer
                greift die Regel nicht mehr. */}
            <span><span className="txplate">{page.station.statusNote} · <KontaktClock /> Uhr Potsdam</span></span>
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "clamp(20px, 3vh, 34px)" }}>
        <div className="wrap">
          <header className="section-head reveal">
            <p className="eyebrow">Anliegen-Wegweiser</p>
            <h2 className="h2">Wonach suchst du?</h2>
            <p className="section-intro">Wähl dein Anliegen — wir sagen dir, welcher Kanal am besten passt, und bauen dir die Mail direkt vor.</p>
          </header>
          <KontaktWegweiser topics={topics} />
        </div>
      </section>

      <section className="section" style={{ paddingTop: "clamp(20px, 3vh, 34px)" }}>
        <div className="wrap">
          <header className="section-head reveal">
            <p className="eyebrow">Funkkanäle</p>
            <h2 className="h2">Wähl deinen Kanal</h2>
          </header>

          <span className="ditem d-space" style={DITEM_STYLE} aria-hidden="true"><DitemIcon /></span>
          <span className="ditem d-mars" style={DITEM_STYLE} aria-hidden="true"><DitemIcon /></span>
          <span className="ditem d-strand" style={DITEM_STYLE} aria-hidden="true"><DitemIcon /></span>

          <KontaktFunkkanaele channels={channels} />

          <div className="cta-row" style={{ marginTop: 24 }}>
            <a className="btn btn-primary" data-fs-pulse="mail" href={buildMailto(s.email)}>Mail schreiben</a>
            <a className="btn btn-ghost" data-fs-pulse="telegram" href={s.telegram} target="_blank" rel="noopener">Telegram öffnen</a>
            <KontaktCopyButton email={s.email} copyToast={page.station.copyToast} />
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "clamp(20px, 3vh, 34px)" }}>
        <div className="wrap">
          <header className="section-head reveal">
            <p className="eyebrow">Kanal-Vergleich</p>
            <h2 className="h2">Was passt zu dir?</h2>
            <p className="section-intro">Für Vertrauliches: lieber Mail. Für schnelle Fragen: Telegram — aber öffentlich, alle lesen mit.</p>
          </header>
          <div className="fs-compare">
            {page.channelCompare.map(c => (
              <div className="fs-compare-item" key={c.name}>
                <b>{c.name}</b>
                <span>{c.value}</span>
                <small>{c.note ?? ""}</small>
              </div>
            ))}
          </div>
          <div className="fs-vcard">
            <KontaktVCard
              buttonLabel={page.vcard.buttonLabel}
              note={page.vcard.note}
              orgName={page.vcard.orgName}
              email={s.email}
              telegram={s.telegram}
              instagram={s.instagram}
            />
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "clamp(20px, 3vh, 34px)" }}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <header className="section-head reveal">
            <p className="eyebrow">Bevor du schreibst</p>
            <h2 className="h2">Häufig gefragt</h2>
          </header>
          <div className="fs-faqlist">
            {page.faq.map(item => (
              <details className="faq" key={item.q}>
                <summary>{item.q}</summary>
                <div className="faq-body">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
