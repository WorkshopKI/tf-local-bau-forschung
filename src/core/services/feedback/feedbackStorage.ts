/**
 * Lokal-Storage für Feedback-Items: lädt/speichert via localStorage,
 * migriert Legacy admin_*-Felder beim Lesen.
 *
 * Keine Shared-File-, Sync- oder Sponsoring-Logik — die liegt in den
 * Sibling-Modulen feedbackSharedFile.ts / feedbackSponsoring.ts.
 */

import { FEEDBACK_LS_KEY } from '@/core/types/feedback';
import type { FeedbackItem } from '@/core/types/feedback';

/** Legacy-Migration: alte Items mit admin_* → kurator_* normalisieren. Read-only transformation. */
export function normalizeLegacyFields(item: FeedbackItem): FeedbackItem {
  // Wenn kurator_status bereits gesetzt: keine Migration nötig.
  if (item.kurator_status) {
    return item;
  }
  return {
    ...item,
    kurator_status: item.admin_status ?? 'neu',
    kurator_priority: item.kurator_priority ?? item.admin_priority,
    kurator_notes: item.kurator_notes ?? item.admin_notes,
  };
}

export function loadLocalItems(): FeedbackItem[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as FeedbackItem[]).map(normalizeLegacyFields);
  } catch {
    return [];
  }
}

export function saveLocalItems(items: FeedbackItem[]): void {
  try {
    localStorage.setItem(FEEDBACK_LS_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('[feedbackStorage] localStorage write failed:', err);
  }
}

export function generateFeedbackId(): string {
  return `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Benachrichtigt UI-Listen über Änderungen an Feedback-Daten (CustomEvent für live-refresh). */
export function emitFeedbackUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('feedback-updated'));
  }
}
