import { describe, it, expect } from 'vitest';
import { exportSkillBundle, parseSkillBundle, importSkillBundle, SKILL_BUNDLE_KIND } from '../skill-bundle';
import type { SkillRegistryFile } from '../types';

function file(): SkillRegistryFile {
  return {
    version: 1,
    updated_at: 't',
    skills: [
      {
        id: 's1', name: 'Kurz', beschreibung: 'd', version: 3, promptTemplate: 'P',
        modifiers: { neu: '', kuerzer: '', laenger: '' }, regelIds: ['r1', 'r2'], slots: [],
        geaendert_am: '2026-01-01T00:00:00.000Z',
      },
    ],
    regeln: [
      { id: 'r1', name: 'R1', typ: 'zeichen_max', params: { max: 800 }, schweregrad: 'fehler', aktiv: true, erstellt_am: 't', geaendert_am: 't' },
      { id: 'r2', name: 'R2', typ: 'satzanzahl', params: { min: 1, max: 5 }, schweregrad: 'hinweis', aktiv: true, erstellt_am: 't', geaendert_am: 't' },
      { id: 'r3', name: 'Andere', typ: 'wortanzahl', params: {}, schweregrad: 'hinweis', aktiv: true, erstellt_am: 't', geaendert_am: 't' },
    ],
  };
}

describe('exportSkillBundle', () => {
  it('bündelt Skill + zugeordnete Regeln, ohne Historie / Antragsdaten', () => {
    const b = exportSkillBundle(file(), 's1')!;
    expect(b.kind).toBe(SKILL_BUNDLE_KIND);
    expect(b.skill.id).toBe('s1');
    expect('historie' in b.skill).toBe(false);
    expect(b.regeln.map(r => r.id)).toEqual(['r1', 'r2']); // r3 NICHT (nicht zugeordnet)
  });
  it('null bei unbekannter ID', () => {
    expect(exportSkillBundle(file(), 'gibt-es-nicht')).toBeNull();
  });
});

describe('parseSkillBundle', () => {
  it('Round-trip: export → parse ergibt denselben Skill + Regeln', () => {
    const b = exportSkillBundle(file(), 's1')!;
    const parsed = parseSkillBundle(JSON.parse(JSON.stringify(b)))!;
    expect(parsed.skill.id).toBe('s1');
    expect(parsed.regeln.map(r => r.id)).toEqual(['r1', 'r2']);
  });
  it('verwirft falsche Struktur', () => {
    expect(parseSkillBundle({ kind: 'andere' })).toBeNull();
    expect(parseSkillBundle({ kind: SKILL_BUNDLE_KIND, skill: null, regeln: [] })).toBeNull();
    expect(parseSkillBundle(null)).toBeNull();
  });
});

describe('importSkillBundle', () => {
  it('importiert in eine frische Registry ohne Konflikt', () => {
    const leer: SkillRegistryFile = { version: 1, updated_at: 't', skills: [], regeln: [] };
    const bundle = exportSkillBundle(file(), 's1')!;
    const res = importSkillBundle(leer, bundle, { newId: () => 'neu' });
    expect(res.konflikt).toBe(false);
    expect(res.importedSkillId).toBe('s1');
    expect(res.file.skills).toHaveLength(1);
    expect(res.ergaenzteRegeln).toEqual(['r1', 'r2']);
    expect(res.file.regeln).toHaveLength(2);
  });

  it('ID-Kollision → Skill wird mit neuer ID dupliziert', () => {
    const f = file();
    const bundle = exportSkillBundle(f, 's1')!;
    const res = importSkillBundle(f, bundle, { newId: () => 'dup-id' });
    expect(res.konflikt).toBe(true);
    expect(res.importedSkillId).toBe('dup-id');
    expect(res.file.skills.map(s => s.id)).toEqual(['s1', 'dup-id']);
    expect(res.file.skills[1]!.name).toContain('(importiert)');
  });

  it('Regel-Merge ohne Dublette (vorhandene IDs unberührt)', () => {
    const f = file(); // hat r1, r2, r3
    const bundle = exportSkillBundle(f, 's1')!; // bringt r1, r2
    const res = importSkillBundle(f, bundle, { newId: () => 'dup-id' });
    // r1/r2 existieren bereits → nicht erneut hinzugefügt
    expect(res.ergaenzteRegeln).toEqual([]);
    expect(res.file.regeln.map(r => r.id)).toEqual(['r1', 'r2', 'r3']);
  });
});
