/**
 * Die Rohwerte der selbst angelegten Spalten (`frei_roh`) müssen den Merge
 * überleben — dieselbe Falle wie bei `kat_status`, nur eine Projektionsstufe
 * später.
 *
 * `putAntraegeListView` ist immer ein VOLLERSATZ. Reicht ein Schreibpfad die
 * freien Felder nicht durch, verliert genau der frisch importierte oder
 * geänderte Antrag seinen Beutel — und die Spalte wird lückenhaft, nicht falsch.
 * Genau diese Sorte Defekt fällt im Betrieb nicht auf, weil unberührte Anträge
 * ihre Werte behalten. Deshalb prüft dieser Test beide Merge-Pfade einzeln.
 *
 * Der volle Antrag-Record trägt den Rohwert die ganze Zeit; verloren ginge nur
 * die Projektion, aus der die Tabelle liest.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import {
  getAntrag, listAntraegeListViewByProgramm, putProgramm, putSchema,
} from '../idb-csv';
import { recomputeMultipleBatched } from '../merger/batched';
import { recomputeAntrag } from '../merger/single';
import type { SchemaWithRows } from '../merger/loader';
import { EIGENE_SPALTEN_IDB_KEY } from '@/core/spalten/store';
import { spaltenId } from '@/core/spalten/typen';
import type { EigeneSpalte } from '@/core/spalten/typen';
import type { CsvSchema, Programm } from '../types';

// Der Flag entscheidet, ob überhaupt projiziert wird — hier an.
vi.mock('@/config/feature-flags', async importActual => {
  const actual = await importActual<typeof import('@/config/feature-flags')>();
  return { ...actual, isEigeneSpaltenEnabled: () => true };
});

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
    D_ZZA: { type: 'date' },
  },
  created_at: '2026-01-01T00:00:00.000Z',
};

/** Eine persönliche Feld-Spalte auf der gemappten Datumsspalte. */
const SPALTE: EigeneSpalte = {
  id: spaltenId('ich', 'zza'), art: 'feld', label: 'ZZA', feldId: 'D_ZZA', typ: 'datum',
};

async function aufbau(spalten: EigeneSpalte[] = [SPALTE]): Promise<{
  idb: IDBStore; schemasCache: SchemaWithRows[];
}> {
  const idb = new IDBStore();
  await idb.open();
  const programm: Programm = {
    id: PID, name: 'P', created_at: '2026-01-01T00:00:00.000Z', smb_handle_key: 'daten-share',
  };
  await putProgramm(idb, programm);
  await putSchema(idb, SCHEMA);
  if (spalten.length > 0) await idb.set(EIGENE_SPALTEN_IDB_KEY, spalten);
  return {
    idb,
    schemasCache: [{ schema: SCHEMA, rows: [{ FKZ: '16KN1', D_ZZA: '05.03.2026' }] }],
  };
}

async function freiRoh(idb: IDBStore): Promise<unknown> {
  const items = await listAntraegeListViewByProgramm(idb, PID);
  return items[0]?.frei_roh;
}

describe('Merge schreibt die Slim-Projektion MIT den freien Rohwerten', () => {
  it('batched: frei_roh steht nach dem Import in der List-View', async () => {
    const { idb, schemasCache } = await aufbau();

    await recomputeMultipleBatched(idb, PID, { touchedAz: ['16KN1'], removedAz: [], schemasCache });

    expect(await freiRoh(idb)).toEqual({ D_ZZA: '2026-03-05' });
  });

  it('single: frei_roh steht nach dem Recompute in der List-View', async () => {
    const { idb, schemasCache } = await aufbau();

    await recomputeAntrag(idb, '16KN1', PID, schemasCache);

    expect(await freiRoh(idb)).toEqual({ D_ZZA: '2026-03-05' });
  });

  it('der volle Antrag-Record traegt den Rohwert unabhaengig davon', async () => {
    const { idb, schemasCache } = await aufbau();

    await recomputeMultipleBatched(idb, PID, { touchedAz: ['16KN1'], removedAz: [], schemasCache });

    expect((await getAntrag(idb, '16KN1'))?.d_zza).toBe('2026-03-05');
  });

  it('ohne eigene Spalten bleibt frei_roh weg (keine leeren Objekte)', async () => {
    const { idb, schemasCache } = await aufbau([]);

    await recomputeMultipleBatched(idb, PID, { touchedAz: ['16KN1'], removedAz: [], schemasCache });

    expect(await freiRoh(idb)).toBeUndefined();
  });

  it('eine Spalte auf einem NICHT gemappten Feld laesst den Beutel leer', async () => {
    // Die Spalte verschwindet nicht — sie bleibt leer, und ihr Tooltip sagt warum.
    const { idb, schemasCache } = await aufbau([
      { ...SPALTE, id: spaltenId('ich', 'fremd'), feldId: 'GIBT_ES_NICHT' },
    ]);

    await recomputeMultipleBatched(idb, PID, { touchedAz: ['16KN1'], removedAz: [], schemasCache });

    expect(await freiRoh(idb)).toBeUndefined();
  });
});
