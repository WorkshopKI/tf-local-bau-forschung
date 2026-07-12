/**
 * Notizen-Widget-Persistenz (Phase 3).
 *
 * DATENSCHUTZ (HART): Die Notizen sind REIN LOKAL auf diesem Gerät (IndexedDB,
 * kv-Key). Sie werden NIE auf den Daten-Share, NIE in den persönlichen Ordner
 * gespiegelt und NIE exportiert — anders als die Widget-Config (die den
 * PersonalEinstellungen-Mirror nutzt) bleibt der Notiz-TEXT strikt auf dem
 * Gerät (Vorbild arbeitskontext-log.ts). Deshalb ausschließlich
 * `idb.get/set/delete` — maschinell erzwungen durch den Guard
 * `home-widgets-local-only` (notizen-strikt, codebase-conventions.test.ts).
 */
import type { IDBStore } from '@/core/services/storage/idb-store';

/** IDB-Key (kv-Store). Steht in KEINER Snapshot-Allowlist. */
export const HOME_NOTIZEN_IDB_KEY = 'home-notizen';

/** Toleranter Read: alles außer String → leere Notiz. */
export async function loadNotizen(idb: IDBStore): Promise<string> {
  const raw = await idb.get<unknown>(HOME_NOTIZEN_IDB_KEY);
  return typeof raw === 'string' ? raw : '';
}

export async function saveNotizen(idb: IDBStore, text: string): Promise<void> {
  if (text.length === 0) {
    await idb.delete(HOME_NOTIZEN_IDB_KEY);
    return;
  }
  await idb.set(HOME_NOTIZEN_IDB_KEY, text);
}
