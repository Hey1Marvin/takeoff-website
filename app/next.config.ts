import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
