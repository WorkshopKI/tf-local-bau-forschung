/**
 * Matcher-Orchestrator: kombiniert FKZ- und Akronym-Lookup zu einem
 * `MatchResult` mit confidence + Konflikt-Flag.
 *
 * Regeln (Brief):
 *   FKZ extrahiert + in antraege-Store    → matched, high,   method=fkz
 *   FKZ extrahiert + nicht im Store       → orphan,  low,    method=fkz
 *   Akronym + eindeutig (1 aktenzeichen)  → matched, medium, method=akronym
 *   Akronym + mehrdeutig (>1 aktenzeichen)→ review,  low,    method=akronym
 *                                          + candidate_antrag_ids gefüllt
 *   Beides + Widerspruch                  → review,  flag_conflict
 *   Nichts                                → orphan,  requires_review
 */

import type { IDBStore } from '../../core/services/storage/idb-store';
import { getAntrag } from '../../core/services/csv/idb-csv';
import type { MatchResult } from '../types';
import { lookupAkronymCandidates } from './akronym-matcher';

export interface MatchInput {
  fkz?: string | null;
  akronym?: string | null;
  programmId: string;
}

/** Wrapper: existiert das FKZ als Aktenzeichen im antraege-Store? */
export async function fkzExistsInStore(idb: IDBStore, fkz: string): Promise<boolean> {
  const a = await getAntrag(idb, fkz);
  return a !== null;
}

/** Helper: nur FKZ-basiertes Match, ohne Akronym-Fallback. */
export async function matchByFkz(
  idb: IDBStore,
  fkz: string,
): Promise<MatchResult> {
  const exists = await fkzExistsInStore(idb, fkz);
  if (exists) {
    return {
      matched_antrag_id: fkz,
      match_method: 'fkz',
      match_confidence: 'high',
      candidate_antrag_ids: [],
      requires_review: false,
    };
  }
  return {
    matched_antrag_id: null,
    match_method: 'fkz',
    match_confidence: 'orphan',
    candidate_antrag_ids: [],
    requires_review: true,
  };
}

/** Helper: nur Akronym-basiertes Match. */
export async function matchByAkronym(
  idb: IDBStore,
  programmId: string,
  akronym: string,
): Promise<MatchResult> {
  const candidates = await lookupAkronymCandidates(idb, programmId, akronym);
  if (candidates.length === 1 && candidates[0]) {
    return {
      matched_antrag_id: candidates[0],
      match_method: 'akronym',
      match_confidence: 'medium',
      candidate_antrag_ids: [],
      requires_review: false,
    };
  }
  if (candidates.length > 1) {
    return {
      matched_antrag_id: null,
      match_method: 'akronym',
      match_confidence: 'low',
      candidate_antrag_ids: candidates,
      requires_review: true,
    };
  }
  return {
    matched_antrag_id: null,
    match_method: 'akronym',
    match_confidence: 'orphan',
    candidate_antrag_ids: [],
    requires_review: true,
  };
}

/** Volle Match-Logik mit Konflikt-Erkennung. */
export async function runMatcher(idb: IDBStore, input: MatchInput): Promise<MatchResult> {
  const fkz = (input.fkz ?? '').trim();
  const akronym = (input.akronym ?? '').trim();

  if (fkz) {
    const fkzRes = await matchByFkz(idb, fkz);
    if (fkzRes.matched_antrag_id) {
      // Wenn auch ein Akronym vorliegt: Konflikt prüfen
      if (akronym) {
        const candidates = await lookupAkronymCandidates(idb, input.programmId, akronym);
        if (candidates.length > 0 && !candidates.includes(fkzRes.matched_antrag_id)) {
          return {
            ...fkzRes,
            match_confidence: 'low',
            candidate_antrag_ids: candidates,
            requires_review: true,
            flag_conflict: true,
          };
        }
      }
      return fkzRes;
    }
    // FKZ orphan — bevor wir aufgeben, Akronym als Notfall-Kandidat probieren
    if (akronym) {
      const ak = await matchByAkronym(idb, input.programmId, akronym);
      if (ak.matched_antrag_id) return ak;
      if (ak.candidate_antrag_ids.length > 0) return ak;
    }
    return fkzRes;
  }

  if (akronym) {
    return matchByAkronym(idb, input.programmId, akronym);
  }

  return {
    matched_antrag_id: null,
    match_method: null,
    match_confidence: 'orphan',
    candidate_antrag_ids: [],
    requires_review: true,
  };
}
