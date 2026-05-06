/**
 * Helper + Type-Guard für FeedbackItem.classification.
 *
 * Siehe FeedbackClassification in src/core/types/feedback.ts für Hintergrund.
 * Ziel: Compiler zwingt UI-Code, den Pending-Fall (LLM noch nicht durch /
 * Streamlit-Transport / LLM-Fehler) explizit zu handhaben.
 */

import type {
  FeedbackCategory,
  FeedbackClassification,
  FeedbackItem,
} from '@/core/types/feedback';

/** Leitet den Klassifikations-Status aus dem optionalen `category`-Feld ab. */
export function getFeedbackClassification(item: FeedbackItem): FeedbackClassification {
  return item.category
    ? { state: 'classified', category: item.category }
    : { state: 'pending' };
}

/**
 * Type-Guard: schmälert FeedbackItem auf eine Variante mit garantiertem
 * `category`-Feld. Praktisch bei Filtern.
 *
 * Beispiel:
 * ```ts
 * const features = items.filter(isClassifiedAs('idea'));
 * // features hat den Typ FeedbackItem mit category === 'idea'
 * ```
 */
export function isClassifiedFeedback(
  item: FeedbackItem,
): item is FeedbackItem & { category: FeedbackCategory } {
  return item.category !== undefined;
}

/**
 * Currying-Variante für Array.filter — schließt alle Pending- und nicht-passenden
 * Tickets aus. Liest sich an Aufrufstelle als Domain-Filter, nicht als
 * `=== 'idea'`-Vergleich der Pending übersieht.
 */
export function isClassifiedAs(category: FeedbackCategory) {
  return (item: FeedbackItem): item is FeedbackItem & { category: FeedbackCategory } =>
    item.category === category;
}
