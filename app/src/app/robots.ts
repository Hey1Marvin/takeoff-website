import type { MetadataRoute } from "next";
import { indexingAllowed } from "@/lib/seo";

/* /robots.txt — siehe lib/seo.ts. Der Prototyp sperrt alles aus,
   die spaetere Produktion gibt alles frei. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: indexingAllowed
      ? [{ userAgent: "*", allow: "/" }]
      : [{ userAgent: "*", disallow: "/" }],
  };
}
