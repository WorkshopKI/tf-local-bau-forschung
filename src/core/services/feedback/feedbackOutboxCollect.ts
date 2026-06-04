/**
 * Auto-Einsammeln der Feedback-Outboxen (v2.22).
 *
 * Read-only prod-Enduser schreiben ihr Feedback in die persoenliche Outbox
 * (`<user>/ZAH/feedback/outbox/*.json`). Diese Funktion scannt — vom Kurator-
 * Pfad ueber den User-Folders-Root — alle Outboxen und importiert die offenen
 * Eintraege OHNE Review direkt in die zentrale `feedback.json` (Status 'neu').
 * Der Outbox-Eintrag wird danach auf 'approved' gesetzt (Re-Import-Schutz).
 *
 * Idempotent: Dedup primaer ueber den Outbox-Status ('pending' vs 'approved')
 * UND sekundaer ueber die Item-`id` — die Outbox-id wird als FeedbackItem-id
 * uebernommen, sodass `mergeItems` einen Re-Import zuverlaessig dedupt, falls
 * ein Status-Writeback einmal fehlschlaegt. Best-effort pro User/Item (ein
 * defekter Ordner bricht den Scan nicht ab).
 *
 * Iterations-Muster gespiegelt von `collectUserProfiles` /
 * `FeedbackInboxTab.loadInbox`. Per Design ohne Review-Gate (User-Entscheidung
 * v2.22) — der Kurator sortiert nachtraeglich via Archivieren/Ablehnen aus.
 */
import type { StorageService } from '@/core/services/storage';
import type { FeedbackContext, FeedbackItem } from '@/core/types/feedback';
import { PERSOENLICH_ZAH_DIR } from '@/core/services/infrastructure/types';
import {
  listOutboxItems,
  writeOutboxStatus,
  type FeedbackOutboxItem,
} from '@/core/services/personal-storage';
import { readSharedFile, writeSharedFile, mergeItems } from './feedbackSharedFile';
import { emitFeedbackUpdated } from './feedbackStorage';

export interface FeedbackCollectResult {
  scanned: number;
  imported: number;
}

function fallbackContext(item: FeedbackOutboxItem): FeedbackContext {
  return {
    route: 'inbox',
    page: 'Outbox-Import',
    device: 'Desktop',
    viewport: '0x0',
    sessionDuration: 0,
    errors: [],
    timestamp: item.submitted_at,
  };
}

function toFeedbackItem(ob: FeedbackOutboxItem): FeedbackItem {
  return {
    id: ob.id, // Outbox-id beibehalten → zuverlaessige Dedup ueber mergeItems
    created_at: ob.submitted_at,
    user_id: ob.kuerzel,
    user_display_name: ob.kuerzel,
    text: ob.text,
    context: (ob.context as FeedbackContext | undefined) ?? fallbackContext(ob),
    kurator_status: 'neu',
  };
}

export async function autoCollectFeedbackOutboxes(
  storage: StorageService,
  root: FileSystemDirectoryHandle,
  reviewerKuerzel: string,
): Promise<FeedbackCollectResult> {
  // Bestehende Shared-Items einmal lesen → id-Set fuer Dedup.
  const shared = await readSharedFile(storage);
  const existingIds = new Set((shared?.items ?? []).map(i => i.id));

  // 1. Alle offenen Outbox-Eintraege einsammeln (mit Ziel-Handle fuer Status-Write).
  const pending: Array<{ teamflowHandle: FileSystemDirectoryHandle; item: FeedbackOutboxItem }> = [];
  for await (const entry of (root as FileSystemDirectoryHandle & {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }).values()) {
    if (entry.kind !== 'directory') continue;
    try {
      const userDir = await root.getDirectoryHandle(entry.name);
      const teamflowHandle = await userDir.getDirectoryHandle(PERSOENLICH_ZAH_DIR);
      const items = await listOutboxItems(teamflowHandle);
      for (const item of items) {
        if (item.status === 'pending') pending.push({ teamflowHandle, item });
      }
    } catch {
      /* User-Ordner ohne ZAH/-Struktur → ignorieren */
    }
  }

  // 2. Neue Items (id noch nicht in Shared) batched in die zentrale Datei schreiben.
  const newItems = pending
    .filter(p => !existingIds.has(p.item.id))
    .map(p => toFeedbackItem(p.item));
  if (newItems.length > 0) {
    const merged = mergeItems(newItems, shared?.items ?? []);
    await writeSharedFile(storage, merged);
  }

  // 3. ALLE offenen Outbox-Eintraege auf 'approved' setzen (Re-Import-Schutz),
  //    best-effort pro Item.
  const reviewedAt = new Date().toISOString();
  for (const p of pending) {
    try {
      await writeOutboxStatus(p.teamflowHandle, {
        ...p.item,
        status: 'approved',
        reviewed_at: reviewedAt,
        reviewer_kuerzel: reviewerKuerzel,
      });
    } catch {
      /* Writeback best-effort — id-Dedup faengt einen Re-Import naechste Session ab */
    }
  }

  if (newItems.length > 0) emitFeedbackUpdated();
  return { scanned: pending.length, imported: newItems.length };
}
