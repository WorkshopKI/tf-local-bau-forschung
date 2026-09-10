/**
 * `seedSystemFilters` räumt ab, was der Seed nicht mehr führt (v6.52).
 *
 * System-Filter entstehen nur aus dem Seed — eine Definition, deren Id dort
 * fehlt, ist ausgemustert (`system-frist-datum`). Bis v6.52 legte der Seed nur
 * an; eine gestrichene Definition stand danach für immer in der Sidebar.
 * Kurator-Filter (`'admin'`) auf demselben Feld bleiben stehen.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../../storage/idb-store';
import { seedSystemFilters } from '../filterRegistry';
import { putFilter, listFiltersByProgramm } from '../idb-filter';
import { SYSTEM_FILTERS_SEED } from '../constants';
import type { FilterDefinition } from '../types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

async function freshIdb(): Promise<IDBStore> {
  const s = new IDBStore();
  await s.open();
  return s;
}

function def(id: string, scope: FilterDefinition['scope'], feld: string): FilterDefinition {
  return {
    id,
    programm_id: 'p',
    scope,
    name: id,
    feld,
    typ: 'date_range',
    config: {},
    anzeige_reihenfolge: 60,
    versteckt: false,
    erstellt_am: '2026-01-01',
    aktualisiert_am: '2026-01-01',
  };
}

describe('seedSystemFilters — der Seed räumt ab', () => {
  it('löscht eine System-Definition, die der Seed nicht mehr führt', async () => {
    const idb = await freshIdb();
    await putFilter(idb, def('system-frist-datum', 'system', 'frist_datum'));
    await seedSystemFilters(idb, 'p');
    const ids = (await listFiltersByProgramm(idb, 'p')).map(f => f.id).sort();
    expect(ids).toEqual(SYSTEM_FILTERS_SEED.map(s => s.id).sort());
  });

  it('lässt Kurator-Filter stehen, auch auf demselben Feld', async () => {
    const idb = await freshIdb();
    await putFilter(idb, def('kurator-frist', 'admin', 'frist_datum'));
    await seedSystemFilters(idb, 'p');
    const ids = (await listFiltersByProgramm(idb, 'p')).map(f => f.id);
    expect(ids).toContain('kurator-frist');
  });

  it('der Seed führt keinen Filter auf frist_datum mehr', () => {
    expect(SYSTEM_FILTERS_SEED.some(s => s.feld === 'frist_datum')).toBe(false);
  });
});
