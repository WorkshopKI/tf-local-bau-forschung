/**
 * PersonalStorageService (v2.0).
 *
 * Stellt Lese-/Schreibzugriff auf den persoenlichen Ordner bereit (User-Home
 * via SMB_HANDLE_PERSOENLICH). Faellt auf den IDB-Cache zurueck wenn der Share
 * nicht erreichbar ist.
 *
 * Feedback-Outbox: User schreibt seine Tickets in
 * `teamflow/feedback/outbox/<datum>-<id>.json` und eine Kopie in
 * `teamflow/feedback/meine-feedbacks.json`. Kurator sammelt im
 * FeedbackInboxTab ein und schreibt Status-Updates zurueck in die
 * jeweilige Outbox-Datei des Users.
 */

import { IDBStore } from '@/core/services/storage/idb-store';
import {
  atomicWrite,
  readText,
  ensurePersoenlichFolders,
} from '@/core/services/infrastructure';
import {
  PERSOENLICH_FEEDBACK_OUTBOX_DIR,
  PERSOENLICH_MEINE_FEEDBACKS_FILE,
} from '@/core/services/infrastructure/types';
import type { UserProfile } from '@/core/types/config';
import {
  DEFAULT_EINSTELLUNGEN,
  isNewer,
  readEinstellungenFromShare,
  readProfileFromShare,
  writeEinstellungenToShare,
  writeProfileToShare,
} from './sync';
import {
  PERSONAL_EINSTELLUNGEN_IDB_KEY,
  PERSONAL_PROFILE_IDB_KEY,
  type FeedbackOutboxItem,
  type PersonalEinstellungen,
  type PersonalStorage,
} from './types';

/**
 * Laedt Personal-Storage mit Fallback-Kaskade:
 *   pers. Laufwerk (wenn handle vorhanden + erreichbar)
 *   → IDB-Cache
 *   → Defaults
 *
 * Schreibt das gelesene Ergebnis in den IDB-Cache, damit auch ein Reload
 * ohne Share funktioniert.
 */
export async function loadPersonalSettings(
  idb: IDBStore,
  persHandle: FileSystemDirectoryHandle | null,
  fallbackProfile: UserProfile,
): Promise<PersonalStorage> {
  // Defaults aus den uebergebenen IDB-Werten und Defaults
  const cachedProfile = (await idb.get<UserProfile>(PERSONAL_PROFILE_IDB_KEY)) ?? fallbackProfile;
  const cachedEinstellungen =
    (await idb.get<PersonalEinstellungen>(PERSONAL_EINSTELLUNGEN_IDB_KEY)) ?? DEFAULT_EINSTELLUNGEN;

  if (!persHandle) {
    return { profile: cachedProfile, einstellungen: cachedEinstellungen };
  }

  // Vom Share lesen — best-effort
  let shareProfile: UserProfile | null = null;
  let shareEinstellungen: PersonalEinstellungen | null = null;
  try {
    [shareProfile, shareEinstellungen] = await Promise.all([
      readProfileFromShare(persHandle),
      readEinstellungenFromShare(persHandle),
    ]);
  } catch {
    return { profile: cachedProfile, einstellungen: cachedEinstellungen };
  }

  // Last-Writer-Wins via updatedAt-Timestamp (nur Einstellungen — Profil hat keinen Timestamp)
  const profile = shareProfile ?? cachedProfile;
  const einstellungen = isNewer(shareEinstellungen?.updatedAt, cachedEinstellungen.updatedAt)
    ? (shareEinstellungen as PersonalEinstellungen)
    : cachedEinstellungen;

  // Cache aktualisieren
  await Promise.all([
    idb.set(PERSONAL_PROFILE_IDB_KEY, profile),
    idb.set(PERSONAL_EINSTELLUNGEN_IDB_KEY, einstellungen),
  ]);

  return { profile, einstellungen };
}

/**
 * Speichert Profil + Einstellungen.
 *
 * Schreibt IMMER in IDB sofort. Schreibt zusaetzlich auf den persoenlichen
 * Ordner wenn `persHandle` vorhanden ist und Permission greift. Faellt bei
 * Fehler stillschweigend zurueck (Offline-Schreibvorgang akzeptabel) — IDB
 * ist Source-of-Truth bis zum naechsten erfolgreichen Sync.
 */
export async function savePersonalSettings(
  idb: IDBStore,
  persHandle: FileSystemDirectoryHandle | null,
  partial: { profile?: UserProfile; einstellungen?: Partial<PersonalEinstellungen> },
): Promise<void> {
  if (partial.profile) {
    await idb.set(PERSONAL_PROFILE_IDB_KEY, partial.profile);
  }

  let einstellungenToWrite: PersonalEinstellungen | null = null;
  if (partial.einstellungen) {
    const current =
      (await idb.get<PersonalEinstellungen>(PERSONAL_EINSTELLUNGEN_IDB_KEY)) ?? DEFAULT_EINSTELLUNGEN;
    const next: PersonalEinstellungen = {
      ...current,
      ...partial.einstellungen,
      version: 1,
      updatedAt: new Date().toISOString(),
    };
    einstellungenToWrite = next;
    await idb.set(PERSONAL_EINSTELLUNGEN_IDB_KEY, next);
  }

  if (!persHandle) return;

  try {
    await ensurePersoenlichFolders(persHandle);
    const writes: Promise<void>[] = [];
    if (partial.profile) writes.push(writeProfileToShare(persHandle, partial.profile));
    if (einstellungenToWrite) writes.push(writeEinstellungenToShare(persHandle, einstellungenToWrite));
    await Promise.all(writes);
  } catch {
    // Best-effort — IDB ist bereits geschrieben, beim naechsten Online-Start
    // syncen wir den Share.
  }
}

function makeOutboxFilename(submittedAt: string, id: string): string {
  const datum = submittedAt.slice(0, 10);
  return `${datum}-${id}.json`;
}

/**
 * Schreibt ein Feedback-Item in die Outbox des Users. Eine Datei pro Item
 * (atomar). Aktualisiert zusaetzlich `meine-feedbacks.json` (Kopie aller
 * eigenen Feedbacks).
 *
 * Wirft wenn der Handle nicht beschreibbar ist — Aufrufer muss
 * Permission-Status vorher pruefen.
 */
export async function submitFeedback(
  persHandle: FileSystemDirectoryHandle,
  kuerzel: string,
  item: Omit<FeedbackOutboxItem, 'status'> & { status?: FeedbackOutboxItem['status'] },
): Promise<FeedbackOutboxItem> {
  await ensurePersoenlichFolders(persHandle);
  const full: FeedbackOutboxItem = {
    ...item,
    kuerzel: kuerzel || 'unbekannt',
    status: item.status ?? 'pending',
  };
  const filename = makeOutboxFilename(full.submitted_at, full.id);
  const path = `${PERSOENLICH_FEEDBACK_OUTBOX_DIR}/${filename}`;
  await atomicWrite(persHandle, path, JSON.stringify(full, null, 2));

  // meine-feedbacks.json fortschreiben
  const existing = await loadMyFeedback(persHandle);
  const filtered = existing.filter(x => x.id !== full.id);
  filtered.push(full);
  await atomicWrite(persHandle, PERSOENLICH_MEINE_FEEDBACKS_FILE, JSON.stringify(filtered, null, 2));

  return full;
}

export async function loadMyFeedback(
  persHandle: FileSystemDirectoryHandle,
): Promise<FeedbackOutboxItem[]> {
  const txt = await readText(persHandle, PERSOENLICH_MEINE_FEEDBACKS_FILE);
  if (!txt) return [];
  try {
    const parsed = JSON.parse(txt);
    if (Array.isArray(parsed)) return parsed as FeedbackOutboxItem[];
    return [];
  } catch {
    return [];
  }
}

/** Outbox-Path-Helper fuer Kurator-seitiges Status-Update einer User-Outbox-Datei. */
export function outboxItemPath(item: FeedbackOutboxItem): string {
  return `${PERSOENLICH_FEEDBACK_OUTBOX_DIR}/${makeOutboxFilename(item.submitted_at, item.id)}`;
}

/** Liest alle Outbox-Dateien in einem (fremden) User-Ordner — fuer den Kurator-FeedbackInboxTab. */
export async function listOutboxItems(
  userTeamflowDir: FileSystemDirectoryHandle,
): Promise<FeedbackOutboxItem[]> {
  let outbox: FileSystemDirectoryHandle;
  try {
    const fb = await userTeamflowDir.getDirectoryHandle('feedback');
    outbox = await fb.getDirectoryHandle('outbox');
  } catch {
    return [];
  }
  const items: FeedbackOutboxItem[] = [];
  for await (const entry of (outbox as FileSystemDirectoryHandle & {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }).values()) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
    try {
      const fh = await outbox.getFileHandle(entry.name);
      const f = await fh.getFile();
      const parsed = JSON.parse(await f.text()) as FeedbackOutboxItem;
      if (parsed && parsed.id) items.push(parsed);
    } catch {
      /* skip malformed */
    }
  }
  return items;
}

/**
 * Schreibt den Status (z.B. 'approved' / 'rejected') in die Outbox-Datei des
 * Users zurueck. `userTeamflowDir` ist der `teamflow/`-Ordner des Users im
 * User-Folders-Root — Kurator-Pfad.
 */
export async function writeOutboxStatus(
  userTeamflowDir: FileSystemDirectoryHandle,
  item: FeedbackOutboxItem,
): Promise<void> {
  const filename = makeOutboxFilename(item.submitted_at, item.id);
  const path = `feedback/outbox/${filename}`;
  await atomicWrite(userTeamflowDir, path, JSON.stringify(item, null, 2));
}
