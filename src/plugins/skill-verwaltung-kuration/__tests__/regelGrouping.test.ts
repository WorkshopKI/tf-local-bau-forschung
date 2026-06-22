import { describe, it, expect } from 'vitest';
import { buildRegelSectionRows, REGEL_GROUPING_OPTIONS } from '../regelGrouping';
import { typLabel, kategorieLabel } from '../regelShared';
import type { QualitaetsRegel, SkillRegistryFile } from '@/core/services/skills';

function regel(over: Partial<QualitaetsRegel> & { id: string; typ: string }): QualitaetsRegel {
  return {
    name: over.id,
    params: {},
    schweregrad: 'fehler',
    aktiv: true,
    erstellt_am: 't',
    geaendert_am: 't',
    ...over,
  };
}
const fileWith = (regeln: QualitaetsRegel[]): SkillRegistryFile => ({ version: 1, updated_at: 't', skills: [], regeln });

describe('typLabel — pruefart-Fallback statt „unbekannter Typ"', () => {
  it('bekannter typ → typ-Label', () => {
    expect(typLabel(regel({ id: 'a', typ: 'satzanzahl' }))).toBe('Satzanzahl');
  });
  it('unbekannter typ + pruefart → pruefart-Label', () => {
    expect(typLabel(regel({ id: 'b', typ: 'ga_qs_quellenabgleich', pruefart: 'fachlich' }))).toBe('Fachlich');
    expect(typLabel(regel({ id: 'c', typ: 'ga_qs_vollstaendigkeit', pruefart: 'administrativ' }))).toBe('Administrativ');
  });
  it('unbekannter typ ohne pruefart → „unbekannter Typ"', () => {
    expect(typLabel(regel({ id: 'd', typ: 'zukunft' }))).toBe('unbekannter Typ');
  });
});

describe('kategorieLabel', () => {
  it('typ → Kategorie-Label', () => {
    expect(kategorieLabel(regel({ id: 'a', typ: 'satzanzahl' }))).toBe('Umfang');
  });
  it('fachlich → Inhalt & Quellen', () => {
    expect(kategorieLabel(regel({ id: 'b', typ: 'x', pruefart: 'fachlich' }))).toBe('Inhalt & Quellen');
  });
  it('explizite kategorie schlägt Ableitung', () => {
    expect(kategorieLabel(regel({ id: 'c', typ: 'satzanzahl', kategorie: 'inhalt' }))).toBe('Inhalt & Quellen');
  });
});

describe('buildRegelSectionRows — mode „kategorie"', () => {
  it('Art-Option vorhanden', () => {
    expect(REGEL_GROUPING_OPTIONS.find(o => o.mode === 'kategorie')?.label).toBe('Art');
  });
  it('gruppiert nach Kategorie in KATEGORIE_ORDER (Umfang vor Inhalt)', () => {
    const regeln = [
      regel({ id: 'q', typ: 'ga_qs_quellenabgleich', pruefart: 'fachlich' }), // inhalt
      regel({ id: 'u', typ: 'satzanzahl' }), // umfang
    ];
    const { rows, sectionOf } = buildRegelSectionRows(regeln, 'kategorie', fileWith(regeln));
    expect(sectionOf).not.toBeNull();
    expect(rows.map(r => sectionOf!(r))).toEqual(['Umfang', 'Inhalt & Quellen']);
  });
});
