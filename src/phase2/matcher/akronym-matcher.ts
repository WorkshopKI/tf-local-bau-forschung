/**
 * Akronym-Matcher — nutzt den bestehenden `akronym_index`-Store.
 *
 * Ein Akronym kann auf mehrere Anträge zeigen (`AkronymIndexEntry.aktenzeichen`
 * ist ein `string[]`) — das ist der "mehrdeutig"-Fall: Caller bekommt die
 * Kandidaten zurück und routet das Dokument in die Review-Queue.
 *
 * Wir matchen NUR bekannte Akronyme. Akronym-Strings, die zwar wie Akronyme
 * aussehen aber nicht im Index stehen, werden ignoriert.
 */

import type { IDBStore } from '../../core/services/storage/idb-store';
import {
  getAkronymEntry,
  listAkronymIndexByProgramm,
  listAntraegeByAkronym,
} from '../../core/services/csv/idb-csv';

export interface AkronymMatch {
  akronym: string;
  candidate_antrag_ids: string[];
}

/**
 * Sucht das erste bekannte Akronym aus dem `akronym_index` (gefiltert auf
 * `programmId`) im gegebenen Text. Match ist case-sensitive und auf
 * Word-Boundaries (Akronyme sind Großbuchstaben-Strings).
 *
 * Liefert das erste Treffer-Akronym + die zugehörigen Aktenzeichen-Kandidaten.
 */
export async function findKnownAkronym(
  idb: IDBStore,
  programmId: string,
  text: string,
): Promise<AkronymMatch | null> {
  if (!text) return null;
  const entries = await listAkronymIndexByProgramm(idb, programmId);
  if (entries.length === 0) return null;
  // Längere Akronyme zuerst — verhindert Substring-Treffer
  // (z.B. "ABCD" käme vor "ABC")
  entries.sort((a, b) => b.akronym.length - a.akronym.length);
  for (const e of entries) {
    if (!e.akronym || e.akronym.length < 2) continue;
    const escaped = e.akronym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`);
    if (re.test(text)) {
      return { akronym: e.akronym, candidate_antrag_ids: e.aktenzeichen.slice() };
    }
  }
  return null;
}

/**
 * Lookup für ein bereits bekanntes Akronym (z.B. aus Stage 0 schon gefunden).
 * Programm-spezifisch über Index, mit Fallback auf programm-übergreifenden
 * Antraege-Index.
 */
export async function lookupAkronymCandidates(
  idb: IDBStore,
  programmId: string,
  akronym: string,
): Promise<string[]> {
  const entry = await getAkronymEntry(idb, programmId, akronym);
  if (entry && entry.aktenzeichen.length > 0) return entry.aktenzeichen.slice();
  // Programm-Fallback: könnte sein dass der Antrag in einem anderen Programm liegt
  const found = await listAntraegeByAkronym(idb, akronym);
  return found.map(a => a.aktenzeichen);
}
