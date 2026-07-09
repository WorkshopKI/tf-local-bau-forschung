/**
 * Shared-File-IO für Feedback (Multi-User-Sync).
 *
 * Liest / schreibt `_intern/feedback/feedback.json` auf dem Daten-Share.
 * Konflikt-Strategie (Sektion R4): Merge-by-id mit Field-Precedence —
 * User-Felder lokal-wins, Kurator-/FAQ-/Sponsoring-Felder shared-wins.
 *
 * Geht über den Infrastruktur-Daten-Share-Handle (`getDatenShareHandle` +
 * `atomicWrite`/`readText`), NICHT über den Legacy-`storage.fs`-FileServerStore:
 * der ist im modernen Welcome/Startup-Flow nie gesetzt (vgl. auslastung-store.ts).
 * - Lesen braucht nur `read` → funktioniert für alle Rollen.
 * - Schreiben ist self-gated über `queryPermission({mode:'readwrite'})` — nur
 *   Rollen mit Schreibrecht (Kurator, PL via `datenShareSchreibrecht`, dev)
 *   schreiben tatsächlich; read-only-Clients (prod) sind ein No-op.
 * Sidecar-Profil (Pitfall #23): Idempotent-overwrite/Single-Source →
 * `atomicWrite` MIT Backup-Rotation (Default).
 */

import type { StorageService } from '@/core/services/storage';
import { FEEDBACK_DATA_DIR, FEEDBACK_SHARED_FILE } from '@/core/types/feedback';
import type {
  FeedbackComment,
  FeedbackItem,
  FeedbackSponsor,
  FeedbackVote,
  SharedFeedbackFile,
} from '@/core/types/feedback';
import { atomicWrite, readBinary, readText } from '@/core/services/infrastructure/atomic-write';
import { getDatenShareHandle, queryPermission } from '@/core/services/infrastructure/smb-handle';
import { normalizeLegacyFields } from './feedbackStorage';

/** Screenshot-Bilddateien liegen neben der feedback.json. */
export const FEEDBACK_ATTACHMENTS_DIR = `${FEEDBACK_DATA_DIR}/attachments`;

export async function readSharedFile(storage: StorageService): Promise<SharedFeedbackFile | null> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) return null;
  const text = await readText(handle, FEEDBACK_SHARED_FILE);
  if (text == null) return null;
  try {
    const data = JSON.parse(text) as SharedFeedbackFile;
    if (!data || data.version !== 1 || !Array.isArray(data.items)) return null;
    return { ...data, items: data.items.map(normalizeLegacyFields) };
  } catch (err) {
    console.warn('[feedbackSharedFile] readSharedFile parse failed:', err);
    return null;
  }
}

export async function writeSharedFile(
  storage: StorageService,
  items: FeedbackItem[],
): Promise<boolean> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) return false;
  // Self-Gate (Ersatz für das alte storage.fs.isReadOnly()): nur Clients mit
  // readwrite-Berechtigung auf dem Daten-Share schreiben (Kurator/PL/dev).
  if ((await queryPermission(handle)) !== 'granted') return false;
  try {
    const payload: SharedFeedbackFile = {
      version: 1,
      updated_at: new Date().toISOString(),
      items,
    };
    await atomicWrite(handle, FEEDBACK_SHARED_FILE, JSON.stringify(payload, null, 2));
    return true;
  } catch (err) {
    console.error('[feedbackSharedFile] writeSharedFile failed:', err);
    return false;
  }
}

/**
 * Schreibt eine Screenshot-Bilddatei ins Shared-Attachment-Verzeichnis
 * (`_intern/feedback/attachments/`). Self-gated wie `writeSharedFile` (nur Rollen
 * mit readwrite). `{ skipBackup: true }` — keine `.backup`-Byte-Verdopplung.
 */
export async function writeSharedAttachment(
  storage: StorageService,
  filename: string,
  data: Blob | Uint8Array,
): Promise<boolean> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) return false;
  if ((await queryPermission(handle)) !== 'granted') return false;
  try {
    await atomicWrite(handle, `${FEEDBACK_ATTACHMENTS_DIR}/${filename}`, data, { skipBackup: true });
    return true;
  } catch (err) {
    console.error('[feedbackSharedFile] writeSharedAttachment failed:', err);
    return false;
  }
}

/** Liest eine Screenshot-Bilddatei aus dem Shared-Attachment-Verzeichnis (Bytes oder null). */
export async function readSharedAttachment(
  storage: StorageService,
  filename: string,
): Promise<Uint8Array | null> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) return null;
  return readBinary(handle, `${FEEDBACK_ATTACHMENTS_DIR}/${filename}`);
}

/** Summiert Punkte/Stunden einer Sponsor-Liste (für die *_total-Caches). */
export function recalcSponsorTotals(
  sponsors: readonly FeedbackSponsor[],
): { points: number; hours: number } {
  let points = 0;
  let hours = 0;
  for (const s of sponsors) {
    if (s.type === 'points') points += s.amount;
    else if (s.type === 'hours') hours += s.amount;
  }
  return { points, hours };
}

function sponsorKey(s: FeedbackSponsor): string {
  return `${s.user_id}:${s.type}`;
}

/**
 * Union zweier Sponsor-Listen (v2.32): Basis = shared (alle User), lokale
 * Einträge überschreiben/ergänzen per `(user_id:type)`.
 *
 * Voraussetzung — Anti-Stale-Regel (siehe `sponsorTicket`/`unsponsorTicket`):
 * lokale Items tragen NUR die eigenen Sponsor-Einträge des aktuellen Users.
 * Dadurch überschreibt der lokale Stand garantiert nur eigene Keys, fremde
 * Stimmen aus shared bleiben erhalten. Behebt den Bug, dass eine lokal-only-
 * Stimme (prod, noch nicht eingesammelt) beim Reload aus der Shared-Datei
 * verworfen wurde (shared-wins für `sponsors`).
 */
export function unionMergeSponsors(
  shared: readonly FeedbackSponsor[] | undefined,
  local: readonly FeedbackSponsor[] | undefined,
): FeedbackSponsor[] {
  const map = new Map<string, FeedbackSponsor>();
  for (const s of shared ?? []) map.set(sponsorKey(s), s);
  for (const s of local ?? []) map.set(sponsorKey(s), s);
  return Array.from(map.values());
}

/**
 * Union zweier Vote-Listen (v2.199). Basis = shared (alle User), lokale Einträge
 * überschreiben/ergänzen per `user_id`. Anti-Stale-Regel wie bei Sponsoren:
 * lokale Items tragen NUR die eigene Stimme (siehe `toggleVote`), damit die eigene
 * lokal-only-Stimme (read-only prod, noch nicht eingesammelt) den Reload überlebt,
 * ohne fremde Stimmen aus shared zu überschreiben.
 */
export function unionMergeVotes(
  shared: readonly FeedbackVote[] | undefined,
  local: readonly FeedbackVote[] | undefined,
): FeedbackVote[] {
  const map = new Map<string, FeedbackVote>();
  for (const v of shared ?? []) map.set(v.user_id, v);
  for (const v of local ?? []) map.set(v.user_id, v);
  return Array.from(map.values());
}

/**
 * Union zweier Kommentar-Listen (v2.199) per `id` — append-only, es geht nie ein
 * Kommentar verloren. Lokale Items tragen die eigenen, noch nicht eingesammelten
 * Kommentare (read-only prod); die Reihenfolge folgt `created_at` aufsteigend.
 */
export function unionMergeComments(
  shared: readonly FeedbackComment[] | undefined,
  local: readonly FeedbackComment[] | undefined,
): FeedbackComment[] {
  const map = new Map<string, FeedbackComment>();
  for (const c of shared ?? []) map.set(c.id, c);
  for (const c of local ?? []) map.set(c.id, c);
  return Array.from(map.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Merge-Strategie: bei Duplikat-IDs wins shared für Kurator-Felder, lokal für User-Felder. */
export function mergeItems(local: FeedbackItem[], shared: FeedbackItem[]): FeedbackItem[] {
  const byId = new Map<string, FeedbackItem>();
  for (const item of shared) byId.set(item.id, item);
  for (const local_item of local) {
    const sharedItem = byId.get(local_item.id);
    if (!sharedItem) {
      byId.set(local_item.id, local_item);
      continue;
    }
    // Sponsoring: Union statt shared-wins NUR wenn das lokale Item eigene
    // Sponsor-Einträge trägt — dann überlebt die eigene lokale Stimme den Reload
    // (fremde Stimmen aus shared bleiben, Anti-Stale-Regel oben). Hat das lokale
    // Item keine eigenen Einträge, bleibt der Shared-Stand inkl. `*_total`-Caches
    // unverändert (Rückwärtskompatibilität mit Items, die nur die Scalar-Caches
    // ohne `sponsors`-Array tragen).
    const sponsorFields =
      local_item.sponsors && local_item.sponsors.length > 0
        ? (() => {
            const sponsors = unionMergeSponsors(sharedItem.sponsors, local_item.sponsors);
            const totals = recalcSponsorTotals(sponsors);
            return {
              sponsors,
              sponsor_points_total: totals.points,
              sponsor_hours_total: totals.hours,
            };
          })()
        : {};
    // Votes (v2.199): Union NUR wenn das lokale Item eigene Stimmen trägt (Anti-
    // Stale wie Sponsoren) — sonst bleibt der Shared-Stand. Kommentare: IMMER
    // Union-by-id (append-only, nie verlieren).
    const voteFields =
      local_item.votes && local_item.votes.length > 0
        ? { votes: unionMergeVotes(sharedItem.votes, local_item.votes) }
        : {};
    const commentFields =
      (local_item.comments && local_item.comments.length > 0) ||
      (sharedItem.comments && sharedItem.comments.length > 0)
        ? { comments: unionMergeComments(sharedItem.comments, local_item.comments) }
        : {};
    // Merge: User-Felder aus local, Kurator/FAQ-Felder aus shared
    byId.set(local_item.id, {
      ...sharedItem,
      // User-fields override (User edits these locally first)
      title: local_item.title ?? sharedItem.title,
      text: local_item.text,
      original_text: local_item.original_text ?? sharedItem.original_text,
      stars: local_item.stars,
      context: local_item.context,
      llm_summary: local_item.llm_summary ?? sharedItem.llm_summary,
      llm_classification: local_item.llm_classification ?? sharedItem.llm_classification,
      user_confirmed: local_item.user_confirmed ?? sharedItem.user_confirmed,
      ...sponsorFields,
      ...voteFields,
      ...commentFields,
    });
  }
  return Array.from(byId.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
