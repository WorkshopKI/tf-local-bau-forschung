import { describe, it, expect } from 'vitest';
import { applyRegelFilters, computeRegelCandidates, ALLE, type RegelFacetValues } from '../useRegelFilters';
import type { QualitaetsRegel, SkillRegistryFile, SkillRecord } from '@/core/services/skills';

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

function skill(name: string, regelIds: string[]): SkillRecord {
  return { id: name, name, regelIds } as unknown as SkillRecord;
}

const fileWith = (regeln: QualitaetsRegel[], skills: SkillRecord[] = []): SkillRegistryFile =>
  ({ version: 1, updated_at: 't', skills, regeln });

const values = (over: Partial<RegelFacetValues> = {}): RegelFacetValues => ({
  kategorie: ALLE, pruefart: ALLE, schweregrad: ALLE, aktiv: ALLE, skill: ALLE, ...over,
});

describe('applyRegelFilters', () => {
  const regeln = [
    regel({ id: 'u', typ: 'satzanzahl' }),                                  // Umfang / Textlich / Fehler
    regel({ id: 'q', typ: 'ga_qs_quellenabgleich', pruefart: 'fachlich', schweregrad: 'hinweis' }), // Inhalt & Quellen / Fachlich / Hinweis
    regel({ id: 'a', typ: 'satzanzahl', aktiv: false }),                    // Umfang / inaktiv
  ];
  const file = fileWith(regeln, [skill('GA-Skill', ['q'])]);

  it('leerer Filter → unverändert', () => {
    expect(applyRegelFilters(regeln, file, values()).map(r => r.id)).toEqual(['u', 'q', 'a']);
  });
  it('Kategorie „Umfang"', () => {
    expect(applyRegelFilters(regeln, file, values({ kategorie: 'Umfang' })).map(r => r.id)).toEqual(['u', 'a']);
  });
  it('Prüfart „Fachlich"', () => {
    expect(applyRegelFilters(regeln, file, values({ pruefart: 'Fachlich' })).map(r => r.id)).toEqual(['q']);
  });
  it('Aktiv „Inaktiv"', () => {
    expect(applyRegelFilters(regeln, file, values({ aktiv: 'Inaktiv' })).map(r => r.id)).toEqual(['a']);
  });
  it('AND-Kombination Kategorie + Schweregrad', () => {
    expect(applyRegelFilters(regeln, file, values({ kategorie: 'Umfang', schweregrad: 'Fehler' })).map(r => r.id))
      .toEqual(['u', 'a']);
  });
  it('Skill (n:m Membership)', () => {
    expect(applyRegelFilters(regeln, file, values({ skill: 'GA-Skill' })).map(r => r.id)).toEqual(['q']);
  });
});

describe('computeRegelCandidates', () => {
  const regeln = [
    regel({ id: 'q', typ: 'ga_qs_quellenabgleich', pruefart: 'fachlich' }), // Inhalt & Quellen
    regel({ id: 'u', typ: 'satzanzahl' }),                                  // Umfang
  ];
  const file = fileWith(regeln, [skill('GA-Skill', ['q'])]);

  it('Kategorie folgt KATEGORIE_ORDER (Umfang vor Inhalt & Quellen)', () => {
    const cand = computeRegelCandidates(regeln, file);
    expect(cand.kategorie.map(c => c.label)).toEqual(['Umfang', 'Inhalt & Quellen']);
    expect(cand.kategorie.find(c => c.label === 'Umfang')?.count).toBe(1);
  });
  it('Prüfart-Kandidaten in fixer Reihenfolge mit Counts', () => {
    const cand = computeRegelCandidates(regeln, file);
    // 'u' ohne pruefart → Textlich, 'q' → Fachlich.
    expect(cand.pruefart.map(c => c.label)).toEqual(['Textlich', 'Fachlich']);
  });
  it('Skill-Kandidaten zählen Regeln pro Skill', () => {
    const cand = computeRegelCandidates(regeln, file);
    expect(cand.skill).toEqual([{ label: 'GA-Skill', count: 1 }]);
  });
  it('keine Typ-Facette mehr (verdoppelte Kategorie/Prüfart)', () => {
    const cand = computeRegelCandidates(regeln, file);
    expect('typ' in cand).toBe(false);
  });
});
