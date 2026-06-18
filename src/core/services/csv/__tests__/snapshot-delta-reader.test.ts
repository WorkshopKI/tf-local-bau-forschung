/**
 * Delta-Leser (v2.97, Phase C): syncProgrammSnapshot wendet einen v2-Delta-
 * Snapshot (Basis + geordnete Deltas) korrekt an. Kalt-Konsument lädt Basis +
 * alle Deltas; Teil-Konsument (Cursor schon bei seq 1) wendet NUR das fehlende
 * Delta an, ohne die Basis erneut zu lesen.
 *
 * Hand-gebaute Fixtures (der Delta-Schreiber kommt in Phase D) + fake-indexeddb
 * + in-memory FileSystemDirectoryHandle.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import { putAntraege, listAntraegeByProgramm } from '../idb-csv';
import { syncProgrammSnapshot } from '../snapshot-sync';
import { buildAntraegeHashes, SNAPSHOT_RECORD_HASHES_KEY } from '../incremental-antraege';
import { SYNC_BASE_VERSION_KEY, SYNC_DELTA_SEQ_KEY, SYNC_VERSION_KEY } from '../snapshot-keys';
import type { Antrag } from '../types';
import type { ProgrammSnapshotManifest as Manifest } from '../snapshot';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

// ─── in-memory FileSystemDirectoryHandle (read-only genügt hier) ──────────────
class MemFile {
  readonly kind = 'file' as const;
  content = new Uint8Array(0);
  constructor(public name: string) {}
  async getFile(): Promise<Blob> { return new Blob([this.content]); }
}
function notFound(): Error { const e = new Error('NotFound'); e.name = 'NotFoundError'; return e; }
class MemDir {
  readonly kind = 'directory' as const;
  children = new Map<string, MemDir | MemFile>();
  constructor(public name: string) {}
  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<MemDir> {
    let c = this.children.get(name);
    if (!c) { if (!opts?.create) throw notFound(); c = new MemDir(name); this.children.set(name, c); }
    if (c.kind !== 'directory') throw new Error('not a directory');
    return c;
  }
  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MemFile> {
    let c = this.children.get(name);
    if (!c) { if (!opts?.create) throw notFound(); c = new MemFile(name); this.children.set(name, c); }
    if (c.kind !== 'file') throw new Error('not a file');
    return c;
  }
}

const PID = 'p1';
function az(id: string, titel: string): Antrag {
  return { aktenzeichen: id, programm_id: PID, titel, _field_sources: {}, _updated_at: '2026-06-18T00:00:00.000Z' } as Antrag;
}
function jsonl(records: Antrag[]): string {
  return records.map(r => JSON.stringify(r)).join('\n') + (records.length ? '\n' : '');
}
function putFile(root: MemDir, parts: string[], content: string): void {
  let dir = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const name = parts[i]!;
    let c = dir.children.get(name);
    if (!c) { c = new MemDir(name); dir.children.set(name, c); }
    dir = c as MemDir;
  }
  const f = new MemFile(parts[parts.length - 1]!);
  f.content = new TextEncoder().encode(content);
  dir.children.set(f.name, f);
}
const snap = (file: string): string[] => ['programm', 'antraege', 'snapshot', PID, file];

function v2Manifest(snapshotVersion: string): Manifest {
  return {
    version: 2,
    snapshotVersion,
    programmId: PID,
    createdAt: snapshotVersion,
    createdBy: 'tester',
    stores: { antraege: { count: 3, hash: 'sha256-base' } } as Manifest['stores'],
    delta: {
      baseVersion: 'B1',
      deltaStores: ['antraege'],
      cumulativeBytes: 0,
      deltas: [
        { seq: 1, createdAt: 's1', createdBy: 'tester', stores: { antraege: { changedFile: 'antraege.delta.1.jsonl', removedKeys: [], hash: 'h1', count: 2 } } },
        { seq: 2, createdAt: 's2', createdBy: 'tester', stores: { antraege: { changedFile: 'antraege.delta.2.jsonl', removedKeys: ['C'], hash: 'h2', count: 1 } } },
      ],
    },
  };
}

async function freshIdb(): Promise<IDBStore> { const s = new IDBStore(); await s.open(); return s; }

describe('Delta-Leser (v2)', () => {
  it('Kalt-Konsument: Basis + Delta 1 + Delta 2 → korrekter Endstand', async () => {
    const idb = await freshIdb();
    const root = new MemDir('root');
    putFile(root, snap('manifest.json'), JSON.stringify(v2Manifest('2026-06-18T10:00:00.000Z')));
    putFile(root, snap('antraege.jsonl'), jsonl([az('A', 'A1'), az('B', 'B1'), az('C', 'C1')]));
    putFile(root, snap('antraege.delta.1.jsonl'), jsonl([az('B', 'B2'), az('D', 'D1')]));
    putFile(root, snap('antraege.delta.2.jsonl'), jsonl([az('A', 'A2')]));

    const r = await syncProgrammSnapshot(idb, root as unknown as FileSystemDirectoryHandle, PID, { force: true });
    expect(r.synced).toBe(true);

    const all = (await listAntraegeByProgramm(idb, PID)).sort((x, y) => x.aktenzeichen.localeCompare(y.aktenzeichen));
    expect(all.map(a => a.aktenzeichen)).toEqual(['A', 'B', 'D']); // C entfernt
    expect(all.find(a => a.aktenzeichen === 'A')?.titel).toBe('A2');
    expect(all.find(a => a.aktenzeichen === 'B')?.titel).toBe('B2');
    expect(await idb.get<number>(SYNC_DELTA_SEQ_KEY(PID))).toBe(2);
    expect(await idb.get<string>(SYNC_BASE_VERSION_KEY(PID))).toBe('B1');
  });

  it('Teil-Konsument (seq 1): wendet nur Delta 2 an, ohne Basis-Datei', async () => {
    const idb = await freshIdb();
    // Vorzustand = Basis + Delta 1 bereits angewandt: A1, B2, C1, D1.
    const pre = [az('A', 'A1'), az('B', 'B2'), az('C', 'C1'), az('D', 'D1')];
    await putAntraege(idb, pre);
    await idb.set(SNAPSHOT_RECORD_HASHES_KEY(PID), buildAntraegeHashes(pre.map(r => JSON.stringify(r))));
    await idb.set(SYNC_BASE_VERSION_KEY(PID), 'B1');
    await idb.set(SYNC_DELTA_SEQ_KEY(PID), 1);
    await idb.set(SYNC_VERSION_KEY(PID), 'stale');

    const root = new MemDir('root');
    putFile(root, snap('manifest.json'), JSON.stringify(v2Manifest('2026-06-18T10:00:00.000Z')));
    // Bewusst KEINE antraege.jsonl-Basis + KEIN delta.1 — beides darf nicht gelesen
    // werden. Würde der Leser fälschlich die Basis brauchen, schlüge der Test fehl.
    putFile(root, snap('antraege.delta.2.jsonl'), jsonl([az('A', 'A2')]));

    const r = await syncProgrammSnapshot(idb, root as unknown as FileSystemDirectoryHandle, PID, { force: true });
    expect(r.synced).toBe(true);

    const all = (await listAntraegeByProgramm(idb, PID)).sort((x, y) => x.aktenzeichen.localeCompare(y.aktenzeichen));
    expect(all.map(a => a.aktenzeichen)).toEqual(['A', 'B', 'D']); // C entfernt, D blieb
    expect(all.find(a => a.aktenzeichen === 'A')?.titel).toBe('A2');
    expect(all.find(a => a.aktenzeichen === 'B')?.titel).toBe('B2'); // aus Delta 1 (Vorzustand) erhalten
    expect(await idb.get<number>(SYNC_DELTA_SEQ_KEY(PID))).toBe(2);
  });

  it('idempotent: zweiter Sync ohne neue Deltas ändert nichts', async () => {
    const idb = await freshIdb();
    const root = new MemDir('root');
    const mf = JSON.stringify(v2Manifest('2026-06-18T10:00:00.000Z'));
    putFile(root, snap('manifest.json'), mf);
    putFile(root, snap('antraege.jsonl'), jsonl([az('A', 'A1'), az('B', 'B1'), az('C', 'C1')]));
    putFile(root, snap('antraege.delta.1.jsonl'), jsonl([az('B', 'B2'), az('D', 'D1')]));
    putFile(root, snap('antraege.delta.2.jsonl'), jsonl([az('A', 'A2')]));

    await syncProgrammSnapshot(idb, root as unknown as FileSystemDirectoryHandle, PID, { force: true });
    const r2 = await syncProgrammSnapshot(idb, root as unknown as FileSystemDirectoryHandle, PID, { force: true });
    expect(r2.synced).toBe(false); // snapshotVersion unverändert → Idempotenz-Skip
    const all = await listAntraegeByProgramm(idb, PID);
    expect(all.map(a => a.aktenzeichen).sort()).toEqual(['A', 'B', 'D']);
  });
});
