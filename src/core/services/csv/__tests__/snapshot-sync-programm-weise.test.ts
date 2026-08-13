/**
 * Ein Snapshot gehört EINEM Programm — der Sync darf auch nur dessen Records
 * anfassen.
 *
 * `replaceStore` rief `clear()` auf den GANZEN Objekt-Store, während
 * `programme.jsonl` / `csv_schemas.jsonl` eines Snapshots per Konstruktion nur
 * die Records eines Programms enthalten. Auf einem Rechner mit zwei Programmen
 * (Kurator-Seite „Programme", oder dev zusätzlich `dev-programm`) löschte der
 * Sync von Programm A also die CSV-Schemas von Programm B — und weil
 * `listProgramme` B danach nicht mehr lieferte, wurde B nie wieder gesynct.
 *
 * Der Zustand heilte auch am Folgetag nicht: das ist kein Aussetzer, sondern
 * eine Einbahnstraße.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import {
  listAntraegeByProgramm, listProgramme, listSchemasByProgramm,
  putAntraege, putProgramm, putSchema,
} from '../idb-csv';
import { writeProgrammSnapshot } from '../snapshot';
import { syncProgrammSnapshot } from '../snapshot-sync';
import { MemDir, asHandle } from './mem-fs';
import type { Antrag, CsvSchema, Programm } from '../types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

const P1 = 'default-programm';
const P2 = 'zim-zwei';

function programm(id: string): Programm {
  return { id, name: `P ${id}`, created_at: '2026-08-13T00:00:00.000Z', smb_handle_key: 'daten-share' } as Programm;
}
function antrag(az: string, pid: string): Antrag {
  return { aktenzeichen: az, programm_id: pid, titel: az, _field_sources: {}, _updated_at: '2026-08-13T00:00:00.000Z' } as Antrag;
}
function schema(id: string, pid: string): CsvSchema {
  return {
    id, programm_id: pid, csv_source_name: id, is_master: true, priority: 100,
    join_key: 'aktenzeichen', column_mapping: {}, encoding: 'UTF-8', separator: ';',
    created_at: '2026-08-13T00:00:00.000Z',
  } as CsvSchema;
}
async function idbNamed(name: string): Promise<IDBStore> {
  const s = new IDBStore(name);
  await s.open();
  return s;
}

describe('Snapshot-Sync fasst nur das eigene Programm an', () => {
  it('lässt Anträge, Schemas und den Programm-Record des ZWEITEN Programms stehen', async () => {
    // Schreiber kennt nur P1 und publiziert dessen Snapshot.
    const writer = await idbNamed('teamflow-writer');
    await putProgramm(writer, programm(P1));
    await putSchema(writer, schema('master-p1', P1));
    await putAntraege(writer, [antrag('16EP0001', P1), antrag('16EP0002', P1)]);
    const share = new MemDir('share');
    await writeProgrammSnapshot(writer, asHandle(share), P1, 'tester');

    // Konsument führt BEIDE Programme.
    const consumer = await idbNamed('teamflow-consumer');
    await putProgramm(consumer, programm(P1));
    await putProgramm(consumer, programm(P2));
    await putSchema(consumer, schema('master-p1', P1));
    await putSchema(consumer, schema('master-p2', P2));
    await putAntraege(consumer, [antrag('16EP0001', P1), antrag('16ZZ9001', P2), antrag('16ZZ9002', P2)]);

    const r = await syncProgrammSnapshot(consumer, asHandle(share), P1);

    expect(r.synced).toBe(true);
    // P1 kam vom Share …
    expect((await listAntraegeByProgramm(consumer, P1)).map(a => a.aktenzeichen).sort())
      .toEqual(['16EP0001', '16EP0002']);
    // … P2 blieb unangetastet.
    expect((await listAntraegeByProgramm(consumer, P2)).map(a => a.aktenzeichen).sort())
      .toEqual(['16ZZ9001', '16ZZ9002']);
    expect((await listSchemasByProgramm(consumer, P2)).map(s => s.id)).toEqual(['master-p2']);
    expect((await listProgramme(consumer)).map(p => p.id).sort()).toEqual([P1, P2].sort());
  });

  it('entfernt einen im Snapshot fehlenden Record des EIGENEN Programms', async () => {
    // Sonst hätte die Schonung des Nachbarn den Preis, dass Gelöschtes bleibt.
    const writer = await idbNamed('teamflow-writer');
    await putProgramm(writer, programm(P1));
    await putSchema(writer, schema('master-p1', P1));
    await putAntraege(writer, [antrag('16EP0001', P1)]);
    const share = new MemDir('share');
    await writeProgrammSnapshot(writer, asHandle(share), P1, 'tester');

    const consumer = await idbNamed('teamflow-consumer');
    await putProgramm(consumer, programm(P1));
    await putSchema(consumer, schema('master-p1', P1));
    await putSchema(consumer, schema('alt-p1', P1)); // im Snapshot nicht mehr enthalten
    await putAntraege(consumer, [antrag('16EP0001', P1), antrag('16EP0099', P1)]);

    await syncProgrammSnapshot(consumer, asHandle(share), P1);

    expect((await listSchemasByProgramm(consumer, P1)).map(s => s.id)).toEqual(['master-p1']);
    expect((await listAntraegeByProgramm(consumer, P1)).map(a => a.aktenzeichen))
      .toEqual(['16EP0001']);
  });
});
