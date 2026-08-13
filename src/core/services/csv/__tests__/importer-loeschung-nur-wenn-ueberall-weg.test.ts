/**
 * Regression (Wurzel „Löschung ohne Plausibilitätsprüfung", Tür 3):
 * `runMergeForDeltas` übernahm `removedJoinValues` EINER Quelle unbesehen als
 * `removedAz` — ohne zu prüfen, ob eine ANDERE Quelle denselben Antrag noch
 * führt. Fällt eine Zeile aus der Begleit- oder Projektbeschreibungs-Quelle
 * (kürzerer Export-Horizont, Teil-Export, Zeilenverlust), löschte der Merge den
 * Antrag samt Verbund-Referenz und Akronym-Index — obwohl der Master ihn
 * weiterführt.
 *
 * Fachliche Regel (Team-Entscheidung 2026-08-13): ein Antrag wird erst gelöscht,
 * wenn er in ALLEN Quellen verschwunden ist. Die Quellen haben unterschiedlich
 * lange Historien (Master + Begleitung reichen weiter zurück als die
 * Projektbeschreibung), „fehlt hier" heißt deshalb nicht „gibt es nicht mehr".
 *
 * Gegenprobe in beiden Richtungen: eine echte Löschung muss weiterhin
 * durchschlagen, sobald die LETZTE Quelle die Zeile fallen lässt — und ein
 * Antrag, den nur eine Quelle trägt, verschwindet unverändert sofort.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

vi.mock('../../infrastructure/build-lock', () => ({
  acquireBuildLock: vi.fn(async () => ({ acquired: true, lock: {} })),
  forceLock: vi.fn(async () => ({})),
  releaseLock: vi.fn(async () => undefined),
  readBuildLock: vi.fn(async () => null),
  isStale: vi.fn(() => false),
  heartbeat: vi.fn(async () => undefined),
  startHeartbeat: vi.fn(() => ({ stop: vi.fn(async () => undefined) })),
  HEARTBEAT_INTERVAL_MS: 15_000,
}));

// Der Merge liest die Quell-CSVs vom Share zurück (loadCsvSourceFile). Ohne
// Handle lieferte er 0 Rows und jeder gemergte Antrag bestünde nur aus seinem
// Aktenzeichen — dann liesse sich „der gehaltene Antrag behält seine Felder"
// nicht prüfen. Deshalb ein In-Memory-Share.
const shareState = vi.hoisted(() => ({ handle: null as unknown }));
vi.mock('../../infrastructure/smb-handle', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getDatenShareHandle: async () => shareState.handle,
}));

import { IDBStore } from '../../storage/idb-store';
import { putProgramm, getRowHashesForSchema, getAntrag } from '../idb-csv';
import { saveSchema } from '../schemaRegistry';
import { importCsvSource } from '../importer';
import type { CsvSchema, Programm } from '../types';

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

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  shareState.handle = new MemDir('share') as unknown as FileSystemDirectoryHandle;
});

const PID = 'p1';
const MASTER = 'schema-master';
const BGL = 'schema-bgl';
const VB = 'schema-verbund';

function makeProgramm(): Programm {
  return { id: PID, name: 'P1', created_at: '2026-08-13T00:00:00.000Z', smb_handle_key: 'daten-share' };
}

function makeMaster(): CsvSchema {
  return {
    id: MASTER,
    programm_id: PID,
    csv_source_name: '9097_AnB',
    is_master: true,
    join_key: 'aktenzeichen',
    priority: 10,
    column_mapping: { FKZ: { canonical: 'aktenzeichen' }, TITEL: { canonical: 'titel' } },
    encoding: 'UTF-8',
    separator: ';',
    created_at: '2026-08-13T00:00:00.000Z',
  };
}

function makeBgl(): CsvSchema {
  return {
    id: BGL,
    programm_id: PID,
    csv_source_name: '7737_Bgl',
    is_master: false,
    join_key: 'aktenzeichen',
    priority: 50,
    column_mapping: { FKZ: { canonical: 'aktenzeichen' }, ORT: { canonical: 'ort_afs' } },
    encoding: 'UTF-8',
    separator: ';',
    created_at: '2026-08-13T00:00:00.000Z',
  };
}

/** Sekundärquelle, die über verbund_id joint — ihre Join-Werte sind KEINE
 *  Aktenzeichen und dürfen deshalb keine Löschung aufhalten. */
function makeVerbundQuelle(): CsvSchema {
  return {
    id: VB,
    programm_id: PID,
    csv_source_name: '9052_PrjBsp',
    is_master: false,
    join_key: 'verbund_id',
    priority: 60,
    column_mapping: { VBNR: { canonical: 'verbund_id' }, INHALT: { canonical: 'verbund_titel' } },
    encoding: 'UTF-8',
    separator: ';',
    created_at: '2026-08-13T00:00:00.000Z',
  };
}

const MASTER_VOLL = 'FKZ;TITEL\n16EP0001;Alpha\n16EP0002;Beta\n16EP0003;Gamma\n';
const MASTER_OHNE_0001 = 'FKZ;TITEL\n16EP0002;Beta\n16EP0003;Gamma\n';
const MASTER_OHNE_0002 = 'FKZ;TITEL\n16EP0001;Alpha\n16EP0003;Gamma\n';
// Die Begleitung trägt 0001 mit — und mit 0009 einen Antrag, den der Master
// (kürzerer Horizont) gar nicht kennt.
const BGL_VOLL = 'FKZ;ORT\n16EP0001;Musterstadt\n16EP0009;Andernorts\n';
const BGL_OHNE_0001 = 'FKZ;ORT\n16EP0009;Andernorts\n';

const blob = (t: string): Blob => new Blob([t], { type: 'text/csv' });

async function freshIdb(): Promise<IDBStore> {
  const s = new IDBStore();
  await s.open();
  return s;
}

/** Programm + beide Aktenzeichen-Quellen im Vollstand importiert. */
async function setupZweiQuellen(): Promise<IDBStore> {
  const idb = await freshIdb();
  await putProgramm(idb, makeProgramm());
  await saveSchema(idb, makeMaster());
  await saveSchema(idb, makeBgl());
  await importCsvSource(idb, MASTER, blob(MASTER_VOLL), { force: true, deferSnapshotWrite: true });
  await importCsvSource(idb, BGL, blob(BGL_VOLL), { force: true, deferSnapshotWrite: true });
  expect(await getAntrag(idb, '16EP0001')).not.toBeNull();
  return idb;
}

describe('importCsvSource — Löschung erst, wenn der Antrag in ALLEN Quellen weg ist', () => {
  it('hält die Löschung zurück, solange eine andere Quelle den Antrag weiterführt', async () => {
    const idb = await setupZweiQuellen();

    const r = await importCsvSource(idb, MASTER, blob(MASTER_OHNE_0001), { force: true, deferSnapshotWrite: true });

    // Nicht gelöscht — und auch nicht als gelöscht gemeldet.
    expect(await getAntrag(idb, '16EP0001')).not.toBeNull();
    expect(r.buckets.removed).toBe(0);
    expect(r.removedAktenzeichen ?? []).toEqual([]);
    // …sondern ausgewiesen, damit der Rückhalt nicht still passiert.
    expect(r.heldRemovals).toBe(1);
    expect(r.heldRemovalExamples).toContain('16EP0001');

    // Die Quelle selbst führt die Zeile nicht mehr: ihr Row-Hash MUSS weg sein,
    // sonst hielte sie den Antrag später gegen die eigene Löschung fest.
    const masterHashes = await getRowHashesForSchema(idb, MASTER);
    expect(masterHashes.map(h => h.join_value).sort()).toEqual(['16EP0002', '16EP0003']);
  });

  it('lässt den gehaltenen Antrag unangetastet, statt ihn auf ein leeres Gerüst zu reduzieren', async () => {
    const idb = await setupZweiQuellen();
    const vorher = await getAntrag(idb, '16EP0001');
    expect(vorher?.titel).toBe('Alpha');

    await importCsvSource(idb, MASTER, blob(MASTER_OHNE_0001), { force: true, deferSnapshotWrite: true });

    // Ein Teil-Export darf den Bestand nicht aushöhlen: der Titel kam aus dem
    // Master, der Antrag behält ihn bis der Master ihn wieder liefert.
    const nachher = await getAntrag(idb, '16EP0001');
    expect(nachher?.titel).toBe('Alpha');
    expect(nachher?.ort_afs).toBe('Musterstadt');
  });

  it('löscht, sobald die LETZTE Quelle die Zeile fallen lässt (Master zuerst)', async () => {
    const idb = await setupZweiQuellen();
    await importCsvSource(idb, MASTER, blob(MASTER_OHNE_0001), { force: true, deferSnapshotWrite: true });

    const r = await importCsvSource(idb, BGL, blob(BGL_OHNE_0001), { force: true, deferSnapshotWrite: true });

    expect(r.buckets.removed).toBe(1);
    expect(r.removedAktenzeichen).toEqual(['16EP0001']);
    expect(await getAntrag(idb, '16EP0001')).toBeNull();
  });

  it('löscht ebenso, wenn die Sekundärquelle zuerst fällt (Reihenfolge egal)', async () => {
    const idb = await setupZweiQuellen();

    const r1 = await importCsvSource(idb, BGL, blob(BGL_OHNE_0001), { force: true, deferSnapshotWrite: true });
    expect(r1.buckets.removed).toBe(0);
    expect(r1.heldRemovals).toBe(1);
    expect(await getAntrag(idb, '16EP0001')).not.toBeNull();

    const r2 = await importCsvSource(idb, MASTER, blob(MASTER_OHNE_0001), { force: true, deferSnapshotWrite: true });
    expect(r2.buckets.removed).toBe(1);
    expect(await getAntrag(idb, '16EP0001')).toBeNull();
  });

  it('löscht unverändert sofort, wenn nur EINE Quelle den Antrag trägt', async () => {
    const idb = await setupZweiQuellen();

    // 16EP0002 steht nur im Master — die Begleitung kennt ihn nicht.
    const r = await importCsvSource(idb, MASTER, blob(MASTER_OHNE_0002), { force: true, deferSnapshotWrite: true });

    expect(r.buckets.removed).toBe(1);
    expect(r.heldRemovals ?? 0).toBe(0);
    expect(await getAntrag(idb, '16EP0002')).toBeNull();
  });

  it('lässt sich nicht von einer Quelle aufhalten, die über verbund_id joint', async () => {
    const idb = await setupZweiQuellen();
    await saveSchema(idb, makeVerbundQuelle());
    // Der Join-Wert dieser Quelle SIEHT aus wie ein Aktenzeichen, ist aber eine
    // Verbund-Nummer. Er darf die Löschung von 16EP0002 nicht blockieren.
    await importCsvSource(idb, VB, blob('VBNR;INHALT\n16EP0002;Verbundtext\n'), { force: true, deferSnapshotWrite: true });

    const r = await importCsvSource(idb, MASTER, blob(MASTER_OHNE_0002), { force: true, deferSnapshotWrite: true });

    expect(r.buckets.removed).toBe(1);
    expect(await getAntrag(idb, '16EP0002')).toBeNull();
  });
});
