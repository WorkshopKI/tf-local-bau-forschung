/**
 * Erzeugt `src/core/status/seed-codes.data.ts` aus der Kürzel-Zuarbeit des
 * Fachsystems (`docs/status-system/kuerzel-zuarbeit-<datum>.csv`).
 *
 * Die Zuarbeit ist die maßgebliche Quelle für **Bezeichnung** und **wer den
 * Eintrag setzt** — beides Fremddaten, die wir nicht erfinden. Alles, was WIR
 * entscheiden (Ordner, Prominenz, Spine-Phase, Rang, terminal), lebt getrennt
 * davon in `seed-codes.ts` und überlebt jede Neugenerierung.
 *
 * Aufruf: `npm run gen:status-codes` (oder `node scripts/gen-status-codes.mjs`).
 * Bei einer neuen Zuarbeit: CSV daneben legen, QUELLE unten anpassen, laufen
 * lassen, Diff prüfen. Der erzeugte Diff zeigt genau, was das Fachsystem
 * geändert hat.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const QUELLE = 'docs/status-system/kuerzel-zuarbeit-20260724.csv';
const ZIEL = 'src/core/status/seed-codes.data.ts';

/** Semikolon-CSV mit RFC-Quoting (die Zuarbeit führt Felder mit `;` im Text). */
function parseCsv(text) {
  const rows = [];
  let feld = '', zeile = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { feld += '"'; i++; } else inQ = false;
      } else feld += c;
    } else if (c === '"') inQ = true;
    else if (c === ';') { zeile.push(feld); feld = ''; }
    else if (c === '\n') { zeile.push(feld); rows.push(zeile); zeile = []; feld = ''; }
    else if (c !== '\r') feld += c;
  }
  if (feld || zeile.length) { zeile.push(feld); rows.push(zeile); }
  return rows.filter(r => r.some(z => z.trim()));
}

/** `AB/FB/QS` → `['ab','fb','qs']`, `neutral` → `[]`. Spiegelt `parseRollenSpalte`. */
const TOKEN = { AB: 'ab', FB: 'fb', QS: 'qs', PA: 'pa', JURISTEN: 'jur' };
const REIHENFOLGE = ['ab', 'fb', 'qs', 'pa', 'jur'];
function rollen(roh) {
  const treffer = new Set();
  for (const teil of roh.split('/')) {
    const r = TOKEN[teil.trim().toUpperCase()];
    if (r) treffer.add(r);
  }
  return REIHENFOLGE.filter(r => treffer.has(r));
}

const roh = readFileSync(resolve(ROOT, QUELLE), 'utf8').replace(/^﻿/, '');
const zeilen = parseCsv(roh).slice(1); // Kopfzeile

const gesehen = new Set();
const eintraege = [];
const doppelt = [];
const unbekannteRollen = new Set();

for (const [codeRoh, labelRoh, rolleRoh] of zeilen) {
  // NFC: die Zuarbeit führt Umlaut-Codes (ÄA, ÄT, ÄAWQ). Ohne Normalisierung
  // treffen sie die CSV-Spalten der Programme nicht (Pitfall #22).
  const code = (codeRoh ?? '').trim().normalize('NFC');
  if (!code) continue;
  if (gesehen.has(code)) { doppelt.push(code); continue; }
  gesehen.add(code);

  const rolleTxt = (rolleRoh ?? '').trim();
  for (const teil of rolleTxt.split('/')) {
    const t = teil.trim();
    if (t && t.toLowerCase() !== 'neutral' && !TOKEN[t.toUpperCase()]) unbekannteRollen.add(t);
  }

  eintraege.push({
    code,
    label: (labelRoh ?? '').trim().normalize('NFC'),
    rollen: rollen(rolleTxt),
  });
}

const zeile = e =>
  `  { code: ${JSON.stringify(e.code)}, label: ${JSON.stringify(e.label)}, ` +
  `rollen: [${e.rollen.map(r => `'${r}'`).join(', ')}] },`;

const datei = `/**
 * GENERIERT — nicht von Hand bearbeiten.
 *
 * Quelle: \`${QUELLE}\`
 * Erzeuger: \`scripts/gen-status-codes.mjs\` (\`npm run gen:status-codes\`)
 *
 * Die Kürzel-Zuarbeit des Fachsystems: ${eintraege.length} Statuscodes mit ihrer
 * amtlichen Bezeichnung und der Angabe, **wer den Eintrag setzt**. Beides sind
 * Fremddaten und stehen deshalb hier, getrennt von unserer Kuration (Ordner,
 * Prominenz, Spine-Phase, Rang) in \`seed-codes.ts\`.
 *
 * \`rollen: []\` heißt **neutral: jeder darf setzen** — nicht „niemand". Ein
 * neutraler Eintrag ist unter jeder Rollenwahl sichtbar (siehe \`rollen.ts\`).
 */
import type { Rolle } from './typen';

export interface ZuarbeitCode {
  /** Code des Fachsystems ohne Spalten-Präfix (\`XTEC\` zu \`D_XTEC\`), NFC-normalisiert. */
  code: string;
  /** Bezeichnung wortgetreu aus der Zuarbeit — inklusive Abkürzungen und Tippfehler.
   *  Umformulieren würde die Wiedererkennung gegen das Fachsystem zerstören. */
  label: string;
  /** Wer den Eintrag setzt. Leer = neutral = jeder. */
  rollen: readonly Rolle[];
}

/** Reihenfolge = Reihenfolge der Zuarbeit (stabil für den Seed-Determinismus-Test). */
export const ZUARBEIT_CODES: readonly ZuarbeitCode[] = [
${eintraege.map(zeile).join('\n')}
];

/** Dateiname der eingelesenen Zuarbeit — steht im Cockpit als Herkunftsnachweis. */
export const ZUARBEIT_QUELLE = ${JSON.stringify(basename(QUELLE))};
`;

writeFileSync(resolve(ROOT, ZIEL), datei, 'utf8');

console.log(`✓ ${ZIEL}: ${eintraege.length} Codes aus ${basename(QUELLE)}`);
const mitRollen = eintraege.filter(e => e.rollen.length > 0).length;
console.log(`  ${mitRollen} mit Rollen, ${eintraege.length - mitRollen} neutral`);
if (doppelt.length) console.log(`  ! doppelte Codes übersprungen: ${doppelt.join(', ')}`);
if (unbekannteRollen.size) console.log(`  ! unbekannte Rollen-Tokens: ${[...unbekannteRollen].join(', ')}`);
