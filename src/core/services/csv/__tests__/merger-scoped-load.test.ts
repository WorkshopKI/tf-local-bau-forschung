/**
 * Äquivalenz-Test für den delta-skopierten Merge-Loader (v2.61.5, OOM-Fix).
 *
 * `loadScopedSchemasWithRows` lädt für einen Delta-Merge nur die CSV-Rows der
 * betroffenen Aktenzeichen (+ deren Verbund-/Akronym-Sekundärzeilen) statt aller
 * Quellen komplett. Dieser Test stellt sicher, dass das Merge-Ergebnis
 * (Anträge + Verbünde in der IDB) BIT-IDENTISCH zum Voll-Loader
 * `loadAllSchemasWithRows` ist — für mehrere Delta-Formen:
 *  - geänderter Antrag (aktenzeichen-Join + Verbund-Sekundär-Join),
 *  - reine Entfernung (removedAz braucht keine CSV-Rows),
 *  - neuer Antrag in bestehendem Verbund.
 *
 * `loadCsvSourceFile` liest sonst vom SMB-Handle (im Node-Test nicht vorhanden)
 * → hier per In-Memory-Map bedient; alles andere bleibt echter Code-Pfad.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

const { CSV_TEXTS } = vi.hoisted(() => ({ CSV_TEXTS: {} as Record<string, string> }));

vi.mock('../schemaRegistry', async (importActual) => {
  const actual = await importActual<typeof import('../schemaRegistry')>();
  return {
    ...actual,
    loadCsvSourceFile: async (_idb: unknown, schemaId: string) => CSV_TEXTS[schemaId] ?? null,
  };
});

import { IDBStore } from '../../storage/idb-store';
import { putProgramm, putSchema, listAntraegeByProgramm, listVerbuendeByProgramm } from '../idb-csv';
import {
  loadAllSchemasWithRows,
  loadScopedSchemasWithRows,
  recomputeMultipleBatched,
} from '../merger';
import type { Antrag, CsvSchema, Programm, Verbund } from '../types';

const PID = 'p1';
const SCHEMA_MASTER = 'schema-master';
const SCHEMA_VERBUND = 'schema-verbund';

const MASTER_CSV =
  'AZ;TITEL;VB;STATUS\n' +
  'A1;Titel 1;V1;neu\n' +
  'A2;Titel 2;V1;neu\n' +
  'A3;Titel 3;V2;neu\n';

const VERBUND_CSV =
  'VBID;VBTITEL\n' +
  'V1;Verbund Eins\n' +
  'V2;Verbund Zwei\n';

function makeProgramm(): Programm {
  return { id: PID, name: 'P1', created_at: '2026-06-03T00:00:00.000Z', smb_handle_key: 'daten-share' };
}

function masterSchema(): CsvSchema {
  return {
    id: SCHEMA_MASTER,
    programm_id: PID,
    csv_source_name: 'master',
    is_master: true,
    join_key: 'aktenzeichen',
    priority: 10,
    column_mapping: {
      AZ: { canonical: 'aktenzeichen' },
      TITEL: { canonical: 'titel' },
      VB: { canonical: 'verbund_id' },
      STATUS: { canonical: 'status' },
    },
    encoding: 'UTF-8',
    separator: ';',
    created_at: '2026-06-03T00:00:00.000Z',
  };
}

function verbundSchema(): CsvSchema {
  return {
    id: SCHEMA_VERBUND,
    programm_id: PID,
    csv_source_name: 'verbund',
    is_master: false,
    join_key: 'verbund_id',
    priority: 50,
    column_mapping: {
      VBID: { canonical: 'verbund_id' },
      VBTITEL: { canonical: 'verbund_titel' },
    },
    encoding: 'UTF-8',
    separator: ';',
    created_at: '2026-06-03T00:00:00.000Z',
  };
}

async function freshIdb(): Promise<IDBStore> {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  const s = new IDBStore();
  await s.open();
  return s;
}

/** IDB mit Programm + beiden Schemas + initial vollständig importierten Anträgen. */
async function setupBaseline(masterCsv = MASTER_CSV): Promise<IDBStore> {
  const idb = await freshIdb();
  await putProgramm(idb, makeProgramm());
  await putSchema(idb, masterSchema());
  await putSchema(idb, verbundSchema());
  CSV_TEXTS[SCHEMA_MASTER] = masterCsv;
  CSV_TEXTS[SCHEMA_VERBUND] = VERBUND_CSV;
  // Initial-Import: alle Aktenzeichen via Voll-Loader recomputen.
  const full = await loadAllSchemasWithRows(idb, PID);
  const allAz = ['A1', 'A2', 'A3'];
  await recomputeMultipleBatched(idb, PID, { touchedAz: allAz, removedAz: [], schemasCache: full });
  return idb;
}

/** Vergleichbarer Snapshot: _updated_at (Date.now-abhängig) entfernen, nach Key sortiert. */
function normAntraege(items: Antrag[]): Array<Omit<Antrag, '_updated_at'>> {
  return [...items]
    .sort((a, b) => a.aktenzeichen.localeCompare(b.aktenzeichen))
    .map(({ _updated_at: _ignored, ...rest }) => rest);
}
function normVerbuende(items: Verbund[]): Array<Omit<Verbund, '_updated_at'>> {
  return [...items]
    .sort((a, b) => a.verbund_id.localeCompare(b.verbund_id))
    .map(({ _updated_at: _ignored, ...rest }) => rest);
}

async function readState(idb: IDBStore): Promise<{ antraege: Antrag[]; verbuende: Verbund[] }> {
  return {
    antraege: await listAntraegeByProgramm(idb, PID),
    verbuende: await listVerbuendeByProgramm(idb, PID),
  };
}

beforeEach(() => {
  for (const k of Object.keys(CSV_TEXTS)) delete CSV_TEXTS[k];
});

describe('loadScopedSchemasWithRows — Äquivalenz zum Voll-Loader', () => {
  it('geänderter Antrag (Titel) → identisches Merge-Ergebnis wie Voll-Loader', async () => {
    const changedMaster = MASTER_CSV.replace('A2;Titel 2;V1;neu', 'A2;Titel 2 GEAENDERT;V1;neu');
    const touched = new Set(['A2']);

    // Pfad A: Voll-Loader.
    const idbA = await setupBaseline();
    CSV_TEXTS[SCHEMA_MASTER] = changedMaster;
    const fullA = await loadAllSchemasWithRows(idbA, PID);
    await recomputeMultipleBatched(idbA, PID, { touchedAz: [...touched], removedAz: [], schemasCache: fullA });
    const stateA = await readState(idbA);

    // Pfad B: skopierter Loader.
    const idbB = await setupBaseline();
    CSV_TEXTS[SCHEMA_MASTER] = changedMaster;
    const scopedB = await loadScopedSchemasWithRows(idbB, PID, touched);
    await recomputeMultipleBatched(idbB, PID, { touchedAz: [...touched], removedAz: [], schemasCache: scopedB });
    const stateB = await readState(idbB);

    expect(normAntraege(stateB.antraege)).toEqual(normAntraege(stateA.antraege));
    expect(normVerbuende(stateB.verbuende)).toEqual(normVerbuende(stateA.verbuende));
    // Sanity: die Änderung ist tatsächlich angekommen.
    const a2 = stateB.antraege.find(a => a.aktenzeichen === 'A2');
    expect(a2?.titel).toBe('Titel 2 GEAENDERT');
  });

  it('skopierter Loader lädt deutlich weniger Rows als der Voll-Loader', async () => {
    const idb = await setupBaseline();
    const touched = new Set(['A2']);
    const full = await loadAllSchemasWithRows(idb, PID);
    const scoped = await loadScopedSchemasWithRows(idb, PID, touched);

    const masterFull = full.find(s => s.schema.id === SCHEMA_MASTER)!;
    const masterScoped = scoped.find(s => s.schema.id === SCHEMA_MASTER)!;
    expect(masterFull.rows.length).toBe(3);
    expect(masterScoped.rows.length).toBe(1); // nur A2
    // Verbund-Sekundär: nur V1 (A2 hängt an V1), nicht V2.
    const vbScoped = scoped.find(s => s.schema.id === SCHEMA_VERBUND)!;
    expect(vbScoped.rows.length).toBe(1);
    expect((vbScoped.rows[0] as Record<string, string>).VBID).toBe('V1');
  });

  it('reine Entfernung (removedAz) → identisch, ohne CSV-Rows zu laden', async () => {
    // A3 hängt allein an V2 → V2 muss mit-gelöscht werden.
    const removed = ['A3'];

    const idbA = await setupBaseline();
    const fullA = await loadAllSchemasWithRows(idbA, PID);
    await recomputeMultipleBatched(idbA, PID, { touchedAz: [], removedAz: removed, schemasCache: fullA });
    const stateA = await readState(idbA);

    const idbB = await setupBaseline();
    const scopedB = await loadScopedSchemasWithRows(idbB, PID, new Set()); // leer → []
    expect(scopedB).toEqual([]);
    await recomputeMultipleBatched(idbB, PID, { touchedAz: [], removedAz: removed, schemasCache: scopedB });
    const stateB = await readState(idbB);

    expect(normAntraege(stateB.antraege)).toEqual(normAntraege(stateA.antraege));
    expect(normVerbuende(stateB.verbuende)).toEqual(normVerbuende(stateA.verbuende));
    expect(stateB.antraege.find(a => a.aktenzeichen === 'A3')).toBeUndefined();
    expect(stateB.verbuende.find(v => v.verbund_id === 'V2')).toBeUndefined();
  });

  it('neuer Antrag in bestehendem Verbund → identisch + Verbund-Titel verknüpft', async () => {
    const withA4 = MASTER_CSV + 'A4;Titel 4;V1;neu\n';
    const touched = new Set(['A4']);

    const idbA = await setupBaseline();
    CSV_TEXTS[SCHEMA_MASTER] = withA4;
    const fullA = await loadAllSchemasWithRows(idbA, PID);
    await recomputeMultipleBatched(idbA, PID, { touchedAz: [...touched], removedAz: [], schemasCache: fullA });
    const stateA = await readState(idbA);

    const idbB = await setupBaseline();
    CSV_TEXTS[SCHEMA_MASTER] = withA4;
    const scopedB = await loadScopedSchemasWithRows(idbB, PID, touched);
    await recomputeMultipleBatched(idbB, PID, { touchedAz: [...touched], removedAz: [], schemasCache: scopedB });
    const stateB = await readState(idbB);

    expect(normAntraege(stateB.antraege)).toEqual(normAntraege(stateA.antraege));
    expect(normVerbuende(stateB.verbuende)).toEqual(normVerbuende(stateA.verbuende));
    const a4 = stateB.antraege.find(a => a.aktenzeichen === 'A4');
    expect(a4?.verbund_id).toBe('V1');
    const v1 = stateB.verbuende.find(v => v.verbund_id === 'V1');
    expect(v1?.teilantrags_ids).toContain('A4');
  });
});
