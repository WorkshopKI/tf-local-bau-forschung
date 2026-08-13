/**
 * Eine Löschung darf nicht verschwinden, nur weil dasselbe Aktenzeichen im
 * selben Lauf auch berührt wurde.
 *
 * Der Auto-Refresh vereinigt `touched` und `removed` über ALLE Quellen eines
 * Programms und schreibt EIN Delta. Innerhalb einer Quelle sind die Mengen
 * disjunkt, über zwei Quellen nicht: Quelle 1 meldet FKZ X als geändert, der
 * danach importierte Master führt X nicht mehr und löscht ihn lokal. Beim
 * Delta-Write fiel X durch beide Raster — der Filter nahm ihn aus
 * `removedKeys` (weil in `touchedSet`), und `getAntraegeByKeys` lieferte ihn
 * nicht, weil der Record weg war.
 *
 * Der Schreiber zeigte X korrekt als gelöscht, jeder andere Rechner behielt die
 * Karteileiche samt List-View, Fristen und Zählern. Gemessen über den echten
 * `runAutoRefresh`: `DELTA-ARGS = [{"touchedAz":["16KN113536"],"removedAz":["16KN113536"]}]`.
 *
 * Richtig ist, die Mengen nicht gegeneinander zu rechnen, sondern gegen den
 * Bestand: was nach dem Merge nicht mehr da ist, ist gelöscht — egal, wer es
 * vorher angefasst hat.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import { deleteAntrag, listAntraegeByProgramm, putAntraege, putProgramm } from '../idb-csv';
import { writeProgrammSnapshot, writeProgrammSnapshotDelta } from '../snapshot';
import { syncProgrammSnapshot } from '../snapshot-sync';
import { MemDir, asHandle } from './mem-fs';
import type { Antrag, Programm } from '../types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

const PID = 'p1';
function antrag(az: string, titel: string): Antrag {
  return { aktenzeichen: az, programm_id: PID, titel, _field_sources: {}, _updated_at: '2026-08-13T00:00:00.000Z' } as Antrag;
}
async function idbNamed(name: string): Promise<IDBStore> {
  const s = new IDBStore(name);
  await s.open();
  return s;
}
async function azListe(idb: IDBStore): Promise<string[]> {
  return (await listAntraegeByProgramm(idb, PID)).map(a => a.aktenzeichen).sort();
}

/** Schreiber + Konsument auf demselben Stand (A, B) mit Delta-Basis. */
async function aufbau(): Promise<{ writer: IDBStore; consumer: IDBStore; share: MemDir }> {
  const writer = await idbNamed('teamflow-writer');
  await putProgramm(writer, { id: PID, name: 'P1', created_at: '2026-08-13T00:00:00.000Z', smb_handle_key: 'daten-share' } as Programm);
  await putAntraege(writer, [antrag('A', 'A1'), antrag('B', 'B1')]);
  const share = new MemDir('share');
  await writeProgrammSnapshot(writer, asHandle(share), PID, 'tester', { emitDeltaBase: true });

  const consumer = await idbNamed('teamflow-consumer');
  await putProgramm(consumer, { id: PID, name: 'P1', created_at: '2026-08-13T00:00:00.000Z', smb_handle_key: 'daten-share' } as Programm);
  await syncProgrammSnapshot(consumer, asHandle(share), PID, { force: true });
  expect(await azListe(consumer)).toEqual(['A', 'B']);
  return { writer, consumer, share };
}

describe('Gebündeltes Delta: touched UND removed', () => {
  it('meldet die Löschung, obwohl dasselbe Aktenzeichen auch berührt wurde', async () => {
    const { writer, consumer, share } = await aufbau();
    // Quelle 1 hat B berührt, der danach importierte Master hat ihn gelöscht.
    await deleteAntrag(writer, 'B');
    await writeProgrammSnapshotDelta(writer, asHandle(share), PID, 'tester', {
      touchedAz: ['B'], removedAz: ['B'],
    });

    await syncProgrammSnapshot(consumer, asHandle(share), PID, { force: true });

    expect(await azListe(consumer)).toEqual(['A']);
    expect(await azListe(writer)).toEqual(['A']);
  });

  it('ein berührtes, aber noch vorhandenes Aktenzeichen bleibt eine Änderung', async () => {
    const { writer, consumer, share } = await aufbau();
    await putAntraege(writer, [antrag('B', 'B2')]);
    await writeProgrammSnapshotDelta(writer, asHandle(share), PID, 'tester', {
      touchedAz: ['B'], removedAz: [],
    });

    await syncProgrammSnapshot(consumer, asHandle(share), PID, { force: true });

    expect(await azListe(consumer)).toEqual(['A', 'B']);
    expect((await listAntraegeByProgramm(consumer, PID)).find(a => a.aktenzeichen === 'B')?.titel)
      .toBe('B2');
  });

  it('ein nur berührtes, aber lokal verschwundenes Aktenzeichen gilt als gelöscht', async () => {
    // Ohne `removedAz` überhaupt — der Bestand ist die Wahrheit, nicht die Meldung.
    const { writer, consumer, share } = await aufbau();
    await deleteAntrag(writer, 'B');
    await writeProgrammSnapshotDelta(writer, asHandle(share), PID, 'tester', {
      touchedAz: ['B'], removedAz: [],
    });

    await syncProgrammSnapshot(consumer, asHandle(share), PID, { force: true });

    expect(await azListe(consumer)).toEqual(['A']);
  });
});
