/**
 * Feedback-Kommentare im persoenlichen Ordner (v2.199 Redesign).
 *
 * Read-only prod-Enduser koennen `_intern/feedback/feedback.json` nicht
 * schreiben. Ihre Kommentare landen deshalb hier in
 * `ZAH/feedback/kommentar-outbox.json` (append-only Liste); der Kurator sammelt
 * sie ueber den User-Folders-Root ein (`autoCollectFeedbackComments`) und merged
 * sie in die zentrale feedback.json (`mergeCommentsIntoItems`, Union-by-id).
 * Spiegelbild von `feedbackVoteOutbox.ts`, nur append-only (keine Retraktion).
 *
 * Cross-Browser-Strategie: Schreiben IMMER IDB-Cache + persoenlicher Ordner (wenn
 * Handle da); Lesen persoenlicher Ordner → IDB → null. LWW ueber `updatedAt`.
 *
 * Sidecar-Profil (Pitfall #23): idempotent-overwrite / Single-Source pro User →
 * `atomicWrite` MIT Backup-Rotation (Default).
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import type { FeedbackComment } from '@/core/types/feedback';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import { PERSOENLICH_FEEDBACK_COMMENTS_FILE } from '@/core/services/infrastructure/types';

/** IDB-Cache-Key (browser-lokal). */
export const FEEDBACK_COMMENTS_IDB_KEY = 'feedback-comments-local';

/** Ein Kommentar in der Outbox — inkl. Ziel-Ticket (die feedback.json haelt ihn
 *  spaeter unter `FeedbackItem.comments`). */
export interface OutboxComment {
  ticketId: string;
  id: string;
  text: string;
  created_at: string;
  /**
   * Art des Beitrags (v5.2). Bis dahin ging sie auf diesem Weg verloren: die
   * Ergänzung eines read-only-Nutzers kam beim Einsammeln als gewöhnlicher
   * Kommentar an — ausgerechnet bei der Gruppe, für die der Outbox-Weg gebaut
   * ist. Optional, damit Bestandsdateien unverändert gültig bleiben.
   */
  kind?: FeedbackComment['kind'];
}

export interface CommentFile {
  version: 1;
  kuerzel: string;
  comments: OutboxComment[];
  updatedAt: string;
}

function isNewer(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a) return false;
  if (!b) return true;
  return Date.parse(a) > Date.parse(b);
}

function isOutboxComment(raw: unknown): raw is OutboxComment {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Record<string, unknown>;
  // `kind` wird hier bewusst NICHT geprüft: fehlt es (Bestandsdatei) oder trägt
  // es einen Wert, den dieser Client noch nicht kennt, wäre sonst die ganze
  // Datei ungültig und alle Kommentare darin verloren. Die Whitelist steht beim
  // Einsammeln (`mergeCommentsIntoItems`), wo ein Unbekanntes still auf
  // „gewöhnlicher Kommentar" fällt.
  return (
    typeof p.ticketId === 'string' &&
    typeof p.id === 'string' &&
    typeof p.text === 'string' &&
    typeof p.created_at === 'string'
  );
}

/** Strukturelle Validierung einer roh gelesenen Kommentar-Datei. */
export function isValidCommentFile(raw: unknown): raw is CommentFile {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Record<string, unknown>;
  if (p.version !== 1) return false;
  if (typeof p.kuerzel !== 'string') return false;
  if (typeof p.updatedAt !== 'string') return false;
  if (!Array.isArray(p.comments)) return false;
  return p.comments.every(isOutboxComment);
}

export async function readFeedbackCommentsFromDir(
  handle: FileSystemDirectoryHandle,
): Promise<CommentFile | null> {
  const txt = await readText(handle, PERSOENLICH_FEEDBACK_COMMENTS_FILE);
  if (!txt) return null;
  try {
    const parsed = JSON.parse(txt);
    return isValidCommentFile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeFeedbackComments(
  idb: IDBStore,
  persHandle: FileSystemDirectoryHandle | null,
  data: CommentFile,
): Promise<boolean> {
  await idb.set(FEEDBACK_COMMENTS_IDB_KEY, data);
  if (!persHandle) return false;
  try {
    await atomicWrite(persHandle, PERSOENLICH_FEEDBACK_COMMENTS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

export async function loadFeedbackComments(
  idb: IDBStore,
  persHandle: FileSystemDirectoryHandle | null,
): Promise<CommentFile | null> {
  const cached = (await idb.get<CommentFile>(FEEDBACK_COMMENTS_IDB_KEY)) ?? null;
  if (!persHandle) return cached;

  let share: CommentFile | null = null;
  try {
    share = await readFeedbackCommentsFromDir(persHandle);
  } catch {
    return cached;
  }
  if (!share) return cached;

  const winner = isNewer(share.updatedAt, cached?.updatedAt) ? share : (cached ?? share);
  await idb.set(FEEDBACK_COMMENTS_IDB_KEY, winner);
  return winner;
}
