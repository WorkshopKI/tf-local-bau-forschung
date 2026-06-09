/**
 * v2.59.4: queryUserFoldersRootPermission (non-invasiv) + refreshUserFoldersRootPermission
 * (Gesture-Re-Grant) für den Online-Tab. Mock-Strategie analog
 * listPendingGrants.test.ts: minimaler IDBStore-Stub liefert LIVE-Handle-Mocks
 * (kein structured-clone → query/requestPermission bleiben erhalten).
 */
import { describe, it, expect } from 'vitest';
import {
  SMB_HANDLES_IDB_KEY,
  SMB_HANDLE_USER_FOLDERS_ROOT,
} from '@/core/services/infrastructure/types';
import {
  queryUserFoldersRootPermission,
  refreshUserFoldersRootPermission,
} from '@/core/services/infrastructure/smb-handle';
import type { IDBStore } from '@/core/services/storage/idb-store';

type Perm = 'granted' | 'denied' | 'prompt';

class MockDir {
  requested = false;
  constructor(public perm: Perm = 'prompt') {}
  async queryPermission(): Promise<Perm> {
    return this.perm;
  }
  async requestPermission(): Promise<Perm> {
    this.requested = true;
    this.perm = 'granted';
    return this.perm;
  }
}

function makeIdb(store: Record<string, unknown>): IDBStore {
  return { get: async (key: string) => store[key] } as unknown as IDBStore;
}

describe('queryUserFoldersRootPermission', () => {
  it('liefert den Permission-State des Handles (non-invasiv, kein requestPermission)', async () => {
    const dir = new MockDir('prompt');
    const idb = makeIdb({ [SMB_HANDLES_IDB_KEY]: { [SMB_HANDLE_USER_FOLDERS_ROOT]: dir } });
    expect(await queryUserFoldersRootPermission(idb)).toBe('prompt');
    expect(dir.requested).toBe(false);
  });

  it('liefert "missing", wenn kein Handle in IDB liegt', async () => {
    const idb = makeIdb({ [SMB_HANDLES_IDB_KEY]: {} });
    expect(await queryUserFoldersRootPermission(idb)).toBe('missing');
  });
});

describe('refreshUserFoldersRootPermission', () => {
  it('no-op bei bereits granted (kein erneuter Prompt)', async () => {
    const dir = new MockDir('granted');
    const idb = makeIdb({ [SMB_HANDLES_IDB_KEY]: { [SMB_HANDLE_USER_FOLDERS_ROOT]: dir } });
    expect(await refreshUserFoldersRootPermission(idb)).toBe('granted');
    expect(dir.requested).toBe(false);
  });

  it('ruft requestPermission, wenn Permission verfallen (prompt) → granted', async () => {
    const dir = new MockDir('prompt');
    const idb = makeIdb({ [SMB_HANDLES_IDB_KEY]: { [SMB_HANDLE_USER_FOLDERS_ROOT]: dir } });
    expect(await refreshUserFoldersRootPermission(idb)).toBe('granted');
    expect(dir.requested).toBe(true);
  });

  it('liefert "missing", wenn kein Handle in IDB liegt', async () => {
    const idb = makeIdb({ [SMB_HANDLES_IDB_KEY]: {} });
    expect(await refreshUserFoldersRootPermission(idb)).toBe('missing');
  });
});
