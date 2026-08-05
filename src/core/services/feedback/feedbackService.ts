/**
 * Feedback-CRUD-Facade: localStorage primär + Shared-JSON Sync.
 *
 * Diese Datei hält nur noch die Public-CRUD-API + Config + Status-Probe.
 * Domain-spezifische Logik liegt in den Sibling-Modulen:
 *  - feedbackStorage.ts        — Lokal-IO
 *  - feedbackSharedFile.ts     — Shared-File-IO + Merge-Strategie
 *  - feedbackFaq.ts            — FAQ-Matching + manuelle FAQ-Items
 *  - feedbackSponsoring.ts     — Phase 3 Sponsoring
 *  - feedbackClassification.ts — Discriminator-Helper für category-Status
 *
 * Konflikt-Strategie (Sektion R4) ist in feedbackSharedFile.mergeItems
 * implementiert — User-Felder lokal-wins, Kurator-/FAQ-/Sponsoring-Felder
 * shared-wins.
 */

import type { StorageService } from '@/core/services/storage';
import {
  DEFAULT_FEEDBACK_CONFIG,
  FEEDBACK_CONFIG_LS_KEY,
  FEEDBACK_SHARED_FILE,
} from '@/core/types/feedback';
import type {
  FeedbackAttachment,
  FeedbackConfig,
  FeedbackFilters,
  FeedbackItem,
} from '@/core/types/feedback';
import {
  emitFeedbackUpdated,
  generateFeedbackId,
  loadLocalItems,
  saveLocalItems,
} from './feedbackStorage';
import {
  mergeItems,
  readSharedFile,
  writeSharedAttachment,
  writeSharedFile,
} from './feedbackSharedFile';
import { isAuslastungFeedback } from './feedbackClassification';
import { isAuslastungFreigeschaltet } from '@/core/modul-freischaltung';
import { submitFeedback as submitToOutbox } from '@/core/services/personal-storage';

// ── Public CRUD API ─────────────────────────────────────────────────────────

/**
 * Submission-Routing-Options.
 *
 * Maßgeblich ist `writeToShared` (Call-Site berechnet es über
 * `canWriteDatenShare(isKurator)` — Kurator ODER PL/dev via
 * `datenShareSchreibrecht`):
 * - `writeToShared: true` (Default wenn weggelassen) → schreibt direkt nach
 *   `_intern/feedback/feedback.json` (Daten-Share readwrite). Sofort für alle
 *   sichtbar.
 * - `writeToShared: false` + `persHandle` → schreibt in die Outbox auf dem
 *   persoenlichen Laufwerk; der Kurator sammelt im FeedbackInboxTab ein
 *   (read-only-Clients, z.B. prod-Enduser).
 * - `writeToShared: false` ohne `persHandle` → nur localStorage; Aufrufer sollte
 *   den Submit-Button vorher deaktivieren oder den User informieren.
 *
 * `isKurator` bleibt für Backward-Compat erhalten: fehlt `writeToShared`, wird
 * darauf zurückgefallen (Legacy-Caller wie FeedbackInboxTab `{isKurator:true}`).
 */
export interface SubmitFeedbackRouting {
  isKurator: boolean;
  writeToShared?: boolean;
  persHandle?: FileSystemDirectoryHandle | null;
  kuerzel?: string;
}

/**
 * Attachment-Eingabe für submitFeedback: Referenz-Felder + der noch nicht
 * persistierte Blob. `filename` wird hier aus der finalen Ticket-id abgeleitet
 * (`${ticketId}-${attId}.${ext}`); strukturell kompatibel zu `PendingAttachment`.
 */
export interface SubmitAttachment {
  id: string;
  blob: Blob;
  caption?: string;
  /** Bild-MIME bei Screenshots, beliebiger Datei-MIME bei `kind:'file'`. */
  mime: string;
  width: number;
  height: number;
  bytes: number;
  /** Default `'image'`. `'file'` = beigefügtes Dokument (v2.199.1). */
  kind?: 'image' | 'file';
  /** Original-Dateiname (nur bei `kind:'file'`). */
  name?: string;
}

/** Endung für den Storage-Dateinamen: bei Dateien aus dem Original-Namen, bei
 *  Screenshots aus dem Bild-MIME. Fallback `bin`. */
function attachmentExt(a: SubmitAttachment): string {
  if (a.kind === 'file') {
    const m = /\.([a-z0-9]+)$/i.exec((a.name ?? '').trim());
    return m ? m[1]!.toLowerCase() : 'bin';
  }
  return a.mime === 'image/png' ? 'png' : 'jpg';
}

function buildAttachmentRefs(
  ticketId: string,
  atts: readonly SubmitAttachment[],
): { refs: FeedbackAttachment[]; blobs: Array<{ filename: string; blob: Blob }> } {
  const refs: FeedbackAttachment[] = [];
  const blobs: Array<{ filename: string; blob: Blob }> = [];
  for (const a of atts) {
    const filename = `${ticketId}-${a.id}.${attachmentExt(a)}`;
    refs.push({
      id: a.id,
      filename,
      caption: a.caption?.trim() ? a.caption.trim() : undefined,
      mime: a.mime,
      ...(a.kind ? { kind: a.kind } : {}),
      ...(a.name ? { name: a.name } : {}),
      width: a.width,
      height: a.height,
      bytes: a.bytes,
    });
    blobs.push({ filename, blob: a.blob });
  }
  return { refs, blobs };
}

export async function submitFeedback(
  storage: StorageService,
  data: Omit<FeedbackItem, 'id' | 'kurator_status' | 'created_at'>,
  routing?: SubmitFeedbackRouting,
  attachments?: SubmitAttachment[],
): Promise<FeedbackItem> {
  const id = generateFeedbackId();
  // Bilddatei-Namen aus der finalen Ticket-id ableiten; Blobs getrennt halten
  // (FeedbackAttachment selbst trägt keinen Blob).
  const { refs, blobs } = attachments && attachments.length > 0
    ? buildAttachmentRefs(id, attachments)
    : { refs: undefined as FeedbackAttachment[] | undefined, blobs: [] as Array<{ filename: string; blob: Blob }> };

  const item: FeedbackItem = {
    ...data,
    id,
    ...(refs ? { attachments: refs } : {}),
    kurator_status: 'neu',
    created_at: new Date().toISOString(),
  };
  // Local (immer)
  const items = loadLocalItems();
  items.unshift(item);
  saveLocalItems(items);

  // Dispatch: writeToShared maßgeblich (Fallback auf isKurator für Legacy-Caller,
  // Default true wenn gar kein routing übergeben wird = pre-v2.0-Verhalten).
  const writeToShared = routing == null ? true : (routing.writeToShared ?? routing.isKurator);

  if (!writeToShared) {
    // User-Pfad (read-only Client): Outbox auf pers. Laufwerk, KEIN Shared-File-Write
    if (routing?.persHandle) {
      try {
        await submitToOutbox(routing.persHandle, routing.kuerzel ?? 'unbekannt', {
          id: item.id,
          kuerzel: routing.kuerzel ?? 'unbekannt',
          submitted_at: item.created_at,
          text: item.text,
          title: item.title,
          // category + structured + attachments durchreichen, damit der per
          // Typ-Wahl gesetzte Typ + die Screenshots beim Kurator-Einsammeln
          // (toFeedbackItem) erhalten bleiben.
          category: item.category,
          structured: item.structured,
          attachments: item.attachments,
          context: item.context,
        }, blobs);
      } catch (err) {
        console.warn('[feedbackService] outbox write failed', err);
      }
    }
    emitFeedbackUpdated();
    return item;
  }

  // Shared-Pfad (Kurator / PL / dev): Bilddateien neben die feedback.json schreiben
  // (self-gated, no-op ohne readwrite), dann re-read + merge + atomicWrite.
  for (const a of blobs) {
    await writeSharedAttachment(storage, a.filename, a.blob);
  }
  const shared = await readSharedFile(storage);
  const merged = shared ? mergeItems([item], shared.items) : [item];
  await writeSharedFile(storage, merged);
  emitFeedbackUpdated();
  return item;
}

export async function getFeedbackList(
  storage: StorageService,
  filters?: FeedbackFilters,
): Promise<FeedbackItem[]> {
  const local = loadLocalItems();
  const shared = await readSharedFile(storage);
  const merged = shared
    ? mergeItems(local, shared.items)
    : local.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  // Auslastungs-Modul-Feedback nur in Varianten mit aktivem Modul (pl/dev) zeigen.
  // In prod/kurator (kein Auslastungs-Modul) ausblenden — sonst leakt PL-Feedback
  // über die geteilte feedback.json in fremde Übersichten.
  const scoped = isAuslastungFreigeschaltet()
    ? merged
    : merged.filter(item => !isAuslastungFeedback(item));
  if (!filters) return scoped;
  return scoped.filter(item => {
    if (filters.category && item.category !== filters.category) return false;
    if (filters.status && item.kurator_status !== filters.status) return false;
    if (filters.priority !== undefined && item.kurator_priority !== filters.priority) return false;
    return true;
  });
}

export async function getMyFeedback(storage: StorageService, userId: string): Promise<FeedbackItem[]> {
  const all = await getFeedbackList(storage);
  return all.filter(item => item.user_id === userId);
}

export async function updateFeedback(
  storage: StorageService,
  id: string,
  updates: Partial<Pick<
    FeedbackItem,
    'kurator_status' | 'kurator_notes' | 'kurator_response' | 'kurator_priority' | 'generated_prompt'
    | 'category' | 'structured' | 'attachments' | 'title'
    // `text`/`original_text` (v2.206): der geführte „verbessern"-Ablauf ersetzt
    // `text` durch die polierte Fassung und bewahrt das Original in `original_text`.
    | 'text' | 'original_text'
    // `updated_at` (v2.364): Zeitstempel des „Ergänzen"-Ablaufs — trägt die Anzeige
    // „bearbeitet am …" UND die Nutzertext-Precedence in `mergeItems`.
    | 'updated_at'
    | 'llm_summary' | 'llm_classification' | 'user_confirmed'
    | 'is_faq' | 'faq_answer' | 'faq_keywords' | 'faq_ask_count'
    | 'effort_estimate' | 'effort_hours' | 'votes' | 'comments'
  >>,
): Promise<void> {
  // Update local
  const items = loadLocalItems();
  const idx = items.findIndex(i => i.id === id);
  const localItem = idx >= 0 ? items[idx] : undefined;
  if (idx >= 0 && localItem) {
    items[idx] = { ...localItem, ...updates };
    saveLocalItems(items);
  }
  // Update shared (best-effort; writeSharedFile ist self-gated → no-op ohne readwrite)
  const shared = await readSharedFile(storage);
  if (shared) {
    const sharedIdx = shared.items.findIndex(i => i.id === id);
    const sharedItem = sharedIdx >= 0 ? shared.items[sharedIdx] : undefined;
    if (sharedIdx >= 0 && sharedItem) {
      shared.items[sharedIdx] = { ...sharedItem, ...updates };
    } else if (localItem) {
      shared.items.unshift({ ...localItem, ...updates });
    }
    await writeSharedFile(storage, shared.items);
  } else if (localItem) {
    await writeSharedFile(storage, [{ ...localItem, ...updates }]);
  }
  emitFeedbackUpdated();
}

/**
 * Hängt weitere Screenshots/Dateien an ein BESTEHENDES Ticket (v2.364,
 * „Ergänzen"-Ablauf des Autors). Schreibt die Bytes ins Shared-Attachment-
 * Verzeichnis und ergänzt danach die Referenzliste des Tickets.
 *
 * Nur für Clients mit Share-Schreibrecht: `writeSharedAttachment` ist self-gated
 * und liefert `false` ohne readwrite — dann bricht die Funktion ab, statt
 * Referenzen auf Dateien zu hinterlassen, die es nirgends gibt. Read-only-Nutzer
 * (prod) ergänzen über den Kommentar-Thread, der einen Outbox-Pfad hat.
 *
 * Liefert die neue, vollständige Referenzliste (bestehende + neue).
 */
export async function appendAttachments(
  storage: StorageService,
  ticketId: string,
  bestehende: readonly FeedbackAttachment[] | undefined,
  neue: readonly SubmitAttachment[],
): Promise<FeedbackAttachment[]> {
  if (neue.length === 0) return [...(bestehende ?? [])];
  const { refs, blobs } = buildAttachmentRefs(ticketId, neue);
  for (const a of blobs) {
    const ok = await writeSharedAttachment(storage, a.filename, a.blob);
    if (!ok) throw new Error('Anhänge konnten nicht auf dem Daten-Share gespeichert werden (kein Schreibrecht).');
  }
  const alle = [...(bestehende ?? []), ...refs];
  await updateFeedback(storage, ticketId, { attachments: alle, updated_at: new Date().toISOString() });
  return alle;
}

export async function deleteFeedback(storage: StorageService, id: string): Promise<void> {
  const items = loadLocalItems().filter(i => i.id !== id);
  saveLocalItems(items);
  // writeSharedFile self-gated → no-op ohne readwrite
  const shared = await readSharedFile(storage);
  if (shared) {
    const remaining = shared.items.filter(i => i.id !== id);
    await writeSharedFile(storage, remaining);
  }
  emitFeedbackUpdated();
}

// ── Config ──────────────────────────────────────────────────────────────────

export async function loadFeedbackConfig(_storage: StorageService): Promise<FeedbackConfig> {
  try {
    const raw = localStorage.getItem(FEEDBACK_CONFIG_LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FeedbackConfig>;
      return { ...DEFAULT_FEEDBACK_CONFIG, ...parsed };
    }
  } catch { /* ignore */ }
  return DEFAULT_FEEDBACK_CONFIG;
}

export async function saveFeedbackConfig(_storage: StorageService, cfg: FeedbackConfig): Promise<void> {
  try {
    localStorage.setItem(FEEDBACK_CONFIG_LS_KEY, JSON.stringify(cfg));
  } catch (err) {
    console.error('[feedbackService] saveFeedbackConfig failed:', err);
  }
}

export async function getSharedFileStatus(
  storage: StorageService,
): Promise<{ path: string; exists: boolean; itemCount: number; updatedAt?: string }> {
  const shared = await readSharedFile(storage);
  if (!shared) return { path: FEEDBACK_SHARED_FILE, exists: false, itemCount: 0 };
  return {
    path: FEEDBACK_SHARED_FILE,
    exists: true,
    itemCount: shared.items.length,
    updatedAt: shared.updated_at,
  };
}
