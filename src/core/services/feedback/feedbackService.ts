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
import { submitFeedback as submitToOutbox } from '@/core/services/personal-storage';

// ── Public CRUD API ─────────────────────────────────────────────────────────

/**
 * Submission-Routing-Options.
 *
 * Maßgeblich ist `writeToShared` (Call-Site berechnet es über
 * `canWriteDatenShare(isKurator)` — Kurator ODER PL/dev via
 * `datenShareSchreibrecht`):
 * - `writeToShared: true` (Default wenn weggelassen) → schreibt direkt nach
 *   `_intern/feedback/feedback.json` (Daten-Share readwrite). Sofort für alle
 *   sichtbar.
 * - `writeToShared: false` + `persHandle` → schreibt in die Outbox auf dem
 *   persoenlichen Laufwerk; der Kurator sammelt im FeedbackInboxTab ein
 *   (read-only-Clients, z.B. prod-Enduser).
 * - `writeToShared: false` ohne `persHandle` → nur localStorage; Aufrufer sollte
 *   den Submit-Button vorher deaktivieren oder den User informieren.
 *
 * `isKurator` bleibt für Backward-Compat erhalten: fehlt `writeToShared`, wird
 * darauf zurückgefallen (Legacy-Caller wie FeedbackInboxTab `{isKurator:true}`).
 */
export interface SubmitFeedbackRouting {
  isKurator: boolean;
  writeToShared?: boolean;
  persHandle?: FileSystemDirectoryHandle | null;
  kuerzel?: string;
}

export async function submitFeedback(
  storage: StorageService,
  data: Omit<FeedbackItem, 'id' | 'kurator_status' | 'created_at'>,
  routing?: SubmitFeedbackRouting,
): Promise<FeedbackItem> {
  const item: FeedbackItem = {
    ...data,
    id: generateFeedbackId(),
    kurator_status: 'neu',
    created_at: new Date().toISOString(),
  };
  // Local (immer)
  const items = loadLocalItems();
  items.unshift(item);
  saveLocalItems(items);

  // Dispatch: writeToShared maßgeblich (Fallback auf isKurator für Legacy-Caller,
  // Default true wenn gar kein routing übergeben wird = pre-v2.0-Verhalten).
  const writeToShared = routing == null ? true : (routing.writeToShared ?? routing.isKurator);

  if (!writeToShared) {
    // User-Pfad (read-only Client): Outbox auf pers. Laufwerk, KEIN Shared-File-Write
    if (routing?.persHandle) {
      try {
        await submitToOutbox(routing.persHandle, routing.kuerzel ?? 'unbekannt', {
          id: item.id,
          kuerzel: routing.kuerzel ?? 'unbekannt',
          submitted_at: item.created_at,
          text: item.text,
          context: item.context,
        });
      } catch (err) {
        console.warn('[feedbackService] outbox write failed', err);
      }
    }
    emitFeedbackUpdated();
    return item;
  }

  // Shared-Pfad (Kurator / PL / dev): re-read + merge + atomicWrite. writeSharedFile
  // ist self-gated (no-op ohne readwrite), daher kein storage.fs-Check mehr nötig.
  const shared = await readSharedFile(storage);
  const merged = shared ? mergeItems([item], shared.items) : [item];
  await writeSharedFile(storage, merged);
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
  // Update shared (best-effort; writeSharedFile ist self-gated → no-op ohne readwrite)
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
  emitFeedbackUpdated();
}

export async function deleteFeedback(storage: StorageService, id: string): Promise<void> {
  const items = loadLocalItems().filter(i => i.id !== id);
  saveLocalItems(items);
  // writeSharedFile self-gated → no-op ohne readwrite
  const shared = await readSharedFile(storage);
  if (shared) {
    const remaining = shared.items.filter(i => i.id !== id);
    await writeSharedFile(storage, remaining);
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
  const shared = await readSharedFile(storage);
  if (!shared) return { path: FEEDBACK_SHARED_FILE, exists: false, itemCount: 0 };
  return {
    path: FEEDBACK_SHARED_FILE,
    exists: true,
    itemCount: shared.items.length,
    updatedAt: shared.updated_at,
  };
}
