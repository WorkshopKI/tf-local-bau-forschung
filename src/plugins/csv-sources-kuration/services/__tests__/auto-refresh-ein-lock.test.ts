/**
 * Ein Lock je Aktualisierungslauf (v3.46.1) — der gemeldete Fall.
 *
 * Gemeldet: Banner „2 CSV-Quellen haben neue Daten" → Klick → erste Quelle
 * importiert → statt der zweiten sprang das Banner auf „1 CSV-Quelle" → erneuter
 * Klick → „THü (PL) aktualisiert gerade (seit 0 Min)", obwohl niemand sonst in
 * der App war. Ursache: `importCsvSource` lockte pro Quelle; in dem
 * Freigabe-Fenster zwischen zwei Quellen legte ein noch laufender
 * Heartbeat-Schlag die gerade gelöschte Lock-Datei neu an, und das folgende
 * `acquireBuildLock` kannte kein „das bin ich selbst".
 *
 * Der Lauf nimmt den Lock jetzt EINMAL. Dieser Test hält beides fest: genau ein
 * Acquire für N Quellen, und ein hinterlassener EIGENER Lock hält den Lauf nicht
 * mehr auf. Die Besitz-Entscheider laufen dabei ECHT (`importOriginal`), nur die
 * SMB-/IDB-Seite ist gefälscht.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { BuildLock } from '@/core/services/infrastructure/types';
import type { CsvSchema } from '@/core/services/csv/types';

const h = vi.hoisted(() => ({
  lockDatei: null as BuildLock | null,
  haeltSelbst: false,
  acquireCalls: 0,
  forceCalls: 0,
  releaseCalls: 0,
  stopCalls: 0,
  reihenfolge: [] as string[],
  eigenerName: 'THü (PL)',
}));

vi.mock('@/core/services/infrastructure/build-lock', async importOriginal => {
  const echt = await importOriginal<typeof import('@/core/services/infrastructure/build-lock')>();
  const baue = (): BuildLock => ({
    programm_id: 'programm',
    stufe: 'csv-import',
    hostname: 'Win32',
    kurator_name: h.eigenerName,
    owner_id: echt.eigeneOwnerId(),
    gestartet: new Date().toISOString(),
    heartbeat: new Date().toISOString(),
  });
  return {
    ...echt,
    acquireBuildLock: async () => {
      h.acquireCalls++;
      h.reihenfolge.push('acquire');
      const da = h.lockDatei;
      if (da && !echt.isStale(da)
        && !echt.darfEigenenLockUebernehmen(da, echt.eigeneOwnerId(), h.haeltSelbst)) {
        return {
          acquired: false as const,
          existing: da,
          ageMinutes: 0,
          besitz: echt.bestimmeLockBesitz(da, echt.eigeneOwnerId(), h.eigenerName),
        };
      }
      h.lockDatei = baue();
      h.haeltSelbst = true;
      return { acquired: true as const, lock: h.lockDatei };
    },
    forceLock: async () => {
      h.forceCalls++;
      h.reihenfolge.push('force');
      h.lockDatei = baue();
      h.haeltSelbst = true;
      return h.lockDatei;
    },
    releaseLock: async () => {
      h.releaseCalls++;
      h.reihenfolge.push('release');
      h.lockDatei = null;
      h.haeltSelbst = false;
      return 'freigegeben' as const;
    },
    startHeartbeat: () => ({ stop: async () => { h.stopCalls++; } }),
  };
});

const csv = vi.hoisted(() => ({
  importCalls: [] as { schemaId: string; opts: Record<string, unknown> }[],
  importFehlerFuer: null as string | null,
  saveSchemaCalls: [] as string[],
  snapshotCalls: [] as string[],
}));

vi.mock('@/core/services/csv', () => ({
  importCsvSource: async (_idb: unknown, schemaId: string, _datei: unknown, opts: Record<string, unknown>) => {
    csv.importCalls.push({ schemaId, opts });
    if (csv.importFehlerFuer === schemaId) throw new Error('Quelle kaputt');
    return {
      skipped: false,
      buckets: { new: 1, changed: 0, unchanged: 0, removed: 0 },
      durationMs: 1,
      rowCount: 1,
      skippedJoinValues: [],
      importTimings: { parseMs: 1, hashDiffMs: 1, mergeMs: 1, snapshotWriteMs: 0 },
      changedAktenzeichen: ['16EP250140'],
      removedAktenzeichen: [],
    };
  },
  loadSchema: async (_idb: unknown, schemaId: string) => machSchema(schemaId),
  saveSchema: async (_idb: unknown, schema: CsvSchema) => { csv.saveSchemaCalls.push(schema.id); },
  parseCsvPreview: async () => ({ headers: ['AZ'], rows: [] }),
  listSchemas: async () => [],
  listProgramme: async () => [],
}));

vi.mock('@/core/services/csv/snapshot', () => ({
  writeProgrammSnapshot: async (_i: unknown, _h: unknown, pid: string) => {
    csv.snapshotCalls.push(pid);
    return { snapshotVersion: 1 };
  },
  writeProgrammSnapshotDelta: async (_i: unknown, _h: unknown, pid: string) => {
    csv.snapshotCalls.push(pid);
    return { mode: 'delta', snapshotVersion: 1 };
  },
}));

vi.mock('@/core/services/infrastructure/smb-handle', () => ({
  getDatenShareHandle: async () => ({}),
}));

vi.mock('@/core/services/infrastructure/audit-log', () => ({
  logAudit: async () => undefined,
}));

vi.mock('@/core/status/journal', () => ({
  journalisiereImport: async () => null,
}));

vi.mock('../../csv-source-handle', () => ({
  loadFileFromStoredHandle: async () => ({
    file: new File(['AZ\n'], 'q.csv', { lastModified: 1_717_000_000_000 }),
    handle: null,
  }),
  setCsvSourceHandle: async () => undefined,
  checkSourceForUpdate: async () => ({ state: 'up_to_date' }),
  getCsvSourceDirHandle: async () => null,
  getCsvDirFileMap: async () => ({}),
  setCsvDirFileMapEntries: async () => undefined,
}));

vi.mock('../../csv-source-filenames', () => ({
  loadSharedCsvFilenames: async () => ({}),
}));

vi.mock('@/config/feature-flags', () => ({
  isDeltaSnapshotWriteEnabled: () => true,
}));

import { runAutoRefresh, BuildLockBusyError, type RefreshCandidate } from '../auto-refresh';
import { eigeneOwnerId } from '@/core/services/infrastructure/build-lock';
import type { IDBStore } from '@/core/services/storage/idb-store';

const idb = {} as IDBStore;

function machSchema(id: string): CsvSchema {
  return {
    id,
    programm_id: 'default-programm',
    csv_source_name: id,
    is_master: false,
    join_key: 'aktenzeichen',
    priority: 50,
    column_mapping: { AZ: { canonical: 'aktenzeichen' } },
    encoding: 'UTF-8',
    separator: ';',
    created_at: '2026-06-03T00:00:00.000Z',
  };
}

const KANDIDATEN: RefreshCandidate[] = [
  { schemaId: '7737-bgl', schema: machSchema('7737-bgl') },
  { schemaId: '9097-anb', schema: machSchema('9097-anb') },
];

/** Der belegte Zustand: eigener Lock, frischer Heartbeat, Lauf längst beendet. */
function legeEigenenNachhall(): void {
  h.lockDatei = {
    programm_id: 'programm',
    stufe: 'csv-import',
    hostname: 'Win32',
    kurator_name: h.eigenerName,
    owner_id: eigeneOwnerId(),
    gestartet: new Date().toISOString(),
    heartbeat: new Date().toISOString(),
  };
  h.haeltSelbst = false;
}

function legeFremdLock(): void {
  h.lockDatei = {
    programm_id: 'programm',
    stufe: 'csv-import',
    hostname: 'Win32',
    kurator_name: 'BIB',
    owner_id: 'owner-fremd',
    gestartet: new Date().toISOString(),
    heartbeat: new Date().toISOString(),
  };
  h.haeltSelbst = false;
}

beforeEach(() => {
  h.lockDatei = null;
  h.haeltSelbst = false;
  h.acquireCalls = 0;
  h.forceCalls = 0;
  h.releaseCalls = 0;
  h.stopCalls = 0;
  h.reihenfolge.length = 0;
  csv.importCalls.length = 0;
  csv.importFehlerFuer = null;
  csv.saveSchemaCalls.length = 0;
  csv.snapshotCalls.length = 0;
});

describe('runAutoRefresh — ein Lock je Lauf', () => {
  it('zwei Quellen, EIN Acquire — auch mit hinterlassenem eigenem Lock', async () => {
    legeEigenenNachhall();

    const report = await runAutoRefresh(idb, KANDIDATEN, { kuratorName: h.eigenerName });

    // Der Kern: der eigene Nachhall hält den Lauf nicht mehr auf …
    expect(report.processed).toHaveLength(2);
    expect(report.errors).toHaveLength(0);
    // … und der Lock wird genau einmal genommen statt je Quelle.
    expect(h.acquireCalls).toBe(1);
    expect(h.forceCalls).toBe(0);
    expect(h.releaseCalls).toBe(1);
    expect(csv.importCalls.map(c => c.schemaId)).toEqual(['7737-bgl', '9097-anb']);
    for (const c of csv.importCalls) {
      expect(c.opts.lockHeldByCaller).toBe(true);
      expect(c.opts.deferSnapshotWrite).toBe(true);
    }
  });

  it('gibt erst nach dem gebündelten Snapshot-Write frei', async () => {
    await runAutoRefresh(idb, KANDIDATEN, { kuratorName: h.eigenerName });

    expect(csv.snapshotCalls).toEqual(['default-programm']);
    expect(h.reihenfolge).toEqual(['acquire', 'release']);
    // stop() vor release: der laufende Heartbeat-Schlag ist abgewartet.
    expect(h.stopCalls).toBe(1);
  });

  it('echter Fremd-Lock: Abbruch VOR dem ersten Import, nichts wird gestempelt', async () => {
    legeFremdLock();

    await expect(runAutoRefresh(idb, KANDIDATEN, { kuratorName: h.eigenerName }))
      .rejects.toBeInstanceOf(BuildLockBusyError);

    expect(csv.importCalls).toHaveLength(0);
    // Kein saveSchema ⇒ kein `source_last_modified`-Stempel ⇒ der nächste Lauf
    // greift dieselben Quellen wieder auf (früher blieb der Merge lokal liegen).
    expect(csv.saveSchemaCalls).toHaveLength(0);
    expect(csv.snapshotCalls).toHaveLength(0);
  });

  it('meldet den Besitz mit — „gleicher Name" ist kein Fremder', async () => {
    legeFremdLock();
    h.lockDatei = { ...h.lockDatei!, kurator_name: h.eigenerName };

    const fehler = await runAutoRefresh(idb, KANDIDATEN, { kuratorName: h.eigenerName })
      .catch((e: unknown) => e as BuildLockBusyError);

    expect(fehler).toBeInstanceOf(BuildLockBusyError);
    expect((fehler as BuildLockBusyError).besitz).toBe('gleicher-name');
  });

  it('force übernimmt den Fremd-Lock und fährt beide Quellen', async () => {
    legeFremdLock();

    const report = await runAutoRefresh(idb, KANDIDATEN, { kuratorName: h.eigenerName, force: true });

    expect(h.forceCalls).toBe(1);
    expect(h.acquireCalls).toBe(0);
    expect(report.processed).toHaveLength(2);
  });

  it('eine kaputte Quelle stoppt den Lauf nicht mehr', async () => {
    csv.importFehlerFuer = '7737-bgl';

    const report = await runAutoRefresh(idb, KANDIDATEN, { kuratorName: h.eigenerName });

    expect(report.errors.map(e => e.schemaId)).toEqual(['7737-bgl']);
    expect(report.processed.map(p => p.schemaId)).toEqual(['9097-anb']);
    expect(csv.snapshotCalls).toEqual(['default-programm']);
    expect(h.releaseCalls).toBe(1);
  });
});
