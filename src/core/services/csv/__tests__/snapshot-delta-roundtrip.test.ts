/**
 * Round-Trip Delta-Snapshot (v2.97, Phase D): Schreiber (writeProgrammSnapshot
 * emitDeltaBase + writeProgrammSnapshotDelta) → Leser (syncProgrammSnapshot)
 * → der Konsument-IDB-Stand muss EXAKT dem Schreiber-Stand entsprechen
 * (Basis + alle Deltas). Plus: erster Delta-Write auf leerem Share = Voll-Write
 * (Bootstrap), Folge-Writes = Delta.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import { putProgramm, putAntraege, deleteAntrag, listAntraegeByProgramm } from '../idb-csv';
import { writeProgrammSnapshot, writeProgrammSnapshotDelta } from '../snapshot';
import { syncProgrammSnapshot } from '../snapshot-sync';
import type { Antrag, Programm } from '../types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

// ─── in-memory FileSystemDirectoryHandle (read+write) ────────────────────────
class MemFile {
  readonly kind = 'file' as const;
  content = new Uint8Array(0);
  constructor(public name: string) {}
  async getFile(): Promise<Blob> { return new Blob([this.content]); }
  createWritable(): Promise<unknown> {
    const parts: Uint8Array[] = [];
    const enc = new TextEncoder();
    const self = this;
    return Promise.resolve({
      async write(chunk: unknown): Promise<void> {
        if (typeof chunk === 'string') parts.push(enc.encode(chunk));
        else if (chunk instanceof Blob) parts.push(new Uint8Array(await chunk.arrayBuffer()));
        else if (chunk instanceof Uint8Array) parts.push(chunk);
        else if (chunk instanceof ArrayBuffer) parts.push(new Uint8Array(chunk));
        else if (ArrayBuffer.isView(chunk)) parts.push(new Uint8Array(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength)));
        else throw new Error('MemFile: unsupported chunk');
      },
      async close(): Promise<void> {
        let total = 0; for (const p of parts) total += p.length;
        const all = new Uint8Array(total); let off = 0;
        for (const p of parts) { all.set(p, off); off += p.length; }
        self.content = all;
      },
      async abort(): Promise<void> { parts.length = 0; },
    });
  }
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
  async removeEntry(name: string): Promise<void> {
    if (!this.children.has(name)) throw notFound();
    this.children.delete(name);
  }
  async *keys(): AsyncIterableIterator<string> { for (const k of this.children.keys()) yield k; }
}

const PID = 'p1';
function az(id: string, titel: string): Antrag {
  return { aktenzeichen: id, programm_id: PID, titel, _field_sources: {}, _updated_at: '2026-06-18T00:00:00.000Z' } as Antrag;
}
function makeProgramm(): Programm {
  return { id: PID, name: 'P1', created_at: '2026-06-18T00:00:00.000Z', smb_handle_key: 'daten-share' } as Programm;
}
async function idbNamed(name: string): Promise<IDBStore> { const s = new IDBStore(name); await s.open(); return s; }
const asHandle = (d: MemDir): FileSystemDirectoryHandle => d as unknown as FileSystemDirectoryHandle;

async function azSet(idb: IDBStore): Promise<Record<string, string>> {
  const all = await listAntraegeByProgramm(idb, PID);
  const out: Record<string, string> = {};
  for (const a of all) out[a.aktenzeichen] = String(a.titel);
  return out;
}

describe('Delta-Snapshot Round-Trip (Schreiber → Leser)', () => {
  it('erster Delta-Write = Voll-Write (Bootstrap), dann Deltas; Konsument == Schreiber', async () => {
    const writer = await idbNamed('writer');
    const consumer = await idbNamed('consumer');
    const share = new MemDir('root');

    await putProgramm(writer, makeProgramm());
    await putAntraege(writer, [az('A', 'A1'), az('B', 'B1'), az('C', 'C1')]);

    // Bootstrap-Basis (v2) explizit.
    const base = await writeProgrammSnapshot(writer, asHandle(share), PID, 'w', { emitDeltaBase: true });
    expect(base.manifest.version).toBe(2);
    expect(base.manifest.delta?.deltas).toHaveLength(0);

    // Änderung 1: B geändert, D neu, C entfernt.
    await putAntraege(writer, [az('B', 'B2'), az('D', 'D1')]);
    await deleteAntrag(writer, 'C');
    const d1 = await writeProgrammSnapshotDelta(writer, asHandle(share), PID, 'w', { touchedAz: ['B', 'D'], removedAz: ['C'] });
    expect(d1.mode).toBe('delta');

    // Änderung 2: A geändert.
    await putAntraege(writer, [az('A', 'A2')]);
    const d2 = await writeProgrammSnapshotDelta(writer, asHandle(share), PID, 'w', { touchedAz: ['A'], removedAz: [] });
    expect(d2.mode).toBe('delta');

    // Konsument synct frisch → Basis + 2 Deltas.
    const r = await syncProgrammSnapshot(consumer, asHandle(share), PID, { force: true });
    expect(r.synced).toBe(true);

    const consumerState = await azSet(consumer);
    const writerState = await azSet(writer);
    expect(consumerState).toEqual(writerState);
    expect(consumerState).toEqual({ A: 'A2', B: 'B2', D: 'D1' }); // C entfernt
  });

  it('erster Delta-Write auf leerem Share → mode "full"', async () => {
    const writer = await idbNamed('writer2');
    const share = new MemDir('root');
    await putProgramm(writer, makeProgramm());
    await putAntraege(writer, [az('A', 'A1')]);

    const r = await writeProgrammSnapshotDelta(writer, asHandle(share), PID, 'w', { touchedAz: ['A'], removedAz: [] });
    expect(r.mode).toBe('full'); // kein v2-Manifest vorhanden → Bootstrap-Voll-Write
  });

  it('Teil-Konsument (nur Basis) holt nur das danach geschriebene Delta nach', async () => {
    const writer = await idbNamed('writer3');
    const consumer = await idbNamed('consumer3');
    const share = new MemDir('root');
    await putProgramm(writer, makeProgramm());
    await putAntraege(writer, [az('A', 'A1'), az('B', 'B1')]);
    await writeProgrammSnapshot(writer, asHandle(share), PID, 'w', { emitDeltaBase: true });

    // Konsument synct die Basis.
    await syncProgrammSnapshot(consumer, asHandle(share), PID, { force: true });
    expect(await azSet(consumer)).toEqual({ A: 'A1', B: 'B1' });

    // Schreiber legt EIN Delta nach.
    await putAntraege(writer, [az('B', 'B2')]);
    await writeProgrammSnapshotDelta(writer, asHandle(share), PID, 'w', { touchedAz: ['B'], removedAz: [] });

    // Konsument synct erneut → nur Delta angewandt.
    const r = await syncProgrammSnapshot(consumer, asHandle(share), PID, { force: true });
    expect(r.synced).toBe(true);
    expect(await azSet(consumer)).toEqual({ A: 'A1', B: 'B2' });
  });
});
