import { describe, it, expect } from 'vitest';
import { memRoot } from '@/core/services/infrastructure/__tests__/mem-fs';
import type { IDBStore } from '@/core/services/storage';
import { mirrorJsonToPersonal, hydrateJsonFromPersonal, removePersonalMirror } from '../state-mirror';
import { workflowRunPath } from '../personal-layout';
import { getWorkflowRun, putWorkflowRun, deleteWorkflowRun } from '@/plugins/antraege/gutachten/workflow-store';
import type { WorkflowRun } from '@/plugins/antraege/gutachten/types';

/** Map-backed Fake-IDB. `getPersoenlichHandle` liest den Handle aus dem
 *  `smb-handles`-Key — vorbelegt mit dem In-Memory-Root (oder null = kein Handle). */
function fakeIdb(persRoot: FileSystemDirectoryHandle | null): { idb: IDBStore; kv: Map<string, unknown> } {
  const kv = new Map<string, unknown>();
  if (persRoot) kv.set('smb-handles', { persoenlich: persRoot });
  const idb = {
    get: async <T>(key: string): Promise<T | null> => (kv.has(key) ? (kv.get(key) as T) : null),
    set: async (key: string, value: unknown): Promise<void> => { kv.set(key, value); },
    delete: async (key: string): Promise<void> => { kv.delete(key); },
  } as unknown as IDBStore;
  return { idb, kv };
}

const makeRun = (az: string): WorkflowRun =>
  ({ aktenzeichen: az, schritte: {}, erstellt_am: '2026-06-12T00:00:00.000Z' } as unknown as WorkflowRun);

describe('state-mirror', () => {
  it('mirror → hydrate Round-Trip', async () => {
    const { idb } = fakeIdb(memRoot());
    await mirrorJsonToPersonal(idb, 'ZAH/antraege/FKZ-1/gutachten/x.json', { a: 1, b: 'zwei' });
    expect(await hydrateJsonFromPersonal(idb, 'ZAH/antraege/FKZ-1/gutachten/x.json')).toEqual({ a: 1, b: 'zwei' });
  });

  it('hydrate = null bei fehlender Datei', async () => {
    const { idb } = fakeIdb(memRoot());
    expect(await hydrateJsonFromPersonal(idb, 'ZAH/fehlt.json')).toBeNull();
  });

  it('ohne persönlichen Ordner: mirror ist no-op, hydrate = null', async () => {
    const { idb } = fakeIdb(null);
    await mirrorJsonToPersonal(idb, 'ZAH/x.json', { a: 1 }); // darf nicht werfen
    expect(await hydrateJsonFromPersonal(idb, 'ZAH/x.json')).toBeNull();
  });

  it('removePersonalMirror entfernt die Spiegel-Datei', async () => {
    const { idb } = fakeIdb(memRoot());
    await mirrorJsonToPersonal(idb, 'ZAH/x.json', { a: 1 });
    await removePersonalMirror(idb, 'ZAH/x.json');
    expect(await hydrateJsonFromPersonal(idb, 'ZAH/x.json')).toBeNull();
  });
});

describe('workflow-store: Browser-Wechsel-Durabilität', () => {
  it('put spiegelt → IDB leeren → get hydratisiert vom Disk-Spiegel + seedet IDB', async () => {
    const { idb, kv } = fakeIdb(memRoot());
    await putWorkflowRun(idb, makeRun('FKZ-1'));

    // Spiegel liegt physisch im persönlichen Ordner:
    expect(await hydrateJsonFromPersonal<WorkflowRun>(idb, workflowRunPath('FKZ-1'))).not.toBeNull();

    // „Browser-Wechsel": IDB-Eintrag weg (Handle/Disk bleiben).
    kv.delete('gutachten-workflow:FKZ-1');
    expect(kv.has('gutachten-workflow:FKZ-1')).toBe(false);

    const restored = await getWorkflowRun(idb, 'FKZ-1');
    expect(restored?.aktenzeichen).toBe('FKZ-1');
    // IDB wurde re-seeded:
    expect(kv.get('gutachten-workflow:FKZ-1')).toBeTruthy();
  });

  it('delete entfernt IDB UND Disk-Spiegel (kein Re-Hydrate)', async () => {
    const { idb, kv } = fakeIdb(memRoot());
    await putWorkflowRun(idb, makeRun('FKZ-2'));
    await deleteWorkflowRun(idb, 'FKZ-2');
    kv.delete('gutachten-workflow:FKZ-2'); // IDB sicher leer
    expect(await getWorkflowRun(idb, 'FKZ-2')).toBeNull();
  });
});
