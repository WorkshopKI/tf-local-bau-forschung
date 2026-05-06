/**
 * Feedback-CRUD-Facade: localStorage primär + Shared-JSON Sync.
 *
 * Diese Datei hält nur noch die Public-CRUD-API + Config + Status-Probe.
 * Domain-spezifische Logik liegt in den Sibling-Modulen:
 *  - feedbackStorage.ts        — Lokal-IO
 *  - feedbackSharedFile.ts     — Shared-File-IO + Merge-Strategie
 *  - feedbackFaq.ts            — FAQ-Matching + manuelle FAQ-Items
 *  - feedbackSponsoring.ts     — Phase 3 Sponsoring
 *  - feedbackClassification.ts — Discriminator-Helper für category-Status
 *
 * Konflikt-Strategie (Sektion R4) ist in feedbackSharedFile.mergeItems
 * implementiert — User-Felder lokal-wins, Kurator-/FAQ-/Sponsoring-Felder
 * shared-wins.
 */

import type { StorageService } from '@/core/services/storage';
import {
  DEFAULT_FEEDBACK_CONFIG,
  FEEDBACK_CONFIG_LS_KEY,
  FEEDBACK_SHARED_FILE,
} from '@/core/types/feedback';
import type {
  FeedbackConfig,
  FeedbackFilters,
  FeedbackItem,
} from '@/core/types/feedback';
import {
  emitFeedbackUpdated,
  generateFeedbackId,
  loadLocalItems,
  saveLocalItems,
} from './feedbackStorage';
import {
  mergeItems,
  readSharedFile,
  writeSharedFile,
} from './feedbackSharedFile';

// ── Public CRUD API ─────────────────────────────────────────────────────────

export async function submitFeedback(
  storage: StorageService,
  data: Omit<FeedbackItem, 'id' | 'kurator_status' | 'created_at'>,
): Promise<FeedbackItem> {
  const item: FeedbackItem = {
    ...data,
    id: generateFeedbackId(),
    kurator_status: 'neu',
    created_at: new Date().toISOString(),
  };
  // Local
  const items = loadLocalItems();
  items.unshift(item);
  saveLocalItems(items);
  // Shared (best-effort: re-read + merge + write)
  const shared = await readSharedFile(storage);
  if (shared) {
    const merged = mergeItems([item], shared.items);
    await writeSharedFile(storage, merged);
  } else if (storage.fs && !storage.fs.isReadOnly()) {
    await writeSharedFile(storage, [item]);
  }
  emitFeedbackUpdated();
  return item;
}

export async function getFeedbackList(
  storage: StorageService,
  filters?: FeedbackFilters,
): Promise<FeedbackItem[]> {
  const local = loadLocalItems();
  const shared = await readSharedFile(storage);
  const merged = shared
    ? mergeItems(local, shared.items)
    : local.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (!filters) return merged;
  return merged.filter(item => {
    if (filters.category && item.category !== filters.category) return false;
    if (filters.status && item.kurator_status !== filters.status) return false;
    if (filters.priority !== undefined && item.kurator_priority !== filters.priority) return false;
    return true;
  });
}

export async function getMyFeedback(storage: StorageService, userId: string): Promise<FeedbackItem[]> {
  const all = await getFeedbackList(storage);
  return all.filter(item => item.user_id === userId);
}

export async function updateFeedback(
  storage: StorageService,
  id: string,
  updates: Partial<Pick<
    FeedbackItem,
    'kurator_status' | 'kurator_notes' | 'kurator_priority' | 'generated_prompt'
    | 'category'
    | 'llm_summary' | 'llm_classification' | 'user_confirmed'
    | 'is_faq' | 'faq_answer' | 'faq_keywords' | 'faq_ask_count'
    | 'effort_estimate' | 'effort_hours'
  >>,
): Promise<void> {
  // Update local
  const items = loadLocalItems();
  const idx = items.findIndex(i => i.id === id);
  const localItem = idx >= 0 ? items[idx] : undefined;
  if (idx >= 0 && localItem) {
    items[idx] = { ...localItem, ...updates };
    saveLocalItems(items);
  }
  // Update shared (best-effort, nur wenn fs verbunden und schreibbar)
  if (storage.fs && !storage.fs.isReadOnly()) {
    const shared = await readSharedFile(storage);
    if (shared) {
      const sharedIdx = shared.items.findIndex(i => i.id === id);
      const sharedItem = sharedIdx >= 0 ? shared.items[sharedIdx] : undefined;
      if (sharedIdx >= 0 && sharedItem) {
        shared.items[sharedIdx] = { ...sharedItem, ...updates };
      } else if (localItem) {
        shared.items.unshift({ ...localItem, ...updates });
      }
      await writeSharedFile(storage, shared.items);
    } else if (localItem) {
      await writeSharedFile(storage, [{ ...localItem, ...updates }]);
    }
  }
  emitFeedbackUpdated();
}

export async function deleteFeedback(storage: StorageService, id: string): Promise<void> {
  const items = loadLocalItems().filter(i => i.id !== id);
  saveLocalItems(items);
  if (storage.fs && !storage.fs.isReadOnly()) {
    const shared = await readSharedFile(storage);
    if (shared) {
      const remaining = shared.items.filter(i => i.id !== id);
      await writeSharedFile(storage, remaining);
    }
  }
  emitFeedbackUpdated();
}

// ── Config ──────────────────────────────────────────────────────────────────

export async function loadFeedbackConfig(_storage: StorageService): Promise<FeedbackConfig> {
  try {
    const raw = localStorage.getItem(FEEDBACK_CONFIG_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FeedbackConfig>;
      return { ...DEFAULT_FEEDBACK_CONFIG, ...parsed };
    }
  } catch { /* ignore */ }
  return DEFAULT_FEEDBACK_CONFIG;
}

export async function saveFeedbackConfig(_storage: StorageService, cfg: FeedbackConfig): Promise<void> {
  try {
    localStorage.setItem(FEEDBACK_CONFIG_LS_KEY, JSON.stringify(cfg));
  } catch (err) {
    console.error('[feedbackService] saveFeedbackConfig failed:', err);
  }
}

export async function getSharedFileStatus(
  storage: StorageService,
): Promise<{ path: string; exists: boolean; itemCount: number; updatedAt?: string }> {
  if (!storage.fs) return { path: FEEDBACK_SHARED_FILE, exists: false, itemCount: 0 };
  const shared = await readSharedFile(storage);
  if (!shared) return { path: FEEDBACK_SHARED_FILE, exists: false, itemCount: 0 };
  return {
    path: FEEDBACK_SHARED_FILE,
    exists: true,
    itemCount: shared.items.length,
    updatedAt: shared.updated_at,
  };
}
