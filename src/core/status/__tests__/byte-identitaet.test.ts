/**
 * Kernzusage von Phase 1: `getStatusCategory` liefert über den Katalog-Snapshot
 * BITWEISE dasselbe wie über die eingebaute `CATEGORY_MAP`. Wir erfassen die
 * Baseline OHNE Snapshot, setzen dann den Seed-Snapshot und vergleichen.
 *
 * Setzt Modul-globalen Zustand (den Snapshot in status-canonical.ts) → läuft im
 * Projekt `isolated` und räumt in `afterAll` auf.
 */
import { describe, it, expect, afterAll } from 'vitest';
import {
  getStatusCategory, getStatusValuesByCategory, getCanonicalStatusEntries,
  type StatusCategory,
} from '@/core/utils/status-canonical';
import { setStatusKatalogSnapshot } from '@/core/status/snapshot';
import { baueSeedVersion } from '@/core/status/seed';

const ALLE_KATEGORIEN: StatusCategory[] = [
  'offen', 'in_pruefung', 'nachforderung', 'entscheidung',
  'bewilligt', 'begleitung', 'abgelehnt', 'abgeschlossen', 'sonstige',
];

const KANON_WERTE = getCanonicalStatusEntries().map(([w]) => w);
const RAND_WERTE = [
  'VN angefordert', 'ZB eingegangen', 'ZB.foo', 'Widerruf',
  'BEWILLIGT', 'Gutachten Fertig', 'schlussvermerk', 'abgelehnt/zurückgezogen',
  'unbekannt xyz', '', '   ', '  bewilligt  ',
];
const NICHT_STRINGS: unknown[] = [null, undefined, 42, {}, []];

afterAll(() => setStatusKatalogSnapshot(null));

describe('Byte-Identität Katalog-Snapshot vs. eingebaute CATEGORY_MAP', () => {
  it('getStatusCategory ist für alle Roh- und Randwerte identisch', () => {
    const werte = [...KANON_WERTE, ...RAND_WERTE];
    // Baseline OHNE Snapshot.
    const baseline = new Map(werte.map(w => [w, getStatusCategory(w)]));
    const baselineNichtStrings = NICHT_STRINGS.map(w => getStatusCategory(w));

    setStatusKatalogSnapshot(baueSeedVersion());

    for (const w of werte) {
      expect(getStatusCategory(w)).toBe(baseline.get(w));
    }
    NICHT_STRINGS.forEach((w, i) => {
      expect(getStatusCategory(w)).toBe(baselineNichtStrings[i]);
    });
  });

  it('getStatusValuesByCategory ist je Kategorie identisch (inkl. Reihenfolge)', () => {
    const baseline = new Map(ALLE_KATEGORIEN.map(c => [c, getStatusValuesByCategory(c)]));

    setStatusKatalogSnapshot(baueSeedVersion());

    for (const c of ALLE_KATEGORIEN) {
      expect(getStatusValuesByCategory(c)).toEqual(baseline.get(c));
    }
  });

  it('nach Snapshot-Reset greift wieder die eingebaute Map', () => {
    const vorher = getStatusCategory('gutachten fertig');
    setStatusKatalogSnapshot(baueSeedVersion());
    setStatusKatalogSnapshot(null);
    expect(getStatusCategory('gutachten fertig')).toBe(vorher);
  });
});
