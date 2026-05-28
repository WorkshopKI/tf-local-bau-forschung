/**
 * MA-Selbst-Profil im persoenlichen Ordner (v2.6).
 *
 * Schreibt/liest `teamflow/auslastung-profil.json` ueber den Persoenlich-Handle
 * (immer `readwrite`) — der Workaround fuer das v2.0-Read-Only-Daten-Share
 * (siehe CLAUDE.md: Nicht-Kuratoren koennen `auslastung.json` nicht schreiben).
 *
 * Cross-Browser-Strategie (analog `personal-storage/service.ts`):
 *   - Schreiben: IMMER IDB-Cache, zusaetzlich persoenlicher Ordner wenn Handle da.
 *   - Lesen: persoenlicher Ordner (Source-of-Truth) → IDB-Cache → null.
 *   - LWW ueber `updatedAt` — der neuere Stand gewinnt, Cache wird angeglichen.
 *
 * Begruendung Cross-Browser: Der IDB-Cache ist browser-scoped; ein User nutzt
 * mobil + vor Ort zwei Browser. Der persoenliche Ordner ist die invariante
 * Quelle, deshalb wird beim Tab-Mount von dort gelesen.
 */
import type { IDBStore } from '@/core/services/storage/idb-store';
import { atomicWrite, readText } from '@/core/services/infrastructure/atomic-write';
import { PERSOENLICH_AUSLASTUNG_PROFIL_FILE } from '@/core/services/infrastructure/types';
import {
  PERSOENLICH_AUSLASTUNG_PROFIL_IDB_KEY,
  type PersoenlichesAuslastungProfil,
} from '../types';

function isNewer(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a) return false;
  if (!b) return true;
  return Date.parse(a) > Date.parse(b);
}

/** Strukturelle Validierung eines roh gelesenen Profils. */
export function isValidProfil(raw: unknown): raw is PersoenlichesAuslastungProfil {
  if (!raw || typeof raw !== 'object') return false;
  const p = raw as Record<string, unknown>;
  return (
    p.version === 1 &&
    typeof p.kuerzel === 'string' &&
    Array.isArray(p.manuelleTechnologien) &&
    Array.isArray(p.ausgeblendeteAutoTags) &&
    typeof p.hauptKategorie === 'string' &&
    Array.isArray(p.nebenKategorien) &&
    Array.isArray(p.antragstypBevorzugt) &&
    typeof p.updatedAt === 'string'
  );
}

/**
 * Liest das Profil aus einem User-Home-Root-Handle. Funktioniert sowohl fuer
 * den eigenen Persoenlich-Handle als auch fuer einen fremden User-Ordner
 * (Einsammel-Schritt) — der Pfad `teamflow/auslastung-profil.json` ist in
 * beiden Faellen relativ zum User-Home identisch.
 */
export async function readAuslastungProfilFromShare(
  handle: FileSystemDirectoryHandle,
): Promise<PersoenlichesAuslastungProfil | null> {
  const txt = await readText(handle, PERSOENLICH_AUSLASTUNG_PROFIL_FILE);
  if (!txt) return null;
  try {
    const parsed = JSON.parse(txt);
    return isValidProfil(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Speichert das eigene Profil. Schreibt IMMER den IDB-Cache; schreibt
 * zusaetzlich den persoenlichen Ordner wenn `persHandle` vorhanden ist.
 *
 * Wirft, wenn kein persoenlicher Ordner verbunden ist — der Aufrufer soll das
 * sichtbar machen (Pitfall #15), der lokale Cache ist aber bereits geschrieben,
 * sodass ein spaeterer Online-Save bzw. ein erneutes Verbinden den Stand
 * uebertraegt.
 */
export async function writeAuslastungProfil(
  idb: IDBStore,
  persHandle: FileSystemDirectoryHandle | null,
  profil: PersoenlichesAuslastungProfil,
): Promise<void> {
  await idb.set(PERSOENLICH_AUSLASTUNG_PROFIL_IDB_KEY, profil);
  if (!persHandle) {
    throw new Error(
      'Persönlicher Ordner nicht verbunden — deine Technologien sind lokal gespeichert, ' +
        'aber das Team sieht sie erst, wenn du den persönlichen Ordner unter ' +
        'Einstellungen → Speicher verbindest.',
    );
  }
  await atomicWrite(
    persHandle,
    PERSOENLICH_AUSLASTUNG_PROFIL_FILE,
    JSON.stringify(profil, null, 2),
  );
}

/**
 * Laedt das eigene Profil mit Cross-Browser-Kaskade:
 *   persoenlicher Ordner (Share) → IDB-Cache → null.
 * Bei beidseitigem Treffer gewinnt der neuere `updatedAt`; der Cache wird auf
 * den Gewinner angeglichen.
 */
export async function loadAuslastungProfil(
  idb: IDBStore,
  persHandle: FileSystemDirectoryHandle | null,
): Promise<PersoenlichesAuslastungProfil | null> {
  const cached = (await idb.get<PersoenlichesAuslastungProfil>(
    PERSOENLICH_AUSLASTUNG_PROFIL_IDB_KEY,
  )) ?? null;
  if (!persHandle) return cached;

  let share: PersoenlichesAuslastungProfil | null = null;
  try {
    share = await readAuslastungProfilFromShare(persHandle);
  } catch {
    return cached;
  }
  if (!share) return cached;

  const winner = isNewer(share.updatedAt, cached?.updatedAt) ? share : (cached ?? share);
  await idb.set(PERSOENLICH_AUSLASTUNG_PROFIL_IDB_KEY, winner);
  return winner;
}
