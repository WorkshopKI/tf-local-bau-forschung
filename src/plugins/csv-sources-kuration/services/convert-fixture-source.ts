import type { IDBStore } from '@/core/services/storage/idb-store';
import type { CsvSchema } from '@/core/services/csv/types';
import { saveSchema, removeSchema } from '@/core/services/csv';
import {
  deleteRowHashes, getRowHashesForSchema, listAllSchemas, listSchemasByProgramm,
} from '@/core/services/csv/idb-csv';
import { teileNachAbdeckung } from '@/core/services/csv/loeschregel';
import { recomputeMultipleBatched } from '@/core/services/csv/merger/batched';
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
  /** Aktenzeichen, die diese Fixture-Quelle getragen hat (für den Recompute). */
  betroffeneAz: string[];
}

/**
 * Wandelt EINE Fixture-Quelle in eine echte um: neues Schema speichern, das
 * Fixture-Schema + dessen Row-Hashes + dessen Datei-Handle entfernen.
 * Importiert KEINE Daten — der Aufrufer/User spielt die echte CSV danach via
 * „CSV neu wählen"/Auto-Refresh ein.
 *
 * Die Row-Hashes müssen mit: sie sind auf die alte Schema-Id gekeyt und wären
 * danach Waisen — der Import unter der NEUEN Id sähe jede Zeile als „neu",
 * und `removeFixtureSeeds` (das sie sonst abräumt) findet die Quelle nicht
 * mehr. Die zugehörigen Aktenzeichen reicht die Funktion nach oben, damit der
 * Aufrufer sie in EINEM Recompute je Programm abräumt.
 */
export async function convertFixtureToRealSource(
  idb: IDBStore,
  fixture: CsvSchema,
  existingIds: Set<string>,
): Promise<ConvertedSource> {
  const newId = deriveRealSchemaId(fixture.csv_source_name, existingIds);
  const hashes = await getRowHashesForSchema(idb, fixture.id);
  await saveSchema(idb, buildRealSchemaFromFixture(fixture, newId));
  await removeSchema(idb, fixture.id);
  if (hashes.length > 0) {
    await deleteRowHashes(idb, fixture.id, hashes.map(h => h.join_value));
  }
  await removeCsvSourceHandle(idb, fixture.id);
  return {
    oldId: fixture.id,
    newId,
    name: fixture.csv_source_name,
    betroffeneAz: hashes.map(h => h.join_value),
  };
}

/**
 * Wandelt ALLE registrierten Fixture-Quellen in echte um (sequenziell) und
 * räumt die Demo-DATEN mit ab. Liefert die Liste der Umwandlungen (leer =
 * nichts zu tun).
 *
 * Zwei Dinge, die hier leicht falsch werden:
 *
 * 1. **Die Kollisionsmenge ist global.** Geschrieben wird in den
 *    programm-übergreifenden `csv_schemas`-Store; geprüft wurde bisher nur
 *    gegen die Quellen des AKTIVEN Programms. Eine gleichnamige echte Quelle in
 *    einem zweiten Programm wurde dadurch vom Demo-Klon ERSETZT — Mapping,
 *    Priorität und Stempel weg, `programm_id` auf das Default-Programm
 *    gesprungen, die Quelle aus ihrem Programm verschwunden.
 * 2. **Die Demo-Anträge gehen mit.** Der `removedAz`-Recompute prüft je
 *    Aktenzeichen, welche VERBLIEBENEN Schemas es abdecken: Anträge, die nur
 *    durch Fixture-Quellen existierten, verschwinden; Anträge, die auch eine
 *    echte Quelle trägt, werden ohne den Fixture-Anteil neu gebaut. Ohne diesen
 *    Schritt war die Lage nach der Umwandlung schlechter als davor — der
 *    Demo-Bestand blieb, aber kein Werkzeug fand ihn noch (`fixture-real-*` ist
 *    weg, also greifen weder Banner noch `removeFixtureSeeds`), und übrig blieb
 *    der herkunftsblinde Alles-oder-nichts-Reset.
 */
export async function convertAllFixtureSources(
  idb: IDBStore,
  schemas: CsvSchema[],
): Promise<ConvertedSource[]> {
  const fixtures = schemas.filter(s => isFixtureSchemaId(s.id));
  if (fixtures.length === 0) return [];

  const existing = new Set(
    (await listAllSchemas(idb)).map(s => s.id).filter(id => !isFixtureSchemaId(id)),
  );
  const results: ConvertedSource[] = [];
  const proProgramm = new Map<string, Set<string>>();
  for (const f of fixtures) {
    const r = await convertFixtureToRealSource(idb, f, existing);
    existing.add(r.newId);
    results.push(r);
    const menge = proProgramm.get(f.programm_id) ?? new Set<string>();
    for (const az of r.betroffeneAz) menge.add(az);
    proProgramm.set(f.programm_id, menge);
  }

  for (const [programmId, az] of proProgramm) {
    if (az.size === 0) continue;
    // Dieselbe Löschregel wie beim Import: weg ist nur, was KEINE verbliebene
    // Quelle mehr trägt. Ein Antrag, den auch eine echte Quelle führt, wird
    // stattdessen ohne den Fixture-Anteil neu zusammengebaut — die Demo-Felder
    // fallen weg, der Antrag bleibt.
    const verbliebene = await listSchemasByProgramm(idb, programmId);
    const { zuLoeschen, gehalten } = await teileNachAbdeckung(idb, verbliebene, [...az]);
    await recomputeMultipleBatched(idb, programmId, { touchedAz: gehalten, removedAz: zuLoeschen });
  }
  return results;
}
