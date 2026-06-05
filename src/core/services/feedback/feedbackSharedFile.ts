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
import { FEEDBACK_SHARED_FILE } from '@/core/types/feedback';
import type { FeedbackItem, FeedbackSponsor, SharedFeedbackFile } from '@/core/types/feedback';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import { getDatenShareHandle, queryPermission } from '@/core/services/infrastructure/smb-handle';
import { normalizeLegacyFields } from './feedbackStorage';

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
    // Merge: User-Felder aus local, Kurator/FAQ-Felder aus shared
    byId.set(local_item.id, {
      ...sharedItem,
      // User-fields override (User edits these locally first)
      text: local_item.text,
      stars: local_item.stars,
      context: local_item.context,
      llm_summary: local_item.llm_summary ?? sharedItem.llm_summary,
      llm_classification: local_item.llm_classification ?? sharedItem.llm_classification,
      user_confirmed: local_item.user_confirmed ?? sharedItem.user_confirmed,
      ...sponsorFields,
    });
  }
  return Array.from(byId.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
