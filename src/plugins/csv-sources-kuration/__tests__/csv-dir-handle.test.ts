/**
 * v2.27: CSV-Quellen über EIN Ordner-Handle (Permission-Kaskade) statt N
 * Per-Datei-Handles. Sichert die drei neuen Bausteine ab:
 *  - `resolveFileViaDir` (Match-Strategie: exakter Name → Header-Fallback)
 *  - `checkSourceForUpdate` (Dir-Pfad: update_available / up_to_date /
 *    permission_required)
 *  - `pickAndLinkCsvFolder` (Persistenz des Ordner-Handles + Migrations-Cleanup
 *    der alten Per-Datei-Handles)
 *
 * IDB-Hinweis: ein echtes `FileSystemDirectoryHandle` ist structured-cloneable,
 * ein Mock nicht. Für `checkSourceForUpdate` wird der Dir-Handle-Lookup
 * (`idb.get`) daher gezielt auf den Live-Mock umgebogen, statt ihn durch
 * fake-indexeddb zu klonen (das würde die Methoden verlieren).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '@/core/services/storage/idb-store';
import { CSV_SOURCE_DIR_HANDLE_IDB_KEY } from '@/core/services/infrastructure/types';
import {
  resolveFileViaDir,
  checkSourceForUpdate,
  pickAndLinkCsvFolder,
  setCsvSourceHandle,
  getCsvSourceHandle,
  getCsvDirFileMap,
  setCsvDirFileMapEntries,
} from '../csv-source-handle';
import type { CsvSchema } from '@/core/services/csv/types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

// ─── In-memory FileSystemDirectoryHandle-Mock ────────────────────────────────

type Perm = 'granted' | 'denied' | 'prompt';

class MemFile {
  readonly kind = 'file' as const;
  constructor(public name: string, private text: string, public lastModified: number) {}
  async getFile(): Promise<File> {
    // Object.assign statt new File(): kommt ohne den File-Konstruktor aus und
    // trägt lastModified, das resolveFileViaDir/checkSourceForUpdate auslesen.
    const blob = new Blob([this.text], { type: 'text/csv' });
    return Object.assign(blob, { name: this.name, lastModified: this.lastModified }) as File;
  }
}

class MemDir {
  readonly kind = 'directory' as const;
  children = new Map<string, MemFile>();
  perm: Perm = 'granted';
  /** Wenn true, wirft die Verzeichnis-Iteration — beweist, dass der teure
   *  Header-Scan NICHT genommen wurde (schneller getFileHandle-Pfad). */
  failIter = false;
  constructor(public name = 'csv-folder') {}
  add(file: MemFile): this { this.children.set(file.name, file); return this; }
  async getFileHandle(name: string): Promise<MemFile> {
    const c = this.children.get(name);
    if (!c) { const e = new Error('NotFound'); e.name = 'NotFoundError'; throw e; }
    return c;
  }
  async queryPermission(): Promise<Perm> { return this.perm; }
  async requestPermission(): Promise<Perm> { this.perm = 'granted'; return this.perm; }
  async *[Symbol.asyncIterator](): AsyncIterableIterator<[string, MemFile]> {
    if (this.failIter) throw new Error('Verzeichnis-Scan blockiert (Test)');
    for (const entry of this.children) yield entry;
  }
}

function asDir(d: MemDir): FileSystemDirectoryHandle {
  return d as unknown as FileSystemDirectoryHandle;
}

async function freshIdb(): Promise<IDBStore> {
  const s = new IDBStore();
  await s.open();
  return s;
}

function makeSchema(over: Partial<CsvSchema> = {}): CsvSchema {
  return {
    id: 'schema-1',
    programm_id: 'prog-1',
    csv_source_name: 'Testquelle',
    is_master: true,
    join_key: 'fkz',
    priority: 0,
    column_mapping: { FKZ: {}, Titel: {} },
    encoding: 'UTF-8',
    separator: ',',
    created_at: '2026-01-01T00:00:00.000Z',
    ...over,
  } as unknown as CsvSchema;
}

const CSV_OK = 'FKZ,Titel\n01ABC,Projekt A\n';
const CSV_OTHER = 'Foo,Bar\n1,2\n';

/** idb.get für den Dir-Key auf einen Live-Mock umbiegen (clone-sicher). */
function injectDir(idb: IDBStore, dir: MemDir): void {
  const orig = idb.get.bind(idb);
  (idb as unknown as { get: (k: string) => Promise<unknown> }).get = async (key: string) =>
    key === CSV_SOURCE_DIR_HANDLE_IDB_KEY ? (dir as unknown) : orig(key);
}

function stubDirectoryPicker(dir: MemDir): void {
  (globalThis as unknown as { window: { showDirectoryPicker: () => Promise<unknown> } }).window = {
    showDirectoryPicker: async () => asDir(dir),
  };
}

// ─── resolveFileViaDir ───────────────────────────────────────────────────────

describe('resolveFileViaDir', () => {
  it('matcht per exaktem source_file_name', async () => {
    const dir = new MemDir().add(new MemFile('antraege.csv', CSV_OK, 1000));
    const res = await resolveFileViaDir(asDir(dir), makeSchema({ source_file_name: 'antraege.csv' }));
    expect(res?.fileName).toBe('antraege.csv');
    expect(res?.file.lastModified).toBe(1000);
  });

  it('fällt auf Header-Validierung zurück, wenn source_file_name fehlt', async () => {
    const dir = new MemDir()
      .add(new MemFile('falsch.csv', CSV_OTHER, 1000))
      .add(new MemFile('richtig.csv', CSV_OK, 2000));
    const res = await resolveFileViaDir(asDir(dir), makeSchema({ source_file_name: undefined }));
    expect(res?.fileName).toBe('richtig.csv');
  });

  it('liefert null, wenn keine Datei zum Schema passt', async () => {
    const dir = new MemDir().add(new MemFile('falsch.csv', CSV_OTHER, 1000));
    expect(await resolveFileViaDir(asDir(dir), makeSchema({ source_file_name: undefined }))).toBeNull();
  });

  it('nimmt bei bekanntem Dateinamen den schnellen Pfad OHNE Scan', async () => {
    const dir = new MemDir().add(new MemFile('antraege.csv', CSV_OK, 1000));
    dir.failIter = true; // ein Scan würde hier werfen
    // schema ohne source_file_name → ohne knownFileName müsste gescannt werden
    const res = await resolveFileViaDir(asDir(dir), makeSchema({ source_file_name: undefined }), 'antraege.csv');
    expect(res?.fileName).toBe('antraege.csv');
  });
});

// ─── checkSourceForUpdate (Dir-Pfad) ─────────────────────────────────────────

describe('checkSourceForUpdate (Ordner-Handle)', () => {
  it('meldet update_available, wenn die Datei neuer als source_last_modified ist', async () => {
    const idb = await freshIdb();
    injectDir(idb, new MemDir().add(new MemFile('antraege.csv', CSV_OK, 5000)));
    const r = await checkSourceForUpdate(idb, makeSchema({ source_file_name: 'antraege.csv', source_last_modified: 1000 }));
    expect(r.state).toBe('update_available');
  });

  it('meldet up_to_date, wenn die Datei nicht neuer ist UND die Größe unverändert', async () => {
    const idb = await freshIdb();
    injectDir(idb, new MemDir().add(new MemFile('antraege.csv', CSV_OK, 1000)));
    const r = await checkSourceForUpdate(idb, makeSchema({
      source_file_name: 'antraege.csv',
      source_last_modified: 1000,
      last_file_size: new Blob([CSV_OK]).size,
    }));
    expect(r.state).toBe('up_to_date');
  });

  it('meldet permission_required, wenn die Ordner-Permission nicht granted ist', async () => {
    const idb = await freshIdb();
    const dir = new MemDir().add(new MemFile('antraege.csv', CSV_OK, 5000));
    dir.perm = 'prompt';
    injectDir(idb, dir);
    const r = await checkSourceForUpdate(idb, makeSchema({ source_file_name: 'antraege.csv', source_last_modified: 1000 }));
    expect(r.state).toBe('permission_required');
  });

  it('nutzt die lokale Filemap und scannt den Ordner NICHT (Perf v2.27.2)', async () => {
    const idb = await freshIdb();
    await setCsvDirFileMapEntries(idb, { 'schema-1': 'antraege.csv' });
    const dir = new MemDir().add(new MemFile('antraege.csv', CSV_OK, 5000));
    dir.failIter = true; // Header-Scan würde werfen → state wäre dann nicht update_available
    injectDir(idb, dir);
    // schema OHNE source_file_name: nur die Filemap kann den schnellen Pfad liefern
    const r = await checkSourceForUpdate(idb, makeSchema({ source_file_name: undefined, source_last_modified: 1000 }));
    expect(r.state).toBe('update_available');
  });
});

// ─── pickAndLinkCsvFolder ────────────────────────────────────────────────────

describe('pickAndLinkCsvFolder', () => {
  it('matcht Schemas und entfernt deren altes Per-Datei-Handle', async () => {
    const idb = await freshIdb();
    // altes Per-Datei-Handle, das nach dem Ordner-Link entfernt werden soll
    await setCsvSourceHandle(idb, 'schema-1', { name: 'antraege.csv' } as unknown as FileSystemFileHandle);
    stubDirectoryPicker(new MemDir().add(new MemFile('antraege.csv', CSV_OK, 5000)));

    const res = await pickAndLinkCsvFolder(idb, [makeSchema({ source_file_name: 'antraege.csv' })]);

    expect(res.linked).toBe(true);
    expect(res.matched).toEqual(['schema-1']);
    expect(await getCsvSourceHandle(idb, 'schema-1')).toBeNull();
    // Filemap persistiert → künftige Checks nehmen den schnellen Pfad
    expect(await getCsvDirFileMap(idb)).toEqual({ 'schema-1': 'antraege.csv' });
  });

  it('wirft, wenn keine Datei im Ordner passt', async () => {
    const idb = await freshIdb();
    stubDirectoryPicker(new MemDir().add(new MemFile('falsch.csv', CSV_OTHER, 5000)));
    await expect(
      pickAndLinkCsvFolder(idb, [makeSchema({ source_file_name: undefined })]),
    ).rejects.toThrow();
  });
});
