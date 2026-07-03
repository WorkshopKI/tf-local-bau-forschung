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
  putSchema,
  listAntraegeListViewByProgramm,
} from '../idb-csv';
import { toAntragListItem } from '../list-view';
import {
  rebuildAntraegeListView,
  ensureListViewProjection,
  LIST_VIEW_PROJECTION_VERSION,
} from '../list-view-migration';
import type { Antrag, ColumnMapping, CsvSchema, Programm } from '../types';

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

const SIG_KEY = 'list-view-projection-schema-sig';

function makeSchema(cm: ColumnMapping): CsvSchema {
  return {
    id: 's-master',
    programm_id: PID,
    csv_source_name: 'src',
    is_master: true,
    join_key: 'aktenzeichen',
    priority: 0,
    column_mapping: cm,
    created_at: '2026-01-01T00:00:00Z',
  };
}

describe('ensureListViewProjection — Schema-Signatur-Guard (v2.158.2)', () => {
  it('geänderte FB/PC-Mapping-Signatur bei aktuellem Marker → Voll-Rebuild füllt die Status-Label', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    // Schema mappt D_XPC+ (steht in FB- UND PreCheck-Codeliste) auf ein Datumsfeld.
    await putSchema(idb, makeSchema({
      'D_XPC+': { custom: 'precheck_positiv_verbund', type: 'date', label: 'PreCheck positiv - Verbund' },
    }));
    const antrag = { ...makeAntrag('16KN1', PID), precheck_positiv_verbund: '2025-05-21' } as Antrag;
    await putAntraege(idb, [antrag]);
    // „Vor dem Mapping projiziert": Slim-Eintrag OHNE Status-Label (kein gruppen-Arg).
    await putAntraegeListView(idb, [toAntragListItem(antrag)]);
    expect((await listAntraegeListViewByProgramm(idb, PID))[0]?.precheck_status_label ?? '').toBe('');
    // Marker ist aktuell (KEIN Code-Versions-Trigger), aber die gespeicherte
    // Signatur stammt aus der Zeit VOR dem Mapping → muss den Rebuild auslösen.
    await idb.set(VERSION_KEY, LIST_VIEW_PROJECTION_VERSION);
    await idb.set(SIG_KEY, 'sig-before-mapping');

    await ensureListViewProjection(idb);

    const lv = await listAntraegeListViewByProgramm(idb, PID);
    expect(lv[0]?.precheck_status_label).toBe('PreCheck positiv - Verbund');
    expect(lv[0]?.precheck_status_datum).toBe('2025-05-21');
    // Signatur wurde auf den aktuellen Stand nachgezogen (nicht mehr der Sentinel).
    expect(await idb.get<string>(SIG_KEY)).not.toBe('sig-before-mapping');
  });

  it('Signatur fehlt (Bestand vor v2.158.2) → KEIN Rebuild, Signatur wird nur nachgetragen', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, makeProgramm(PID));
    await putSchema(idb, makeSchema({
      'D_XPC+': { custom: 'precheck_positiv_verbund', type: 'date', label: 'PreCheck positiv - Verbund' },
    }));
    await putAntraege(idb, [makeAntrag('A', PID)]);
    await idb.set(VERSION_KEY, LIST_VIEW_PROJECTION_VERSION);
    // Stale-only-Eintrag: bei einem (unerwünschten) Rebuild verschwände er.
    await putAntraegeListView(idb, [toAntragListItem(makeAntrag('A', PID)), toAntragListItem(makeAntrag('STALE', PID))]);

    await ensureListViewProjection(idb);

    const az = (await listAntraegeListViewByProgramm(idb, PID)).map(i => i.aktenzeichen).sort();
    expect(az).toEqual(['A', 'STALE']); // kein Rebuild
    expect(await idb.get<string>(SIG_KEY)).toBeTruthy(); // aber Signatur jetzt hinterlegt
  });

  // Lücke (Konsolidierung 2026-07): die bestehenden Sig-Tests laufen auf EINEM
  // Programm. Die Signatur muss aber über ALLE Programme spannen — sonst bliebe eine
  // Mapping-Änderung im 2., 3., … Programm unentdeckt (der eigentliche Klasse-9-Modus).
  it('Signatur spannt ALLE Programme: nachträgliches FB/PC-Mapping im ZWEITEN Programm → Rebuild', async () => {
    const idb = await freshIdb();
    const PID2 = 'programm-2';
    await putProgramm(idb, makeProgramm(PID));
    await putProgramm(idb, makeProgramm(PID2));
    // P1: unauffälliges Schema (kein Status-Datum-Mapping).
    await putSchema(idb, { ...makeSchema({ TITEL: { canonical: 'titel', type: 'string' } }), id: 's-p1', programm_id: PID });
    // P2: Schema OHNE PreCheck-Mapping; Antrag trägt den Rohwert bereits.
    await putSchema(idb, { ...makeSchema({ TITEL: { canonical: 'titel', type: 'string' } }), id: 's-p2', programm_id: PID2 });
    await putAntraege(idb, [makeAntrag('16KN1', PID)]);
    const p2Antrag = { ...makeAntrag('16KN2', PID2), precheck_positiv_verbund: '2025-05-21' } as Antrag;
    await putAntraege(idb, [p2Antrag]);

    // Erst-Projektion: Marker + Signatur (P1+P2 OHNE PreCheck-Mapping) werden hinterlegt.
    await ensureListViewProjection(idb);
    expect((await listAntraegeListViewByProgramm(idb, PID2))[0]?.precheck_status_label ?? '').toBe('');
    const sig0 = await idb.get<string>(SIG_KEY);

    // Jetzt NUR im zweiten Programm das PreCheck-Datumsfeld mappen (Marker bleibt v5).
    await putSchema(idb, {
      ...makeSchema({ 'D_XPC+': { custom: 'precheck_positiv_verbund', type: 'date', label: 'PreCheck positiv - Verbund' } }),
      id: 's-p2',
      programm_id: PID2,
    });

    await ensureListViewProjection(idb);

    // Die Signatur hat sich durch die P2-Mapping-Änderung verändert → Voll-Rebuild →
    // das Label im zweiten Programm ist gefüllt. Bliebe P2 aus der Signatur, wäre es leer.
    expect(await idb.get<string>(SIG_KEY)).not.toBe(sig0);
    const lv2 = await listAntraegeListViewByProgramm(idb, PID2);
    expect(lv2[0]?.precheck_status_label).toBe('PreCheck positiv - Verbund');
    expect(lv2[0]?.precheck_status_datum).toBe('2025-05-21');
  });
});
