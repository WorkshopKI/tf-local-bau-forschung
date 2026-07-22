/**
 * Lokal-Storage für Feedback-Items: lädt/speichert via localStorage,
 * migriert Legacy admin_*-Felder + die entfallene UX-Kategorie beim Lesen.
 *
 * Keine Shared-File-, Sync- oder Sponsoring-Logik — die liegt in den
 * Sibling-Modulen feedbackSharedFile.ts / feedbackSponsoring.ts.
 */

import { FEEDBACK_LS_KEY } from '@/core/types/feedback';
import type { FeedbackItem } from '@/core/types/feedback';

/**
 * Kategorie 'ux' ist mit v2.289 entfallen (ging in 'idea' auf). Bestands-Tickets
 * werden beim LESEN normalisiert — nicht-destruktiv: die geteilte feedback.json
 * heilt sich, sobald ein Ticket ohnehin geschrieben wird.
 *
 * Die structured-Keys wandern mit, sonst verlieren Titel (`PRIMARY_FIELD_KEY`)
 * und Listen-Vorschau (`feedbackQaSegments`) ihren Inhalt:
 *   pain   ("Was ist gerade umständlich?")  → goal ("Was möchtest du tun können?")
 *   better ("Was würde es leichter machen?") → idea ("Wie stellst du es dir vor?")
 */
function migrateUxCategory(item: FeedbackItem): FeedbackItem {
  if ((item.category as string) !== 'ux') return item;
  const migrated: FeedbackItem = { ...item, category: 'idea' };
  const s = item.structured;
  if (s) {
    const next = { ...s };
    if (!next.goal?.trim() && s.pain?.trim()) next.goal = s.pain;
    if (!next.idea?.trim() && s.better?.trim()) next.idea = s.better;
    delete next.pain;
    delete next.better;
    migrated.structured = next;
  }
  return migrated;
}

/**
 * Legacy-Migration beim Lesen (read-only transformation):
 *  - alte Items mit admin_* → kurator_*,
 *  - entfallene Kategorie 'ux' → 'idea' (siehe migrateUxCategory).
 * Ohne Migrationsbedarf wird das Item referenzgleich zurückgegeben.
 */
export function normalizeLegacyFields(item: FeedbackItem): FeedbackItem {
  const base = migrateUxCategory(item);
  // Wenn kurator_status bereits gesetzt: keine Status-Migration nötig.
  if (base.kurator_status) {
    return base;
  }
  return {
    ...base,
    kurator_status: base.admin_status ?? 'neu',
    kurator_priority: base.kurator_priority ?? base.admin_priority,
    kurator_notes: base.kurator_notes ?? base.admin_notes,
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
