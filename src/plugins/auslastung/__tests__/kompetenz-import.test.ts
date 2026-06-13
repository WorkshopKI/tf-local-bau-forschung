import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseKompetenzXlsx } from '../services/onboarding';
import { emptyAuslastungData, CANONICAL_TIB_KUERZ } from '../types';
import type { Antrag } from '@/core/services/csv/types';
import { buildAnonymMapForTests } from './test-helpers';

function antragMitKuerzel(az: string, kuerzel: string): Antrag {
  return { aktenzeichen: az, [CANONICAL_TIB_KUERZ]: kuerzel } as unknown as Antrag;
}

/** Baut die wide Kompetenz-XLSX (2 Header-Zeilen + Merges) wie das Original. */
function makeWideXlsx(): ArrayBuffer {
  const aoa: Array<Array<string | number>> = [
    ['', '', '', '', '', '', 'IT', '', 'DT', '', 'LG', '', 'EU', '', 'NM'],
    ['DL', 'DS', 'NW', 'FuE', 'TIB_KUERZ', 'Abschlag', 'IT-A', 'IT-B', 'DT-A', 'DT-B', 'LG-A', 'LG-B', 'EU-A', 'EU-B', 'NM-A'],
    ['', '100', '', '337', 'AAt', '', 1, 3, 2, '', '', '', 3, 3, ''],
    ['', '', '0', '300', 'KaBa', '10', 2, 2, '', 3, '', '', '', '', ''],
    ['', '', '', '100', 'ZZZ', '', 3, '', '', '', '', '', '', '', ''],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [
    { s: { r: 0, c: 6 }, e: { r: 0, c: 7 } },   // IT
    { s: { r: 0, c: 8 }, e: { r: 0, c: 9 } },   // DT
    { s: { r: 0, c: 10 }, e: { r: 0, c: 11 } }, // LG
    { s: { r: 0, c: 12 }, e: { r: 0, c: 13 } }, // EU  (NM = c14 ohne Merge)
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tabelle1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

const anonymMap = buildAnonymMapForTests([
  antragMitKuerzel('A1', 'AAt'),
  antragMitKuerzel('A2', 'KaBa'),
  antragMitKuerzel('A3', 'ribo'),
]);

async function parse() {
  const file = new File([makeWideXlsx()], 'kompetenz.xlsx');
  return parseKompetenzXlsx(file, emptyAuslastungData(), anonymMap);
}

describe('parseKompetenzXlsx', () => {
  it('erkennt das Schema (Merge-Header → Ueberkat → Unterkat)', async () => {
    const p = await parse();
    expect(p.fatal).toBeUndefined();
    expect(p.schema.map(e => e.ueberId)).toEqual(['IT', 'DT', 'LG', 'EU', 'NM']);
    expect(p.schema[0]!.subKategorien).toEqual(['IT-A', 'IT-B']);
    expect(p.schema[4]!.subKategorien).toEqual(['NM-A']); // Einzel-Spalte ohne Merge
  });

  it('leitet Haupt-/Nebenkategorie aus den Leveln ab', async () => {
    const p = await parse();
    const aat = p.rows.find(r => r.kuerzel === 'AAt')!;
    // IT Σ4, DT Σ2, EU Σ6 → Haupt = EU; Neben = IT, DT (>= 2)
    expect(aat.hauptKategorie).toBe('EU');
    expect(aat.nebenKategorien).toEqual(['IT', 'DT']);
    expect(aat.subCount).toBe(5);
    expect(aat.kompetenzMatrix?.EU).toEqual({ 'EU-A': 3, 'EU-B': 3 });
  });

  it('liest Antragstyp-Kontingent (Anträge/Jahr, > 0) + Abschlag', async () => {
    const p = await parse();
    const aat = p.rows.find(r => r.kuerzel === 'AAt')!;
    expect(aat.jahresKapazitaetProTyp).toEqual({ DS: 100, FuE: 337 });
    expect(aat.abschlagProzent).toBeUndefined();

    const kaba = p.rows.find(r => r.kuerzel === 'KaBa')!;
    expect(kaba.jahresKapazitaetProTyp).toEqual({ FuE: 300 }); // NW=0 → ignoriert
    expect(kaba.abschlagProzent).toBe(10);
    expect(kaba.hauptKategorie).toBe('IT');
    expect(kaba.nebenKategorien).toEqual(['DT']);
  });

  it('unbekanntes Kürzel → keine anonId, Warnung, zählt als unknownMa', async () => {
    const p = await parse();
    const zzz = p.rows.find(r => r.kuerzel === 'ZZZ')!;
    expect(zzz.anonId).toBeNull();
    expect(zzz.warnings.some(w => w.includes('Unbekanntes'))).toBe(true);
  });

  it('Kürzel wird case-insensitiv aufgelöst (AAt → anonId)', async () => {
    const p = await parse();
    const aat = p.rows.find(r => r.kuerzel === 'AAt')!;
    expect(aat.anonId).toBe(anonymMap.toAnon.get('AAT'));
  });

  it('Summary stimmt', async () => {
    const p = await parse();
    expect(p.summary.total).toBe(3);
    expect(p.summary.valid).toBe(2);     // AAt, KaBa
    expect(p.summary.unknownMa).toBe(1); // ZZZ
  });

  it('fehlende TIB_KUERZ-Spalte → fatal', async () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['', 'IT'],
      ['Foo', 'IT-A'],
      ['x', 1],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tabelle1');
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const p = await parseKompetenzXlsx(new File([buf], 'x.xlsx'), emptyAuslastungData(), anonymMap);
    expect(p.fatal).toBeDefined();
  });
});
