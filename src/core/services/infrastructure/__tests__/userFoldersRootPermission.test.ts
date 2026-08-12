/**
 * v2.59.4 / v4.1: Berechtigungen der Wurzeln der persönlichen Ordner.
 *
 * `queryUserFoldersRootPermissions` ist non-invasiv (Auto-Load + 45-s-Timer im
 * Online-Tab hängen daran), `refreshUserFoldersRootPermission` behandelt GENAU
 * EINE Wurzel — unter `file://` verbraucht jeder Prompt die User-Activation.
 *
 * Mock-Strategie analog `listPendingGrants.test.ts`: minimaler IDBStore-Stub
 * liefert LIVE-Handle-Mocks (kein structured-clone → query/requestPermission
 * bleiben erhalten).
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/config/personal-roots', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/personal-roots')>();
  return { ...actual, personalRoots: () => [{ id: 'pl', label: 'PL-Ordner' }] };
});

import {
  SMB_HANDLES_IDB_KEY,
  SMB_HANDLE_USER_FOLDERS_ROOT,
  userFoldersRootSlotKey,
} from '@/core/services/infrastructure/types';
import {
  getUserFoldersRoots,
  queryUserFoldersRootPermissions,
  refreshUserFoldersRootPermission,
} from '@/core/services/infrastructure/smb-handle';
import { PERSONAL_ROOT_LEGACY_ID } from '@/config/personal-roots';
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

describe('getUserFoldersRoots', () => {
  it('liefert JEDE konfigurierte Wurzel — auch die nicht verbundene', async () => {
    // Das ist die Zusage, auf der der Sammel-Bericht steht: nicht verbundene
    // Wurzeln duerfen nicht aus der Liste fallen, sonst sieht Teil-Einsammeln
    // aus wie Erfolg.
    const idb = makeIdb({ [SMB_HANDLES_IDB_KEY]: {} });
    const roots = await getUserFoldersRoots(idb);
    expect(roots.map(r => r.id)).toEqual(['pl']);
    expect(roots[0]?.handle).toBeNull();
  });

  it('haengt den Alt-Slot als eigenen Eintrag an — ohne ihn einer Gruppe zuzuordnen', async () => {
    const alt = new MockDir('granted');
    const idb = makeIdb({ [SMB_HANDLES_IDB_KEY]: { [SMB_HANDLE_USER_FOLDERS_ROOT]: alt } });
    const roots = await getUserFoldersRoots(idb);
    expect(roots.map(r => r.id)).toEqual(['pl', PERSONAL_ROOT_LEGACY_ID]);
    expect(roots[0]?.handle).toBeNull();      // 'pl' bleibt leer …
    expect(roots[1]?.handle).toBe(alt);        // … der Alt-Ordner steht daneben
    expect(roots[1]?.legacy).toBe(true);
  });

  it('erfasst den Alt-Slot NICHT ueber den Praefix (kein Doppel-Eintrag)', async () => {
    const alt = new MockDir('granted');
    const pl = new MockDir('granted');
    const idb = makeIdb({
      [SMB_HANDLES_IDB_KEY]: {
        [SMB_HANDLE_USER_FOLDERS_ROOT]: alt,
        [userFoldersRootSlotKey('pl')]: pl,
      },
    });
    const roots = await getUserFoldersRoots(idb);
    expect(roots.map(r => r.id)).toEqual(['pl', PERSONAL_ROOT_LEGACY_ID]);
    expect(roots[0]?.handle).toBe(pl);
  });

  it('prompt-Handles NICHT anfragen (Mount-/Timer-Pfad ohne Gesture)', async () => {
    const pl = new MockDir('prompt');
    const idb = makeIdb({ [SMB_HANDLES_IDB_KEY]: { [userFoldersRootSlotKey('pl')]: pl } });
    await getUserFoldersRoots(idb);
    expect(pl.requested).toBe(false);
  });
});

describe('queryUserFoldersRootPermissions', () => {
  it('liefert den Zustand je Wurzel (non-invasiv, kein requestPermission)', async () => {
    const pl = new MockDir('prompt');
    const idb = makeIdb({ [SMB_HANDLES_IDB_KEY]: { [userFoldersRootSlotKey('pl')]: pl } });
    expect(await queryUserFoldersRootPermissions(idb)).toEqual({ pl: 'prompt' });
    expect(pl.requested).toBe(false);
  });

  it('nicht verbundene Wurzeln stehen als "missing" drin, statt zu fehlen', async () => {
    const idb = makeIdb({ [SMB_HANDLES_IDB_KEY]: {} });
    expect(await queryUserFoldersRootPermissions(idb)).toEqual({ pl: 'missing' });
  });
});

describe('refreshUserFoldersRootPermission', () => {
  it('no-op bei bereits granted (kein erneuter Prompt)', async () => {
    const dir = new MockDir('granted');
    const idb = makeIdb({ [SMB_HANDLES_IDB_KEY]: { [userFoldersRootSlotKey('pl')]: dir } });
    expect(await refreshUserFoldersRootPermission(idb, 'pl')).toBe('granted');
    expect(dir.requested).toBe(false);
  });

  it('ruft requestPermission, wenn Permission verfallen (prompt) → granted', async () => {
    const dir = new MockDir('prompt');
    const idb = makeIdb({ [SMB_HANDLES_IDB_KEY]: { [userFoldersRootSlotKey('pl')]: dir } });
    expect(await refreshUserFoldersRootPermission(idb, 'pl')).toBe('granted');
    expect(dir.requested).toBe(true);
  });

  it('fragt NUR die genannte Wurzel an (ein Prompt pro Geste)', async () => {
    const pl = new MockDir('prompt');
    const alt = new MockDir('prompt');
    const idb = makeIdb({
      [SMB_HANDLES_IDB_KEY]: {
        [userFoldersRootSlotKey('pl')]: pl,
        [SMB_HANDLE_USER_FOLDERS_ROOT]: alt,
      },
    });
    await refreshUserFoldersRootPermission(idb, 'pl');
    expect(pl.requested).toBe(true);
    expect(alt.requested).toBe(false);
  });

  it('erreicht den Alt-Ordner ueber die Id "legacy"', async () => {
    const alt = new MockDir('prompt');
    const idb = makeIdb({ [SMB_HANDLES_IDB_KEY]: { [SMB_HANDLE_USER_FOLDERS_ROOT]: alt } });
    expect(await refreshUserFoldersRootPermission(idb, PERSONAL_ROOT_LEGACY_ID)).toBe('granted');
    expect(alt.requested).toBe(true);
  });

  it('liefert "missing", wenn kein Handle in IDB liegt', async () => {
    const idb = makeIdb({ [SMB_HANDLES_IDB_KEY]: {} });
    expect(await refreshUserFoldersRootPermission(idb, 'pl')).toBe('missing');
  });
});
