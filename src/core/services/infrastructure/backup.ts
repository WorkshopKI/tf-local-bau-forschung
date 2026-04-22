/**
 * Wöchentliches Backup (Phase 1a + v1.9).
 *
 * v1.9-Struktur: `backups/YYYY-MM-DD/` direkt im Daten-Share-Root (ohne
 * Zwischenebene `programm-test/`). Rolling 4 Generationen. Kopiert programm/
 * komplett, AUSSER dem `dokumente/`-Baum — der in Phase 2 in einem separaten
 * Dokumentenquelle-Handle liegt (GB-Scale).
 */

import { getSmbHandle, getProgrammHandle } from './smb-handle';
import { logAudit } from './audit-log';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { BackupEntry } from './types';
import {
  BACKUPS_DIR,
  BACKUP_MAX_GENERATIONS,
} from './types';

const EXCLUDED_SUBDIR = 'dokumente';

function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function listEntries(dir: FileSystemDirectoryHandle): Promise<FileSystemHandle[]> {
  const entries: FileSystemHandle[] = [];
  for await (const entry of (dir as FileSystemDirectoryHandle & {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }).values()) {
    entries.push(entry);
  }
  return entries;
}

async function copyFile(
  sourceParent: FileSystemDirectoryHandle,
  targetParent: FileSystemDirectoryHandle,
  name: string,
): Promise<void> {
  const srcFh = await sourceParent.getFileHandle(name);
  const file = await srcFh.getFile();
  const dstFh = await targetParent.getFileHandle(name, { create: true });
  const w = await dstFh.createWritable();
  await w.write(file);
  await w.close();
}

async function copyDirRecursive(
  source: FileSystemDirectoryHandle,
  target: FileSystemDirectoryHandle,
  skip?: (name: string) => boolean,
): Promise<number> {
  let count = 0;
  const entries = await listEntries(source);
  for (const entry of entries) {
    if (skip && skip(entry.name)) continue;
    if (entry.kind === 'file') {
      await copyFile(source, target, entry.name);
      count += 1;
    } else if (entry.kind === 'directory') {
      const subTarget = await target.getDirectoryHandle(entry.name, { create: true });
      const subSource = await source.getDirectoryHandle(entry.name);
      count += await copyDirRecursive(subSource, subTarget);
    }
  }
  return count;
}

async function backupsRoot(idb: IDBStore): Promise<FileSystemDirectoryHandle | null> {
  const parent = await getSmbHandle(idb);
  if (!parent) return null;
  return parent.getDirectoryHandle(BACKUPS_DIR, { create: true });
}

export async function listBackups(idb: IDBStore): Promise<BackupEntry[]> {
  const root = await backupsRoot(idb);
  if (!root) return [];
  const result: BackupEntry[] = [];
  for await (const entry of (root as FileSystemDirectoryHandle & {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }).values()) {
    if (entry.kind !== 'directory') continue;
    // Überspringe Legacy-Zwischenordner `programm-test` (enthält Generationen darunter).
    if (entry.name === 'programm-test') continue;
    const dir = entry as FileSystemDirectoryHandle;
    let fileCount = 0;
    const subs = await listEntries(dir);
    for (const s of subs) {
      if (s.kind === 'directory') {
        fileCount += (await listEntries(s as FileSystemDirectoryHandle)).filter(x => x.kind === 'file').length;
      } else {
        fileCount += 1;
      }
    }
    result.push({ datum: entry.name, folderName: entry.name, fileCount });
  }
  result.sort((a, b) => (a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : 0));
  return result;
}

async function pruneOldBackups(idb: IDBStore): Promise<string | null> {
  const root = await backupsRoot(idb);
  if (!root) return null;
  const list = await listBackups(idb);
  if (list.length <= BACKUP_MAX_GENERATIONS) return null;
  const toDelete = list.slice(BACKUP_MAX_GENERATIONS);
  let rotated: string | null = null;
  for (const entry of toDelete) {
    await root.removeEntry(entry.folderName, { recursive: true });
    rotated = entry.folderName;
  }
  return rotated;
}

export interface CreateBackupResult {
  created: string;
  rotatedOut: string | null;
  durationMs: number;
  copiedFiles: number;
}

/**
 * Erstellt einen Snapshot für heute. Wenn für den heutigen Tag bereits einer
 * existiert, wird er überschrieben (idempotent für Dev-Panel-Tests).
 */
export async function createWeeklyBackup(idb: IDBStore): Promise<CreateBackupResult> {
  const parent = await getSmbHandle(idb);
  if (!parent) throw new Error('SMB-Handle nicht verfügbar');
  const programm = await getProgrammHandle(parent);
  const root = await backupsRoot(idb);
  if (!root) throw new Error('Backup-Root nicht verfügbar');
  const start = Date.now();
  const datum = todayString();

  try {
    await root.removeEntry(datum, { recursive: true });
  } catch {
    /* ok — existiert noch nicht */
  }

  const target = await root.getDirectoryHandle(datum, { create: true });
  const copied = await copyDirRecursive(programm, target, name => name === EXCLUDED_SUBDIR);
  const rotatedOut = await pruneOldBackups(idb);
  const durationMs = Date.now() - start;
  await logAudit(idb, {
    action: 'backup_create',
    details: { datum, copiedFiles: copied, rotatedOut, durationMs },
  });
  return { created: datum, rotatedOut, durationMs, copiedFiles: copied };
}

/** True, wenn für die laufende ISO-Kalenderwoche noch kein Snapshot existiert. */
export async function shouldSuggestWeeklyBackup(idb: IDBStore): Promise<boolean> {
  const list = await listBackups(idb);
  if (list.length === 0) return true;
  const currentWeek = isoWeek(new Date());
  const latest = list[0];
  if (!latest) return true;
  const latestDate = new Date(latest.datum);
  if (Number.isNaN(latestDate.getTime())) return true;
  return isoWeek(latestDate) !== currentWeek;
}

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** Dev-Helper: löscht den ältesten Snapshot (für Rotation-Test). */
export async function deleteOldestBackup(idb: IDBStore): Promise<string | null> {
  const root = await backupsRoot(idb);
  if (!root) return null;
  const list = await listBackups(idb);
  if (list.length === 0) return null;
  const oldest = list[list.length - 1];
  if (!oldest) return null;
  await root.removeEntry(oldest.folderName, { recursive: true });
  await logAudit(idb, { action: 'backup_delete_oldest', details: { datum: oldest.datum } });
  return oldest.datum;
}
