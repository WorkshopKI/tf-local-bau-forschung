/**
 * Linchpin-Test der QS-Abnahme-Kriterien: `normalizeSkill` baut den SkillRecord
 * feldweise neu (Whitelist) — `qsKriterien` MUSS den normalize-Pfad überleben,
 * sonst verlöre der Skill sie beim ersten Lade-/Speicher-Umlauf und die QS fiele
 * still auf die Default-Dimensionen zurück. Dazu Snapshot/Diff/Rollback: ohne die
 * behielte ein Rollback die NEUEREN Kriterien.
 */
import { describe, it, expect } from 'vitest';
import { normalizeRegistryFile } from '../storage';
import { appendHistorie, diffSkillVersions, rollbackSkill } from '../versioning';
import { exportSkillBundle, parseSkillBundle } from '../skill-bundle';
import type { SkillRecord, SkillRegistryFile } from '../types';

const baseSkill = {
  id: 's1', name: 'S', beschreibung: '', version: 1, promptTemplate: 'P',
  regelIds: [], slots: [], modifiers: { neu: '', kuerzer: '', laenger: '' }, geaendert_am: 't',
};
const wrap = (skill: Record<string, unknown>): SkillRegistryFile | null =>
  normalizeRegistryFile({ version: 1, updated_at: 't', skills: [skill], regeln: [] });

function rec(partial: Partial<SkillRecord> = {}): SkillRecord {
  return {
    id: 's1', name: 'Skill', beschreibung: '', version: 1, promptTemplate: 'Zeile A',
    modifiers: { neu: '', kuerzer: '', laenger: '' }, regelIds: [], slots: [],
    geaendert_am: '2026-01-01T00:00:00.000Z', ...partial,
  };
}

describe('normalizeSkill — qsKriterien', () => {
  it('uebernimmt eine valide Kriterien-Liste (getrimmt)', () => {
    const s = wrap({ ...baseSkill, qsKriterien: ['Aussagen belegt ', '  Risiken konkret'] })!.skills[0]!;
    expect(s.qsKriterien).toEqual(['Aussagen belegt', 'Risiken konkret']);
  });

  it('verwirft Nicht-Strings und leere Eintraege', () => {
    const s = wrap({ ...baseSkill, qsKriterien: ['gut', '', '   ', 42, null, { a: 1 }] })!.skills[0]!;
    expect(s.qsKriterien).toEqual(['gut']);
  });

  it('ohne Feld bleibt es undefiniert (heutiges Verhalten, QS nutzt Default-Dimensionen)', () => {
    expect(wrap(baseSkill)!.skills[0]!.qsKriterien).toBeUndefined();
  });

  it('leere Liste → undefiniert (kein leeres Array persistiert)', () => {
    expect(wrap({ ...baseSkill, qsKriterien: [] })!.skills[0]!.qsKriterien).toBeUndefined();
    expect(wrap({ ...baseSkill, qsKriterien: ['  '] })!.skills[0]!.qsKriterien).toBeUndefined();
  });

  it('kein Array → undefiniert statt Absturz', () => {
    expect(wrap({ ...baseSkill, qsKriterien: 'ein String' })!.skills[0]!.qsKriterien).toBeUndefined();
  });

  it('ueberlebt den Bundle-Export/Import-Rundlauf', () => {
    const file = wrap({ ...baseSkill, qsKriterien: ['Aussagen belegt'] })!;
    const bundle = exportSkillBundle(file, 's1');
    // Rundlauf über JSON, wie beim echten Datei-Export/-Import.
    const zurueck = parseSkillBundle(JSON.parse(JSON.stringify(bundle)));
    expect(zurueck?.skill.qsKriterien).toEqual(['Aussagen belegt']);
  });
});

describe('Versions-Snapshot / Diff / Rollback — qsKriterien', () => {
  it('appendHistorie nimmt die Kriterien in den Snapshot auf', () => {
    const h = appendHistorie(rec({ qsKriterien: ['A', 'B'] }));
    expect(h[0]!.qsKriterien).toEqual(['A', 'B']);
  });

  it('Skills ohne Kriterien bekommen ein feldfreies Snapshot (unveraendert zu vorher)', () => {
    expect(appendHistorie(rec())[0]!.qsKriterien).toBeUndefined();
  });

  it('normalizeHistorie haelt die Kriterien im Baseline-Eintrag', () => {
    const s = wrap({ ...baseSkill, qsKriterien: ['A'] })!.skills[0]!;
    expect(s.historie?.[0]?.qsKriterien).toEqual(['A']);
  });

  it('Diff meldet hinzugefuegte und entfernte Kriterien', () => {
    const d = diffSkillVersions(rec({ qsKriterien: ['A', 'B'] }), rec({ qsKriterien: ['B', 'C'] }));
    expect(d.qsKriterien).toEqual({ hinzu: ['C'], weg: ['A'] });
    expect(d.unveraendert).toBe(false);
  });

  it('fehlendes Feld auf beiden Seiten ist KEIN Unterschied (Alt-Snapshots)', () => {
    const d = diffSkillVersions(rec(), rec());
    expect(d.qsKriterien).toEqual({ hinzu: [], weg: [] });
    expect(d.unveraendert).toBe(true);
  });

  it('Rollback holt die Kriterien des Snapshots zurueck — nicht die neueren', () => {
    const alt = rec({ qsKriterien: ['Alt-Kriterium'] });
    const snap = appendHistorie(alt)[0]!;
    const neu = rec({ version: 2, qsKriterien: ['Neu-Kriterium'] });
    const zurueck = rollbackSkill(neu, snap, '2026-02-01T00:00:00.000Z');
    expect(zurueck.qsKriterien).toEqual(['Alt-Kriterium']);
  });

  it('Rollback auf einen Snapshot VOR der Einfuehrung raeumt die Kriterien ab', () => {
    const snap = appendHistorie(rec())[0]!; // feldfrei
    const zurueck = rollbackSkill(rec({ version: 2, qsKriterien: ['Neu'] }), snap, '2026-02-01T00:00:00.000Z');
    expect(zurueck.qsKriterien).toBeUndefined();
  });
});
