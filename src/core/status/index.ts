/**
 * Status-System neu — Barrel.
 *
 * Schicht 1 (Katalog) + Snapshot-Anbindung. Historie (Schicht 2) und
 * Ableitungs-Engine (Schicht 3) kommen in den Folgephasen dazu.
 */
export * from './typen';
export { STATUS_KATALOG_STORE, STATUS_EVENT_STORE } from './stores';
export { baueSeedVersion } from './seed';
export { setStatusKatalogSnapshot, getAktiveVersion } from './snapshot';
export {
  listeVersionen, getVersion, speichereVersion,
  getAktiveVersionsnummer, setzeAktiv, ladeAktiveVersion, naechsteVersionsnummer,
  ladeUnkuratiert, speichereUnkuratiert,
} from './katalog-store';
export { ermittleNeueUnkuratierte, type BeobachteterWert } from './entdecke';
export { entdeckeUnkuratiertNachImport } from './import-integration';

import type { IDBStore } from '@/core/services/storage';
import { isStatusCockpitEnabled } from '@/config/feature-flags';
import { ladeAktiveVersion } from './katalog-store';
import { setStatusKatalogSnapshot } from './snapshot';

/**
 * Einmalige Initialisierung beim App-Start (nach `storage.init()`): lädt die
 * aktive Katalog-Version (seedet Version 1 beim ersten Mal) und setzt den
 * In-Memory-Snapshot, aus dem `getStatusCategory` liest. No-op ohne Flag.
 * Best-effort — blockiert den App-Start nicht.
 */
export async function initStatusKatalog(idb: IDBStore): Promise<void> {
  if (!isStatusCockpitEnabled()) return;
  const version = await ladeAktiveVersion(idb);
  setStatusKatalogSnapshot(version);
}
