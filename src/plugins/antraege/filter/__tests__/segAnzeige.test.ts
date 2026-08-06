import { describe, it, expect } from 'vitest';
import type { CollapsibleSegItem } from '../CollapsibleSeg';
import { segAnzeige } from '../segAnzeige';

/** Der Projektart-Fall: „Einzelprojekt" steht im Menue NOCH EINMAL. */
const EINZEL: CollapsibleSegItem = {
  label: 'Einzelprojekt',
  count: 397,
  unterpunkte: [
    { label: 'Einzelprojekt', menuLabel: 'alle Einzelprojekte', count: 397 },
    { label: 'mit NW Bezug', count: 38 },
    { label: 'ohne NW Bezug', count: 192 },
  ],
};
const KOOP: CollapsibleSegItem = { label: 'Kooperationsprojekt', count: 441 };

describe('segAnzeige', () => {
  it('der Oberpunkt findet sich NICHT selbst als Unterpunkt', () => {
    // Sonst liest der Knopf „Einzelprojekt · Einzelprojekt 397" (v3.13.0).
    const a = segAnzeige(EINZEL, 'Einzelprojekt');
    expect(a.aktiverUnterpunkt).toBeNull();
    expect(a.gezeigt).toBe(EINZEL);
    expect(a.active).toBe(true);
  });

  it('ein echter Unterpunkt faerbt den Oberpunkt und stellt die Zahl', () => {
    const a = segAnzeige(EINZEL, 'mit NW Bezug');
    expect(a.aktiverUnterpunkt?.label).toBe('mit NW Bezug');
    expect(a.gezeigt.count).toBe(38);
    expect(a.active).toBe(true);
  });

  it('ein fremder Wert laesst den Knopf unbeteiligt — mit seiner eigenen Zahl', () => {
    const a = segAnzeige(EINZEL, 'Kooperationsprojekt');
    expect(a.aktiverUnterpunkt).toBeNull();
    expect(a.active).toBe(false);
    expect(a.gezeigt.count).toBe(397);
  });

  it('ein Segment ohne Menue verhaelt sich wie zuvor', () => {
    expect(segAnzeige(KOOP, 'Kooperationsprojekt')).toEqual({
      aktiverUnterpunkt: null, gezeigt: KOOP, active: true,
    });
    expect(segAnzeige(KOOP, 'Alle').active).toBe(false);
  });
});
