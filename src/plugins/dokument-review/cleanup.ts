/**
 * Bulk-Cleanup-Regeln fuer die Review-Queue. Diese sechs Regeln werden
 * vom Kurator manuell ueber den AutoCleanupCard ausgeloest und sind
 * absichtlich konservativ formuliert (kein Loesch-Vektor, nur Status-
 * Aenderungen). Jede Regel darf nur Eintraege treffen, die aktuell
 * `requires_review=true` ODER `triage_state='review'` ODER
 * `match_confidence='orphan'` sind — also dieselben, die in der Review-
 * Queue-Ansicht sichtbar sind. Erster Match gewinnt; die Reihenfolge
 * ist so gewaehlt dass irrelevant-Regeln vor "OK behalten"-Regeln
 * laufen (z.B. Bescheid → irrelevant auch wenn FKZ matched).
 */
import {
  CLASSIFIER_VERSION,
  putManifestEntry,
  putSkipEntry,
  type ManifestEntry,
  type SkipListEntry,
} from '@/phase2';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { isInReviewQueue } from './filtering';

export type CleanupRuleId =
  | 'zero_byte'
  | 'parse_error'
  | 'bescheid'
  | 'bewilligung'
  | 'zuwendungsbescheid'
  | 'matched_with_fkz';

export interface CleanupRuleResult {
  ruleId: CleanupRuleId;
  label: string;
  description: string;
  matches: ManifestEntry[];
}

interface CleanupAction {
  ruleId: CleanupRuleId;
  manifestUpdate: ManifestEntry;
  skipEntry: SkipListEntry | null;
}

const RULE_DEFS: Record<CleanupRuleId, { label: string; description: string }> = {
  zero_byte: {
    label: '0-KB-Dateien',
    description: 'size_bytes === 0 → irrelevant',
  },
  parse_error: {
    label: 'Parse-Fehler',
    description: 'Reason beginnt mit "parse_error" (Datei kaputt) → irrelevant',
  },
  bescheid: {
    label: 'doc_type = bescheid',
    description: 'Bescheide werden nicht reviewt → irrelevant',
  },
  bewilligung: {
    label: 'Bezeichnung enthaelt "Bewilligung"',
    description: 'DMS-Bezeichnung mit "Bewilligung" → irrelevant',
  },
  zuwendungsbescheid: {
    label: 'Bezeichnung enthaelt "ZuwB" / "Zuwendungsbescheid"',
    description: 'DMS-Bezeichnung kennzeichnet Zuwendungsbescheid → irrelevant',
  },
  matched_with_fkz: {
    label: 'FKZ + Typ zugeordnet',
    description: 'matched_antrag_id + extracted_fkz + doc_type ≠ sonstiges → requires_review = false (Status bleibt)',
  },
};

function classifyEntry(e: ManifestEntry): CleanupRuleId | null {
  if (e.size_bytes === 0) return 'zero_byte';
  const reason = e.triage_reason.toLowerCase();
  if (reason.startsWith('parse_error')) return 'parse_error';
  if (e.doc_type === 'bescheid') return 'bescheid';
  const bz = (e.dms_bezeichnung ?? '').toLowerCase();
  if (bz.includes('bewilligung')) return 'bewilligung';
  if (bz.includes('zuwb') || bz.includes('zuwendungsbescheid')) return 'zuwendungsbescheid';
  if (
    e.matched_antrag_id &&
    e.extracted_fkz &&
    e.doc_type !== 'sonstiges' &&
    e.doc_type !== 'irrelevant'
  ) {
    return 'matched_with_fkz';
  }
  return null;
}

export function previewCleanup(entries: ManifestEntry[]): CleanupRuleResult[] {
  const buckets: Record<CleanupRuleId, ManifestEntry[]> = {
    zero_byte: [],
    parse_error: [],
    bescheid: [],
    bewilligung: [],
    zuwendungsbescheid: [],
    matched_with_fkz: [],
  };
  for (const e of entries) {
    if (!isInReviewQueue(e)) continue;
    const ruleId = classifyEntry(e);
    if (ruleId) buckets[ruleId].push(e);
  }
  return (Object.keys(buckets) as CleanupRuleId[]).map(id => ({
    ruleId: id,
    label: RULE_DEFS[id].label,
    description: RULE_DEFS[id].description,
    matches: buckets[id],
  }));
}

function buildAction(ruleId: CleanupRuleId, entry: ManifestEntry, ts: string): CleanupAction {
  if (ruleId === 'matched_with_fkz') {
    return {
      ruleId,
      manifestUpdate: {
        ...entry,
        classifier_version: CLASSIFIER_VERSION,
        classified_at: ts,
        triage_source: 'manual',
        triage_reason: `manual_cleanup_keep_relevant | ${entry.triage_reason}`,
        requires_review: false,
      },
      skipEntry: null,
    };
  }
  const reason = `manual_cleanup_${ruleId}`;
  return {
    ruleId,
    manifestUpdate: {
      ...entry,
      classifier_version: CLASSIFIER_VERSION,
      classified_at: ts,
      triage_source: 'manual',
      triage_state: 'irrelevant',
      requires_review: false,
      triage_reason: reason,
    },
    skipEntry: {
      filename: entry.filename,
      antrag_id: entry.matched_antrag_id ?? null,
      doc_type: entry.doc_type,
      classifier_version: CLASSIFIER_VERSION,
      classified_at: ts,
      reason,
      first_seen_hash: '',
      source: 'manual',
      dms_bezeichnung: entry.dms_bezeichnung,
      dms_aktenplan: entry.dms_aktenplan,
      creator_kuerzel: entry.creator_kuerzel,
      extracted_fkz: entry.extracted_fkz,
      extracted_akronym: entry.extracted_akronym,
    },
  };
}

export interface CleanupExecutionResult {
  perRule: Record<CleanupRuleId, number>;
  totalChanged: number;
}

export async function executeCleanup(
  idb: IDBStore,
  rules: CleanupRuleResult[],
  onProgress?: (done: number, total: number) => void,
): Promise<CleanupExecutionResult> {
  const ts = new Date().toISOString();
  const actions: CleanupAction[] = [];
  for (const r of rules) {
    for (const entry of r.matches) actions.push(buildAction(r.ruleId, entry, ts));
  }
  const total = actions.length;
  let done = 0;
  for (const action of actions) {
    await putManifestEntry(idb, action.manifestUpdate);
    if (action.skipEntry) await putSkipEntry(idb, action.skipEntry);
    done++;
    if (onProgress && (done % 50 === 0 || done === total)) onProgress(done, total);
  }
  const perRule: Record<CleanupRuleId, number> = {
    zero_byte: 0, parse_error: 0, bescheid: 0,
    bewilligung: 0, zuwendungsbescheid: 0, matched_with_fkz: 0,
  };
  for (const r of rules) perRule[r.ruleId] = r.matches.length;
  return { perRule, totalChanged: total };
}
