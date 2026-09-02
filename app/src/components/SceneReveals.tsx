"use client";
/* Scroll-Reveal-Mechanik ohne GSAP/Lenis (bewusst nicht installiert — Bundle-
   Größe, Konflikt mit einem parallel laufenden Agent an package.json, und
   Lenis kollidiert mit der Scroll-Restoration des App Routers). Der Kern
   (IntersectionObserver + .in-Klasse) ist wörtlich der GSAP-freie Fallback-
   Pfad aus prototype/assets/js/main.js, buildScrollFX() Z. 5915–5924.

   Was dadurch entfällt: die GSAP-Hero-Intro-Timeline (Wortmarke fliegt
   herein, Pretitle/Tagline/Countdown/Next-Card/Scroll-Hint gestaffelt) und
   der gsap.to(".hero-inner", { scrub })-Parallax. Die Hero-Intro kommt erst
   mit dem Startseiten-Port zurück — dann als CSS-Keyframes ohne Scroll-Bezug,
   also ohne GSAP. Karten-Tilt/Hover-Licht (.mcard, pointer:fine) gehört nicht
   zur Scroll-Choreografie und bleibt Aufgabe der Komponente, die .mcard baut.

   takeoff.css:405-416 definiert bereits Grundzustand (.reveal = opacity:0
   unter html.js[data-fx=m|l]) und Zielzustand (.reveal.in). Diese Komponente
   ist die einzige Stelle, die `.in` setzt — ohne sie bliebe jedes .reveal-
   Element dauerhaft unsichtbar, sobald das Boot-Script `html.classList.add
   ("js")` gesetzt hat. */
import { useEffect } from "react";

/* Einzeln beobachtete Reveal-Elemente (Standardfall: ganze Sections/Blöcke). */
const REVEAL_SELECTOR = ".reveal";

/* Container, deren Kinder der Prototyp per gsap.from(container.children, {
   stagger }) gestaffelt eingeblendet hat — unabhängig davon, ob der Container
   selbst .reveal trägt (im Original ein eigener ScrollTrigger auf dem
   Container). Ersatz ohne GSAP: transitionDelay je Kind + .in setzen, sobald
   der Container in den Viewport kommt. Die Transition selbst steht schon in
   takeoff.css auf .reveal — Kinder, die diese Klasse nicht tragen, bleiben
   dadurch unangetastet (kein Effekt, aber auch kein Schaden). */
const STAGGER_CONTAINER_SELECTOR = ".card-grid, .crewgrid, .setgrid, .flog, .lineup";
const STAGGER_MS = 90;

function fxTier(): string {
  return document.documentElement.dataset.fx ?? "m";
}

function prefersReducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* Tier "s" oder reduced-motion: alles sofort sichtbar, kein Observer. */
function fxOn(): boolean {
  return fxTier() !== "s" && !prefersReducedMotion();
}

function staggerChildren(container: Element): void {
  Array.from(container.children).forEach((child, i) => {
    (child as HTMLElement).style.transitionDelay = `${i * STAGGER_MS}ms`;
    child.classList.add("in");
  });
}

/* Setzt allen .reveal sofort .in — Pfad für Tier "s", reduced-motion und den
   Fall, dass mitten in der Sitzung auf "Aus" umgeschaltet wird. */
function revealAllNow(root: ParentNode = document): void {
  root.querySelectorAll(REVEAL_SELECTOR).forEach((el) => el.classList.add("in"));
}

/* CSS Scroll-driven Animations (animation-timeline: view()) ersetzen
   gsap.to(".ditem", { y: spd, scrub: 1.2 }) — die Semantik von ScrollTrigger
   start:"top bottom", end:"bottom top", scrub deckt sich exakt mit view().
   Kein rAF-Loop: der Browser treibt die Animation selbst an. Wo das nicht
   unterstützt wird (heute Firefox/Safari), bleibt die Deko einfach stehen —
   sauberer Fallback, kein Bruch. Nur Tier "l" (fxFull im Prototyp). */
const PARALLAX_STYLE_ID = "scene-reveals-parallax-style";

function ensureParallaxStylesheet(): void {
  if (document.getElementById(PARALLAX_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = PARALLAX_STYLE_ID;
  style.textContent = `
    .ditem[data-parallax-active] {
      animation-name: scene-reveals-ditem-drift;
      animation-timeline: view();
      animation-fill-mode: both;
      animation-timing-function: linear;
    }
    @keyframes scene-reveals-ditem-drift {
      from { transform: translateY(0); }
      to { transform: translateY(var(--scene-reveals-spd, -50px)); }
    }
  `;
  document.head.appendChild(style);
}

function applyParallax(root: ParentNode = document): void {
  if (fxTier() !== "l" || prefersReducedMotion()) return;
  if (!CSS.supports("animation-timeline", "view()")) return;
  ensureParallaxStylesheet();
  root.querySelectorAll<HTMLElement>(".ditem").forEach((el) => {
    if (el.hasAttribute("data-parallax-active")) return;
    const spd = parseFloat(el.dataset.spd ?? "-50");
    el.style.setProperty("--scene-reveals-spd", `${spd}px`);
    el.setAttribute("data-parallax-active", "");
  });
}

export default function SceneReveals() {
  useEffect(() => {
    let io: IntersectionObserver | null = null;

    function handleEntry(el: Element): void {
      if (el.matches(STAGGER_CONTAINER_SELECTOR)) staggerChildren(el);
      if (el.matches(REVEAL_SELECTOR)) el.classList.add("in");
      io?.unobserve(el);
    }

    function observe(el: Element): void {
      io?.observe(el);
    }

    function observeSubtree(root: ParentNode): void {
      const targets = new Set<Element>();
      if (root instanceof Element) {
        if (root.matches(REVEAL_SELECTOR) || root.matches(STAGGER_CONTAINER_SELECTOR)) targets.add(root);
      }
      root.querySelectorAll(`${REVEAL_SELECTOR}, ${STAGGER_CONTAINER_SELECTOR}`).forEach((el) => targets.add(el));
      targets.forEach(observe);
    }

    function setupObserver(): void {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) handleEntry(entry.target);
          });
        },
        { rootMargin: "0px 0px -10% 0px" },
      );
      observeSubtree(document);
    }

    function teardownObserver(): void {
      io?.disconnect();
      io = null;
    }

    function buildScrollFX(): void {
      teardownObserver();
      if (!fxOn()) {
        revealAllNow();
        return;
      }
      setupObserver();
      applyParallax();
    }

    buildScrollFX();

    /* Nachrüsten bei Client-Navigation: neue .reveal-/Grid-Elemente aus
       frisch gemounteten Seiten anhängen. */
    const bodyObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (!fxOn()) {
            revealAllNow(node);
            if (node.matches(REVEAL_SELECTOR)) node.classList.add("in");
          } else {
            observeSubtree(node);
            applyParallax(node);
          }
        });
      }
    });
    bodyObserver.observe(document.body, { childList: true, subtree: true });

    /* Tier-Wechsel (z. B. Mission Control → "Aus"): sofort alle .reveal
       aufdecken, damit nichts dauerhaft unsichtbar bleibt; bei Wechsel auf
       m/l wird die Choreografie neu aufgebaut. */
    const htmlObserver = new MutationObserver(() => {
      buildScrollFX();
    });
    htmlObserver.observe(document.documentElement, { attributeFilter: ["data-fx"] });

    return () => {
      teardownObserver();
      bodyObserver.disconnect();
      htmlObserver.disconnect();
    };
  }, []);

  return null;
}
