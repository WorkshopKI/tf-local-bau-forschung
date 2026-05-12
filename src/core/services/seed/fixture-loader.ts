/**
 * Loader fuer die anonymisierten Real-Fixture-CSVs aus `docs/fixtures/`.
 *
 * Ersetzt die frueheren handgeschriebenen `Antrag`-Objekt-Seeds: statt
 * synthetische Records direkt in IDB zu schreiben, durchlaeuft jede CSV den
 * vollen Import-Stack (`importCsvSource`) und landet damit identisch zu einem
 * echten Foyer-Import. Bugs im Parser, Column-Mapping oder Merger werden so
 * im Seed-Pfad sichtbar.
 *
 * Vite-Glob: laedt die CSVs als UTF-8-Strings zur Build-Zeit. Wenn die CSVs
 * fehlen (frischer Klon ohne lokale Fixtures), liefert der Glob ein leeres
 * Objekt und der Loader returned graceful 0 Antraege.
 *
 * Erwartete Files unter `docs/fixtures/`:
 * - `sample_9097_AnB_AitisiGPT.csv` — Master (Antragsbasis)
 * - `sample_7737_Bgl.csv` — Secondary (Bewilligungsdetails)
 * - `sample_9052_PrjBsp_AitisiGPT.csv` — Secondary (Projektbeschreibung)
 *
 * Encoding-Pfad: ein prebuild-Script (`scripts/normalize-fixture-csvs.mjs`)
 * konvertiert Windows-1252-Files auto-idempotent zu UTF-8, sodass Vite's `?raw`
 * sauber decodieren kann.
 */
import type { StorageService } from '@/core/services/storage';
import type { CsvSchema } from '@/core/services/csv/types';
import { saveSchema } from '@/core/services/csv/schemaRegistry';
import { importCsvSource } from '@/core/services/csv/importer';
import {
  SCHEMA_A_ID, SCHEMA_A_NAME, SCHEMA_A_FILENAME, SCHEMA_A_PRIORITY,
  SCHEMA_A_IS_MASTER, SCHEMA_A_COLUMN_MAPPING,
} from '../../../../docs/fixtures/schema-a';
import {
  SCHEMA_B_ID, SCHEMA_B_NAME, SCHEMA_B_FILENAME, SCHEMA_B_PRIORITY,
  SCHEMA_B_IS_MASTER, SCHEMA_B_COLUMN_MAPPING,
} from '../../../../docs/fixtures/schema-b';
import {
  SCHEMA_C_ID, SCHEMA_C_NAME, SCHEMA_C_FILENAME, SCHEMA_C_PRIORITY,
  SCHEMA_C_IS_MASTER, SCHEMA_C_COLUMN_MAPPING,
} from '../../../../docs/fixtures/schema-c';

/**
 * Liest alle Fixture-CSVs als UTF-8 Raw-Strings zur Build-Zeit ein.
 * `eager: true` → Inhalte direkt im Bundle (kein Lazy-Import). Vite ersetzt
 * den Glob bei nicht vorhandenen Files durch ein leeres Objekt — kein
 * Build-Bruch, wenn die Fixtures lokal fehlen.
 */
const FIXTURE_CSV_MODULES = import.meta.glob(
  '../../../../docs/fixtures/*.csv',
  { eager: true, query: '?raw', import: 'default' },
) as Record<string, string>;

interface FixtureDef {
  id: string;
  name: string;
  filename: string;
  is_master: boolean;
  priority: number;
  column_mapping: CsvSchema['column_mapping'];
}

/** Reihenfolge wichtig: Master zuerst, damit Secondaries beim Merge die
 *  Master-Aktenzeichen-Liste schon kennen. */
const FIXTURE_DEFS: readonly FixtureDef[] = [
  {
    id: SCHEMA_A_ID, name: SCHEMA_A_NAME, filename: SCHEMA_A_FILENAME,
    is_master: SCHEMA_A_IS_MASTER, priority: SCHEMA_A_PRIORITY,
    column_mapping: SCHEMA_A_COLUMN_MAPPING,
  },
  {
    id: SCHEMA_B_ID, name: SCHEMA_B_NAME, filename: SCHEMA_B_FILENAME,
    is_master: SCHEMA_B_IS_MASTER, priority: SCHEMA_B_PRIORITY,
    column_mapping: SCHEMA_B_COLUMN_MAPPING,
  },
  {
    id: SCHEMA_C_ID, name: SCHEMA_C_NAME, filename: SCHEMA_C_FILENAME,
    is_master: SCHEMA_C_IS_MASTER, priority: SCHEMA_C_PRIORITY,
    column_mapping: SCHEMA_C_COLUMN_MAPPING,
  },
];

function findCsvText(filename: string): string | null {
  for (const [path, text] of Object.entries(FIXTURE_CSV_MODULES)) {
    const normalized = path.replace(/\\/g, '/');
    if (normalized.endsWith('/' + filename)) return text;
  }
  return null;
}

/** Aktenzeichen aller fuer den Seed registrierten Schemas — Cleanup-Helper
 *  fuer `clearSeedData`, damit beim Seed-Reset auch die zugehoerigen Hashes
 *  und CSV-Dateien (per Schema-ID) klar identifizierbar sind. */
export const FIXTURE_SCHEMA_IDS: readonly string[] = FIXTURE_DEFS.map(d => d.id);

export interface SeedFixturesResult {
  /** Wieviele der erwarteten CSVs lagen lokal vor und wurden importiert. */
  csvsImported: number;
  /** Welche Filenames fehlten (informativ — kein Fehler). */
  missingFilenames: string[];
}

/**
 * Importiert alle vorhandenen Fixture-CSVs in das angegebene Programm.
 * Fehlende CSVs werden uebersprungen (kein Throw) — App startet trotzdem.
 */
export async function seedFromFixtureCsvs(
  storage: StorageService,
  programmId: string,
): Promise<SeedFixturesResult> {
  const missing: string[] = [];
  let imported = 0;

  for (const def of FIXTURE_DEFS) {
    const csvText = findCsvText(def.filename);
    if (csvText === null || csvText.length === 0) {
      missing.push(def.filename);
      continue;
    }

    const schema: CsvSchema = {
      id: def.id,
      programm_id: programmId,
      csv_source_name: def.name,
      is_master: def.is_master,
      join_key: 'aktenzeichen',
      priority: def.priority,
      column_mapping: def.column_mapping,
      encoding: 'UTF-8',
      separator: ';',
      created_at: new Date().toISOString(),
    };
    await saveSchema(storage.idb, schema);

    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8' });
    await importCsvSource(storage.idb, schema.id, blob, {});
    imported++;
  }

  if (missing.length > 0) {
    console.warn(
      `[seed/fixture-loader] ${missing.length} Fixture-CSV(s) fehlen — Seed laeuft ohne sie weiter:`,
      missing.join(', '),
    );
    console.warn(
      `[seed/fixture-loader] Lege die anonymisierten CSVs unter docs/fixtures/ ab (siehe docs/fixtures/README.md).`,
    );
  }

  return { csvsImported: imported, missingFilenames: missing };
}
