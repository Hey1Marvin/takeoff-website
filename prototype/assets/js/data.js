/* ============================================================
   TakeoffData — der zentrale Daten-Gateway (It. 9)

   ALLE Seiten holen ihre Inhalte hier ab, nie direkt per fetch.
   Heute: LocalJSONAdapter (assets/data/db.json + optionale
   Per-Seite-Dateien assets/data/pages/<slug>.json).
   Später: SupabaseAdapter — NUR dieser Adapter wird getauscht,
   keine Seite muss angefasst werden. Auch Auth läuft dann hier.
   ============================================================ */
(() => {
  "use strict";

  /* ---------- Adapter-Interface ----------
     Ein Adapter liefert: { loadDb(): Promise<object>,
                           loadPage(slug): Promise<object|null> }   */

  const LocalJSONAdapter = {
    async loadDb() {
      const r = await fetch("assets/data/db.json", { cache: "no-cache" });
      if (!r.ok) throw new Error("db.json: HTTP " + r.status);
      return r.json();
    },
    async loadPage(slug) {
      try {
        const r = await fetch(`assets/data/pages/${slug}.json`, { cache: "no-cache" });
        return r.ok ? r.json() : null;
      } catch { return null; }
    },
  };

  /* Skizze für später (bewusst nicht aktiv):
  const SupabaseAdapter = {
    client: null,   // supabase.createClient(URL, ANON_KEY)
    async loadDb() {
      const [settings, events, artists, news, team, history] = await Promise.all([
        this.client.from("settings").select().single(),
        this.client.from("events").select("*, venue:venues(*)"),
        ...
      ]);
      return { settings: settings.data, events: events.data, ... };
    },
    async loadPage(slug) {
      const { data } = await this.client.from("pages").select().eq("slug", slug).maybeSingle();
      return data?.content ?? null;
    },
  }; */

  let adapter = LocalJSONAdapter;
  let dbPromise = null;
  const pageCache = new Map();

  /* ---------- Entwurfs-Overlay (Settings-Seite, It. 10) ----------
     Die Admin-/Settings-Seite schreibt Änderungen als Draft in
     localStorage("takeoff-draft"). Der Gateway mischt sie über die DB —
     dadurch sind Edits SOFORT in der öffentlichen Ansicht sichtbar,
     ohne Backend. Später schreibt der SupabaseAdapter direkt.
     Struktur: { db: {<Teilbaum von db.json>}, pages: { <slug>: {...} } } */
  const DRAFT_KEY = "takeoff-draft";
  const readDraft = () => {
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"); }
    catch { return {}; }
  };
  const deepMerge = (base, over) => {
    if (over === undefined) return base;
    if (Array.isArray(over) || typeof over !== "object" || over === null ||
        typeof base !== "object" || base === null || Array.isArray(base)) return over;
    const out = { ...base };
    for (const k of Object.keys(over)) out[k] = deepMerge(base[k], over[k]);
    return out;
  };

  const db = async () => {
    dbPromise ??= adapter.loadDb().catch(err => {
      console.warn("[TakeoffData] DB nicht ladbar — Seiten behalten ihr statisches Markup.", err);
      return null;
    });
    const base = await dbPromise;
    if (!base) return null;
    const d = readDraft();
    return d.db ? deepMerge(base, d.db) : base;
  };

  const today = () => new Date().toISOString().slice(0, 10);

  window.TakeoffData = {
    /* Backend tauschen (später: TakeoffData.use(SupabaseAdapter)) */
    use(a) { adapter = a; dbPromise = null; pageCache.clear(); },

    async ready() { return (await db()) !== null; },
    async settings() { return (await db())?.settings ?? null; },

    /* ---------- Events ---------- */
    async events({ visibleOnly = true } = {}) {
      const d = await db(); if (!d) return [];
      return d.events.filter(e => !visibleOnly || e.visible !== false);
    },
    async event(slug) { return (await this.events({ visibleOnly: false })).find(e => e.slug === slug) ?? null; },
    async upcoming() {
      return (await this.events()).filter(e => e.state !== "past" && e.date >= today())
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    async past() {
      return (await this.events()).filter(e => e.state === "past" || e.date < today())
        .sort((a, b) => b.date.localeCompare(a.date));
    },
    async nextEvent() {
      const d = await db(); if (!d) return null;
      return (await this.event(d.settings.nextEventSlug)) ?? (await this.upcoming())[0] ?? null;
    },

    /* ---------- Artists / Team / News / History ---------- */
    async artists() { return (await db())?.artists ?? []; },
    async artist(slug) { return (await this.artists()).find(a => a.slug === slug) ?? null; },
    async guests() { return (await db())?.guests ?? []; },
    async team() { return (await db())?.team ?? []; },
    async news() { return ((await db())?.news ?? []).slice().sort((a, b) => b.date.localeCompare(a.date)); },
    async history() { return (await db())?.history ?? []; },

    /* ---------- Seiten-Inhalte (Texte/Headlines/Bilder je Seite) ----------
       Reihenfolge: assets/data/pages/<slug>.json  >  db.json pages[slug]   */
    async page(slug) {
      if (!pageCache.has(slug)) {
        pageCache.set(slug, (async () => {
          const extra = await adapter.loadPage(slug);
          const base = extra ?? (await db())?.pages?.[slug] ?? null;
          const d = readDraft();
          return d.pages?.[slug] ? deepMerge(base ?? {}, d.pages[slug]) : base;
        })());
      }
      return pageCache.get(slug);
    },

    /* ---------- Theme-Regel (It. 10): Hintergrund folgt dem nächsten Event ----------
       Kein eigenes Theme gesetzt → Standard "space". Die Startseite nimmt
       immer das Theme des nächsten Events (Mars, Strand, … oder eben normal). */
    async activeTheme() {
      const t = (await this.nextEvent())?.theme ?? {};
      return {
        preset: t.preset || "space",              /* Standard: normaler Space-Himmel */
        accent: t.accent || "#e04fb4",
        accentRgb: t.accentRgb || "224 79 180",
        patch: t.patch || "star",
      };
    },

    /* ---------- Admin-API (Settings-Seite) ---------- */
    admin: {
      draft: readDraft,
      /* patch = { db: {...} , pages: {...} } — wird deep über den Bestand gemischt */
      saveDraft(patch) {
        const merged = deepMerge(readDraft(), patch);
        localStorage.setItem(DRAFT_KEY, JSON.stringify(merged));
        dbPromise = null; pageCache.clear();
        dispatchEvent(new CustomEvent("takeoff:draft", { detail: merged }));
        return merged;
      },
      clearDraft() {
        localStorage.removeItem(DRAFT_KEY);
        dbPromise = null; pageCache.clear();
        dispatchEvent(new CustomEvent("takeoff:draft", { detail: {} }));
      },
      hasDraft() { return !!localStorage.getItem(DRAFT_KEY); },
      /* Export: kompletter Stand (DB + Draft gemischt) zum Herunterladen/Einchecken */
      async exportMerged() { return await db(); },
    },

    /* ---------- Mini-Hydration-Helfer ----------
       bindText: schreibt Werte in [data-bind="pfad"]-Elemente.
       Fehlt ein Wert, bleibt das statische Markup unangetastet. */
    bindText(root, obj) {
      root.querySelectorAll("[data-bind]").forEach(el => {
        const v = el.dataset.bind.split(".").reduce((o, k) => o?.[k], obj);
        if (v !== undefined && v !== null && v !== "") el.textContent = v;
      });
    },
    fmtDate(iso) {
      const [y, m, d] = iso.split("-");
      return `${d}.${m}.${y.slice(2)}`;
    },
  };
})();
