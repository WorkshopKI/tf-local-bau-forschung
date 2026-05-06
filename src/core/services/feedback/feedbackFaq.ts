/**
 * FAQ-Funktionen: Token-basiertes Matching (Stoppwörter), manuelles Anlegen,
 * Ask-Count-Bumping.
 *
 * Importiert lediglich die Lokal-IO + Shared-File-IO Helper aus den Sibling-
 * Modulen — keine eigene Sync-Logik.
 */

import type { StorageService } from '@/core/services/storage';
import type { FeedbackItem } from '@/core/types/feedback';
import {
  emitFeedbackUpdated,
  generateFeedbackId,
  loadLocalItems,
  saveLocalItems,
} from './feedbackStorage';
import { mergeItems, readSharedFile, writeSharedFile } from './feedbackSharedFile';
import { updateFeedback } from './feedbackService';

const STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'eines',
  'ist', 'sind', 'war', 'waren', 'wird', 'werden', 'wurde', 'wurden',
  'kann', 'können', 'könnte', 'soll', 'sollte', 'muss', 'müssen',
  'wie', 'was', 'wer', 'wo', 'wann', 'warum', 'wieso', 'welche', 'welcher', 'welches',
  'und', 'oder', 'aber', 'doch', 'sondern',
  'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'mich', 'mir', 'dir',
  'mit', 'für', 'auf', 'in', 'an', 'zu', 'von', 'bei', 'aus', 'nach', 'um', 'über',
  'nicht', 'kein', 'keine',
  'mal', 'auch', 'noch', 'schon',
  'the', 'a', 'an', 'is', 'are', 'how', 'what', 'and', 'or',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}

export function matchFaqEntries(
  input: string,
  faqs: FeedbackItem[],
): Array<{ item: FeedbackItem; score: number }> {
  const inputTokens = new Set(tokenize(input));
  if (inputTokens.size === 0) return [];
  const matches: Array<{ item: FeedbackItem; score: number }> = [];
  for (const faq of faqs) {
    if (!faq.is_faq) continue;
    const summary = faq.llm_summary ?? faq.text ?? '';
    const candidateTokens = new Set([
      ...tokenize(summary),
      ...(faq.faq_keywords ?? []).flatMap(k => tokenize(k)),
    ]);
    let score = 0;
    for (const t of inputTokens) if (candidateTokens.has(t)) score++;
    if (score >= 2) matches.push({ item: faq, score });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, 4);
}

export async function createStandaloneFaq(
  storage: StorageService,
  data: { summary: string; answer: string; keywords?: string[] },
): Promise<FeedbackItem> {
  const item: FeedbackItem = {
    id: generateFeedbackId(),
    created_at: new Date().toISOString(),
    user_id: 'kurator',
    user_display_name: 'Kurator',
    category: 'question',
    text: data.summary,
    context: {
      route: 'kuration',
      page: 'Kurator (manuell)',
      device: 'Desktop',
      viewport: '0x0',
      sessionDuration: 0,
      errors: [],
      timestamp: new Date().toISOString(),
    },
    llm_summary: data.summary,
    kurator_status: 'umgesetzt',
    is_faq: true,
    faq_answer: data.answer,
    faq_keywords: data.keywords,
    faq_ask_count: 0,
  };
  const items = loadLocalItems();
  items.unshift(item);
  saveLocalItems(items);
  if (storage.fs && !storage.fs.isReadOnly()) {
    const shared = await readSharedFile(storage);
    const merged = shared ? mergeItems([item], shared.items) : [item];
    await writeSharedFile(storage, merged);
  }
  emitFeedbackUpdated();
  return item;
}

export async function bumpFaqAskCount(storage: StorageService, faqId: string): Promise<void> {
  const items = loadLocalItems();
  const local = items.find(i => i.id === faqId);
  const shared = await readSharedFile(storage);
  const sharedItem = shared?.items.find(i => i.id === faqId);
  const current = (sharedItem?.faq_ask_count ?? local?.faq_ask_count ?? 0) + 1;
  await updateFeedback(storage, faqId, { faq_ask_count: current });
}
