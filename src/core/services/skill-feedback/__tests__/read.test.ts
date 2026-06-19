import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { StorageService } from '@/core/services/storage';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { appendToFile } from '@/core/services/infrastructure/atomic-write';
import { memRoot } from '@/core/services/infrastructure/__tests__/mem-fs';
import * as smb from '@/core/services/infrastructure/smb-handle';
import { collectAllEvents, parseJsonlEvents, readAggregate } from '../read';
import { AGGREGATE_CACHE_KEY } from '../cache';
import { personalSignalPath, sharedSignalPath } from '../layout';

vi.mock('@/core/services/infrastructure/smb-handle', () => ({
  getDatenShareHandle: vi.fn(),
  getPersoenlichHandle: vi.fn(),
}));

function fakeIdb(seed: Record<string, unknown> = {}): { idb: IDBStore; kv: Map<string, unknown> } {
  const kv = new Map<string, unknown>(Object.entries(seed));
  const idb = {
    get: async <T>(key: string): Promise<T | null> => (kv.has(key) ? (kv.get(key) as T) : null),
    set: async (key: string, value: unknown): Promise<void> => { kv.set(key, value); },
    delete: async (key: string): Promise<void> => { kv.delete(key); },
  } as unknown as IDBStore;
  return { idb, kv };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseJsonlEvents', () => {
  it('überspringt defekte und verbotene Zeilen', () => {
    const text = [
      JSON.stringify({ skillId: 's', skillVersion: 1, event: 'lauf', ts: 't', userId: 'U' }),
      '{ kaputt',
      '',
      JSON.stringify({ skillId: 's', rating: 'nope', ts: 't', userId: 'U' }), // ungültiges rating → verworfen
      JSON.stringify({ skillId: 's', skillVersion: 1, rating: 'up', ts: 't2', userId: 'U' }),
    ].join('\n');
    const events = parseJsonlEvents(text);
    expect(events).toHaveLength(2);
  });
});

describe('collectAllEvents — Vereinigung Share + Personal', () => {
  it('liest Events aus beiden Quellen', async () => {
    const share = memRoot();
    const pers = memRoot();
    await appendToFile(share, sharedSignalPath('usage', 'AB'), JSON.stringify({ skillId: 's1', skillVersion: 1, event: 'lauf', ts: 't1', userId: 'AB' }));
    await appendToFile(pers, personalSignalPath('feedback', 'CD'), JSON.stringify({ skillId: 's1', skillVersion: 1, rating: 'up', ts: 't2', userId: 'CD' }));
    vi.mocked(smb.getDatenShareHandle).mockResolvedValue(share);
    vi.mocked(smb.getPersoenlichHandle).mockResolvedValue(pers);

    const { idb } = fakeIdb();
    const events = await collectAllEvents({ idb } as StorageService);
    expect(events).toHaveLength(2);
  });
});

describe('readAggregate — Cache-Miss/Hit', () => {
  it('Miss: scannt Dateien, rechnet, schreibt den Cache', async () => {
    const share = memRoot();
    await appendToFile(share, sharedSignalPath('usage', 'AB'), JSON.stringify({ skillId: 's1', skillVersion: 1, event: 'lauf', ts: 't1', userId: 'AB' }));
    await appendToFile(share, sharedSignalPath('feedback', 'AB'), JSON.stringify({ skillId: 's1', skillVersion: 1, rating: 'up', ts: 't2', userId: 'AB', notiz: 'gut' }));
    vi.mocked(smb.getDatenShareHandle).mockResolvedValue(share);
    vi.mocked(smb.getPersoenlichHandle).mockResolvedValue(null);

    const { idb, kv } = fakeIdb();
    const map = await readAggregate({ idb } as StorageService);
    const e = map.get('s1')!;
    expect(e).toMatchObject({ nutzung: 1, up: 1, down: 0, letzteNutzung: 't1' });
    expect(e.kommentare).toHaveLength(1);
    // Cache wurde geschrieben.
    expect(kv.has(AGGREGATE_CACHE_KEY)).toBe(true);
  });

  it('Hit: liefert den Cache ohne Datei-Scan', async () => {
    const { idb } = fakeIdb({
      [AGGREGATE_CACHE_KEY]: { s9: { nutzung: 5, up: 1, down: 0, letzteNutzung: 'tX', kommentare: [] } },
    });
    const map = await readAggregate({ idb } as StorageService);
    expect(map.get('s9')!.nutzung).toBe(5);
    expect(smb.getDatenShareHandle).not.toHaveBeenCalled();
    expect(smb.getPersoenlichHandle).not.toHaveBeenCalled();
  });
});
