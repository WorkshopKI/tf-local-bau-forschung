/**
 * Die Ordner-Spalten (`kat_status`) müssen den Merge überleben.
 *
 * `toAntragListItem` bekommt seit Projektions-v6 einen dritten Parameter, aus
 * dem die kuratierten Ordner-Spalten entstehen. Voll-Rebuild und beide
 * Snapshot-Sync-Pfade reichen ihn durch, die beiden MERGE-Pfade nicht — und
 * weil `putAntraegeListView` ein Vollersatz ist, verlor jeder frisch
 * importierte/geänderte Antrag seine Ordner-Spalten wieder. Sichtbar wurde das
 * als lückenhafte Spalte (unberührte Anträge behielten ihre Werte), nicht als
 * falsche — deshalb fiel es nie auf.
 *
 * Der volle Antrag-Record trägt den Rohwert die ganze Zeit; verloren ging nur
 * die Projektion, aus der Tabelle, Home und Suche lesen.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import {
  getAntrag,
  listAntraegeListViewByProgramm,
  putProgramm,
  putSchema,
} from '../idb-csv';
import { recomputeMultipleBatched } from '../merger/batched';
import { recomputeAntrag } from '../merger/single';
import type { SchemaWithRows } from '../merger/loader';
import { speichereVersion, setzeAktiv } from '@/core/status/katalog-store';
import type { MappingVersion } from '@/core/status/typen';
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
    D_ZZA: { type: 'date' },
  },
  created_at: '2026-01-01T00:00:00.000Z',
};

/** Ein Ordner „Testordner" mit genau einem Datumsfeld auf D_ZZA. */
const FASSUNG: MappingVersion = {
  version: 1,
  autor: null,
  zeitstempel: '2026-01-01T00:00:00.000Z',
  werte: [],
  kategorien: [
    { id: 'tv.zz', elternId: null, label: 'Testordner', ebene: 'tv', reihenfolge: 10, aktiv: true },
  ],
  felder: [
    {
      feldId: 'D_ZZA', code: 'ZZA', label: 'Schritt A', typ: 'datum', ebene: 'tv',
      kategorieId: 'tv.zz', prominenzDefault: 'normal', aktiv: true, unkuratiert: false,
    },
  ],
};

async function aufbau(): Promise<{ idb: IDBStore; schemasCache: SchemaWithRows[] }> {
  const idb = new IDBStore();
  await idb.open();
  const programm: Programm = {
    id: PID, name: 'P', created_at: '2026-01-01T00:00:00.000Z', smb_handle_key: 'daten-share',
  };
  await putProgramm(idb, programm);
  await putSchema(idb, SCHEMA);
  await speichereVersion(idb, FASSUNG);
  await setzeAktiv(idb, FASSUNG.version);
  return {
    idb,
    schemasCache: [{ schema: SCHEMA, rows: [{ FKZ: '16KN1', D_ZZA: '05.03.2026' }] }],
  };
}

async function katStatus(idb: IDBStore): Promise<unknown> {
  const items = await listAntraegeListViewByProgramm(idb, PID);
  return items[0]?.kat_status;
}

describe('Merge schreibt die Slim-Projektion MIT Ordner-Spalten', () => {
  it('batched: kat_status steht nach dem Import in der List-View', async () => {
    const { idb, schemasCache } = await aufbau();

    await recomputeMultipleBatched(idb, PID, { touchedAz: ['16KN1'], removedAz: [], schemasCache });

    expect(await katStatus(idb)).toEqual({ 'tv.zz': { l: 'Schritt A', d: '2026-03-05' } });
  });

  it('single: kat_status steht nach dem Recompute in der List-View', async () => {
    const { idb, schemasCache } = await aufbau();

    await recomputeAntrag(idb, '16KN1', PID, schemasCache);

    expect(await katStatus(idb)).toEqual({ 'tv.zz': { l: 'Schritt A', d: '2026-03-05' } });
  });

  it('der volle Antrag-Record trägt den Rohwert unabhängig davon', async () => {
    const { idb, schemasCache } = await aufbau();

    await recomputeMultipleBatched(idb, PID, { touchedAz: ['16KN1'], removedAz: [], schemasCache });

    expect((await getAntrag(idb, '16KN1'))?.d_zza).toBe('2026-03-05');
  });

  it('ohne kuratierten Ordner bleibt kat_status weg (keine leeren Objekte)', async () => {
    const { idb, schemasCache } = await aufbau();
    // Ordner stillgelegt → keine auflösbare Spalte mehr.
    await speichereVersion(idb, {
      ...FASSUNG,
      version: 2,
      kategorien: [{ ...FASSUNG.kategorien![0]!, aktiv: false }],
    });
    await setzeAktiv(idb, 2);

    await recomputeMultipleBatched(idb, PID, { touchedAz: ['16KN1'], removedAz: [], schemasCache });

    expect(await katStatus(idb)).toBeUndefined();
  });
});
