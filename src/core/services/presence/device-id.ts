/**
 * Geraete-/Browser-lokale stabile ID fuer Presence.
 *
 * Identifiziert „dieses Geraet/diesen Browser" (nicht die Person — die
 * menschliche Identitaet liefern Kuerzel/Name). Liegt im IDB-KV-Store, kein
 * Schema-Bump. `crypto.randomUUID()` funktioniert unter `file://` (Secure
 * Context, CLAUDE.md Pitfall #6).
 */
import type { IDBStore } from '@/core/services/storage/idb-store';

const DEVICE_ID_IDB_KEY = 'presence-device-id';

export async function getOrCreateDeviceId(idb: IDBStore): Promise<string> {
  const existing = await idb.get<string>(DEVICE_ID_IDB_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  await idb.set(DEVICE_ID_IDB_KEY, id);
  return id;
}
