import { describe, it, expect } from 'vitest';
import { filterSkills, sortSkills, skillKategorieKandidaten, DEFAULT_FACETS } from '../skill-browse';
import type { SkillRecord } from '@/core/services/skills';
import type { SkillAggregat, SkillAggregatMap } from '@/core/services/skill-feedback';

function skill(p: Partial<SkillRecord>): SkillRecord {
  return {
    id: 'x', name: 'X', beschreibung: '', version: 1, promptTemplate: '',
    modifiers: { neu: '', kuerzer: '', laenger: '' }, regelIds: [], slots: [],
    geaendert_am: '2026-01-01T00:00:00.000Z', ...p,
  };
}
function agg(p: Partial<SkillAggregat>): SkillAggregat {
  return { nutzung: 0, up: 0, down: 0, letzteNutzung: null, kommentare: [], ...p };
}

const skills: SkillRecord[] = [
  skill({ id: 'a', name: 'Alpha', reifegrad: 'empfohlen', regelIds: ['r1'], geaendert_am: '2026-03-01T00:00:00.000Z' }),
  skill({ id: 'b', name: 'Beta', reifegrad: 'entwurf', regelIds: ['r2'], geaendert_am: '2026-05-01T00:00:00.000Z' }),
  skill({ id: 'c', name: 'Gamma', reifegrad: 'erprobt', regelIds: ['r1', 'r2'], geaendert_am: '2026-01-01T00:00:00.000Z' }),
];
const map: SkillAggregatMap = new Map([
  ['a', agg({ nutzung: 10, up: 1, down: 5 })],
  ['b', agg({ nutzung: 2, up: 8, down: 0 })],
  ['c', agg({ nutzung: 5, up: 3, down: 1 })],
]);

/** Mischung aus id-Ableitung, Namens-Fallback, explizitem Override und Auffang. */
const kategorieSkills: SkillRecord[] = [
  skill({ id: 'aufbereitung-zahlen', name: 'Zahlen-Inventar' }),          // → aufbereitung
  skill({ id: 'gutachten-markt', name: 'Markt (D)' }),                    // → gutachten
  skill({ id: 'uuid-1', name: 'Irgendwas' }),                             // → sonstige
  skill({ id: 'kuratiert', name: 'Gutachten - Bullet Points' }),          // → gutachten (Name)
  skill({ id: 'override', name: 'Markt (D)', kategorie: 'anfrage' }),     // → explizit
];

describe('filterSkills', () => {
  it('Default lässt alle durch', () => {
    expect(filterSkills(skills, DEFAULT_FACETS)).toHaveLength(3);
  });
  it('filtert nach Reifegrad', () => {
    expect(filterSkills(skills, { ...DEFAULT_FACETS, reifegrad: 'erprobt' }).map(s => s.id)).toEqual(['c']);
  });
  it('filtert nach „nutzt Regel X"', () => {
    expect(filterSkills(skills, { ...DEFAULT_FACETS, regelId: 'r1' }).map(s => s.id)).toEqual(['a', 'c']);
  });
  it('filtert nach effektiver Kategorie (abgeleitet + explizit)', () => {
    expect(filterSkills(kategorieSkills, { ...DEFAULT_FACETS, kategorie: 'gutachten' }).map(s => s.id))
      .toEqual(['gutachten-markt', 'kuratiert']);
    expect(filterSkills(kategorieSkills, { ...DEFAULT_FACETS, kategorie: 'anfrage' }).map(s => s.id))
      .toEqual(['override']);
  });
});

describe('Kategorie-Achse', () => {
  it('sortiert fachlich (SKILL_KATEGORIE_ORDER), innerhalb nach Name', () => {
    expect(sortSkills(kategorieSkills, null, 'kategorie').map(s => s.id))
      .toEqual(['kuratiert', 'gutachten-markt', 'aufbereitung-zahlen', 'override', 'uuid-1']);
  });
  it('Kandidaten nur für belegte Kategorien, in stabiler Reihenfolge, mit Zähler', () => {
    expect(skillKategorieKandidaten(kategorieSkills)).toEqual([
      { key: 'gutachten', label: 'Gutachten', count: 2 },
      { key: 'aufbereitung', label: 'Aufbereitung', count: 1 },
      { key: 'anfrage', label: 'Anfragen', count: 1 },
      { key: 'sonstige', label: 'Sonstige', count: 1 },
    ]);
  });
  it('leere Liste → keine Kandidaten', () => {
    expect(skillKategorieKandidaten([])).toEqual([]);
  });
});

describe('sortSkills (rein, mutiert nicht)', () => {
  it('Datum: neueste zuerst', () => {
    const original = [...skills];
    expect(sortSkills(skills, map, 'datum').map(s => s.id)).toEqual(['b', 'a', 'c']);
    expect(skills).toEqual(original); // unverändert
  });
  it('Nutzung: meistgenutzt zuerst', () => {
    expect(sortSkills(skills, map, 'nutzung').map(s => s.id)).toEqual(['a', 'c', 'b']);
  });
  it('Feedback: höchster Netto-Score zuerst', () => {
    // b: 8-0=8, c: 3-1=2, a: 1-5=-4
    expect(sortSkills(skills, map, 'feedback').map(s => s.id)).toEqual(['b', 'c', 'a']);
  });
  it('Name: alphabetisch', () => {
    expect(sortSkills(skills, map, 'name').map(s => s.name)).toEqual(['Alpha', 'Beta', 'Gamma']);
  });
  it('tolerant ohne Aggregat (null)', () => {
    expect(sortSkills(skills, null, 'nutzung')).toHaveLength(3);
  });
});
