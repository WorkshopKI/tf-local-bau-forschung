import { describe, it, expect } from 'vitest';
import { istGueltigesRegex, markiereTreffer } from '../MusterErkennungEditor';
import { erkennungsEintraege } from '@/core/services/skills';

describe('istGueltigesRegex — Silent-Fail-Schutz für den Regex-Modus', () => {
  it('akzeptiert gültige Ausdrücke', () => {
    expect(istGueltigesRegex('\\bAP\\s?\\d+')).toBe(true);
    expect(istGueltigesRegex('foo')).toBe(true);
  });
  it('verwirft ungültige Ausdrücke', () => {
    expect(istGueltigesRegex('(unbalanced')).toBe(false);
    expect(istGueltigesRegex('a{2,1}')).toBe(false);
  });
});

describe('markiereTreffer — nutzt erkennungsEintraege als EINE Quelle', () => {
  const synonym = erkennungsEintraege({
    eingabeModus: 'synonym',
    gruppen: [{ stamm: 'Der Antragsteller', varianten: ['plant', 'beabsichtigt'] }],
  });

  it('Round-Trip: Synonym-Gruppe markiert den Treffer im Beispieltext', () => {
    const r = markiereTreffer('Der Antragsteller plant eine Lösung.', synonym);
    expect(r.anzahl).toBe(1);
    expect(r.segmente.filter(s => s.treffer).map(s => s.text).join('')).toBe('Der Antragsteller plant');
    // Segmente rekonstruieren den vollständigen Text lückenlos.
    expect(r.segmente.map(s => s.text).join('')).toBe('Der Antragsteller plant eine Lösung.');
  });

  it('keine Treffer → ein Nicht-Treffer-Segment, anzahl 0', () => {
    const r = markiereTreffer('Das Vorhaben verfolgt ein Ziel.', synonym);
    expect(r.anzahl).toBe(0);
    expect(r.segmente).toEqual([{ text: 'Das Vorhaben verfolgt ein Ziel.', treffer: false }]);
  });

  it('leerer Text → leere Segmente', () => {
    expect(markiereTreffer('', synonym)).toEqual({ segmente: [], anzahl: 0 });
  });

  it('überlappende Treffer werden zu EINEM Span zusammengefasst', () => {
    const eintr = erkennungsEintraege({ muster: ['Antragsteller plant', 'plant eine'], istRegex: false });
    const r = markiereTreffer('Der Antragsteller plant eine Lösung.', eintr);
    expect(r.anzahl).toBe(1);
    expect(r.segmente.filter(s => s.treffer).map(s => s.text).join('')).toBe('Antragsteller plant eine');
    expect(r.segmente.map(s => s.text).join('')).toBe('Der Antragsteller plant eine Lösung.');
  });

  it('ungültige Regex (Literal-Fallback) → kein Throw', () => {
    const bad = erkennungsEintraege({ eingabeModus: 'regex', muster: ['(unbalanced'] });
    expect(() => markiereTreffer('text mit (unbalanced hier', bad)).not.toThrow();
    expect(markiereTreffer('text mit (unbalanced hier', bad).anzahl).toBe(1);
  });
});
