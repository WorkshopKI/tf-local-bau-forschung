/**
 * Die Bucket-Zuordnung der Status-Pille. Dass die gezählte Menge auch die
 * gefilterte ist, prüft `phaseQuickfilter.test.ts`.
 *
 * Die Toggle-Helfer (`deriveChipState`/`computeFilterValue`/`soloChipState`)
 * sind entfallen — Reste des Multi-Toggle-Vorgängers, in der App
 * seit dem Akkordeon-Umbau ungenutzt. Ihre Tests sind mit ihnen gegangen.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { setStatusKatalogSnapshotMap, type StatusCategory } from '@/core/utils/status-canonical';
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

  it('Chip „Wartet auf Antragsteller" enthält nur „nf gestellt"', () => {
    const values = chipStatusValues('nachforderung');
    expect(values.has('nf gestellt')).toBe(true);
    // Seit v2.411 NICHT mehr dabei: bei beiden liegt der Ball wieder bei der
    // Behörde. Sie stehen jetzt unter „Vor Entscheidung" (Kategorie `offen`).
    expect(values.has('keine weiteren nf')).toBe(false);
    expect(values.has('nl eingegangen')).toBe(false);
    expect(chipStatusValues('offen').has('keine weiteren nf')).toBe(true);
    expect(chipStatusValues('offen').has('nl eingegangen')).toBe(true);
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

describe('chipStatusValues folgt dem aktiven Katalog', () => {
  afterEach(() => { setStatusKatalogSnapshotMap(null); });

  it('nimmt eine Schreibweise auf, die erst der Snapshot kennt', () => {
    expect(chipStatusValues('offen').has('sonderfall xy')).toBe(false);
    setStatusKatalogSnapshotMap(new Map<string, StatusCategory>([
      ['sonderfall xy', 'entscheidung'],
    ]));
    expect(chipStatusValues('offen').has('sonderfall xy')).toBe(true);
  });

  it('verliert eine Schreibweise, die der Snapshot nicht führt', () => {
    setStatusKatalogSnapshotMap(new Map<string, StatusCategory>([
      ['beantragt', 'offen'],
    ]));
    expect(chipStatusValues('offen').has('bearbeitungsreif')).toBe(false);
  });
});
