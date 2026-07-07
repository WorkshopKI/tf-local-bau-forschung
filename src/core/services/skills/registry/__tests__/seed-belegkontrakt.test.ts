import { describe, it, expect } from 'vitest';
import {
  SEED_SKILL,
  SEED_SKILLS_BG,
  AUSGANGSLAGE_SKILL_ID,
  KURZFASSUNG_SKILL_ID,
  buildKurzfassungPrompt,
} from '../seed';

const MARKE = '→ stützt Satz';

describe('Beleg-Kontrakt in Seed A + B (Journey-Paket 4, Phase 4)', () => {
  it('A (Kurzfassung) trägt die Satz-Referenz-Instruktion + version 2', () => {
    expect(SEED_SKILL.id).toBe(KURZFASSUNG_SKILL_ID);
    expect(SEED_SKILL.promptTemplate).toContain(MARKE);
    expect(SEED_SKILL.version).toBe(2);
  });

  it('B (Ausgangslage) trägt die Instruktion + version 2', () => {
    const b = SEED_SKILLS_BG.find(s => s.id === AUSGANGSLAGE_SKILL_ID);
    expect(b).toBeDefined();
    expect(b!.promptTemplate).toContain(MARKE);
    expect(b!.version).toBe(2);
  });

  it('C–G bleiben ohne Instruktion + version 1 (byte-identisch)', () => {
    const uebrige = SEED_SKILLS_BG.filter(s => s.id !== AUSGANGSLAGE_SKILL_ID);
    expect(uebrige.length).toBeGreaterThan(0);
    for (const s of uebrige) {
      expect(s.promptTemplate, s.id).not.toContain('stützt');
      expect(s.version, s.id).toBe(1);
    }
  });

  it('buildKurzfassungPrompt: false ohne, true mit Instruktion (Migrations-Alt/Neu)', () => {
    const alt = buildKurzfassungPrompt(false);
    const neu = buildKurzfassungPrompt(true);
    expect(alt).not.toContain('stützt');
    expect(neu).toContain(MARKE);
    // Der Neu-Stand ist der Alt-Stand PLUS Zusatz (kein anderer Umbau).
    expect(neu.length).toBeGreaterThan(alt.length);
    expect(SEED_SKILL.promptTemplate).toBe(neu);
  });
});
