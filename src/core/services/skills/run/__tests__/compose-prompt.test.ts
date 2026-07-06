import { describe, expect, it } from 'vitest';
import { composeSkillPrompt, buildTweakBlock, type SkillRunInput } from '../run-skill';
import { SEED_SKILL, SEED_REGELN, buildPromptVorgaben } from '@/core/services/skills';

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

describe('composeSkillPrompt — regel-gebundene Zusatz-Anweisung (Journey-Paket 3)', () => {
  const ZUSATZ = 'Kürze auf höchstens 1000 Zeichen; aktuell 1117.';

  it('ohne zusatzAnweisung: byte-identisch zum Lauf ohne (Regressionsschutz)', () => {
    const base = compose({ ...baseInput, modifier: 'kuerzer', vorherigerText: 'X' });
    const wieder = compose({ ...baseInput, modifier: 'kuerzer', vorherigerText: 'X' });
    expect(wieder).toBe(base);
    expect(base).not.toContain('Zusätzliche Vorgabe:');
  });

  it('mit zusatzAnweisung: die Vorgabe-Zeile steht NACH dem Modifier-Block', () => {
    const out = compose({ ...baseInput, modifier: 'kuerzer', vorherigerText: 'X', zusatzAnweisung: ZUSATZ });
    const iModifier = out.indexOf('## Zusätzliche Anweisung');
    const iVorgabe = out.indexOf('Zusätzliche Vorgabe:');
    expect(iModifier).toBeGreaterThanOrEqual(0);
    expect(iVorgabe).toBeGreaterThan(iModifier);
    expect(out).toContain(`Zusätzliche Vorgabe: ${ZUSATZ}`);
  });

  it('leere/whitespace zusatzAnweisung ist No-op', () => {
    const base = compose({ ...baseInput, modifier: 'kuerzer' });
    const leer = compose({ ...baseInput, modifier: 'kuerzer', zusatzAnweisung: '   ' });
    expect(leer).toBe(base);
  });

  it('zusatzAnweisung wirkt auch ohne Modifier (additive Vorgabe-Zeile, nach den Vorgaben)', () => {
    const base = compose(baseInput);
    const mit = compose({ ...baseInput, zusatzAnweisung: ZUSATZ });
    expect(mit).not.toBe(base);
    expect(mit).toContain(`Zusätzliche Vorgabe: ${ZUSATZ}`);
    expect(mit.indexOf('Zusätzliche Vorgabe:')).toBeGreaterThan(mit.indexOf(VORGABEN_HEADING));
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

describe('composeSkillPrompt — Relevanz-Map-Slot {{vbRelevant}}', () => {
  it('Bestands-Skill bleibt byte-identisch: kein Platzhalter → vbRelevant wirkungslos', () => {
    const base = compose(baseInput);
    const mitSlot = compose({ ...baseInput, vbRelevant: 'XXX-RELEVANTE-SEKTIONEN' });
    expect(mitSlot).toBe(base);
    expect(mitSlot).not.toContain('XXX-RELEVANTE-SEKTIONEN');
  });

  it('Template MIT Platzhalter wird gefüllt (bzw. leer, wenn nicht gesetzt)', () => {
    const skill = { ...SEED_SKILL, promptTemplate: 'Relevant:\n{{vbRelevant}}\nEnde.' };
    const gefuellt = composeSkillPrompt(skill, [], { ...baseInput, vbRelevant: 'NUR-DIE-RELEVANTEN' }, VB);
    expect(gefuellt).toContain('NUR-DIE-RELEVANTEN');
    const leer = composeSkillPrompt(skill, [], baseInput, VB);
    expect(leer).toContain('Relevant:\n\nEnde.');
    expect(leer).not.toContain('{{vbRelevant}}');
  });
});

describe('composeSkillPrompt — LLM-QS-Slots {{zielText}} / {{abschnittszweck}}', () => {
  it('Bestands-Skill bleibt byte-identisch: kein Platzhalter → zielText/abschnittszweck wirkungslos', () => {
    const base = compose(baseInput);
    const mitSlots = compose({ ...baseInput, zielText: 'XXX-ZIELTEXT', abschnittszweck: 'XXX-ZWECK' });
    expect(mitSlots).toBe(base);
    expect(mitSlots).not.toContain('XXX-ZIELTEXT');
    expect(mitSlots).not.toContain('XXX-ZWECK');
  });

  it('QS-Template mit Platzhaltern wird gefüllt (bzw. leer, wenn nicht gesetzt)', () => {
    const skill = { ...SEED_SKILL, promptTemplate: 'Zweck: {{abschnittszweck}}\nText: {{zielText}}\nEnde.' };
    const gefuellt = composeSkillPrompt(skill, [], { ...baseInput, zielText: 'ABSCHNITT-X', abschnittszweck: 'Markt' }, VB);
    expect(gefuellt).toContain('Zweck: Markt');
    expect(gefuellt).toContain('Text: ABSCHNITT-X');
    const leer = composeSkillPrompt(skill, [], baseInput, VB);
    expect(leer).toContain('Zweck: \nText: \nEnde.');
    expect(leer).not.toContain('{{zielText}}');
    expect(leer).not.toContain('{{abschnittszweck}}');
  });
});

describe('composeSkillPrompt — strukturierte Ausgabe (teilStruktur)', () => {
  const STRUKTUR_HEADING = '## Ausgabe des „Finaler Text"-Blocks (strukturiert)';

  it('ohne teilStruktur: kein Struktur-Block (byte-identisch zu heute)', () => {
    // SEED_SKILL trägt seit der A-Aktivierung selbst teilStruktur → für diesen
    // Pfad explizit strippen.
    const ohne = { ...SEED_SKILL, teilStruktur: undefined };
    expect(composeSkillPrompt(ohne, SEED_REGELN, baseInput, VB)).not.toContain(STRUKTUR_HEADING);
  });

  it('mit teilStruktur: hängt den autoritativen JSON-Override-Block mit allen Keys an', () => {
    const skill = {
      ...SEED_SKILL,
      teilStruktur: [{ key: 'hintergrund', label: 'Hintergrund' }, { key: 'loesungsweg', label: 'Lösungsweg' }],
      teilJoin: '\n\n' as const,
    };
    const out = composeSkillPrompt(skill, SEED_REGELN, baseInput, VB);
    expect(out).toContain(STRUKTUR_HEADING);
    // Beispiel-Array nennt GENAU die deklarierten Keys.
    expect(out).toContain('{"key":"hintergrund","text":"…"}');
    expect(out).toContain('{"key":"loesungsweg","text":"…"}');
    // Labels als Inhalts-Hinweis (Mapping), nicht im JSON-Beispiel.
    expect(out).toContain('`hintergrund`: Hintergrund');
    // Der Struktur-Block steht NACH den formalen Vorgaben (Instruktions-Vorrang).
    expect(out.indexOf(STRUKTUR_HEADING)).toBeGreaterThan(out.indexOf(VORGABEN_HEADING));
  });

  it('leere teilStruktur-Liste ist No-op (kein Block)', () => {
    const skill = { ...SEED_SKILL, teilStruktur: [] };
    expect(composeSkillPrompt(skill, SEED_REGELN, baseInput, VB)).not.toContain(STRUKTUR_HEADING);
  });
});
