/**
 * Die Bucket-Zuordnung der Status-Pille. Dass die gezählte Menge auch die
 * gefilterte ist, prüft `phaseQuickfilter.test.ts`.
 *
 * Die Toggle-Helfer (`deriveChipState`/`computeFilterValue`/`soloChipState`)
 * sind entfallen — Reste des Multi-Toggle-Vorgängers, in der App
 * seit dem Akkordeon-Umbau ungenutzt. Ihre Tests sind mit ihnen gegangen.
 */
import { describe, it, expect } from 'vitest';
import { STATUS_QUICK_CHIPS, chipStatusValues } from '../statusQuickChips';

describe('chipStatusValues', () => {
  it('Bewilligt-Chip enthält "bewilligt"', () => {
    const values = chipStatusValues('bewilligt');
    expect(values.has('bewilligt')).toBe(true);
  });

  it('Abgeschlossen-Chip enthält "abgelehnt/zurückgezogen" und "schlussvermerk"', () => {
    const values = chipStatusValues('abgeschlossen');
    expect(values.has('abgelehnt/zurückgezogen')).toBe(true);
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

  it('die Buckets überschneiden sich nicht — sonst zählte ein Status doppelt', () => {
    const gesehen = new Map<string, string>();
    for (const chip of STATUS_QUICK_CHIPS) {
      for (const v of chipStatusValues(chip.id)) {
        expect(gesehen.get(v), `"${v}" liegt in ${gesehen.get(v)} UND ${chip.id}`).toBeUndefined();
        gesehen.set(v, chip.id);
      }
    }
  });
});
