/**
 * Härtung (Vorfall 2026-06): Demo-/Fixture-Quellen (`fixture-real-*`) dürfen NIE
 * in den publizierten Share-Snapshot gelangen. Sonst überschreibt ein
 * versehentlich gegen den echten Share geöffneter Dev-Build (der die Fixtures
 * auto-seedet) beim nächsten Snapshot-Write die echten Quellen mit Demo-Daten —
 * und alle pl/kurator-Rechner ziehen sich danach den Fixture-Snapshot.
 * `loadSmallStoreData` ist der Choke-Point für Voll- UND Delta-Write.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import { putProgramm, putSchema } from '../idb-csv';
import { writeProgrammSnapshot } from '../snapshot';
import type { CsvSchema, Programm } from '../types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

// ─── in-memory FileSystemDirectoryHandle (write+read) ────────────────────────
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
function schema(id: string, name: string): CsvSchema {
  return {
    id, programm_id: PID, csv_source_name: name, is_master: false,
    join_key: 'aktenzeichen', priority: 50, column_mapping: {},
    encoding: 'UTF-8', separator: ';', created_at: '2026-06-01T00:00:00.000Z',
  } as CsvSchema;
}

async function readSnapshotFile(root: MemDir, name: string): Promise<string> {
  const programm = await root.getDirectoryHandle('programm');
  const antraege = await programm.getDirectoryHandle('antraege');
  const snapshot = await antraege.getDirectoryHandle('snapshot');
  const pid = await snapshot.getDirectoryHandle(PID);
  const fh = await pid.getFileHandle(name);
  return (await fh.getFile()).text();
}

describe('Snapshot-Write schließt Fixture-Quellen aus', () => {
  it('publiziert echte Schemas, aber NICHT fixture-real-*', async () => {
    const idb = new IDBStore();
    await idb.open();
    await putProgramm(idb, { id: PID, name: 'P1', created_at: '2026-06-01T00:00:00.000Z', smb_handle_key: 'daten-share' } as Programm);
    await putSchema(idb, schema('9097-anb', 'Antragsbasis'));
    await putSchema(idb, schema('fixture-real-anb', 'Demo-Antragsbasis'));

    const root = new MemDir('root');
    await writeProgrammSnapshot(idb, root as unknown as FileSystemDirectoryHandle, PID, 'tester');

    const jsonl = await readSnapshotFile(root, 'csv_schemas.jsonl');
    expect(jsonl).toContain('9097-anb');
    expect(jsonl).not.toContain('fixture-real-anb');
  });
});
