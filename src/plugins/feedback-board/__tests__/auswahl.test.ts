/**
 * Guard für die Mehrfachauswahl. Zwei Regeln tragen hier die Last:
 * die Auswahl darf nichts enthalten, was niemand mehr sieht, und eine
 * Ziehbewegung muss vorhersagbar sein.
 */
import { describe, expect, it } from 'vitest';
import { beschraenkeAuf, LEERE_AUSWAHL, schalte, schalteAlle, zuBewegen } from '../auswahl';

describe('schalte', () => {
  it('nimmt auf und wieder weg', () => {
    const eins = schalte(LEERE_AUSWAHL, 'A');
    expect([...eins]).toEqual(['A']);
    expect([...schalte(eins, 'A')]).toEqual([]);
  });
});

describe('beschraenkeAuf', () => {
  it('wirft raus, was nicht mehr sichtbar ist', () => {
    const a = new Set(['A', 'B', 'C']);
    expect([...beschraenkeAuf(a, ['A', 'C'])].sort()).toEqual(['A', 'C']);
  });

  // Ohne diese Identität entstünde bei jedem Render eine neue Menge — der
  // Effekt, der das aufruft, liefe endlos.
  it('liefert dieselbe Menge zurück, wenn nichts entfällt', () => {
    const a = new Set(['A', 'B']);
    expect(beschraenkeAuf(a, ['A', 'B', 'C'])).toBe(a);
  });

  it('lässt eine leere Auswahl unangetastet', () => {
    expect(beschraenkeAuf(LEERE_AUSWAHL, ['A'])).toBe(LEERE_AUSWAHL);
  });
});

describe('schalteAlle', () => {
  it('wählt alle Sichtbaren — und beim zweiten Mal keinen', () => {
    const alle = schalteAlle(LEERE_AUSWAHL, ['A', 'B']);
    expect([...alle].sort()).toEqual(['A', 'B']);
    expect([...schalteAlle(alle, ['A', 'B'])]).toEqual([]);
  });

  it('ergänzt, wenn erst ein Teil gewählt ist', () => {
    expect([...schalteAlle(new Set(['A']), ['A', 'B'])].sort()).toEqual(['A', 'B']);
  });
});

describe('zuBewegen', () => {
  it('nimmt die ganze Auswahl mit, wenn die gezogene Karte dazugehört', () => {
    expect(zuBewegen(new Set(['A', 'B']), 'A').sort()).toEqual(['A', 'B']);
  });

  // Wer eine unmarkierte Karte zieht, meint sie — alles andere überrascht.
  it('bewegt nur die gezogene Karte, wenn sie nicht markiert ist', () => {
    expect(zuBewegen(new Set(['A', 'B']), 'C')).toEqual(['C']);
  });

  it('kommt ohne Auswahl aus', () => {
    expect(zuBewegen(LEERE_AUSWAHL, 'A')).toEqual(['A']);
  });
});
