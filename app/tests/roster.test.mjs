/* Tests der Schichtverteilung.
   node --experimental-strip-types --test tests/roster.test.mjs */
import { test } from "node:test";
import assert from "node:assert/strict";
import { verteile, bilanz } from "../src/lib/intern/roster.ts";

const H = 3_600_000;
const T0 = new Date("2026-11-14T16:00:00Z").getTime();

/* Realistischer Zuschnitt laut Spec 25: sieben Bereiche, drei Zeitfenster,
   25 Leute — das sind 40 bis 80 Zuordnungen, die Groessenordnung eines
   echten takeoff-Events. */
const BEREICHE = ["bar", "einlass", "awareness", "garderobe", "aufbau", "sani", "essen"];

function slots() {
  const out = [];
  BEREICHE.forEach((b) => {
    for (let f = 0; f < 3; f++) {
      out.push({
        id: `${b}-${f}`,
        bereichId: b,
        start: T0 + f * 3 * H,
        ende: T0 + (f + 1) * 3 * H,
        plaetze: b === "bar" ? 3 : 2,
        brauchtSchulung: b === "bar" ? "barschicht" : b === "sani" ? "sani" : null,
      });
    }
  });
  return out;
}

function leute(n = 25) {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    verfuegbar: Object.fromEntries(
      slots().map((s) => [s.id, (i + s.id.length) % 5 === 0 ? "no" : (i % 3 === 0 ? "yes" : "maybe")]),
    ),
    wunschBereiche: [BEREICHE[i % BEREICHE.length], BEREICHE[(i + 1) % BEREICHE.length]],
    buddies: i > 0 ? [`p${i - 1}`] : [],
    maxSchichten: 3,
    // Jede zweite Person hat bereits Vorlast — der Ausgleich muss das sehen.
    schulungen: ["barschicht", "sani"].filter((_, k) => (i + k) % 2 === 0),
    lastBisher: i % 2 === 0 ? 4 : 0,
  }));
}

test("harte Regel: niemand bekommt zwei überlappende Schichten", () => {
  const s = slots(), p = leute();
  const e = verteile(s, p);
  const byId = new Map(s.map((x) => [x.id, x]));
  const proPerson = {};
  for (const z of e.zuordnungen) (proPerson[z.personId] ??= []).push(byId.get(z.slotId));
  for (const [person, list] of Object.entries(proPerson)) {
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++)
        assert.ok(
          !(list[i].start < list[j].ende && list[j].start < list[i].ende),
          `${person} hat zwei Schichten zur selben Zeit`,
        );
  }
});

test("harte Regel: Kapazität wird nie überschritten", () => {
  const s = slots(), e = verteile(s, leute());
  const zaehler = {};
  for (const z of e.zuordnungen) zaehler[z.slotId] = (zaehler[z.slotId] ?? 0) + 1;
  for (const slot of s)
    assert.ok((zaehler[slot.id] ?? 0) <= slot.plaetze, `${slot.id} überbelegt`);
});

test("harte Regel: „kann nicht“ ist bindend", () => {
  const s = slots(), p = leute();
  const byPerson = new Map(p.map((x) => [x.id, x]));
  for (const z of verteile(s, p).zuordnungen) {
    assert.notEqual(
      byPerson.get(z.personId).verfuegbar[z.slotId], "no",
      `${z.personId} wurde auf ${z.slotId} gesetzt, obwohl abgesagt`,
    );
  }
});

test("harte Regel: Schulungspflicht wird eingehalten", () => {
  const s = slots(), p = leute();
  const bySlot = new Map(s.map((x) => [x.id, x]));
  const byPerson = new Map(p.map((x) => [x.id, x]));
  for (const z of verteile(s, p).zuordnungen) {
    const noetig = bySlot.get(z.slotId).brauchtSchulung;
    if (noetig) {
      assert.ok(
        byPerson.get(z.personId).schulungen.includes(noetig),
        `${z.personId} ohne Einweisung „${noetig}“ auf ${z.slotId}`,
      );
    }
  }
});

test("harte Regel: die persönliche Obergrenze gilt", () => {
  const s = slots(), p = leute();
  const e = verteile(s, p);
  for (const person of p)
    assert.ok(e.last[person.id] <= person.maxSchichten, `${person.id} über der Obergrenze`);
});

test("fair: die saisonweite Lastspanne bleibt klein", () => {
  const s = slots(), p = leute();
  const e = verteile(s, p);
  // Gemessen wird die GESAMTlast (Vorlast + dieses Event), nicht die dieses
  // Events. "Gleiche Chancen" ist ein Saison-Versprechen: wer im Sommer viel
  // getragen hat, darf im November weniger bekommen — das ist der Ausgleich,
  // nicht sein Gegenteil.
  const gesamt = p.map((x) => x.lastBisher + e.last[x.id]);
  const spanne = Math.max(...gesamt) - Math.min(...gesamt);
  assert.ok(spanne <= 2, `saisonweite Spanne ${spanne} ist zu gross`);
});

test("fair: kein Tausch würde das Maximum noch senken", () => {
  // Eigenschaftstest statt Zahlenraten: Wenn es noch eine Zuordnung gäbe, die
  // von der schwerstbelasteten auf eine deutlich leichtere Person übergehen
  // könnte, hätte die Nachbesserung sie gefunden.
  const s = slots(), p = leute();
  const e = verteile(s, p);
  const byId = new Map(s.map((x) => [x.id, x]));
  const byPerson = new Map(p.map((x) => [x.id, x]));
  const gesamt = (id) => byPerson.get(id).lastBisher + e.last[id];
  const proPerson = {};
  for (const z of e.zuordnungen) (proPerson[z.personId] ??= []).push(z.slotId);

  for (const z of e.zuordnungen) {
    const slot = byId.get(z.slotId);
    for (const kandidat of p) {
      if (kandidat.id === z.personId) continue;
      if (gesamt(kandidat.id) + 1 > gesamt(z.personId) - 1) continue;
      if ((kandidat.verfuegbar[slot.id] ?? "maybe") === "no") continue;
      if (slot.brauchtSchulung && !kandidat.schulungen.includes(slot.brauchtSchulung)) continue;
      if (e.last[kandidat.id] >= kandidat.maxSchichten) continue;
      if (e.zuordnungen.some((y) => y.slotId === slot.id && y.personId === kandidat.id)) continue;
      const kollision = (proPerson[kandidat.id] ?? []).some((sid) => {
        const a = byId.get(sid);
        return a.start < slot.ende && slot.start < a.ende;
      });
      if (kollision) continue;
      assert.fail(
        `Tausch übersehen: ${slot.id} könnte von ${z.personId} (${gesamt(z.personId)}) ` +
        `auf ${kandidat.id} (${gesamt(kandidat.id)}) übergehen`,
      );
    }
  }
});

test("fair: wer schon viel getragen hat, kommt später dran", () => {
  const s = slots().slice(0, 3);
  const p = [
    { id: "viel", verfuegbar: {}, wunschBereiche: [], buddies: [], maxSchichten: 3,
      schulungen: ["barschicht", "sani"], lastBisher: 8 },
    { id: "wenig", verfuegbar: {}, wunschBereiche: [], buddies: [], maxSchichten: 3,
      schulungen: ["barschicht", "sani"], lastBisher: 0 },
  ];
  const e = verteile(s, p);
  assert.ok(
    e.last["wenig"] >= e.last["viel"],
    `„wenig“ (${e.last["wenig"]}) müsste mindestens so viel bekommen wie „viel“ (${e.last["viel"]})`,
  );
});

test("Wünsche werden berücksichtigt", () => {
  const s = slots(), p = leute();
  const b = bilanz(verteile(s, p), s, p);
  assert.ok(b.wunschQuote > 0.4, `nur ${Math.round(b.wunschQuote * 100)} % im Wunschbereich`);
});

test("deterministisch: gleicher Seed, gleiches Ergebnis", () => {
  const s = slots(), p = leute();
  const a = verteile(s, p, { seed: 7 });
  const b = verteile(s, p, { seed: 7 });
  assert.deepEqual(a.zuordnungen, b.zuordnungen);
});

test("Lücken werden gemeldet, nicht verschwiegen", () => {
  const s = [{
    id: "sani-0", bereichId: "sani", start: T0, ende: T0 + 3 * H,
    plaetze: 2, brauchtSchulung: "sani",
  }];
  const p = [{
    id: "ohne", verfuegbar: { "sani-0": "yes" }, wunschBereiche: ["sani"],
    buddies: [], maxSchichten: 3, schulungen: [], lastBisher: 0,
  }];
  const e = verteile(s, p);
  assert.equal(e.zuordnungen.length, 0);
  assert.equal(e.luecken.length, 1);
  assert.equal(e.luecken[0].offen, 2);
  assert.match(e.luecken[0].grund, /Einweisung/);
});

test("jede Zuordnung trägt eine Begründung", () => {
  for (const z of verteile(slots(), leute()).zuordnungen) {
    assert.ok(z.begruendung.length > 5, "leere Begründung");
  }
});
