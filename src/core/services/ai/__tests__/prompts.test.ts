import { describe, expect, it } from 'vitest';
import { PROMPTS, buildArtifactPrompt } from '../prompts';

describe('PROMPTS', () => {
  it('enthält alle Bauantrag-Templates', () => {
    expect(PROMPTS).toHaveProperty('nachforderung');
    expect(PROMPTS).toHaveProperty('email');
    expect(PROMPTS).toHaveProperty('gutachten');
    expect(PROMPTS).toHaveProperty('pruefbericht');
    expect(PROMPTS).toHaveProperty('bewilligung');
  });

  it('enthält die Forschungsförderungs-Templates', () => {
    expect(PROMPTS).toHaveProperty('foerderung_gutachten');
    expect(PROMPTS).toHaveProperty('foerderung_bewilligung');
    expect(PROMPTS).toHaveProperty('foerderung_nachbesserung');
  });

  it('alle Werte sind nicht-leere Strings', () => {
    for (const [key, value] of Object.entries(PROMPTS)) {
      expect(typeof value, `PROMPTS.${key} muss string sein`).toBe('string');
      expect(value.length, `PROMPTS.${key} muss nicht leer sein`).toBeGreaterThan(0);
    }
  });
});

describe('buildArtifactPrompt', () => {
  it('hängt Kontext mit Trenner an System-Prompt', () => {
    const out = buildArtifactPrompt('nachforderung', 'Antrag X fehlt Anhang Y');
    expect(out).toContain(PROMPTS.nachforderung);
    expect(out).toContain('Antrag X fehlt Anhang Y');
    expect(out).toContain('---');
    expect(out).toContain('Kontext:');
  });

  it('Reihenfolge: System-Prompt zuerst, dann Trenner, dann Kontext', () => {
    const out = buildArtifactPrompt('email', 'Bitte um Rückmeldung');
    const promptIdx = out.indexOf(PROMPTS.email!);
    const sepIdx = out.indexOf('---');
    const ctxIdx = out.indexOf('Bitte um Rückmeldung');
    expect(promptIdx).toBeLessThan(sepIdx);
    expect(sepIdx).toBeLessThan(ctxIdx);
  });

  it('fällt auf email-Prompt zurück bei unbekanntem Typ', () => {
    const out = buildArtifactPrompt('unbekannter-typ', 'Kontext');
    expect(out).toContain(PROMPTS.email);
  });

  it('toleriert leeren Kontext', () => {
    const out = buildArtifactPrompt('email', '');
    expect(out).toContain(PROMPTS.email);
    expect(out).toContain('Kontext:');
  });
});
