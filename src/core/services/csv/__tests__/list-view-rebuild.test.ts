/**
 * v2.28.3: `rebuildAntraegeListView` spiegelt den vollen ANTRAEGE-Store in die
 * Slim-Projektion ANTRAEGE_LIST_VIEW. Nötig nach einem Snapshot-Sync, der nur
 * den ANTRAEGE-Store via `replaceStore` ersetzt — die Home liest aber die
 * List-View, die der Snapshot nicht enthält. Ohne den Rebuild blieb die Home
 * nach „Jetzt laden" bis zum manuellen Reload leer.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import {
  putProgramm,
  putAntraege,
  putAntraegeListView,
  listAntraegeListViewByProgramm,
} from '../idb-csv';
import { toAntragListItem } from '../list-view';
import { rebuildAntraegeListView } from '../list-view-migration';
import type { Antrag, Programm } from '../types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

async function freshIdb(): Promise<IDBStore> {
  const s = new IDBStore();
  await s.open();
  return s;
}

function makeProgramm(id: string): Programm {
  return { id, name: `P ${id}`, created_at: '2026-06-03T00:00:00.000Z', smb_handle_key: 'daten-share' };
}

function makeAntrag(az: string, programmId: string): Antrag {
  return {
    aktenzeichen: az,
    programm_id: programmId,
    titel: `Titel ${az}`,
    _field_sources: {},
    _updated_at: '2026-06-03T00:00:00.000Z',
  } as Antrag;
}

const PID = 'default-programm';

describe('rebuildAntraegeListView', () => {
  it('projiziert den vollen ANTRAEGE-Store in die leere List-View', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    // ANTRAEGE gefüllt (wie nach Snapshot-replaceStore), List-View leer.
    await putAntraege(idb, [makeAntrag('16KN1', PID), makeAntrag('16KN2', PID)]);
    expect(await listAntraegeListViewByProgramm(idb, PID)).toHaveLength(0);

    await rebuildAntraegeListView(idb);

    const lv = await listAntraegeListViewByProgramm(idb, PID);
    expect(lv).toHaveLength(2);
    expect(lv.map(i => i.aktenzeichen).sort()).toEqual(['16KN1', '16KN2']);
  });

  it('leert veraltete List-View-Einträge vor dem Reproject', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    await putAntraege(idb, [makeAntrag('A', PID)]); // nur im vollen ANTRAEGE-Store
    // Stale-Eintrag NUR in der List-View (nicht im ANTRAEGE-Store):
    await putAntraegeListView(idb, [toAntragListItem(makeAntrag('STALE', PID))]);
    expect((await listAntraegeListViewByProgramm(idb, PID)).map(i => i.aktenzeichen)).toEqual(['STALE']);

    await rebuildAntraegeListView(idb);

    // STALE entfernt (clear), A aus dem ANTRAEGE-Store projiziert.
    expect((await listAntraegeListViewByProgramm(idb, PID)).map(i => i.aktenzeichen)).toEqual(['A']);
  });
});
