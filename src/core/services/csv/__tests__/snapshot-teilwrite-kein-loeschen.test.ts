/**
 * Teil-Write beim Snapshot-Publish löscht NICHTS (Cross-Cutting-Review v4.12).
 *
 * Bis v4.12 entfernte der `catch`-Zweig alle bereits geschriebenen Dateien —
 * „damit kein halb-konsistenter Snapshot stehen bleibt". Verhindert hat das
 * nichts: das Manifest ist der einzige Marker und wird als LETZTES geschrieben,
 * ein Abbruch davor lässt den alten Stand als Ganzes gelten. Mitgerissen wurde
 * dabei `antraege.jsonl` — die einzige Datei ohne `.backup` (`skipBackup`, nicht
 * in `BACKUP_STORES`). Ein Rechner mit leerer IndexedDB fand danach null
 * Anträge, und der Delta-Pfad schrieb die Basis so bald nicht neu.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import { putProgramm, putAntraege } from '../idb-csv';
import { writeProgrammSnapshot } from '../snapshot';
import type { Antrag, Programm } from '../types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

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
  /** Dateiname, dessen Anlegen scheitert → simuliert den Abbruch mitten im Lauf. */
  sperre: string | null = null;
  constructor(public name: string) {}
  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<MemDir> {
    let c = this.children.get(name);
    if (!c) { if (!opts?.create) throw notFound(); c = new MemDir(name); this.children.set(name, c); }
    if (c.kind !== 'directory') throw new Error('not a directory');
    return c;
  }
  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MemFile> {
    if (this.sperre && name.startsWith(this.sperre)) {
      throw new DOMException(`kein Platz für ${name}`, 'QuotaExceededError');
    }
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
const asHandle = (d: MemDir): FileSystemDirectoryHandle => d as unknown as FileSystemDirectoryHandle;

function makeProgramm(): Programm {
  return { id: PID, name: 'P1', created_at: '2026-06-18T00:00:00.000Z', smb_handle_key: 'daten-share' } as Programm;
}
function antraege(n: number): Antrag[] {
  return Array.from({ length: n }, (_, i) => ({
    aktenzeichen: `16EP${String(i).padStart(5, '0')}`,
    programm_id: PID, titel: `T${i}`, _field_sources: {},
    _updated_at: '2026-06-18T00:00:00.000Z',
  } as Antrag));
}

async function snapshotDir(share: MemDir): Promise<MemDir> {
  const p = await share.getDirectoryHandle('programm');
  const a = await p.getDirectoryHandle('antraege');
  const s = await a.getDirectoryHandle('snapshot');
  return s.getDirectoryHandle(PID);
}

describe('Snapshot: Abbruch nach dem Anträge-Stream löscht nichts (v4.12)', () => {
  it('antraege.jsonl überlebt einen Fehler in den kleinen Stores', async () => {
    const idb = new IDBStore('teilwrite'); await idb.open();
    await putProgramm(idb, makeProgramm());
    await putAntraege(idb, antraege(50));
    const share = new MemDir('share');

    // 1. Lauf: sauber durch — der Share trägt einen vollständigen Snapshot.
    await writeProgrammSnapshot(idb, asHandle(share), PID, 'test');
    const dir = await snapshotDir(share);
    const vorher = await (await dir.getFileHandle('antraege.jsonl')).getFile().then(f => f.text());
    expect(vorher.split('\n').filter(Boolean)).toHaveLength(50);

    // 2. Lauf: die Anträge gehen durch, danach scheitert ein kleiner Store.
    dir.sperre = 'verbuende';
    await expect(writeProgrammSnapshot(idb, asHandle(share), PID, 'test')).rejects.toThrow();

    // Die einzige Datei ohne `.backup` muss den Abbruch überleben. Auf dem
    // alten Code hatte der catch-Zweig sie entfernt — `getFileHandle` würde
    // hier mit NotFoundError scheitern. (Auf `removeEntry`-Aufrufe zu prüfen
    // taugt nicht: `atomicWriteStream` entfernt das alte Ziel regulär vor dem
    // Rename, das gehört zum Schreiben.)
    expect(dir.children.has('antraege.jsonl'), 'antraege.jsonl wurde gelöscht').toBe(true);
    const nachher = await (await dir.getFileHandle('antraege.jsonl')).getFile().then(f => f.text());
    expect(nachher.split('\n').filter(Boolean)).toHaveLength(50);
  });

  it('das Manifest bleibt auf dem alten Stand — der Teil-Write gilt nicht', async () => {
    const idb = new IDBStore('teilwrite2'); await idb.open();
    await putProgramm(idb, makeProgramm());
    await putAntraege(idb, antraege(50));
    const share = new MemDir('share');

    const ersteVersion = (await writeProgrammSnapshot(idb, asHandle(share), PID, 'test')).snapshotVersion;
    const dir = await snapshotDir(share);

    dir.sperre = 'verbuende';
    await expect(writeProgrammSnapshot(idb, asHandle(share), PID, 'test')).rejects.toThrow();

    const manifest = JSON.parse(
      await (await dir.getFileHandle('manifest.json')).getFile().then(f => f.text()),
    ) as { snapshotVersion: string };
    expect(manifest.snapshotVersion, 'kein halber Snapshot wird gültig').toBe(ersteVersion);
  });
});
