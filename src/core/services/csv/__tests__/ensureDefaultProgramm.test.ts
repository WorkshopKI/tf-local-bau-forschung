/**
 * `ensureDefaultProgramm` legt den Default-Programm-Record an und migriert
 * Pre-„ZIM"-Installationen selbstheilend vom Platzhalter-Namen
 * „Standard-Programm" auf den aktuellen DEFAULT_PROGRAMM_NAME. User-umbenannte
 * Programme bleiben unangetastet (Guard auf den exakten Legacy-Namen).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBStore } from '../../storage/idb-store';
import { ensureDefaultProgramm } from '../programmRegistry';
import { getProgramm, putProgramm } from '../idb-csv';
import {
  DEFAULT_PROGRAMM_ID,
  DEFAULT_PROGRAMM_NAME,
  LEGACY_DEFAULT_PROGRAMM_NAME,
} from '../constants';
import type { Programm } from '../types';

beforeEach(async () => {
  const { IDBFactory } = await import('fake-indexeddb');
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

async function freshIdb(): Promise<IDBStore> {
  const s = new IDBStore();
  await s.open();
  return s;
}

function defaultRecordWithName(name: string): Programm {
  return {
    id: DEFAULT_PROGRAMM_ID,
    name,
    created_at: '2026-06-03T00:00:00.000Z',
    smb_handle_key: 'daten-share',
  };
}

describe('ensureDefaultProgramm', () => {
  it('legt den Default-Record mit dem aktuellen Namen an, wenn keiner existiert', async () => {
    const idb = await freshIdb();
    const p = await ensureDefaultProgramm(idb);
    expect(p.id).toBe(DEFAULT_PROGRAMM_ID);
    expect(p.name).toBe(DEFAULT_PROGRAMM_NAME);
  });

  it('migriert einen bestehenden Legacy-„Standard-Programm"-Record auf den neuen Namen', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, defaultRecordWithName(LEGACY_DEFAULT_PROGRAMM_NAME));

    const p = await ensureDefaultProgramm(idb);
    expect(p.name).toBe(DEFAULT_PROGRAMM_NAME);

    // Persistiert, nicht nur im Rückgabewert.
    const persisted = await getProgramm(idb, DEFAULT_PROGRAMM_ID);
    expect(persisted?.name).toBe(DEFAULT_PROGRAMM_NAME);
  });

  it('lässt einen user-umbenannten Default-Record unangetastet', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, defaultRecordWithName('Mein eigenes Programm'));

    const p = await ensureDefaultProgramm(idb);
    expect(p.name).toBe('Mein eigenes Programm');
  });

  // v4.119: Die Zusage ist „mindestens EIN Programm", nicht „das
  // Standard-Programm". Bis dahin stellte jeder Refresh nach dem Löschen von
  // `default-programm` denselben Record wieder hin — mit derselben Id, aber
  // ohne die Schemas, Unterprogramme, Verbünde und Filter, die der
  // Cascade-Cleanup mitgenommen hatte.
  it('legt das gelöschte Standard-Programm NICHT neu an, solange ein anderes existiert', async () => {
    const idb = await freshIdb();
    await putProgramm(idb, {
      id: 'exist-2027',
      name: 'EXIST',
      created_at: '2027-01-02T00:00:00.000Z',
      smb_handle_key: 'daten-share',
    });

    const p = await ensureDefaultProgramm(idb);
    expect(p.id).toBe('exist-2027');
    expect(await getProgramm(idb, DEFAULT_PROGRAMM_ID)).toBeNull();
  });
});
