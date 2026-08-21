/**
 * Reiner Merge der eingesammelten Feedback-Kommentare in die zentrale
 * feedback.json (v2.199). Append-only: pro Outbox-Kommentar wird — falls die id
 * auf dem Ziel-Ticket noch nicht existiert — ein `FeedbackComment` ergaenzt.
 * Keine Retraktion (Kommentare werden nicht geloescht). Kein FS/Store →
 * unit-testbar. Spiegelbild von `mergeVotesIntoItems`, nur additiv.
 */
import type { FeedbackComment, FeedbackItem } from '@/core/types/feedback';
import type { CommentFile } from './feedbackCommentOutbox';

const ARTEN: readonly string[] = ['kommentar', 'ergaenzung', 'rueckfrage'];

function istArt(raw: unknown): raw is NonNullable<FeedbackComment['kind']> {
  return typeof raw === 'string' && ARTEN.includes(raw);
}

export interface MergeCommentsResult {
  items: FeedbackItem[];
  /** Neu ergaenzte Kommentare. */
  neu: number;
}

export function mergeCommentsIntoItems(
  items: readonly FeedbackItem[],
  batch: readonly CommentFile[],
): MergeCommentsResult {
  // ticketId → Liste neuer Kommentare (aus allen Dateien, dedup by id).
  const byTicket = new Map<string, Map<string, FeedbackComment>>();
  for (const file of batch) {
    if (!file || typeof file.kuerzel !== 'string' || !file.kuerzel) continue;
    for (const c of file.comments ?? []) {
      if (!c || typeof c.ticketId !== 'string' || typeof c.id !== 'string') continue;
      if (typeof c.text !== 'string' || !c.text.trim()) continue;
      let m = byTicket.get(c.ticketId);
      if (!m) { m = new Map<string, FeedbackComment>(); byTicket.set(c.ticketId, m); }
      if (!m.has(c.id)) {
        m.set(c.id, {
          id: c.id,
          user_id: file.kuerzel,
          user_display_name: file.kuerzel,
          text: c.text,
          created_at: typeof c.created_at === 'string' ? c.created_at : '',
          // Die Art überlebt den Outbox-Weg (v5.2). Whitelist genau hier:
          // Unbekanntes fällt still auf „gewöhnlicher Kommentar", statt eine
          // ganze eingesammelte Datei zu verwerfen.
          ...(istArt(c.kind) && c.kind !== 'kommentar' ? { kind: c.kind } : {}),
        });
      }
    }
  }

  let neu = 0;
  const nextItems: FeedbackItem[] = [];
  for (const item of items) {
    const incoming = byTicket.get(item.id);
    if (!incoming || incoming.size === 0) { nextItems.push(item); continue; }

    const existing = item.comments ?? [];
    const existingIds = new Set(existing.map(c => c.id));
    const toAdd = Array.from(incoming.values()).filter(c => !existingIds.has(c.id));
    if (toAdd.length === 0) { nextItems.push(item); continue; }

    neu += toAdd.length;
    const comments = [...existing, ...toAdd].sort((a, b) => a.created_at.localeCompare(b.created_at));
    nextItems.push({ ...item, comments });
  }

  return { items: nextItems, neu };
}
