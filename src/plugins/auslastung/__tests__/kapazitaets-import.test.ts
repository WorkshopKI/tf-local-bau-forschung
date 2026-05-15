import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseKapazitaetsXlsx } from '../services/kapazitaets-import';
import { emptyAuslastungData } from '../types';
import type { AuslastungData } from '../types';

function makeXlsx(kap: Array<Array<string | number>>, tech?: Array<Array<string>>): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(kap);
  XLSX.utils.book_append_sheet(wb, ws1, 'Kapazitäten');
  if (tech) {
    const ws2 = XLSX.utils.aoa_to_sheet(tech);
    XLSX.utils.book_append_sheet(wb, ws2, 'Technologien');
  }
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

function makeFile(buf: ArrayBuffer): File {
  return new File([buf], 'kapazitaeten.xlsx');
}

function makeData(): AuslastungData {
  const base = emptyAuslastungData();
  base.mitarbeiter = {
    MA01: {
      anonId: 'MA01', jahresKapazitaet: 1600, abgemeldet: [], manuelleTechnologien: ['KI'],
      ueberKategorien: ['IKT'], virtuelleProjekte: [], onboardingAbgeschlossen: true,
    },
    MA02: {
      anonId: 'MA02', jahresKapazitaet: 1400, abgemeldet: [], manuelleTechnologien: [],
      ueberKategorien: ['IND'], virtuelleProjekte: [], onboardingAbgeschlossen: true,
    },
  };
  return base;
}

describe('parseKapazitaetsXlsx', () => {
  it('liest Kapazitaeten + Abmeldungen', async () => {
    const buf = makeXlsx([
      ['MA_NR', 'Jahreskapazitaet_Stunden', 'Abgemeldet_Quartale'],
      ['MA01', 1500, '2026-Q3'],
      ['MA02', 1200, ''],
    ]);
    const p = await parseKapazitaetsXlsx(makeFile(buf), makeData());
    expect(p.rows.length).toBe(2);
    const r1 = p.rows.find(r => r.anonId === 'MA01')!;
    expect(r1.jahresKapazitaet).toBe(1500);
    expect(r1.abgemeldet).toEqual(['2026-Q3']);
    expect(r1.warnings).toEqual([]);
  });

  it('Unbekannte MA-ID -> Warning', async () => {
    const buf = makeXlsx([
      ['MA_NR', 'Jahreskapazitaet_Stunden'],
      ['MA99', 1600],
    ]);
    const p = await parseKapazitaetsXlsx(makeFile(buf), makeData());
    expect(p.rows[0]?.warnings.some(w => w.includes('Unbekannte'))).toBe(true);
    expect(p.summary.unknownMa).toBe(1);
  });

  it('Fehlende Kapazitaet -> Warning', async () => {
    const buf = makeXlsx([
      ['MA_NR', 'Jahreskapazitaet_Stunden'],
      ['MA01', ''],
    ]);
    const p = await parseKapazitaetsXlsx(makeFile(buf), makeData());
    expect(p.rows[0]?.warnings.some(w => w.includes('ungueltig'))).toBe(true);
  });

  it('Fehlender Pflicht-Spalten-Header -> fatal', async () => {
    const buf = makeXlsx([['Unsinn'], ['MA01']]);
    const p = await parseKapazitaetsXlsx(makeFile(buf), makeData());
    expect(p.fatal).toBeDefined();
  });

  it('Technologien-Sheet wird gemerged', async () => {
    const buf = makeXlsx(
      [['MA_NR', 'Jahreskapazitaet_Stunden'], ['MA01', 1600]],
      [['MA_NR', 'Technologie_1', 'Technologie_2'], ['MA01', 'KI', 'Sensorik']],
    );
    const p = await parseKapazitaetsXlsx(makeFile(buf), makeData());
    const r = p.rows.find(r => r.anonId === 'MA01')!;
    expect(r.manuelleTechnologien).toEqual(['KI', 'Sensorik']);
  });

  it('Summary stimmt', async () => {
    const buf = makeXlsx([
      ['MA_NR', 'Jahreskapazitaet_Stunden'],
      ['MA01', 1600],   // gültig
      ['MA99', 1600],   // unknown -> Warning
      ['MA02', ''],     // ungültig -> Warning
    ]);
    const p = await parseKapazitaetsXlsx(makeFile(buf), makeData());
    expect(p.summary.total).toBe(3);
    expect(p.summary.valid).toBe(1);
    expect(p.summary.warnings).toBe(2);
    expect(p.summary.unknownMa).toBe(1);
  });
});
