/**
 * „Quelle löschen" muss aufräumen, statt einen wandernden Riss zu hinterlassen.
 *
 * `removeSchema` löschte nur den IDB-Record: keine Row-Hashes, kein Recompute
 * (der Programm-Lösch-Pfad macht beides). Direkt danach stimmte die Zusage
 * „Importierte Anträge bleiben" — beim nächsten regulären Import einer ANDEREN
 * Quelle baute `recomputeAntragIntoBatch` aber jeden BERÜHRTEN Antrag komplett
 * aus den verbliebenen Schemas neu auf und strich die Felder der gelöschten
 * Quelle. Bei genau diesen Anträgen, bei den unberührten nicht: dasselbe Feld
 * war danach bei einem Teil gefüllt und beim Rest leer, und der Riss wanderte
 * mit jedem Nacht-Export weiter — publiziert wurde er mit.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '@/core/services/storage/idb-store';
import {
  getRowHashesForSchema, getSchema, listAntraegeByProgramm,
  putAntraege, putProgramm, putRowHashes, putSchema,
} from '@/core/services/csv/idb-csv';
import { entferneQuelle } from '../quelle-entfernen';
import type { Antrag, CsvSchema, Programm } from '@/core/services/csv/types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

const PID = 'default-programm';

function schema(id: string): CsvSchema {
  return {
    id, programm_id: PID, csv_source_name: id, is_master: false, priority: 50,
    join_key: 'aktenzeichen', encoding: 'UTF-8', separator: ';',
    column_mapping: { FKZ: { canonical: 'aktenzeichen', type: 'string', required: true } },
    created_at: '2026-08-13T00:00:00.000Z',
  } as CsvSchema;
}
function antrag(az: string): Antrag {
  return {
    aktenzeichen: az, programm_id: PID, titel: `Antrag ${az}`,
    _field_sources: {}, _updated_at: '2026-08-13T00:00:00.000Z',
  } as Antrag;
}
async function freshIdb(): Promise<IDBStore> {
  const s = new IDBStore();
  await s.open();
  await putProgramm(s, {
    id: PID, name: 'P', created_at: '2026-08-13T00:00:00.000Z', smb_handle_key: 'daten-share',
  } as Programm);
  return s;
}

describe('entferneQuelle', () => {
  it('löscht die Row-Hashes der Quelle mit', async () => {
    const idb = await freshIdb();
    await putSchema(idb, schema('bgl'));
    await putRowHashes(idb, [{ csv_schema_id: 'bgl', join_value: 'AZ1', row_hash: 'h1' }]);

    await entferneQuelle(idb, schema('bgl'));

    expect(await getSchema(idb, 'bgl')).toBeNull();
    expect(await getRowHashesForSchema(idb, 'bgl')).toEqual([]);
  });

  it('entfernt sofort die Anträge, die nur diese Quelle trug', async () => {
    // Sonst blieben sie als Waisen stehen und verschwänden erst irgendwann,
    // wenn ein anderer Import sie zufällig berührt.
    const idb = await freshIdb();
    await putSchema(idb, schema('bgl'));
    await putAntraege(idb, [antrag('AZ1'), antrag('AZ2')]);
    await putRowHashes(idb, [
      { csv_schema_id: 'bgl', join_value: 'AZ1', row_hash: 'h1' },
      { csv_schema_id: 'bgl', join_value: 'AZ2', row_hash: 'h2' },
    ]);

    const r = await entferneQuelle(idb, schema('bgl'));

    expect(r.geloescht).toBe(2);
    expect(await listAntraegeByProgramm(idb, PID)).toEqual([]);
  });

  it('behält Anträge, die eine andere Quelle weiterträgt', async () => {
    const idb = await freshIdb();
    await putSchema(idb, schema('bgl'));
    await putSchema(idb, schema('master'));
    await putAntraege(idb, [antrag('AZ1'), antrag('AZ2')]);
    await putRowHashes(idb, [
      { csv_schema_id: 'bgl', join_value: 'AZ1', row_hash: 'h1' },
      { csv_schema_id: 'bgl', join_value: 'AZ2', row_hash: 'h2' },
      { csv_schema_id: 'master', join_value: 'AZ1', row_hash: 'h3' },
    ]);

    const r = await entferneQuelle(idb, schema('bgl'));

    expect(r.neuGebaut).toBe(1);
    expect(r.geloescht).toBe(1);
    expect((await listAntraegeByProgramm(idb, PID)).map(a => a.aktenzeichen)).toEqual(['AZ1']);
  });

  it('ohne Row-Hashes ist es ein reines Schema-Löschen', async () => {
    const idb = await freshIdb();
    await putSchema(idb, schema('bgl'));
    await putAntraege(idb, [antrag('AZ1')]);

    const r = await entferneQuelle(idb, schema('bgl'));

    expect(r).toEqual({ geloescht: 0, neuGebaut: 0 });
    expect((await listAntraegeByProgramm(idb, PID)).map(a => a.aktenzeichen)).toEqual(['AZ1']);
  });
});
