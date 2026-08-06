/**
 * Erzeugt `src/core/status/kuerzel-trigger.data.ts` aus `trigger-regeln.csv`.
 *
 *     npm run gen:kuerzel-trigger
 *
 * Die 41 Regeln sind das Trigger-Modell des Fachsystems in Prosa. Sie kommen
 * als **Vorschläge** herein (`aktiv: false`) — sie zu aktivieren ist eine eigene,
 * spätere Entscheidung. Diese Datei ist Code und damit im Commit-Diff prüfbar;
 * auf den Share schreibt hier NICHTS.
 *
 * Zwei Trennungen, die die Prosa vermischt:
 *
 * - **Benachrichtigung ist kein Statuswechsel.** „trigger an AB, Stw TV auf
 *   abgebrochen" ist zweierlei: eine Nachricht an AB UND ein Statuswechsel.
 *   Zwei Felder, nie eines.
 * - **Bedingungen sind strukturiert, nicht Freitext.** Aggregation über
 *   Teilvorhaben („wenn alle TV PC+ haben") und Vorbedingung auf den aktuellen
 *   Status („wenn noch nicht bewilligt/abgelehnt") bekommen eigene Formen.
 *
 * Zielstatus werden gegen den Statuskatalog aufgelöst. Die Zuarbeit enthält
 * Tippfehler („bewilligungseif", „Irrläuder"); unauflösbare Ziele werden
 * **nicht geraten**, sondern als `aufloesbar: false` markiert.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const QUELLE = 'docs/status-system/kuerzel-zuarbeit/trigger-regeln.csv';
const ZIEL = join('src', 'core', 'status', 'kuerzel-trigger.data.ts');

function csv(pfad) {
  const roh = readFileSync(pfad, 'utf8').replace(/^﻿/, '').trim();
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

// --- Zielstatus gegen den Statuskatalog auflösen ---------------------------
// Die amtlichen Texte stehen im generierten Statuscode-Katalog; wir lesen sie
// hier direkt aus der Quelle, damit der Generator ohne TS-Laufzeit auskommt.
const codesSrc = readFileSync(join('src', 'core', 'status', 'status-codes.ts'), 'utf8');
const statusTexte = new Map();               // normalisiert -> Code
const reEintrag = /code:\s*(\d+)[^}]*?text:\s*'((?:[^'\\]|\\.)*)'/g;
for (const m of codesSrc.matchAll(reEintrag)) {
  statusTexte.set(m[2].toLowerCase().replace(/[^a-z0-9äöüß]/g, ''), Number(m[1]));
}
// Varianten mitnehmen, falls die Datei welche führt.
const reVariante = /varianten:\s*\[([^\]]*)\]/g;
for (const m of codesSrc.matchAll(reVariante)) {
  for (const v of m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) {
    if (!statusTexte.has(v[1].toLowerCase().replace(/[^a-z0-9äöüß]/g, ''))) {
      // ohne Code-Bezug nicht auflösbar — nur als bekannt vermerken
    }
  }
}
const normStatus = s => s.toLowerCase().replace(/[^a-z0-9äöüß]/g, '');

function loeseZiel(roh) {
  const t = (roh ?? '').trim();
  if (!t) return null;
  const code = statusTexte.get(normStatus(t));
  return { roh: t, code: code ?? null, aufloesbar: code !== undefined };
}

// --- Bedingungen strukturieren --------------------------------------------
function loeseBedingung(roh, kuerzel) {
  const t = (roh ?? '').trim();
  if (!t) return null;
  // Aggregation über Teilvorhaben — die Verbundableitung in Reinform.
  let m = /(alle|kein)\s+TV\s+(\S+)\s+ha(?:ben|t)/i.exec(t);
  if (m) {
    return { art: 'aggregation-tv', quantor: m[1].toLowerCase() === 'alle' ? 'alle' : 'kein', kuerzel: m[2], roh: t };
  }
  // Vorbedingung auf den aktuellen Status.
  if (/noch nicht/i.test(t)) {
    return { art: 'status-vorbedingung', negiert: true, roh: t };
  }
  // Vorbedingung auf ein anderes Kürzel.
  m = /(kein\s+)?(\w[\w+?-]*)\s+gesetzt\s+wurde/i.exec(t);
  if (m) {
    return { art: 'kuerzel-gesetzt', negiert: Boolean(m[1]), kuerzel: m[2], roh: t };
  }
  return { art: 'unstrukturiert', roh: t };
}

function empfaenger(roh) {
  return (roh ?? '')
    .split(/[;,/]/)
    .map(s => s.trim())
    .filter(Boolean);
}

const zeilen = csv(QUELLE);
const regeln = [];
const unaufloesbar = new Map();

for (const z of zeilen) {
  const ziel = loeseZiel(z.zielstatus);
  if (ziel && !ziel.aufloesbar) unaufloesbar.set(ziel.roh, (unaufloesbar.get(ziel.roh) ?? 0) + 1);
  const bed = loeseBedingung(z.bedingung, z.kuerzel);
  regeln.push({
    kuerzel: z.kuerzel,
    projektform: z.projektform,
    scope: z.scope && z.scope !== 'unbestimmt' ? z.scope : null,
    ...(ziel ? { zielStatus: ziel } : {}),
    ...(bed ? { bedingung: bed } : {}),
    benachrichtigt: empfaenger(z.benachrichtigt),
    original: z.original ?? '',
    aktiv: false,
  });
}

const kopf = `/**
 * GENERIERT — nicht von Hand bearbeiten.
 *
 * Quelle: \`docs/status-system/kuerzel-zuarbeit/trigger-regeln.csv\`
 * Erzeuger: \`scripts/gen-kuerzel-trigger.mjs\` (\`npm run gen:kuerzel-trigger\`)
 *
 * Die Statuswechsel-Regeln des Fachsystems, wie sie in der Bemerkungsspalte der
 * Kürzel-Zuarbeit stehen. **Alle mit \`aktiv: false\`**: importiert heißt hier
 * erfasst und prüfbar, nicht wirksam. Sie zu aktivieren ist eine eigene
 * Entscheidung — die App leitet keinen Status ab (Pitfall #44), und eine
 * versehentlich scharf geschaltete Regel täte genau das.
 *
 * \`benachrichtigt\` und \`zielStatus\` sind getrennt, weil die Prosa sie
 * vermischt: „trigger an AB, Stw TV auf abgebrochen" ist eine Nachricht UND ein
 * Statuswechsel. \`original\` steht überall dabei — bei Zweifeln gilt er.
 */

/** Was die Regel voraussetzt. \`unstrukturiert\` = Prosa, die niemand geparst hat. */
export type TriggerBedingung =
  | { art: 'aggregation-tv'; quantor: 'alle' | 'kein'; kuerzel: string; roh: string }
  | { art: 'status-vorbedingung'; negiert: boolean; roh: string }
  | { art: 'kuerzel-gesetzt'; negiert: boolean; kuerzel: string; roh: string }
  | { art: 'unstrukturiert'; roh: string };

export interface KuerzelTriggerRegel {
  kuerzel: string;
  projektform: string;
  /** \`null\` = die Zuarbeit sagt nicht, worauf sich der Wechsel bezieht. */
  scope: 'tv' | 'verbund' | 'tv+verbund' | null;
  zielStatus?: {
    /** Wortlaut der Zuarbeit — inklusive Tippfehler. */
    roh: string;
    /** Amtlicher Code; \`null\`, wenn der Text nicht auflösbar war. */
    code: number | null;
    aufloesbar: boolean;
  };
  bedingung?: TriggerBedingung;
  /** Empfänger der Benachrichtigung. NIE mit dem Statuswechsel vermischen. */
  benachrichtigt: readonly string[];
  /** Der Originalsatz. Bei Zweifeln gilt er, nicht der Parser. */
  original: string;
  /** Immer \`false\` beim Import. */
  aktiv: false;
}

export const KUERZEL_TRIGGER_REGELN: readonly KuerzelTriggerRegel[] = `;

// Eine Zeile je Regel — derselbe Grund wie beim Kürzel-Katalog: der Diff soll
// zeigen, WELCHE Regel sich geändert hat, nicht 40 verschobene Klammern.
const zeilenText = regeln.map(r => '  ' + JSON.stringify(r)).join(',\n');
writeFileSync(ZIEL, `${kopf}[\n${zeilenText},\n];\n`, 'utf8');

const nachArt = {};
for (const r of regeln) if (r.bedingung) nachArt[r.bedingung.art] = (nachArt[r.bedingung.art] ?? 0) + 1;
console.log(`✓ ${ZIEL}`);
console.log(`  ${regeln.length} Regeln, alle aktiv: false`);
console.log(`  Scope: ${JSON.stringify(regeln.reduce((a, r) => { a[r.scope ?? 'unbestimmt'] = (a[r.scope ?? 'unbestimmt'] ?? 0) + 1; return a; }, {}))}`);
console.log(`  Bedingungen: ${JSON.stringify(nachArt)}`);
console.log(`  mit Benachrichtigung: ${regeln.filter(r => r.benachrichtigt.length).length}`);
console.log(`  Zielstatus aufloesbar: ${regeln.filter(r => r.zielStatus?.aufloesbar).length} / ${regeln.filter(r => r.zielStatus).length}`);
if (unaufloesbar.size) {
  console.log(`  NICHT aufloesbar (Kuratorenliste): ${[...unaufloesbar.entries()].map(([t, n]) => `"${t}" (${n}×)`).join(', ')}`);
}
