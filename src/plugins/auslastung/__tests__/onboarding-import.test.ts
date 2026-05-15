import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseOnboardingXlsx, deriveUeberKategorien } from '../services/onboarding-import';
import { buildAnonymMap } from '../services/anonym-map';
import { emptyAuslastungData } from '../types';
import type { Antrag } from '@/core/services/csv/types';
import type { AuslastungData, OnboardingBewertungEintrag, UeberKategorie } from '../types';

function makeAntrag(az: string, tib?: string): Antrag {
  return {
    aktenzeichen: az,
    programm_id: 'p1',
    tib_kuerz: tib,
    _field_sources: {},
    _updated_at: '2026-05-01T00:00:00Z',
  } as Antrag;
}

function makeXlsx(opts: {
  kuerzel?: string;
  fachrichtung?: string;
  freitext?: string;
  ueberKategorien?: string;
  bewertungen?: Array<[string, string, string, string, string]>;
  technologien?: string[];
}): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const profil: Array<[string, string]> = [
    ['Feld', 'Wert'],
  ];
  if (opts.kuerzel) profil.push(['Kürzel', opts.kuerzel]);
  if (opts.fachrichtung) profil.push(['Fachrichtung', opts.fachrichtung]);
  if (opts.freitext) profil.push(['Freitext', opts.freitext]);
  if (opts.ueberKategorien) profil.push(['Überkategorien', opts.ueberKategorien]);
  const ws1 = XLSX.utils.aoa_to_sheet(profil);
  XLSX.utils.book_append_sheet(wb, ws1, 'Profil');

  const bewertHeader = ['Aktenzeichen', 'Kategorie', 'Überkategorie', 'VB-Titel', 'Bewertung'];
  const bewert: string[][] = [bewertHeader, ...(opts.bewertungen ?? [])];
  const ws2 = XLSX.utils.aoa_to_sheet(bewert);
  XLSX.utils.book_append_sheet(wb, ws2, 'Antrags-Bewertungen');

  if (opts.technologien && opts.technologien.length > 0) {
    const techRows: string[][] = [['Technologie'], ...opts.technologien.map(t => [t])];
    const ws3 = XLSX.utils.aoa_to_sheet(techRows);
    XLSX.utils.book_append_sheet(wb, ws3, 'Manuelle Technologien');
  }
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

function makeFile(name: string, buf: ArrayBuffer): File {
  return new File([buf], name, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function makeData(): AuslastungData {
  const base = emptyAuslastungData();
  base.config.ueberKategorien = [
    { id: 'IKT', name: 'IKT', farbe: 'blue', deskriptorenMapping: ['ki', 'machine learning'] },
    { id: 'IND', name: 'IND', farbe: 'emerald', deskriptorenMapping: ['lasertechnik'] },
  ];
  return base;
}

describe('parseOnboardingXlsx', () => {
  const ctx = () => ({
    anonymMap: buildAnonymMap([makeAntrag('A1', 'MUE'), makeAntrag('A2', 'SCH')]),
    data: makeData(),
  });

  it('extrahiert Kürzel aus Dateiname', async () => {
    const buf = makeXlsx({ kuerzel: 'NEW', bewertungen: [['A1', 'ki', 'IKT', 't', 'Kann ich']] });
    const file = makeFile('onboarding-NEW.xlsx', buf);
    const p = await parseOnboardingXlsx(file, ctx());
    expect(p.kuerzelAusDatei).toBe('NEW');
  });

  it('Kürzel-Mismatch zwischen Dateiname und Sheet -> Warning', async () => {
    const buf = makeXlsx({ kuerzel: 'ANDERS', bewertungen: [['A1', 'ki', 'IKT', 't', 'Kann ich']] });
    const file = makeFile('onboarding-MUE.xlsx', buf);
    const p = await parseOnboardingXlsx(file, ctx());
    expect(p.kuerzelMatch).toBe('abweichend');
    expect(p.warnings.length).toBeGreaterThan(0);
  });

  it('Bestehender MA -> existierterAnonId gesetzt', async () => {
    const buf = makeXlsx({ kuerzel: 'MUE', bewertungen: [] });
    const file = makeFile('onboarding-MUE.xlsx', buf);
    const p = await parseOnboardingXlsx(file, ctx());
    expect(p.existierterAnonId).toBeDefined();
    expect(p.vorgeschlageneAnonId).toBeUndefined();
  });

  it('Neuer MA -> vorgeschlageneAnonId gesetzt', async () => {
    const buf = makeXlsx({ kuerzel: 'NEW', bewertungen: [] });
    const file = makeFile('onboarding-NEW.xlsx', buf);
    const p = await parseOnboardingXlsx(file, ctx());
    expect(p.existierterAnonId).toBeUndefined();
    expect(p.vorgeschlageneAnonId).toMatch(/^MA\d{2}$/);
  });

  it('Bewertungs-Counts korrekt', async () => {
    const buf = makeXlsx({
      kuerzel: 'NEW',
      bewertungen: [
        ['A1', 'ki', 'IKT', 't', 'Kann ich'],
        ['A2', 'ki', 'IKT', 't', 'Kann ich'],
        ['A3', 'ki', 'IKT', 't', 'Teilweise'],
        ['A4', 'ki', 'IKT', 't', 'Nicht meins'],
      ],
    });
    const file = makeFile('onboarding-NEW.xlsx', buf);
    const p = await parseOnboardingXlsx(file, ctx());
    expect(p.counts).toEqual({ kann_ich: 2, teilweise: 1, nicht_meins: 1 });
  });

  it('Technologien aus Sheet 3 werden importiert', async () => {
    const buf = makeXlsx({
      kuerzel: 'NEW',
      bewertungen: [],
      technologien: ['CFK', 'FEM-Simulation'],
    });
    const file = makeFile('onboarding-NEW.xlsx', buf);
    const p = await parseOnboardingXlsx(file, ctx());
    expect(p.manuelleTechnologien).toContain('CFK');
    expect(p.manuelleTechnologien).toContain('FEM-Simulation');
  });

  it('Defekte Datei -> errors', async () => {
    const file = new File([new ArrayBuffer(10)], 'broken.xlsx');
    const p = await parseOnboardingXlsx(file, ctx());
    expect(p.errors.length).toBeGreaterThan(0);
  });
});

describe('deriveUeberKategorien', () => {
  const kategorien: UeberKategorie[] = [
    { id: 'IKT', name: 'IKT', farbe: 'blue', deskriptorenMapping: ['ki', 'big data'] },
    { id: 'IND', name: 'IND', farbe: 'emerald', deskriptorenMapping: ['lasertechnik'] },
  ];

  it('>=3 "Kann ich" -> in Liste', () => {
    const b: OnboardingBewertungEintrag[] = [
      { aktenzeichen: 'A1', kategorie: 'ki', ueberKategorie: 'IKT', bewertung: 'kann_ich' },
      { aktenzeichen: 'A2', kategorie: 'ki', ueberKategorie: 'IKT', bewertung: 'kann_ich' },
      { aktenzeichen: 'A3', kategorie: 'ki', ueberKategorie: 'IKT', bewertung: 'kann_ich' },
    ];
    expect(deriveUeberKategorien(b, kategorien)).toEqual(['IKT']);
  });

  it('<3 "Kann ich" -> nicht in Liste', () => {
    const b: OnboardingBewertungEintrag[] = [
      { aktenzeichen: 'A1', kategorie: 'ki', ueberKategorie: 'IKT', bewertung: 'kann_ich' },
      { aktenzeichen: 'A2', kategorie: 'ki', ueberKategorie: 'IKT', bewertung: 'kann_ich' },
    ];
    expect(deriveUeberKategorien(b, kategorien, 3)).toEqual([]);
  });

  it('"Teilweise" + "Nicht meins" zählen nicht', () => {
    const b: OnboardingBewertungEintrag[] = [
      { aktenzeichen: 'A1', kategorie: 'ki', ueberKategorie: 'IKT', bewertung: 'teilweise' },
      { aktenzeichen: 'A2', kategorie: 'ki', ueberKategorie: 'IKT', bewertung: 'nicht_meins' },
      { aktenzeichen: 'A3', kategorie: 'ki', ueberKategorie: 'IKT', bewertung: 'kann_ich' },
    ];
    expect(deriveUeberKategorien(b, kategorien, 3)).toEqual([]);
  });

  it('Fallback via Deskriptoren-Mapping (kein direktes ueberKategorie-Feld)', () => {
    const b: OnboardingBewertungEintrag[] = [
      { aktenzeichen: 'A1', kategorie: 'ki', bewertung: 'kann_ich' },
      { aktenzeichen: 'A2', kategorie: 'big data', bewertung: 'kann_ich' },
      { aktenzeichen: 'A3', kategorie: 'ki', bewertung: 'kann_ich' },
    ];
    expect(deriveUeberKategorien(b, kategorien, 3)).toEqual(['IKT']);
  });
});
