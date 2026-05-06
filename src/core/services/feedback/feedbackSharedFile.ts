/**
 * Shared-File-IO für Feedback (Multi-User-Sync).
 *
 * Liest / schreibt `_intern/feedback/feedback.json` auf dem Daten-Share.
 * Konflikt-Strategie (Sektion R4): Merge-by-id mit Field-Precedence —
 * User-Felder lokal-wins, Kurator-/FAQ-/Sponsoring-Felder shared-wins.
 *
 * No-op wenn fs nicht verbunden (z.B. dev ohne Share oder read-only-FS).
 */

import type { StorageService } from '@/core/services/storage';
import {
  FEEDBACK_DATA_DIR,
  FEEDBACK_SHARED_FILE,
} from '@/core/types/feedback';
import type { FeedbackItem, SharedFeedbackFile } from '@/core/types/feedback';
import { normalizeLegacyFields } from './feedbackStorage';

export async function readSharedFile(storage: StorageService): Promise<SharedFeedbackFile | null> {
  if (!storage.fs) return null;
  try {
    const exists = await storage.fs.exists(FEEDBACK_SHARED_FILE);
    if (!exists) return null;
    const data = await storage.fs.readJSON<SharedFeedbackFile>(FEEDBACK_SHARED_FILE);
    if (!data || data.version !== 1 || !Array.isArray(data.items)) return null;
    return { ...data, items: data.items.map(normalizeLegacyFields) };
  } catch (err) {
    console.warn('[feedbackSharedFile] readSharedFile failed:', err);
    return null;
  }
}

export async function writeSharedFile(
  storage: StorageService,
  items: FeedbackItem[],
): Promise<boolean> {
  if (!storage.fs || storage.fs.isReadOnly()) return false;
  try {
    await storage.fs.ensureDir(FEEDBACK_DATA_DIR);
    const payload: SharedFeedbackFile = {
      version: 1,
      updated_at: new Date().toISOString(),
      items,
    };
    await storage.fs.writeJSON(FEEDBACK_SHARED_FILE, payload);
    return true;
  } catch (err) {
    console.error('[feedbackSharedFile] writeSharedFile failed:', err);
    return false;
  }
}

/** Merge-Strategie: bei Duplikat-IDs wins shared für Kurator-Felder, lokal für User-Felder. */
export function mergeItems(local: FeedbackItem[], shared: FeedbackItem[]): FeedbackItem[] {
  const byId = new Map<string, FeedbackItem>();
  for (const item of shared) byId.set(item.id, item);
  for (const local_item of local) {
    const sharedItem = byId.get(local_item.id);
    if (!sharedItem) {
      byId.set(local_item.id, local_item);
      continue;
    }
    // Merge: User-Felder aus local, Kurator/FAQ-Felder aus shared
    byId.set(local_item.id, {
      ...sharedItem,
      // User-fields override (User edits these locally first)
      text: local_item.text,
      stars: local_item.stars,
      context: local_item.context,
      llm_summary: local_item.llm_summary ?? sharedItem.llm_summary,
      llm_classification: local_item.llm_classification ?? sharedItem.llm_classification,
      user_confirmed: local_item.user_confirmed ?? sharedItem.user_confirmed,
    });
  }
  return Array.from(byId.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
