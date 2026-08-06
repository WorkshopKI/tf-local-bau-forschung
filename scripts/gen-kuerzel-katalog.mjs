/**
 * Erzeugt `src/core/status/kuerzel-katalog.data.ts` aus der Kürzel-Zuarbeit
 * („Gelbe Karte", `docs/status-system/kuerzel-zuarbeit/`).
 *
 *     npm run gen:kuerzel-katalog
 *
 * **Warum ein eigener Katalog neben `seed-codes.data.ts`.** Der bestehende Seed
 * ist FLACH: ein Kürzel, eine Bezeichnung. 77 Kürzel bedeuten aber je nach
 * Projektform etwas anderes — `AB` ist in DL die „Bewilligungsempfehlung durch
 * Haushaltsbeauftragte", sonst „bewilligungsreif/Akte an Euronorm". Gemessen am
 * Produktivbestand tragen 11 216 von 14 222 Anträgen (78,9 %) mindestens ein
 * Kürzel, dessen angezeigter Klartext für ihre Projektform falsch ist.
 *
 * Der Schlüssel ist deshalb **Kürzel × Projektform**, nie das Kürzel allein.
 *
 * Zwei Regeln, die hier und nicht im Konsumenten leben:
 *
 * - **Schreibvarianten über die Mehrheit.** Sagen drei Projektformen
 *   „Ablehnung an Ast" und eine „Ablehung an Ast", gewinnt die Mehrheit. Die
 *   Sheet-Vorrangregel (aktiv > Matrix > Archiv) kann hier nichts entscheiden:
 *   alle vier Sheets sind aktiv. Bleibt es beim Patt, wird NICHT gewählt —
 *   der Eintrag kommt mit `strittig: true` heraus und auf die Kuratorenliste.
 * - **Rollen nur, wo die App sie kennt.** Die Spalte „gesetzt von" enthält
 *   neben echten Rollen auch Personenkürzel (`Här`, `MKo`), Platzhalter (`?`,
 *   `random`, `TEST`) und Trigger-Text. Unbekanntes wird verworfen, nicht
 *   geraten — eine falsche Rolle filtert Arbeit aus der falschen Sicht.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const QUELLE = 'docs/status-system/kuerzel-zuarbeit/';
const ZIEL = join('src', 'core', 'status', 'kuerzel-katalog.data.ts');

/** Die vier Projektformen der Zuarbeit, in stabiler Reihenfolge. */
const PROJEKTFORMEN = ['NW', 'FuE', 'DL', 'EP'];

/** Zuarbeit-Token → `Rolle` der App. Alles andere ist KEINE Rolle. */
const ROLLE_VON_TOKEN = {
  AB: 'ab', BB: 'ab', HHB: 'ab',
  FB: 'fb', TB: 'fb',
  QS: 'qs', AQS: 'qs',
  PA: 'pa',
  JURISTEN: 'jur', LJ: 'jur',
};

function csv(datei) {
  const roh = readFileSync(QUELLE + datei, 'utf8').replace(/^﻿/, '').trim();
  const [kopf, ...zeilen] = roh.split(/\r?\n/);
  const sp = kopf.split(';');
  return zeilen.map(z => {
    const w = []; let cur = ''; let inQ = false;
    for (const c of z) {
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ';' && !inQ) { w.push(cur); cur = ''; continue; }
      cur += c;
    }
    w.push(cur);
    return Object.fromEntries(sp.map((s, i) => [s, (w[i] ?? '').trim()]));
  });
}

const katalog = JSON.parse(readFileSync(QUELLE + 'kuerzel-katalog.json', 'utf8'));
const migration = csv('kuerzel-migration.csv');

/** Levenshtein, gedeckelt — reicht für „ein Buchstabe daneben". */
function dist(a, b) {
  if (Math.abs(a.length - b.length) > 8) return 99;
  const v = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = v[0]; v[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = v[j];
      v[j] = Math.min(v[j] + 1, v[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return v[b.length];
}
const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** Kategorie-Namen der Zuarbeit vereinheitlichen (Dubletten, Müll). */
const KATEGORIE_MUELL = new Set(['test', 'kvjkf', 'sonstiges', '?']);
function kategorieNorm(k) {
  const t = k.trim();
  if (KATEGORIE_MUELL.has(t.toLowerCase())) return null;
  return t
    .replace(/\s*-\s*/g, '-')            // „SV - Keller - Archiv" → „SV-Keller-Archiv"
    .replace(/^Vor-Ort-Besuche$/i, 'Vor-Ort-Besuch')
    .replace(/^de-minimis \(nur DS\)$/i, 'de-minimis');
}

function rollenVon(rohRollen) {
  const out = [];
  const unbekannt = [];
  for (const r of rohRollen ?? []) {
    // Die Zuarbeit trennt teils mit `;` und `,` innerhalb eines Eintrags.
    for (const teil of String(r).split(/[;,/]/)) {
      const t = teil.trim();
      if (!t) continue;
      const rolle = ROLLE_VON_TOKEN[t.toUpperCase()];
      if (rolle) { if (!out.includes(rolle)) out.push(rolle); }
      else unbekannt.push(t);
    }
  }
  return { rollen: out, unbekannt };
}

// --- Einträge je Kürzel × Projektform aufbauen -----------------------------
const proKuerzel = new Map();
const unbekannteRollen = new Map();

for (const e of katalog) {
  const k = e.kuerzel;
  if (!proKuerzel.has(k)) proKuerzel.set(k, new Map());
  const { rollen, unbekannt } = rollenVon(e.rollen);
  for (const u of unbekannt) unbekannteRollen.set(u, (unbekannteRollen.get(u) ?? 0) + 1);
  const kategorien = [...new Set((e.kategorien ?? []).map(kategorieNorm).filter(Boolean))];
  proKuerzel.get(k).set(e.projektform, {
    bezeichnung: (e.bezeichnung ?? '').trim(),
    rollen,
    scope: [...new Set(e.scope ?? [])],
    kategorien,
  });
}

// Umbenennungen: alt → neu (je Projektform gepflegt, wir führen sie am Kürzel).
const ersetztDurch = new Map();
for (const m of migration) {
  if (m.alt && m.neu && m.alt !== m.neu) ersetztDurch.set(m.alt, m.neu);
}

// --- Schreibvarianten über die Mehrheit glätten -----------------------------
let geglaettet = 0;
const strittig = [];
for (const [k, formen] of proKuerzel) {
  const werte = [...formen.values()].map(v => v.bezeichnung);
  if (new Set(werte).size <= 1) continue;
  // Ein Cluster = dieselbe Aussage, nur anders geschrieben.
  const cl = [];
  for (const w of werte) {
    const c = cl.find(c => dist(norm(c.rep), norm(w)) <= 3);
    if (c) c.n++; else cl.push({ rep: w, n: 1 });
  }
  if (cl.length > 1) continue;   // echt verschiedene Bedeutung → bleibt so
  const zaehl = new Map();
  for (const w of werte) zaehl.set(w, (zaehl.get(w) ?? 0) + 1);
  const sortiert = [...zaehl.entries()].sort((a, b) => b[1] - a[1]);
  if (sortiert.length > 1 && sortiert[0][1] === sortiert[1][1]) {
    strittig.push(k);
    continue;                     // Patt → nicht wählen, kennzeichnen
  }
  const sieger = sortiert[0][0];
  for (const v of formen.values()) v.bezeichnung = sieger;
  geglaettet++;
}

// --- Ausgabe ---------------------------------------------------------------
const eintraege = [];
for (const k of [...proKuerzel.keys()].sort()) {
  const formen = proKuerzel.get(k);
  const je = {};
  for (const pf of PROJEKTFORMEN) {
    const v = formen.get(pf);
    if (v) je[pf] = v;
  }
  if (Object.keys(je).length === 0) continue;
  eintraege.push({
    kuerzel: k,
    formen: je,
    ...(ersetztDurch.has(k) ? { ersetztDurch: ersetztDurch.get(k) } : {}),
    ...(strittig.includes(k) ? { strittig: true } : {}),
  });
}

const kopf = `/**
 * GENERIERT — nicht von Hand bearbeiten.
 *
 * Quelle: \`docs/status-system/kuerzel-zuarbeit/\` (aus \`Janne-Gelbe_Karte_Kürzel.xlsx\`)
 * Erzeuger: \`scripts/gen-kuerzel-katalog.mjs\` (\`npm run gen:kuerzel-katalog\`)
 *
 * Der Kürzel-Katalog des Fachsystems mit dem Schlüssel **Kürzel × Projektform**.
 * Dieselbe Abkürzung bedeutet je nach Projektform etwas anderes; ein flacher
 * Nachschlag zeigt für einen großen Teil des Bestands den falschen Klartext
 * (gemessen: 78,9 % der Anträge). Nachgeschlagen wird deshalb ausschließlich
 * über \`kuerzel-katalog.ts\`, nie direkt in dieser Tabelle.
 *
 * Fremddaten: Bezeichnungen stehen wortgetreu da, inklusive der Abkürzungen des
 * Fachsystems. Geglättet wurden nur Schreibvarianten desselben Textes über die
 * Mehrheit der Projektformen; blieb es beim Patt, trägt der Eintrag
 * \`strittig: true\` und gehört auf die Kuratorenliste.
 */
import type { Rolle } from './typen';

/** Die Projektformen, die die Zuarbeit unterscheidet. */
export type Projektform = ${PROJEKTFORMEN.map(p => `'${p}'`).join(' | ')};

/** Was der Katalog zu einem Kürzel IN EINER Projektform sagt. */
export interface KuerzelForm {
  /** Bezeichnung wortgetreu aus der Zuarbeit. */
  bezeichnung: string;
  /** Wer den Eintrag setzt. Leer = neutral = jeder (siehe \`rollen.ts\`). */
  rollen: readonly Rolle[];
  /** Gilt der Eintrag dem Teilvorhaben, dem Verbund oder beiden? */
  scope: readonly ('tv' | 'verbund')[];
  /** Gliederung fürs Glossar, aus der Zuarbeit übernommen. */
  kategorien: readonly string[];
}

export interface KuerzelEintrag {
  kuerzel: string;
  /** Nur die Projektformen, für die die Zuarbeit etwas sagt. */
  formen: Partial<Record<Projektform, KuerzelForm>>;
  /** Umbenanntes Kürzel: historische Form bleibt auflösbar. */
  ersetztDurch?: string;
  /** Schreibvarianten im Patt — keine gewählt, gehört auf die Kuratorenliste. */
  strittig?: boolean;
}

export const KUERZEL_KATALOG: readonly KuerzelEintrag[] = `;

// EINE Zeile je Kürzel. Voll eingerückt wären es ~18 400 Zeilen; so bleibt der
// Diff lesbar („was hat sich an ABLK geändert?") und die Datei handhabbar.
const zeilenText = eintraege.map(e => '  ' + JSON.stringify(e)).join(',\n');
writeFileSync(ZIEL, `${kopf}[\n${zeilenText},\n];\n`, 'utf8');

console.log(`✓ ${ZIEL}`);
console.log(`  ${eintraege.length} Kürzel, ${katalog.length} Kürzel×Projektform-Einträge`);
console.log(`  Schreibvarianten über die Mehrheit geglättet: ${geglaettet}`);
console.log(`  strittig (Kuratorenliste): ${strittig.length}${strittig.length ? ' — ' + strittig.join(', ') : ''}`);
console.log(`  Umbenennungen: ${ersetztDurch.size}`);
const top = [...unbekannteRollen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log(`  verworfene Rollen-Token (keine Rolle, nicht geraten): ${unbekannteRollen.size}`);
console.log(`    ${top.map(([t, n]) => `${t}(${n})`).join(', ')}`);
