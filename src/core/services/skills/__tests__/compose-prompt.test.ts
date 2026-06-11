import { describe, expect, it } from 'vitest';
import { composeSkillPrompt, buildTweakBlock, type SkillRunInput } from '../run-skill';
import { SEED_SKILL, SEED_REGELN, buildPromptVorgaben } from '@/core/services/skill-registry';

const VB = 'VB-MARKDOWN-INHALT';
const baseInput: SkillRunInput = { stammdaten: 'STAMMDATEN-BLOCK', vbMarkdown: VB };

const TWEAK_HEADING = '## Persönliche Stil-Präferenzen des Bearbeiters (heben die formalen Vorgaben nicht auf)';
const VORGABEN_HEADING = '## Formale Vorgaben';

function compose(input: SkillRunInput): string {
  return composeSkillPrompt(SEED_SKILL, SEED_REGELN, input, VB);
}

describe('buildTweakBlock', () => {
  it('liefert leeren String, wenn beide Felder leer/whitespace sind', () => {
    expect(buildTweakBlock('', '')).toBe('');
    expect(buildTweakBlock('   ', '\n\t ')).toBe('');
  });

  it('beide Felder → Heading + beide Labels', () => {
    const block = buildTweakBlock('Sachlich formulieren.', 'Eine Herausforderung …');
    expect(block).toContain(TWEAK_HEADING);
    expect(block).toContain('Stil: Sachlich formulieren.');
    expect(block).toContain('Beispiel-Formulierungen:');
    expect(block).toContain('Eine Herausforderung …');
  });

  it('nur Stil-Hinweise → nur die Stil-Zeile, kein Beispiel-Label', () => {
    const block = buildTweakBlock('Kurze Hauptsätze.', '');
    expect(block).toContain('Stil: Kurze Hauptsätze.');
    expect(block).not.toContain('Beispiel-Formulierungen:');
  });
});

describe('composeSkillPrompt', () => {
  it('füllt die Slots und hängt die Formalen Vorgaben an (ohne Tweak)', () => {
    const out = compose(baseInput);
    expect(out).toContain('STAMMDATEN-BLOCK');
    expect(out).toContain(VB);
    expect(out).toContain(VORGABEN_HEADING);
    expect(out).not.toContain('Persönliche Stil-Präferenzen');
  });

  it('inaktiver Tweak ist byte-identisch zum tweaklosen Lauf', () => {
    const base = compose(baseInput);
    const mitInaktiv = compose({
      ...baseInput,
      tweak: { aktiv: false, stilHinweise: 'Sachlich.', beispielFormulierungen: 'Beispiel …' },
    });
    expect(mitInaktiv).toBe(base);
  });

  it('aktiver Tweak mit leeren Feldern ist byte-identisch (kein Block)', () => {
    const base = compose(baseInput);
    const mitLeer = compose({
      ...baseInput,
      tweak: { aktiv: true, stilHinweise: '   ', beispielFormulierungen: '' },
    });
    expect(mitLeer).toBe(base);
  });

  it('aktiver Tweak: Block steht NACH dem Template und VOR den Formalen Vorgaben', () => {
    const out = compose({
      ...baseInput,
      tweak: { aktiv: true, stilHinweise: 'Sachlich.', beispielFormulierungen: 'Eine Herausforderung …' },
    });
    const iStamm = out.indexOf('STAMMDATEN-BLOCK');
    const iTweak = out.indexOf(TWEAK_HEADING);
    const iVorgaben = out.indexOf(VORGABEN_HEADING);
    expect(iStamm).toBeGreaterThanOrEqual(0);
    expect(iTweak).toBeGreaterThan(iStamm);
    expect(iVorgaben).toBeGreaterThan(iTweak);
    expect(out).toContain('Stil: Sachlich.');
    expect(out).toContain('Eine Herausforderung …');
  });

  it('volle Rangfolge mit Modifier + vorherigem Text: Template → Tweak → Vorgaben → Bisheriger → Zusätzliche Anweisung', () => {
    const out = compose({
      ...baseInput,
      tweak: { aktiv: true, stilHinweise: 'Sachlich.', beispielFormulierungen: '' },
      modifier: 'kuerzer',
      vorherigerText: 'FRUEHERER-TEXT',
    });
    const iTweak = out.indexOf(TWEAK_HEADING);
    const iVorgaben = out.indexOf(VORGABEN_HEADING);
    const iBisher = out.indexOf('## Bisheriger finaler Text (zur Überarbeitung)');
    const iAnweisung = out.indexOf('## Zusätzliche Anweisung');
    expect(iTweak).toBeGreaterThanOrEqual(0);
    expect(iVorgaben).toBeGreaterThan(iTweak);
    expect(iBisher).toBeGreaterThan(iVorgaben);
    expect(iAnweisung).toBeGreaterThan(iBisher);
    expect(out).toContain('FRUEHERER-TEXT');
    expect(out).toContain(SEED_SKILL.modifiers.kuerzer);
  });

  it('sehr lange Felder erzeugen einen wohlgeformten Block (kein Crash)', () => {
    const out = compose({
      ...baseInput,
      tweak: { aktiv: true, stilHinweise: 'A'.repeat(5000), beispielFormulierungen: 'B'.repeat(5000) },
    });
    expect(out).toContain(TWEAK_HEADING);
    expect(out.length).toBeGreaterThan(10000);
    // Formale Vorgaben bleiben auch bei langem Tweak danach erhalten.
    expect(out.indexOf(VORGABEN_HEADING)).toBeGreaterThan(out.indexOf(TWEAK_HEADING));
  });

  it('Konsistenz: der angehängte Vorgaben-Block entspricht buildPromptVorgaben', () => {
    const out = compose(baseInput);
    const vorgaben = buildPromptVorgaben(SEED_REGELN);
    expect(vorgaben).not.toBe('');
    expect(out).toContain(vorgaben);
  });
});

describe('composeSkillPrompt — {{vorherigeAbschnitte}}-Slot (Gutachten-Workflow)', () => {
  it('A bleibt byte-identisch: kein Platzhalter im Template → vorherigeAbschnitte wirkungslos', () => {
    const base = compose(baseInput);
    const mitSlot = compose({ ...baseInput, vorherigeAbschnitte: 'XXX-VORHERIGE-ABSCHNITTE' });
    expect(mitSlot).toBe(base);
    expect(mitSlot).not.toContain('XXX-VORHERIGE-ABSCHNITTE');
  });

  it('Template MIT Platzhalter wird gefüllt (bzw. leer, wenn nicht gesetzt)', () => {
    const skill = { ...SEED_SKILL, promptTemplate: 'Kontext:\n{{vorherigeAbschnitte}}\nEnde.' };
    const gefuellt = composeSkillPrompt(skill, [], { ...baseInput, vorherigeAbschnitte: 'ABSCHNITT-A-TEXT' }, VB);
    expect(gefuellt).toContain('ABSCHNITT-A-TEXT');
    const leer = composeSkillPrompt(skill, [], baseInput, VB);
    expect(leer).toContain('Kontext:\n\nEnde.');
    expect(leer).not.toContain('{{vorherigeAbschnitte}}');
  });
});
