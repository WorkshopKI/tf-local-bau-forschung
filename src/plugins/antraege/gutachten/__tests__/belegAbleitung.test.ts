import { describe, it, expect } from 'vitest';
import { extrahiereZitate, ordneSaetzeZu, tokenSet } from '../belegAbleitung';

// Vier klar getrennte Sätze (Indizes 0..3), am TragMentor-Beispiel aus dem Screenshot.
const FINAL = [
  'Das Vorhaben entwickelt das digitale Tool TragMentor als KI-gestützten Mentor für die Tragwerksplanung.',
  'Dazu erstellt das Projekt eine fachspezifische Ontologie aus Bauplänen und BIM-Daten.',
  'Nach Projektende ermöglicht TragMentor 35 % schnellere Berechnungen und erkennt über 90 % der Fehler.',
  'Das Tool wird in deutschen Ingenieurbüros des Bauhauptgewerbes eingesetzt.',
].join(' ');

describe('belegAbleitung — extrahiereZitate', () => {
  it('trennt Zitat + Fundstelle im „VB, Abschnitt N"-Format (internes Modell)', () => {
    const z = extrahiereZitate('- „Ziel ist die Entwicklung eines digitalen Mentors (TragMentor)" – VB, Abschnitt 2.');
    expect(z).toHaveLength(1);
    expect(z[0]!.abschnittRef).toBe('2');
    expect(z[0]!.zitat).toContain('TragMentor');
    expect(z[0]!.zitat).not.toContain('Abschnitt');
  });

  it('trennt Fundstelle im „(Abschn. x.y)"-Format', () => {
    const z = extrahiereZitate('„Auslese-Pipeline in die Ontologie überführt" (Abschn. 6.2)');
    expect(z[0]!.abschnittRef).toBe('6.2');
    expect(z[0]!.zitat).not.toContain('Abschn');
  });

  it('überspringt Zeilen ohne Anführungszeichen (Überschriften/Fließtext)', () => {
    const z = extrahiereZitate('Antragsbezug:\n„echtes Zitat"\nkein Zitat hier');
    expect(z).toHaveLength(1);
    expect(z[0]!.zitat).toContain('echtes Zitat');
  });
});

describe('belegAbleitung — ordneSaetzeZu', () => {
  it('ordnet ein Zitat dem Satz mit der größten Wortüberlappung zu', () => {
    const belege = ordneSaetzeZu(
      [{ zitat: 'Ziel ist die Entwicklung eines digitalen Mentors für die Tragwerksplanung (TragMentor)', abschnittRef: '2' }],
      FINAL,
    );
    expect(belege[0]!.satzIndizes).toEqual([0]);
    expect(belege[0]!.abgeleitet).toBe(true);
    expect(belege[0]!.abschnittRef).toBe('2');
  });

  it('nutzt Zahlen als diskriminierende Tokens (35 %, 90 %)', () => {
    const belege = ordneSaetzeZu(
      [{ zitat: 'um 35 % schnellere Berechnungen und über 90 % der Fehler erkannt' }],
      FINAL,
    );
    expect(belege[0]!.satzIndizes).toEqual([2]);
  });

  it('lässt generische Zitate ohne hinreichende Überlappung ehrlich unzugeordnet', () => {
    const belege = ordneSaetzeZu(
      [{ zitat: 'Das Konsortium besteht aus mehreren Partnern' }],
      FINAL,
    );
    expect(belege[0]!.satzIndizes).toEqual([]);
    expect(belege[0]!.abgeleitet).toBe(true);
  });

  it('braucht mindestens zwei gemeinsame Tokens (ein einzelner Treffer reicht nicht)', () => {
    // „tool" allein kommt in mehreren Sätzen vor → unter Schwelle, keine Zuordnung.
    const belege = ordneSaetzeZu([{ zitat: 'irgendein Tool' }], FINAL);
    expect(belege[0]!.satzIndizes).toEqual([]);
  });
});

describe('belegAbleitung — tokenSet', () => {
  it('lowercased, ohne Stoppwörter, Zahlen bleiben', () => {
    const t = tokenSet('Die Entwicklung um 35 % für die Tragwerksplanung');
    expect(t.has('entwicklung')).toBe(true);
    expect(t.has('tragwerksplanung')).toBe(true);
    expect(t.has('35')).toBe(true);
    expect(t.has('die')).toBe(false);
    expect(t.has('für')).toBe(false);
  });
});
