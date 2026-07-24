/**
 * Snapshot-Datenverlust-Schutz an drei Stellen:
 *  1. Consumer-Guard: ein LEER publiziertes `csv_schemas` darf den nicht-leeren
 *     lokalen Store eines Consumers NICHT wischen (sonst 0 Schemas → ● CSV grau,
 *     kein Re-Link-Prompt — der reale Bug). Gegenprobe: ein legitim-leerer Store
 *     (unterprogramme) wird sehr wohl geleert (Guard ist gezielt).
 *  2. Publish-Guard: ein Rechner mit 0 Schemas überschreibt die echten Schemas des
 *     Shares NICHT.
 *  3. Backup-Historie: die kleinen Struktur-Stores bekommen je Publish eine
 *     versionierte, nicht-leere, distinkte Sicherung (letzte N Fassungen).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import {
  putProgramm,
  putAntraege,
  putSchema,
  listSchemasByProgramm,
  putUnterprogramm,
  listUnterprogrammeByProgramm,
} from '../idb-csv';
import { writeProgrammSnapshot, SMALL_STORE_BACKUP_KEEP } from '../snapshot';
import { syncProgrammSnapshot } from '../snapshot-sync';
import type { Antrag, Programm, CsvSchema, Unterprogramm } from '../types';
import type { ProgrammSnapshotManifest } from '../snapshot';

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
const asHandle = (d: MemDir): FileSystemDirectoryHandle => d as unknown as FileSystemDirectoryHandle;
async function idbNamed(name: string): Promise<IDBStore> { const s = new IDBStore(name); await s.open(); return s; }
function makeProgramm(): Programm {
  return { id: PID, name: 'P1', created_at: '2026-06-18T00:00:00.000Z', smb_handle_key: 'daten-share' } as Programm;
}
function az(id: string): Antrag {
  return { aktenzeichen: id, programm_id: PID, titel: id, _field_sources: {}, _updated_at: '2026-06-18T00:00:00.000Z' } as Antrag;
}
function schema(id: string): CsvSchema {
  return { id, programm_id: PID, csv_source_name: id, is_master: false } as unknown as CsvSchema;
}
function unterprogramm(id: string): Unterprogramm {
  return { id, programm_id: PID, name: id } as unknown as Unterprogramm;
}

async function snapshotDir(share: MemDir): Promise<MemDir> {
  const p = await share.getDirectoryHandle('programm');
  const a = await p.getDirectoryHandle('antraege');
  const s = await a.getDirectoryHandle('snapshot');
  return s.getDirectoryHandle(PID);
}

async function listBackups(share: MemDir, storeBase: string): Promise<string[]> {
  const dir = await snapshotDir(share);
  let backupsDir: MemDir;
  try { backupsDir = await dir.getDirectoryHandle('backups'); } catch { return []; }
  const out: string[] = [];
  for await (const k of backupsDir.keys()) {
    if (k.startsWith(storeBase + '.') && k.endsWith('.jsonl')) out.push(k);
  }
  return out.sort();
}
async function readBackup(share: MemDir, name: string): Promise<string> {
  const dir = await (await snapshotDir(share)).getDirectoryHandle('backups');
  return (await dir.getFileHandle(name)).getFile().then(f => f.text());
}
// Distinkte ISO-ms erzwingen (der Backup-Versionstag hat ms-Auflösung).
const tick = (): Promise<void> => new Promise(r => setTimeout(r, 3));

/** Simuliert einen defekten Republish: Store-Datei leeren + Manifest-Count/Hash auf
 *  „leer" setzen + Version hochziehen (so würde ein alter Sync den Store wischen). */
async function corruptStoreToEmpty(share: MemDir, file: string, storeKey: string): Promise<void> {
  const dir = await snapshotDir(share);
  const fh = await dir.getFileHandle(file, { create: true });
  const w = await fh.createWritable() as { write(s: string): Promise<void>; close(): Promise<void> };
  await w.write('');
  await w.close();
  const mfh = await dir.getFileHandle('manifest.json');
  const manifest = JSON.parse(await (await mfh.getFile()).text()) as ProgrammSnapshotManifest;
  (manifest.stores as Record<string, { count: number; hash: string }>)[storeKey] = { count: 0, hash: 'sha256-forced-empty' };
  manifest.snapshotVersion = '2026-07-24T12:00:00.000Z';
  const mw = await mfh.createWritable() as { write(s: string): Promise<void>; close(): Promise<void> };
  await mw.write(JSON.stringify(manifest));
  await mw.close();
}

describe('Snapshot-Sync Empty-Guard (csv_schemas darf nicht gewischt werden)', () => {
  it('leeres Remote-csv_schemas wischt den nicht-leeren lokalen Store NICHT', async () => {
    const writer = await idbNamed('writer');
    const consumer = await idbNamed('consumer');
    const share = new MemDir('root');

    await putProgramm(writer, makeProgramm());
    await putAntraege(writer, [az('A')]);
    await putSchema(writer, schema('s1'));
    await putSchema(writer, schema('s2'));
    await writeProgrammSnapshot(writer, asHandle(share), PID, 'w');

    // Consumer synct → hat jetzt 2 Schemas.
    await syncProgrammSnapshot(consumer, asHandle(share), PID, { force: true });
    expect(await listSchemasByProgramm(consumer, PID)).toHaveLength(2);

    // Defekter Republish: csv_schemas.jsonl leer.
    await corruptStoreToEmpty(share, 'csv_schemas.jsonl', 'csv_schemas');

    // Consumer synct erneut → GUARD: 2 Schemas bleiben erhalten (kein Wipe).
    const r = await syncProgrammSnapshot(consumer, asHandle(share), PID, { force: true });
    expect(r.synced).toBe(true);
    expect(await listSchemasByProgramm(consumer, PID)).toHaveLength(2);
  });

  it('Gegenprobe: ein legitim-leerer Store (unterprogramme) wird sehr wohl geleert', async () => {
    const writer = await idbNamed('writer2');
    const consumer = await idbNamed('consumer2');
    const share = new MemDir('root');

    await putProgramm(writer, makeProgramm());
    await putAntraege(writer, [az('A')]);
    await putUnterprogramm(writer, unterprogramm('u1'));
    await putUnterprogramm(writer, unterprogramm('u2'));
    await writeProgrammSnapshot(writer, asHandle(share), PID, 'w');

    await syncProgrammSnapshot(consumer, asHandle(share), PID, { force: true });
    expect(await listUnterprogrammeByProgramm(consumer, PID)).toHaveLength(2);

    await corruptStoreToEmpty(share, 'unterprogramme.jsonl', 'unterprogramme');

    await syncProgrammSnapshot(consumer, asHandle(share), PID, { force: true });
    // unterprogramme ist NICHT im Guard → wird korrekt auf 0 repliziert.
    expect(await listUnterprogrammeByProgramm(consumer, PID)).toHaveLength(0);
  });
});

describe('Snapshot-Publish-Guard (leeres csv_schemas nicht über volles publizieren)', () => {
  async function schemaCountOnShare(share: MemDir): Promise<{ manifestCount: number; fileLines: number }> {
    const dir = await snapshotDir(share);
    const manifest = JSON.parse(await (await dir.getFileHandle('manifest.json')).getFile().then(f => f.text())) as ProgrammSnapshotManifest;
    const text = await (await dir.getFileHandle('csv_schemas.jsonl')).getFile().then(f => f.text());
    return {
      manifestCount: (manifest.stores as Record<string, { count: number }>).csv_schemas?.count ?? -1,
      fileLines: text.split('\n').filter(l => l.trim().length > 0).length,
    };
  }

  it('ein Rechner mit 0 Schemas nullt die echten Schemas des Shares NICHT', async () => {
    const real = await idbNamed('real-writer');
    const empty = await idbNamed('empty-writer');
    const share = new MemDir('root');

    // Echter Kurator publiziert 2 Schemas.
    await putProgramm(real, makeProgramm());
    await putAntraege(real, [az('A')]);
    await putSchema(real, schema('s1'));
    await putSchema(real, schema('s2'));
    await writeProgrammSnapshot(real, asHandle(share), PID, 'real');
    expect(await schemaCountOnShare(share)).toEqual({ manifestCount: 2, fileLines: 2 });

    // Ein Rechner OHNE Schemas (z.B. Fixture-gefiltert) publiziert über denselben Share.
    await putProgramm(empty, makeProgramm());
    await putAntraege(empty, [az('A'), az('B')]);
    await writeProgrammSnapshot(empty, asHandle(share), PID, 'empty');

    // GUARD: die echten Schemas bleiben auf dem Share erhalten.
    expect(await schemaCountOnShare(share)).toEqual({ manifestCount: 2, fileLines: 2 });
  });
});

describe('Snapshot Backup-Historie kleiner Struktur-Stores', () => {
  it('legt eine nicht-leere csv_schemas-Sicherung an', async () => {
    const writer = await idbNamed('bk-writer');
    const share = new MemDir('root');
    await putProgramm(writer, makeProgramm());
    await putAntraege(writer, [az('A')]);
    await putSchema(writer, schema('s1'));
    await writeProgrammSnapshot(writer, asHandle(share), PID, 'w');

    const backups = await listBackups(share, 'csv_schemas');
    expect(backups).toHaveLength(1);
    expect(await readBackup(share, backups[0]!)).toContain('"id":"s1"');
  });

  it('unveränderter Store → keine Duplikat-Sicherung', async () => {
    const writer = await idbNamed('bk-writer2');
    const share = new MemDir('root');
    await putProgramm(writer, makeProgramm());
    await putAntraege(writer, [az('A')]);
    await putSchema(writer, schema('s1'));
    await writeProgrammSnapshot(writer, asHandle(share), PID, 'w');
    await tick();
    await writeProgrammSnapshot(writer, asHandle(share), PID, 'w'); // csv_schemas unverändert

    expect(await listBackups(share, 'csv_schemas')).toHaveLength(1);
  });

  it('geänderte Stände werden distinkt gesichert und auf SMALL_STORE_BACKUP_KEEP gekappt', async () => {
    const writer = await idbNamed('bk-writer3');
    const share = new MemDir('root');
    await putProgramm(writer, makeProgramm());
    await putAntraege(writer, [az('A')]);

    // SMALL_STORE_BACKUP_KEEP + 1 distinkte csv_schemas-Stände publizieren.
    for (let i = 1; i <= SMALL_STORE_BACKUP_KEEP + 1; i++) {
      await putSchema(writer, schema(`s${i}`));
      await tick();
      await writeProgrammSnapshot(writer, asHandle(share), PID, 'w');
    }

    const backups = await listBackups(share, 'csv_schemas');
    expect(backups).toHaveLength(SMALL_STORE_BACKUP_KEEP); // ältester gepruned
    // Die jüngste Sicherung enthält den vollen (letzten) Stand.
    expect(await readBackup(share, backups[backups.length - 1]!)).toContain(`"id":"s${SMALL_STORE_BACKUP_KEEP + 1}"`);
  });
});
