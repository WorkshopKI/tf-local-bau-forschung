/**
 * Publish-Guard gegen den TEAM-WEITEN Datenverlust (Wurzel „Löschung ohne
 * Plausibilitätsprüfung"): `PUBLISH_PRESERVE_WHEN_EMPTY` deckt nur die kleinen
 * Struktur-Stores — die `antraege`-Schleife überspringt den Guard per
 * `if (key === 'antraege') continue`, und der Voll-Write streamt, was lokal in
 * der IDB steht. Jede Ursache, die den lokalen Bestand zusammenschrumpfen lässt
 * (abgeschnittener Export, verschwundene Join-Spalte, Whitespace im Header,
 * leere Unterprogramm-Zelle, Zeilenverlust in einer Sekundärquelle), wurde damit
 * kommentarlos auf den Share publiziert. `last_row_count` existiert, wird aber
 * nirgends VERGLICHEN — nur angezeigt.
 *
 * Der Guard ist eine Mengen-Plausibilität, kein Leer-Verbot: er greift erst ab
 * einer relevanten Basis und lässt normale Tages-Deltas unberührt.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import { putProgramm, putAntraege } from '../idb-csv';
import { writeProgrammSnapshot, writeProgrammSnapshotDelta } from '../snapshot';
import type { Antrag, Programm } from '../types';
import type { ProgrammSnapshotManifest } from '../snapshot';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

// ─── in-memory FileSystemDirectoryHandle (wie snapshot-empty-guard.test.ts) ───
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
function antraege(n: number, offset = 0): Antrag[] {
  return Array.from({ length: n }, (_, i) => az(`16EP${String(i + offset).padStart(5, '0')}`));
}

async function snapshotDir(share: MemDir): Promise<MemDir> {
  const p = await share.getDirectoryHandle('programm');
  const a = await p.getDirectoryHandle('antraege');
  const s = await a.getDirectoryHandle('snapshot');
  return s.getDirectoryHandle(PID);
}

/** Was steht WIRKLICH auf dem Share — Manifest-Count und Zeilen in der Datei. */
async function shareStand(share: MemDir): Promise<{ manifestCount: number; fileLines: number }> {
  const dir = await snapshotDir(share);
  const manifest = JSON.parse(
    await (await dir.getFileHandle('manifest.json')).getFile().then(f => f.text()),
  ) as ProgrammSnapshotManifest;
  const text = await (await dir.getFileHandle('antraege.jsonl')).getFile().then(f => f.text());
  return {
    manifestCount: (manifest.stores as Record<string, { count: number }>).antraege?.count ?? -1,
    fileLines: text.split('\n').filter(l => l.trim().length > 0).length,
  };
}

/** Ein zweiter Rechner/Zustand mit geschrumpftem Bestand, der auf denselben Share publiziert. */
async function schreiberMit(anzahl: number, name: string): Promise<IDBStore> {
  const idb = await idbNamed(name);
  await putProgramm(idb, makeProgramm());
  if (anzahl > 0) await putAntraege(idb, antraege(anzahl));
  return idb;
}

describe('Snapshot-Publish-Guard: Mengen-Plausibilität für antraege', () => {
  it('bricht ab, statt einen um zwei Drittel geschrumpften Bestand über den Share zu schreiben', async () => {
    const share = new MemDir('root');
    const voll = await schreiberMit(120, 'voll-1');
    await writeProgrammSnapshot(voll, asHandle(share), PID, 'w');
    expect(await shareStand(share)).toEqual({ manifestCount: 120, fileLines: 120 });

    // Der Löschkaskaden-Zustand: lokal sind nur noch 40 Anträge übrig.
    const geschrumpft = await schreiberMit(40, 'geschrumpft-1');
    await expect(
      writeProgrammSnapshot(geschrumpft, asHandle(share), PID, 'w'),
    ).rejects.toThrow(/40.*120|Schwund|Mengen-Plausibilität/i);

    // Der Share trägt unverändert den vollen Bestand.
    expect(await shareStand(share)).toEqual({ manifestCount: 120, fileLines: 120 });
  });

  it('bricht auch beim Total-Wipe ab (lokal 0, Share voll)', async () => {
    const share = new MemDir('root');
    const voll = await schreiberMit(120, 'voll-2');
    await writeProgrammSnapshot(voll, asHandle(share), PID, 'w');

    const leer = await schreiberMit(0, 'leer-2');
    await expect(writeProgrammSnapshot(leer, asHandle(share), PID, 'w')).rejects.toThrow();

    expect(await shareStand(share)).toEqual({ manifestCount: 120, fileLines: 120 });
  });

  it('lässt einen normalen Tages-Delta-Schwund durch (120 → 115)', async () => {
    const share = new MemDir('root');
    const voll = await schreiberMit(120, 'voll-3');
    await writeProgrammSnapshot(voll, asHandle(share), PID, 'w');

    const fastVoll = await schreiberMit(115, 'fast-voll-3');
    await writeProgrammSnapshot(fastVoll, asHandle(share), PID, 'w');

    expect(await shareStand(share)).toEqual({ manifestCount: 115, fileLines: 115 });
  });

  it('lässt Wachstum immer durch (120 → 200)', async () => {
    const share = new MemDir('root');
    const voll = await schreiberMit(120, 'voll-4');
    await writeProgrammSnapshot(voll, asHandle(share), PID, 'w');

    const gewachsen = await schreiberMit(200, 'gewachsen-4');
    await writeProgrammSnapshot(gewachsen, asHandle(share), PID, 'w');

    expect(await shareStand(share)).toEqual({ manifestCount: 200, fileLines: 200 });
  });

  it('greift nicht bei einer zu kleinen Basis (Erstbefüllung / Testbestand)', async () => {
    const share = new MemDir('root');
    const klein = await schreiberMit(8, 'klein-5');
    await writeProgrammSnapshot(klein, asHandle(share), PID, 'w');

    const nochKleiner = await schreiberMit(1, 'noch-kleiner-5');
    await writeProgrammSnapshot(nochKleiner, asHandle(share), PID, 'w');

    expect(await shareStand(share)).toEqual({ manifestCount: 1, fileLines: 1 });
  });

  it('schreibt den Erst-Snapshot ohne Vorgänger normal (kein Manifest = keine Basis)', async () => {
    const share = new MemDir('root');
    const erst = await schreiberMit(120, 'erst-6');
    await writeProgrammSnapshot(erst, asHandle(share), PID, 'w');
    expect(await shareStand(share)).toEqual({ manifestCount: 120, fileLines: 120 });
  });
});

describe('Snapshot-Publish-Guard: Mengen-Plausibilität im DELTA-Pfad', () => {
  /** Manifest-Rohdaten (Delta-Stand) vom Share. */
  async function manifestVomShare(share: MemDir): Promise<ProgrammSnapshotManifest> {
    const dir = await snapshotDir(share);
    return JSON.parse(
      await (await dir.getFileHandle('manifest.json')).getFile().then(f => f.text()),
    ) as ProgrammSnapshotManifest;
  }
  async function hatDatei(share: MemDir, name: string): Promise<boolean> {
    const dir = await snapshotDir(share);
    try { await dir.getFileHandle(name); return true; } catch { return false; }
  }

  it('bricht ab, wenn ein Delta den Großteil der Basis als entfernt meldet', async () => {
    const share = new MemDir('root');
    const voll = await schreiberMit(120, 'delta-voll-1');
    await writeProgrammSnapshot(voll, asHandle(share), PID, 'w', { emitDeltaBase: true });
    const vorher = await manifestVomShare(share);
    expect(vorher.version).toBe(2);

    // Die Löschkaskade meldet 100 von 120 Aktenzeichen als entfernt.
    const entfernt = antraege(100).map(a => a.aktenzeichen);
    await expect(
      writeProgrammSnapshotDelta(voll, asHandle(share), PID, 'w', { touchedAz: [], removedAz: entfernt }),
    ).rejects.toThrow(/20.*120|Schwund|Hälfte/i);

    // Nichts publiziert: kein Delta-Eintrag, keine Delta-Datei, Version unverändert.
    const nachher = await manifestVomShare(share);
    expect(nachher.delta?.deltas.length ?? -1).toBe(0);
    expect(nachher.snapshotVersion).toBe(vorher.snapshotVersion);
    expect(await hatDatei(share, 'antraege.delta.1.jsonl')).toBe(false);
  });

  it('lässt ein normales Tages-Delta durch (5 von 120 entfernt)', async () => {
    const share = new MemDir('root');
    const voll = await schreiberMit(120, 'delta-voll-2');
    await writeProgrammSnapshot(voll, asHandle(share), PID, 'w', { emitDeltaBase: true });

    const entfernt = antraege(5).map(a => a.aktenzeichen);
    const r = await writeProgrammSnapshotDelta(voll, asHandle(share), PID, 'w', { touchedAz: [], removedAz: entfernt });

    expect(r.mode).toBe('delta');
    const nachher = await manifestVomShare(share);
    expect(nachher.delta?.deltas.length).toBe(1);
  });
});
