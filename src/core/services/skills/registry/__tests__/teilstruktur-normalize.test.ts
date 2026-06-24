/**
 * Linchpin-Test der strukturierten Skill-Ausgabe: `normalizeSkill` baut den
 * SkillRecord feldweise neu (Whitelist). teilStruktur/teilJoin MÜSSEN den
 * normalize-Pfad überleben — sonst verlöre die CLI-`--registry`-Pilot-Registry
 * (resolveRegistry → normalizeRegistryFile) die Struktur lautlos.
 */
import { describe, it, expect } from 'vitest';
import { normalizeRegistryFile } from '../storage';

const baseSkill = {
  id: 's1', name: 'S', beschreibung: '', version: 1, promptTemplate: 'P',
  regelIds: [], slots: [], modifiers: { neu: '', kuerzer: '', laenger: '' }, geaendert_am: 't',
};
const wrap = (skill: Record<string, unknown>) =>
  normalizeRegistryFile({ version: 1, updated_at: 't', skills: [skill], regeln: [] });

describe('normalizeSkill — teilStruktur/teilJoin', () => {
  it('übernimmt valide teilStruktur + teilJoin', () => {
    const reg = wrap({ ...baseSkill, teilStruktur: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], teilJoin: '\n' });
    const s = reg!.skills[0]!;
    expect(s.teilStruktur).toEqual([{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }]);
    expect(s.teilJoin).toBe('\n');
  });

  it('verwirft Einträge ohne key/label und ungültiges teilJoin', () => {
    const reg = wrap({
      ...baseSkill,
      teilStruktur: [{ key: 'a', label: 'A' }, { key: '', label: 'X' }, { label: 'noKey' }, 'kaputt'],
      teilJoin: '###',
    });
    const s = reg!.skills[0]!;
    expect(s.teilStruktur).toEqual([{ key: 'a', label: 'A' }]);
    expect(s.teilJoin).toBeUndefined();
  });

  it('ohne teilStruktur: beide Felder bleiben undefiniert (heutiges Verhalten)', () => {
    const s = wrap(baseSkill)!.skills[0]!;
    expect(s.teilStruktur).toBeUndefined();
    expect(s.teilJoin).toBeUndefined();
  });

  it('leere teilStruktur-Liste → undefiniert (kein leeres Array persistiert)', () => {
    const s = wrap({ ...baseSkill, teilStruktur: [] })!.skills[0]!;
    expect(s.teilStruktur).toBeUndefined();
  });
});
