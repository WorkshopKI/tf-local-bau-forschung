/**
 * Übernahme-Wünsche im persoenlichen Ordner (v2.9).
 *
 * Schreibt/liest `ZAH/auslastung-uebernahme.json` ueber den Persoenlich-Handle
 * (immer `readwrite`) — der Workaround fuer das v2.0-Read-Only-Daten-Share:
 * Nicht-Kuratoren koennen `auslastung.json` nicht schreiben (siehe CLAUDE.md
 * Pitfall #24). Spiegelbild von `persoenliches-profil.ts`.
 *
 * Cross-Browser-Strategie (analog Profil + `personal-storage/service.ts`):
 *   - Schreiben: IMMER IDB-Cache, zusaetzlich persoenlicher Ordner wenn Handle da.
 *   - Lesen: persoenlicher Ordner (Source-of-Truth) → IDB-Cache → null.
 *   - LWW ueber `updatedAt` — der neuere Stand gewinnt, Cache wird angeglichen.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import { PERSOENLICH_AUSLASTUNG_UEBERNAHME_FILE } from '@/core/services/infrastructure/types';
import {
  PERSOENLICH_AUSLASTUNG_UEBERNAHME_IDB_KEY,
  type PersoenlicheUebernahmeWuensche,
  type UebernahmeWunsch,
} from '../types';

function isNewer(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a) return false;
  if (!b) return true;
  return Date.parse(a) > Date.parse(b);
}

function isValidWunsch(raw: unknown): raw is UebernahmeWunsch {
  if (!raw || typeof raw !== 'object') return false;
  const w = raw as Record<string, unknown>;
  return (
    typeof w.antragId === 'string' &&
    typeof w.quartal === 'string' &&
    typeof w.anzahlTV === 'number' &&
    typeof w.createdAt === 'string'
  );
}

/** Strukturelle Validierung einer roh gelesenen Wunsch-Datei. */
export function isValidUebernahme(raw: unknown): raw is PersoenlicheUebernahmeWuensche {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Record<string, unknown>;
  return (
    p.version === 1 &&
    typeof p.kuerzel === 'string' &&
    Array.isArray(p.wuensche) &&
    p.wuensche.every(isValidWunsch) &&
    typeof p.updatedAt === 'string'
  );
}

/**
 * Liest die Wunsch-Datei aus einem User-Home-Root-Handle. Funktioniert sowohl
 * fuer den eigenen Persoenlich-Handle als auch fuer einen fremden User-Ordner
 * (Einsammel-Schritt) — der Pfad ist in beiden Faellen relativ zum User-Home
 * identisch.
 */
export async function readUebernahmeFromShare(
  handle: FileSystemDirectoryHandle,
): Promise<PersoenlicheUebernahmeWuensche | null> {
  const txt = await readText(handle, PERSOENLICH_AUSLASTUNG_UEBERNAHME_FILE);
  if (!txt) return null;
  try {
    const parsed = JSON.parse(txt);
    return isValidUebernahme(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Speichert die eigenen Übernahme-Wünsche. Schreibt IMMER den IDB-Cache;
 * schreibt zusaetzlich den persoenlichen Ordner wenn `persHandle` vorhanden ist.
 *
 * Wirft, wenn kein persoenlicher Ordner verbunden ist — der Aufrufer soll das
 * sichtbar machen (Pitfall #15). Der lokale Cache ist dann bereits geschrieben,
 * sodass ein spaeteres Verbinden den Stand uebertraegt.
 */
export async function writeUebernahmeWuensche(
  idb: IDBStore,
  persHandle: FileSystemDirectoryHandle | null,
  data: PersoenlicheUebernahmeWuensche,
): Promise<void> {
  await idb.set(PERSOENLICH_AUSLASTUNG_UEBERNAHME_IDB_KEY, data);
  if (!persHandle) {
    throw new Error(
      'Persönlicher Ordner nicht verbunden — dein Übernahme-Wunsch ist lokal gespeichert, ' +
        'aber die Projektleitung sieht ihn erst, wenn du den persönlichen Ordner unter ' +
        'Einstellungen → Speicher verbindest.',
    );
  }
  await atomicWrite(
    persHandle,
    PERSOENLICH_AUSLASTUNG_UEBERNAHME_FILE,
    JSON.stringify(data, null, 2),
  );
}

/**
 * Laedt die eigenen Wünsche mit Cross-Browser-Kaskade:
 *   persoenlicher Ordner (Share) → IDB-Cache → null.
 * Bei beidseitigem Treffer gewinnt der neuere `updatedAt`; der Cache wird auf
 * den Gewinner angeglichen.
 */
export async function loadUebernahmeWuensche(
  idb: IDBStore,
  persHandle: FileSystemDirectoryHandle | null,
): Promise<PersoenlicheUebernahmeWuensche | null> {
  const cached = (await idb.get<PersoenlicheUebernahmeWuensche>(
    PERSOENLICH_AUSLASTUNG_UEBERNAHME_IDB_KEY,
  )) ?? null;
  if (!persHandle) return cached;

  let share: PersoenlicheUebernahmeWuensche | null = null;
  try {
    share = await readUebernahmeFromShare(persHandle);
  } catch {
    return cached;
  }
  if (!share) return cached;

  const winner = isNewer(share.updatedAt, cached?.updatedAt) ? share : (cached ?? share);
  await idb.set(PERSOENLICH_AUSLASTUNG_UEBERNAHME_IDB_KEY, winner);
  return winner;
}
