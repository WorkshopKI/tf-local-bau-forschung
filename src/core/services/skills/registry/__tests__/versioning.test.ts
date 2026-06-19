import { describe, it, expect } from 'vitest';
import { normalizeRegistryFile } from '../storage';
import { appendHistorie, diffSkillVersions, MAX_HISTORIE } from '../versioning';
import type { SkillRecord } from '../types';

function skill(partial: Partial<SkillRecord> = {}): SkillRecord {
  return {
    id: 's1',
    name: 'Skill',
    beschreibung: '',
    version: 1,
    promptTemplate: 'Zeile A\nZeile B',
    modifiers: { neu: '', kuerzer: '', laenger: '' },
    regelIds: ['r1'],
    slots: [],
    geaendert_am: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

describe('Migration — verlustfreie Historie-Seedung', () => {
  it('Alt-Record ohne Historie → genau ein Baseline-Eintrag aus aktuellem Stand', () => {
    const file = normalizeRegistryFile({
      version: 1,
      skills: [{ id: 's1', name: 'S', version: 4, promptTemplate: 'X', regelIds: ['r1'] }],
      regeln: [],
    })!;
    const s = file.skills[0]!;
    expect(s.historie).toHaveLength(1);
    expect(s.historie![0]).toMatchObject({ version: 4, promptTemplate: 'X', regelIds: ['r1'] });
    // Invariante: Kopf spiegelt den aktuellen Stand
    expect(s.historie![0]!.version).toBe(s.version);
  });

  it('behält eine vorhandene Historie und kappt auf MAX_HISTORIE', () => {
    const grosseHistorie = Array.from({ length: MAX_HISTORIE + 5 }, (_, i) => ({
      version: 100 - i, promptTemplate: `v${100 - i}`, regelIds: [], modifiers: { neu: '', kuerzer: '', laenger: '' }, geaendert_am: 't',
    }));
    const file = normalizeRegistryFile({
      version: 1,
      skills: [{ id: 's1', name: 'S', version: 100, promptTemplate: 'v100', historie: grosseHistorie }],
      regeln: [],
    })!;
    expect(file.skills[0]!.historie).toHaveLength(MAX_HISTORIE);
    expect(file.skills[0]!.historie![0]!.version).toBe(100);
  });
});

describe('appendHistorie — voranstellen + kappen', () => {
  it('stellt einen Snapshot des neuen Standes voran und behält den Tail', () => {
    const v1 = skill({ version: 1, historie: [{ version: 1, promptTemplate: 'Zeile A\nZeile B', regelIds: ['r1'], modifiers: { neu: '', kuerzer: '', laenger: '' }, geaendert_am: 't1' }] });
    const v2 = { ...v1, version: 2, promptTemplate: 'Zeile A\nNeu', geaendert_am: 't2' };
    const hist = appendHistorie(v2, { userId: 'kw', begruendung: '  kürzer gemacht  ' });
    expect(hist.map(h => h.version)).toEqual([2, 1]);
    expect(hist[0]).toMatchObject({ version: 2, userId: 'kw', begruendung: 'kürzer gemacht' });
    // userId/begruendung werden getrimmt; leere weggelassen
    const ohne = appendHistorie(v2, { userId: '   ', begruendung: '' });
    expect(ohne[0]!.userId).toBeUndefined();
    expect(ohne[0]!.begruendung).toBeUndefined();
  });

  it('kappt die Gesamtlänge auf MAX_HISTORIE', () => {
    let s = skill({ version: 1, historie: [] });
    for (let v = 1; v <= MAX_HISTORIE + 8; v++) {
      s = { ...s, version: v };
      s = { ...s, historie: appendHistorie(s) };
    }
    expect(s.historie).toHaveLength(MAX_HISTORIE);
    expect(s.historie![0]!.version).toBe(MAX_HISTORIE + 8);
  });
});

describe('diffSkillVersions — Template / Regeln / Modifier', () => {
  it('erkennt Zeilen-Änderungen im Template', () => {
    const d = diffSkillVersions(
      { promptTemplate: 'A\nB\nC', regelIds: [], modifiers: { neu: '', kuerzer: '', laenger: '' } },
      { promptTemplate: 'A\nX\nC', regelIds: [], modifiers: { neu: '', kuerzer: '', laenger: '' } },
    );
    expect(d.template.filter(z => z.typ === 'weg').map(z => z.text)).toEqual(['B']);
    expect(d.template.filter(z => z.typ === 'hinzu').map(z => z.text)).toEqual(['X']);
    expect(d.template.filter(z => z.typ === 'gleich').map(z => z.text)).toEqual(['A', 'C']);
    expect(d.unveraendert).toBe(false);
  });

  it('erkennt Regel-Mengen-Diff und Modifier-Änderungen', () => {
    const d = diffSkillVersions(
      { promptTemplate: 'x', regelIds: ['r1', 'r2'], modifiers: { neu: 'a', kuerzer: '', laenger: '' } },
      { promptTemplate: 'x', regelIds: ['r2', 'r3'], modifiers: { neu: 'b', kuerzer: '', laenger: '' } },
    );
    expect(d.regeln.hinzu).toEqual(['r3']);
    expect(d.regeln.weg).toEqual(['r1']);
    expect(d.modifiers).toEqual(['neu']);
  });

  it('meldet Gleichheit als unveraendert', () => {
    const v = { promptTemplate: 'A\nB', regelIds: ['r1'], modifiers: { neu: '', kuerzer: '', laenger: '' } };
    expect(diffSkillVersions(v, { ...v }).unveraendert).toBe(true);
  });
});
