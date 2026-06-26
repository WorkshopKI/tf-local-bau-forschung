import { isFixtureSchemaId } from '@/core/services/seed/fixture-ids';
import type { CsvSchema } from '@/core/services/csv/types';

export interface FixtureSourceWarning {
  /** Anzahl registrierter `fixture-real-*`-Quellen. */
  fixtureCount: number;
  /** Gesamtzahl registrierter Quellen. */
  total: number;
  /** True, wenn AUSSCHLIESSLICH Fixture-Quellen registriert sind (= keine echten Daten). */
  allFixtures: boolean;
}

/**
 * Banner-Entscheidung: warnt, wenn in einem NICHT-Dev-Build Demo-/Fixture-Quellen
 * (`fixture-real-*`) registriert sind. Solche Quellen sind per `isFixtureSchemaId`
 * hart vom Auto-Refresh ausgeschlossen (`local_fixture`), d.h. echte CSV-Exporte
 * werden nie importiert — genau die Falle, die einen Produktiv-Share unbemerkt auf
 * Demo-Daten laufen ließ. Im Dev-Build sind Fixtures gewollt → keine Warnung.
 * `null` = kein Problem.
 */
export function fixtureSourceWarning(
  schemas: CsvSchema[],
  isDevFixtures: boolean,
): FixtureSourceWarning | null {
  if (isDevFixtures) return null;
  const fixtureCount = schemas.filter(s => isFixtureSchemaId(s.id)).length;
  if (fixtureCount === 0) return null;
  return { fixtureCount, total: schemas.length, allFixtures: fixtureCount === schemas.length };
}
