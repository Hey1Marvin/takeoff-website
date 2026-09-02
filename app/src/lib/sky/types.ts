/* ============================================================
   sky/types.ts — der Vertrag zwischen App und Szenen-Engine

   `SkyEnv` ist das, was die Engine ueber die Aussenwelt wissen darf:
   Effektstufe, Theme, Tag/Nacht, Boden, reduced-motion, Scroll-Fortschritt
   und der Messbetrieb-Schalter. Alle Felder werden GELESEN, nie gesetzt —
   die Wahrheit steht auf `<html>` (siehe `state.ts`).
   ============================================================ */

/** Effektstufe: s = statisch, m = Standard, l = volle Show. Gestempelt als `html[data-fx]`. */
export type FxTier = "s" | "m" | "l";

/** Szenen-Theme. Gestempelt als `html[data-theme]`; „space" ist der Default und steht dort nicht. */
export type ScenePreset = "space" | "mars" | "strand";

export interface SkyEnv {
  readonly tier: FxTier; readonly theme: ScenePreset;
  readonly day: boolean; readonly ground: boolean;
  readonly reduced: boolean; readonly scrollP: number; readonly perf: boolean;
}

/** Was `initStars()` zurueckgibt — die Fernbedienung der laufenden Szene. */
export interface SkyApi {
  resize(): void; stop(): void; start(): void;
  refreshTheme(): void; paintHorizon(): void; seedGlints(): void;
}
