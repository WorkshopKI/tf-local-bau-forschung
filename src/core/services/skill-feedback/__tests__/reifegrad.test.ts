import { describe, it, expect } from 'vitest';
import { normalizeRegistryFile } from '@/core/services/skills';

/** Vertrag des additiven `reifegrad`-Feldes am SkillRecord (S1 Phase 1). */
describe('SkillRecord.reifegrad — Normalisierung', () => {
  function fileWith(reifegrad?: unknown) {
    return normalizeRegistryFile({
      version: 1,
      updated_at: '2026-06-19T10:00:00.000Z',
      skills: [{ id: 's1', name: 'Skill', ...(reifegrad === undefined ? {} : { reifegrad }) }],
      regeln: [],
    });
  }

  it('defaultet einen Alt-Record ohne reifegrad auf „entwurf"', () => {
    const f = fileWith(undefined)!;
    expect(f.skills[0]!.reifegrad).toBe('entwurf');
  });

  it('behält gültige Werte (erprobt/empfohlen)', () => {
    expect(fileWith('erprobt')!.skills[0]!.reifegrad).toBe('erprobt');
    expect(fileWith('empfohlen')!.skills[0]!.reifegrad).toBe('empfohlen');
  });

  it('fällt bei unbekanntem Wert auf „entwurf" zurück', () => {
    expect(fileWith('legendär')!.skills[0]!.reifegrad).toBe('entwurf');
    expect(fileWith(42)!.skills[0]!.reifegrad).toBe('entwurf');
  });
});
