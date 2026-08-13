/**
 * Eine korrigierte VB_KURZNAM muss auch im Verbund-Record ankommen.
 *
 * Am bestehenden Verbund galt `if (!next.akronym && newAkronym)` —
 * first-write-wins —, während Titel und Status zwei Zeilen weiter überschrieben
 * werden. Danach standen zwei Namen nebeneinander: Antragsliste, Suche und
 * Akronym-Index zeigten den neuen, Verbund-Detailseite, Gruppenzeile und
 * KI-Kontext den alten. Weil `akronym` antrag-level ist, greift auch die
 * Verbund-Historie nicht — die Abweichung hinterließ keine Spur.
 *
 * Leerer Wert überschreibt weiter NICHT (sonst löschte eine Zeile ohne
 * VB_KURZNAM den Namen des Verbundes).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import { getVerbund, putProgramm, putSchema } from '../idb-csv';
import { recomputeMultipleBatched } from '../merger/batched';
import { recomputeAntrag } from '../merger/single';
import type { SchemaWithRows } from '../merger/loader';
import type { CsvSchema, Programm } from '../types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

const PID = 'default-programm';

const SCHEMA: CsvSchema = {
  id: 'master',
  programm_id: PID,
  csv_source_name: 'Antragsbasis',
  is_master: true,
  priority: 100,
  join_key: 'aktenzeichen',
  column_mapping: {
    FKZ: { canonical: 'aktenzeichen', type: 'string', required: true },
    VB_NUMMER: { canonical: 'verbund_id', type: 'string' },
    VB_KURZNAM: { canonical: 'akronym', type: 'string' },
    VB_TITEL: { canonical: 'verbund_titel', type: 'string' },
  },
  created_at: '2026-01-01T00:00:00.000Z',
};

function lauf(akronym: string, titel = 'VB-Titel'): SchemaWithRows[] {
  return [{
    schema: SCHEMA,
    rows: [{ FKZ: '16KN1', VB_NUMMER: 'V1', VB_KURZNAM: akronym, VB_TITEL: titel }],
  }];
}

async function aufbau(): Promise<IDBStore> {
  const idb = new IDBStore();
  await idb.open();
  const programm: Programm = {
    id: PID, name: 'P', created_at: '2026-01-01T00:00:00.000Z', smb_handle_key: 'daten-share',
  };
  await putProgramm(idb, programm);
  await putSchema(idb, SCHEMA);
  return idb;
}

describe('Merge zieht eine Akronym-Korrektur auf den Verbund-Record nach', () => {
  it('batched: der zweite Export mit neuem VB_KURZNAM gewinnt', async () => {
    const idb = await aufbau();
    await recomputeMultipleBatched(idb, PID, {
      touchedAz: ['16KN1'], removedAz: [], schemasCache: lauf('ALTAKR'),
    });
    expect((await getVerbund(idb, 'V1'))?.akronym).toBe('ALTAKR');

    await recomputeMultipleBatched(idb, PID, {
      touchedAz: ['16KN1'], removedAz: [], schemasCache: lauf('NEUAKR'),
    });

    expect((await getVerbund(idb, 'V1'))?.akronym).toBe('NEUAKR');
  });

  it('single: derselbe Pfad im nicht-batched Recompute', async () => {
    const idb = await aufbau();
    await recomputeAntrag(idb, '16KN1', PID, lauf('ALTAKR'));
    expect((await getVerbund(idb, 'V1'))?.akronym).toBe('ALTAKR');

    await recomputeAntrag(idb, '16KN1', PID, lauf('NEUAKR'));

    expect((await getVerbund(idb, 'V1'))?.akronym).toBe('NEUAKR');
  });

  it('ein leerer VB_KURZNAM löscht den bestehenden Namen NICHT', async () => {
    const idb = await aufbau();
    await recomputeMultipleBatched(idb, PID, {
      touchedAz: ['16KN1'], removedAz: [], schemasCache: lauf('ALTAKR'),
    });

    await recomputeMultipleBatched(idb, PID, {
      touchedAz: ['16KN1'], removedAz: [], schemasCache: lauf(''),
    });

    expect((await getVerbund(idb, 'V1'))?.akronym).toBe('ALTAKR');
  });
});
