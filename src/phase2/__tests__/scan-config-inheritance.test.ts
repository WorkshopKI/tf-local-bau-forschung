import { describe, expect, it } from 'vitest';
import {
  dedupeWithInheritance,
  findCoveringParent,
  isPathCovered,
} from '../scan-config/inheritance';

describe('findCoveringParent', () => {
  it('liefert null wenn nichts deckt', () => {
    expect(findCoveringParent('a/b', ['x', 'y/z'])).toBeNull();
  });

  it('findet direkten Parent', () => {
    expect(findCoveringParent('Anonymisiert/GA', ['Anonymisiert'])).toBe('Anonymisiert');
  });

  it('findet entfernten Vorfahr', () => {
    expect(findCoveringParent('a/b/c/d', ['a'])).toBe('a');
  });

  it('liefert nicht den Pfad selbst', () => {
    expect(findCoveringParent('a/b', ['a/b'])).toBeNull();
  });

  it('"" deckt alles ausser "" selbst', () => {
    expect(findCoveringParent('a', [''])).toBe('');
    expect(findCoveringParent('', [''])).toBeNull();
  });

  it('teilstring-Praefixe ohne Slash zaehlen nicht', () => {
    // 'foo' ist KEIN Vorfahr von 'foobar'
    expect(findCoveringParent('foobar', ['foo'])).toBeNull();
  });
});

describe('isPathCovered', () => {
  it('Pfad selbst zaehlt als covered', () => {
    expect(isPathCovered('a/b', ['a/b'])).toBe(true);
  });

  it('Vorfahr deckt', () => {
    expect(isPathCovered('a/b/c', ['a'])).toBe(true);
  });

  it('Geschwister deckt nicht', () => {
    expect(isPathCovered('a/b', ['a/c'])).toBe(false);
  });
});

describe('dedupeWithInheritance', () => {
  it('leere Liste -> leer', () => {
    expect(dedupeWithInheritance([])).toEqual([]);
  });

  it('einzelner Pfad -> unveraendert', () => {
    expect(dedupeWithInheritance(['a'])).toEqual(['a']);
  });

  it('Parent + Child -> nur Parent', () => {
    expect(dedupeWithInheritance(['Anonymisiert', 'Anonymisiert/GA'])).toEqual([
      'Anonymisiert',
    ]);
  });

  it('Reihenfolge egal', () => {
    expect(dedupeWithInheritance(['Anonymisiert/GA', 'Anonymisiert'])).toEqual([
      'Anonymisiert',
    ]);
  });

  it('mehrere Children + Parent -> nur Parent', () => {
    const out = dedupeWithInheritance([
      'Anonymisiert/GA',
      'Anonymisiert/NF',
      'Anonymisiert',
      'Anonymisiert/RNE',
      'Anonymisiert/VN',
    ]);
    expect(out).toEqual(['Anonymisiert']);
  });

  it('Geschwister bleiben beide drin', () => {
    expect(dedupeWithInheritance(['a/b', 'a/c'])).toEqual(['a/b', 'a/c']);
  });

  it('"" als Universal-Override -> nur [""]', () => {
    expect(dedupeWithInheritance(['', 'a', 'b/c'])).toEqual(['']);
  });

  it('exakte Doubletten werden entfernt', () => {
    expect(dedupeWithInheritance(['a', 'a', 'b'])).toEqual(['a', 'b']);
  });

  it('Trim wird angewendet', () => {
    expect(dedupeWithInheritance(['  a  ', 'a/b'])).toEqual(['a']);
  });

  it('teilstring-Praefix ohne Slash bleibt erhalten', () => {
    // 'foo' deckt nicht 'foobar'
    expect(dedupeWithInheritance(['foo', 'foobar'])).toEqual(['foo', 'foobar']);
  });

  it('mehrere unabhaengige Roots + ihre Children', () => {
    const out = dedupeWithInheritance([
      'DOK/GKAB',
      'DOK',
      'Anonymisiert/GA',
      'Anonymisiert',
    ]);
    expect(out.sort()).toEqual(['Anonymisiert', 'DOK']);
  });

  it('sortiert nach Tiefe (kuerzeste zuerst)', () => {
    const out = dedupeWithInheritance(['x/y', 'a', 'm/n', 'b']);
    // Tiefe-1-Pfade zuerst (alphabetisch), dann Tiefe-2
    expect(out).toEqual(['a', 'b', 'm/n', 'x/y']);
  });
});
