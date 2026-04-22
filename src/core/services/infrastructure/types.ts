/** Shared Types für den Infrastruktur-Layer (Phase 1a + v1.9-Strukturkonsolidierung). */

export const SMB_HANDLES_IDB_KEY = 'smb-handles';
// Neue Slot-Keys ab v1.9. Legacy-Slot `test-programm` wird beim Laden
// transparent als Fallback gelesen (siehe smb-handle.ts).
export const SMB_HANDLE_DATEN_SHARE = 'daten-share';
export const SMB_HANDLE_DOKUMENTENQUELLE = 'dokumentenquelle';
/** @deprecated Vor v1.9. Wird als Fallback beim Laden des Daten-Share-Handles verwendet. */
export const SMB_HANDLE_LEGACY_TEST_PROGRAMM = 'test-programm';

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
export const BUILD_LOCK_PATH = '_intern/build-lock.json';
export const HEARTBEAT_PROBE_PATH = '_intern/heartbeat-probe';
export const SCAN_MANIFEST_PATH = '_intern/scan-manifest.json';
export const README_PATH = 'README.txt';

/** @deprecated Legacy-Pfade vor v1.9 — nur für Read-Fallback + Migration-Detection. */
export const LEGACY_AUDIT_LOG_PATH = 'admin/audit-log.jsonl';
export const LEGACY_KURATOR_CONFIG_PATH = 'admin/admin-config.enc';
export const LEGACY_BUILD_LOCK_PATH = 'admin/build-lock.json';
export const LEGACY_HEARTBEAT_PROBE_PATH = 'admin/heartbeat-probe';

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
