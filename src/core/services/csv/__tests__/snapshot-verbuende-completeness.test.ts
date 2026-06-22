/**
 * Regression: die veröffentlichte `verbuende.jsonl` muss VOLLSTÄNDIG sein —
 * jeder von den Anträgen referenzierte Verbund taucht auf, auch wenn der
 * abgeleitete verbuende-Cache des Writers lückenhaft (Record fehlt) oder
 * mis-filed (falsche programm_id → fällt aus dem programm_id-Index-Query von
 * listVerbundsByProgramm) ist. Fix: `loadSmallStoreData` heilt den Cache
 * (healMissingVerbuende) VOR dem Serialisieren. Bisher heilte nur der
 * End-User-Lesepfad (data-update.ts), nicht der Kurator/PL-Schreibpfad — so
 * entstand die unvollständige Datei (bestätigt: „ZKN110630" fehlte).
 *
 * Zusätzlich: `findMissingVerbuende` (Kern des Invariant-Guards) als Unit.
 *
 * Nutzt fake-indexeddb + einen in-memory FileSystemDirectoryHandle-Mock.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import {
  putProgramm,
  putAntraege,
  putAntraegeListView,
  putVerbund,
  listVerbuendeByProgramm,
} from '../idb-csv';
import { writeProgrammSnapshot, findMissingVerbuende } from '../snapshot';
import type { Antrag, AntragListItem, Programm } from '../types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

// ─── Minimaler in-memory FileSystemDirectoryHandle (wie snapshot-stream.test) ──

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

function makeProgramm(id: string): Programm {
  return { id, name: `P ${id}`, created_at: '2026-06-03T00:00:00.000Z', smb_handle_key: 'daten-share' };
}

function makeAntrag(az: string, programmId: string, verbundId?: string): Antrag {
  return {
    aktenzeichen: az,
    programm_id: programmId,
    titel: `Titel ${az}`,
    verbund_id: verbundId,
    _field_sources: {},
    _updated_at: '2026-06-03T00:00:00.000Z',
  } as Antrag;
}

function lvItem(az: string, extra: Partial<AntragListItem> = {}): AntragListItem {
  return { aktenzeichen: az, programm_id: PID, _updated_at: '2026-06-03T00:00:00.000Z', ...extra };
}

const PID = 'p1';
const snapPath = (pid: string, file: string): string[] => ['programm', 'antraege', 'snapshot', pid, file];

function readVerbuende(root: MemDir): Array<{ verbund_id: string; programm_id: string }> {
  return readFileText(root, snapPath(PID, 'verbuende.jsonl'))
    .split('\n').filter(Boolean).map(l => JSON.parse(l));
}

describe('writeProgrammSnapshot — vollständige verbuende.jsonl (Heal-before-serialize)', () => {
  it('absent: fehlender Verbund-Record wird vor dem Serialisieren rekonstruiert', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    await putAntraege(idb, [
      makeAntrag('16KN110645', PID, 'ZKN110630'),
      makeAntrag('16KN110646', PID, 'ZKN110630'),
    ]);
    await putAntraegeListView(idb, [
      lvItem('16KN110645', { verbund_id: 'ZKN110630', akronym: 'LADScessible' }),
      lvItem('16KN110646', { verbund_id: 'ZKN110630', akronym: 'LADScessible' }),
    ]);
    // verbuende-Cache leer → ohne Fix fiele „ZKN110630" still aus dem Snapshot.
    expect(await listVerbuendeByProgramm(idb, PID)).toHaveLength(0);

    const root = new MemDir('root');
    await writeProgrammSnapshot(idb, root as unknown as FileSystemDirectoryHandle, PID, 'tester');

    const records = readVerbuende(root);
    expect(records).toHaveLength(1);
    expect(records[0]!.verbund_id).toBe('ZKN110630');
    expect(records[0]!.programm_id).toBe(PID);
    const manifest = JSON.parse(readFileText(root, snapPath(PID, 'manifest.json')));
    expect(manifest.stores.verbuende.count).toBe(1);
  });

  it('mis-filed: Record unter falscher programm_id wird korrigiert serialisiert', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    await putAntraege(idb, [makeAntrag('16KN1', PID, 'V1')]);
    await putAntraegeListView(idb, [lvItem('16KN1', { verbund_id: 'V1' })]);
    // Existiert, aber unter falscher programm_id → fällt aus dem Index-Query.
    await putVerbund(idb, {
      verbund_id: 'V1', programm_id: 'falsches-programm', titel: 'X', teilantrags_ids: ['16KN1'],
    });
    expect(await listVerbuendeByProgramm(idb, PID)).toHaveLength(0);

    const root = new MemDir('root');
    await writeProgrammSnapshot(idb, root as unknown as FileSystemDirectoryHandle, PID, 'tester');

    const records = readVerbuende(root);
    expect(records).toHaveLength(1);
    expect(records[0]!.verbund_id).toBe('V1');
    expect(records[0]!.programm_id).toBe(PID);
  });
});

describe('findMissingVerbuende (Invariant-Kern)', () => {
  it('leer, wenn alle Anträge-Verbünde serialisiert sind', () => {
    expect(findMissingVerbuende(['A', 'B', 'A'], ['B', 'A'])).toEqual([]);
  });
  it('liefert fehlende — sortiert + dedupliziert', () => {
    expect(findMissingVerbuende(['C', 'A', 'B', 'A'], ['A'])).toEqual(['B', 'C']);
  });
  it('serialisierte Extras zählen nicht als fehlend', () => {
    expect(findMissingVerbuende(['A'], ['A', 'Z'])).toEqual([]);
  });
});
