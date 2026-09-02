/* ============================================================
   admin.js — Settings-Seite: App-Logik (It. 10)

   Lädt Contracts (assets/data/contracts/manifest.json + Einzeldateien),
   baut daraus Sidebar + Formulare (via AdminFields), speichert
   ausschließlich über TakeoffData.admin.saveDraft(...). Kennt keine
   öffentliche Seite direkt — läuft komplett contract-getrieben.

   Routing: einfaches Hash-Schema, rein clientseitig, kein Reload nötig:
     #entity-<name>                Liste
     #entity-<name>:new            Neu anlegen
     #entity-<name>:edit:<key>     Bearbeiten
     #page-<slug>                  Seiten-Formular (immer Einzelformular)
   ============================================================ */
(() => {
  "use strict";

  if (!window.AdminFields) {
    console.error("[admin] AdminFields fehlt — admin-fields.js vor admin.js laden.");
    return;
  }
  const AF = window.AdminFields;
  const { h, iconSvg } = AF;
  const CONTRACTS_DIR = "assets/data/contracts/";

  const els = {
    sidebar: document.getElementById("admin-sidebar"),
    content: document.getElementById("admin-content"),
    toast: document.getElementById("admin-toast"),
    draftDot: document.getElementById("admin-draft-dot"),
    draftText: document.getElementById("admin-draft-text"),
    btnExport: document.getElementById("admin-btn-export"),
    btnDiscard: document.getElementById("admin-btn-discard"),
  };

  const state = {
    manifest: null,
    entityContracts: [],   // [{ id, file, contract|null }]
    pageEntries: [],        // [{ id, slug, dedicated, contract|null, label, icon }]
    contractsByCollection: {}, // collectionName -> contract (für relation/multiselect-Auflösung)
  };

  /* ================= Fetch-Helfer (defensiv) ================= */
  async function fetchJson(path) {
    try {
      const r = await fetch(path, { cache: "no-cache" });
      if (!r.ok) return { ok: false, status: r.status, data: null };
      const data = await r.json();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err, data: null };
    }
  }

  async function getDb() {
    try {
      if (!window.TakeoffData) return {};
      const merged = await TakeoffData.admin.exportMerged();
      return merged || {};
    } catch (err) {
      console.warn("[admin] DB nicht ladbar", err);
      return {};
    }
  }

  function ctxFor(db) {
    return { db, contractsByCollection: state.contractsByCollection, imageListId: "admin-image-suggestions" };
  }

  /* ================= Toast ================= */
  let toastTimer = null;
  function showToast(msg) {
    if (!els.toast) return;
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
  }

  /* ================= Draft-Leiste ================= */
  function refreshDraftBar() {
    const has = !!(window.TakeoffData && TakeoffData.admin.hasDraft());
    els.draftDot?.classList.toggle("active", has);
    if (els.draftText) {
      els.draftText.textContent = has
        ? "Entwurf aktiv — Änderungen liegen in deinem Browser und sind in der Vorschau sichtbar."
        : "Kein Entwurf — du siehst den zuletzt exportierten Stand.";
    }
    if (els.btnDiscard) els.btnDiscard.disabled = !has;
  }

  function downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function doExport() {
    if (!window.TakeoffData) { showToast("Datenschicht nicht verfügbar."); return; }
    const db = await getDb();
    const pages = {};
    for (const entry of state.pageEntries) {
      try {
        const data = await TakeoffData.page(entry.slug);
        if (data) pages[entry.slug] = data;
      } catch { /* einzelne Seite überspringen, Export läuft weiter */ }
    }
    downloadJson({ db, pages, exportedAt: new Date().toISOString() }, "takeoff-export.json");
    showToast("Export erzeugt ✓");
  }

  function doDiscard() {
    if (!window.TakeoffData) return;
    if (!TakeoffData.admin.hasDraft()) { showToast("Es gibt gerade keinen Entwurf."); return; }
    if (!confirm("Entwurf wirklich verwerfen? Alle noch nicht exportierten Änderungen in diesem Browser gehen verloren.")) return;
    TakeoffData.admin.clearDraft();
    refreshDraftBar();
    showToast("Entwurf verworfen");
    renderRoute();
  }

  /* ================= Contracts laden ================= */
  function prettifyPageSlug(slug) {
    if (slug.startsWith("event-")) return "Event: " + AF.prettifyKey(slug.slice(6).replace(/-/g, " "));
    return AF.prettifyKey(slug.replace(/-/g, " "));
  }

  async function loadAll() {
    const manifestRes = await fetchJson(CONTRACTS_DIR + "manifest.json");
    if (!manifestRes.ok || !manifestRes.data) { state.manifest = null; return; }
    state.manifest = manifestRes.data;

    for (const file of state.manifest.entities || []) {
      const id = String(file).replace(/\.json$/, "");
      const res = await fetchJson(CONTRACTS_DIR + file);
      const contract = res.ok ? res.data : null;
      if (contract) {
        contract.__id = id;
        if (contract.storage?.collection) state.contractsByCollection[contract.storage.collection] = contract;
      }
      state.entityContracts.push({ id, file, contract });
    }

    const genericMeta = (await fetchJson(CONTRACTS_DIR + "page-generic.json")).data;
    for (const slug of state.manifest.pages || []) {
      const overrideFile = state.manifest.pageContracts?.[slug];
      let contract = null;
      if (overrideFile) contract = (await fetchJson(CONTRACTS_DIR + overrideFile)).data;
      if (!contract) contract = (await fetchJson(CONTRACTS_DIR + `page-${slug}.json`)).data;
      const dedicated = !!contract;
      if (dedicated) contract.__id = slug;
      state.pageEntries.push({
        id: "page-" + slug,
        slug,
        dedicated,
        contract,
        label: dedicated ? (contract.label || contract.labelPlural || slug) : prettifyPageSlug(slug),
        icon: dedicated ? (contract.icon || "file") : (genericMeta?.icon || "file"),
      });
    }
  }

  function isSingleton(contract) { return !contract.storage?.key; }
  function isFlatStringCollection(contract) {
    return Array.isArray(contract.fields) && contract.fields.length === 1 && contract.fields[0].key === contract.storage.key;
  }
  function sectionIdFor(contract) { return "entity-" + contract.__id; }

  /* ================= Sidebar ================= */
  function renderSidebar() {
    els.sidebar.innerHTML = "";
    if (!state.manifest) {
      els.sidebar.appendChild(h("p", { class: "sidebar-error", text: "manifest.json konnte nicht geladen werden — keine Bereiche verfügbar." }));
      return;
    }
    const groupA = h("div", { class: "sidebar-group" }, [h("p", { class: "sidebar-group-title", text: "Inhalte" })]);
    for (const entry of state.entityContracts) {
      const c = entry.contract;
      const label = c ? (c.labelPlural || c.label || entry.id) : entry.id + " — Fehler";
      groupA.appendChild(sidebarLink("entity-" + entry.id, label, c?.icon, !c));
    }
    const groupB = h("div", { class: "sidebar-group" }, [h("p", { class: "sidebar-group-title", text: "Seiten-Texte" })]);
    for (const entry of state.pageEntries) {
      groupB.appendChild(sidebarLink(entry.id, entry.label, entry.icon, false));
    }
    els.sidebar.append(groupA, groupB);
  }

  function sidebarLink(sectionId, label, icon, errored) {
    return h("a", {
      href: "#" + sectionId,
      class: "sidebar-link" + (errored ? " is-error" : ""),
      "data-section": sectionId,
    }, [
      h("span", { class: "sidebar-icon", html: iconSvg(icon) }),
      h("span", { class: "sidebar-label", text: label }),
    ]);
  }

  function highlightSidebar(sectionId) {
    els.sidebar.querySelectorAll(".sidebar-link").forEach((a) => {
      const active = a.dataset.section === sectionId;
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    const activeLink = els.sidebar.querySelector(`.sidebar-link[data-section="${CSS.escape(sectionId)}"]`);
    activeLink?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  /* ================= kleine Bausteine ================= */
  function sectionHeader(opts) {
    const titleRow = h("div", { class: "section-header" }, [
      h("div", {}, [
        h("h1", { class: "admin-h1" }, [h("span", { class: "admin-h1-icon", html: iconSvg(opts.icon) }), " " + opts.title]),
        opts.desc ? h("p", { class: "section-desc", text: opts.desc }) : null,
      ]),
      opts.actionEl || null,
    ]);
    return titleRow;
  }

  function sectionErrorBox(title, text) {
    return h("div", { class: "admin-errorbox" }, [
      h("p", { class: "admin-errorbox-title", text: "⚠ " + title }),
      h("p", { class: "admin-errorbox-text", text }),
    ]);
  }

  function backLink(contract) {
    return h("a", { href: "#" + sectionIdFor(contract), class: "admin-back-link" }, ["← Zurück zur Liste"]);
  }

  /* ================= Routing ================= */
  function routeTo(parts) { location.hash = parts.map(encodeURIComponent).join(":"); }
  function parseRoute() {
    const raw = location.hash.replace(/^#/, "");
    if (!raw) return null;
    const parts = raw.split(":").map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
    return { sectionId: parts[0], mode: parts[1] || null, keyValue: parts[2] ?? null };
  }

  async function renderRoute() {
    const route = parseRoute();
    if (!route) { renderWelcome(); return; }
    highlightSidebar(route.sectionId);
    els.content.innerHTML = "";
    els.content.appendChild(h("p", { class: "admin-content-loading", text: "Lädt …" }));
    try {
      if (route.sectionId.startsWith("entity-")) {
        const id = route.sectionId.slice("entity-".length);
        const entry = state.entityContracts.find((e) => e.id === id);
        await renderEntitySection(entry, route);
      } else if (route.sectionId.startsWith("page-")) {
        const slug = route.sectionId.slice("page-".length);
        const entry = state.pageEntries.find((e) => e.slug === slug);
        await renderPageSection(entry);
      } else {
        renderWelcome();
      }
    } catch (err) {
      console.error("[admin] Render-Fehler für " + route.sectionId, err);
      els.content.innerHTML = "";
      els.content.appendChild(sectionErrorBox("Diese Ansicht konnte nicht geladen werden.", "Technisches Detail: " + (err?.message || err)));
    }
  }

  function renderWelcome() {
    els.content.innerHTML = "";
    els.content.appendChild(h("div", { class: "admin-welcome" }, [
      h("h1", { class: "admin-h1", text: "Willkommen in der Verwaltung" }),
      h("p", { text: "Wähle links einen Bereich — Events, Artists, Partner, Team, News, History oder eine Seite mit ihren Texten." }),
      !state.manifest ? sectionErrorBox("Contracts nicht ladbar", "assets/data/contracts/manifest.json konnte nicht geladen oder gelesen werden. Ist die Datei vorhanden und gültiges JSON?") : null,
    ]));
  }

  /* ================= ENTITY: Liste ================= */
  async function renderEntitySection(entry, route) {
    els.content.innerHTML = "";
    if (!entry || !entry.contract) {
      els.content.append(
        sectionHeader({ title: (entry?.id || "Unbekannt"), icon: null }),
        sectionErrorBox(
          `Contract „${entry?.id}.json“ fehlt oder ist kein gültiges JSON.`,
          "Diese Sektion ist deshalb nicht verfügbar. Prüfe assets/data/contracts/ — die Datei muss existieren, valide sein und in manifest.json unter \"entities\" eingetragen sein."
        )
      );
      return;
    }
    const contract = entry.contract;
    const db = await getDb();

    if (isSingleton(contract)) {
      renderEntityForm(contract, db[contract.storage.collection] || {}, { isNew: false }, db);
      return;
    }

    const list = Array.isArray(db[contract.storage.collection]) ? db[contract.storage.collection] : [];
    const key = contract.storage.key;
    const flat = isFlatStringCollection(contract);

    if (route.mode === "new" && contract.actions?.includes("create")) {
      renderEntityForm(contract, flat ? "" : buildNewRecordDefaults(contract, db), { isNew: true }, db);
      return;
    }
    if (route.mode === "edit" && route.keyValue != null) {
      const rec = flat ? list.find((x) => x === route.keyValue) : list.find((r) => AF.getPath(r, key) === route.keyValue);
      if (rec === undefined) {
        els.content.append(sectionHeader({ title: contract.labelPlural || contract.label, icon: contract.icon }),
          sectionErrorBox("Eintrag nicht gefunden", `„${route.keyValue}“ existiert nicht (mehr) in dieser Liste — vielleicht wurde er gerade gelöscht oder umbenannt.`),
          backLink(contract));
        return;
      }
      renderEntityForm(contract, rec, { isNew: false, originalKey: route.keyValue }, db);
      return;
    }
    renderEntityList(contract, db);
  }

  function columnDisplay(contract, record, colKey, db, flat) {
    if (flat) return record;
    const fieldDef = (contract.fields || []).find((f) => f.key === colKey);
    const v = AF.getPath(record, colKey);
    if (fieldDef?.type === "toggle") return v;
    if (fieldDef?.type === "date") {
      try { return window.TakeoffData ? TakeoffData.fmtDate(v) : v; } catch { return v || "—"; }
    }
    if ((fieldDef?.type === "relation" || (fieldDef?.type === "select" && fieldDef.collection)) && !fieldDef.allowFreeText) {
      const target = collectionRecordsFor(db, fieldDef.collection);
      const keyField = state.contractsByCollection[fieldDef.collection]?.storage?.key || "slug";
      const df = fieldDef.displayField || "name";
      const found = target.find((r) => (typeof r === "string" ? r : r[keyField]) === v);
      return found ? (typeof found === "string" ? found : (found[df] ?? v)) : (v || "—");
    }
    if (fieldDef?.type === "multiselect") {
      const arr = Array.isArray(v) ? v : [];
      if (!arr.length) return "—";
      const target = collectionRecordsFor(db, fieldDef.collection);
      const keyField = state.contractsByCollection[fieldDef.collection]?.storage?.key || "slug";
      const df = fieldDef.displayField || "name";
      const labels = arr.map((val) => {
        const found = target.find((r) => (typeof r === "string" ? r : r[keyField]) === val);
        return found ? (typeof found === "string" ? found : (found[df] ?? val)) : val;
      });
      return labels.length > 3 ? labels.slice(0, 3).join(", ") + ` +${labels.length - 3} weitere` : labels.join(", ");
    }
    if (Array.isArray(v)) {
      if (!v.length) return "—";
      return v.map((x) => (typeof x === "string" ? x : (x.name || x.title || x.value || "•"))).join(", ");
    }
    if (v === undefined || v === null || v === "") return "—";
    return String(v);
  }
  function collectionRecordsFor(db, collectionName) {
    const list = db?.[collectionName];
    return Array.isArray(list) ? list : [];
  }

  function renderEntityList(contract, db) {
    const flat = isFlatStringCollection(contract);
    const key = contract.storage.key;
    let list = (Array.isArray(db[contract.storage.collection]) ? db[contract.storage.collection] : []).slice();
    if (contract.list?.sort) {
      const sk = contract.list.sort;
      list.sort((a, b) => String(flat ? a : (AF.getPath(a, sk) ?? "")).localeCompare(String(flat ? b : (AF.getPath(b, sk) ?? ""))));
    }
    const cols = flat ? [key] : (contract.list?.columns || [key]);

    const addBtn = contract.actions?.includes("create")
      ? h("button", { type: "button", class: "btn btn-primary", onclick: () => routeTo([sectionIdFor(contract), "new"]) }, [AF.iconEl("plus", "icn icn-sm"), " Neu anlegen"])
      : null;

    els.content.append(sectionHeader({ title: contract.labelPlural || contract.label, icon: contract.icon, desc: contract.description, actionEl: addBtn }));

    if (!list.length) {
      els.content.appendChild(h("p", { class: "admin-empty", text: "Noch keine Einträge." }));
      return;
    }

    const thead = h("thead", {}, [h("tr", {}, cols.map((c) => h("th", { text: fieldLabelFor(contract, c, flat) })).concat([h("th", { class: "col-actions", text: "Aktionen" })]))]);
    const tbody = h("tbody");
    for (const record of list) {
      const keyVal = flat ? record : AF.getPath(record, key);
      const tds = cols.map((c) => {
        const fieldDef = flat ? null : (contract.fields || []).find((f) => f.key === c);
        if (!flat && fieldDef?.type === "toggle") {
          const cb = h("input", { type: "checkbox", checked: (AF.getPath(record, c) !== false) || undefined, "aria-label": `${fieldLabelFor(contract, c, flat)}: ${keyVal}` });
          cb.addEventListener("change", async () => { await toggleField(contract, keyVal, c); });
          return h("td", { class: "col-toggle" }, [cb]);
        }
        return h("td", { text: columnDisplay(contract, record, c, db, flat) });
      });
      const actionsCell = h("td", { class: "col-actions" }, [
        contract.actions?.includes("edit") ? h("button", { type: "button", class: "row-btn", title: "Bearbeiten", "aria-label": "Bearbeiten: " + keyVal, onclick: () => routeTo([sectionIdFor(contract), "edit", keyVal]) }, ["Bearbeiten"]) : null,
        contract.actions?.includes("delete") ? h("button", { type: "button", class: "row-btn row-btn-danger", title: "Löschen", "aria-label": "Löschen: " + keyVal, onclick: () => onDeleteFromList(contract, keyVal, flat) }, ["Löschen"]) : null,
      ]);
      tbody.appendChild(h("tr", {}, [...tds, actionsCell]));
    }
    const wrap = h("div", { class: "table-scroll" }, [h("table", { class: "admin-table" }, [thead, tbody])]);
    els.content.appendChild(wrap);
  }

  function fieldLabelFor(contract, colKey, flat) {
    if (flat) return contract.fields[0].label || "Name";
    const f = (contract.fields || []).find((x) => x.key === colKey);
    return f?.label || AF.prettifyKey(colKey);
  }

  async function toggleField(contract, keyVal, fieldKey) {
    const db = await getDb();
    const collection = contract.storage.collection;
    const key = contract.storage.key;
    const list = (Array.isArray(db[collection]) ? db[collection] : []).slice();
    const idx = list.findIndex((r) => AF.getPath(r, key) === keyVal);
    if (idx === -1) return;
    const cur = AF.getPath(list[idx], fieldKey) !== false;
    const updated = AF.cloneDeep(list[idx]);
    AF.setPath(updated, fieldKey, !cur);
    list[idx] = updated;
    TakeoffData.admin.saveDraft({ db: { [collection]: list } });
    refreshDraftBar();
    showToast(!cur ? "Ausgeblendet" : "Sichtbar ✓");
  }

  async function onDeleteFromList(contract, keyVal, flat) {
    if (!confirm(`„${keyVal}“ wirklich löschen? Das lässt sich nur über „Entwurf verwerfen“ rückgängig machen.`)) return;
    if (flat) await deleteFlatCollection(contract, keyVal);
    else await deleteEntityRecord(contract, keyVal);
    await renderRoute();
  }

  /* ================= ENTITY: Formular ================= */
  function buildNewRecordDefaults(contract, db) {
    const obj = {};
    for (const f of contract.fields) AF.setPath(obj, f.key, AF.defaultForFieldDef(f));
    if (contract.__id === "news") {
      const list = Array.isArray(db.news) ? db.news : [];
      let max = 0;
      for (const n of list) {
        const m = /^n(\d+)$/i.exec(String(n.id || ""));
        if (m) max = Math.max(max, parseInt(m[1], 10));
      }
      obj.id = "n" + (max + 1);
    }
    return obj;
  }

  function wireSlugAuto(sourceEl, slugEl) {
    if (!sourceEl || !slugEl) return;
    let autoValue = slugEl.value;
    let touched = slugEl.value.trim() !== "";
    slugEl.addEventListener("input", () => { touched = slugEl.value !== autoValue; });
    sourceEl.addEventListener("input", () => {
      if (touched) return;
      autoValue = AF.slugify(sourceEl.value);
      slugEl.value = autoValue;
    });
  }

  function renderEntityForm(contract, record, opts, db) {
    els.content.innerHTML = "";
    const flat = isFlatStringCollection(contract);
    const single = isSingleton(contract);
    const title = opts.isNew ? `Neu: ${contract.label}` : (single ? contract.label : `${contract.label} bearbeiten`);

    els.content.appendChild(sectionHeader({
      title, icon: contract.icon, desc: opts.isNew ? contract.description : null,
      actionEl: !single ? backLink(contract) : null,
    }));

    const form = h("form", { class: "admin-form", novalidate: "novalidate" });
    const controllers = [];
    let slugCtrl = null, sourceCtrl = null;

    if (flat) {
      const ctrl = AF.createField({ ...contract.fields[0], required: true }, record ?? "", ctxFor(db));
      controllers.push(ctrl);
      form.appendChild(h("div", { class: "form-grid" }, [ctrl.el]));
    } else {
      const grid = h("div", { class: "form-grid" });
      for (const f of contract.fields) {
        const val = AF.getPath(record, f.key);
        const ctrl = AF.createField(f, val, ctxFor(db));
        controllers.push(ctrl);
        grid.appendChild(ctrl.el);
        if (f.key === contract.storage.key) slugCtrl = ctrl;
        if (!sourceCtrl && (f.key === "title" || f.key === "name")) sourceCtrl = ctrl;
      }
      form.appendChild(grid);
    }
    if (opts.isNew && slugCtrl && sourceCtrl && slugCtrl.inputEl && sourceCtrl.inputEl) {
      wireSlugAuto(sourceCtrl.inputEl, slugCtrl.inputEl);
    }

    const actions = h("div", { class: "form-actions" });
    actions.appendChild(h("button", { type: "submit", class: "btn btn-primary" }, ["Speichern"]));
    if (!single) actions.appendChild(h("a", { href: "#" + sectionIdFor(contract), class: "btn btn-ghost" }, ["Abbrechen"]));
    if (!opts.isNew && !single && contract.actions?.includes("delete")) {
      actions.appendChild(h("button", {
        type: "button", class: "btn btn-danger", onclick: async () => {
          const label = flat ? record : (AF.getPath(record, contract.storage.key) ?? "");
          if (!confirm(`„${label}“ wirklich löschen? Das lässt sich nur über „Entwurf verwerfen“ rückgängig machen.`)) return;
          if (flat) await deleteFlatCollection(contract, record);
          else await deleteEntityRecord(contract, AF.getPath(record, contract.storage.key));
          routeTo([sectionIdFor(contract)]);
        },
      }, ["Löschen"]));
    }
    form.appendChild(actions);
    els.content.appendChild(form);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      let firstInvalid = null;
      for (const c of controllers) {
        const err = c.validate ? c.validate() : null;
        c.showError?.(err);
        if (err && !firstInvalid) firstInvalid = c;
      }
      if (firstInvalid) { firstInvalid.focusInvalid?.(); showToast("Bitte markierte Felder prüfen."); return; }

      if (flat) {
        await saveFlatCollection(contract, opts.originalKey ?? null, controllers[0].collect(), opts.isNew);
        routeTo([sectionIdFor(contract)]);
        return;
      }
      const working = AF.cloneDeep(record || {});
      for (const c of controllers) AF.setPath(working, c.key, c.collect());
      if (single) {
        await saveSingleton(contract, working);
        return;
      }
      const ok = await saveEntityRecord(contract, working, opts.isNew, opts.originalKey ?? null);
      if (ok) routeTo([sectionIdFor(contract)]);
    });
  }

  /* ================= Speichern / Löschen (Entities) ================= */
  async function saveEntityRecord(contract, working, isNew, originalKey) {
    const db = await getDb();
    const key = contract.storage.key;
    const collection = contract.storage.collection;
    const list = Array.isArray(db[collection]) ? db[collection].slice() : [];
    const newKeyVal = AF.getPath(working, key);
    if (!newKeyVal) { showToast(`„${key}“ darf nicht leer sein.`); return false; }
    const sameKeyIdx = list.findIndex((r) => AF.getPath(r, key) === newKeyVal);
    if (isNew) {
      if (sameKeyIdx !== -1) { showToast(`Kennung „${newKeyVal}“ ist schon vergeben — bitte ändern.`); return false; }
      list.push(working);
    } else {
      const origIdx = list.findIndex((r) => AF.getPath(r, key) === originalKey);
      if (sameKeyIdx !== -1 && sameKeyIdx !== origIdx) { showToast(`Kennung „${newKeyVal}“ ist schon vergeben — bitte ändern.`); return false; }
      if (origIdx === -1) list.push(working); else list[origIdx] = working;
    }
    TakeoffData.admin.saveDraft({ db: { [collection]: list } });
    refreshDraftBar();
    showToast("Gespeichert ✓");
    return true;
  }

  async function deleteEntityRecord(contract, keyVal) {
    const db = await getDb();
    const collection = contract.storage.collection;
    const key = contract.storage.key;
    const list = (Array.isArray(db[collection]) ? db[collection] : []).filter((r) => AF.getPath(r, key) !== keyVal);
    TakeoffData.admin.saveDraft({ db: { [collection]: list } });
    refreshDraftBar();
    showToast("Gelöscht ✓");
  }

  async function saveSingleton(contract, working) {
    TakeoffData.admin.saveDraft({ db: { [contract.storage.collection]: working } });
    refreshDraftBar();
    showToast("Gespeichert ✓");
  }

  async function saveFlatCollection(contract, originalVal, newVal, isNew) {
    const db = await getDb();
    const collection = contract.storage.collection;
    const list = Array.isArray(db[collection]) ? db[collection].slice() : [];
    const trimmed = String(newVal || "").trim();
    if (!trimmed) { showToast("Darf nicht leer sein."); return false; }
    if (isNew) {
      if (list.includes(trimmed)) { showToast("Dieser Eintrag existiert schon."); return false; }
      list.push(trimmed);
    } else {
      const idx = list.indexOf(originalVal);
      if (list.includes(trimmed) && trimmed !== originalVal) { showToast("Dieser Eintrag existiert schon."); return false; }
      if (idx === -1) list.push(trimmed); else list[idx] = trimmed;
    }
    TakeoffData.admin.saveDraft({ db: { [collection]: list } });
    refreshDraftBar();
    showToast("Gespeichert ✓");
    return true;
  }

  async function deleteFlatCollection(contract, val) {
    const db = await getDb();
    const collection = contract.storage.collection;
    const list = (Array.isArray(db[collection]) ? db[collection] : []).filter((x) => x !== val);
    TakeoffData.admin.saveDraft({ db: { [collection]: list } });
    refreshDraftBar();
    showToast("Gelöscht ✓");
  }

  /* ================= Generische Feld-Ableitung für Seiten ohne Contract ================= */
  function inferOne(key, path, v, labels) {
    const label = labels[path] || AF.prettifyKey(key);
    if (Array.isArray(v)) return { key: path, type: "list", label, of: inferListOf(v) };
    if (v !== null && typeof v === "object") return { key: path, type: "group", label, fields: inferFields(v, labels, [], path) };
    if (typeof v === "number") return { key: path, type: "number", label };
    if (typeof v === "boolean") return { key: path, type: "toggle", label };
    return { key: path, type: "text", label };
  }
  function inferFields(obj, labels, skipKeys, prefix) {
    const out = [];
    for (const k of Object.keys(obj || {})) {
      if ((skipKeys || []).includes(k)) continue;
      const path = prefix ? prefix + "." + k : k;
      out.push(inferOne(k, path, obj[k], labels));
    }
    return out;
  }
  function inferListOf(arr) {
    if (!arr.length) return [{ key: "value", type: "text", label: "Wert" }];
    const allPrimitive = arr.every((it) => it === null || typeof it !== "object");
    if (allPrimitive) return [{ key: "value", type: "text", label: "Wert" }];
    const keys = [];
    for (const it of arr) if (it && typeof it === "object") for (const k of Object.keys(it)) if (!keys.includes(k)) keys.push(k);
    return keys.map((k) => {
      const sample = arr.find((it) => it && it[k] !== undefined)?.[k];
      return inferOne(k, k, sample, {});
    });
  }

  /* ================= PAGE-Sektion ================= */
  async function renderPageSection(entry) {
    els.content.innerHTML = "";
    if (!entry) { renderWelcome(); return; }
    const db = await getDb();

    let data, fields, isGeneric = !entry.dedicated;
    if (entry.dedicated) {
      data = (await TakeoffData.page(entry.slug)) ?? {};
      fields = entry.contract.fields || [];
    } else {
      const raw = await TakeoffData.page(entry.slug);
      if (raw === null || raw === undefined) {
        els.content.append(
          sectionHeader({ title: entry.label, icon: entry.icon }),
          sectionErrorBox(
            "Noch keine Inhalte-Datei",
            `assets/data/pages/${entry.slug}.json existiert noch nicht. Sobald die Seiten-Werkstatt diese Datei anlegt, erscheint hier automatisch ein Formular — du musst nichts weiter tun.`
          )
        );
        return;
      }
      data = raw;
      fields = inferFields(data, raw._labels || {}, ["_labels"], "");
    }

    els.content.appendChild(sectionHeader({
      title: entry.label, icon: entry.icon,
      desc: entry.dedicated ? entry.contract.description : `Automatisch erkannte Felder aus assets/data/pages/${entry.slug}.json — String → Textfeld, Liste → wiederholbare Einträge, Objekt → Gruppe.`,
    }));

    if (!fields.length) {
      els.content.appendChild(h("p", { class: "admin-empty", text: "Diese Seiten-Datei enthält aktuell keine Felder." }));
      return;
    }

    const form = h("form", { class: "admin-form", novalidate: "novalidate" });
    const grid = h("div", { class: "form-grid" });
    const controllers = [];
    for (const f of fields) {
      const val = AF.getPath(data, f.key);
      const ctrl = AF.createField(f, val, ctxFor(db));
      controllers.push(ctrl);
      grid.appendChild(ctrl.el);
    }
    form.appendChild(grid);
    const actions = h("div", { class: "form-actions" }, [h("button", { type: "submit", class: "btn btn-primary" }, ["Speichern"])]);
    form.appendChild(actions);
    els.content.appendChild(form);

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      let firstInvalid = null;
      for (const c of controllers) {
        const err = c.validate ? c.validate() : null;
        c.showError?.(err);
        if (err && !firstInvalid) firstInvalid = c;
      }
      if (firstInvalid) { firstInvalid.focusInvalid?.(); showToast("Bitte markierte Felder prüfen."); return; }
      const working = AF.cloneDeep(data || {});
      for (const c of controllers) AF.setPath(working, c.key, c.collect());
      if (isGeneric && data && data._labels) working._labels = data._labels;
      TakeoffData.admin.saveDraft({ pages: { [entry.slug]: working } });
      refreshDraftBar();
      showToast("Gespeichert ✓");
    });
  }

  /* ================= Init ================= */
  async function init() {
    els.btnExport?.addEventListener("click", doExport);
    els.btnDiscard?.addEventListener("click", doDiscard);
    window.addEventListener("hashchange", renderRoute);
    window.addEventListener("takeoff:draft", refreshDraftBar);

    if (!window.TakeoffData) {
      els.sidebar.innerHTML = "";
      els.sidebar.appendChild(h("p", { class: "sidebar-error", text: "assets/js/data.js fehlt oder konnte nicht geladen werden." }));
      els.content.innerHTML = "";
      els.content.appendChild(sectionErrorBox("Datenschicht nicht verfügbar", "TakeoffData wurde nicht gefunden. Prüfe, ob assets/js/data.js vor admin.js eingebunden ist und keinen Ladefehler wirft."));
      refreshDraftBar();
      return;
    }

    await loadAll();
    renderSidebar();
    refreshDraftBar();

    if (!location.hash) {
      const first = state.entityContracts.find((e) => e.contract)?.id;
      if (first) { location.hash = "entity-" + first; return; }
      const firstPage = state.pageEntries[0]?.id;
      if (firstPage) { location.hash = firstPage; return; }
      renderWelcome();
    } else {
      renderRoute();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
