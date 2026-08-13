/**
 * Regression (Wurzel „Löschung ohne Plausibilitätsprüfung", Tür 2):
 * `findJoinColumn` löste die Join-Spalte gegen das `column_mapping` auf, NICHT
 * gegen die gelesene Kopfzeile. Wird die Join-Spalte im Export umbenannt oder
 * fällt sie weg, bleibt das Mapping formal gültig — der Import lief durch,
 * `row[joinCol]` war in JEDER Zeile leer, `seen` blieb leer, und alle bisherigen
 * Join-Werte landeten in `removedJoinValues`. Ergebnis: der komplette Bestand der
 * Quelle wurde gelöscht und (im Auto-Refresh) team-weit publiziert, während die
 * Quelle als erfolgreich importiert gestempelt wurde und nie wieder anlief.
 *
 * Test-Strategie wie in importer-source-baseline.test.ts: Build-Lock gemockt
 * (im node-Env ohne SMB-Handle nicht erfüllbar, für die Logik irrelevant).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('../../infrastructure/build-lock', () => ({
  acquireBuildLock: vi.fn(async () => ({ acquired: true, lock: {} })),
  forceLock: vi.fn(async () => ({})),
  releaseLock: vi.fn(async () => undefined),
  readBuildLock: vi.fn(async () => null),
  isStale: vi.fn(() => false),
  heartbeat: vi.fn(async () => undefined),
  startHeartbeat: vi.fn(() => ({ stop: vi.fn(async () => undefined) })),
  HEARTBEAT_INTERVAL_MS: 15_000,
}));

import { IDBStore } from '../../storage/idb-store';
import { putProgramm, getRowHashesForSchema } from '../idb-csv';
import { saveSchema, loadSchema } from '../schemaRegistry';
import { importCsvSource } from '../importer';
import type { CsvSchema, Programm } from '../types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

async function freshIdb(): Promise<IDBStore> {
  const s = new IDBStore();
  await s.open();
  return s;
}

const PID = 'p1';
const SID = 'schema-1';

function makeProgramm(id: string): Programm {
  return { id, name: `P ${id}`, created_at: '2026-06-03T00:00:00.000Z', smb_handle_key: 'daten-share' };
}

function makeSchema(): CsvSchema {
  return {
    id: SID,
    programm_id: PID,
    csv_source_name: '9097_AnB',
    is_master: false,
    join_key: 'aktenzeichen',
    priority: 50,
    column_mapping: {
      FKZ: { canonical: 'aktenzeichen' },
      TITEL: { canonical: 'titel' },
    },
    encoding: 'UTF-8',
    separator: ';',
    created_at: '2026-06-03T00:00:00.000Z',
  };
}

const CSV_OK = 'FKZ;TITEL\n16EP0001;Alpha\n16EP0002;Beta\n16EP0003;Gamma\n';
// Derselbe Inhalt, nur die Join-Spalte heißt anders (C16-Export umbenannt).
const CSV_JOIN_UMBENANNT = 'FKZ_NEU;TITEL\n16EP0001;Alpha\n16EP0002;Beta\n16EP0003;Gamma\n';
// Join-Spalte ersatzlos weg.
const CSV_JOIN_WEG = 'TITEL\nAlpha\nBeta\nGamma\n';

async function importFirst(idb: IDBStore): Promise<void> {
  await putProgramm(idb, makeProgramm(PID));
  await saveSchema(idb, makeSchema());
  const r = await importCsvSource(idb, SID, new Blob([CSV_OK], { type: 'text/csv' }), { force: true });
  expect(r.buckets.new).toBe(3);
  expect((await getRowHashesForSchema(idb, SID)).length).toBe(3);
}

describe('importCsvSource — Join-Spalte muss in der gelesenen Kopfzeile stehen', () => {
  it('bricht ab, statt den ganzen Bestand der Quelle zu löschen, wenn die Join-Spalte umbenannt wurde', async () => {
    const idb = await freshIdb();
    await importFirst(idb);
    const checksumVorher = (await loadSchema(idb, SID))?.file_checksum;

    await expect(
      importCsvSource(idb, SID, new Blob([CSV_JOIN_UMBENANNT], { type: 'text/csv' }), { force: true }),
    ).rejects.toThrow(/Join-Spalte "FKZ".*(nicht|fehlt)/i);

    // Nichts gelöscht: die Row-Hashes der Quelle stehen unverändert.
    expect((await getRowHashesForSchema(idb, SID)).length).toBe(3);
    // Und die Quelle ist NICHT als erledigt gestempelt — sonst liefe der
    // Auto-Refresh nie wieder an und der Fehler bliebe unbemerkt stehen.
    expect((await loadSchema(idb, SID))?.file_checksum).toBe(checksumVorher);
  });

  it('bricht ebenso ab, wenn die Join-Spalte ersatzlos aus dem Export fällt', async () => {
    const idb = await freshIdb();
    await importFirst(idb);

    await expect(
      importCsvSource(idb, SID, new Blob([CSV_JOIN_WEG], { type: 'text/csv' }), { force: true }),
    ).rejects.toThrow(/Join-Spalte "FKZ"/i);

    expect((await getRowHashesForSchema(idb, SID)).length).toBe(3);
  });

  it('importiert unverändert weiter, solange die Join-Spalte in der Kopfzeile steht', async () => {
    const idb = await freshIdb();
    await importFirst(idb);

    // Echte Löschung im Fachsystem: eine Zeile fällt weg, Spalte ist da.
    const r = await importCsvSource(
      idb,
      SID,
      new Blob(['FKZ;TITEL\n16EP0001;Alpha\n16EP0002;Beta\n'], { type: 'text/csv' }),
      { force: true },
    );
    expect(r.buckets.removed).toBe(1);
    expect((await getRowHashesForSchema(idb, SID)).length).toBe(2);
  });
});
