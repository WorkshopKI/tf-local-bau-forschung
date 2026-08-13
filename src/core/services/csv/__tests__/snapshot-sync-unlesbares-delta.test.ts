/**
 * Regression (Wurzel „Fehlersignale werden geschluckt", v4.12-Nachzug):
 * `syncAntraegeViaDelta` las die Delta-Dateien mit `readText`, das „Datei fehlt"
 * und „Datei liess sich nicht lesen" beide auf `null` abbildet. Aus einem
 * SMB-Aussetzer wurde damit ein LEERES Delta — angewandt, Seq-Cursor
 * weitergeschoben, und die Änderungen dieses Tages waren auf dem Rechner
 * dauerhaft weg: der nächste Sync hielt sich für aktuell.
 *
 * v4.12.0 hat die Unterscheidung als `readTextLage` gebaut (fehlend ≠ unlesbar)
 * und auf die SCHREIBER angewendet. Der Delta-Leser blieb übrig.
 *
 * Regel hier: unlesbar → abbrechen, Cursor stehen lassen, beim nächsten Sync
 * erneut versuchen. Fehlend → die Datei kommt nicht wieder, also Voll-Basis
 * erzwingen statt ein leeres Delta zu verbuchen.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import { putProgramm, putAntraege, listAntraegeByProgramm } from '../idb-csv';
import { writeProgrammSnapshot, writeProgrammSnapshotDelta } from '../snapshot';
import { syncProgrammSnapshot } from '../snapshot-sync';
import type { Antrag, Programm } from '../types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

// ─── in-memory FileSystemDirectoryHandle (read+write), mit Lese-Aussetzer ────
class MemFile {
  readonly kind = 'file' as const;
  content = new Uint8Array(0);
  /** true = jeder Lesezugriff schlägt fehl (SMB-Aussetzer, gesperrte Datei). */
  unlesbar = false;
  constructor(public name: string) {}
  async getFile(): Promise<Blob> {
    if (this.unlesbar) {
      const e = new Error('konnte nicht gelesen werden');
      e.name = 'NotReadableError';
      throw e;
    }
    return new Blob([this.content]);
  }
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
  return { aktenzeichen: id, programm_id: PID, titel, _field_sources: {}, _updated_at: '2026-08-13T00:00:00.000Z' } as Antrag;
}
function makeProgramm(): Programm {
  return { id: PID, name: 'P1', created_at: '2026-08-13T00:00:00.000Z', smb_handle_key: 'daten-share' } as Programm;
}
async function idbNamed(name: string): Promise<IDBStore> { const s = new IDBStore(name); await s.open(); return s; }
const asHandle = (d: MemDir): FileSystemDirectoryHandle => d as unknown as FileSystemDirectoryHandle;

async function azSet(idb: IDBStore): Promise<Record<string, string>> {
  const all = await listAntraegeByProgramm(idb, PID);
  const out: Record<string, string> = {};
  for (const a of all) out[a.aktenzeichen] = String(a.titel);
  return out;
}

/** programm/antraege/snapshot/<pid>/ — dorthin schreibt navigateSnapshotDir. */
async function snapshotDir(share: MemDir): Promise<MemDir> {
  const programm = await share.getDirectoryHandle('programm');
  const antraege = await programm.getDirectoryHandle('antraege');
  const snap = await antraege.getDirectoryHandle('snapshot');
  return snap.getDirectoryHandle(PID);
}

/** Die Delta-Dateien des Programm-Ordners (antraege.delta.<seq>.jsonl / .removed). */
async function deltaDateien(share: MemDir): Promise<MemFile[]> {
  const dir = await snapshotDir(share);
  const out: MemFile[] = [];
  for (const [name, child] of dir.children) {
    if (child.kind === 'file' && name.startsWith('antraege.delta.')) out.push(child);
  }
  return out;
}

/** Schreiber mit Basis (A1/B1) + einem Delta (B→B2), Konsument auf Basis-Stand. */
async function setup(suffix: string): Promise<{ writer: IDBStore; consumer: IDBStore; share: MemDir }> {
  const writer = await idbNamed(`writer-${suffix}`);
  const consumer = await idbNamed(`consumer-${suffix}`);
  const share = new MemDir('root');
  await putProgramm(writer, makeProgramm());
  await putAntraege(writer, [az('A', 'A1'), az('B', 'B1')]);
  await writeProgrammSnapshot(writer, asHandle(share), PID, 'w', { emitDeltaBase: true });

  await syncProgrammSnapshot(consumer, asHandle(share), PID, { force: true });
  expect(await azSet(consumer)).toEqual({ A: 'A1', B: 'B1' });

  await putAntraege(writer, [az('B', 'B2')]);
  const d = await writeProgrammSnapshotDelta(writer, asHandle(share), PID, 'w', { touchedAz: ['B'], removedAz: [] });
  expect(d.mode).toBe('delta');
  return { writer, consumer, share };
}

describe('syncAntraegeViaDelta — unlesbar ist nicht leer', () => {
  it('verbucht ein unlesbares Delta nicht als leeres — die Änderung kommt nach', async () => {
    const { consumer, share } = await setup('a');
    const dateien = await deltaDateien(share);
    expect(dateien.length).toBeGreaterThan(0);
    for (const f of dateien) f.unlesbar = true;

    // Lauf 1: Datei nicht lesbar. Der alte Stand darf stehen bleiben…
    await syncProgrammSnapshot(consumer, asHandle(share), PID, { force: true });
    expect(await azSet(consumer)).toEqual({ A: 'A1', B: 'B1' });

    // …aber der Cursor darf NICHT weitergelaufen sein: sobald der Share wieder
    // antwortet, muss dasselbe Delta ankommen.
    for (const f of dateien) f.unlesbar = false;
    await syncProgrammSnapshot(consumer, asHandle(share), PID, { force: true });
    expect(await azSet(consumer)).toEqual({ A: 'A1', B: 'B2' });
  });

  it('meldet den Lauf als unvollständig, statt still weiterzulaufen', async () => {
    const { consumer, share } = await setup('b');
    for (const f of await deltaDateien(share)) f.unlesbar = true;

    const r = await syncProgrammSnapshot(consumer, asHandle(share), PID, { force: true });

    // `synced` bleibt true — was geladen wurde, ist geladen, und der
    // In-Memory-Store muss es nachziehen. Die Lücke steht daneben.
    expect(r.synced).toBe(true);
    expect(r.incomplete).toBe(true);
  });

  it('bleibt auch stehen, wenn die Delta-Datei wirklich fehlt, und holt beim Voll-Snapshot auf', async () => {
    const { writer, consumer, share } = await setup('c');
    const dir = await snapshotDir(share);
    for (const [name, child] of [...dir.children]) {
      if (child.kind === 'file' && name.startsWith('antraege.delta.')) dir.children.delete(name);
    }

    // Das Delta ist unwiederbringlich weg. Ein leeres Delta zu verbuchen hiesse,
    // B2 nie wieder zu sehen — der Cursor bleibt also stehen.
    const r = await syncProgrammSnapshot(consumer, asHandle(share), PID, { force: true });
    expect(r.incomplete).toBe(true);
    expect(await azSet(consumer)).toEqual({ A: 'A1', B: 'B1' });

    // Sobald der Schreiber eine frische Voll-Basis veröffentlicht (Compaction),
    // löst sich der Stillstand auf.
    await writeProgrammSnapshot(writer, asHandle(share), PID, 'w', { emitDeltaBase: true });
    await syncProgrammSnapshot(consumer, asHandle(share), PID, { force: true });
    expect(await azSet(consumer)).toEqual({ A: 'A1', B: 'B2' });
  });
});
