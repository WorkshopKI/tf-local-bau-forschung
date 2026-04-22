/**
 * Programmatischer CSV-Import ohne Wizard — für Dev-Szenarien.
 *
 * Umgeht bewusst die Encoding-/Mapping-UI. Darf NUR für Test-CSVs aus
 * src/plugins/csv-sources-admin/wizard/testCorpus.ts verwendet werden.
 * Die Fixture-Schemas in ./fixture-schemas.ts haben eine harte `dev-`-id-
 * Konvention; ein Import mit anderer id wird abgelehnt.
 */

import type { IDBStore } from '@/core/services/storage/idb-store';
import type { CsvSchema } from '@/core/services/csv/types';
import { saveSchema } from '@/core/services/csv/schemaRegistry';
import { importCsvSource } from '@/core/services/csv/importer';
import type { ImportResult } from '@/core/services/csv/types';
import { putProgramm } from '@/core/services/csv/idb-csv';
import { saveUnterprogramm } from '@/core/services/csv/unterprogrammRegistry';
import { TEST_CORPUS, testCorpusBlob } from '@/plugins/csv-sources-admin/wizard/testCorpus';
import { features } from '@/config/feature-flags';
import {
  FIXTURE_SCHEMAS,
  DEV_PROGRAMM_ID,
  DEV_PROGRAMM_NAME,
  fixtureSchemaId,
  type FixtureKey,
} from './fixture-schemas';

function assertDevFixtures(): void {
  if (!__TEAMFLOW_DEV_FIXTURES__ || !features.devFixtures) {
    throw new Error('dev-fixtures importTestCsv ohne aktive features.devFixtures.');
  }
}

async function ensureDevProgramm(idb: IDBStore): Promise<void> {
  await putProgramm(idb, {
    id: DEV_PROGRAMM_ID,
    name: DEV_PROGRAMM_NAME,
    created_at: new Date().toISOString(),
    smb_handle_key: 'daten-share',
  });
}

/**
 * Für Master-CSVs mit `FM_NUMMER`-Spalte: registriert Unterprogramme aktiv,
 * damit der Master-Import sie nicht als Inactive herausfiltert.
 * Für Fixtures ohne `FM_NUMMER` (z.B. stammdaten-mini) No-Op.
 */
async function ensureDevUnterprogramme(idb: IDBStore, schema: CsvSchema, csvText: string): Promise<void> {
  if (!schema.is_master) return;
  const fmColumn = Object.entries(schema.column_mapping).find(
    ([, e]) => e.canonical === 'unterprogramm_id' && !e.ignore,
  );
  if (!fmColumn) return;
  const colName = fmColumn[0];
  const firstLine = csvText.split('\n', 1)[0] ?? '';
  const headers = firstLine.split(',').map(s => s.trim());
  const colIdx = headers.indexOf(colName);
  if (colIdx < 0) return;
  const values = new Set<string>();
  const lines = csvText.split('\n').slice(1);
  for (const line of lines) {
    if (!line) continue;
    const parts = line.split(',');
    const v = (parts[colIdx] ?? '').trim();
    if (v) values.add(v);
  }
  for (const code of values) {
    await saveUnterprogramm(idb, {
      id: code,
      programm_id: schema.programm_id,
      code,
      aktiv: true,
    });
  }
}

/**
 * Importiert ein Test-CSV programmatisch. Legt `dev-programm` an falls nötig,
 * registriert das Schema, schreibt die CSV-Rohdaten aufs SMB (best-effort) und
 * lässt die volle Import-Pipeline laufen.
 */
export async function importTestCsv(idb: IDBStore, key: FixtureKey): Promise<ImportResult> {
  assertDevFixtures();

  const entry = TEST_CORPUS.find(e => e.id === key);
  if (!entry) throw new Error(`Unbekannter Fixture-Key: ${key}`);

  const fixture = FIXTURE_SCHEMAS[key];
  if (!fixture) throw new Error(`Kein Fixture-Schema für ${key}`);

  const schemaId = fixtureSchemaId(key);
  if (!schemaId.startsWith('dev-')) {
    throw new Error('Fixture-Schema-IDs müssen mit `dev-` beginnen');
  }

  await ensureDevProgramm(idb);

  const schema: CsvSchema = {
    id: schemaId,
    programm_id: DEV_PROGRAMM_ID,
    csv_source_name: entry.filename,
    is_master: fixture.is_master,
    join_key: fixture.join_key,
    priority: fixture.priority,
    column_mapping: fixture.column_mapping,
    encoding: fixture.encoding,
    separator: fixture.separator,
    created_at: new Date().toISOString(),
  };

  await saveSchema(idb, schema);

  const csvText = entry.csv ?? entry.generate?.() ?? '';
  await ensureDevUnterprogramme(idb, schema, csvText);

  const blob = testCorpusBlob(entry);
  return importCsvSource(idb, schema.id, blob, {});
}
