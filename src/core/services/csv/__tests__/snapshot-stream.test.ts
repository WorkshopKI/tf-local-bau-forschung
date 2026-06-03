/**
 * Round-Trip-Test fuer den gestreamten Snapshot-Write (OOM-Fix):
 * `writeProgrammSnapshot` schreibt `antraege.jsonl` per Cursor + Chunk-Stream
 * statt alle Records als Array zu laden. Dieser Test sichert ab, dass die
 * Ausgabe **byte-identisch** zur klassischen `toJsonl`-Variante bleibt (gleiche
 * Sortierung nach aktenzeichen, gleicher Hash, gleicher Count) — sonst würde die
 * PL den Snapshot bei jedem Build neu syncen oder Records verlieren.
 *
 * Nutzt fake-indexeddb + einen in-memory FileSystemDirectoryHandle-Mock.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import { putProgramm, putAntraege, listAntraegeByProgramm } from '../idb-csv';
import { writeProgrammSnapshot } from '../snapshot';
import type { Antrag, Programm } from '../types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

// ─── Minimaler in-memory FileSystemDirectoryHandle ───────────────────────────

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

function notFound(): Error {
  const e = new Error('NotFound');
  e.name = 'NotFoundError';
  return e;
}

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
}

function readFileText(root: MemDir, parts: string[]): string {
  let dir: MemDir = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = dir.children.get(parts[i]!);
    if (!next || next.kind !== 'directory') throw new Error(`missing dir ${parts[i]}`);
    dir = next;
  }
  const f = dir.children.get(parts[parts.length - 1]!);
  if (!f || f.kind !== 'file') throw new Error(`missing file ${parts[parts.length - 1]}`);
  return new TextDecoder().decode(f.content);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function freshIdb(): Promise<IDBStore> {
  const s = new IDBStore();
  await s.open();
  return s;
}

function makeAntrag(az: string, programmId: string): Antrag {
  return {
    aktenzeichen: az,
    programm_id: programmId,
    titel: `Titel ${az}`,
    t_hint: `Bemerkung ${az}`,
    _field_sources: {},
    _updated_at: '2026-06-03T00:00:00.000Z',
  } as Antrag;
}

function makeProgramm(id: string): Programm {
  return { id, name: `P ${id}`, created_at: '2026-06-03T00:00:00.000Z', smb_handle_key: 'daten-share' };
}

async function sha256(text: string): Promise<string> {
  const dig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return 'sha256-' + Array.from(new Uint8Array(dig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const PID = 'p1';
const snapPath = (pid: string, file: string): string[] => ['programm', 'antraege', 'snapshot', pid, file];

describe('writeProgrammSnapshot — gestreamtes antraege.jsonl', () => {
  it('Output byte-identisch zu toJsonl, korrekter Count + Hash; Cursor sortiert nach aktenzeichen', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    // Absichtlich unsortiert einfuegen — der Cursor muss nach aktenzeichen sortieren.
    await putAntraege(idb, [
      makeAntrag('16KN3', PID),
      makeAntrag('16KN1', PID),
      makeAntrag('16KN2', PID),
      makeAntrag('16KN1-OTHER', 'other-programm'), // anderes Programm → darf NICHT im Snapshot landen
    ]);

    const root = new MemDir('root');
    await writeProgrammSnapshot(idb, root as unknown as FileSystemDirectoryHandle, PID, 'tester');

    // Erwartete Ausgabe via klassischer toJsonl-Logik (sort nach String(aktenzeichen)).
    const antraege = (await listAntraegeByProgramm(idb, PID));
    const sorted = [...antraege].sort((a, b) => {
      const ka = String(a.aktenzeichen), kb = String(b.aktenzeichen);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    const expected = sorted.map(a => JSON.stringify(a)).join('\n') + '\n';

    const actual = readFileText(root, snapPath(PID, 'antraege.jsonl'));
    expect(actual).toBe(expected);
    // 3 Anträge des Programms, NICHT der aus 'other-programm'.
    expect(actual.split('\n').filter(Boolean)).toHaveLength(3);
    expect(actual).not.toContain('16KN1-OTHER');

    const manifest = JSON.parse(readFileText(root, snapPath(PID, 'manifest.json')));
    expect(manifest.stores.antraege.count).toBe(3);
    expect(manifest.stores.antraege.hash).toBe(await sha256(expected));
  });

  it('leeres Programm → leeres antraege.jsonl, count 0, Hash = Hash("")', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm('empty'));

    const root = new MemDir('root');
    await writeProgrammSnapshot(idb, root as unknown as FileSystemDirectoryHandle, 'empty', 'tester');

    expect(readFileText(root, snapPath('empty', 'antraege.jsonl'))).toBe('');
    const manifest = JSON.parse(readFileText(root, snapPath('empty', 'manifest.json')));
    expect(manifest.stores.antraege.count).toBe(0);
    expect(manifest.stores.antraege.hash).toBe(await sha256(''));
  });
});
