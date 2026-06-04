/** Shared Types für den Infrastruktur-Layer (Phase 1a + v1.9-Strukturkonsolidierung). */

export const SMB_HANDLES_IDB_KEY = 'smb-handles';
// Neue Slot-Keys ab v1.9. Legacy-Slot `test-programm` wird beim Laden
// transparent als Fallback gelesen (siehe smb-handle.ts).
export const SMB_HANDLE_DATEN_SHARE = 'daten-share';
/**
 * v2.0: Persoenlicher Ordner (User-rw). Liegt typischerweise auf dem
 * Home-Laufwerk des Users. Pflegt profile.json, einstellungen.json
 * und die Feedback-Outbox; siehe PERSOENLICH_*-Pfad-Konstanten.
 */
export const SMB_HANDLE_PERSOENLICH = 'persoenlich';
/**
 * v2.0: Wurzel-Ordner aller User-Home-Laufwerke (z.B. `\\share\home-laufwerke\`).
 * Wird vom Kurator einmalig gepickt, damit die App im FeedbackInboxTab
 * JSON-Dateien aus `<user>/ZAH/feedback/outbox/` einsammeln kann.
 */
export const SMB_HANDLE_USER_FOLDERS_ROOT = 'user-folders-root';
/**
 * @deprecated Seit v1.15 wird Multi-Source via `dms-source-${id}`-Slots verwaltet
 * (siehe DMS_SOURCE_SLOT_PREFIX). Dieser Single-Slot bleibt nur bis die Migration
 * (`migrateLegacyDmsSource`) einmal pro Installation gelaufen ist.
 */
export const SMB_HANDLE_DOKUMENTENQUELLE = 'dokumentenquelle';
/** @deprecated Vor v1.9. Wird als Fallback beim Laden des Daten-Share-Handles verwendet. */
export const SMB_HANDLE_LEGACY_TEST_PROGRAMM = 'test-programm';

/**
 * v1.15: Schluessel-Praefix fuer DMS-Source-Handles in der `smb-handles`-Map.
 * Ein Eintrag pro Source: `dms-source-${sourceId}` -> FileSystemDirectoryHandle.
 */
export const DMS_SOURCE_SLOT_PREFIX = 'dms-source-';

export function dmsSourceSlotKey(sourceId: string): string {
  return `${DMS_SOURCE_SLOT_PREFIX}${sourceId}`;
}

// IDB-Key-Werte bleiben unverändert, damit bestehende Test-Sessions weiter valide sind.
export const KURATOR_SESSION_META_IDB_KEY = 'admin-session-meta';
export const KURATOR_NAME_LOCAL_IDB_KEY = 'admin-name-local';

export const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Programm-Ordner-Name (v1.9). Migration aus `programm-test/` liegt in migration.ts. */
export const PROGRAMM_DIR_NAME = 'programm';
/** @deprecated Vor v1.9. Migration-Helper prüft auf diesen Namen. */
export const LEGACY_PROGRAMM_DIR_NAME = 'programm-test';

/** Unterordner im Programm-Ordner (relative zum Programm-Handle). */
export const PROGRAMM_SUBDIRS = ['antraege', 'schemas', 'index'] as const;
/** Hardcoded Rohdaten-Subordner für CSV-Importe. */
export const ANTRAEGE_IMPORTS_DIR = 'antraege/imports';

/** `_intern/` liegt im PARENT (Daten-Share-Root), nicht im programm/. */
export const INTERN_DIR = '_intern';
export const INTERN_FEEDBACK_DIR = '_intern/feedback';
export const AUDIT_LOG_PATH = '_intern/audit-log.jsonl';
export const KURATOR_CONFIG_PATH = '_intern/kurator-config.enc';
/** v2.11: Zugangsdatei der MA-Login-Wall. JSON-Huelle mit pro-Eintrag Salt +
 *  AES-GCM-verschluesseltem Kuerzel (kein Klartext-Kuerzel/Passwort/Hint).
 *  Liegt neben kurator-config.enc auf dem Daten-Share.
 *  Schreib-Profil (Pitfall #23): idempotent-overwrite via `atomicWrite` MIT
 *  Backup (ganze Datei wird pro Mutation neu geschrieben). */
export const ZUGANG_CONFIG_PATH = '_intern/auslastung-zugang.enc';

export interface ZugangsEintrag {
  /** Base64, randomBytes(16) — pro Eintrag eigenes Salt. */
  salt: string;
  /** Base64 von `[12B IV][ciphertext+tag]` (Output von `crypto.encrypt`). */
  verschluesseltesKuerzel: string;
  /** Pseudonyme MA-ID ("MA01"). Erlaubt der PL Replace/Revoke per anonId. Login
   *  nutzt das Feld NICHT (probiert weiterhin ALLE Eintraege per Passwort, kein
   *  Hint) — verraet nichts ueber die ohnehin im Klartext liegende
   *  `_intern/auslastung-kuerzel-map.json` hinaus. */
  anonId: string;
}

export interface ZugangsFile {
  version: 1;
  updatedAt: string;
  eintraege: ZugangsEintrag[];
}

/** v2.11: sessionStorage-Key fuer das eingeloggte MA-Kuerzel. sessionStorage
 *  (NICHT IDB): TTL = Browser-Tab, loescht sich beim Schliessen → erzwingt Login
 *  pro Arbeitstag. Es wird AUSSCHLIESSLICH das entschluesselte Kuerzel abgelegt,
 *  NIE Passwort oder abgeleiteter Key. */
export const MA_KUERZEL_SESSION_KEY = 'tf-ma-kuerzel';
export const BUILD_LOCK_PATH = '_intern/build-lock.json';
export const HEARTBEAT_PROBE_PATH = '_intern/heartbeat-probe';
export const SCAN_MANIFEST_PATH = '_intern/scan-manifest.json';
/** Phase 2: gefilterte DMS-CSV (Output von scripts/filter-dms-csv.mjs). */
export const DMS_INDEX_FILTERED_PATH = '_intern/dms-index-filtered.csv';
/** Phase 2: editierbares Override-Mapping Aktenplanzuordnung → doc_type. */
export const AKTENPLAN_MAPPING_PATH = '_intern/aktenplan-mapping.json';
export const README_PATH = 'README.txt';

/**
 * v2.0: Pfade auf dem persoenlichen Laufwerk (Subpfade unterhalb des Persoenlich-
 * Handles). Wird beim ersten Mount automatisch angelegt (siehe ensurePersoenlich-
 * Folders) — sind hier zentral definiert, damit Outbox-Reader im Kurator-Plugin
 * die gleiche Struktur erwartet.
 *
 * v2.6.2: Subordner von `teamflow` auf `ZAH` umbenannt (App-Branding). Der
 * Config-Wert `personalFolder.subfolder` (Anzeige im Onboarding) wird parallel
 * gepflegt. Legacy-`teamflow/`-Ordner werden NICHT automatisch migriert.
 */
export const PERSOENLICH_ZAH_DIR = 'ZAH';
export const PERSOENLICH_FEEDBACK_DIR = 'ZAH/feedback';
export const PERSOENLICH_FEEDBACK_OUTBOX_DIR = 'ZAH/feedback/outbox';
export const PERSOENLICH_PROFILE_FILE = 'ZAH/profile.json';
export const PERSOENLICH_EINSTELLUNGEN_FILE = 'ZAH/einstellungen.json';
export const PERSOENLICH_MEINE_FEEDBACKS_FILE = 'ZAH/feedback/meine-feedbacks.json';
/**
 * v2.6: MA-Selbst-Profil fuers Auslastungs-Modul (Technologien/Kategorien).
 * Nicht-Kuratoren haben seit v2.0 nur `read` auf dem Daten-Share und koennen
 * `_intern/auslastung.json` nicht schreiben — sie pflegen ihr Profil hier im
 * eigenen Ordner; die PL sammelt alle Profile ueber den User-Folders-Root ein.
 * Relativ zum User-Home-Root, daher in beiden Lese-Kontexten (eigener
 * Persoenlich-Handle + fremder User-Ordner) identisch nutzbar.
 */
export const PERSOENLICH_AUSLASTUNG_PROFIL_FILE = 'ZAH/auslastung-profil.json';
/**
 * v2.9: Übernahme-Wünsche („Kann ich übernehmen"). Spiegelbild des Profils:
 * Nicht-Kuratoren (prod) haben nur `read` auf dem Daten-Share und koennen
 * `_intern/auslastung.json` nicht schreiben — der Wunsch landet hier im eigenen
 * Ordner, die PL sammelt alle Wünsche ueber den User-Folders-Root ein und mergt
 * sie als `Zuweisung{status:'selbst'}` in `auslastung.json`. Relativ zum
 * User-Home-Root, daher in beiden Lese-Kontexten identisch nutzbar.
 */
export const PERSOENLICH_AUSLASTUNG_UEBERNAHME_FILE = 'ZAH/auslastung-uebernahme.json';

/**
 * v2.0: IDB-Flag das die App beim Start anlegt, wenn ein bestehender Daten-
 * Share-Handle mit `readwrite`-Mode existiert obwohl der User Nicht-Kurator
 * ist. Der StartupScreen rendert dann ein Migrations-Banner und triggert
 * einen Re-Pick mit `read`-Mode. Wird nach erfolgreichem Re-Pick geloescht.
 */
export const NEEDS_HANDLE_DOWNGRADE_IDB_KEY = 'needs-handle-downgrade';

/**
 * IDB-Key für die pro-CsvSchema gespeicherten `FileSystemFileHandle`s
 * (Auto-Refresh-Quelldateien). In Core definiert (zentrale IDB-Key-Registry),
 * genutzt vom csv-sources-kuration-Plugin UND vom Start-Re-Grant in
 * `refreshAllPermissions` (smb-handle.ts), das die FSAPI-Datei-Berechtigung
 * beim App-Start neu erteilt — sonst fragt der Auto-Refresh-Banner nach jedem
 * Neustart erneut nach Verknüpfung (v2.19.1).
 */
export const CSV_SOURCE_HANDLES_IDB_KEY = 'csv-source-handles';

/**
 * v2.27: EIN `FileSystemDirectoryHandle` für den Ordner, der alle CSV-Quell-
 * dateien einer pl-Installation enthält. Löst die N Per-Datei-Handles
 * (`CSV_SOURCE_HANDLES_IDB_KEY`) als Re-Grant-Ziel ab: FSAPI-Directory-Permission
 * **kaskadiert** auf Kind-Dateien, die über `dirHandle.getFileHandle(name)`
 * geöffnet werden — EIN `requestPermission`-Prompt deckt alle CSVs ab. Das
 * umgeht das Chromium-Limit „nur der erste Permission-Prompt pro User-Gesture
 * wird angezeigt": die alte Per-Datei-Schleife in `refreshAllPermissions` lief
 * nach dem Daten-Share-Prompt, der den Gesture bereits verbraucht hatte → die
 * CSV-Handles blieben nach jedem Neustart ungranted (v2.19.1-Folgebug).
 */
export const CSV_SOURCE_DIR_HANDLE_IDB_KEY = 'csv-source-dir-handle';

/** Backup-Root. v1.9: ohne programm-test-Zwischenordner; Rolling 4 Generationen. */
export const BACKUPS_DIR = 'backups';
export const BACKUP_MAX_GENERATIONS = 4;

export interface AuditEntry {
  ts: string;
  user: string;
  action: string;
  details?: unknown;
}

export interface BuildLock {
  programm_id: string;
  stufe: string;
  hostname: string;
  kurator_name: string;
  gestartet: string;
  heartbeat: string;
  geschaetzt_fertig?: string;
}

export interface BackupEntry {
  datum: string;
  folderName: string;
  fileCount: number;
}

export interface KuratorConfigPlain {
  version: 1;
  kuratorName: string;
  created: string;
}

export interface SessionMeta {
  kuratorName: string;
  expiresAt: number;
}

/** Ordner-Validierungs-Status beim Auswählen eines Daten-Share-Ordners. */
export type FolderValidationResult =
  | { kind: 'empty' }
  | { kind: 'current' }
  | { kind: 'legacy'; legacyFilesCount: number; dokumenteFileCount: number }
  | { kind: 'subfolder'; detected: 'programm' | 'intern' | 'legacy-programm-test' };
