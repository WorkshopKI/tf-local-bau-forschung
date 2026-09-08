/**
 * Regression: `importCsvSource` stempelt `source_last_modified` + `source_file_name`
 * VOR `saveSchema`/`writeProgrammSnapshot`, wenn ihm ein echtes `File` übergeben
 * wird. Ohne diese Stempelung trug der Share-Snapshot einen veralteten/leeren
 * Baseline → Snapshot-only-Konsumenten (pl / nach „clear site data") meldeten die
 * Quelle bei jedem Cold-Start fälschlich als „neue Daten" (Auto-Refresh-Fehlalarm,
 * checkSourceForUpdate). Der `instanceof File`-Guard schützt den Recompute-/SMB-
 * Reimport-Pfad, der einen Blob ohne sinnvolle `lastModified` übergibt.
 *
 * Test-Strategie: Header-only-CSV (0 Datenzeilen) → keine Deltas → Merge/Snapshot/
 * Phase-2 werden übersprungen, aber `saveSchema(updatedSchema)` läuft regulär. So
 * isoliert der Test genau die gestempelten Felder ohne den vollen Merge-Stack.
 * Der Build-Lock wird gemockt (no-op) — ohne SMB-Handle/kurator-config wäre er im
 * node-Test-Env sonst nicht erfüllbar; er ist für die getestete Logik irrelevant.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('../../infrastructure/build-lock', () => ({
  acquireBuildLock: vi.fn(async () => ({ acquired: true, lock: {} })),
  forceLock: vi.fn(async () => ({})),
  releaseLock: vi.fn(async () => undefined),
  readBuildLock: vi.fn(async () => null),
  isStale: vi.fn(() => false),
  // v2.61.5: Importer hält den Lock per Heartbeat frisch. v3.46.1: über einen
  // Runner, dessen stop() den laufenden Schlag abwartet.
  heartbeat: vi.fn(async () => undefined),
  startHeartbeat: vi.fn(() => ({ stop: vi.fn(async () => undefined) })),
  HEARTBEAT_INTERVAL_MS: 15_000,
}));

import { IDBStore } from '../../storage/idb-store';
import { putProgramm } from '../idb-csv';
import { saveSchema, loadSchema } from '../schemaRegistry';
import { importCsvSource } from '../importer';
import { leseLokaleStempel } from '../lokaler-stempel';
import { sha1Hex } from '../sha1';
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

function makeProgramm(id: string): Programm {
  return { id, name: `P ${id}`, created_at: '2026-06-03T00:00:00.000Z', smb_handle_key: 'daten-share' };
}

function makeSchema(): CsvSchema {
  return {
    id: 'schema-1',
    programm_id: PID,
    csv_source_name: '9052_PrjBsp',
    is_master: false,
    join_key: 'aktenzeichen',
    priority: 50,
    // Join-Spalte muss im Mapping per canonical auffindbar sein (findJoinColumn).
    column_mapping: { AZ: { canonical: 'aktenzeichen' } },
    encoding: 'UTF-8',
    separator: ';',
    created_at: '2026-06-03T00:00:00.000Z',
  };
}

// Header-only → 0 Datenzeilen → keine Deltas (Merge/Snapshot/Phase-2 übersprungen).
const HEADER_ONLY_CSV = 'AZ\n';

describe('importCsvSource — source-Baseline-Stempelung', () => {
  it('stempelt source_last_modified + source_file_name aus einem File (vor saveSchema)', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    await saveSchema(idb, makeSchema());

    const T = 1_717_000_000_000; // fixer epoch-ms (kein Date.now() → deterministisch)
    const file = new File([HEADER_ONLY_CSV], 'quelle.csv', { type: 'text/csv', lastModified: T });

    await importCsvSource(idb, 'schema-1', file, { force: true });

    const persisted = await loadSchema(idb, 'schema-1');
    expect(persisted?.source_last_modified).toBe(T);
    expect(persisted?.source_file_name).toBe('quelle.csv');
    // file_checksum wird im selben updatedSchema gesetzt — Beleg, dass der
    // Stempel im regulären (nicht-skip) Pfad lief.
    expect(persisted?.file_checksum).toBeTruthy();
  });

  it('lässt source_last_modified unangetastet, wenn ein reiner Blob importiert wird (Guard)', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    await saveSchema(idb, makeSchema());

    const blob = new Blob([HEADER_ONLY_CSV], { type: 'text/csv' });
    await importCsvSource(idb, 'schema-1', blob, { force: true });

    const persisted = await loadSchema(idb, 'schema-1');
    expect(persisted?.source_last_modified).toBeUndefined();
    expect(persisted?.source_file_name).toBeUndefined();
  });
});

/**
 * Lokaler Import-Stempel (Sept. 2026): „DIESER Rechner hat DIESE Datei
 * importiert" — im kv-Store, nie im Schema, also nie Teil des Snapshots. Der
 * Team-Stempel im Schema wird beim Sync durch die Sicht des letzten
 * Publizierers ersetzt; der lokale Beleg bleibt und verhindert, dass die eigene
 * Datei danach wieder als „neu" gilt.
 */
describe('importCsvSource — lokaler Import-Stempel', () => {
  const T = 1_717_000_000_000;

  it('schreibt den lokalen Stempel dieses Rechners und liefert den Datei-Checksum zurück', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    await saveSchema(idb, makeSchema());
    const file = new File([HEADER_ONLY_CSV], 'quelle.csv', { type: 'text/csv', lastModified: T });

    const result = await importCsvSource(idb, 'schema-1', file, { force: true });

    const checksum = await sha1Hex(new Blob([HEADER_ONLY_CSV]));
    expect(result.fileChecksum).toBe(checksum);
    const lokal = (await leseLokaleStempel(idb))['schema-1'];
    expect(lokal).toMatchObject({ fileName: 'quelle.csv', lastModified: T, size: file.size, checksum });
    expect(lokal?.importedAt).toBeTruthy();
    // Der Beleg gehört NICHT ins Schema — dort stünde er im Snapshot.
    const persisted = await loadSchema(idb, 'schema-1') as Record<string, unknown> | null;
    expect(persisted).not.toHaveProperty('lokalerStempel');
  });

  it('auch der Checksum-Skip (byte-gleiche Datei) setzt den lokalen Stempel', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    const checksum = await sha1Hex(new Blob([HEADER_ONLY_CSV]));
    await saveSchema(idb, { ...makeSchema(), file_checksum: checksum });
    const file = new File([HEADER_ONLY_CSV], 'quelle.csv', { type: 'text/csv', lastModified: T });

    const result = await importCsvSource(idb, 'schema-1', file);

    expect(result.skipped).toBe(true);
    expect(result.fileChecksum).toBe(checksum);
    expect((await leseLokaleStempel(idb))['schema-1']).toMatchObject({ lastModified: T, size: file.size, checksum });
  });

  it('ein reiner Blob hinterlässt keinen lokalen Stempel', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    await saveSchema(idb, makeSchema());

    await importCsvSource(idb, 'schema-1', new Blob([HEADER_ONLY_CSV], { type: 'text/csv' }), { force: true });

    expect(await leseLokaleStempel(idb)).toEqual({});
  });
});
