/**
 * „Demo-Quellen in echte umwandeln" muss die Demo-DATEN mitnehmen — und darf
 * keine fremde Quelle überschreiben.
 *
 * Bisher speicherte die Umwandlung nur das neue Schema und löschte das
 * Fixture-Schema: keine `deleteRowHashes`, kein Recompute (anders als
 * `removeFixtureSeeds`). Die Demo-Anträge blieben im Bestand, ihre Row-Hashes
 * verwaisten unter nicht mehr existierenden Schema-Ids — und die Lage war
 * danach SCHLECHTER als vorher: `fixtureSourceWarning` fand keine
 * `fixture-real-*`-Id mehr (Banner weg), `removeFixtureSeeds` griff ins Leere,
 * und der Echt-Import unter der neuen Id räumte nichts ab. Übrig blieb der
 * Alles-oder-nichts-Reset — den der Erfolgs-Banner auch noch empfahl, obwohl
 * er herkunftsblind löscht.
 *
 * Zweiter Defekt an derselben Stelle: die Kollisionsmenge der abgeleiteten Id
 * kam aus den Quellen des AKTIVEN Programms, geschrieben wird aber in den
 * GLOBALEN `csv_schemas`-Store. Eine gleichnamige echte Quelle in einem
 * zweiten Programm wurde dadurch vom Demo-Klon ersetzt — Mapping, Priorität,
 * Stempel weg, `programm_id` gesprungen, die Quelle aus ihrem Programm
 * verschwunden.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

// Der Recompute liest die Quell-CSVs vom Share zurück (`loadCsvSourceFile`).
// Ohne Handle lieferte JEDE Quelle 0 Zeilen — dann könnte kein Schema einen
// Antrag „abdecken", und „ein Antrag mit echter Quelle überlebt" wäre nicht
// prüfbar. Deshalb ein In-Memory-Share.
const shareState = vi.hoisted(() => ({ handle: null as unknown }));
vi.mock('@/core/services/infrastructure/smb-handle', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getDatenShareHandle: async () => shareState.handle,
}));

import { IDBStore } from '@/core/services/storage/idb-store';
import {
  getRowHashesForSchema, getSchema, listAntraegeByProgramm, listSchemasByProgramm,
  putAntraege, putProgramm, putRowHashes, putSchema,
} from '@/core/services/csv/idb-csv';
import { saveCsvSourceFile } from '@/core/services/csv/schemaRegistry';
import { MemDir, asHandle } from '@/core/services/csv/__tests__/mem-fs';
import { convertAllFixtureSources } from '../convert-fixture-source';
import type { Antrag, CsvSchema, Programm } from '@/core/services/csv/types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  shareState.handle = asHandle(new MemDir('share'));
});

const P1 = 'default-programm';
const P2 = 'zim-zwei';

function programm(id: string): Programm {
  return { id, name: `P ${id}`, created_at: '2026-08-13T00:00:00.000Z', smb_handle_key: 'daten-share' } as Programm;
}
function schema(id: string, pid: string, name: string, extra: Partial<CsvSchema> = {}): CsvSchema {
  return {
    id, programm_id: pid, csv_source_name: name, is_master: false, priority: 50,
    join_key: 'aktenzeichen', encoding: 'UTF-8', separator: ';',
    column_mapping: { FKZ: { canonical: 'aktenzeichen', type: 'string', required: true } },
    created_at: '2026-08-13T00:00:00.000Z', ...extra,
  } as CsvSchema;
}
function antrag(az: string, quelle: string): Antrag {
  return {
    aktenzeichen: az, programm_id: P1, titel: `Antrag ${az}`,
    _field_sources: { titel: quelle }, _updated_at: '2026-08-13T00:00:00.000Z',
  } as Antrag;
}
async function freshIdb(): Promise<IDBStore> {
  const s = new IDBStore();
  await s.open();
  await putProgramm(s, programm(P1));
  return s;
}

describe('convertAllFixtureSources räumt die Demo-Daten mit ab', () => {
  it('löscht die Demo-Anträge und ihre Row-Hashes', async () => {
    const idb = await freshIdb();
    await putSchema(idb, schema('fixture-real-anb', P1, 'Antragsbasis', { is_master: true }));
    await putAntraege(idb, [antrag('16KN110636', 'fixture-real-anb'), antrag('16EP260031', 'fixture-real-anb')]);
    await putRowHashes(idb, [
      { csv_schema_id: 'fixture-real-anb', join_value: '16KN110636', row_hash: 'h1' },
      { csv_schema_id: 'fixture-real-anb', join_value: '16EP260031', row_hash: 'h2' },
    ]);

    await convertAllFixtureSources(idb, await listSchemasByProgramm(idb, P1));

    expect(await listAntraegeByProgramm(idb, P1)).toEqual([]);
    expect(await getRowHashesForSchema(idb, 'fixture-real-anb')).toEqual([]);
    expect(await getRowHashesForSchema(idb, 'antragsbasis')).toEqual([]);
  });

  it('behält einen Antrag, den eine ECHTE Quelle mitträgt', async () => {
    const idb = await freshIdb();
    await putSchema(idb, schema('fixture-real-anb', P1, 'Antragsbasis', { is_master: true }));
    await putSchema(idb, schema('echt-bgl', P1, 'Bewilligung', {
      is_master: true,
      column_mapping: {
        FKZ: { canonical: 'aktenzeichen', type: 'string', required: true },
        STATUS: { canonical: 'status', type: 'string' },
      },
    }));
    // Die echte Quelle führt die Zeile wirklich — Abdeckung entscheidet sich an
    // den CSV-Zeilen, nicht an einem Row-Hash.
    await saveCsvSourceFile(idb, 'echt-bgl', new Blob(['FKZ;STATUS\n16KN110636;bewilligt\n']));
    await putAntraege(idb, [antrag('16KN110636', 'fixture-real-anb'), antrag('16DEMO001', 'fixture-real-anb')]);
    await putRowHashes(idb, [
      { csv_schema_id: 'fixture-real-anb', join_value: '16KN110636', row_hash: 'h1' },
      { csv_schema_id: 'fixture-real-anb', join_value: '16DEMO001', row_hash: 'h2' },
      // Die echte Quelle hat diese Zeile beim letzten Import getragen — daran
      // entscheidet sich die Abdeckung (dieselbe Regel wie beim Import).
      { csv_schema_id: 'echt-bgl', join_value: '16KN110636', row_hash: 'h3' },
    ]);

    await convertAllFixtureSources(idb, await listSchemasByProgramm(idb, P1));

    // Der von der echten Quelle getragene Antrag bleibt (ohne Fixture-Anteil),
    // der reine Demo-Antrag verschwindet.
    expect((await listAntraegeByProgramm(idb, P1)).map(a => a.aktenzeichen)).toEqual(['16KN110636']);
    expect((await listAntraegeByProgramm(idb, P1))[0]?.status).toBe('bewilligt');
  });

  it('übernimmt die Konfiguration und setzt den Import-Zustand zurück', async () => {
    const idb = await freshIdb();
    await putSchema(idb, schema('fixture-real-bgl', P1, 'Bewilligungsdetails', {
      priority: 77, file_checksum: 'sha256-demo', last_row_count: 14,
    }));

    const [r] = await convertAllFixtureSources(idb, await listSchemasByProgramm(idb, P1));

    const neu = await getSchema(idb, r!.newId);
    expect(neu?.priority).toBe(77);
    expect(neu?.join_key).toBe('aktenzeichen');
    expect(neu?.file_checksum).toBeUndefined();
    expect(await getSchema(idb, 'fixture-real-bgl')).toBeNull();
  });
});

describe('convertAllFixtureSources überschreibt keine fremde Quelle', () => {
  it('weicht einer gleichnamigen Id in einem ANDEREN Programm aus', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, programm(P2));
    await putSchema(idb, schema('fixture-real-bgl', P1, 'Bewilligungsdetails'));
    // Echte Quelle desselben Namens, aber in Programm 2.
    await putSchema(idb, schema('bewilligungsdetails', P2, 'Bewilligungsdetails', {
      priority: 77, file_checksum: 'sha256-echt', last_row_count: 13977,
    }));

    const [r] = await convertAllFixtureSources(idb, await listSchemasByProgramm(idb, P1));

    expect(r?.newId).not.toBe('bewilligungsdetails');
    const fremd = await getSchema(idb, 'bewilligungsdetails');
    expect(fremd?.programm_id).toBe(P2);
    expect(fremd?.file_checksum).toBe('sha256-echt');
    expect((await listSchemasByProgramm(idb, P2)).map(s => s.id)).toEqual(['bewilligungsdetails']);
  });
});
