/**
 * Direkte Unit-Tests der geteilten toleranten JSON-Utility (extrahiert aus
 * llm-klassifizierung.ts). Die klassifizierungs-spezifischen Tests von
 * `parseLLMResponse` bleiben am Ort (Regressions-Guard, dass die Extraktion das
 * Verhalten nicht verändert hat).
 */
import { describe, it, expect } from 'vitest';
import { parseJsonArrayTolerant, stripMarkdownWrapper } from '../json-tolerant';

describe('stripMarkdownWrapper', () => {
  it('entfernt ```json-Fence', () => {
    expect(stripMarkdownWrapper('```json\n[{"a":1}]\n```')).toBe('[{"a":1}]');
  });

  it('entfernt nackten ```-Fence', () => {
    expect(stripMarkdownWrapper('```\n[1,2]\n```')).toBe('[1,2]');
  });

  it('lässt Text ohne Fence unverändert', () => {
    expect(stripMarkdownWrapper('[{"a":1}]')).toBe('[{"a":1}]');
  });
});

describe('parseJsonArrayTolerant', () => {
  it('Happy Path: vollständiges Array', () => {
    expect(parseJsonArrayTolerant('[{"k":"a"},{"k":"b"}]')).toEqual([{ k: 'a' }, { k: 'b' }]);
  });

  it('rettet vollständige Objekte bei abgeschnittenem letztem Objekt (Truncation)', () => {
    // Letztes Objekt mitten im String abgeschnitten, keine schließende ].
    const out = parseJsonArrayTolerant('[{"k":"a","t":"x"},{"k":"b","t":"abge');
    expect(out).toEqual([{ k: 'a', t: 'x' }]);
  });

  it('rettet vollständiges Objekt bei Abbruch direkt nach Komma', () => {
    const out = parseJsonArrayTolerant('[{"k":"a"},{');
    expect(out).toEqual([{ k: 'a' }]);
  });

  it('escapte Anführungszeichen im String brechen den Walker nicht', () => {
    const out = parseJsonArrayTolerant('[{"k":"er sagte \\"hallo\\" laut"},{"k":"b"}]');
    expect(out).toEqual([{ k: 'er sagte "hallo" laut' }, { k: 'b' }]);
  });

  it('geschweifte Klammern im String-Wert verwirren die Tiefenzählung nicht', () => {
    const out = parseJsonArrayTolerant('[{"k":"a {nested} b"},{"k":"c"}]');
    expect(out).toEqual([{ k: 'a {nested} b' }, { k: 'c' }]);
  });

  it('liefert [] wenn schon das erste Objekt angeschnitten ist', () => {
    expect(parseJsonArrayTolerant('[{"k":"a"')).toEqual([]);
  });

  it('liefert [] für Prosa ohne JSON-Objekte (Plain-Text-Fallback-Basis)', () => {
    expect(parseJsonArrayTolerant('Das ist nur Fließtext ohne Struktur.')).toEqual([]);
  });

  it('überspringt einzelne nicht-parsebare Objekte, behält valide', () => {
    // Mittleres Objekt hat ein nacktes (ungültiges) Token → wird verworfen.
    const out = parseJsonArrayTolerant('[{"k":"a"},{kaputt},{"k":"c"}]');
    expect(out).toEqual([{ k: 'a' }, { k: 'c' }]);
  });
});
