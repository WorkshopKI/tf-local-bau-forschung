/**
 * Reiner Merge der eingesammelten Feedback-Votes (Likes) in die zentrale
 * feedback.json (v2.199). Spiegelbild von `mergeSponsorVotesIntoItems` — kein FS,
 * kein Store → komplett unit-testbar.
 *
 * Pro Vote-Datei eines Users (`kuerzel` + Liste `ticketId[]`) wird die Stimme
 * dieses Users auf den genannten Tickets gesetzt und auf allen anderen entfernt
 * (Retraktion). Nur `kuerzel`, deren Datei in DIESEM Batch gelesen wurde, werden
 * reconciled — fremde Stimmen bleiben unangetastet, User OHNE Datei im Batch
 * ebenfalls (kein versehentliches Loeschen).
 */
import type { FeedbackItem, FeedbackVote } from '@/core/types/feedback';
import type { VoteFile } from './feedbackVoteOutbox';

export interface MergeVotesResult {
  items: FeedbackItem[];
  /** Neu hinzugefuegte Stimmen. */
  neu: number;
  /** Entfernte Stimmen (Retraktion). */
  entfernt: number;
}

interface Wanted { ts: string }

export function mergeVotesIntoItems(
  items: readonly FeedbackItem[],
  batch: readonly VoteFile[],
): MergeVotesResult {
  const collectedKuerzels = new Set<string>();
  // ticketId → (kuerzel → Zeitstempel der Datei)
  const desired = new Map<string, Map<string, Wanted>>();

  for (const file of batch) {
    if (!file || typeof file.kuerzel !== 'string' || !file.kuerzel) continue;
    const kuerzel = file.kuerzel;
    collectedKuerzels.add(kuerzel);
    const ts = typeof file.updatedAt === 'string' ? file.updatedAt : '';
    for (const ticketId of file.ticketIds ?? []) {
      if (typeof ticketId !== 'string' || !ticketId) continue;
      let m = desired.get(ticketId);
      if (!m) { m = new Map<string, Wanted>(); desired.set(ticketId, m); }
      m.set(kuerzel, { ts });
    }
  }

  let neu = 0;
  let entfernt = 0;
  const nextItems: FeedbackItem[] = [];

  for (const item of items) {
    const wanted = desired.get(item.id);
    const votes = item.votes ?? [];
    const hasCollectedExisting = votes.some(v => collectedKuerzels.has(v.user_id));
    if (!wanted && !hasCollectedExisting) { nextItems.push(item); continue; }

    let itemChanged = false;
    const nextVotes: FeedbackVote[] = [];
    const seen = new Set<string>();

    for (const v of votes) {
      // Fremde (nicht im Batch gelesene) Stimmen unangetastet.
      if (!collectedKuerzels.has(v.user_id)) { nextVotes.push(v); continue; }
      seen.add(v.user_id);
      if (wanted?.has(v.user_id)) {
        nextVotes.push(v); // Stimme bleibt bestehen
      } else {
        entfernt++; itemChanged = true; // Retraktion
      }
    }

    // Brandneue Stimmen gelesener User ohne bisherigen Eintrag.
    if (wanted) {
      for (const [kuerzel, w] of wanted) {
        if (seen.has(kuerzel)) continue;
        nextVotes.push({ user_id: kuerzel, user_display_name: kuerzel, created_at: w.ts });
        neu++;
        itemChanged = true;
      }
    }

    if (!itemChanged) { nextItems.push(item); continue; }
    nextItems.push({ ...item, votes: nextVotes });
  }

  return { items: nextItems, neu, entfernt };
}
