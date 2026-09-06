import type { NextConfig } from "next";

/* Die oeffentlichen Seiten liegen unter app/[lang]/ (It. 18), Deutsch soll
   aber OHNE Praefix erreichbar sein. Diesen Rewrite macht src/proxy.ts —
   und proxy.ts ist gitignoriert (Crew-Tor), liegt auf Vercel also NICHT.
   Nachgesehen am 07.09.2026: die Produktion lieferte auf / und /events 404,
   nur /en/… antwortete. Deshalb steht der Rewrite hier ein zweites Mal, in
   der Datei, die mitreist. Positivliste statt Muster: ein Regex, der
   „alles ausser…" umschreibt, faengt frueher oder spaeter eine Datei
   oder den Crew-Bereich. Neue oeffentliche Seite -> hier eintragen (und
   in site.ts, wie immer). Mit vorhandenem proxy.ts sind die Zeilen
   redundant und harmlos: der Proxy schreibt vorher auf /de/… um, und
   /de/… steht nicht in der Liste. */
const OEFFENTLICH = [
  "events", "events/:slug", "artists", "artists/:slug", "awareness",
  "kalender", "kollektiv", "kontakt", "musik", "news", "team",
  "impressum", "datenschutz",
];

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/", destination: "/de" },
        ...OEFFENTLICH.map(p => ({ source: `/${p}`, destination: `/de/${p}` })),
      ],
    };
  },

  /* Eigenes Build-Verzeichnis je Arbeitsplatz.
     Zwei `next dev`/`next build` auf demselben `.next` zerlegen sich
     gegenseitig — genau davor warnt AGENTS.md. Mit NEXT_DIST_DIR kann jeder
     parallel arbeitende Agent seinen eigenen Dev-Server auf eigenem Port und
     eigenem Verzeichnis fahren:
       NEXT_DIST_DIR=.next-awareness npx next dev -p 3221
     Ohne die Variable bleibt alles wie vorher (`.next`). */
  distDir: process.env.NEXT_DIST_DIR || ".next",

  /* Vorfuehr-Deploy (TAKEOFF_DEMO=1, siehe lib/intern/db.ts): die Saat-
     Datenbank wird zur Laufzeit ueber fs gelesen, nicht importiert — ohne
     diesen Eintrag kennt die Dateispuren-Analyse sie nicht und sie fehlt im
     Bundle. Im normalen Build aendert der Schalter nichts. */
  ...(process.env.TAKEOFF_DEMO === "1"
    ? {
        outputFileTracingIncludes: {
          "/crew": ["./.data-seed/**"],
          "/crew/**": ["./.data-seed/**"],
          "/admin": ["./.data-seed/**"],
          "/admin/**": ["./.data-seed/**"],
        },
      }
    : {}),
};

export default nextConfig;
