/**
 * v2.55: Guided-Grant-Stepper — `listPendingGrants` liefert pro noch-nicht-
 * granted Handle genau einen Klick-Schritt (Daten-Share → persönlich →
 * CSV-Quelle). Sichert Reihenfolge, Mode-Wahl (canWriteDatenShare) und die
 * bewusste Auslassung der kurator-only-Slots (User-Folders-Root, DMS) ab.
 *
 * Mock-Strategie analog csv-dir-handle.test.ts: ein minimaler IDBStore-Stub
 * (`get`) liefert LIVE-Handle-Mocks zurück (kein structured-clone → Methoden
 * bleiben erhalten). Die drei Feature-Flag-Helfer werden gestubbt, um Rollen
 * (pl/prod/kurator-pre-login) deterministisch zu simulieren.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/config/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/feature-flags')>();
  return {
    ...actual,
    canWriteDatenShare: vi.fn(),
    isKuratorMenusEnabled: vi.fn(),
    isCsvAutoRefreshEnabled: vi.fn(),
  };
});

import {
  SMB_HANDLES_IDB_KEY,
  SMB_HANDLE_DATEN_SHARE,
  SMB_HANDLE_PERSOENLICH,
  SMB_HANDLE_USER_FOLDERS_ROOT,
  CSV_SOURCE_DIR_HANDLE_IDB_KEY,
  dmsSourceSlotKey,
} from '@/core/services/infrastructure/types';
import { listPendingGrants } from '@/core/services/infrastructure/smb-handle';
import type { IDBStore } from '@/core/services/storage/idb-store';
import {
  canWriteDatenShare,
  isKuratorMenusEnabled,
  isCsvAutoRefreshEnabled,
} from '@/config/feature-flags';

type Perm = 'granted' | 'denied' | 'prompt';

class MockDir {
  constructor(public perm: Perm = 'prompt') {}
  async queryPermission(): Promise<Perm> {
    return this.perm;
  }
  async requestPermission(): Promise<Perm> {
    this.perm = 'granted';
    return this.perm;
  }
}

function makeIdb(store: Record<string, unknown>): IDBStore {
  return { get: async (key: string) => store[key] } as unknown as IDBStore;
}

const mockCanWrite = canWriteDatenShare as unknown as ReturnType<typeof vi.fn>;
const mockKuratorMenus = isKuratorMenusEnabled as unknown as ReturnType<typeof vi.fn>;
const mockCsvAuto = isCsvAutoRefreshEnabled as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockCanWrite.mockReturnValue(false);
  mockKuratorMenus.mockReturnValue(false);
  mockCsvAuto.mockReturnValue(false);
});

describe('listPendingGrants', () => {
  it('pl: alle drei Handles ungranted → Daten-Share rw, persönlich rw, CSV read (in Reihenfolge)', async () => {
    mockCanWrite.mockReturnValue(true); // pl: datenShareSchreibrecht
    mockCsvAuto.mockReturnValue(true);
    const idb = makeIdb({
      [SMB_HANDLES_IDB_KEY]: {
        [SMB_HANDLE_DATEN_SHARE]: new MockDir('prompt'),
        [SMB_HANDLE_PERSOENLICH]: new MockDir('prompt'),
      },
      [CSV_SOURCE_DIR_HANDLE_IDB_KEY]: new MockDir('prompt'),
    });
    const pending = await listPendingGrants(idb, { isKurator: false });
    expect(pending.map(p => [p.slot, p.mode])).toEqual([
      ['daten-share', 'readwrite'],
      ['persoenlich', 'readwrite'],
      ['csv-source', 'read'],
    ]);
  });

  it('prod: nur Daten-Share (read); CSV-Gate aus → CSV nicht aufgenommen, kein persönlich', async () => {
    mockCanWrite.mockReturnValue(false);
    mockCsvAuto.mockReturnValue(false);
    const idb = makeIdb({
      [SMB_HANDLES_IDB_KEY]: { [SMB_HANDLE_DATEN_SHARE]: new MockDir('prompt') },
      [CSV_SOURCE_DIR_HANDLE_IDB_KEY]: new MockDir('prompt'), // vorhanden, aber gated-off
    });
    const pending = await listPendingGrants(idb, { isKurator: false });
    expect(pending.map(p => [p.slot, p.mode])).toEqual([['daten-share', 'read']]);
  });

  it('überspringt bereits granted Handles', async () => {
    mockCanWrite.mockReturnValue(true);
    mockCsvAuto.mockReturnValue(true);
    const idb = makeIdb({
      [SMB_HANDLES_IDB_KEY]: {
        [SMB_HANDLE_DATEN_SHARE]: new MockDir('granted'),
        [SMB_HANDLE_PERSOENLICH]: new MockDir('prompt'),
      },
      [CSV_SOURCE_DIR_HANDLE_IDB_KEY]: new MockDir('granted'),
    });
    const pending = await listPendingGrants(idb, { isKurator: false });
    expect(pending.map(p => p.slot)).toEqual(['persoenlich']);
  });

  it('alle granted → leere Liste (Warm-Start, Auto-Skip)', async () => {
    mockCanWrite.mockReturnValue(true);
    mockCsvAuto.mockReturnValue(true);
    const idb = makeIdb({
      [SMB_HANDLES_IDB_KEY]: {
        [SMB_HANDLE_DATEN_SHARE]: new MockDir('granted'),
        [SMB_HANDLE_PERSOENLICH]: new MockDir('granted'),
      },
      [CSV_SOURCE_DIR_HANDLE_IDB_KEY]: new MockDir('granted'),
    });
    expect(await listPendingGrants(idb, { isKurator: false })).toEqual([]);
  });

  it('nimmt NIE kurator-only-Slots (User-Folders-Root, DMS) auf', async () => {
    mockCanWrite.mockReturnValue(true);
    mockKuratorMenus.mockReturnValue(true);
    const idb = makeIdb({
      [SMB_HANDLES_IDB_KEY]: {
        [SMB_HANDLE_DATEN_SHARE]: new MockDir('prompt'),
        [SMB_HANDLE_USER_FOLDERS_ROOT]: new MockDir('prompt'),
        [dmsSourceSlotKey('quelle-1')]: new MockDir('prompt'),
      },
    });
    const pending = await listPendingGrants(idb, { isKurator: true });
    expect(pending.map(p => p.slot)).toEqual(['daten-share']);
  });

  it('fehlende Handles erzeugen keinen Schritt', async () => {
    mockCanWrite.mockReturnValue(true);
    mockCsvAuto.mockReturnValue(true);
    const idb = makeIdb({ [SMB_HANDLES_IDB_KEY]: {} }); // kein Handle, kein CSV-Dir
    expect(await listPendingGrants(idb, { isKurator: false })).toEqual([]);
  });
});
