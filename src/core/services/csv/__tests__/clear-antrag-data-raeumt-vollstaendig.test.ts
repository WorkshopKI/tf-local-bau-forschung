/**
 * Regression (Wurzel „Slim-Projektion läuft aus dem Ruder"): „Antrags-Daten
 * zurücksetzen" leerte sechs Stores — aber weder die Slim-Projektion
 * `ANTRAEGE_LIST_VIEW` noch die Snapshot-Sync-Marken.
 *
 * Folge: Tabelle, Startseite und Suche lesen ausschliesslich die Projektion und
 * zeigten den alten Bestand weiter, obwohl der Reset „13 000 Anträge gelöscht"
 * meldete. Und der nächste Sync verglich seine Marken mit dem Manifest, fand
 * „schon integriert" und lud nichts nach — der Reset war damit eine Sackgasse
 * statt eines Neuanfangs.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import {
  putProgramm, putAntraege, putAntraegeListView, listAllAntraegeListView,
  clearAntragData, listAntraegeByProgramm,
} from '../idb-csv';
import { SYNC_VERSION_KEY, SYNC_DELTA_SEQ_KEY, SYNC_BASE_VERSION_KEY } from '../snapshot-keys';
import { SNAPSHOT_RECORD_HASHES_KEY } from '../incremental-antraege';
import type { Antrag, AntragListItem, Programm } from '../types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

const PID = 'p1';

async function setup(): Promise<IDBStore> {
  const idb = new IDBStore();
  await idb.open();
  await putProgramm(idb, { id: PID, name: 'P1', created_at: '2026-08-13T00:00:00.000Z', smb_handle_key: 'daten-share' } as Programm);
  await putAntraege(idb, [
    { aktenzeichen: '16EP0001', programm_id: PID, titel: 'Alpha' } as Antrag,
    { aktenzeichen: '16EP0002', programm_id: PID, titel: 'Beta' } as Antrag,
  ]);
  await putAntraegeListView(idb, [
    { aktenzeichen: '16EP0001', programm_id: PID, titel: 'Alpha' } as AntragListItem,
    { aktenzeichen: '16EP0002', programm_id: PID, titel: 'Beta' } as AntragListItem,
  ]);
  await idb.set(SYNC_VERSION_KEY(PID), '2026-08-13T10:00:00.000Z');
  await idb.set(SYNC_DELTA_SEQ_KEY(PID), 7);
  await idb.set(SYNC_BASE_VERSION_KEY(PID), '2026-08-01T00:00:00.000Z');
  await idb.set(SNAPSHOT_RECORD_HASHES_KEY(PID), { '16EP0001': 'h1' });
  return idb;
}

describe('clearAntragData — räumt, was die App wirklich liest', () => {
  it('leert auch die Slim-Projektion, nicht nur den Voll-Store', async () => {
    const idb = await setup();

    await clearAntragData(idb);

    expect(await listAntraegeByProgramm(idb, PID)).toEqual([]);
    // Tabelle/Startseite/Suche lesen NUR diese Projektion.
    expect(await listAllAntraegeListView(idb)).toEqual([]);
  });

  it('räumt die Snapshot-Sync-Marken, damit der nächste Sync wirklich lädt', async () => {
    const idb = await setup();

    await clearAntragData(idb);

    expect(await idb.get(SYNC_VERSION_KEY(PID))).toBeNull();
    expect(await idb.get(SYNC_DELTA_SEQ_KEY(PID))).toBeNull();
    expect(await idb.get(SYNC_BASE_VERSION_KEY(PID))).toBeNull();
    expect(await idb.get(SNAPSHOT_RECORD_HASHES_KEY(PID))).toBeNull();
  });

  it('meldet die geleerte Projektion mit, statt sie zu verschweigen', async () => {
    const idb = await setup();

    const r = await clearAntragData(idb);

    expect(r.antraege).toBe(2);
    expect(r.listView).toBe(2);
  });

  it('lässt Programme und Schemas stehen (Re-Import ohne Wizard)', async () => {
    const idb = await setup();

    await clearAntragData(idb);

    const { listProgramme } = await import('../idb-csv');
    expect((await listProgramme(idb)).map(p => p.id)).toEqual([PID]);
  });
});
