import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // Prüf-Builds (`next build --distDir .next-audit`) sind Ausgabe, kein
    // Quelltext. Ohne diese Zeile meldet der Linter mehrere hundert Fehler
    // aus gebündelten Fremd-Chunks und verdeckt damit die echten.
    ".next-*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 1:1 aus prototype/assets/js/main.js portierte Szenen-Engine. Bewusst
    // unveraendert uebernommen (Optik-Treue), traegt deshalb @ts-nocheck und
    // wird nicht gelintet. Die Fassade drumherum (types/state/index) ist
    // strikt typisiert und wird sehr wohl geprueft.
    "src/lib/sky/engine.ts",
  ]),
]);

export default eslintConfig;
