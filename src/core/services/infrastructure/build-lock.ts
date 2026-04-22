/**
 * Build-Lock (Phase 1a + v1.9).
 *
 * Schema Sektion 10.6: `_intern/build-lock.json` verhindert parallele Builds.
 * Stale-Detection: Heartbeat älter als 2h → Lock gilt als abgestürzt und
 * kann direkt übernommen werden.
 *
 * v1.9: Pfad wanderte von `programm-test/admin/build-lock.json` in
 * `_intern/build-lock.json` (Parent-Root). Legacy-Read als Fallback.
 */

import { getInternHandle, getProgrammHandle, getSmbHandle } from './smb-handle';
import { atomicWrite, readText, removeFile } from './atomic-write';
import { logAudit } from './audit-log';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { BuildLock } from './types';
import { BUILD_LOCK_PATH, LEGACY_BUILD_LOCK_PATH, PROGRAMM_DIR_NAME } from './types';
import { readKuratorName } from './kurator-config';

export const STALE_HEARTBEAT_MS = 2 * 60 * 60 * 1000;

export async function readBuildLock(idb: IDBStore): Promise<BuildLock | null> {
  const parent = await getSmbHandle(idb);
  if (!parent) return null;
  let text = await readText(parent, BUILD_LOCK_PATH);
  if (!text) {
    try {
      const programm = await getProgrammHandle(parent);
      text = await readText(programm, LEGACY_BUILD_LOCK_PATH);
    } catch { /* no legacy */ }
  }
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as BuildLock & { admin_name?: string };
    const kurator_name = raw.kurator_name ?? raw.admin_name ?? 'unknown';
    return { ...raw, kurator_name };
  } catch {
    return null;
  }
}

function ageMinutes(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Infinity;
  return Math.max(0, (Date.now() - t) / 60_000);
}

export function isStale(lock: BuildLock): boolean {
  return ageMinutes(lock.heartbeat) * 60_000 > STALE_HEARTBEAT_MS;
}

function hostname(): string {
  return (typeof navigator !== 'undefined' && navigator.platform) || 'unknown-host';
}

async function writeLock(
  parent: FileSystemDirectoryHandle,
  lock: BuildLock,
): Promise<void> {
  await getInternHandle(parent);
  await atomicWrite(parent, BUILD_LOCK_PATH, JSON.stringify(lock, null, 2), {
    skipBackup: true,
  });
}

export type AcquireResult =
  | { acquired: true; lock: BuildLock }
  | { acquired: false; existing: BuildLock; ageMinutes: number };

/**
 * Versucht den Lock zu übernehmen. Stale-Locks werden direkt überschrieben.
 * Aktive Locks blockieren — Caller zeigt Dialog und ruft ggf. forceLock.
 */
export async function acquireBuildLock(
  idb: IDBStore,
  stufe: string,
  opts: { programm_id?: string } = {},
): Promise<AcquireResult> {
  const parent = await getSmbHandle(idb);
  if (!parent) throw new Error('SMB-Handle nicht verfügbar');
  const existing = await readBuildLock(idb);
  if (existing && !isStale(existing)) {
    return { acquired: false, existing, ageMinutes: ageMinutes(existing.heartbeat) };
  }
  const kuratorName = (await readKuratorName(idb)) ?? 'dev-user';
  const now = new Date().toISOString();
  const lock: BuildLock = {
    programm_id: opts.programm_id ?? PROGRAMM_DIR_NAME,
    stufe,
    hostname: hostname(),
    kurator_name: kuratorName,
    gestartet: now,
    heartbeat: now,
  };
  await writeLock(parent, lock);
  await logAudit(idb, { action: 'build_lock_acquire', user: kuratorName, details: { stufe } });
  return { acquired: true, lock };
}

/** Überschreibt aktiven Lock. Schreibt Audit-Eintrag. */
export async function forceLock(
  idb: IDBStore,
  stufe: string,
  opts: { programm_id?: string } = {},
): Promise<BuildLock> {
  const parent = await getSmbHandle(idb);
  if (!parent) throw new Error('SMB-Handle nicht verfügbar');
  const previous = await readBuildLock(idb);
  const kuratorName = (await readKuratorName(idb)) ?? 'dev-user';
  const now = new Date().toISOString();
  const lock: BuildLock = {
    programm_id: opts.programm_id ?? PROGRAMM_DIR_NAME,
    stufe,
    hostname: hostname(),
    kurator_name: kuratorName,
    gestartet: now,
    heartbeat: now,
  };
  await writeLock(parent, lock);
  await logAudit(idb, {
    action: 'build_lock_force',
    user: kuratorName,
    details: { stufe, previous: previous ? { kurator: previous.kurator_name, stufe: previous.stufe } : null },
  });
  return lock;
}

export async function heartbeat(idb: IDBStore): Promise<void> {
  const parent = await getSmbHandle(idb);
  if (!parent) return;
  const current = await readBuildLock(idb);
  if (!current) return;
  const next: BuildLock = { ...current, heartbeat: new Date().toISOString() };
  await writeLock(parent, next);
}

/** Dev-Helper: Setzt den Heartbeat künstlich zurück (für Stale-Test). */
export async function setHeartbeatAge(idb: IDBStore, minutesAgo: number): Promise<void> {
  const parent = await getSmbHandle(idb);
  if (!parent) return;
  const current = await readBuildLock(idb);
  if (!current) return;
  const shifted: BuildLock = {
    ...current,
    heartbeat: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
  };
  await writeLock(parent, shifted);
}

export async function releaseLock(idb: IDBStore): Promise<void> {
  const parent = await getSmbHandle(idb);
  if (!parent) return;
  const existing = await readBuildLock(idb);
  await removeFile(parent, BUILD_LOCK_PATH).catch(() => undefined);
  // Legacy-Pfad ggf. mit löschen.
  try {
    const programm = await getProgrammHandle(parent);
    await removeFile(programm, LEGACY_BUILD_LOCK_PATH).catch(() => undefined);
  } catch { /* ignore */ }
  if (existing) {
    await logAudit(idb, { action: 'build_lock_release', user: existing.kurator_name, details: { stufe: existing.stufe } });
  }
}
