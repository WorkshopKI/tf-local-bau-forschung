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
import type { FeedbackCategory, FeedbackContext, FeedbackItem } from '@/core/types/feedback';
import { PERSOENLICH_ZAH_DIR } from '@/core/services/infrastructure/types';
import { readBinary } from '@/core/services/infrastructure/atomic-write';
import {
  deleteOutboxItem,
  listOutboxItems,
  writeOutboxStatus,
  type FeedbackOutboxItem,
} from '@/core/services/personal-storage';
import { readSharedFile, writeSharedFile, writeSharedAttachment, mergeItems } from './feedbackSharedFile';
import { emitFeedbackUpdated, normalizeLegacyFields } from './feedbackStorage';
import { readSponsorVotesFromDir, type SponsorVoteFile } from './feedbackSponsorOutbox';
import { mergeSponsorVotesIntoItems } from './mergeSponsorVotes';
import { readFeedbackVotesFromDir, type VoteFile } from './feedbackVoteOutbox';
import { mergeVotesIntoItems } from './mergeFeedbackVotes';
import { readFeedbackCommentsFromDir, type CommentFile } from './feedbackCommentOutbox';
import { mergeCommentsIntoItems } from './mergeFeedbackComments';

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
  // normalizeLegacyFields: Outboxen aelterer Clients koennen noch die entfallene
  // Kategorie 'ux' liefern → beim Import auf 'idea' heilen (statt erst beim Lesen).
  return normalizeLegacyFields({
    id: ob.id, // Outbox-id beibehalten → zuverlaessige Dedup ueber mergeItems
    created_at: ob.submitted_at,
    user_id: ob.kuerzel,
    user_display_name: ob.kuerzel,
    title: ob.title,
    // category + structured + attachments aus dem Typ-Formular durchreichen (sonst
    // landet alles als "Unklassifiziert" / ohne Screenshots, obwohl der User den
    // Typ gewaehlt + Bilder angehaengt hat).
    category: ob.category as FeedbackCategory | undefined,
    structured: ob.structured,
    attachments: ob.attachments,
    text: ob.text,
    // KI-Verbesserung (v2.207.1): read-only prod-Enduser haben die polierte Fassung
    // in `text`; Roh-Text + Klassifikation durchreichen (Parität zum Shared-Write-Pfad).
    ...(ob.original_text ? { original_text: ob.original_text } : {}),
    ...(ob.llm_summary ? { llm_summary: ob.llm_summary } : {}),
    ...(ob.llm_classification ? { llm_classification: ob.llm_classification } : {}),
    context: (ob.context as FeedbackContext | undefined) ?? fallbackContext(ob),
    kurator_status: 'neu',
  });
}

/**
 * Kopiert die Screenshot-Bytes eines Outbox-Items aus der User-Outbox ins
 * Shared-Attachment-Verzeichnis. `teamflowHandle` = `ZAH/`-Ordner des Users →
 * Pfade `feedback/outbox/<datei>` (analog writeOutboxStatus). Liefert `true` nur
 * wenn ALLE Bilder erfolgreich kopiert wurden (sonst Item NICHT loeschbar).
 */
async function copyAttachmentsToShared(
  storage: StorageService,
  teamflowHandle: FileSystemDirectoryHandle,
  item: FeedbackOutboxItem,
): Promise<boolean> {
  if (!item.attachments || item.attachments.length === 0) return true;
  let ok = true;
  for (const att of item.attachments) {
    const bytes = await readBinary(teamflowHandle, `feedback/outbox/${att.filename}`);
    if (!bytes) { ok = false; continue; } // Datei fehlt → Item nicht loeschen
    const written = await writeSharedAttachment(storage, att.filename, bytes);
    if (!written) ok = false;
  }
  return ok;
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

  // 2. Screenshot-Bytes ins Shared kopieren (VOR dem feedback.json-Write — die
  //    Bytes-zuerst-Invariante fuer das Auto-Loeschen). Pro Item merken, ob alle
  //    Bilder sicher kopiert wurden.
  const attachmentsCopied = new Map<string, boolean>();
  for (const p of pending) {
    attachmentsCopied.set(p.item.id, await copyAttachmentsToShared(storage, p.teamflowHandle, p.item));
  }

  // 3. Neue Items (id noch nicht in Shared) batched in die zentrale Datei schreiben.
  const newItems = pending
    .filter(p => !existingIds.has(p.item.id))
    .map(p => toFeedbackItem(p.item));
  let sharedWriteOk = true;
  if (newItems.length > 0) {
    const merged = mergeItems(newItems, shared?.items ?? []);
    sharedWriteOk = await writeSharedFile(storage, merged);
  }

  // 4. Auto-Loeschen am Ursprung (User-Wahl) — strikte Reihenfolge: erst wenn die
  //    Bytes (Bilder + feedback.json) sicher im Shared sind, dann loeschen. Sonst
  //    'approved' markieren (Re-Import-Schutz, Bytes am Ursprung bleiben erhalten).
  const reviewedAt = new Date().toISOString();
  for (const p of pending) {
    const isNew = !existingIds.has(p.item.id);
    const itemInShared = isNew ? sharedWriteOk : true; // bereits-vorhandene sind per Definition drin
    const attsOk = attachmentsCopied.get(p.item.id) ?? true;
    const safeToDelete = itemInShared && attsOk;
    try {
      if (safeToDelete) {
        await deleteOutboxItem(p.teamflowHandle, p.item);
      } else {
        await writeOutboxStatus(p.teamflowHandle, {
          ...p.item,
          status: 'approved',
          reviewed_at: reviewedAt,
          reviewer_kuerzel: reviewerKuerzel,
        });
      }
    } catch {
      // Loeschen/Writeback best-effort — bei Fehler faengt der id-Dedup (Item bleibt
      // pending) einen Re-Import naechste Session ab; Datenverlust ausgeschlossen,
      // weil nur nach bestaetigtem Shared-Write geloescht wird.
    }
  }

  if (newItems.length > 0) emitFeedbackUpdated();
  return { scanned: pending.length, imported: newItems.length };
}

export interface SponsorVotesCollectResult {
  /** Anzahl gelesener Stimmen-Dateien (User mit `sponsor-wuensche.json`). */
  scanned: number;
  /** Übernommene Änderungen (neu + aktualisiert + entfernt). */
  merged: number;
}

/**
 * Sammelt die Sponsoring-Stimmen (`<user>/ZAH/feedback/sponsor-wuensche.json`)
 * aller User unter dem User-Folders-Root ein und merged sie in die zentrale
 * `feedback.json` (Punkte-Sponsor-Einträge). Read-only prod-User schreiben ihre
 * Stimmen in den eigenen Ordner (`sponsorTicket` → Outbox); hier landen sie für
 * alle sichtbar im Aggregat. Pure-Merge `mergeSponsorVotesIntoItems` mit
 * Retraktion (zurückgezogene Stimmen → Eintrag entfernt). Iterations-Muster
 * gespiegelt von `autoCollectFeedbackOutboxes` / `collectUebernahmeWuensche`.
 *
 * `readSponsorVotesFromDir` liest relativ zum **User-Home** (Pfad enthält `ZAH/`)
 * — daher der User-Ordner, NICHT dessen `ZAH/`-Subdir (anders als die Outbox).
 */
export async function autoCollectSponsorVotes(
  storage: StorageService,
  root: FileSystemDirectoryHandle,
): Promise<SponsorVotesCollectResult> {
  const batch: SponsorVoteFile[] = [];
  for await (const entry of (root as FileSystemDirectoryHandle & {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }).values()) {
    if (entry.kind !== 'directory') continue;
    try {
      const userDir = await root.getDirectoryHandle(entry.name);
      const votes = await readSponsorVotesFromDir(userDir);
      if (votes) batch.push(votes);
    } catch {
      /* User-Ordner ohne Stimmen-Datei → ignorieren */
    }
  }
  if (batch.length === 0) return { scanned: 0, merged: 0 };

  const shared = await readSharedFile(storage);
  const { items, neu, aktualisiert, entfernt } = mergeSponsorVotesIntoItems(
    shared?.items ?? [],
    batch,
  );
  const changes = neu + aktualisiert + entfernt;
  if (changes > 0) {
    await writeSharedFile(storage, items);
    emitFeedbackUpdated();
  }
  return { scanned: batch.length, merged: changes };
}

/**
 * Sammelt die leichten Feedback-Votes (`<user>/ZAH/feedback/vote-wuensche.json`)
 * aller User ein und merged sie in die zentrale `feedback.json` (`votes`, mit
 * Retraktion). Iterations-Muster identisch zu `autoCollectSponsorVotes`.
 */
export async function autoCollectFeedbackVotes(
  storage: StorageService,
  root: FileSystemDirectoryHandle,
): Promise<SponsorVotesCollectResult> {
  const batch: VoteFile[] = [];
  for await (const entry of (root as FileSystemDirectoryHandle & {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }).values()) {
    if (entry.kind !== 'directory') continue;
    try {
      const userDir = await root.getDirectoryHandle(entry.name);
      const votes = await readFeedbackVotesFromDir(userDir);
      if (votes) batch.push(votes);
    } catch {
      /* User-Ordner ohne Vote-Datei → ignorieren */
    }
  }
  if (batch.length === 0) return { scanned: 0, merged: 0 };

  const shared = await readSharedFile(storage);
  const { items, neu, entfernt } = mergeVotesIntoItems(shared?.items ?? [], batch);
  const changes = neu + entfernt;
  if (changes > 0) {
    await writeSharedFile(storage, items);
    emitFeedbackUpdated();
  }
  return { scanned: batch.length, merged: changes };
}

/**
 * Sammelt die Feedback-Kommentare (`<user>/ZAH/feedback/kommentar-outbox.json`)
 * aller User ein und merged sie in die zentrale `feedback.json` (`comments`,
 * append-by-id). Iterations-Muster identisch zu `autoCollectSponsorVotes`.
 */
export async function autoCollectFeedbackComments(
  storage: StorageService,
  root: FileSystemDirectoryHandle,
): Promise<SponsorVotesCollectResult> {
  const batch: CommentFile[] = [];
  for await (const entry of (root as FileSystemDirectoryHandle & {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }).values()) {
    if (entry.kind !== 'directory') continue;
    try {
      const userDir = await root.getDirectoryHandle(entry.name);
      const comments = await readFeedbackCommentsFromDir(userDir);
      if (comments) batch.push(comments);
    } catch {
      /* User-Ordner ohne Kommentar-Datei → ignorieren */
    }
  }
  if (batch.length === 0) return { scanned: 0, merged: 0 };

  const shared = await readSharedFile(storage);
  const { items, neu } = mergeCommentsIntoItems(shared?.items ?? [], batch);
  if (neu > 0) {
    await writeSharedFile(storage, items);
    emitFeedbackUpdated();
  }
  return { scanned: batch.length, merged: neu };
}
