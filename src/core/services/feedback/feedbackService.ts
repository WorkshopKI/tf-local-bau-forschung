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
  readSharedFileLage,
  writeSharedAttachment,
  writeSharedFile,
  writeSharedFileLage,
} from './feedbackSharedFile';
import type { SchreibLage } from './feedbackSharedFile';
import { istMeinTicket } from './feedbackIdentitaet';
import type { MeineIdentitaet } from './feedbackIdentitaet';
import { isAuslastungFeedback } from './feedbackClassification';
import { isAuslastungFreigeschaltet } from '@/core/modul-freischaltung';
import { getDatenShareHandle } from '@/core/services/infrastructure/smb-handle';
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
  // `unlesbar` NICHT als „nichts Geteiltes" behandeln (v3.7): sonst überschriebe
  // der Write den gesamten Teambestand mit diesem einen neuen Ticket. Das lokale
  // Item ist zu diesem Zeitpunkt schon gespeichert und geht nicht verloren.
  const lage = await readSharedFileLage(storage);
  if (lage.status === 'unlesbar') {
    throw new Error(
      'Die geteilte Feedback-Datei ist gerade nicht lesbar — dein Feedback liegt lokal, ist aber noch nicht beim Team. Bitte gleich noch einmal versuchen.',
    );
  }
  const merged = lage.status === 'ok' ? mergeItems([item], lage.datei.items) : [item];
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

/**
 * Eigener Verlauf. Nimmt die ganze Identität, nicht eine Id: Bestands-Tickets
 * tragen die frühere Schreibweise (siehe `feedbackIdentitaet`).
 */
export async function getMyFeedback(
  storage: StorageService,
  ich: MeineIdentitaet,
): Promise<FeedbackItem[]> {
  const all = await getFeedbackList(storage);
  return all.filter(item => istMeinTicket(item, ich));
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
    // `assignee`/`bereich` (v3.12): Kurator-Felder der Inline-Verwaltung am
    // Board — shared-wins beim Merge, deshalb NICHT im Nutzerfeld-Block.
    | 'assignee' | 'bereich'
  >>,
): Promise<void> {
  // ZUERST die Lage des geteilten Stands (v3.7). Auf `unlesbar` darf hier nichts
  // weiterlaufen: der frühere Code machte daraus „nichts Geteiltes" und schrieb
  // eine geteilte Datei aus dem EINEN lokalen Item — der Teambestand wäre damit
  // auf ein Ticket eingedampft. Gleiche Klasse wie der Kommentar-Verlust v3.0.1.
  const lage = await readSharedFileLage(storage);
  if (lage.status === 'unlesbar') {
    throw new Error(
      'Die geteilte Feedback-Datei ist gerade nicht lesbar — es wurde nichts gespeichert. Bitte gleich noch einmal versuchen.',
    );
  }

  // Update local
  const items = loadLocalItems();
  const idx = items.findIndex(i => i.id === id);
  const localItem = idx >= 0 ? items[idx] : undefined;
  if (idx >= 0 && localItem) {
    items[idx] = { ...localItem, ...updates };
    saveLocalItems(items);
  }
  // Update shared. `kein-schreibrecht` bleibt still (read-only prod ist per
  // Design ein No-op), ein echter Schreibfehler wird gemeldet statt als Erfolg
  // quittiert — useAsyncAction der Aufrufer zeigt ihn dann von selbst.
  const shared = lage.status === 'ok' ? lage.datei : null;
  let schreib: SchreibLage = 'kein-schreibrecht';
  if (shared) {
    const sharedIdx = shared.items.findIndex(i => i.id === id);
    const sharedItem = sharedIdx >= 0 ? shared.items[sharedIdx] : undefined;
    if (sharedIdx >= 0 && sharedItem) {
      shared.items[sharedIdx] = { ...sharedItem, ...updates };
    } else if (localItem) {
      shared.items.unshift({ ...localItem, ...updates });
    }
    schreib = await writeSharedFileLage(storage, shared.items);
  } else if (localItem) {
    schreib = await writeSharedFileLage(storage, [{ ...localItem, ...updates }]);
  }
  emitFeedbackUpdated();
  if (schreib === 'fehler') {
    throw new Error('Änderung konnte nicht auf den Daten-Share geschrieben werden.');
  }
}

/**
 * Dieselbe Änderung auf VIELE Tickets (v3.18, Bulk-Leiste des Boards).
 *
 * Bewusst eine eigene Funktion statt `updateFeedback` in einer Schleife: die
 * Einzelfassung liest und schreibt die geteilte Datei je Ticket. Bei fünfzig
 * markierten Tickets wären das fünfzig Lese-/Schreibrunden über SMB — langsam,
 * und jede Runde ein eigenes Zeitfenster, in dem ein zweiter Client dazwischen
 * schreiben kann (last-writer-wins). Hier: EINMAL die Lage lesen, alle Patches
 * anwenden, EINMAL schreiben.
 *
 * Die Invarianten bleiben die der Einzelfassung: bei `unlesbar` wird nichts
 * angefasst, `kein-schreibrecht` bleibt still (read-only prod ist per Design ein
 * No-op), ein echter Schreibfehler wirft.
 */
export async function updateFeedbackMany(
  storage: StorageService,
  ids: readonly string[],
  updates: Partial<Pick<
    FeedbackItem,
    'kurator_status' | 'effort_estimate' | 'effort_hours' | 'assignee' | 'bereich'
  >>,
): Promise<void> {
  if (ids.length === 0) return;
  const lage = await readSharedFileLage(storage);
  if (lage.status === 'unlesbar') {
    throw new Error(
      'Die geteilte Feedback-Datei ist gerade nicht lesbar — es wurde nichts gespeichert. Bitte gleich noch einmal versuchen.',
    );
  }
  const idSet = new Set(ids);

  const items = loadLocalItems();
  let lokalGeaendert = false;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item && idSet.has(item.id)) {
      items[i] = { ...item, ...updates };
      lokalGeaendert = true;
    }
  }
  if (lokalGeaendert) saveLocalItems(items);

  const shared = lage.status === 'ok' ? lage.datei : null;
  let schreib: SchreibLage = 'kein-schreibrecht';
  if (shared) {
    shared.items = shared.items.map(i => (idSet.has(i.id) ? { ...i, ...updates } : i));
    schreib = await writeSharedFileLage(storage, shared.items);
  }
  emitFeedbackUpdated();
  if (schreib === 'fehler') {
    throw new Error('Änderung konnte nicht auf den Daten-Share geschrieben werden.');
  }
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
  // Erst die Lage: auf einem unlesbaren Stand verschwände das Ticket nur lokal,
  // während es beim Team stehen bliebe — und der Nutzer hielte es für gelöscht.
  const lage = await readSharedFileLage(storage);
  if (lage.status === 'unlesbar') {
    throw new Error(
      'Die geteilte Feedback-Datei ist gerade nicht lesbar — es wurde nichts gelöscht. Bitte gleich noch einmal versuchen.',
    );
  }
  const items = loadLocalItems().filter(i => i.id !== id);
  saveLocalItems(items);
  // Schreiben ist self-gated → no-op ohne readwrite; ein echter Fehler wird gemeldet.
  let schreib: SchreibLage = 'kein-schreibrecht';
  if (lage.status === 'ok') {
    const remaining = lage.datei.items.filter(i => i.id !== id);
    schreib = await writeSharedFileLage(storage, remaining);
  }
  emitFeedbackUpdated();
  if (schreib === 'fehler') {
    throw new Error('Löschen konnte nicht auf den Daten-Share geschrieben werden.');
  }
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

export interface SharedFileStatus {
  path: string;
  /** `ok` = gelesen · `fehlt` = Share da, Datei noch nicht · `unlesbar` = Datei da, aber nicht lesbar · `kein-share` = kein Daten-Share verbunden. */
  lage: 'ok' | 'fehlt' | 'unlesbar' | 'kein-share';
  exists: boolean;
  itemCount: number;
  updatedAt?: string;
}

/**
 * Status der geteilten Datei für den Einstellungen-Reiter. Unterscheidet seit
 * v3.7 „kein Share verbunden" von „Datei noch nicht angelegt" von „Datei da,
 * aber gerade nicht lesbar" — vorher war alles drei ein `exists: false`, und die
 * Oberfläche riet daneben mit einem eigenen (falschen) Verbunden-Check.
 */
export async function getSharedFileStatus(storage: StorageService): Promise<SharedFileStatus> {
  const handle = await getDatenShareHandle(storage.idb);
  if (!handle) return { path: FEEDBACK_SHARED_FILE, lage: 'kein-share', exists: false, itemCount: 0 };
  const lage = await readSharedFileLage(storage);
  if (lage.status === 'unlesbar') {
    return { path: FEEDBACK_SHARED_FILE, lage: 'unlesbar', exists: true, itemCount: 0 };
  }
  if (lage.status === 'leer') {
    return { path: FEEDBACK_SHARED_FILE, lage: 'fehlt', exists: false, itemCount: 0 };
  }
  return {
    path: FEEDBACK_SHARED_FILE,
    lage: 'ok',
    exists: true,
    itemCount: lage.datei.items.length,
    updatedAt: lage.datei.updated_at,
  };
}
