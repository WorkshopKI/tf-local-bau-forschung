import { describe, it, expect } from 'vitest';
import { memRoot } from '@/core/services/infrastructure/__tests__/mem-fs';
import type { IDBStore } from '@/core/services/storage';
import { backupGutachtenStateToPersonal } from '../gutachten-backup';
import { hydrateJsonFromPersonal } from '../state-mirror';
import { workflowRunPath, kurzfassungPath, batchJobPath } from '../personal-layout';

/** Map-backed Fake-IDB mit entries()/keys()-Prefix-Filter wie der echte IDBStore. */
function fakeIdb(persRoot: FileSystemDirectoryHandle | null): { idb: IDBStore; kv: Map<string, unknown> } {
  const kv = new Map<string, unknown>();
  if (persRoot) kv.set('smb-handles', { persoenlich: persRoot });
  const idb = {
    get: async <T>(key: string): Promise<T | null> => (kv.has(key) ? (kv.get(key) as T) : null),
    set: async (key: string, value: unknown): Promise<void> => { kv.set(key, value); },
    delete: async (key: string): Promise<void> => { kv.delete(key); },
    entries: async (prefix?: string): Promise<Array<[string, unknown]>> =>
      [...kv.entries()].filter(([k]) => !prefix || k.startsWith(prefix)),
    keys: async (prefix?: string): Promise<string[]> =>
      [...kv.keys()].filter(k => !prefix || k.startsWith(prefix)),
  } as unknown as IDBStore;
  return { idb, kv };
}

describe('backupGutachtenStateToPersonal', () => {
  it('spiegelt vorhandene Workflow-/Kurzfassung-Records in den persönlichen Ordner', async () => {
    const { idb, kv } = fakeIdb(memRoot());
    kv.set('gutachten-workflow:FKZ-1', { aktenzeichen: 'FKZ-1', geaendert_am: '2026-06-12T10:00:00.000Z' });
    kv.set('gutachten-workflow:FKZ-2', { aktenzeichen: 'FKZ-2', geaendert_am: '2026-06-12T11:00:00.000Z' });
    kv.set('gutachten-kurzfassung:FKZ-1', { key: 'FKZ-1', geaendert_am: '2026-06-12T09:00:00.000Z' });

    expect(await backupGutachtenStateToPersonal(idb)).toBe(3);
    expect(await hydrateJsonFromPersonal(idb, workflowRunPath('FKZ-1'))).toMatchObject({ aktenzeichen: 'FKZ-1' });
    expect(await hydrateJsonFromPersonal(idb, workflowRunPath('FKZ-2'))).toMatchObject({ aktenzeichen: 'FKZ-2' });
    expect(await hydrateJsonFromPersonal(idb, kurzfassungPath('FKZ-1'))).toMatchObject({ key: 'FKZ-1' });
  });

  it('spiegelt Runs unter dem neuen Key workflow-run:<typ>:<scope> (ga + nf, disjunkte Pfade)', async () => {
    const { idb, kv } = fakeIdb(memRoot());
    kv.set('workflow-run:ga:FKZ-1', { aktenzeichen: 'FKZ-1', geaendert_am: '2026-06-22T10:00:00.000Z' });
    kv.set('workflow-run:nf:FKZ-1', { aktenzeichen: 'FKZ-1', geaendert_am: '2026-06-22T11:00:00.000Z' });

    expect(await backupGutachtenStateToPersonal(idb)).toBe(2);
    // GA + NF mit gleicher scopeId → disjunkte Disk-Pfade.
    expect(await hydrateJsonFromPersonal(idb, workflowRunPath('FKZ-1', 'ga'))).toMatchObject({ aktenzeichen: 'FKZ-1' });
    expect(await hydrateJsonFromPersonal(idb, workflowRunPath('FKZ-1', 'nf'))).toMatchObject({ aktenzeichen: 'FKZ-1' });
  });

  it('idempotent: zweiter Lauf schreibt nichts (Disk aktuell)', async () => {
    const { idb, kv } = fakeIdb(memRoot());
    kv.set('gutachten-workflow:FKZ-1', { aktenzeichen: 'FKZ-1', geaendert_am: '2026-06-12T10:00:00.000Z' });
    expect(await backupGutachtenStateToPersonal(idb)).toBe(1);
    expect(await backupGutachtenStateToPersonal(idb)).toBe(0);
  });

  it('spiegelt erneut, wenn der IDB-Stand neuer ist als die Disk-Kopie', async () => {
    const { idb, kv } = fakeIdb(memRoot());
    kv.set('gutachten-workflow:FKZ-1', { aktenzeichen: 'FKZ-1', geaendert_am: '2026-06-12T10:00:00.000Z' });
    expect(await backupGutachtenStateToPersonal(idb)).toBe(1);
    kv.set('gutachten-workflow:FKZ-1', { aktenzeichen: 'FKZ-1', geaendert_am: '2026-06-12T12:00:00.000Z', neu: true });
    expect(await backupGutachtenStateToPersonal(idb)).toBe(1);
    expect(await hydrateJsonFromPersonal(idb, workflowRunPath('FKZ-1'))).toMatchObject({ neu: true });
  });

  it('ohne persönlichen Ordner: no-op (0)', async () => {
    const { idb, kv } = fakeIdb(null);
    kv.set('gutachten-workflow:FKZ-1', { aktenzeichen: 'FKZ-1', geaendert_am: '2026-06-12T10:00:00.000Z' });
    expect(await backupGutachtenStateToPersonal(idb)).toBe(0);
  });

  it('Batch-Singleton wird gespiegelt, wenn auf der Platte fehlt (sonst nicht)', async () => {
    const { idb, kv } = fakeIdb(memRoot());
    kv.set('gutachten-batch:aktiv', { id: 'job-1', status: 'pausiert' });
    expect(await backupGutachtenStateToPersonal(idb)).toBe(1);
    expect(await hydrateJsonFromPersonal(idb, batchJobPath())).toMatchObject({ id: 'job-1' });
    expect(await backupGutachtenStateToPersonal(idb)).toBe(0);
  });
});
