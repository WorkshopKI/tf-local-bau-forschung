/**
 * Tests für das strukturierte Feedback-Typ-Formular (v2.41):
 *  - composeFeedbackText baut lesbaren Fließtext aus den Feldwerten,
 *  - FEEDBACK_TYPES hat genau EIN Pflichtfeld pro Typ,
 *  - jede sichtbare Kategorie ist durch einen Typ abgedeckt.
 */
import { describe, expect, it } from 'vitest';
import { FEEDBACK_TYPES, composeFeedbackText, type FeedbackTypeDef } from '../constants';

function typeFor(category: string): FeedbackTypeDef {
  const t = FEEDBACK_TYPES.find(t => t.category === category);
  if (!t) throw new Error(`kein Typ für ${category}`);
  return t;
}

describe('FEEDBACK_TYPES', () => {
  it('hat genau ein Pflichtfeld pro Typ', () => {
    for (const t of FEEDBACK_TYPES) {
      const required = t.fields.filter(f => f.required);
      expect(required, `Typ ${t.category}`).toHaveLength(1);
    }
  });

  it('deckt die sponsorbaren + Freitext-Kategorien ab', () => {
    const cats = FEEDBACK_TYPES.map(t => t.category).sort();
    expect(cats).toEqual(['idea', 'praise', 'problem', 'question']);
  });
});

describe('composeFeedbackText', () => {
  it('Bug: rendert Label + Wert je Feld, lässt leere Felder weg', () => {
    const text = composeFeedbackText(typeFor('problem'), {
      steps: 'Suche geöffnet',
      actual: 'Nichts passiert',
      expected: '',
    });
    expect(text).toContain('Was hast du gemacht?\nSuche geöffnet');
    expect(text).toContain('Was ist passiert?\nNichts passiert');
    expect(text).not.toContain('Was hättest du erwartet?');
    // Blöcke mit Leerzeile getrennt
    expect(text.split('\n\n')).toHaveLength(2);
  });

  it('Feature: nur das gefüllte Pflichtfeld', () => {
    const text = composeFeedbackText(typeFor('idea'), { goal: 'PDF exportieren' });
    expect(text).toBe('Was möchtest du tun können?\nPDF exportieren');
  });

  it('Feature: alle drei Felder mit Label-Präfix', () => {
    const text = composeFeedbackText(typeFor('idea'), {
      goal: 'Direkt-Button',
      reason: 'Zu viele Klicks',
      idea: 'Oben rechts platzieren',
    });
    expect(text).toContain('Was möchtest du tun können?\nDirekt-Button');
    expect(text).toContain('Warum / in welcher Situation brauchst du das?\nZu viele Klicks');
    expect(text).toContain('Wie stellst du es dir vor?\nOben rechts platzieren');
  });

  it('Ein-Feld-Typen (Lob/Frage): reiner Feldwert ohne Label-Präfix', () => {
    expect(composeFeedbackText(typeFor('praise'), { text: 'Tolle App' })).toBe('Tolle App');
    expect(composeFeedbackText(typeFor('question'), { text: 'Wie exportiere ich?' })).toBe('Wie exportiere ich?');
  });

  it('trimmt Whitespace und ignoriert reine Leer-Eingaben', () => {
    const text = composeFeedbackText(typeFor('problem'), {
      steps: '   ',
      actual: '  Fehler  ',
    });
    expect(text).toBe('Was ist passiert?\nFehler');
  });
});
