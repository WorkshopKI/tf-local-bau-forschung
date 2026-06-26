/**
 * Härtung nach dem „Produktion lief auf Demo-Fixtures"-Vorfall: in einem
 * Nicht-Dev-Build dürfen keine `fixture-real-*`-Quellen registriert sein — die
 * sind per `isFixtureSchemaId` vom Auto-Refresh ausgeschlossen, d.h. echte CSVs
 * werden nie importiert. `fixtureSourceWarning` liefert die Banner-Entscheidung.
 */
import { describe, it, expect } from 'vitest';
import { fixtureSourceWarning } from '../fixture-source-warning';
import type { CsvSchema } from '@/core/services/csv/types';

function schema(id: string): CsvSchema {
  return { id } as unknown as CsvSchema;
}

describe('fixtureSourceWarning', () => {
  it('warnt NICHT im Dev-Build (Fixtures sind dort gewollt)', () => {
    expect(fixtureSourceWarning([schema('fixture-real-anb')], true)).toBeNull();
  });

  it('warnt NICHT, wenn keine Fixture-Quellen registriert sind', () => {
    expect(fixtureSourceWarning([schema('9097-anb'), schema('7737-bgl')], false)).toBeNull();
  });

  it('warnt NICHT bei leerer Quellenliste', () => {
    expect(fixtureSourceWarning([], false)).toBeNull();
  });

  it('warnt im Nicht-Dev-Build, wenn ALLE Quellen Fixtures sind', () => {
    const w = fixtureSourceWarning([schema('fixture-real-anb'), schema('fixture-real-bgl')], false);
    expect(w).toEqual({ fixtureCount: 2, total: 2, allFixtures: true });
  });

  it('warnt auch bei gemischten Quellen (allFixtures=false)', () => {
    const w = fixtureSourceWarning([schema('fixture-real-anb'), schema('9097-anb')], false);
    expect(w).toEqual({ fixtureCount: 1, total: 2, allFixtures: false });
  });
});
