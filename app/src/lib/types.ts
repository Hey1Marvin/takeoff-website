/* Zentrale Datentypen — Spiegel der Contracts (assets/data/contracts/).
   Bei Supabase werden daraus die Tabellen; die Typen bleiben. */

export interface Venue {
  name: string;
  address: string;
  transit: string;
  mapsQuery: string;
}

export interface LineupSlot {
  name: string;
  genres?: string;
  time?: string;
}

export interface EventTheme {
  preset?: "space" | "mars" | "strand" | string;
  accent: string;
  accentRgb: string;
  patch: string;
}

export interface TakeoffEvent {
  slug: string;
  visible: boolean;
  state: "upcoming" | "tba" | "past" | string;
  patchNo?: string;
  title: string;
  subtitle: string;
  date: string;            // ISO yyyy-mm-dd
  weekday: string;
  doors: string;
  end: string;
  venue: Venue;
  pricing: { mode: string; label: string };
  age: string;
  genres: string[];
  lineup: LineupSlot[];
  brief: string;
  extras?: string[];
  stats?: { n: string; l: string }[];
  gallery?: string[];
  theme: EventTheme;
  image?: string;
  page?: string;
  raLink?: string;
  /* Nur intern, nie gerendert (Contract: internalNote). */
  internalNote?: string;
}

export interface Artist {
  slug: string;
  initials: string;
  name: string;
  role: string;
  genres: string;
  since?: string;
  bio: string;
  sets: { title: string; meta: string }[];
  appearances: string[];   // Event-Slugs
  page?: string;
  visible?: boolean;
}

export interface TeamMember {
  /* Primaerschluessel laut Contract (spaeter Supabase-Key). */
  slug: string;
  initials?: string;
  icon?: string;
  name: string;
  role: string;
  visible?: boolean;
}

export interface NewsPost {
  id: string;
  badge: string;
  accentRgb: string;
  date: string;
  title: string;
  text: string;
  instaUrl?: string;
}

export interface HistoryEntry {
  patch: string;
  date: string;
  name: string;
  venue: string;
  note?: string;
}

export interface Partner {
  slug: string;
  name: string;
  url?: string;
  logo?: string;
  beschreibung?: string;
  /** Slugs der Events, bei denen der Partner dabei war. */
  events?: string[];
  visible?: boolean;
}

export interface Settings {
  siteName: string;
  claim: string;
  email: string;
  telegram: string;
  instagram: string;
  soundcloud: string;
  tiktok: string;
  nextEventSlug: string;
  showEvents: string[];
  /* Zusaetzliche redaktionelle Ticker-Zeilen. Die Zeilen der kommenden Events
     erzeugt tickerLines() aus den Event-Daten — hier steht nur, was darueber
     hinaus laufen soll. */
  hudTicker: string[];
  /* Vom Contract deklariert und vom Boot-Script gelesen. */
  fxDefault: "s" | "m" | "l";
  groundEnabled: boolean;
}

export interface Db {
  settings: Settings;
  events: TakeoffEvent[];
  artists: Artist[];
  partners: Partner[];
  guests: string[];
  team: TeamMember[];
  news: NewsPost[];
  history: HistoryEntry[];
  pages: Record<string, unknown>;
}
