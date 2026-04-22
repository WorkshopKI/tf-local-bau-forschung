/**
 * Offline-Detection-Kernlogik (Phase 1a, Modul H).
 *
 * probeSmb: prüft Permission + versucht eine Lightweight-Operation gegen den
 * admin-Ordner des Programms. Fehler/denied → offline bzw. permission_denied.
 */

import { getSmbHandle, queryPermission, getInternHandle } from './smb-handle';
import type { IDBStore } from '@/core/services/storage/idb-store';

export type SmbStatus = 'unknown' | 'online' | 'offline' | 'permission_denied';

export async function probeSmb(idb: IDBStore): Promise<SmbStatus> {
  const parent = await getSmbHandle(idb);
  // Kein Handle gesetzt → Phase 1a noch nicht initialisiert, kein Banner.
  if (!parent) return 'unknown';
  const perm = await queryPermission(parent).catch(() => 'denied' as const);
  if (perm === 'denied') return 'permission_denied';
  if (perm !== 'granted') return 'permission_denied';
  try {
    // _intern/-Ordner öffnen als Probe (create falls nicht existiert, idempotent).
    await getInternHandle(parent);
    return 'online';
  } catch {
    return 'offline';
  }
}
