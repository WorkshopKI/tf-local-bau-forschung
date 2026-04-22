/**
 * Audit-Log (Phase 1a + v1.9).
 *
 * Append-only JSONL. Seit v1.9 unter `_intern/audit-log.jsonl` (am Parent-Root).
 * Legacy-Pfad `programm-test/admin/audit-log.jsonl` wird beim Lesen als Fallback
 * berücksichtigt, bis die Migration gelaufen ist.
 *
 * NB: appendToFile = Read→Append→Write ist NICHT race-safe zwischen Tabs.
 * Im Phase-1a-Szenario (1 Kurator = 1 Schreiber) akzeptabel.
 */

import { getInternHandle, getProgrammHandle, getSmbHandle } from './smb-handle';
import { appendToFile, readText } from './atomic-write';
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { AuditEntry } from './types';
import { AUDIT_LOG_PATH, LEGACY_AUDIT_LOG_PATH } from './types';

export interface LogAuditInput {
  action: string;
  details?: unknown;
  user?: string;
}

/** Schreibt einen Event-Eintrag in `_intern/audit-log.jsonl`. */
export async function logAudit(
  idb: IDBStore,
  ev: LogAuditInput,
): Promise<void> {
  const parent = await getSmbHandle(idb);
  if (!parent) return;
  const entry: AuditEntry = {
    ts: new Date().toISOString(),
    user: ev.user ?? 'dev-user',
    action: ev.action,
    ...(ev.details !== undefined ? { details: ev.details } : {}),
  };
  const line = JSON.stringify(entry);
  try {
    await getInternHandle(parent);
    await appendToFile(parent, AUDIT_LOG_PATH, line);
  } catch {
    /* _intern nicht beschreibbar — no-op. */
  }
}

/** Liest die letzten N Einträge (new path + Legacy-Anhang). */
export async function getRecentAudits(
  idb: IDBStore,
  n = 20,
): Promise<AuditEntry[]> {
  const parent = await getSmbHandle(idb);
  if (!parent) return [];
  const combined: string[] = [];
  // Legacy zuerst (ältere Einträge), dann Neu (jüngere) — Reihenfolge behalten.
  try {
    const programm = await getProgrammHandle(parent);
    const legacy = await readText(programm, LEGACY_AUDIT_LOG_PATH);
    if (legacy) combined.push(...legacy.split('\n'));
  } catch { /* kein legacy */ }
  const current = await readText(parent, AUDIT_LOG_PATH);
  if (current) combined.push(...current.split('\n'));
  const lines = combined.map(l => l.trim()).filter(Boolean);
  const last = lines.slice(-n);
  const out: AuditEntry[] = [];
  for (const line of last) {
    try {
      out.push(JSON.parse(line) as AuditEntry);
    } catch { /* ignore malformed */ }
  }
  return out;
}
