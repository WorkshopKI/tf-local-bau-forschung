/**
 * Einmalige Migration aus der Single-Source-Welt (vor v1.15) in die
 * Multi-Source-Welt: Legacy `dokumentenquelle`-Handle + `phase2_scan_config`-
 * Singleton werden in eine Default-`DmsSourceEntry` ueberfuehrt.
 *
 * Idempotent: laeuft nur, wenn der `dms_sources`-Store leer ist UND der
 * Legacy-Handle noch existiert.
 */

import type { IDBStore } from '../storage/idb-store';
import { logAudit } from '../infrastructure/audit-log';
import {
  copyDokumentenquelleToDmsSource,
  getDokumentenquelleHandle,
} from '../infrastructure/smb-handle';
import { getScanConfig } from '../../../phase2/scan-config/store';
import { DEFAULT_DMS_SOURCE_ID } from './types';
import { createDmsSource, listDmsSources } from './store';

export interface MigrationResult {
  migrated: boolean;
  reason?: 'already_migrated' | 'no_legacy_handle' | 'success';
  source_id?: string;
  sub_roots?: string[];
}

/**
 * Migriert den Legacy-Single-Source-State in eine Default-DmsSource.
 * Best-effort: Fehler werden geloggt, aber nicht geworfen, damit die App-
 * Bootstrap-Sequenz nicht haengt.
 */
export async function migrateLegacyDmsSource(idb: IDBStore): Promise<MigrationResult> {
  // Schon migriert? — wenn auch nur eine Source existiert, abbrechen.
  const existing = await listDmsSources(idb);
  if (existing.length > 0) {
    return { migrated: false, reason: 'already_migrated' };
  }

  // Kein Legacy-Handle? — nichts zu tun.
  const legacyHandle = await getDokumentenquelleHandle(idb);
  if (!legacyHandle) {
    return { migrated: false, reason: 'no_legacy_handle' };
  }

  // Legacy-Sub-Roots aus phase2_scan_config einlesen (kann leer sein).
  let subRoots: string[] = [];
  try {
    const cfg = await getScanConfig(idb);
    subRoots = cfg?.selected_paths ?? [];
  } catch {
    subRoots = [];
  }

  // Default-Source anlegen + Handle in den neuen Slot kopieren.
  const entry = await createDmsSource(idb, {
    id: DEFAULT_DMS_SOURCE_ID,
    label: 'DMS Hauptquelle (migriert)',
    sub_roots: subRoots,
    is_active: true,
    created_by: 'migration',
  });

  await copyDokumentenquelleToDmsSource(idb, entry.id);

  try {
    await logAudit(idb, {
      action: 'dms_source_migrated_from_legacy',
      details: { id: entry.id, sub_roots: subRoots, label: entry.label },
    });
  } catch {
    // Audit-Failure darf die Migration nicht blockieren.
  }

  return {
    migrated: true,
    reason: 'success',
    source_id: entry.id,
    sub_roots: subRoots,
  };
}
