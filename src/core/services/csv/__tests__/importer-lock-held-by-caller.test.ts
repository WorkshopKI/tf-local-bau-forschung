/**
 * `ImportOptions.lockHeldByCaller` (v3.46.1).
 *
 * Der Auto-Refresh hält den Build-Lock seit v3.46.1 EINMAL über den ganzen Lauf;
 * der Importer darf ihn dann weder nehmen noch freigeben — sonst entstünde
 * genau das Freigabe-Fenster zwischen zwei Quellen zurück, in dem ein noch
 * laufender Heartbeat-Schlag die gelöschte Lock-Datei neu anlegte.
 *
 * Die Gegenprobe ist genauso wichtig: die vier Dialog-Aufrufer (Wizard,
 * Re-Import, Neue Spalten, Remap) setzen die Option NICHT und müssen weiter
 * selbst locken.
 *
 * Header-only-CSV → 0 Datenzeilen → keine Deltas, kein Merge/Snapshot-Stack.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

const h = vi.hoisted(() => {
  const stop = vi.fn(async () => undefined);
  return {
    acquire: vi.fn(async () => ({ acquired: true as const, lock: {} })),
    force: vi.fn(async () => ({})),
    release: vi.fn(async () => 'freigegeben'),
    stop,
    startHeartbeat: vi.fn(() => ({ stop })),
  };
});

vi.mock('../../infrastructure/build-lock', () => ({
  acquireBuildLock: h.acquire,
  forceLock: h.force,
  releaseLock: h.release,
  startHeartbeat: h.startHeartbeat,
  readBuildLock: vi.fn(async () => null),
  isStale: vi.fn(() => false),
  heartbeat: vi.fn(async () => undefined),
  HEARTBEAT_INTERVAL_MS: 15_000,
}));

import { IDBStore } from '../../storage/idb-store';
import { putProgramm } from '../idb-csv';
import { saveSchema } from '../schemaRegistry';
import { importCsvSource } from '../importer';
import type { CsvSchema, Programm } from '../types';

const PID = 'p1';
const HEADER_ONLY_CSV = 'AZ\n';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  h.acquire.mockClear();
  h.force.mockClear();
  h.release.mockClear();
  h.stop.mockClear();
  h.startHeartbeat.mockClear();
});

async function vorbereiten(): Promise<IDBStore> {
  const idb = new IDBStore();
  await idb.open();
  const programm: Programm = {
    id: PID, name: 'P1', created_at: '2026-06-03T00:00:00.000Z', smb_handle_key: 'daten-share',
  };
  await putProgramm(idb, programm);
  const schema: CsvSchema = {
    id: 'schema-1',
    programm_id: PID,
    csv_source_name: '7737_Bgl',
    is_master: false,
    join_key: 'aktenzeichen',
    priority: 50,
    column_mapping: { AZ: { canonical: 'aktenzeichen' } },
    encoding: 'UTF-8',
    separator: ';',
    created_at: '2026-06-03T00:00:00.000Z',
  };
  await saveSchema(idb, schema);
  return idb;
}

describe('importCsvSource — Lock beim Aufrufer', () => {
  it('lockHeldByCaller: fasst weder Lock noch Heartbeat an', async () => {
    const idb = await vorbereiten();
    const datei = new File([HEADER_ONLY_CSV], 'q.csv', { lastModified: 1_717_000_000_000 });

    await importCsvSource(idb, 'schema-1', datei, { lockHeldByCaller: true, force: true });

    expect(h.acquire).not.toHaveBeenCalled();
    expect(h.force).not.toHaveBeenCalled();
    expect(h.startHeartbeat).not.toHaveBeenCalled();
    expect(h.release).not.toHaveBeenCalled();
  });

  it('ohne die Option lockt der Importer weiter selbst (Dialog-Pfade)', async () => {
    const idb = await vorbereiten();
    const datei = new File([HEADER_ONLY_CSV], 'q.csv', { lastModified: 1_717_000_000_000 });

    await importCsvSource(idb, 'schema-1', datei, { force: true });

    expect(h.acquire).toHaveBeenCalledTimes(1);
    expect(h.startHeartbeat).toHaveBeenCalledTimes(1);
    // Erst den laufenden Schlag abwarten, DANN freigeben.
    expect(h.stop).toHaveBeenCalledTimes(1);
    expect(h.release).toHaveBeenCalledTimes(1);
    expect(h.stop.mock.invocationCallOrder[0]!).toBeLessThan(h.release.mock.invocationCallOrder[0]!);
  });
});
