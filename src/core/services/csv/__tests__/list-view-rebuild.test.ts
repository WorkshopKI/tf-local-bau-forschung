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
import {
  rebuildAntraegeListView,
  ensureListViewProjection,
  LIST_VIEW_PROJECTION_VERSION,
} from '../list-view-migration';
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

const VERSION_KEY = 'list-view-projection-version';

describe('ensureListViewProjection — Projektion-Versions-Marker (v2.63)', () => {
  it('Marker fehlt (Bestandsinstallation) → Voll-Rebuild inkl. neuer v2-Felder, Marker danach gesetzt', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    const full = { ...makeAntrag('16KN1', PID), t_hint: 'Hinweis', tib_mail: 'x@tib.de', d_xtec: '2026-01-01' } as Antrag;
    await putAntraege(idb, [full]);
    // v1-Projektion simulieren: List-View-Eintrag OHNE die neuen Felder,
    // Count vollständig → der alte Count-Check hätte nichts getan.
    const v1Item = toAntragListItem(full);
    delete (v1Item as unknown as Record<string, unknown>).t_hint;
    delete (v1Item as unknown as Record<string, unknown>).tib_mail;
    delete (v1Item as unknown as Record<string, unknown>).d_xtec;
    await putAntraegeListView(idb, [v1Item]);

    await ensureListViewProjection(idb);

    const lv = await listAntraegeListViewByProgramm(idb, PID);
    expect(lv).toHaveLength(1);
    expect(lv[0]?.t_hint).toBe('Hinweis');
    expect(lv[0]?.tib_mail).toBe('x@tib.de');
    expect(lv[0]?.d_xtec).toBe('2026-01-01');
    expect(await idb.get<number>(VERSION_KEY)).toBe(LIST_VIEW_PROJECTION_VERSION);
  });

  it('Marker aktuell + Counts vollständig → No-op (kein Rebuild, Stale-Eintrag bleibt)', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    await putAntraege(idb, [makeAntrag('A', PID)]);
    await idb.set(VERSION_KEY, LIST_VIEW_PROJECTION_VERSION);
    // Indikator für "kein Rebuild": ein Stale-only-List-View-Eintrag würde
    // bei einem Rebuild (clear) verschwinden, beim No-op bleibt er.
    await putAntraegeListView(idb, [toAntragListItem(makeAntrag('A', PID)), toAntragListItem(makeAntrag('STALE', PID))]);

    await ensureListViewProjection(idb);

    const az = (await listAntraegeListViewByProgramm(idb, PID)).map(i => i.aktenzeichen).sort();
    expect(az).toEqual(['A', 'STALE']);
  });

  it('Marker aktuell, List-View unvollständig → Backfill ohne Marker-Neuschreiben', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    await putAntraege(idb, [makeAntrag('A', PID), makeAntrag('B', PID)]);
    await idb.set(VERSION_KEY, LIST_VIEW_PROJECTION_VERSION);
    await putAntraegeListView(idb, [toAntragListItem(makeAntrag('A', PID))]); // B fehlt

    await ensureListViewProjection(idb);

    const az = (await listAntraegeListViewByProgramm(idb, PID)).map(i => i.aktenzeichen).sort();
    expect(az).toEqual(['A', 'B']);
  });
});
