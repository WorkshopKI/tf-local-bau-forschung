import type { IDBStore } from '@/core/services/storage/idb-store';
import type { CsvSchema } from '@/core/services/csv/types';
import { saveSchema, removeSchema } from '@/core/services/csv';
import { isFixtureSchemaId } from '@/core/services/seed/fixture-ids';
import { removeCsvSourceHandle } from '../csv-source-handle';

/**
 * Leitet aus dem Quellnamen eine stabile, **Nicht-Fixture**-Schema-ID ab
 * (slugifiziert, Kollisionen mit `existingIds` durch Zähler-Suffix vermieden).
 */
export function deriveRealSchemaId(sourceName: string, existingIds: Set<string>): string {
  let base = sourceName
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // kombinierende Diakritika (ü→u etc.)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'quelle';
  // Garantiert NICHT-Fixture vor der Kollisions-Schleife: ein Quellname wie
  // „fixture real anb" slugifiziert sonst zu „fixture-real-…" — und da der
  // Suffix-Zähler den Präfix behält, liefe `isFixtureSchemaId` ewig (Endlosschleife).
  if (isFixtureSchemaId(base)) base = `q-${base}`;
  let id = base;
  let n = 1;
  while (existingIds.has(id)) {
    id = `${base}-${n++}`;
  }
  return id;
}

/**
 * Baut aus einem Fixture-Schema das echte Pendant: Mapping/Join/Priorität/
 * Encoding/Separator bleiben erhalten, die neue (Nicht-Fixture-)ID wird gesetzt,
 * und der **Import-Zustand wird zurückgesetzt** — die echte Quelldatei ist noch
 * nicht importiert, alte Demo-Checksumme/Zeilenzahl/Baseline dürfen nicht haften.
 */
export function buildRealSchemaFromFixture(fixture: CsvSchema, newId: string): CsvSchema {
  return {
    ...fixture,
    id: newId,
    file_checksum: undefined,
    last_imported_at: undefined,
    last_row_count: undefined,
    source_file_name: undefined,
    source_last_modified: undefined,
    last_file_size: undefined,
  };
}

export interface ConvertedSource {
  oldId: string;
  newId: string;
  name: string;
}

/**
 * Wandelt EINE Fixture-Quelle in eine echte um: neues Schema speichern, das
 * Fixture-Schema + dessen Datei-Handle entfernen. Importiert KEINE Daten — der
 * Aufrufer/User spielt die echte CSV danach via „CSV neu wählen"/Auto-Refresh ein.
 */
export async function convertFixtureToRealSource(
  idb: IDBStore,
  fixture: CsvSchema,
  existingIds: Set<string>,
): Promise<ConvertedSource> {
  const newId = deriveRealSchemaId(fixture.csv_source_name, existingIds);
  await saveSchema(idb, buildRealSchemaFromFixture(fixture, newId));
  await removeSchema(idb, fixture.id);
  await removeCsvSourceHandle(idb, fixture.id);
  return { oldId: fixture.id, newId, name: fixture.csv_source_name };
}

/**
 * Wandelt ALLE registrierten Fixture-Quellen in echte um (sequenziell). Neue IDs
 * werden in die Kollisions-Menge aufgenommen, damit zwei Quellen nicht dieselbe
 * abgeleitete ID bekommen. Liefert die Liste der Umwandlungen (leer = nichts zu tun).
 */
export async function convertAllFixtureSources(
  idb: IDBStore,
  schemas: CsvSchema[],
): Promise<ConvertedSource[]> {
  const fixtures = schemas.filter(s => isFixtureSchemaId(s.id));
  const existing = new Set(schemas.map(s => s.id).filter(id => !isFixtureSchemaId(id)));
  const results: ConvertedSource[] = [];
  for (const f of fixtures) {
    const r = await convertFixtureToRealSource(idb, f, existing);
    existing.add(r.newId);
    results.push(r);
  }
  return results;
}
