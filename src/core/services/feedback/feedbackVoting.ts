/**
 * Leichte Feedback-Votes (Likes) — budgetfrei, eine Stimme je Nutzer je Feedback
 * (v2.199 Redesign). Getrennt vom budget-gebundenen Sponsoring
 * (`feedbackSponsoring.ts`), aber nach demselben Persistenz-Muster:
 *  - Re-Read shared + `mergeItems` (Union zieht die eigene lokale Stimme mit ein),
 *  - Shared-Write self-gated (`writeSharedFile`) → no-op fuer read-only prod,
 *  - Fallback: eigene Stimme in die persoenliche Outbox spiegeln
 *    (`vote-wuensche.json`), der Kurator sammelt sie ein.
 * Anti-Stale-Regel (wie Sponsoren): lokal wird NUR die eigene Stimme gespeichert.
 */
import type { StorageService } from '@/core/services/storage';
import type { FeedbackItem, FeedbackVote } from '@/core/types/feedback';
import { getPersoenlichHandle } from '@/core/services/infrastructure/smb-handle';
import {
  emitFeedbackUpdated,
  loadLocalItems,
  saveLocalItems,
} from './feedbackStorage';
import { mergeItems, readSharedFileLage, writeSharedFile } from './feedbackSharedFile';
import { loadFeedbackVotes, writeFeedbackVotes, type VoteFile } from './feedbackVoteOutbox';

export interface VoteResult {
  ok: boolean;
  /** Zustand NACH dem Toggle: hat der Nutzer jetzt gevotet? */
  voted: boolean;
  error?: 'invalid' | 'share_unreadable';
  /** Nicht-fatal: Stimme lokal/IDB gesichert, aber persoenlicher Ordner fehlt
   *  (read-only prod → Kurator kann nicht einsammeln). */
  warning?: 'no_personal_folder';
}

/**
 * Toggelt die eigene Stimme fuer ein Feedback. Hat der Nutzer bereits gevotet,
 * wird die Stimme entfernt, sonst hinzugefuegt. `userDisplayName` nur fuer die
 * Anzeige (Avatar/Autor); die Identitaet ist `userId`.
 */
export async function toggleVote(
  storage: StorageService,
  ticketId: string,
  userId: string,
  userDisplayName?: string,
): Promise<VoteResult> {
  if (!ticketId || !userId) return { ok: false, voted: false, error: 'invalid' };

  // Unlesbarer geteilter Stand → abbrechen statt auf einer leeren Basis zu
  // rechnen (dieselbe Regel wie in addComment, siehe readSharedFileLage).
  const lage = await readSharedFileLage(storage);
  if (lage.status === 'unlesbar') return { ok: false, voted: false, error: 'share_unreadable' };
  const shared = lage.status === 'ok' ? lage.datei : null;
  const localItems = loadLocalItems();
  const merged = shared ? mergeItems(localItems, shared.items) : localItems;
  const target = merged.find(i => i.id === ticketId);
  if (!target) return { ok: false, voted: false, error: 'invalid' };

  const votesBefore = target.votes ?? [];
  const alreadyVoted = votesBefore.some(v => v.user_id === userId);
  const newVotes: FeedbackVote[] = alreadyVoted
    ? votesBefore.filter(v => v.user_id !== userId)
    : [
        ...votesBefore,
        { user_id: userId, user_display_name: userDisplayName, created_at: new Date().toISOString() },
      ];
  const nowVoted = !alreadyVoted;

  // Lokal NUR die eigene Stimme (Anti-Stale-Regel fuer mergeItems).
  saveOwnVoteLocally(localItems, ticketId, target, userId, newVotes);

  // Shared schreiben (self-gated → no-op fuer read-only prod).
  const writeOk = await writeSharedFile(
    storage,
    merged.map(i => (i.id === ticketId ? { ...i, votes: newVotes } : i)),
  );

  let warning: VoteResult['warning'];
  if (!writeOk) {
    const persisted = await writeVoteToOutbox(storage, ticketId, userId, nowVoted);
    if (!persisted) warning = 'no_personal_folder';
  }

  emitFeedbackUpdated();
  return { ok: true, voted: nowVoted, warning };
}

/** Speichert lokal NUR die eigene Stimme des Users (Anti-Stale-Regel). */
function saveOwnVoteLocally(
  localItems: FeedbackItem[],
  ticketId: string,
  mergedTarget: FeedbackItem,
  userId: string,
  newVotes: readonly FeedbackVote[],
): void {
  const own = newVotes.filter(v => v.user_id === userId);
  const idx = localItems.findIndex(i => i.id === ticketId);
  if (idx >= 0) {
    const t = localItems[idx];
    if (t) localItems[idx] = { ...t, votes: own };
  } else {
    localItems.unshift({ ...mergedTarget, votes: own });
  }
  saveLocalItems(localItems);
}

/**
 * Spiegelt die eigene Stimme in die persoenliche Vote-Outbox
 * (`vote-wuensche.json`) — der Weg fuer read-only prod-User. `voted===false` =
 * Retraktion (ticketId wird entfernt). Gibt zurueck, ob die Datei wirklich im
 * persoenlichen Ordner landete (sonst nur IDB-Cache → `warning`).
 */
async function writeVoteToOutbox(
  storage: StorageService,
  ticketId: string,
  userId: string,
  voted: boolean,
): Promise<boolean> {
  const persHandle = await getPersoenlichHandle(storage.idb);
  const current = await loadFeedbackVotes(storage.idb, persHandle);
  const set = new Set(current?.ticketIds ?? []);
  if (voted) set.add(ticketId);
  else set.delete(ticketId);
  const data: VoteFile = {
    version: 1,
    kuerzel: userId,
    ticketIds: Array.from(set),
    updatedAt: new Date().toISOString(),
  };
  return writeFeedbackVotes(storage.idb, persHandle, data);
}
