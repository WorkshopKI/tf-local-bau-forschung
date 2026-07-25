import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '@/core/services/storage/idb-store';
import {
  baueSignatur, ladeProjektion, projektionsKey, speichereProjektion,
} from '@/core/meilensteine/projektion';
import { baueSeedPlan } from '@/core/meilensteine/seed';
import type { MeilensteinProjektion } from '@/core/meilensteine/projektion';
import type { CsvSchema } from '@/core/services/csv/types';

const HEUTE = '2026-08-01T09:30:00.000Z';

function schema(p: Partial<CsvSchema> = {}): CsvSchema {
  return {
    id: 'S1', programm_id: 'P1', csv_source_name: 'test.csv', is_master: true,
    join_key: 'aktenzeichen', priority: 1, column_mapping: { A: { canonical: 'status' } },
    created_at: '2026-01-01T00:00:00.000Z', file_checksum: 'abc',
    ...p,
  };
}

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe('baueSignatur', () => {
  const plan = baueSeedPlan();

  it('ist stabil bei gleichem Plan, Schema und Tag', () => {
    expect(baueSignatur(plan, [schema()], HEUTE))
      .toBe(baueSignatur(plan, [schema()], '2026-08-01T23:59:00.000Z'));
  });

  it('ändert sich mit der Plan-Fassung', () => {
    expect(baueSignatur({ ...plan, version: 2 }, [schema()], HEUTE))
      .not.toBe(baueSignatur(plan, [schema()], HEUTE));
  });

  it('ändert sich mit dem CSV-Stand (file_checksum)', () => {
    expect(baueSignatur(plan, [schema({ file_checksum: 'xyz' })], HEUTE))
      .not.toBe(baueSignatur(plan, [schema()], HEUTE));
  });

  it('ändert sich mit dem Spalten-Mapping', () => {
    const nachgezogen = schema({ column_mapping: { A: { canonical: 'status' }, B: { custom: 'qs' } } });
    expect(baueSignatur(plan, [nachgezogen], HEUTE)).not.toBe(baueSignatur(plan, [schema()], HEUTE));
  });

  it('ändert sich mit dem Kalendertag — die Bewertung ist zeitabhängig', () => {
    expect(baueSignatur(plan, [schema()], '2026-08-02T00:00:00.000Z'))
      .not.toBe(baueSignatur(plan, [schema()], HEUTE));
  });

  it('ist unabhängig von der Schema-Reihenfolge', () => {
    const a = schema({ id: 'A' });
    const b = schema({ id: 'B' });
    expect(baueSignatur(plan, [a, b], HEUTE)).toBe(baueSignatur(plan, [b, a], HEUTE));
  });
});

describe('Projektions-Speicher', () => {
  const projektion = (signatur: string): MeilensteinProjektion => ({
    signatur, erstelltAm: HEUTE, programmId: 'P1', verbuende: [],
  });

  it('liefert die Projektion bei passender Signatur zurück', async () => {
    const idb = new IDBStore();
    await idb.open();
    await speichereProjektion(idb, projektion('sig-1'));
    expect(await ladeProjektion(idb, 'P1', 'sig-1')).not.toBeNull();
  });

  it('verwirft sie bei abweichender Signatur, statt einen stale Stand auszuliefern', async () => {
    const idb = new IDBStore();
    await idb.open();
    await speichereProjektion(idb, projektion('sig-1'));
    expect(await ladeProjektion(idb, 'P1', 'sig-2')).toBeNull();
  });

  it('liefert null ohne gespeicherten Stand', async () => {
    const idb = new IDBStore();
    await idb.open();
    expect(await ladeProjektion(idb, 'P1', 'sig-1')).toBeNull();
  });

  it('hält Programme getrennt', () => {
    expect(projektionsKey('P1')).not.toBe(projektionsKey('P2'));
    expect(projektionsKey('P1')).toBe('meilenstein-stand:P1');
  });
});
