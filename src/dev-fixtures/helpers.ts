/**
 * Dev-Fixture-Helpers: destruktive + aufbauende Zustands-Operationen.
 *
 * SICHERHEITS-HINWEIS: resetAll() leert alle IDB-Stores. Doppel-Guard
 * (Compile-Time __TEAMFLOW_DEV_FIXTURES__ + Runtime features.devFixtures).
 *
 * ABWEICHUNG VOM PATCH-WORTLAUT: resetAll() preserviert bewusst den
 * SMB-Handle (`smb-handles`-Key), damit der File-System-Access-API-Picker
 * nicht bei jedem Reset erneut erscheinen muss (user-bestätigte Entscheidung
 * für schnellere Iteration).
 *
 * v2.277: dieselbe Begründung gilt für die IDENTITÄT. Bis dahin löschte
 * resetAll auch `profile` + `onboarding-complete` — und weil JEDES Szenario
 * mit resetAll beginnt, landete der Tester nach jedem Szenario-Klick wieder
 * im Onboarding und tippte Name + Kürzel neu (Ordner blieben verbunden, das
 * verwirrte zusätzlich). Beides bleibt jetzt erhalten; wer den Erstlauf
 * gezielt testen will, nimmt `resetOnboarding()` aus actions.ts.
 */

import type { StorageService } from '@/core/services/storage';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { CSV_STORES, FILTER_STORE_NAME } from '@/core/services/storage/idb-store';
import {
  getDatenShareHandle,
  pickAndStoreDatenShareHandle,
  ensureFolderStructure,
} from '@/core/services/infrastructure/smb-handle';
import { istSetupKey } from '@/core/services/storage/setup-keys';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { useSmbStatus } from '@/core/hooks/useSmbStatus';
import { features } from '@/config/feature-flags';
import { getDevConfig } from './dev.config';

function assertDevFixtures(): void {
  if (!__TEAMFLOW_DEV_FIXTURES__ || !features.devFixtures) {
    throw new Error(
      'dev-fixtures: aufgerufen, obwohl features.devFixtures nicht aktiv ist. ' +
      'Das darf nie passieren — Build-Config prüfen.',
    );
  }
}

function clearObjectStore(idb: IDBStore, storeName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = idb.getDb();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Leert alle IndexedDB-Stores bis auf die Setup-Schlüssel (`SETUP_IDB_KEYS` —
 * kanonische Liste in setup-keys.ts, siehe dort für die Begründung).
 * Hält die DB-Schema-Version bei.
 */
export async function resetAll(idb: IDBStore): Promise<void> {
  assertDevFixtures();

  // CSV-Stores + Filter-Store komplett leeren.
  const csvStoreNames = Object.values(CSV_STORES) as string[];
  for (const name of csvStoreNames) {
    await clearObjectStore(idb, name);
  }
  await clearObjectStore(idb, FILTER_STORE_NAME);

  // KV-Store selektiv leeren (Setup-Schlüssel bewahren).
  const allKeys = await idb.keys();
  for (const key of allKeys) {
    if (istSetupKey(key)) continue;
    await idb.delete(key);
  }

  // Zustand-Stores zurücksetzen, damit UI nicht auf toten Session-Meta hängt.
  const session = useKuratorSession.getState();
  if (session.isActive) {
    await session.deactivate(idb);
  }
}

/**
 * Stellt sicher, dass ein Daten-Share-Handle existiert. Falls nicht: öffnet
 * den Ordner-Picker (einmalig pro App-Install wegen File-System-Access-API).
 * Legt anschließend die v1.9-Ordner-Struktur an.
 */
export async function ensureSmbHandle(idb: IDBStore): Promise<FileSystemDirectoryHandle> {
  assertDevFixtures();
  const existing = await getDatenShareHandle(idb);
  if (existing) {
    await ensureFolderStructure(existing);
    await useSmbStatus.getState().check(idb);
    return existing;
  }
  const res = await pickAndStoreDatenShareHandle(idb);
  if (!res.ok) {
    throw new Error(`SMB-Handle-Auswahl fehlgeschlagen: ${res.reason}${res.message ? ` (${res.message})` : ''}`);
  }
  await ensureFolderStructure(res.handle);
  await useSmbStatus.getState().check(idb);
  return res.handle;
}

/**
 * Stellt sicher, dass eine aktive Kurator-Session existiert.
 *
 * v3.0: Ohne `kurator-config.enc` gibt es kein Setup und kein Passwort mehr —
 * die Session wird direkt geoeffnet (`aktiviere`). Das ist genau der Weg, den
 * auch die Passwort-Wall geht, seit die Verifikation im Build steckt statt auf
 * dem Share. TTL vorher setzen: `aktiviere` liest `get().ttlMs`.
 */
export async function ensureKuratorSession(idb: IDBStore): Promise<void> {
  assertDevFixtures();
  const dev = getDevConfig();
  const session = useKuratorSession.getState();
  const ttlMs = dev.sessionTtlDays * 24 * 60 * 60 * 1000;
  session.setTtl(ttlMs);
  if (!session.isActive) {
    await session.aktiviere(idb, dev.defaultKuratorName);
  }
}

/**
 * Simuliert einen SMB-Offline-Zustand. Nach `ms` automatische Recovery beim
 * nächsten Poll.
 */
export function applyOfflineMode(ms = 60_000): void {
  assertDevFixtures();
  useSmbStatus.getState().simulateDisconnect(ms);
}

/** Convenience für Panels: StorageService → IDBStore. */
export function idbOf(storage: StorageService): IDBStore {
  return storage.idb;
}
