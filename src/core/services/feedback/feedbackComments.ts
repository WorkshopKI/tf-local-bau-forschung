/**
 * Feedback-Kommentar-Thread (v2.199 Redesign) — append-only. Distinkt von der
 * einen hervorgehobenen `kurator_response` („Antwort vom Team"). Persistenz nach
 * demselben Muster wie Votes/Sponsoring:
 *  - Re-Read shared + `mergeItems` (Union-by-id zieht eigene lokale Kommentare mit),
 *  - Shared-Write self-gated → no-op fuer read-only prod,
 *  - Fallback: Kommentar in die persoenliche Outbox spiegeln
 *    (`kommentar-outbox.json`), der Kurator sammelt ein.
 */
import type { StorageService } from '@/core/services/storage';
import type { FeedbackComment, FeedbackItem } from '@/core/types/feedback';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import {
  emitFeedbackUpdated,
  loadLocalItems,
  saveLocalItems,
} from './feedbackStorage';
import { mergeItems, readSharedFileLage, writeSharedFile } from './feedbackSharedFile';
import {
  loadFeedbackComments,
  writeFeedbackComments,
  type CommentFile,
} from './feedbackCommentOutbox';

export interface AddCommentResult {
  ok: boolean;
  comment?: FeedbackComment;
  /** `share_unreadable`: der geteilte Stand war nicht lesbar — nichts geschrieben,
   *  der Nutzer muss es erneut versuchen (Text bleibt stehen). */
  error?: 'invalid' | 'share_unreadable';
  warning?: 'no_personal_folder';
}

function generateCommentId(): string {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Fuegt einen Kommentar an den Thread eines Feedbacks an. */
export async function addComment(
  storage: StorageService,
  ticketId: string,
  userId: string,
  text: string,
  userDisplayName?: string,
): Promise<AddCommentResult> {
  const trimmed = text.trim();
  if (!ticketId || !userId || !trimmed) return { ok: false, error: 'invalid' };

  // Auf einem UNLESBAREN geteilten Stand darf hier nichts weiterlaufen: die
  // Tickets schreibender Rollen stehen nur dort, das Ticket wäre also „nicht
  // gefunden" und der Kommentar wortlos verworfen — und ein Schreiben würde den
  // geteilten Bestand auf den lokalen Teilbestand eindampfen.
  const lage = await readSharedFileLage(storage);
  if (lage.status === 'unlesbar') return { ok: false, error: 'share_unreadable' };
  const shared = lage.status === 'ok' ? lage.datei : null;
  const localItems = loadLocalItems();
  const merged = shared ? mergeItems(localItems, shared.items) : localItems;
  const target = merged.find(i => i.id === ticketId);
  if (!target) return { ok: false, error: 'invalid' };

  const comment: FeedbackComment = {
    id: generateCommentId(),
    user_id: userId,
    user_display_name: userDisplayName,
    text: trimmed,
    created_at: new Date().toISOString(),
  };
  const newComments = [...(target.comments ?? []), comment];

  // Lokal NUR die eigenen Kommentare (klein halten; Union-by-id dedupt ohnehin).
  saveOwnCommentsLocally(localItems, ticketId, target, userId, newComments);

  const writeOk = await writeSharedFile(
    storage,
    merged.map(i => (i.id === ticketId ? { ...i, comments: newComments } : i)),
  );

  let warning: AddCommentResult['warning'];
  if (!writeOk) {
    const persisted = await appendCommentToOutbox(storage, ticketId, userId, comment);
    if (!persisted) warning = 'no_personal_folder';
  }

  emitFeedbackUpdated();
  return { ok: true, comment, warning };
}

function saveOwnCommentsLocally(
  localItems: FeedbackItem[],
  ticketId: string,
  mergedTarget: FeedbackItem,
  userId: string,
  newComments: readonly FeedbackComment[],
): void {
  const own = newComments.filter(c => c.user_id === userId);
  const idx = localItems.findIndex(i => i.id === ticketId);
  if (idx >= 0) {
    const t = localItems[idx];
    if (t) localItems[idx] = { ...t, comments: own };
  } else {
    localItems.unshift({ ...mergedTarget, comments: own });
  }
  saveLocalItems(localItems);
}

/**
 * Haengt einen Kommentar an die persoenliche Kommentar-Outbox an (read-only prod).
 * Append-only: bestehende Eintraege bleiben, der neue kommt dazu (dedup by id).
 */
async function appendCommentToOutbox(
  storage: StorageService,
  ticketId: string,
  userId: string,
  comment: FeedbackComment,
): Promise<boolean> {
  const persHandle = await getPersoenlichHandle(storage.idb);
  const current = await loadFeedbackComments(storage.idb, persHandle);
  const existing = current?.comments ?? [];
  if (existing.some(c => c.id === comment.id)) return true; // schon drin
  const data: CommentFile = {
    version: 1,
    kuerzel: userId,
    comments: [...existing, { ticketId, id: comment.id, text: comment.text, created_at: comment.created_at }],
    updatedAt: new Date().toISOString(),
  };
  return writeFeedbackComments(storage.idb, persHandle, data);
}
