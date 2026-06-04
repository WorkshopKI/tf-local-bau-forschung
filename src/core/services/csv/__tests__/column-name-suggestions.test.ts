import { describe, it, expect } from 'vitest';
import { buildSuggestionsFromColumnNames } from '../filter/xlsLabelParser';

/**
 * Regression: die name-basierte Auto-Suggestion im CSV-Wizard
 * (`buildSuggestionsFromColumnNames`) muss die eingebürgerten Foyer-Header
 * auf die richtigen Standardfelder mappen — sonst landen Zuwendung/Laufzeit
 * als Custom-Felder und bleiben in den Listen-/Such-Spalten leer.
 */
function canonicalFor(header: string): string | null | undefined {
  const out = buildSuggestionsFromColumnNames([header]);
  return out.find(s => s.csvColumn === header)?.canonical;
}

describe('buildSuggestionsFromColumnNames — Alias-Auflösung', () => {
  it('mappt ZUW_MU_FST ("aktuelle Zuwendung") auf foerdersumme', () => {
    expect(canonicalFor('ZUW_MU_FST')).toBe('foerdersumme');
  });

  it('mappt die Laufzeit-Header auf laufzeitbeginn/-ende', () => {
    expect(canonicalFor('LFZ_TV_B')).toBe('laufzeitbeginn');
    expect(canonicalFor('LFZ_TV_E')).toBe('laufzeitende');
  });

  it('ist robust gegen Schreibvarianten (Lowercase / Leerzeichen)', () => {
    expect(canonicalFor('zuw mu fst')).toBe('foerdersumme');
  });

  it('lässt die übrigen Finanzspalten bewusst un-gemappt (bleiben Custom)', () => {
    // Diese sollen NICHT als foerdersumme (oder sonst kanonisch) durchgehen,
    // sonst würde die "Zuwendung"-Spalte z.B. Gesamtkosten/Auszahlungen zeigen.
    expect(canonicalFor('FST_AZX_GK')).toBeUndefined();
    expect(canonicalFor('GKO_AZX_GK')).toBeUndefined();
    expect(canonicalFor('ZA_GS_GEZ')).toBeUndefined();
  });
});
