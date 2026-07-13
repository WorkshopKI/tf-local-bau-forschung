import { describe, it, expect } from 'vitest';
import {
  SEED_SKILL,
  SEED_SKILLS_BG,
  AUSGANGSLAGE_SKILL_ID,
  KURZFASSUNG_SKILL_ID,
  RISIKEN_SKILL_ID,
  buildKurzfassungPrompt,
} from '../seed';

const MARKE = '→ stützt Satz';

// Rückbau (2026-07): der Beleg→Satz-Marker-Kontrakt (Journey-Paket 4) ist aus den live
// A/B-Skills entfernt — das interne Modell lief damit in einen Reasoning-Loop. Der
// Quellenbezug wird jetzt rein deterministisch abgeleitet (belegAbleitung.ts). Der
// `buildKurzfassungPrompt(true)`-Zweig bleibt NUR für die Rückbau-Migrations-Erkennung.
describe('Beleg-Kontrakt in Seed A + B — zurückgebaut', () => {
  it('A (Kurzfassung) trägt die Satz-Referenz-Instruktion NICHT mehr; = Alt-Template', () => {
    expect(SEED_SKILL.id).toBe(KURZFASSUNG_SKILL_ID);
    expect(SEED_SKILL.promptTemplate).not.toContain('stützt');
    expect(SEED_SKILL.promptTemplate).toBe(buildKurzfassungPrompt(false));
    expect(SEED_SKILL.version).toBe(2);
  });

  it('B (Ausgangslage) trägt die Instruktion NICHT mehr', () => {
    const b = SEED_SKILLS_BG.find(s => s.id === AUSGANGSLAGE_SKILL_ID);
    expect(b).toBeDefined();
    expect(b!.promptTemplate).not.toContain('stützt');
    expect(b!.version).toBe(2);
  });

  it('C–G tragen die Beleg→Satz-Instruktion NICHT; D–G bleiben version 1, C ist v2', () => {
    const uebrige = SEED_SKILLS_BG.filter(s => s.id !== AUSGANGSLAGE_SKILL_ID);
    expect(uebrige.length).toBeGreaterThan(0);
    for (const s of uebrige) {
      expect(s.promptTemplate, s.id).not.toContain('stützt');
    }
    // D–G unverändert bei version 1; C ist bewusst v2 (Entwurf → gefilterter Fließtext —
    // eigener Umbau, NICHT der Beleg-Kontrakt).
    for (const s of uebrige.filter(s => s.id !== RISIKEN_SKILL_ID)) {
      expect(s.version, s.id).toBe(1);
    }
    expect(SEED_SKILLS_BG.find(s => s.id === RISIKEN_SKILL_ID)?.version).toBe(2);
  });

  it('buildKurzfassungPrompt: false ohne, true mit Instruktion (nur noch Migrations-Erkennung)', () => {
    const alt = buildKurzfassungPrompt(false);
    const neu = buildKurzfassungPrompt(true);
    expect(alt).not.toContain('stützt');
    expect(neu).toContain(MARKE);
    // Der Kontrakt-Stand ist der Alt-Stand PLUS Zusatz (kein anderer Umbau).
    expect(neu.length).toBeGreaterThan(alt.length);
    // Live-Skill nutzt den Alt-Stand (Rückbau), NICHT den Kontrakt-Stand.
    expect(SEED_SKILL.promptTemplate).toBe(alt);
  });
});
