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
 *
 * Dazu (v3.47.0) die zweite Ausstiegsluke desselben Laufs: `driftAkzeptiertFuer`
 * — „Trotzdem importieren" gilt pro Quelle, hebt die Blockade durch fehlende
 * Spalten auf und benennt im Bericht, was übergangen wurde.
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
  /** Header, den `parseCsvPreview` MIT erzwungenem Encoding meldet (= Schema-Sicht). */
  headers: ['AZ', 'STATUS'] as string[],
  /** Header/Encoding der AUTO-Erkennung (ohne erzwungenes Encoding). */
  autoHeaders: null as string[] | null,
  autoEncoding: null as string | null,
  /** Jedes `saveSchema` mit dem geschriebenen Encoding — fuer die Heilungs-Pruefung. */
  saveSchemaEncodings: [] as (string | undefined)[],
  /** true = Import meldet KEINE Zeilen-Deltas (unveraenderter Export). */
  ohneDeltas: false,
}));

vi.mock('@/core/services/csv', () => ({
  importCsvSource: async (_idb: unknown, schemaId: string, _datei: unknown, opts: Record<string, unknown>) => {
    csv.importCalls.push({ schemaId, opts });
    if (csv.importFehlerFuer === schemaId) throw new Error('Quelle kaputt');
    return {
      skipped: false,
      buckets: csv.ohneDeltas
        ? { new: 0, changed: 0, unchanged: 5, removed: 0 }
        : { new: 1, changed: 0, unchanged: 0, removed: 0 },
      durationMs: 1,
      rowCount: 1,
      skippedJoinValues: [],
      importTimings: { parseMs: 1, hashDiffMs: 1, mergeMs: 1, snapshotWriteMs: 0 },
      changedAktenzeichen: ['16EP250140'],
      removedAktenzeichen: [],
    };
  },
  loadSchema: async (_idb: unknown, schemaId: string) => machSchema(schemaId),
  saveSchema: async (_idb: unknown, schema: CsvSchema) => {
    csv.saveSchemaCalls.push(schema.id);
    csv.saveSchemaEncodings.push(schema.encoding);
  },
  // Mit erzwungenem Encoding = die (moeglicherweise falsche) Schema-Sicht,
  // ohne = die Auto-Erkennung. Genau diese Zweiteilung nutzt die Heilung.
  parseCsvPreview: async (_file: unknown, _n: number, opts?: { encoding?: string }) => (
    opts?.encoding
      ? { headers: csv.headers, encoding: opts.encoding, rows: [] }
      : {
          headers: csv.autoHeaders ?? csv.headers,
          encoding: csv.autoEncoding ?? opts?.encoding ?? 'UTF-8',
          rows: [],
        }
  ),
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
    column_mapping: { AZ: { canonical: 'aktenzeichen' }, STATUS: { canonical: 'status' } },
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
  csv.headers = ['AZ', 'STATUS'];
  csv.autoHeaders = null;
  csv.autoEncoding = null;
  csv.saveSchemaEncodings.length = 0;
  csv.ohneDeltas = false;
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

  it('Encoding-Wechsel des Exports wird geheilt statt gemeldet', async () => {
    // Schema sagt UTF-8, der Export liegt jetzt in windows-1252: unter der
    // Schema-Sicht fehlt STATUS und STATUÖ ist „neu" — dieselbe Spalte zweimal.
    csv.headers = ['AZ', 'STATUÖ'];
    csv.autoHeaders = ['AZ', 'STATUS'];
    csv.autoEncoding = 'windows-1252';

    const report = await runAutoRefresh(idb, KANDIDATEN, { kuratorName: h.eigenerName });

    expect(report.drift).toHaveLength(0);
    expect(report.processed).toHaveLength(2);
    for (const p of report.processed) {
      expect(p.korrigiertesEncoding).toBe('windows-1252');
      // Nichts adoptiert, nichts uebergangen — nach der Heilung gibt es keine Drift.
      expect(p.autoAdoptedColumns).toBeUndefined();
      expect(p.uebergangeneSpalten).toBeUndefined();
    }
    // Das korrigierte Encoding steht VOR dem Import im Schema, damit
    // `importCsvSource` es ueber `loadSchema` selbst aufgreift.
    expect(csv.saveSchemaEncodings).toContain('windows-1252');
  });

  it('reine Schema-Aenderung wird publiziert — auch ohne Zeilen-Deltas', async () => {
    // Der belegte Fall: der Export hat nur seine Kodierung gewechselt, inhaltlich
    // ist er identisch (alles `unchanged`). Ohne Publish traegt der Snapshot die
    // ALTE Schema-Kopie weiter, jeder andere Rechner holt sie sich beim Sync
    // zurueck und heilt erneut — endlos.
    csv.headers = ['AZ', 'STATUÖ'];
    csv.autoHeaders = ['AZ', 'STATUS'];
    csv.autoEncoding = 'windows-1252';
    csv.ohneDeltas = true;

    const report = await runAutoRefresh(idb, KANDIDATEN, { kuratorName: h.eigenerName });

    expect(report.processed).toHaveLength(2);
    expect(csv.snapshotCalls).toEqual(['default-programm']);
  });

  it('ohne Schema-Aenderung UND ohne Deltas wird NICHT publiziert', async () => {
    csv.ohneDeltas = true;

    const report = await runAutoRefresh(idb, KANDIDATEN, { kuratorName: h.eigenerName });

    expect(report.processed).toHaveLength(2);
    expect(csv.snapshotCalls).toEqual([]);
  });

  it('Heilung nur, wenn danach KEINE Spalte mehr fehlt', async () => {
    csv.headers = ['AZ'];              // STATUS fehlt
    csv.autoHeaders = ['AZ'];          // … auch nach der Auto-Erkennung
    csv.autoEncoding = 'windows-1252';

    const report = await runAutoRefresh(idb, KANDIDATEN, { kuratorName: h.eigenerName });

    expect(report.processed).toHaveLength(0);
    expect(report.drift).toHaveLength(2);
    expect(csv.saveSchemaEncodings).not.toContain('windows-1252');
  });

  it('fehlende Spalte ohne Zustimmung: blockiert wie bisher, nichts wird importiert', async () => {
    csv.headers = ['AZ']; // STATUS ist aus dem Export verschwunden

    const report = await runAutoRefresh(idb, KANDIDATEN, { kuratorName: h.eigenerName });

    expect(report.drift.map(d => d.schemaId)).toEqual(['7737-bgl', '9097-anb']);
    expect(report.processed).toHaveLength(0);
    expect(csv.importCalls).toHaveLength(0);
    // Der Lock haengt am LAUF, nicht am Import: er wird auch dann sauber
    // genommen und freigegeben, wenn keine Quelle durchkommt.
    expect(h.acquireCalls).toBe(1);
    expect(h.releaseCalls).toBe(1);
  });

  it('„Trotzdem importieren" gilt genau der genannten Quelle', async () => {
    csv.headers = ['AZ'];

    const report = await runAutoRefresh(idb, KANDIDATEN, {
      kuratorName: h.eigenerName,
      driftAkzeptiertFuer: ['7737-bgl'],
    });

    // Die abgenickte Quelle laeuft durch und traegt die uebergangenen Spalten mit …
    expect(csv.importCalls.map(c => c.schemaId)).toEqual(['7737-bgl']);
    expect(report.processed).toHaveLength(1);
    expect(report.processed[0]?.uebergangeneSpalten).toEqual(['STATUS']);
    // … die andere bleibt blockiert. Die Zustimmung ist pro Quelle, nicht global.
    expect(report.drift.map(d => d.schemaId)).toEqual(['9097-anb']);
  });

  it('Zustimmung deckt fehlende und neue Spalten in EINEM Lauf ab', async () => {
    csv.headers = ['AZ', 'NEU']; // STATUS weg, NEU dazu

    const report = await runAutoRefresh(idb, KANDIDATEN, {
      kuratorName: h.eigenerName,
      driftAkzeptiertFuer: ['7737-bgl', '9097-anb'],
    });

    expect(report.drift).toHaveLength(0);
    expect(report.processed).toHaveLength(2);
    for (const p of report.processed) {
      expect(p.uebergangeneSpalten).toEqual(['STATUS']);
      expect(p.autoAdoptedColumns).toEqual(['NEU']);
    }
  });

  it('ohne Drift bleibt der Bericht schweigsam — keine Phantom-Meldung', async () => {
    const report = await runAutoRefresh(idb, KANDIDATEN, {
      kuratorName: h.eigenerName,
      driftAkzeptiertFuer: ['7737-bgl', '9097-anb'],
    });

    expect(report.processed).toHaveLength(2);
    for (const p of report.processed) {
      expect(p.uebergangeneSpalten).toBeUndefined();
      expect(p.autoAdoptedColumns).toBeUndefined();
    }
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
