import { describe, it, expect } from 'vitest';
import {
  STATUS_QUICK_CHIPS,
  chipStatusValues,
  deriveChipState,
  computeFilterValue,
  soloChipState,
} from '../statusQuickChips';

describe('chipStatusValues', () => {
  it('Bewilligt-Chip enthält "bewilligt" und "genehmigt" (Foerderantrag + Bauantrag)', () => {
    const values = chipStatusValues('bewilligt');
    expect(values.has('bewilligt')).toBe(true);
    expect(values.has('genehmigt')).toBe(true);
  });

  it('Abgeschlossen-Chip enthält "abgelehnt/zurückgezogen" und "abgelehnt" (Bauantrag)', () => {
    const values = chipStatusValues('abgeschlossen');
    expect(values.has('abgelehnt/zurückgezogen')).toBe(true);
    expect(values.has('abgelehnt')).toBe(true);
    expect(values.has('schlussvermerk')).toBe(true);
  });

  it('Nachforderung-Chip enthält "nf gestellt" und "keine weiteren nf"', () => {
    const values = chipStatusValues('nachforderung');
    expect(values.has('nf gestellt')).toBe(true);
    expect(values.has('keine weiteren nf')).toBe(true);
  });

  it('Begleitung-Chip enthält "vn geprüft"', () => {
    const values = chipStatusValues('begleitung');
    expect(values.has('vn geprüft')).toBe(true);
  });

  it('Offen-Chip enthält offen + in_pruefung + entscheidung Stati', () => {
    const values = chipStatusValues('offen');
    expect(values.has('beantragt')).toBe(true);          // offen
    expect(values.has('techn geprüft')).toBe(true);      // in_pruefung
    expect(values.has('bewilligungsreif')).toBe(true);   // entscheidung
  });
});

describe('deriveChipState', () => {
  it('null/leerer Filter → alle 5 Chips on', () => {
    const stateA = deriveChipState(null);
    const stateB = deriveChipState([]);
    for (const chip of STATUS_QUICK_CHIPS) {
      expect(stateA[chip.id]).toBe('on');
      expect(stateB[chip.id]).toBe('on');
    }
  });

  it('Filter enthält alle Werte eines Chips → Chip on, Rest off', () => {
    const values = [...chipStatusValues('bewilligt')];
    const state = deriveChipState(values);
    expect(state.bewilligt).toBe('on');
    expect(state.offen).toBe('off');
    expect(state.nachforderung).toBe('off');
    expect(state.begleitung).toBe('off');
    expect(state.abgeschlossen).toBe('off');
  });

  it('Filter enthält teilweise Werte eines Chips → mixed', () => {
    const state = deriveChipState(['bewilligt']);
    // Bewilligt-Chip enthält bewilligt + genehmigt → nur bewilligt da → mixed
    expect(state.bewilligt).toBe('mixed');
  });

  it('case-insensitive Match', () => {
    const state = deriveChipState(['BEWILLIGT', '  Genehmigt  ']);
    expect(state.bewilligt).toBe('on');
  });
});

describe('computeFilterValue', () => {
  it('Alle Chips on → null (Filter clear)', () => {
    const state = {
      offen: 'on' as const,
      nachforderung: 'on' as const,
      bewilligt: 'on' as const,
      begleitung: 'on' as const,
      abgeschlossen: 'on' as const,
    };
    expect(computeFilterValue(state)).toBeNull();
  });

  it('Ein Chip off → enthält Werte der anderen 4 Chips + sonstige', () => {
    const state = {
      offen: 'on' as const,
      nachforderung: 'on' as const,
      bewilligt: 'on' as const,
      begleitung: 'on' as const,
      abgeschlossen: 'off' as const,
    };
    const value = computeFilterValue(state)!;
    expect(value).not.toBeNull();
    // Abgeschlossen-Werte raus
    expect(value).not.toContain('abgelehnt/zurückgezogen');
    expect(value).not.toContain('schlussvermerk');
    // Andere Chips drin
    expect(value).toContain('bewilligt');
    expect(value).toContain('nf gestellt');
    expect(value).toContain('vn geprüft');
    // Sonstige immer drin
    expect(value).toContain('irrläufer');
  });

  it('Solo-Modus: nur ein Chip on → nur dessen Werte + sonstige', () => {
    const state = soloChipState('bewilligt');
    const value = computeFilterValue(state)!;
    expect(value).toContain('bewilligt');
    expect(value).toContain('genehmigt');
    expect(value).toContain('irrläufer');  // sonstige immer
    expect(value).not.toContain('beantragt');
    expect(value).not.toContain('vn geprüft');
  });

  it('mixed wird wie on behandelt (Chip aktiv → Werte einschließen)', () => {
    const state = {
      offen: 'mixed' as const,
      nachforderung: 'off' as const,
      bewilligt: 'off' as const,
      begleitung: 'off' as const,
      abgeschlossen: 'off' as const,
    };
    const value = computeFilterValue(state)!;
    expect(value).toContain('beantragt'); // mixed chip's values drin
  });
});

describe('soloChipState', () => {
  it('Solo "begleitung": nur begleitung on, Rest off', () => {
    const state = soloChipState('begleitung');
    expect(state.begleitung).toBe('on');
    expect(state.offen).toBe('off');
    expect(state.bewilligt).toBe('off');
    expect(state.abgeschlossen).toBe('off');
    expect(state.nachforderung).toBe('off');
  });
});
