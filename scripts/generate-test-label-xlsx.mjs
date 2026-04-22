// Generiert Test-Label-XLSX-Dateien für den hierarchischen Label-Parser
// (Wizard-Schritt 2, Label-XLS-Upload). Varianten:
//
//   labels-stammdaten-2zeilen.xlsx   — N=2, keine Gruppen, flach
//   labels-stammdaten-3zeilen.xlsx   — N=3, 1 Gruppen-Ebene
//   labels-stammdaten-4zeilen.xlsx   — N=4, 2 Gruppen-Ebenen + Edge-Cases (leere Labels, Spalte ohne Gruppe)
//   labels-stammdaten-branche.xlsx   — N=4, vertikal-merged Gruppen-/Label-Zelle ("Branche")
//
// Spaltennamen = echte Header der stammdaten-mini.csv bzw. stammdaten-branche-mini.csv,
// damit sich die XLSX direkt zusammen mit der passenden CSV im Wizard durchspielen lassen.
//
// Läuft als `prebuild`-Hook nach `generate:test-csvs`.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public/test-korpus/bauforschung-v2');

await mkdir(OUT_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// Helpers

/**
 * Baut ein Worksheet aus einer Array-of-Arrays + optionalen Merge-Ranges.
 * @param {Array<Array<string|null|undefined>>} aoa
 * @param {Array<{s: {r:number,c:number}, e:{r:number,c:number}}>} merges
 */
function sheetFromAoa(aoa, merges = []) {
  // defval '' damit leere Zellen als String '' in sheet_add landen
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (merges.length > 0) {
    ws['!merges'] = merges;
  }
  return ws;
}

function writeXlsx(outPath, ws, sheetName = 'Labels') {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return writeFile(outPath, buf);
}

// ---------------------------------------------------------------------------
// Variante 1 — 2 Zeilen (nur Label + CSV-Name, keine Gruppen)

{
  const aoa = [
    ['Aktenzeichen', 'Akronym', 'Titel', 'Antragsteller', 'Status', 'Verbund', 'Bewilligungsdatum', 'Export-TS'],
    ['AKZ_LFD', 'PROJ_KURZ', 'TITEL', 'ANTRAGSTELLER', 'STATUS_FLG', 'VB_NR', 'BEW_DAT', 'EXPORT_TS'],
  ];
  const ws = sheetFromAoa(aoa);
  await writeXlsx(path.join(OUT_DIR, 'labels-stammdaten-2zeilen.xlsx'), ws);
  console.log('  labels-stammdaten-2zeilen.xlsx  (N=2, flach)');
}

// ---------------------------------------------------------------------------
// Variante 2 — 3 Zeilen (1 Gruppen-Ebene)

{
  // Zeile 1 (Gruppe):  Stammdaten ──────────────────── | Finanzen ───────
  // Zeile 2 (Label):   Akte | Akronym | Titel | Antragsteller | Status | Verbund | Bewilligung | Export
  // Zeile 3 (CSV):     AKZ_LFD | PROJ_KURZ | TITEL | ANTRAGSTELLER | STATUS_FLG | VB_NR | BEW_DAT | EXPORT_TS
  const aoa = [
    ['Stammdaten', '', '', '', '', '', 'Finanzen', ''],
    ['Akte', 'Akronym', 'Titel', 'Antragsteller', 'Status', 'Verbund', 'Bewilligung', 'Export'],
    ['AKZ_LFD', 'PROJ_KURZ', 'TITEL', 'ANTRAGSTELLER', 'STATUS_FLG', 'VB_NR', 'BEW_DAT', 'EXPORT_TS'],
  ];
  const merges = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // Stammdaten über Spalten 0..5
    { s: { r: 0, c: 6 }, e: { r: 0, c: 7 } }, // Finanzen über Spalten 6..7
  ];
  const ws = sheetFromAoa(aoa, merges);
  await writeXlsx(path.join(OUT_DIR, 'labels-stammdaten-3zeilen.xlsx'), ws);
  console.log('  labels-stammdaten-3zeilen.xlsx  (N=3, 1 Gruppen-Ebene)');
}

// ---------------------------------------------------------------------------
// Variante 3 — 4 Zeilen (2 Gruppen-Ebenen, Edge-Cases)

{
  // Zeile 1 (Hoch-Gruppe):   Administration ─────────────────── | Projekt ─────────────── | Finanzen ──
  // Zeile 2 (Sub-Gruppe):    Stammdaten ─── | Status ── | Inhalt ── | (leer für VB_NR) | Bewilligung ──
  // Zeile 3 (Label):         Akte | Akronym | Status | (leer)   | Titel | (leer) | Bewilligung | (leer)
  // Zeile 4 (CSV):           AKZ_LFD | PROJ_KURZ | STATUS_FLG | ANTRAGSTELLER | TITEL | VB_NR | BEW_DAT | EXPORT_TS
  //
  // Erwartete Parse-Ergebnisse:
  //   AKZ_LFD       -> group_path=[Administration, Stammdaten],  label=Akte
  //   PROJ_KURZ     -> group_path=[Administration, Stammdaten],  label=Akronym
  //   STATUS_FLG    -> group_path=[Administration, Status],       label=Status
  //   ANTRAGSTELLER -> group_path=[Administration, Status],       label=ANTRAGSTELLER (Fallback)
  //   TITEL         -> group_path=[Projekt, Inhalt],              label=Titel
  //   VB_NR         -> group_path=[Projekt],                      label=VB_NR (Fallback, keine Sub-Gruppe)
  //   BEW_DAT       -> group_path=[Finanzen, Bewilligung],        label=Bewilligung
  //   EXPORT_TS     -> group_path=[],                             label=EXPORT_TS (ohne Gruppierung + Fallback)

  const aoa = [
    ['Administration', '', '', '', 'Projekt', '', 'Finanzen', ''],
    ['Stammdaten', '', 'Status', '', 'Inhalt', '', 'Bewilligung', ''],
    ['Akte', 'Akronym', 'Status', '', 'Titel', '', 'Bewilligung', ''],
    ['AKZ_LFD', 'PROJ_KURZ', 'STATUS_FLG', 'ANTRAGSTELLER', 'TITEL', 'VB_NR', 'BEW_DAT', 'EXPORT_TS'],
  ];
  const merges = [
    // Zeile 1 — Hoch-Gruppen
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }, // Administration (Spalten 0..3)
    { s: { r: 0, c: 4 }, e: { r: 0, c: 5 } }, // Projekt (Spalten 4..5)
    { s: { r: 0, c: 6 }, e: { r: 0, c: 7 } }, // Finanzen (Spalten 6..7)
    // Zeile 2 — Sub-Gruppen
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }, // Stammdaten (Spalten 0..1)
    { s: { r: 1, c: 2 }, e: { r: 1, c: 3 } }, // Status (Spalten 2..3)
    { s: { r: 1, c: 4 }, e: { r: 1, c: 4 } }, // Inhalt (Spalte 4, Spalte 5 bleibt leer → VB_NR ohne Sub-Gruppe)
    { s: { r: 1, c: 6 }, e: { r: 1, c: 7 } }, // Bewilligung (Spalten 6..7)
  ];
  const ws = sheetFromAoa(aoa, merges);
  await writeXlsx(path.join(OUT_DIR, 'labels-stammdaten-4zeilen.xlsx'), ws);
  console.log('  labels-stammdaten-4zeilen.xlsx  (N=4, 2 Gruppen-Ebenen, Edge-Cases)');
}

// ---------------------------------------------------------------------------
// Variante 4 — 4 Zeilen mit vertikal-merged "Branche" über Gruppen- + Label-Zeile

{
  // Basis = Stammdaten mit 5 zusätzlichen BRANCHE-Spalten.
  //
  // Zeile 1 (Hoch-Gruppe):   Administration ────────── | Projekt ──────────── | Projekt ─────────────── | Finanzen ──
  // Zeile 2 (Sub-Gruppe):    Stammdaten ─────────── | Inhalt ───── | [merge: Branche (r1-2, c8-12)]    | Bewilligung ──
  // Zeile 3 (Label):         Akte | Akronym | Titel | Antragsteller | Status | Verbund | (merge mit)   | Bewilligung | (leer)
  // Zeile 4 (CSV):           AKZ_LFD | PROJ_KURZ | TITEL | ANTRAGSTELLER | STATUS_FLG | VB_NR | BRANCHE_1 | BRANCHE_2 | BRANCHE_3 | BRANCHE_4 | BRANCHE_5 | BEW_DAT | EXPORT_TS
  //
  // Erwartung: Parser erkennt den vertikal-merged "Branche"-Bereich als ambigen Merge.
  // Default-Resolution = 'group' → 5 Branche-Spalten bekommen group_path=[Projekt, Branche], label=CSV-Name.

  const aoa = [
    ['Administration', '', '', '', 'Projekt', '',    'Projekt', '', '', '', '', 'Finanzen', ''],
    ['Stammdaten', '', '',     '', 'Inhalt', '',     'Branche', '', '', '', '', 'Bewilligung', ''],
    ['Akte', 'Akronym', 'Titel', 'Antragsteller', 'Status', 'Verbund', '', '', '', '', '', 'Bewilligung', ''],
    ['AKZ_LFD', 'PROJ_KURZ', 'TITEL', 'ANTRAGSTELLER', 'STATUS_FLG', 'VB_NR',
     'BRANCHE_1', 'BRANCHE_2', 'BRANCHE_3', 'BRANCHE_4', 'BRANCHE_5',
     'BEW_DAT', 'EXPORT_TS'],
  ];
  const merges = [
    // Zeile 1 — Hoch-Gruppen
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },   // Administration (0..3)
    { s: { r: 0, c: 4 }, e: { r: 0, c: 5 } },   // Projekt (4..5)
    { s: { r: 0, c: 6 }, e: { r: 0, c: 10 } },  // Projekt (6..10) — Branche gehört zu Projekt
    { s: { r: 0, c: 11 }, e: { r: 0, c: 12 } }, // Finanzen (11..12)
    // Zeile 2 — Sub-Gruppen
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },   // Stammdaten (0..3)
    { s: { r: 1, c: 4 }, e: { r: 1, c: 5 } },   // Inhalt (4..5)
    { s: { r: 1, c: 11 }, e: { r: 1, c: 12 } }, // Bewilligung (11..12)
    // VERTIKAL-MERGE: Branche über Zeile 1-2 (r1..r2) und Spalten 6..10
    { s: { r: 1, c: 6 }, e: { r: 2, c: 10 } },
  ];
  const ws = sheetFromAoa(aoa, merges);
  await writeXlsx(path.join(OUT_DIR, 'labels-stammdaten-branche.xlsx'), ws);
  console.log('  labels-stammdaten-branche.xlsx  (N=4, vertikal-merged "Branche")');
}

console.log('✓ 4 Test-Label-XLSX geschrieben nach public/test-korpus/bauforschung-v2/');
