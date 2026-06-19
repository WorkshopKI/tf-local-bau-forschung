/**
 * Schreibschicht (pro-Nutzer-Append). Jedes Event wird ZUERST durch den
 * DSGVO-Guard gesäubert (Whitelist) und dann als eine JSONL-Zeile an die EIGENE
 * Nutzer-Datei angehängt. Schreibbarkeit wird über die Handle-Permission erkannt
 * (nicht über React-State): ist das gemeinsame Verzeichnis nicht beschreibbar
 * (read-only Share / kein Handle / Schreibfehler), greift der Fallback auf die
 * persönliche Ablage — **kein Throw** (Telemetrie darf nie eine UI-Aktion kippen).
 */
import type { StorageService } from '@/core/services/storage';
import { appendToFile } from '@/core/services/infrastructure/atomic-write';
import {
  getDatenShareHandle,
  getPersoenlichHandle,
  queryPermission,
} from '@/core/services/infrastructure/smb-handle';
import { invalidateAggregateCache } from './cache';
import { sanitizeFeedbackEvent, sanitizeUsageEvent } from './guard';
import { personalSignalPath, sharedSignalPath, type SignalKind } from './layout';
import type { FeedbackEvent, SkillSignalEvent, UsageEvent } from './types';

/** Wohin das Event tatsächlich geschrieben wurde. */
export type WriteTarget = 'share' | 'personal' | 'none';

export interface WriteResult {
  ziel: WriteTarget;
}

async function tryAppend(
  dir: FileSystemDirectoryHandle,
  path: string,
  clean: SkillSignalEvent,
): Promise<boolean> {
  try {
    await appendToFile(dir, path, JSON.stringify(clean));
    return true;
  } catch (err) {
    console.warn('[skill-feedback] append failed:', path, err);
    return false;
  }
}

/**
 * Hängt ein bereits gesäubertes Event an. Reihenfolge: gemeinsames Verzeichnis
 * (nur wenn `queryPermission === 'granted'`), sonst persönliche Ablage. Bei
 * Erfolg wird der Aggregat-Cache invalidiert.
 */
async function appendSignal(
  storage: StorageService,
  kind: SignalKind,
  clean: SkillSignalEvent,
): Promise<WriteResult> {
  // 1. Gemeinsames Verzeichnis — nur bei echtem Schreibrecht.
  const shareDir = await getDatenShareHandle(storage.idb);
  if (shareDir) {
    let granted = false;
    try {
      granted = (await queryPermission(shareDir)) === 'granted';
    } catch {
      granted = false;
    }
    if (granted && (await tryAppend(shareDir, sharedSignalPath(kind, clean.userId), clean))) {
      await invalidateAggregateCache(storage.idb);
      return { ziel: 'share' };
    }
  }
  // 2. Degradationspfad — persönliche Ablage (immer schreibbar, wenn Handle da).
  const persDir = await getPersoenlichHandle(storage.idb);
  if (persDir && (await tryAppend(persDir, personalSignalPath(kind, clean.userId), clean))) {
    await invalidateAggregateCache(storage.idb);
    return { ziel: 'personal' };
  }
  return { ziel: 'none' };
}

/** Schreibt ein 👍/👎-Feedback. Ungültiges Event → `{ ziel: 'none' }` (verworfen). */
export async function appendFeedback(storage: StorageService, ev: unknown): Promise<WriteResult> {
  const clean: FeedbackEvent | null = sanitizeFeedbackEvent(ev);
  if (!clean) return { ziel: 'none' };
  return appendSignal(storage, 'feedback', clean);
}

/** Schreibt ein Nutzungs-Event (`event: 'lauf'`). Ungültig → `{ ziel: 'none' }`. */
export async function appendUsage(storage: StorageService, ev: unknown): Promise<WriteResult> {
  const clean: UsageEvent | null = sanitizeUsageEvent(ev);
  if (!clean) return { ziel: 'none' };
  return appendSignal(storage, 'usage', clean);
}
