import type { Metadata } from "next";
import "@/styles/takeoff.css";
/* Reihenfolge ist Vertrag, nicht Geschmack: `:root.day-mode` hat exakt
   dieselbe Spezifitaet wie `:root[data-theme=…]` und die P3-Selektoren in
   takeoff.css — es entscheidet allein die Quellreihenfolge. Stuenden diese
   beiden Blaetter davor, saessen auf P3-Schirmen weiter die Nacht-Akzente
   und der Tag-Modus waere genau dort kaputt, wo man ihn am wenigsten testet.
   (Begruendung im Original: prototype/assets/css/style.css:385) */
import "@/styles/scene-night.css";
import "@/styles/scene-day.css";
import Topbar from "@/components/Topbar";
import Footer from "@/components/Footer";
import Starfield from "@/components/Starfield";
import MissionControl from "@/components/MissionControl";
import SceneFlags from "@/components/SceneFlags";
import SceneReveals from "@/components/SceneReveals";
import { I18nProvider } from "@/components/I18nProvider";
import { activeTheme, settings } from "@/lib/data";

export const metadata: Metadata = {
  title: "takeoff — rave kollektiv potsdam",
  description: "takeøff — ehrenamtliches Rave-Kollektiv aus Potsdam. Trance · Hard Trance · Bounce.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>",
  },
};

/* Boot-Script: stempelt FX-Tier, Theme, Boden, Tag/Nacht, Video und Sprache
   VOR dem ersten Paint (kein FOUC). Gleiche localStorage-Schlüssel wie der
   Prototyp.

   Die Vorgabewerte kommen aus den Settings (Contract-Felder `fxDefault` und
   `groundEnabled`) und werden hier eingesetzt — sonst stünden sie im Contract,
   wären im Admin bearbeitbar und hätten trotzdem keine Wirkung.

   ACHTUNG beim Bearbeiten: Das hier ist ein Template-Literal. Ein "\\/" wird
   darin zu "/" — eine Regex wie /\\/+$/ verwandelt sich also in einen
   Zeilenkommentar und verschluckt den Rest des Skripts. Deshalb unten
   bewusst Zeichenketten-Operationen statt regulärer Ausdrücke. */
const boot = (fxDefault: string, groundDefault: boolean) => `
(function () {
  var h = document.documentElement;
  h.classList.add("js");
  var get = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var c = navigator.connection || {};
  var mem = navigator.deviceMemory, cores = navigator.hardwareConcurrency;
  var tier = ${JSON.stringify(fxDefault)};
  if (mem !== undefined && cores !== undefined && mem > 4 && cores > 4) tier = "l";
  var stored = get("takeoff-fx");
  if (stored === "s" || stored === "m" || stored === "l") tier = stored;
  if (c.saveData === true) tier = "s";
  if (/(^|\\b)(slow-2g|2g|3g)\\b/.test(c.effectiveType || "")) tier = "s";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) tier = "s";
  h.dataset.fx = tier;
  var th = get("takeoff-theme");
  if (!h.dataset.theme && th && th !== "space") h.dataset.theme = th;

  /* Boden, Tag/Nacht und Video — dieselben Schluessel wie im Prototyp.
     Muss VOR dem ersten Paint stehen, sonst blitzt die Nacht auf, bevor
     der Tag kommt. */
  var gr = get("takeoff-ground");
  if (gr === null ? ${groundDefault ? "true" : "false"} : gr !== "off") h.classList.add("ground-on");
  if (get("takeoff-day") === "on") h.classList.add("day-mode");
  h.dataset.video = get("takeoff-video") === "off" ? "off" : "on";

  /* Sprache vor dem ersten Paint stempeln, damit bei gewaehltem Englisch
     nicht kurz die deutsche Fassung aufblitzt. Der Provider liest das als
     Startwert. Rechtsseiten sperren sich selbst ueber data-lang-lock. */
  var lg = get("takeoff-lang");
  if (lg === "de" || lg === "en") h.lang = lg;

  /* Szenen-Flags aus dem Pfad. Dieselbe Regel wie sceneFlags() in
     src/lib/sky/scene-routes.ts — wer eine aendert, muss die andere
     mitziehen (dort steht die Begruendung, warum es zwei Stellen sind). */
  /* Bewusst ohne regulaeren Ausdruck: BOOT ist ein Template-Literal, dort
     wuerde aus "\/" ein "/" und damit aus der Regex ein Zeilenkommentar,
     der den Rest des Skripts verschluckt. Schwer zu sehen, teuer zu finden. */
  var p = location.pathname;
  while (p.length > 1 && p.charAt(p.length - 1) === "/") p = p.slice(0, -1);
  if (!p) p = "/";
  var isEv = p === "/events" || p.indexOf("/events/") === 0;
  if (p === "/" || isEv) h.classList.add("scene-edges");
  if (isEv) h.classList.add("is-event");
})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  /* Regel: Die Site trägt das Theme des nächsten Events (Standard: space). */
  const [theme, s] = await Promise.all([activeTheme(), settings()]);
  const BOOT = boot(s.fxDefault, s.groundEnabled);

  return (
    <html
      lang="de"
      data-fx="m"
      {...(theme.preset !== "space" ? { "data-theme": theme.preset } : {})}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
        <I18nProvider>
          <a className="skip-link" href="#main">Zum Inhalt springen</a>
          <Starfield />
          <SceneFlags />
          <SceneReveals />
          <Topbar />
          <main id="main">{children}</main>
          <Footer />
          <MissionControl />
        </I18nProvider>
      </body>
    </html>
  );
}
