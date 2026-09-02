/* Gäste-Log mit Auftritts-Zuordnung: pro Gast ein aufklappbares Chip-Element,
   das automatisch die Events zeigt, deren lineup[].name auf den Gast matcht
   (Zuordnung passiert server-seitig in page.tsx — hier nur Anzeige). Als
   natives <details name="glog"> gebaut: exklusives Akkordeon ganz ohne
   JavaScript (details[name] gruppiert seit Chromium/Firefox/Safari nativ),
   bleibt also auch ohne JS bedienbar. Server Component — kein "use client"
   noetig.

   Klassennamen It. 14: alles Seiteneigene traegt jetzt das Praefix `ar-`.
   `.glog` und `.glog-panel` bleiben, weil beide in der Traegerflaechen-Liste
   von scene-night.css stehen — sie sind geteiltes Vokabular, kein
   Seiten-Stil. */
import Link from "next/link";
import { eventHref } from "@/lib/site";

export interface GuestAppearance {
  slug: string;
  title: string;
  dateLabel: string;
}

export interface GuestVM {
  name: string;
  appearances: GuestAppearance[];
}

export default function ArtistsGuestLog({
  guests,
  appearanceLabel,
  appearanceEmpty,
}: {
  guests: GuestVM[];
  appearanceLabel: string;
  appearanceEmpty: string;
}) {
  return (
    <div className="glog ar-guests">
      {guests.map(g => (
        <details key={g.name} className="ar-guest" name="glog">
          <summary className="chip" translate="no">{g.name}</summary>
          <div className="glog-panel ar-guest-panel">
            <p className="ar-guest-label">{appearanceLabel}</p>
            {g.appearances.length > 0 ? (
              <ul className="ar-guest-list">
                {g.appearances.map(e => (
                  <li key={e.slug}>
                    <Link href={eventHref(e.slug)}>{e.title}</Link>
                    <span>· {e.dateLabel}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="lu-note">{appearanceEmpty}</p>
            )}
          </div>
        </details>
      ))}
    </div>
  );
}
