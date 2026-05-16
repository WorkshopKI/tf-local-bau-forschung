#!/usr/bin/env node
/**
 * Konvertiert _labels/Labels PrjBsp_GPT.xlsx in ein TypeScript-File mit:
 *   - LABEL_BY_CSV_COLUMN:        CSV-Spalten-Code -> Klarname
 *   - ZUKUNFTSTECHNOLOGIE_FELDER: Liste der ZT-Boolean-Spalten + Default-
 *                                  Zuordnung zu den 5 Ueberkategorien
 *   - KATEGORIE_KEYWORD_HEURISTIK: Substring-Fallback fuer TECHN_/BRANCHE_-
 *                                  Werte wenn keine ZT-Spalten gesetzt sind
 *
 * Ziel: `src/plugins/auslastung/services/default-labels.ts` (AUTO-GENERIERT,
 *       nicht manuell editieren).
 *
 * Aufruf: node scripts/build-default-labels.mjs [labels-xlsx-path]
 * Laeuft idempotent — keine Aenderung wenn Output identisch.
 *
 * Default-Mapping ZT-Themenfeld -> Ueberkategorie ist hier im Script
 * pflegbar (siehe ZT_TO_KATEGORIE-Map). Bei Aenderungen am Labels-XLSX
 * oder neuen ZT-Themenfeldern: Script anpassen + neu ausfuehren.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const INPUT = process.argv[2] ?? join(ROOT, '_labels', 'Labels PrjBsp_GPT.xlsx');
const OUTPUT = join(ROOT, 'src', 'plugins', 'auslastung', 'services', 'default-labels.ts');

// Pflege-Punkt: Klarname (aus Labels-XLSX Zeile 1) -> Ueberkategorie-ID.
// Wenn neue ZT-Themen aufgenommen werden, hier ergaenzen — sonst landen sie ohne Default-Mapping.
const ZT_TO_KATEGORIE = {
  'Digitale Wirtschaft und Gesellschaft (IKT)': 'DT',
  'Industrie 4.0': 'IT',
  'Cloud Computing': 'DT',
  'Big Data Analyse': 'DT',
  'Künstliche Intelligenz (KI)': 'DT',
  'sonstige (Digitale Wirtschaft…)': 'DT',
  'Intelligente Mobilität': 'IT',
  'Elektromobilität': 'EU',
  'sonstige (Intelligente Mobilität)': 'IT',
  'Nachhaltiges Wirtschaften / Green Economy': 'EU',
  'Energie/Ress. Effizienz': 'EU',
  'sonstige (nachhaltiges Wirtschaften...)': 'EU',
  'Zivile Sicherheit (inkl. IT)': 'DT',
  'IT-Sicherheit': 'DT',
  'sonstige (Zivile Sicherheit)': 'DT',
  'Gesundes Leben': 'LG',
  'Innovative Arbeitswelt': 'IT',
  'Leichtbautechnologien': 'IT',
  'Mikroelektronik': 'IT',
  'Batterietechnik': 'EU',
  'KUK-Innovationen (Technolog. Für bzw. von Kultur-, Medien-, u. Kreativwirtschaft)': 'IT',
  'Additive Fertigung / 3D-Druck': 'IT',
  'keine Kategorie zutreffend': null,  // bewusst kein Mapping
};

// Pflege-Punkt: Substring-Heuristik fuer TECHN_/BRANCHE_/ANWEND_-Werte.
// Wird vom Plugin als Fallback genutzt, wenn keine ZT-Boolean-Spalten gesetzt sind.
const KATEGORIE_KEYWORD_HEURISTIK = {
  IT: [
    'industrie 4.0', 'leichtbau', 'mikroelektronik', 'additive fertigung', '3d-druck',
    'mobilitaet', 'mobilität', 'innovative arbeit', 'maschinenbau', 'fertigung',
    'produktion', 'werkstoff', 'cfk', 'fem',
  ],
  DT: [
    'ki', 'künstliche intelligenz', 'kuenstliche intelligenz', 'ai', 'big data', 'cloud',
    'ikt', 'digitale wirtschaft', 'software', 'algorithmus', 'machine learning',
    'data science', 'iot', 'cybersicherheit', 'it-sicherheit',
  ],
  EU: [
    'energie', 'umwelt', 'nachhaltig', 'green', 'elektromobil', 'batterie',
    'ressourcen', 'klima', 'recycling', 'photovoltaik', 'solar', 'wind',
    'erneuerbar', 'wasserstoff', 'co2',
  ],
  LG: [
    'gesund', 'medizin', 'pharma', 'biotech', 'pflege', 'klinik', 'diagnostik',
    'therapie', 'biologie', 'genom', 'protein', 'mikrobiom',
  ],
  NM: [
    'chemie', 'physik', 'materialforschung', 'spektroskop', 'messverfahren',
    'labor', 'naturwissenschaft', 'analytik', 'simulation', 'modellierung',
    'nanotechnologie', 'quanten',
  ],
};

/** Slugify: "Künstliche Intelligenz (KI)" + "tv" -> "zt_kuenstliche_intelligenz_ki_tv". */
function makeCustomFieldName(themenfeld, ebene) {
  const slug = themenfeld
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);   // schmal halten
  return `zt_${slug}_${ebene}`;
}

function main() {
  if (!existsSync(INPUT)) {
    console.error(`[build-default-labels] Input fehlt: ${INPUT}`);
    console.error('  Erwartet wird die Labels-XLSX. Skript ueberspringt — TS-File bleibt unveraendert (falls vorhanden).');
    process.exit(0);   // bewusst kein Fehler — Build soll trotzdem laufen
  }

  const wb = XLSX.readFile(INPUT);
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });

  if (rows.length < 4) {
    console.error('[build-default-labels] XLSX hat weniger als 4 Header-Zeilen — Schema unklar, abort');
    process.exit(1);
  }
  // Zeile 0: Top-Gruppen, Zeile 1: Sub-Gruppen, Zeile 2: Klartext, Zeile 3: CSV-Code
  const row0 = rows[0];   // Top-Gruppen — enthaelt "Zukunftstechnologien fuer FuE- & NW-Projekte"
  const row2 = rows[2];   // Klartext (z.B. "Kuenstliche Intelligenz (KI) / TV-Ebene")
  const row3 = rows[3];   // CSV-Code

  // ZT-Spalten-Range bestimmen: wo beginnt "Zukunftstechnologien"?
  // In _labels/Labels PrjBsp_GPT.xlsx ist das col 46 (siehe Inspektion).
  // Wir matchen anhand der Top-Gruppe.
  let ztStart = -1, ztEnd = -1;
  for (let i = 0; i < row0.length; i++) {
    const top = String(row0[i] ?? '').toLowerCase();
    if (top.includes('zukunftstechnologien')) { ztStart = i; }
    else if (ztStart >= 0 && top && ztEnd < 0) { ztEnd = i; break; }
  }
  if (ztStart < 0) {
    console.warn('[build-default-labels] Keine "Zukunftstechnologien"-Top-Gruppe gefunden');
    ztStart = Number.MAX_SAFE_INTEGER;
  }
  if (ztEnd < 0) ztEnd = row3.length;

  const labelByCol = {};
  const zts = [];

  for (let i = 0; i < row3.length; i++) {
    const csv = String(row3[i] ?? '').trim();
    const klar = String(row2[i] ?? '').trim().replace(/\s+/g, ' ');
    if (csv && klar && !labelByCol[csv]) {
      labelByCol[csv] = klar;
    }

    // ZT-Themenfeld-Erkennung nur in ZT-Range: row2 hat Format
    // "{Themenfeld}\r\nTV-Ebene" — nach Normalisierung "{Themenfeld} TV-Ebene"
    if (i >= ztStart && i < ztEnd && csv && klar) {
      const m = klar.match(/^(.+?)\s+(TV-Ebene|VB-Ebene)\s*$/i);
      if (!m) continue;
      const themenfeld = m[1].trim();
      const ebene = m[2].toLowerCase().startsWith('vb') ? 'vb' : 'tv';
      const cat = ZT_TO_KATEGORIE[themenfeld];
      if (cat) {
        const customField = makeCustomFieldName(themenfeld, ebene);
        // CSV-Header-Quirk: TV- und VB-Spalten haben denselben Header in der
        // echten CSV (`"Digitale W"` zweimal). PapaParse renamed die zweite
        // zu `"<name>_1"`. In der Labels-XLSX dagegen hat die VB-Spalte ein
        // Excel-Suffix (`"Digitale W2"`). Wir mappen die TV-Spalte 1:1, die
        // VB-Spalte auf den PapaParse-renamed Namen.
        let realCsv = csv;
        if (ebene === 'vb') {
          // Strip Excel-Suffix-Nummern (z.B. "Digitale W2" -> "Digitale W"),
          // dann PapaParse-Suffix anhaengen.
          const tvCol = csv.replace(/\d+$/, '');
          realCsv = tvCol + '_1';
        }
        zts.push({
          csvColumn: realCsv,
          customField,
          klartext: themenfeld,
          ebene,
          defaultUeberKategorie: cat,
        });
      }
    }
  }

  const ts = renderTypeScript({ labelByCol, zts, heuristik: KATEGORIE_KEYWORD_HEURISTIK });

  // Idempotenz: nur schreiben wenn unterschiedlich
  let prev = '';
  try { prev = readFileSync(OUTPUT, 'utf-8'); } catch { /* neu */ }
  if (prev === ts) {
    console.log(`[build-default-labels] keine Aenderungen (${Object.keys(labelByCol).length} Labels, ${zts.length} ZT-Felder)`);
    return;
  }
  writeFileSync(OUTPUT, ts, 'utf-8');
  console.log(`[build-default-labels] OK — ${Object.keys(labelByCol).length} Labels, ${zts.length} ZT-Felder geschrieben in ${OUTPUT}`);
}

function renderTypeScript({ labelByCol, zts, heuristik }) {
  const labelsEntries = Object.entries(labelByCol)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
    .join('\n');

  const ztsEntries = zts
    .map(z => `  { csvColumn: ${JSON.stringify(z.csvColumn)}, customField: ${JSON.stringify(z.customField)}, klartext: ${JSON.stringify(z.klartext)}, ebene: ${JSON.stringify(z.ebene)}, defaultUeberKategorie: ${JSON.stringify(z.defaultUeberKategorie)} },`)
    .join('\n');

  const heuristikEntries = Object.entries(heuristik)
    .map(([k, v]) => `  ${k}: [\n${v.map(w => `    ${JSON.stringify(w)},`).join('\n')}\n  ],`)
    .join('\n');

  return `/**
 * AUTO-GENERIERT von scripts/build-default-labels.mjs aus _labels/*.xlsx
 * NICHT MANUELL EDITIEREN — bei Aenderungen XLSX anpassen + npm run build:default-labels
 *
 * Quelle: _labels/Labels PrjBsp_GPT.xlsx (4-Zeilen-Header)
 *  - Zeile 2 = Klartext, Zeile 3 = CSV-Spalten-Code  -> LABEL_BY_CSV_COLUMN
 *  - Zeile 1 = ZT-Themenfeld-Name (Sub-Gruppe)       -> ZUKUNFTSTECHNOLOGIE_FELDER
 */

export type UeberkategorieId = 'IT' | 'DT' | 'EU' | 'LG' | 'NM';

/** Klarnamen pro CSV-Spalten-Code (aus Labels-XLSX). */
export const LABEL_BY_CSV_COLUMN: Record<string, string> = {
${labelsEntries}
};

export interface ZukunftstechnologieFeld {
  /** CSV-Spaltenname (gekuerzt, wie in der echten CSV). */
  csvColumn: string;
  /** Custom-Field-Name im Antrag-Record nach dem CSV-Merge (siehe schema-c.ts). */
  customField: string;
  /** Vollname aus der Labels-XLSX (z.B. "Kuenstliche Intelligenz (KI)"). */
  klartext: string;
  /** TV oder VB-Ebene. */
  ebene: 'tv' | 'vb';
  /** Default-Zuordnung zu einer der 5 Ueberkategorien. */
  defaultUeberKategorie: UeberkategorieId;
}

/** Zukunftstechnologie-Boolean-Spalten (col ~46-89 in schema-c-CSV). */
export const ZUKUNFTSTECHNOLOGIE_FELDER: ZukunftstechnologieFeld[] = [
${ztsEntries}
];

/**
 * Substring-Heuristik fuer Stage-1-Fallback: matched TECHN_/BRANCHE_/
 * ANWEND_-Werte gegen Schluesselwoerter pro Ueberkategorie. Wird genutzt
 * wenn die ZT-Boolean-Spalten in einem Antrag leer sind (z.B. alte CSVs).
 */
export const KATEGORIE_KEYWORD_HEURISTIK: Record<UeberkategorieId, string[]> = {
${heuristikEntries}
};
`;
}

main();
