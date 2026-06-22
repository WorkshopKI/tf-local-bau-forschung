/**
 * Regression: der Invariant-Guard in `loadSmallStoreData` MUSS im Dev lautstark
 * fehlschlagen, wenn nach dem Heal eine Lücke bleibt (z.B. eine tiefere
 * List-View-Projektions-Divergenz) — statt eine unvollständige verbuende.jsonl
 * zu veröffentlichen. Heal wird hier bewusst zum No-op gemockt, um die
 * Restlücke zu erzwingen; der Guard muss dann werfen (DEV) bzw. den Write vor
 * dem Schreiben irgendeiner Datei abbrechen.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Heal ausschalten → die von der List-View referenzierte verbund_id bleibt im
// Cache fehlend → der Guard schlägt an.
vi.mock('../verbuende-rebuild', () => ({ healMissingVerbuende: async () => 0 }));

import { IDBStore } from '../../storage/idb-store';
import { putProgramm, putAntraegeListView } from '../idb-csv';
import { writeProgrammSnapshot } from '../snapshot';
import type { AntragListItem, Programm } from '../types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

class MemDir {
  readonly kind = 'directory' as const;
  children = new Map<string, MemDir>();
  constructor(public name: string) {}
  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<MemDir> {
    let c = this.children.get(name);
    if (!c) {
      if (!opts?.create) { const e = new Error('NotFound'); e.name = 'NotFoundError'; throw e; }
      c = new MemDir(name); this.children.set(name, c);
    }
    return c;
  }
}

async function freshIdb(): Promise<IDBStore> {
  const s = new IDBStore();
  await s.open();
  return s;
}

const PID = 'p1';
function makeProgramm(id: string): Programm {
  return { id, name: `P ${id}`, created_at: '2026-06-03T00:00:00.000Z', smb_handle_key: 'daten-share' };
}
function lvItem(az: string, extra: Partial<AntragListItem> = {}): AntragListItem {
  return { aktenzeichen: az, programm_id: PID, _updated_at: '2026-06-03T00:00:00.000Z', ...extra };
}

describe('Snapshot-Invariant-Guard', () => {
  it('wirft im Dev, wenn nach dem Heal ein referenzierter Verbund fehlt', async () => {
    expect(import.meta.env.DEV).toBe(true);
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    await putAntraegeListView(idb, [lvItem('16KN1', { verbund_id: 'ZKN110630' })]);
    // verbuende-Cache leer + Heal gemockt zum No-op → Restlücke „ZKN110630".

    const root = new MemDir('root');
    await expect(
      writeProgrammSnapshot(idb, root as unknown as FileSystemDirectoryHandle, PID, 'tester'),
    ).rejects.toThrow(/Invariante verletzt/);
  });
});
