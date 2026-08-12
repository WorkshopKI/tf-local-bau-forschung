/**
 * `connectDataShare`: der Handle darf nur bei GELUNGENEM Wechsel wechseln.
 *
 * Der Picker persistiert sein Ergebnis sofort — Ordnernamen- und
 * Struktur-Pruefung laufen erst danach. Bis v4.0 hiess das: wer beim
 * Umzugs-Re-Pick den falschen Ordner erwischte, hatte die bisherige,
 * funktionierende Verbindung bereits verloren. Hier wird abgesichert, dass
 * genau das nicht mehr passiert — und dass der Generations-Stempel
 * ausschliesslich am Erfolg haengt.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/config/feature-flags', () => ({
  dataConfig: { expectedFolderName: 'ZAH', shareGeneration: 7 },
  canWriteDatenShare: () => true,
}));

vi.mock('../smb-handle', () => ({
  pickAndStoreDatenShareHandle: vi.fn(),
  setDatenShareHandle: vi.fn(),
  refreshAllPermissions: vi.fn(async () => ({ datenShare: 'granted' })),
  ensureReadme: vi.fn(async () => undefined),
}));

vi.mock('../migration', () => ({
  validateSelectedFolder: vi.fn(async () => ({ kind: 'current' })),
}));

import { connectDataShare } from '../connect-data-share';
import {
  pickAndStoreDatenShareHandle,
  setDatenShareHandle,
} from '../smb-handle';
import { validateSelectedFolder } from '../migration';
import { SHARE_GENERATION_IDB_KEY } from '../types';
import type { IDBStore } from '@/core/services/storage/idb-store';

const alt = { name: 'ZAH' } as FileSystemDirectoryHandle;

function machIdb(): { idb: IDBStore; gesetzt: Record<string, unknown> } {
  const gesetzt: Record<string, unknown> = {};
  const idb = {
    get: async () => undefined,
    set: async (key: string, wert: unknown) => { gesetzt[key] = wert; },
    delete: async () => undefined,
  } as unknown as IDBStore;
  return { idb, gesetzt };
}

beforeEach(() => {
  vi.mocked(setDatenShareHandle).mockClear();
  vi.mocked(validateSelectedFolder).mockResolvedValue({ kind: 'current' } as never);
});

describe('connectDataShare', () => {
  it('stempelt die Config-Generation nach erfolgreichem Verbinden', async () => {
    const { idb, gesetzt } = machIdb();
    vi.mocked(pickAndStoreDatenShareHandle).mockResolvedValue({
      ok: true, handle: { name: 'ZAH' } as FileSystemDirectoryHandle, vorher: alt,
    });

    const res = await connectDataShare(idb, { isKurator: true });

    expect(res.ok).toBe(true);
    expect(gesetzt[SHARE_GENERATION_IDB_KEY]).toBe(7);
    expect(setDatenShareHandle).not.toHaveBeenCalled();
  });

  it('rollt auf den vorherigen Handle zurueck, wenn der Ordnername nicht passt', async () => {
    const { idb, gesetzt } = machIdb();
    vi.mocked(pickAndStoreDatenShareHandle).mockResolvedValue({
      ok: true, handle: { name: 'Irgendwas' } as FileSystemDirectoryHandle, vorher: alt,
    });

    const res = await connectDataShare(idb, { isKurator: true });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('name-mismatch');
    expect(setDatenShareHandle).toHaveBeenCalledWith(idb, alt);
    // Der Fehlgriff darf die Installation NICHT als umgezogen markieren, sonst
    // bliebe sie auf dem falschen Ordner sitzen, ohne je wieder gefragt zu werden.
    expect(gesetzt[SHARE_GENERATION_IDB_KEY]).toBeUndefined();
  });

  it('rollt zurueck, wenn ein Unterordner gewaehlt wurde', async () => {
    const { idb, gesetzt } = machIdb();
    vi.mocked(pickAndStoreDatenShareHandle).mockResolvedValue({
      ok: true, handle: { name: 'ZAH' } as FileSystemDirectoryHandle, vorher: alt,
    });
    vi.mocked(validateSelectedFolder).mockResolvedValue({ kind: 'subfolder' } as never);

    const res = await connectDataShare(idb, { isKurator: true });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('subfolder');
    expect(setDatenShareHandle).toHaveBeenCalledWith(idb, alt);
    expect(gesetzt[SHARE_GENERATION_IDB_KEY]).toBeUndefined();
  });

  it('laesst bei Abbruch alles unangetastet', async () => {
    const { idb, gesetzt } = machIdb();
    vi.mocked(pickAndStoreDatenShareHandle).mockResolvedValue({ ok: false, reason: 'aborted' });

    const res = await connectDataShare(idb, { isKurator: true });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('aborted');
    // Kein Rollback noetig — der Picker hat gar nichts geschrieben.
    expect(setDatenShareHandle).not.toHaveBeenCalled();
    expect(gesetzt[SHARE_GENERATION_IDB_KEY]).toBeUndefined();
  });

  it('kommt ohne vorherigen Handle aus (Erstverknuepfung mit falschem Ordner)', async () => {
    const { idb } = machIdb();
    vi.mocked(pickAndStoreDatenShareHandle).mockResolvedValue({
      ok: true, handle: { name: 'Falsch' } as FileSystemDirectoryHandle, vorher: null,
    });

    await connectDataShare(idb, { isKurator: true });

    // `null` heisst „es gab keinen" — der Slot wird geleert, nicht mit dem
    // falschen Ordner belegt.
    expect(setDatenShareHandle).toHaveBeenCalledWith(idb, null);
  });
});
