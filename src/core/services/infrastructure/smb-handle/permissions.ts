/** Berechtigungs-ORCHESTRIERUNG: refreshAll, Guided-Grant-Stepper, Abfrage aller Slots. Traegt die file://-Regel „ein Prompt pro User-Gesture". */
import { IDBStore } from '@/core/services/storage/idb-store';
import { SMB_HANDLE_DATEN_SHARE, SMB_HANDLE_LEGACY_TEST_PROGRAMM, SMB_HANDLE_PERSOENLICH, SMB_HANDLE_USER_FOLDERS_ROOT, USER_FOLDERS_ROOT_SLOT_PREFIX, DMS_SOURCE_SLOT_PREFIX, CSV_SOURCE_HANDLES_IDB_KEY, CSV_SOURCE_DIR_HANDLE_IDB_KEY } from '../types';
import { canWriteDatenShare, isKuratorMenusEnabled, isCsvAutoRefreshEnabled } from '@/config/feature-flags';
import { PERSONAL_ROOT_LEGACY_ID } from '@/config/personal-roots';
import { readAll, type PermState, type FsDirHandle, type FsFileHandle } from './kern';

/* --------------------------------------------------------------------------
 * v2.0: refreshAllPermissions — eine User-Gesture-Quelle, alle Handles
 * -------------------------------------------------------------------------- */

export type PermStateOrMissing = 'granted' | 'denied' | 'prompt' | 'missing';

export interface RefreshAllResult {
  datenShare: PermStateOrMissing;
  persoenlich: PermStateOrMissing;
  /** v4.1: Zustand je Wurzel-Id (inkl. `legacy`); leer wenn Nicht-Kurator. */
  userFoldersRoots: Record<string, PermStateOrMissing>;
  dmsSources: Record<string, PermStateOrMissing>;
}

/**
 * Fordert Permission fuer alle gespeicherten Handles in einer einzigen User-
 * Gesture-Kette an. Mode-Wahl pro Slot:
 * - daten-share: `read` wenn Nicht-Kurator, sonst `readwrite`
 * - persoenlich: `readwrite`
 * - user-folders-root: `read` (nur Kurator-Anwendungsfall)
 * - dms-source-*: `read`
 *
 * Slots ohne gespeicherten Handle bekommen `'missing'`. Permissions die
 * fehlschlagen werden als `'denied'` zurueckgegeben — der Aufrufer entscheidet
 * was offline-mode ausloest.
 *
 * MUSS aus einem User-Gesture-Handler (Click) aufgerufen werden, damit der
 * Browser die Permission-Dialoge nicht blockt.
 */
export async function refreshAllPermissions(
  idb: IDBStore,
  opts: { isKurator: boolean },
): Promise<RefreshAllResult> {
  const map = await readAll(idb);
  const result: RefreshAllResult = {
    datenShare: 'missing',
    persoenlich: 'missing',
    userFoldersRoots: {},
    dmsSources: {},
  };

  const datenShare = map[SMB_HANDLE_DATEN_SHARE] ?? map[SMB_HANDLE_LEGACY_TEST_PROGRAMM];
  if (datenShare) {
    // Schreibrecht: Kurator ODER Build erlaubt es generell (pl-Variante).
    // userFoldersRoots/DMS unten bleiben bewusst kurator-only.
    const mode = canWriteDatenShare(opts.isKurator) ? 'readwrite' : 'read';
    try {
      result.datenShare = await (datenShare as FsDirHandle).requestPermission({ mode });
    } catch {
      result.datenShare = 'denied';
    }
  }

  const persoenlich = map[SMB_HANDLE_PERSOENLICH];
  if (persoenlich) {
    try {
      result.persoenlich = await (persoenlich as FsDirHandle).requestPermission({ mode: 'readwrite' });
    } catch {
      result.persoenlich = 'denied';
    }
  }

  if (opts.isKurator) {
    for (const key of Object.keys(map)) {
      if (!key.startsWith(USER_FOLDERS_ROOT_SLOT_PREFIX)) continue;
      const rootId = key.slice(USER_FOLDERS_ROOT_SLOT_PREFIX.length);
      try {
        result.userFoldersRoots[rootId] = await (map[key] as FsDirHandle).requestPermission({ mode: 'read' });
      } catch {
        result.userFoldersRoots[rootId] = 'denied';
      }
    }
    const alt = map[SMB_HANDLE_USER_FOLDERS_ROOT];
    if (alt) {
      try {
        result.userFoldersRoots[PERSONAL_ROOT_LEGACY_ID] = await (alt as FsDirHandle).requestPermission({ mode: 'read' });
      } catch {
        result.userFoldersRoots[PERSONAL_ROOT_LEGACY_ID] = 'denied';
      }
    }

    for (const key of Object.keys(map)) {
      if (!key.startsWith(DMS_SOURCE_SLOT_PREFIX)) continue;
      const sourceId = key.slice(DMS_SOURCE_SLOT_PREFIX.length);
      try {
        result.dmsSources[sourceId] = await (map[key] as FsDirHandle).requestPermission({ mode: 'read' });
      } catch {
        result.dmsSources[sourceId] = 'denied';
      }
    }
  }

  // v2.19.1: CSV-Quellen-Datei-Handles im selben User-Gesture re-granten (pl +
  // kurator + dev). FSAPI-Datei-Berechtigungen gehen unter file:// pro Browser-
  // Session verloren — genau wie der Daten-Share oben; ohne das fragt der
  // Auto-Refresh-Banner nach jedem Neustart erneut nach Verknüpfung. Die
  // CSV-Handles liegen in einem eigenen IDB-Key (nicht im smb-handles-Map),
  // daher separat. Nur Handles mit verlorener Permission ('prompt') anfragen;
  // best-effort — denied/Fehler ignorieren (Banner faellt dann auf den
  // Re-Pick-Picker zurueck).
  if (isKuratorMenusEnabled() || isCsvAutoRefreshEnabled()) {
    // v2.27: bevorzugt das EINE Ordner-Handle — ein Prompt, Permission kaskadiert
    // auf alle CSVs. Existiert es, ist die Legacy-Per-Datei-Schleife überflüssig
    // (und würde nur unnötig Gesture-Budget verbrauchen). Beachte: aus dem
    // StartupScreen-Gesture verbraucht schon der Daten-Share oben die Activation
    // → dieser Re-Grant schlägt dort still fehl; er gelingt im sauberen pl-
    // AppPasswordGate-Gesture (siehe refreshCsvSourceDirPermission).
    const dirHandle = await idb.get<FileSystemDirectoryHandle>(CSV_SOURCE_DIR_HANDLE_IDB_KEY);
    if (dirHandle) {
      try {
        const h = dirHandle as FsDirHandle;
        if ((await h.queryPermission({ mode: 'read' })) !== 'granted') {
          await h.requestPermission({ mode: 'read' });
        }
      } catch {
        /* best-effort — denied/Fehler ignorieren */
      }
    } else {
      const csvHandles = await idb.get<Record<string, FileSystemFileHandle>>(CSV_SOURCE_HANDLES_IDB_KEY);
      if (csvHandles) {
        for (const handle of Object.values(csvHandles)) {
          const h = handle as FsFileHandle;
          try {
            if ((await h.queryPermission({ mode: 'read' })) !== 'granted') {
              await h.requestPermission({ mode: 'read' });
            }
          } catch {
            /* best-effort — denied/Fehler ignorieren */
          }
        }
      }
    }
  }

  return result;
}

/**
 * v2.27: Gibt NUR das CSV-Quellen-Ordner-Handle frei (nicht Daten-Share/
 * persoenlich). Gedacht für einen "sauberen" zweiten User-Gesture (pl-
 * AppPasswordGate), in dem der Daten-Share bereits aus dem vorherigen
 * StartupScreen-Gesture granted ist — so bekommt der Ordner-Prompt den
 * einzigen Prompt-Slot des Gestures (das one-prompt-per-gesture-Limit unter
 * `file://`). Ein Re-Grant des Ordner-Handles deckt via Permission-Kaskade
 * alle enthaltenen CSV-Dateien ab.
 *
 * MUSS aus einem User-Gesture-Handler aufgerufen werden. Best-effort:
 * `'missing'` wenn kein Ordner verknüpft ist, sonst der resultierende
 * Permission-State (`'denied'` bei Fehler).
 */
export async function refreshCsvSourceDirPermission(
  idb: IDBStore,
): Promise<PermState | 'missing'> {
  const handle = await idb.get<FileSystemDirectoryHandle>(CSV_SOURCE_DIR_HANDLE_IDB_KEY);
  if (!handle) return 'missing';
  try {
    const h = handle as FsDirHandle;
    if ((await h.queryPermission({ mode: 'read' })) === 'granted') return 'granted';
    return await h.requestPermission({ mode: 'read' });
  } catch {
    return 'denied';
  }
}

/* --------------------------------------------------------------------------
 * v2.55: Guided-Grant-Stepper — eine Freigabe pro User-Gesture (file://)
 *
 * Unter file:// zeigt Chrome pro User-Gesture nur EINEN Permission-Prompt;
 * `refreshAllPermissions` fragt mehrere Handles sequenziell im selben Klick an
 * → nur der erste promptet, der Rest verhungert still (siehe
 * docs/architecture/recurring-bug-classes.md §2). Der StartupScreen-Stepper
 * gibt stattdessen pro Klick GENAU EIN Handle frei. Diese Helfer liefern die
 * Liste der noch ausstehenden Grants (non-invasiv) und führen den Einzel-Grant
 * aus.
 * -------------------------------------------------------------------------- */

export type PendingGrantSlot = 'daten-share' | 'persoenlich' | 'csv-source';

/**
 * Ein noch ausstehender Permission-Grant: Handle liegt in IDB, ist aber für
 * seinen benötigten Mode noch nicht `granted`. Der Stepper rendert pro Eintrag
 * genau einen Klick-Schritt.
 */
export interface PendingGrant {
  slot: PendingGrantSlot;
  handle: FsDirHandle;
  mode: 'read' | 'readwrite';
  /** Menschlich lesbares Label für den Stepper-Button (z.B. „Datenordner"). */
  label: string;
}

async function isHandleGranted(
  h: FileSystemDirectoryHandle | undefined,
  mode: 'read' | 'readwrite',
): Promise<boolean> {
  if (!h) return false;
  try {
    return (await (h as FsDirHandle).queryPermission({ mode })) === 'granted';
  } catch {
    return false;
  }
}

/**
 * Non-invasiver Scan (nur `queryPermission`, kein Gesture): liefert die Handles,
 * die in IDB liegen, aber für ihren benötigten Mode noch NICHT `granted` sind —
 * als geordnete Klick-Schritte für den Guided-Stepper (Daten-Share → persönlich
 * → CSV-Quelle).
 *
 * Mode-/Gate-Logik identisch zu `refreshAllPermissions` (Pitfall #25: Mode nur
 * über `canWriteDatenShare`). Kurator-only-Slots (User-Folders-Root, DMS) sind
 * bewusst NICHT enthalten — die laufen weiter über die Post-Login-Eskalation im
 * AppPasswordGate (`isKurator` ist beim StartupScreen-Pre-Login false).
 */
export async function listPendingGrants(
  idb: IDBStore,
  opts: { isKurator: boolean },
): Promise<PendingGrant[]> {
  const map = await readAll(idb);
  const pending: PendingGrant[] = [];

  const datenShare = map[SMB_HANDLE_DATEN_SHARE] ?? map[SMB_HANDLE_LEGACY_TEST_PROGRAMM];
  const dsMode: 'read' | 'readwrite' = canWriteDatenShare(opts.isKurator) ? 'readwrite' : 'read';
  if (datenShare && !(await isHandleGranted(datenShare, dsMode))) {
    pending.push({ slot: 'daten-share', handle: datenShare as FsDirHandle, mode: dsMode, label: 'Datenordner' });
  }

  const persoenlich = map[SMB_HANDLE_PERSOENLICH];
  if (persoenlich && !(await isHandleGranted(persoenlich, 'readwrite'))) {
    pending.push({ slot: 'persoenlich', handle: persoenlich as FsDirHandle, mode: 'readwrite', label: 'Persönlicher Ordner' });
  }

  if (isKuratorMenusEnabled() || isCsvAutoRefreshEnabled()) {
    const csvDir = await idb.get<FileSystemDirectoryHandle>(CSV_SOURCE_DIR_HANDLE_IDB_KEY);
    if (csvDir && !(await isHandleGranted(csvDir, 'read'))) {
      pending.push({ slot: 'csv-source', handle: csvDir as FsDirHandle, mode: 'read', label: 'CSV-Quelle' });
    }
  }

  return pending;
}

/**
 * Gibt GENAU EIN Pending-Handle frei. MUSS aus einem User-Gesture-Handler
 * laufen → genau ein Browser-Prompt. Best-effort: `'denied'` bei Fehler.
 */
export async function grantPending(grant: PendingGrant): Promise<PermState> {
  try {
    return await grant.handle.requestPermission({ mode: grant.mode });
  } catch {
    return 'denied';
  }
}

/**
 * Non-invasiver Spiegel von `refreshAllPermissions`: liest pro Slot nur
 * `queryPermission` (kein User-Gesture) und liefert denselben
 * `RefreshAllResult`. Gedacht, um nach dem Guided-Stepper den ConnectionState
 * (`applyRefreshResult`) zu aktualisieren, ohne erneut zu prompten.
 */
export async function queryAllPermissions(
  idb: IDBStore,
  opts: { isKurator: boolean },
): Promise<RefreshAllResult> {
  const map = await readAll(idb);
  const result: RefreshAllResult = {
    datenShare: 'missing',
    persoenlich: 'missing',
    userFoldersRoots: {},
    dmsSources: {},
  };

  const datenShare = map[SMB_HANDLE_DATEN_SHARE] ?? map[SMB_HANDLE_LEGACY_TEST_PROGRAMM];
  if (datenShare) {
    const mode = canWriteDatenShare(opts.isKurator) ? 'readwrite' : 'read';
    try {
      result.datenShare = await (datenShare as FsDirHandle).queryPermission({ mode });
    } catch {
      result.datenShare = 'denied';
    }
  }

  const persoenlich = map[SMB_HANDLE_PERSOENLICH];
  if (persoenlich) {
    try {
      result.persoenlich = await (persoenlich as FsDirHandle).queryPermission({ mode: 'readwrite' });
    } catch {
      result.persoenlich = 'denied';
    }
  }

  if (opts.isKurator) {
    for (const key of Object.keys(map)) {
      if (!key.startsWith(USER_FOLDERS_ROOT_SLOT_PREFIX)) continue;
      const rootId = key.slice(USER_FOLDERS_ROOT_SLOT_PREFIX.length);
      try {
        result.userFoldersRoots[rootId] = await (map[key] as FsDirHandle).queryPermission({ mode: 'read' });
      } catch {
        result.userFoldersRoots[rootId] = 'denied';
      }
    }
    const alt = map[SMB_HANDLE_USER_FOLDERS_ROOT];
    if (alt) {
      try {
        result.userFoldersRoots[PERSONAL_ROOT_LEGACY_ID] = await (alt as FsDirHandle).queryPermission({ mode: 'read' });
      } catch {
        result.userFoldersRoots[PERSONAL_ROOT_LEGACY_ID] = 'denied';
      }
    }

    for (const key of Object.keys(map)) {
      if (!key.startsWith(DMS_SOURCE_SLOT_PREFIX)) continue;
      const sourceId = key.slice(DMS_SOURCE_SLOT_PREFIX.length);
      try {
        result.dmsSources[sourceId] = await (map[key] as FsDirHandle).queryPermission({ mode: 'read' });
      } catch {
        result.dmsSources[sourceId] = 'denied';
      }
    }
  }

  return result;
}

/**
 * v2.0 Migration-Check: Wenn ein Nicht-Kurator einen Daten-Share-Handle mit
 * `readwrite`-Mode in IDB hat, sollte er beim Start einen Re-Pick mit
 * `read`-Mode bekommen. Liefert `true` wenn ein Downgrade noetig ist.
 */
export async function needsDatenShareDowngrade(
  idb: IDBStore,
  opts: { isKurator: boolean },
): Promise<boolean> {
  // Kein Downgrade fuer Rollen, die schreiben duerfen (Kurator ODER Build mit
  // datenShareSchreibrecht, z.B. pl) — die sollen readwrite behalten.
  if (canWriteDatenShare(opts.isKurator)) return false;
  const map = await readAll(idb);
  const handle = map[SMB_HANDLE_DATEN_SHARE] ?? map[SMB_HANDLE_LEGACY_TEST_PROGRAMM];
  if (!handle) return false;
  try {
    const rw = await (handle as FsDirHandle).queryPermission({ mode: 'readwrite' });
    return rw === 'granted';
  } catch {
    return false;
  }
}
