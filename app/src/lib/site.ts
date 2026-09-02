/* ============================================================
   Zentrale Link- & Navigations-Quelle ("der Generator").
   ALLE Menüs, Footer-Spalten und Querverweise speisen sich hier —
   eine neue Seite wird GENAU HIER eingetragen und erscheint damit
   überall (Nav/Menü/Footer). Nie Links in Komponenten hartkodieren.
   ============================================================ */

export interface SiteLink {
  href: string;
  /** Deutsche Beschriftung. Dient als Fallback, wenn `key` fehlt. */
  label: string;
  /** i18n-Schlüssel der Beschriftung. Ohne ihn bliebe die Nav auch auf
      Englisch deutsch — Link-Generator und Wörterbuch müssen zusammenspielen. */
  key?: string;
  note?: string;         // Zusatzzeile im Burger-Menü (deutscher Fallback)
  /** i18n-Schlüssel der Zusatzzeile. */
  noteKey?: string;
  nav?: boolean;         // erscheint in der Haupt-Navigation
  menu?: boolean;        // erscheint im Burger-Menü
  footer?: "kollektiv" | "kontakt";  // Footer-Spalte
}

export const SITE_LINKS: SiteLink[] = [
  { href: "/events",      label: "Events",      key: "nav.events",      note: "Flugplan & Flight Log", noteKey: "menu.events.note",     nav: true, menu: true },
  { href: "/artists",     label: "Artists",     key: "nav.artists",     note: "Sets & Podcasts",       noteKey: "menu.artists.note",    nav: true, menu: true },
  { href: "/kollektiv",   label: "Kollektiv",   key: "nav.kollektiv",   note: "Wer hier funkt",        noteKey: "menu.kollektiv.note",  nav: true, menu: true, footer: "kollektiv" },
  { href: "/awareness",   label: "Awareness",   key: "nav.awareness",   note: "Hilfe & Regeln",        noteKey: "menu.awareness.note",  nav: true, menu: true, footer: "kollektiv" },
  { href: "/news",        label: "News",        key: "nav.news",        note: "Mission Log",           noteKey: "menu.news.note",                 menu: true, footer: "kollektiv" },
  { href: "/kalender",    label: "Kalender",    key: "nav.kalender",    note: "Abo & Termine",         noteKey: "menu.kalender.note",             menu: true, footer: "kollektiv" },
  { href: "/team",        label: "Team",        key: "footer.team",     note: "Die Crew",                                                                      footer: "kollektiv" },
  { href: "/musik",       label: "Unser Sound", key: "nav.musik",       note: "Genre-Guide",                                                                   footer: "kollektiv" },
  { href: "/kontakt",     label: "Kontakt",     key: "nav.kontakt",     note: "Schreib uns",           noteKey: "menu.kontakt.note",              menu: true, footer: "kontakt" },
  /* Interner Bereich. Bewusst NUR im Footer, nicht in Nav oder Menue:
     wer dazugehoert, findet ihn — wer nicht, stolpert nicht darueber.
     Die Seiten selbst sind ohnehin durch proxy.ts und noindex geschuetzt;
     ein unauffindbarer Bereich wird dagegen schlicht nicht benutzt. */
  { href: "/crew",        label: "Crew-Bereich", key: "nav.crew",
    note: "Intern · Anmeldung nötig", noteKey: "nav.crew.note",     footer: "kontakt" },
  { href: "/impressum",   label: "Impressum",   key: "footer.imprint",                                                                                         footer: "kontakt" },
  { href: "/datenschutz", label: "Datenschutz", key: "footer.privacy",                                                                                         footer: "kontakt" },
];

export const navLinks = () => SITE_LINKS.filter(l => l.nav);
export const menuLinks = () => SITE_LINKS.filter(l => l.menu);
export const footerLinks = (col: "kollektiv" | "kontakt") => SITE_LINKS.filter(l => l.footer === col);

/* Einzelverweise im Fließtext.

   Bisher fehlte genau das: der Generator bot nur die Sammel-Getter, also
   standen Querverweise als rohe Strings in den Seiten ("/kollektiv#mitmachen").
   Die stimmten zwar zufällig, wären aber beim ersten Umbenennen still kaputt
   gegangen. `href()` schlägt in SITE_LINKS nach und wirft beim Bauen, wenn die
   Seite dort nicht steht — eine neue Seite MUSS also oben eingetragen werden.

   Nutzung: pageHref("kollektiv") · pageHref("kollektiv", "mitmachen")

   Bewusst nicht `href` genannt: der Bezeichner kollidiert in Seiten zu leicht
   mit lokalen Variablen gleichen Namens. */
export type SiteKey =
  | "events" | "artists" | "kollektiv" | "awareness" | "news"
  | "kalender" | "team" | "musik" | "kontakt" | "impressum" | "datenschutz"
  | "crew";

export function pageHref(key: SiteKey, anchor?: string): string {
  const link = SITE_LINKS.find(l => l.href === `/${key}`);
  if (!link) throw new Error(`site.ts: unbekannte Seite "${key}" — erst in SITE_LINKS eintragen.`);
  return anchor ? `${link.href}#${anchor}` : link.href;
}

/* Label einer Seite — damit auch Linktexte aus einer Quelle kommen. */
export const label = (key: SiteKey): string =>
  SITE_LINKS.find(l => l.href === `/${key}`)?.label ?? key;

/* Event-Detailseiten sind dynamisch: /events/<slug> */
export const eventHref = (slug: string) => `/events/${slug}`;
export const artistHref = (slug: string) => `/artists/${slug}`;
