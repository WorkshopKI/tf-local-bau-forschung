/**
 * Regression (Wurzel „Löschung ohne Plausibilitätsprüfung", Tür 2):
 * `removedJoinValues` entstand aus „Join-Wert war nicht in `seen`" — und `seen`
 * füllt nur, was der Import auch AUSGEWERTET hat. Eine Zeile, die im Export
 * steht, aber am Unterprogramm-Filter hängenbleibt oder gar keinen Join-Wert
 * trägt, sah damit genauso aus wie eine Zeile, die es nicht mehr gibt: der
 * Antrag wurde gelöscht und die Löschung team-weit publiziert.
 *
 * Fachliche Regel (Team-Entscheidung 2026-08-13): gefiltert heisst „ich weiss
 * es nicht", nicht „gibt es nicht". Der Schnitt läuft deshalb zwischen
 *
 *   - Zelle leer oder Code im Katalog unbekannt  → unbekannt, NICHT löschen
 *   - Code bekannt, vom Kurator deaktiviert      → bewusste Kuration, löschen
 *
 * Zeilen OHNE Join-Wert bleiben davon unberührt: sie werden exakt gezählt und
 * gemeldet, lösen aber keine Sonderbehandlung aus — am echten Bestand gemessen
 * sind sie bei der Projektbeschreibung der Normalfall (28 926 von 43 149), und
 * ohne Join-Wert stand die Zeile nie in den Row-Hashes.
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

const shareState = vi.hoisted(() => ({ handle: null as unknown }));
vi.mock('../../infrastructure/smb-handle', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getDatenShareHandle: async () => shareState.handle,
}));

import { IDBStore } from '../../storage/idb-store';
import { putProgramm, putUnterprogramm, getRowHashesForSchema, getAntrag } from '../idb-csv';
import { saveSchema } from '../schemaRegistry';
import { importCsvSource } from '../importer';
import type { CsvSchema, Programm, Unterprogramm } from '../types';

// ─── in-memory FileSystemDirectoryHandle (wie importer-loeschung-nur-wenn-ueberall-weg) ───
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
    column_mapping: {
      FKZ: { canonical: 'aktenzeichen' },
      TITEL: { canonical: 'titel' },
      FM_NUMMER: { canonical: 'unterprogramm_id' },
    },
    encoding: 'UTF-8',
    separator: ';',
    created_at: '2026-08-13T00:00:00.000Z',
  };
}

function makeUp(code: string, aktiv: boolean): Unterprogramm {
  return {
    id: code, programm_id: PID, code, aktiv,
    created_at: '2026-08-13T00:00:00.000Z', updated_at: '2026-08-13T00:00:00.000Z',
  };
}

const blob = (t: string): Blob => new Blob([t], { type: 'text/csv' });

/** Beide Anträge stehen unter dem AKTIVEN Unterprogramm 4711. */
const VOLL = 'FKZ;TITEL;FM_NUMMER\n16EP0001;Alpha;4711\n16EP0002;Beta;4711\n';

/**
 * Ein Programm, EINE Aktenzeichen-Quelle (damit die Regel aus v4.11 —
 * „andere Quelle trägt ihn weiter" — hier nichts abfängt und wirklich diese
 * Wurzel gemessen wird), Unterprogramm 4711 aktiv, 4712 deaktiviert.
 */
async function setup(): Promise<IDBStore> {
  const idb = new IDBStore();
  await idb.open();
  await putProgramm(idb, makeProgramm());
  await putUnterprogramm(idb, makeUp('4711', true));
  await putUnterprogramm(idb, makeUp('4712', false));
  await saveSchema(idb, makeMaster());
  await importCsvSource(idb, MASTER, blob(VOLL), { force: true, deferSnapshotWrite: true });
  expect(await getAntrag(idb, '16EP0002')).not.toBeNull();
  return idb;
}

describe('importCsvSource — gefiltert heisst nicht gelöscht', () => {
  it('löscht nicht, wenn die Unterprogramm-Zelle leer ist', async () => {
    const idb = await setup();

    const r = await importCsvSource(
      idb, MASTER, blob('FKZ;TITEL;FM_NUMMER\n16EP0001;Alpha;4711\n16EP0002;Beta;\n'),
      { force: true, deferSnapshotWrite: true },
    );

    expect(await getAntrag(idb, '16EP0002')).not.toBeNull();
    expect(r.buckets.removed).toBe(0);
    expect(r.unknownUnterprogramm).toBe(1);
  });

  it('löscht nicht, wenn der Unterprogramm-Code im Katalog unbekannt ist', async () => {
    const idb = await setup();

    const r = await importCsvSource(
      idb, MASTER, blob('FKZ;TITEL;FM_NUMMER\n16EP0001;Alpha;4711\n16EP0002;Beta;9999\n'),
      { force: true, deferSnapshotWrite: true },
    );

    expect(await getAntrag(idb, '16EP0002')).not.toBeNull();
    expect(r.buckets.removed).toBe(0);
    expect(r.unknownUnterprogramm).toBe(1);
  });

  it('behält den Row-Hash der gefilterten Zeile — die Quelle trägt sie ja', async () => {
    const idb = await setup();

    await importCsvSource(
      idb, MASTER, blob('FKZ;TITEL;FM_NUMMER\n16EP0001;Alpha;4711\n16EP0002;Beta;9999\n'),
      { force: true, deferSnapshotWrite: true },
    );

    // Bliebe der Hash nicht stehen, hielte diese Quelle den Antrag später nicht
    // mehr gegen die Löschung durch eine andere — und die Zeile käme beim
    // nächsten Lauf als „neu" zurück, obwohl sie sich nie bewegt hat.
    const hashes = await getRowHashesForSchema(idb, MASTER);
    expect(hashes.map(h => h.join_value).sort()).toEqual(['16EP0001', '16EP0002']);
  });

  it('löscht weiterhin, wenn das Unterprogramm bekannt und bewusst deaktiviert ist', async () => {
    const idb = await setup();

    const r = await importCsvSource(
      idb, MASTER, blob('FKZ;TITEL;FM_NUMMER\n16EP0001;Alpha;4711\n16EP0002;Beta;4712\n'),
      { force: true, deferSnapshotWrite: true },
    );

    expect(r.buckets.removed).toBe(1);
    expect(r.skippedInactiveUnterprogramm).toBe(1);
    expect(await getAntrag(idb, '16EP0002')).toBeNull();
  });

  it('zählt Zeilen ohne Join-Wert exakt, hält den Lauf aber nicht auf', async () => {
    const idb = await setup();

    // Am ECHTEN Bestand gemessen: die Projektbeschreibung führt 28 926 von
    // 43 149 Zeilen ohne Förderkennzeichen (Irrläufer, frühe Phasen — alle
    // Felder belegt, nur eben ohne FKZ). Solche Zeilen sind der Normalfall
    // dieser Quelle. Wer daraufhin die Löschungen des Laufs aussetzt, legt sie
    // für sie dauerhaft still. Ohne Join-Wert stand die Zeile ausserdem nie in
    // den Row-Hashes — für sich genommen kann sie gar keine Löschung auslösen.
    const r = await importCsvSource(
      idb, MASTER, blob('FKZ;TITEL;FM_NUMMER\n16EP0001;Alpha;4711\n;Ohne Kennzeichen;4711\n'),
      { force: true, deferSnapshotWrite: true },
    );

    expect(r.rowsWithoutJoinValue).toBe(1);
    expect(r.buckets.removed).toBe(1);
    expect(await getAntrag(idb, '16EP0002')).toBeNull();
  });

  it('zählt exakt statt die gedeckelte Warnungs-Stichprobe zu melden', async () => {
    const idb = await setup();
    const viele = ['FKZ;TITEL;FM_NUMMER', '16EP0001;Alpha;4711', '16EP0002;Beta;4711'];
    for (let i = 0; i < 25; i++) viele.push(`;Ohne Kennzeichen ${i};4711`);

    const r = await importCsvSource(idb, MASTER, blob(viele.join('\n') + '\n'), { force: true, deferSnapshotWrite: true });

    // `skippedJoinValues` ist auf MAX_SKIP_WARNINGS (10) gedeckelt und las sich
    // in der Oberfläche als Mengenangabe.
    expect(r.rowsWithoutJoinValue).toBe(25);
    expect(r.skippedJoinValues?.length).toBeLessThan(25);
  });

  it('löscht unverändert sofort, wenn eine Zeile wirklich fehlt (Gegenprobe)', async () => {
    const idb = await setup();

    const r = await importCsvSource(
      idb, MASTER, blob('FKZ;TITEL;FM_NUMMER\n16EP0001;Alpha;4711\n'),
      { force: true, deferSnapshotWrite: true },
    );

    expect(r.buckets.removed).toBe(1);
    expect(await getAntrag(idb, '16EP0002')).toBeNull();
  });
});
