/**
 * Feedback-Votes (Likes) im persoenlichen Ordner (v2.199 Redesign).
 *
 * Read-only prod-Enduser koennen `_intern/feedback/feedback.json` nicht
 * schreiben. Ihre leichten Stimmen (eine je Feedback) landen deshalb hier in
 * `ZAH/feedback/vote-wuensche.json` (Liste `ticketId[]`); der Kurator sammelt sie
 * ueber den User-Folders-Root ein (`autoCollectFeedbackVotes`) und merged sie in
 * die zentrale feedback.json (`mergeVotesIntoItems`). Spiegelbild von
 * `feedbackSponsorOutbox.ts` — nur ohne Punkte (Set statt Map).
 *
 * Cross-Browser-Strategie (analog Sponsor-Votes):
 *   - Schreiben: IMMER IDB-Cache, zusaetzlich persoenlicher Ordner wenn Handle da.
 *   - Lesen: persoenlicher Ordner (Source-of-Truth) → IDB-Cache → null.
 *   - LWW ueber `updatedAt`.
 *
 * Sidecar-Profil (Pitfall #23): idempotent-overwrite / Single-Source pro User →
 * `atomicWrite` MIT Backup-Rotation (Default). Datei ist klein.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import { PERSOENLICH_FEEDBACK_VOTES_FILE } from '@/core/services/infrastructure/types';

/** IDB-Cache-Key (browser-lokal). */
export const FEEDBACK_VOTES_IDB_KEY = 'feedback-votes-local';

export interface VoteFile {
  version: 1;
  /** Identitaet des Users (= `useMeinKuerzel() ?? profile.name`). */
  kuerzel: string;
  /** IDs der gevoteten Feedbacks. Abwesenheit = keine/zurueckgezogene Stimme. */
  ticketIds: string[];
  updatedAt: string;
}

function isNewer(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a) return false;
  if (!b) return true;
  return Date.parse(a) > Date.parse(b);
}

/** Strukturelle Validierung einer roh gelesenen Vote-Datei. */
export function isValidVoteFile(raw: unknown): raw is VoteFile {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Record<string, unknown>;
  if (p.version !== 1) return false;
  if (typeof p.kuerzel !== 'string') return false;
  if (typeof p.updatedAt !== 'string') return false;
  if (!Array.isArray(p.ticketIds)) return false;
  return p.ticketIds.every(v => typeof v === 'string');
}

/**
 * Liest die Vote-Datei aus einem User-Home-Root-Handle. Funktioniert sowohl fuer
 * den eigenen Persoenlich-Handle als auch fuer einen fremden User-Ordner
 * (Einsammel-Schritt) — der Pfad ist relativ zum User-Home identisch.
 */
export async function readFeedbackVotesFromDir(
  handle: FileSystemDirectoryHandle,
): Promise<VoteFile | null> {
  const txt = await readText(handle, PERSOENLICH_FEEDBACK_VOTES_FILE);
  if (!txt) return null;
  try {
    const parsed = JSON.parse(txt);
    return isValidVoteFile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Speichert die eigenen Votes. Schreibt IMMER den IDB-Cache; schreibt zusaetzlich
 * den persoenlichen Ordner wenn `persHandle` vorhanden ist. Gibt zurueck, ob die
 * Datei wirklich im persoenlichen Ordner landete (sonst nur IDB → `warning`).
 */
export async function writeFeedbackVotes(
  idb: IDBStore,
  persHandle: FileSystemDirectoryHandle | null,
  data: VoteFile,
): Promise<boolean> {
  await idb.set(FEEDBACK_VOTES_IDB_KEY, data);
  if (!persHandle) return false;
  try {
    await atomicWrite(persHandle, PERSOENLICH_FEEDBACK_VOTES_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

/**
 * Laedt die eigenen Votes mit Cross-Browser-Kaskade:
 *   persoenlicher Ordner (Share) → IDB-Cache → null.
 * Bei beidseitigem Treffer gewinnt der neuere `updatedAt`; der Cache wird
 * angeglichen.
 */
export async function loadFeedbackVotes(
  idb: IDBStore,
  persHandle: FileSystemDirectoryHandle | null,
): Promise<VoteFile | null> {
  const cached = (await idb.get<VoteFile>(FEEDBACK_VOTES_IDB_KEY)) ?? null;
  if (!persHandle) return cached;

  let share: VoteFile | null = null;
  try {
    share = await readFeedbackVotesFromDir(persHandle);
  } catch {
    return cached;
  }
  if (!share) return cached;

  const winner = isNewer(share.updatedAt, cached?.updatedAt) ? share : (cached ?? share);
  await idb.set(FEEDBACK_VOTES_IDB_KEY, winner);
  return winner;
}
