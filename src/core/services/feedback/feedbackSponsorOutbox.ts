/**
 * Sponsoring-Stimmen im persoenlichen Ordner (v2.32).
 *
 * Read-only prod-Enduser koennen `_intern/feedback/feedback.json` nicht
 * schreiben (v2.0-Read-Only-Daten-Share). Ihre Punkte-Stimmen fuers Feedback-
 * Board landen deshalb hier in `ZAH/feedback/sponsor-wuensche.json` (Map
 * `ticketId → Punkte`); der Kurator sammelt sie ueber den User-Folders-Root ein
 * (`autoCollectSponsorVotes`) und merged sie in die zentrale feedback.json
 * (`mergeSponsorVotesIntoItems`). Spiegelbild von `uebernahme-wuensche.ts`.
 *
 * Cross-Browser-Strategie (analog Übernahme-Wünsche):
 *   - Schreiben: IMMER IDB-Cache, zusaetzlich persoenlicher Ordner wenn Handle da.
 *   - Lesen: persoenlicher Ordner (Source-of-Truth) → IDB-Cache → null.
 *   - LWW ueber `updatedAt` — der neuere Stand gewinnt, Cache wird angeglichen.
 *
 * Sidecar-Profil (Pitfall #23): idempotent-overwrite / Single-Source pro User →
 * `atomicWrite` MIT Backup-Rotation (Default). Die Datei ist klein
 * (`ticketId → Punkte`), daher keine `skipBackup`-Ausnahme noetig.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import { PERSOENLICH_FEEDBACK_SPONSOR_FILE } from '@/core/services/infrastructure/types';

/** IDB-Cache-Key (browser-lokal). Domain-lokal wie der Übernahme-Pendant. */
export const SPONSOR_VOTES_IDB_KEY = 'sponsor-votes-local';

export interface SponsorVoteFile {
  version: 1;
  /** Identitaet des Users (= `useMeinKuerzel() ?? profile.name`). */
  kuerzel: string;
  /** Punkte je Feedback-Ticket. `0` bzw. fehlender Key = keine Stimme. */
  votes: Record<string, number>;
  updatedAt: string;
}

function isNewer(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a) return false;
  if (!b) return true;
  return Date.parse(a) > Date.parse(b);
}

/** Strukturelle Validierung einer roh gelesenen Stimmen-Datei. */
export function isValidSponsorVoteFile(raw: unknown): raw is SponsorVoteFile {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Record<string, unknown>;
  if (p.version !== 1) return false;
  if (typeof p.kuerzel !== 'string') return false;
  if (typeof p.updatedAt !== 'string') return false;
  if (!p.votes || typeof p.votes !== 'object') return false;
  return Object.values(p.votes as Record<string, unknown>).every(v => typeof v === 'number');
}

/**
 * Liest die Stimmen-Datei aus einem User-Home-Root-Handle. Funktioniert sowohl
 * fuer den eigenen Persoenlich-Handle als auch fuer einen fremden User-Ordner
 * (Einsammel-Schritt) — der Pfad ist relativ zum User-Home identisch.
 */
export async function readSponsorVotesFromDir(
  handle: FileSystemDirectoryHandle,
): Promise<SponsorVoteFile | null> {
  const txt = await readText(handle, PERSOENLICH_FEEDBACK_SPONSOR_FILE);
  if (!txt) return null;
  try {
    const parsed = JSON.parse(txt);
    return isValidSponsorVoteFile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Speichert die eigenen Sponsoring-Stimmen. Schreibt IMMER den IDB-Cache;
 * schreibt zusaetzlich den persoenlichen Ordner wenn `persHandle` vorhanden ist.
 *
 * Wirft NICHT (anders als `writeUebernahmeWuensche`): der Aufrufer
 * (`sponsorTicket`) laeuft im read-only-Fall best-effort und meldet ueber ein
 * weiches `warning`, dass der persoenliche Ordner fehlt. Gibt zurueck, ob die
 * Datei wirklich im persoenlichen Ordner landete.
 */
export async function writeSponsorVotes(
  idb: IDBStore,
  persHandle: FileSystemDirectoryHandle | null,
  data: SponsorVoteFile,
): Promise<boolean> {
  await idb.set(SPONSOR_VOTES_IDB_KEY, data);
  if (!persHandle) return false;
  try {
    await atomicWrite(
      persHandle,
      PERSOENLICH_FEEDBACK_SPONSOR_FILE,
      JSON.stringify(data, null, 2),
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Laedt die eigenen Stimmen mit Cross-Browser-Kaskade:
 *   persoenlicher Ordner (Share) → IDB-Cache → null.
 * Bei beidseitigem Treffer gewinnt der neuere `updatedAt`; der Cache wird auf
 * den Gewinner angeglichen.
 */
export async function loadSponsorVotes(
  idb: IDBStore,
  persHandle: FileSystemDirectoryHandle | null,
): Promise<SponsorVoteFile | null> {
  const cached = (await idb.get<SponsorVoteFile>(SPONSOR_VOTES_IDB_KEY)) ?? null;
  if (!persHandle) return cached;

  let share: SponsorVoteFile | null = null;
  try {
    share = await readSponsorVotesFromDir(persHandle);
  } catch {
    return cached;
  }
  if (!share) return cached;

  const winner = isNewer(share.updatedAt, cached?.updatedAt) ? share : (cached ?? share);
  await idb.set(SPONSOR_VOTES_IDB_KEY, winner);
  return winner;
}
