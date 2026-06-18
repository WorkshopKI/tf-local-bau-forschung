/**
 * Leichtgewichtige Fixture-Schema-Erkennung — bewusst OHNE den CSV-Glob/
 * Importer-Ballast von `fixture-loader.ts`, damit auch UI-/Kuration-Code (z.B.
 * `csv-source-handle.ts`) das Prädikat importieren kann, ohne die Seed-CSVs in
 * seinen Modul-Graph zu ziehen.
 *
 * Die Dev-Seed-Schemas aus `docs/fixtures/schema-*.ts` (`fixture-real-anb`,
 * `fixture-real-bgl`, `fixture-real-prjbsp`) teilen sich per Konvention das
 * gemeinsame ID-Präfix `fixture-real-`. Diese Schemas existieren nur im
 * dev-Build (`demoDataBundled: true`), nie in prod/pl/kurator.
 */

/** Gemeinsames ID-Präfix aller Dev-Fixture-CSV-Schemas (docs/fixtures/schema-*.ts). */
export const FIXTURE_SCHEMA_ID_PREFIX = 'fixture-real-';

/** True für Dev-Seed-Fixture-Schemas (fixture-real-anb/-bgl/-prjbsp). */
export function isFixtureSchemaId(id: string): boolean {
  return id.startsWith(FIXTURE_SCHEMA_ID_PREFIX);
}
