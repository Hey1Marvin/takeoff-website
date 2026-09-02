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
};

export default nextConfig;
