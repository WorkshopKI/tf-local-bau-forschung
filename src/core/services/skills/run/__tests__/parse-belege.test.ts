import { describe, it, expect } from 'vitest';
import { parseSkillOutput } from '../parse';

// Finaler Text mit GENAU 3 Sätzen (Indizes 0,1,2) für die Bereichs-Validierung.
const FINAL = 'Das Vorhaben adressiert ein Problem. Ziel ist die Lösung. Der Ansatz nutzt Sensorik.';

function build(quellen: string): ReturnType<typeof parseSkillOutput> {
  return parseSkillOutput(`### Quellenanalyse\n${quellen}\n\n### Finaler Text\n${FINAL}`);
}

describe('parseSkillOutput — Quellen-Belege (Journey-Paket 4)', () => {
  it('ein Satz: „→ stützt Satz 2" → 0-basiert [1]', () => {
    const out = build('„Zitat A." (Abschn. 1.1) → stützt Satz 2');
    expect(out.belege).toHaveLength(1);
    expect(out.belege![0]!.satzIndizes).toEqual([1]);
    expect(out.belege![0]!.abschnittRef).toBe('1.1');
    expect(out.belege![0]!.zitat).toContain('Zitat A');
  });

  it('mehrere Sätze: „→ stützt Sätze 1, 3" → [0, 2]', () => {
    const out = build('„Zitat B." → stützt Sätze 1, 3');
    expect(out.belege![0]!.satzIndizes).toEqual([0, 2]);
  });

  it('akzeptiert Pfeil-Variante "->" und Plural', () => {
    const out = build('„Zitat D." -> stützt Sätze 2, 3');
    expect(out.belege![0]!.satzIndizes).toEqual([1, 2]);
  });

  it('toleriert nachgestellten Punkt (Form aus dem Template-Beispiel)', () => {
    const out = build('„Zitat A." (Abschn. 1.1) → stützt Satz 2.');
    expect(out.belege).toHaveLength(1);
    expect(out.belege![0]!.satzIndizes).toEqual([1]);
    expect(out.belege![0]!.abschnittRef).toBe('1.1');
  });

  it('toleriert Punkt hinter Plural-Referenz', () => {
    const out = build('„Zitat B." → stützt Sätze 1, 3.');
    expect(out.belege![0]!.satzIndizes).toEqual([0, 2]);
  });

  it('toleriert schließendes Anführungszeichen/Klammer nach der Satznummer', () => {
    const out = build('„Zitat C." → stützt Satz 3”');
    expect(out.belege![0]!.satzIndizes).toEqual([2]);
  });

  it('gemischte Zeilen: mit + ohne Suffix (ohne = „ohne Zuordnung")', () => {
    const out = build([
      '„Zitat A." (Abschn. 1.1) → stützt Satz 2',
      '„Zitat B." (Abschn. 1.2)',
    ].join('\n'));
    expect(out.belege).toHaveLength(2);
    expect(out.belege![0]!.satzIndizes).toEqual([1]);
    expect(out.belege![1]!.satzIndizes).toEqual([]);
    expect(out.belege![1]!.abschnittRef).toBe('1.2');
  });

  it('ungültiger/außerhalb liegender Index → satzIndizes []', () => {
    const out = build('„Zitat C." → stützt Satz 9');
    expect(out.belege).toHaveLength(1);
    expect(out.belege![0]!.satzIndizes).toEqual([]);
  });

  it('teils gültige, teils ungültige Indizes → nur die gültigen bleiben', () => {
    const out = build('„Zitat E." → stützt Sätze 1, 99');
    expect(out.belege![0]!.satzIndizes).toEqual([0]);
  });

  it('Alt-Format komplett ohne Referenzen → keine Belege (belege undefined)', () => {
    const out = build([
      '„Zitat A." (VB 2.1)',
      '„Zitat B." (VB 2.2)',
    ].join('\n'));
    expect(out.belege).toBeUndefined();
  });

  it('leere Quellenanalyse → keine Belege', () => {
    const out = parseSkillOutput(`### Finaler Text\n${FINAL}`);
    expect(out.belege).toBeUndefined();
  });

  it('lässt die flache quellenanalyse UNVERÄNDERT (Round-Trip, Rückwärtskompat)', () => {
    const quellen = '„Zitat A." (Abschn. 1.1) → stützt Satz 2';
    const out = build(quellen);
    expect(out.quellenanalyse).toBe(quellen);
  });
});
