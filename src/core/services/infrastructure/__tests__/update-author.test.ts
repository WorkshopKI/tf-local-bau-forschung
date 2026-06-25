/**
 * resolveSnapshotAuthor — Präzedenz der Urheber-Identität fürs Snapshot-`createdBy`.
 *
 * Mock-Strategie analog userFoldersRootPermission.test.ts: minimaler IDBStore-Stub,
 * der `get(key)` rein aus einem In-Memory-Store bedient. So treiben wir alle
 * Präzedenz-Branches, ohne echte SMB-/Crypto-Pfade:
 *   - readKuratorName fällt ohne Daten-Share-Handle (kein SMB_HANDLE_DATEN_SHARE)
 *     direkt auf den IDB-Cache `KURATOR_NAME_LOCAL_IDB_KEY` zurück.
 *   - getPersoenlichHandle liest `SMB_HANDLE_PERSOENLICH` aus der Handle-Map.
 *   - das Profil-Kürzel kommt aus `idb.get('profile')`.
 */
import { describe, it, expect } from 'vitest';
import { resolveSnapshotAuthor } from '../update-author';
import { runtimeConfig } from '@/config/runtime-config';
import {
  SMB_HANDLES_IDB_KEY,
  SMB_HANDLE_PERSOENLICH,
  KURATOR_NAME_LOCAL_IDB_KEY,
} from '../types';
import type { IDBStore } from '@/core/services/storage/idb-store';

function makeIdb(store: Record<string, unknown>): IDBStore {
  return { get: async (key: string) => store[key] ?? null } as unknown as IDBStore;
}

/** Persönlicher Ordner-Handle-Mock — nur `.name` wird gelesen. */
function persHandle(name: string): Record<string, unknown> {
  return { [SMB_HANDLES_IDB_KEY]: { [SMB_HANDLE_PERSOENLICH]: { name } } };
}

describe('resolveSnapshotAuthor', () => {
  it('1. Kurator-Name gewinnt vor Kürzel und Nachname', async () => {
    const idb = makeIdb({
      [KURATOR_NAME_LOCAL_IDB_KEY]: '  Maria Müller  ',
      profile: { bearbeiter_kuerzel: 'MUE' },
      ...persHandle('Schmidt'),
    });
    expect(await resolveSnapshotAuthor(idb)).toBe('Maria Müller');
  });

  it('2. Kürzel „alle" zählt als „kein Kürzel" → Nachname (persönlicher Ordner)', async () => {
    const idb = makeIdb({
      [KURATOR_NAME_LOCAL_IDB_KEY]: null,
      profile: { bearbeiter_kuerzel: 'Alle' }, // case-insensitive
      ...persHandle('Müller'),
    });
    expect(await resolveSnapshotAuthor(idb)).toBe('Müller');
  });

  it('3. echtes Kürzel gewinnt vor dem Nachnamen', async () => {
    const idb = makeIdb({
      [KURATOR_NAME_LOCAL_IDB_KEY]: null,
      profile: { bearbeiter_kuerzel: 'MUE' },
      ...persHandle('Müller'),
    });
    expect(await resolveSnapshotAuthor(idb)).toBe('MUE');
  });

  it('4. ohne Name/echtes Kürzel/Ordner → Build-Label', async () => {
    const idb = makeIdb({
      [KURATOR_NAME_LOCAL_IDB_KEY]: null,
      profile: { bearbeiter_kuerzel: 'alle' },
      [SMB_HANDLES_IDB_KEY]: {}, // kein persönlicher Ordner
    });
    // vitest.config.mts setzt build.label = 'Test'
    expect(await resolveSnapshotAuthor(idb)).toBe(runtimeConfig.build.label);
  });

  it('5. letzter Fallback „unbekannt", wenn auch das Build-Label leer ist', async () => {
    const orig = runtimeConfig.build.label;
    runtimeConfig.build.label = '';
    try {
      const idb = makeIdb({
        [KURATOR_NAME_LOCAL_IDB_KEY]: null,
        profile: null,
        [SMB_HANDLES_IDB_KEY]: {},
      });
      expect(await resolveSnapshotAuthor(idb)).toBe('unbekannt');
    } finally {
      runtimeConfig.build.label = orig;
    }
  });
});
