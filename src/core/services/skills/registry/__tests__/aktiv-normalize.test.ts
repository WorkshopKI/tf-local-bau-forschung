/**
 * Linchpin-Test des Aktivierungs-Gates: `normalizeSkill` baut den SkillRecord
 * feldweise neu (Whitelist). `aktiv` MUSS den normalize-Pfad überleben — sonst
 * ginge eine bewusste Deaktivierung (`aktiv: false`, z.B. ein Kurator sperrt einen
 * noch ungeprüften Skill) beim Laden verloren, bzw. eine UI-Aktivierung
 * (`aktiv: true` im Skill-Editor) würde beim nächsten Laden zurückfallen.
 */
import { describe, it, expect } from 'vitest';
import { normalizeRegistryFile } from '../storage';

const baseSkill = {
  id: 's1', name: 'S', beschreibung: '', version: 1, promptTemplate: 'P',
  regelIds: [], slots: [], modifiers: { neu: '', kuerzer: '', laenger: '' }, geaendert_am: 't',
};
const wrap = (skill: Record<string, unknown>) =>
  normalizeRegistryFile({ version: 1, updated_at: 't', skills: [skill], regeln: [] });

describe('normalizeSkill — aktiv-Gate', () => {
  it('übernimmt aktiv: false (Deaktivierung überlebt das Laden)', () => {
    expect(wrap({ ...baseSkill, aktiv: false })!.skills[0]!.aktiv).toBe(false);
  });

  it('übernimmt aktiv: true (UI-Freischaltung überlebt das Laden)', () => {
    expect(wrap({ ...baseSkill, aktiv: true })!.skills[0]!.aktiv).toBe(true);
  });

  it('ohne Feld → undefined (gilt als aktiv, Bestands-Skills unberührt)', () => {
    expect(wrap(baseSkill)!.skills[0]!.aktiv).toBeUndefined();
  });

  it('ignoriert nicht-boolesche aktiv-Werte', () => {
    expect(wrap({ ...baseSkill, aktiv: 'ja' })!.skills[0]!.aktiv).toBeUndefined();
  });
});
