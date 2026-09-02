/* ============================================================
   AdminFields — Bausteine für den Formular-Generator der Settings-Seite
   (It. 10). Reine Helfer + Feld-Controller-Fabrik, kennt weder Contracts
   noch TakeoffData direkt — bekommt alles über `ctx` gereicht. So bleibt
   admin.js (die eigentliche App-Logik) unabhängig testbar/austauschbar.

   Ein Feld-Controller ist immer ein Objekt:
     { key, wide, el, collect(), validate() -> null|Fehlertext, focusInvalid() }
   `collect()` liefert den aktuellen Wert (Rohtyp, kein Pfad-Objekt).
   ============================================================ */
(() => {
  "use strict";

  /* ---------- kleine DOM-Fabrik ---------- */
  function h(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === "class") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k === "html") node.innerHTML = v;
        else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
        else if (v === true) node.setAttribute(k, "");
        else node.setAttribute(k, v);
      }
    }
    for (const c of [].concat(children || [])) {
      if (c === undefined || c === null || c === false) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  /* ---------- Pfad-Helfer (Dot-Paths wie "venue.name") ---------- */
  function getPath(obj, path) {
    if (obj === undefined || obj === null) return undefined;
    return String(path).split(".").reduce((o, k) => (o === undefined || o === null ? undefined : o[k]), obj);
  }
  function setPath(obj, path, value) {
    const keys = String(path).split(".");
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (cur[k] === undefined || cur[k] === null || typeof cur[k] !== "object" || Array.isArray(cur[k])) cur[k] = {};
      cur = cur[k];
    }
    cur[keys[keys.length - 1]] = value;
    return obj;
  }

  function cloneDeep(x) {
    if (x === undefined) return undefined;
    try { return structuredClone(x); } catch { return JSON.parse(JSON.stringify(x)); }
  }

  /* ---------- Slug / Label-Ableitung ---------- */
  const UMLAUT_MAP = { ä: "ae", ö: "oe", ü: "ue", Ä: "Ae", Ö: "Oe", Ü: "Ue", ß: "ss" };
  function slugify(str) {
    let s = String(str ?? "").trim();
    s = s.replace(/[äöüÄÖÜß]/g, (c) => UMLAUT_MAP[c] || c);
    s = s.normalize("NFKD").replace(/[̀-ͯ]/g, ""); // restliche Diakritika
    s = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
    return s;
  }
  function prettifyKey(key) {
    const last = String(key).split(".").pop();
    const spaced = last
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  /* ---------- Farbe: Hex <-> "R G B"-Trio ---------- */
  function hexToRgbTriplet(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || "").trim());
    if (!m) return "224 79 180";
    return [1, 2, 3].map((i) => parseInt(m[i], 16)).join(" ");
  }
  function rgbTripletToHex(triplet) {
    const parts = String(triplet || "").trim().split(/\s+/).map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return "#e04fb4";
    return "#" + parts.map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")).join("");
  }
  function looksLikeRgbTriplet(v) { return /^\d{1,3}\s+\d{1,3}\s+\d{1,3}$/.test(String(v || "").trim()); }

  /* ---------- richtextLite: **fett** + Leerzeile=Absatz, nur für die Live-Vorschau ---------- */
  function renderRichLite(str) {
    const paras = String(str ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    if (!paras.length) return "<p class=\"rl-empty\">(leer)</p>";
    return paras.map((p) => {
      const bold = escapeHtml(p).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      return `<p>${bold.replace(/\n/g, "<br>")}</p>`;
    }).join("");
  }

  /* ---------- Icon-Set (24x24, Linien-Stil wie im Rest der Seite) ----------
     Unbekannte Bezeichner fallen auf einen schlichten Punkt zurück statt zu crashen. */
  const ICON_PATHS = {
    calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
    headphones: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="13.5" width="4" height="6" rx="1.5"/><rect x="17" y="13.5" width="4" height="6" rx="1.5"/>',
    handshake: '<rect x="3" y="7" width="11" height="11" rx="3"/><rect x="10" y="7" width="11" height="11" rx="3" opacity=".55"/>',
    users: '<circle cx="8.5" cy="8" r="3"/><path d="M2.8 19c.6-3.4 3-5.4 5.7-5.4S13.6 15.6 14.2 19"/><circle cx="16.5" cy="9" r="2.4"/><path d="M15 13.3c2.2.2 4 1.9 4.5 4.7"/>',
    megaphone: '<path d="M3 10v4h3l9 4V6l-9 4H3z"/><path d="M17 9.5a3 3 0 0 1 0 5M19.3 7.5a6 6 0 0 1 0 9"/>',
    timeline: '<path d="M3 12h18"/><circle cx="7" cy="12" r="1.6"/><circle cx="13" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    star: '<path d="M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9z"/>',
    sliders: '<path d="M4 6h9M17 6h3M4 12h3M9 12h11M4 18h13M19 18h1"/><circle cx="11" cy="6" r="2"/><circle cx="7" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    shield: '<path d="M12 3.5l7 2.6v5.4c0 4.6-3 7.6-7 9-4-1.4-7-4.4-7-9V6.1z"/>',
    rocket: '<path d="M12 2.5c2.8 2.6 3.8 6 3.8 9.2l-1.3 4.1h-5L8.2 11.7c0-3.2 1-6.6 3.8-9.2z"/><circle cx="12" cy="9.5" r="1.7"/><path d="M8.6 13.2 5.8 15.8l1.7.9h2.2M15.4 13.2l2.8 2.6-1.7.9h-2.2"/>',
    mail: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M4 7l8 6 8-6"/>',
    newspaper: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><path d="M7 9h4v4H7zM13 9h4M13 12h4M7 15h10"/>',
    file: '<path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/>',
    planet: '<circle cx="12" cy="12" r="5.2"/><path d="M3.5 14.8c2.8 2.1 14.2 1.9 17-2.8"/>',
    umbrella: '<path d="M4 12.5a8 8 0 0 1 16 0z"/><path d="M12 4.5V3M12 12.5V19a2 2 0 0 0 4 .5"/>',
    heart: '<path d="M12 20s-7.2-4.6-9.2-9A5.2 5.2 0 0 1 12 6.6 5.2 5.2 0 0 1 21.2 11c-2 4.4-9.2 9-9.2 9z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    up: '<path d="M6 14l6-6 6 6"/>',
    down: '<path d="M6 10l6 6 6-6"/>',
    close: '<path d="M5 5l14 14M19 5L5 19"/>',
    check: '<path d="M4 12.5l5 5L20 6.5"/>',
    fallback: '<circle cx="12" cy="12" r="7.5"/>',
  };
  function iconSvg(name, cls) {
    const d = ICON_PATHS[name] || ICON_PATHS.fallback;
    return `<svg class="${cls || "icn"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  }
  /* iconSvg() liefert Markup als String — richtig für den `html:`-Attribut-Weg von h().
     Für den Einsatz als Array-Kind (h(tag, attrs, [iconEl(...), "Text"])) braucht es dagegen
     einen echten DOM-Knoten, sonst würde h() den String als Text-Node einfügen (sichtbarer
     Markup-Quelltext statt Icon). <template> parst ohne zusätzlichen Wrapper-Knoten. */
  function iconEl(name, cls) {
    const tpl = document.createElement("template");
    tpl.innerHTML = iconSvg(name, cls);
    return tpl.content.firstElementChild;
  }

  /* ---------- Feld-Hülle: Label + Hilfetext + Fehlertext, für einfache Feldtypen ---------- */
  let uidCounter = 0;
  function nextId(prefix) { return `${prefix}-${++uidCounter}`; }

  function fieldShell(fieldDef, inputEl, opts) {
    opts = opts || {};
    const id = opts.id || nextId("f");
    inputEl.id = id;
    const label = h("label", { for: id, class: "field-label" }, [
      fieldDef.label || prettifyKey(fieldDef.key || ""),
      fieldDef.required ? h("span", { class: "field-req", "aria-hidden": "true", text: " *" }) : null,
    ]);
    const errorEl = h("p", { class: "field-error", id: id + "-err" });
    inputEl.setAttribute("aria-describedby", [id + "-help", id + "-err"].filter(Boolean).join(" "));
    const parts = [label, inputEl];
    if (fieldDef.activates) {
      parts.push(h("p", { class: "field-activates" }, [iconEl("check", "icn icn-sm"), " " + fieldDef.activates]));
    }
    if (fieldDef.help) parts.push(h("p", { class: "field-help", id: id + "-help", text: fieldDef.help }));
    parts.push(errorEl);
    const wide = ["textarea", "richtextLite", "list", "images", "theme", "multiselect", "json", "group"].includes(fieldDef.type);
    const wrap = h("div", { class: "field field-" + fieldDef.type + (wide ? " field-wide" : "") }, parts);
    return { wrap, id, errorEl };
  }

  function setError(errorEl, msg) {
    errorEl.textContent = msg || "";
    errorEl.classList.toggle("show", !!msg);
  }

  /* ---------- einfache Feldtypen ---------- */
  function fText(fieldDef, value, opts) {
    const tag = opts?.tag || "input";
    const input = h(tag, { type: tag === "input" ? (opts?.inputType || "text") : undefined, class: "input", placeholder: fieldDef.placeholder || "" });
    input.value = value ?? "";
    if (opts?.list) input.setAttribute("list", opts.list);
    if (fieldDef.disabled) input.disabled = true;
    const shell = fieldShell(fieldDef, input);
    return {
      key: fieldDef.key, type: fieldDef.type, el: shell.wrap, inputEl: input,
      collect: () => input.value,
      validate: () => (fieldDef.required && !String(input.value ?? "").trim()) ? "Pflichtfeld — bitte ausfüllen." : null,
      showError: (m) => setError(shell.errorEl, m),
      focusInvalid: () => input.focus(),
    };
  }

  function fNumber(fieldDef, value) {
    const input = h("input", { type: "number", class: "input", step: "any" });
    input.value = (value === undefined || value === null || value === "") ? "" : value;
    const shell = fieldShell(fieldDef, input);
    return {
      key: fieldDef.key, type: "number", el: shell.wrap, inputEl: input,
      collect: () => (input.value === "" ? "" : Number(input.value)),
      validate: () => (fieldDef.required && input.value === "") ? "Pflichtfeld — bitte ausfüllen." : null,
      showError: (m) => setError(shell.errorEl, m),
      focusInvalid: () => input.focus(),
    };
  }

  function fToggle(fieldDef, value) {
    const input = h("input", { type: "checkbox", class: "switch-input" });
    input.checked = value === undefined ? !!fieldDef.default : !!value;
    const id = nextId("f");
    input.id = id;
    const label = h("label", { for: id, class: "switch" }, [
      input,
      h("span", { class: "switch-track", "aria-hidden": "true" }),
      h("span", { class: "switch-text", text: fieldDef.label || prettifyKey(fieldDef.key) }),
    ]);
    const parts = [label];
    if (fieldDef.help) parts.push(h("p", { class: "field-help", text: fieldDef.help }));
    const wrap = h("div", { class: "field field-toggle" }, parts);
    return {
      key: fieldDef.key, type: "toggle", el: wrap, inputEl: input,
      collect: () => input.checked,
      validate: () => null,
      showError: () => {},
      focusInvalid: () => input.focus(),
    };
  }

  function fTextarea(fieldDef, value) {
    const input = h("textarea", { class: "input textarea", rows: 4 });
    input.value = value ?? "";
    const shell = fieldShell(fieldDef, input);
    return {
      key: fieldDef.key, type: "textarea", el: shell.wrap, inputEl: input,
      collect: () => input.value,
      validate: () => (fieldDef.required && !String(input.value ?? "").trim()) ? "Pflichtfeld — bitte ausfüllen." : null,
      showError: (m) => setError(shell.errorEl, m),
      focusInvalid: () => input.focus(),
    };
  }

  function fRichLite(fieldDef, value) {
    const input = h("textarea", { class: "input textarea", rows: 5 });
    input.value = value ?? "";
    const preview = h("div", { class: "rl-preview", html: renderRichLite(input.value) });
    input.addEventListener("input", () => { preview.innerHTML = renderRichLite(input.value); });
    const shell = fieldShell(fieldDef, input);
    shell.wrap.appendChild(h("p", { class: "rl-preview-label", text: "Vorschau:" }));
    shell.wrap.appendChild(preview);
    return {
      key: fieldDef.key, type: "richtextLite", el: shell.wrap, inputEl: input,
      collect: () => input.value,
      validate: () => (fieldDef.required && !String(input.value ?? "").trim()) ? "Pflichtfeld — bitte ausfüllen." : null,
      showError: (m) => setError(shell.errorEl, m),
      focusInvalid: () => input.focus(),
    };
  }

  function fSelect(fieldDef, value, options) {
    const select = h("select", { class: "input select" });
    if (!fieldDef.required) select.appendChild(h("option", { value: "", text: "— wählen —" }));
    for (const opt of options) select.appendChild(h("option", { value: opt.value, text: opt.label, selected: String(opt.value) === String(value ?? "") || undefined }));
    if (value !== undefined && value !== null) select.value = value;
    const shell = fieldShell(fieldDef, select);
    return {
      key: fieldDef.key, type: fieldDef.type, el: shell.wrap, inputEl: select,
      collect: () => select.value,
      validate: () => (fieldDef.required && !select.value) ? "Bitte auswählen." : null,
      showError: (m) => setError(shell.errorEl, m),
      focusInvalid: () => select.focus(),
    };
  }

  function fColor(fieldDef, value) {
    const asTriplet = looksLikeRgbTriplet(fieldDef.default ?? value);
    const hex = asTriplet ? rgbTripletToHex(value ?? fieldDef.default) : (value || fieldDef.default || "#e04fb4");
    const colorInput = h("input", { type: "color", class: "input-color", "aria-hidden": "true", tabindex: "-1" });
    colorInput.value = /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#e04fb4";
    // textInput trägt Label/id/aria (fieldShell) — colorInput ist ein reiner visueller Zusatz-Picker,
    // der textInput spiegelt; ohne eigenes Label wäre er sonst ein unbeschrifteter Swatch im Tab-Ring.
    const textInput = h("input", { type: "text", class: "input input-color-text", placeholder: asTriplet ? "224 79 180" : "#e04fb4" });
    textInput.value = value ?? fieldDef.default ?? "";
    colorInput.addEventListener("input", () => {
      textInput.value = asTriplet ? hexToRgbTriplet(colorInput.value) : colorInput.value;
    });
    textInput.addEventListener("input", () => {
      const v = textInput.value.trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) colorInput.value = v;
      else if (looksLikeRgbTriplet(v)) colorInput.value = rgbTripletToHex(v);
    });
    const shell = fieldShell(fieldDef, textInput);
    shell.wrap.insertBefore(colorInput, textInput);
    shell.wrap.classList.add("field-color-composite");
    return {
      key: fieldDef.key, type: "color", el: shell.wrap, inputEl: textInput,
      collect: () => textInput.value.trim() || (asTriplet ? hexToRgbTriplet(colorInput.value) : colorInput.value),
      validate: () => null,
      showError: (m) => setError(shell.errorEl, m),
      focusInvalid: () => textInput.focus(),
    };
  }

  function fImageInput(fieldDef, value, ctx) {
    const input = h("input", { type: "text", class: "input", list: ctx.imageListId, placeholder: "assets/img/… oder https://…" });
    input.value = value ?? "";
    const thumbWrap = h("div", { class: "img-thumb-wrap" });
    const updateThumb = () => {
      thumbWrap.innerHTML = "";
      const v = input.value.trim();
      if (!v) return;
      const img = h("img", { src: v, alt: "", class: "img-thumb" });
      img.addEventListener("error", () => { thumbWrap.innerHTML = ""; });
      thumbWrap.appendChild(img);
    };
    input.addEventListener("change", updateThumb);
    input.addEventListener("input", updateThumb);
    updateThumb();
    const shell = fieldShell(fieldDef, input);
    shell.wrap.appendChild(thumbWrap);
    return {
      key: fieldDef.key, type: "image", el: shell.wrap, inputEl: input,
      collect: () => input.value.trim(),
      validate: () => (fieldDef.required && !input.value.trim()) ? "Pflichtfeld — Bild wählen oder URL eintragen." : null,
      showError: (m) => setError(shell.errorEl, m),
      focusInvalid: () => input.focus(),
    };
  }

  /* ---------- JSON-Fallback für unbekannte Feldtypen ---------- */
  function fJsonFallback(fieldDef, value) {
    const input = h("textarea", { class: "input textarea mono", rows: 5 });
    input.value = JSON.stringify(value ?? null, null, 2);
    const warn = h("p", { class: "field-warn" }, [`⚠ Unbekannter Feldtyp „${fieldDef.type}“ — wird als Roh-JSON bearbeitet. Bitte gültiges JSON eingeben.`]);
    const shell = fieldShell({ ...fieldDef, help: fieldDef.help }, input);
    shell.wrap.insertBefore(warn, shell.wrap.firstChild.nextSibling);
    return {
      key: fieldDef.key, type: "json", el: shell.wrap, inputEl: input,
      collect: () => {
        try { return JSON.parse(input.value); }
        catch { return input.value; }
      },
      validate: () => {
        try { JSON.parse(input.value); return null; }
        catch { return "Kein gültiges JSON — Änderung wird trotzdem als Text gespeichert."; }
      },
      showError: (m) => setError(shell.errorEl, m),
      focusInvalid: () => input.focus(),
    };
  }

  /* ---------- Relation / Multiselect (statisch oder aus Collection) ---------- */
  function collectionRecords(ctx, collectionName) {
    const db = ctx.db || {};
    const list = db[collectionName];
    return Array.isArray(list) ? list : [];
  }
  function collectionKeyField(ctx, collectionName) {
    return ctx.contractsByCollection?.[collectionName]?.storage?.key || "slug";
  }
  function optionsFromCollection(ctx, collectionName, displayField) {
    const keyField = collectionKeyField(ctx, collectionName);
    const df = displayField || "name";
    return collectionRecords(ctx, collectionName).map((r) => ({
      value: typeof r === "string" ? r : (r[keyField] ?? r[df] ?? ""),
      label: typeof r === "string" ? r : (r[df] ?? r[keyField] ?? "(ohne Namen)"),
    }));
  }

  function fRelation(fieldDef, value, ctx) {
    if (fieldDef.allowFreeText) {
      const opts = optionsFromCollection(ctx, fieldDef.collection, fieldDef.displayField);
      const listId = nextId("dl");
      const datalist = h("datalist", { id: listId }, opts.map((o) => h("option", { value: o.label })));
      const input = h("input", { type: "text", class: "input", list: listId, placeholder: "Bestehenden Namen tippen oder frei eintragen" });
      input.value = value ?? "";
      const shell = fieldShell(fieldDef, input);
      shell.wrap.appendChild(datalist);
      return {
        key: fieldDef.key, type: "relation", el: shell.wrap, inputEl: input,
        collect: () => input.value.trim(),
        validate: () => (fieldDef.required && !input.value.trim()) ? "Pflichtfeld — bitte auswählen oder eintippen." : null,
        showError: (m) => setError(shell.errorEl, m),
        focusInvalid: () => input.focus(),
      };
    }
    const opts = optionsFromCollection(ctx, fieldDef.collection, fieldDef.displayField);
    return fSelect(fieldDef, value, opts);
  }

  function fMultiselect(fieldDef, value, ctx) {
    const values = Array.isArray(value) ? value.map(String) : [];
    const opts = fieldDef.collection
      ? optionsFromCollection(ctx, fieldDef.collection, fieldDef.displayField)
      : (fieldDef.options || []);
    const legend = h("legend", { class: "field-label", text: fieldDef.label || prettifyKey(fieldDef.key) });
    const box = h("div", { class: "checklist", role: "group" });
    if (!opts.length) box.appendChild(h("p", { class: "field-empty-note", text: "Noch keine Einträge in der Zielliste vorhanden." }));
    const boxes = opts.map((o) => {
      const cb = h("input", { type: "checkbox", value: o.value, checked: values.includes(String(o.value)) || undefined });
      const id = nextId("ms");
      cb.id = id;
      box.appendChild(h("label", { for: id, class: "checklist-item" }, [cb, h("span", { text: o.label })]));
      return cb;
    });
    const parts = [legend, box];
    if (fieldDef.help) parts.push(h("p", { class: "field-help", text: fieldDef.help }));
    const errorEl = h("p", { class: "field-error" });
    parts.push(errorEl);
    const wrap = h("fieldset", { class: "field field-multiselect field-wide" }, parts);
    return {
      key: fieldDef.key, type: "multiselect", el: wrap,
      collect: () => boxes.filter((b) => b.checked).map((b) => b.value),
      validate: () => null,
      showError: (m) => setError(errorEl, m),
      focusInvalid: () => (boxes[0] || box).focus?.(),
    };
  }

  /* ---------- Theme-Widget (Preset + Akzentfarbe + Patch) ---------- */
  const THEME_PRESET_SWATCH = {
    space: "linear-gradient(135deg, #1b1f2c, #52b1e0)",
    mars: "linear-gradient(135deg, #21101c, #e85a34)",
    strand: "linear-gradient(135deg, #0f1b2e, #e5c25c)",
  };
  const THEME_PRESET_LABEL = { space: "Space (Standard)", mars: "Mars", strand: "Strand" };

  function fTheme(fieldDef, value) {
    const def = fieldDef.default || { preset: "space", accent: "#e04fb4", accentRgb: "224 79 180", patch: "star" };
    const cur = { ...def, ...(value || {}) };
    const presets = fieldDef.options?.presets || ["space", "mars", "strand"];
    const patches = fieldDef.options?.patches || ["star", "planet", "umbrella", "heart"];

    const presetName = nextId("theme-preset");
    const presetRow = h("div", { class: "theme-presets", role: "radiogroup", "aria-label": "Hintergrund-Preset" });
    const presetInputs = presets.map((p) => {
      const id = nextId("tp");
      const radio = h("input", { type: "radio", name: presetName, value: p, id, checked: (cur.preset || "space") === p || undefined });
      const swatch = h("span", { class: "theme-swatch", style: `background:${THEME_PRESET_SWATCH[p] || "#333"}` });
      presetRow.appendChild(h("label", { for: id, class: "theme-preset-opt" }, [radio, swatch, h("span", { text: THEME_PRESET_LABEL[p] || p })]));
      return radio;
    });

    const accentId = nextId("theme-accent");
    const accentInput = h("input", { type: "color", class: "input-color", id: accentId });
    accentInput.value = /^#[0-9a-f]{6}$/i.test(cur.accent) ? cur.accent : "#e04fb4";
    const accentHexText = h("span", { class: "mono-readout", text: accentInput.value });
    const rgbReadout = h("span", { class: "mono-readout", text: hexToRgbTriplet(accentInput.value) });
    accentInput.addEventListener("input", () => {
      accentHexText.textContent = accentInput.value;
      rgbReadout.textContent = hexToRgbTriplet(accentInput.value);
    });
    const accentRow = h("div", { class: "theme-accent-row" }, [
      h("label", { class: "field-label field-label-inline", for: accentId, text: "Akzentfarbe" }),
      accentInput, accentHexText,
      h("span", { class: "theme-rgb-note" }, ["→ RGB (automatisch): ", rgbReadout]),
    ]);

    const patchName = nextId("theme-patch");
    const patchRow = h("div", { class: "theme-patches", role: "radiogroup", "aria-label": "Patch-Symbol" });
    const patchInputs = patches.map((p) => {
      const id = nextId("tpp");
      const radio = h("input", { type: "radio", name: patchName, value: p, id, checked: (cur.patch || "star") === p || undefined });
      patchRow.appendChild(h("label", { for: id, class: "theme-patch-opt", title: p }, [radio, h("span", { class: "theme-patch-icon", html: iconSvg(p, "icn") })]));
      return radio;
    });

    const legend = h("legend", { class: "field-label", text: fieldDef.label || "Hintergrund-Thema" });
    const parts = [legend,
      h("p", { class: "theme-subhead", text: "Preset" }), presetRow,
      h("p", { class: "theme-subhead", text: "Patch-Symbol (Missions-Archiv)" }), patchRow,
      accentRow,
    ];
    if (fieldDef.help) parts.push(h("p", { class: "field-help", text: fieldDef.help }));
    const wrap = h("fieldset", { class: "field field-theme field-wide" }, parts);
    return {
      key: fieldDef.key, type: "theme", el: wrap,
      collect: () => {
        const preset = (presetInputs.find((r) => r.checked) || presetInputs[0])?.value || "space";
        const patch = (patchInputs.find((r) => r.checked) || patchInputs[0])?.value || "star";
        const accent = accentInput.value;
        return { preset, accent, accentRgb: hexToRgbTriplet(accent), patch };
      },
      validate: () => null,
      showError: () => {},
      focusInvalid: () => presetInputs[0]?.focus(),
    };
  }

  /* ---------- Listen (einfache String-Listen + mehrfeldige Listen), rekursiv ---------- */
  function defaultForFieldDef(fieldDef) {
    if (fieldDef.default !== undefined) return cloneDeep(fieldDef.default);
    switch (fieldDef.type) {
      case "toggle": return false;
      case "number": return 0;
      case "list": return [];
      case "images": return [];
      case "multiselect": return [];
      case "theme": return { preset: "space", accent: "#e04fb4", accentRgb: "224 79 180", patch: "star" };
      case "group": return {};
      default: return "";
    }
  }

  function isSimpleTextList(fieldDef) {
    // "value"-Einzelfeld vom Typ text ODER image -> flaches String-Array (wie db.json es überall hält,
    // z.B. gallery: ["assets/img/...", …]). "image" gehört bewusst mit dazu: fImages() baut seine Zeilen
    // genau darüber (of: [{key:"value", type:"image"}]) — ohne das würde jede Galerie als Array von
    // {value:"…"}-Objekten statt als flaches Pfad-Array gespeichert.
    return Array.isArray(fieldDef.of) && fieldDef.of.length === 1 && fieldDef.of[0].key === "value"
      && (fieldDef.of[0].type === "text" || fieldDef.of[0].type === "image");
  }

  function fList(fieldDef, value, ctx, createFieldFn) {
    const arr = Array.isArray(value) ? cloneDeep(value) : [];
    const simple = isSimpleTextList(fieldDef);
    const legend = h("legend", { class: "field-label", text: fieldDef.label || prettifyKey(fieldDef.key) });
    const rowsWrap = h("div", { class: "list-rows" });
    const emptyNote = h("p", { class: "field-empty-note", text: "Noch keine Einträge — mit „+“ hinzufügen." });
    let rows = []; // { wrapEl, controllers: [...] } bzw. { wrapEl, controller } bei simple

    function relabel() {
      rowsWrap.querySelectorAll(".list-row-index").forEach((elx, i) => { elx.textContent = "#" + (i + 1); });
      emptyNote.style.display = rows.length ? "none" : "";
    }
    function removeRow(rowObj) {
      rows = rows.filter((r) => r !== rowObj);
      rowObj.wrapEl.remove();
      relabel();
    }
    function moveRow(rowObj, delta) {
      const i = rows.indexOf(rowObj);
      const j = i + delta;
      if (j < 0 || j >= rows.length) return;
      [rows[i], rows[j]] = [rows[j], rows[i]];
      if (delta < 0) rowsWrap.insertBefore(rowObj.wrapEl, rows[j + 1].wrapEl);
      else rowsWrap.insertBefore(rows[j - 1].wrapEl, rowObj.wrapEl);
      relabel();
    }

    function addRow(initialVal) {
      const controls = h("div", { class: "list-row-controls" }, [
        h("span", { class: "list-row-index mono-readout" }),
        h("button", { type: "button", class: "icon-btn", "aria-label": "Nach oben", title: "Nach oben", onclick: () => moveRow(rowObj, -1), html: iconSvg("up") }),
        h("button", { type: "button", class: "icon-btn", "aria-label": "Nach unten", title: "Nach unten", onclick: () => moveRow(rowObj, 1), html: iconSvg("down") }),
        h("button", { type: "button", class: "icon-btn icon-btn-danger", "aria-label": "Eintrag löschen", title: "Eintrag löschen", onclick: () => removeRow(rowObj), html: iconSvg("close") }),
      ]);
      let body, rowObj;
      if (simple) {
        const ctrl = createFieldFn({ ...fieldDef.of[0], label: fieldDef.of[0].label || "Wert", required: false }, initialVal ?? "", ctx);
        body = h("div", { class: "list-row-body list-row-body-simple" }, [ctrl.el]);
        rowObj = { wrapEl: null, controller: ctrl };
      } else {
        const subControllers = (fieldDef.of || []).map((sub) => createFieldFn(sub, getPath(initialVal || {}, sub.key), ctx));
        body = h("div", { class: "list-row-body" }, subControllers.map((c) => c.el));
        rowObj = { wrapEl: null, controllers: subControllers };
      }
      const wrapEl = h("div", { class: "list-row" }, [controls, body]);
      rowObj.wrapEl = wrapEl;
      rows.push(rowObj);
      rowsWrap.appendChild(wrapEl);
      relabel();
    }

    for (const item of arr) addRow(item);
    relabel();

    const addBtn = h("button", { type: "button", class: "btn btn-ghost btn-sm", onclick: () => addRow(simple ? "" : {}) }, [iconEl("plus", "icn icn-sm"), " Eintrag hinzufügen"]);

    const parts = [legend];
    if (fieldDef.help) parts.push(h("p", { class: "field-help", text: fieldDef.help }));
    if (fieldDef.activates) parts.push(h("p", { class: "field-activates" }, [iconEl("check", "icn icn-sm"), " " + fieldDef.activates]));
    parts.push(emptyNote, rowsWrap, addBtn);
    const wrap = h("fieldset", { class: "field field-list field-wide" }, parts);

    return {
      key: fieldDef.key, type: "list", el: wrap,
      collect: () => rows.map((r) => simple ? r.controller.collect() : Object.fromEntries(r.controllers.map((c) => [c.key, c.collect()]))),
      validate: () => {
        for (const r of rows) {
          const ctrls = simple ? [r.controller] : r.controllers;
          for (const c of ctrls) { const e = c.validate?.(); if (e) return e; }
        }
        return null;
      },
      showError: () => {},
      focusInvalid: () => { (rows[0]?.controller || rows[0]?.controllers?.[0])?.focusInvalid?.(); },
    };
  }

  function fImages(fieldDef, value, ctx, createFieldFn) {
    const listLike = { ...fieldDef, type: "list", of: [{ key: "value", type: "image", label: "Bild" }] };
    const listCtrl = fList(listLike, value, ctx, createFieldFn);
    listCtrl.type = "images";
    listCtrl.el.classList.add("field-images");
    return listCtrl;
  }

  /* ---------- Gruppe (nur generische Seiten-Inferenz) ---------- */
  function fGroup(fieldDef, value, ctx, createFieldFn) {
    const legend = h("legend", { class: "field-label", text: fieldDef.label || prettifyKey(fieldDef.key) });
    const sub = (fieldDef.fields || []).map((f) => createFieldFn(f, getPath(value || {}, f.key.split(".").pop()), ctx));
    const wrap = h("fieldset", { class: "field field-group field-wide" }, [legend, ...sub.map((c) => c.el)]);
    return {
      key: fieldDef.key, type: "group", el: wrap,
      collect: () => Object.fromEntries(sub.map((c) => [c.key.split(".").pop(), c.collect()])),
      validate: () => { for (const c of sub) { const e = c.validate?.(); if (e) return e; } return null; },
      showError: () => {},
      focusInvalid: () => sub[0]?.focusInvalid?.(),
    };
  }

  /* ---------- Passwort-Stub ---------- */
  function fPassword(fieldDef, value) {
    const input = h("input", { type: "password", class: "input", disabled: true, placeholder: "••••••••" });
    input.value = "";
    const shell = fieldShell(fieldDef, input);
    return {
      key: fieldDef.key, type: "password", el: shell.wrap,
      collect: () => value ?? "",
      validate: () => null,
      showError: () => {},
      focusInvalid: () => {},
    };
  }

  /* ---------- Fabrik: dispatcht nach fieldDef.type ---------- */
  function createField(fieldDef, value, ctx) {
    const v = value === undefined ? defaultForFieldDef(fieldDef) : value;
    switch (fieldDef.type) {
      case "text": return fText(fieldDef, v);
      case "textarea": return fTextarea(fieldDef, v);
      case "richtextLite": return fRichLite(fieldDef, v);
      case "date": return fText(fieldDef, v, { inputType: "date" });
      case "time": return fText(fieldDef, v, { inputType: "time" });
      case "number": return fNumber(fieldDef, v);
      case "toggle": return fToggle(fieldDef, v);
      case "select": return fieldDef.collection ? fRelation({ ...fieldDef, allowFreeText: false }, v, ctx) : fSelect(fieldDef, v, fieldDef.options || []);
      case "multiselect": return fMultiselect(fieldDef, v, ctx);
      case "color": return fColor(fieldDef, v);
      case "image": return fImageInput(fieldDef, v, ctx);
      case "images": return fImages(fieldDef, v, ctx, createField);
      case "list": return fList(fieldDef, v, ctx, createField);
      case "relation": return fRelation(fieldDef, v, ctx);
      case "theme": return fTheme(fieldDef, v);
      case "password": return fPassword(fieldDef, v);
      case "group": return fGroup(fieldDef, v, ctx, createField);
      default: return fJsonFallback(fieldDef, v);
    }
  }

  window.AdminFields = {
    h, escapeHtml, getPath, setPath, cloneDeep,
    slugify, prettifyKey,
    hexToRgbTriplet, rgbTripletToHex,
    renderRichLite, iconSvg, iconEl,
    defaultForFieldDef, isSimpleTextList,
    createField,
  };
})();
