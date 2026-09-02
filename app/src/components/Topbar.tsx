/* Kopfleiste — Server-Teil: holt die Daten, stellt nichts dar.
   Die Darstellung liegt in TopbarView (Client), damit die Sprachumschaltung
   ohne Reload auch aria-Labels erreicht. */
import { settings, nextEvent, tickerLines } from "@/lib/data";
import { eventHref } from "@/lib/site";
import TopbarView from "./TopbarView";

export default async function Topbar() {
  const [s, next, lines] = await Promise.all([settings(), nextEvent(), tickerLines()]);

  return (
    <TopbarView
      ticker={[...lines, ...lines]}          /* doppelt = nahtlose Marquee-Schleife */
      telegram={s.telegram}
      status={next ? {
        href: eventHref(next.slug),
        tag: next.pricing.label,
        date: next.date,          /* ISO — TopbarView formatiert sprachabhaengig */
      } : null}
      burgerNext={next ? {
        slug: next.slug,
        title: next.title,
        when: next.date,          /* ISO, s. o. */
        where: [
          next.venue.name,
          next.doors && next.doors !== "TBA" ? `${next.doors} Uhr` : "",
          next.pricing.label,
        ].filter(Boolean).join(" · "),
      } : null}
      socials={{ instagram: s.instagram, telegram: s.telegram, soundcloud: s.soundcloud, email: s.email }}
    />
  );
}
