import { describe, it, expect } from 'vitest';
import { normalizeRegistryFile } from '../storage';
import { getSkillById, resolveRegeln, skillsUsingRegel, describeRegelParams } from '../selectors';
import { SEED_REGISTRY, SEED_SKILL, KURZFASSUNG_SKILL_ID } from '../seed';
import { runRegelChecks } from '../check-engine';
import type { QualitaetsRegel } from '../types';

describe('normalizeRegistryFile — tolerantes Lesen', () => {
  it('akzeptiert eine gültige Datei und behält bekannte + unbekannte Typen', () => {
    const raw = {
      version: 1,
      updated_at: '2026-06-11T10:00:00.000Z',
      skills: [{ id: 's1', name: 'Skill', regelIds: ['r1', 'r2'], slots: ['stammdaten'] }],
      regeln: [
        { id: 'r1', typ: 'zeichen_max', params: { max: 800 }, schweregrad: 'fehler' },
        { id: 'r2', typ: 'zukunfts_typ', params: { foo: 1 } }, // unbekannt → behalten
      ],
    };
    const file = normalizeRegistryFile(raw)!;
    expect(file).not.toBeNull();
    expect(file.skills).toHaveLength(1);
    expect(file.regeln).toHaveLength(2);
    // Defaults: fehlende Felder ergänzt
    expect(file.skills[0]!.version).toBe(1);
    expect(file.skills[0]!.modifiers).toEqual({ neu: '', kuerzer: '', laenger: '' });
    expect(file.regeln[1]!.typ).toBe('zukunfts_typ'); // unbekannt, nicht verworfen
    expect(file.regeln[1]!.aktiv).toBe(true); // default
  });

  it('verwirft strukturell ungültige Dateien (Version, Arrays)', () => {
    expect(normalizeRegistryFile({ version: 2, skills: [], regeln: [] })).toBeNull();
    expect(normalizeRegistryFile({ version: 1, skills: 'nope', regeln: [] })).toBeNull();
    expect(normalizeRegistryFile(null)).toBeNull();
  });

  it('lässt Skills/Regeln ohne id fallen', () => {
    const file = normalizeRegistryFile({
      version: 1,
      skills: [{ name: 'kein id' }, { id: 'ok' }],
      regeln: [{ typ: 'zeichen_max' }, { id: 'r', typ: 'zeichen_max' }],
    })!;
    expect(file.skills.map(s => s.id)).toEqual(['ok']);
    expect(file.regeln.map(r => r.id)).toEqual(['r']);
  });
});

describe('Selektoren', () => {
  it('getSkillById + resolveRegeln (Reihenfolge, fehlende IDs ausgelassen)', () => {
    const skill = getSkillById(SEED_REGISTRY, KURZFASSUNG_SKILL_ID)!;
    expect(skill).toBeDefined();
    const regeln = resolveRegeln(SEED_REGISTRY, skill);
    expect(regeln.map(r => r.id)).toEqual(SEED_SKILL.regelIds);
  });

  it('resolveRegeln überspringt nicht vorhandene IDs', () => {
    const file = { ...SEED_REGISTRY, skills: [{ ...SEED_SKILL, regelIds: ['seed-satzanzahl', 'gibt-es-nicht'] }] };
    expect(resolveRegeln(file, file.skills[0]!).map(r => r.id)).toEqual(['seed-satzanzahl']);
  });

  it('skillsUsingRegel berechnet „verwendet in"', () => {
    expect(skillsUsingRegel(SEED_REGISTRY, 'seed-satzanzahl')).toEqual([SEED_SKILL.name]);
    expect(skillsUsingRegel(SEED_REGISTRY, 'unbenutzt')).toEqual([]);
  });

  it('describeRegelParams liefert Kurzformen', () => {
    const r = (typ: string, params: Record<string, unknown>): QualitaetsRegel => ({
      id: 'x', name: 'x', typ, params, schweregrad: 'fehler', aktiv: true, erstellt_am: 't', geaendert_am: 't',
    });
    expect(describeRegelParams(r('zeichen_max', { max: 1000 }))).toBe('max 1000 Zeichen');
    expect(describeRegelParams(r('satzanzahl', { min: 8, max: 12 }))).toBe('8–12 Sätze');
    expect(describeRegelParams(r('zukunfts_typ', {}))).toBe('unbekannter Typ');
  });
});

describe('Seed', () => {
  it('enthält die Gutachten-Skills A–G + zusammenpassende Regeln', () => {
    // A (Kurzfassung) + B–G = 7 Skills; 5 A-Regeln + 7 B–G-Regeln = 12 Regeln.
    expect(SEED_REGISTRY.skills).toHaveLength(7);
    expect(SEED_REGISTRY.regeln).toHaveLength(12);
    const skill = SEED_REGISTRY.skills[0]!; // A = Kurzfassung
    expect(skill.id).toBe('gutachten-kurzfassung');
    // Jede regelId JEDES Skills existiert in der Regel-Bibliothek:
    for (const s of SEED_REGISTRY.skills) {
      for (const id of s.regelIds) {
        expect(SEED_REGISTRY.regeln.find(r => r.id === id)).toBeDefined();
      }
    }
    expect(skill.systemPrompt).toBeTruthy();
    expect(skill.slots).toContain('vbMarkdown');
  });

  it('die Seed-Regeln laufen sauber über einen Beispieltext', () => {
    const skill = SEED_REGISTRY.skills[0]!;
    const regeln = resolveRegeln(SEED_REGISTRY, skill);
    const results = runRegelChecks('Das Vorhaben entwickelt ein Verfahren. Es überwacht Prozesse dezentral.', regeln);
    // 5 aktive Regeln → 5 Ergebnisse, jedes mit regelId
    expect(results).toHaveLength(5);
    expect(results.every(r => typeof r.regelId === 'string')).toBe(true);
  });
});
