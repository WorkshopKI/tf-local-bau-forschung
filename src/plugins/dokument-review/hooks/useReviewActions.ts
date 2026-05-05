/**
 * Wrapper um die 5 Kurator-Aktionen (Typ aendern / Antrag zuordnen /
 * irrelevant / relevant ohne Zuordnung / re-triage). Setzt jeweils die
 * passenden Felder auf dem ManifestEntry, schreibt ggf. Skip-Liste, zeigt
 * einen Toast und ruft den uebergebenen onAfter-Callback (Reload + Auto-
 * Advance), den DetailPanel/KeyboardHandler steuern.
 */
import { useCallback } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import {
  putManifestEntry,
  deleteManifestEntry,
  putSkipEntry,
  deleteSkipEntry,
  CLASSIFIER_VERSION,
  type ManifestEntry,
  type DocType,
  type SkipListEntry,
} from '@/phase2';
import { useDokumentReviewStore } from '../store';

interface ReviewActions {
  changeDocType: (entry: ManifestEntry, nextType: DocType) => Promise<void>;
  assignAntrag: (entry: ManifestEntry, aktenzeichen: string) => Promise<void>;
  markIrrelevant: (entry: ManifestEntry) => Promise<void>;
  confirmRelevantWithoutMatch: (entry: ManifestEntry) => Promise<void>;
  reTriage: (entry: ManifestEntry) => Promise<void>;
}

export function useReviewActions(
  onMutated: (filename: string) => Promise<void>,
  onRemoved: (filename: string) => void,
): ReviewActions {
  const storage = useStorage();
  const showToast = useDokumentReviewStore(s => s.showToast);

  const stamp = useCallback(<T extends Partial<ManifestEntry>>(patch: T): T & {
    classifier_version: number;
    classified_at: string;
    triage_source: 'manual';
  } => ({
    ...patch,
    classifier_version: CLASSIFIER_VERSION,
    classified_at: new Date().toISOString(),
    triage_source: 'manual' as const,
  }), []);

  const changeDocType = useCallback(async (entry: ManifestEntry, nextType: DocType): Promise<void> => {
    if (entry.doc_type === nextType) return;
    const updated: ManifestEntry = {
      ...entry,
      ...stamp({}),
      doc_type: nextType,
      triage_reason: `manual_doc_type:${nextType}`,
    };
    await putManifestEntry(storage.idb, updated);
    await onMutated(entry.filename);
    showToast(`Typ geaendert: ${nextType}`);
  }, [storage.idb, onMutated, showToast, stamp]);

  const assignAntrag = useCallback(async (entry: ManifestEntry, aktenzeichen: string): Promise<void> => {
    const updated: ManifestEntry = {
      ...entry,
      ...stamp({}),
      matched_antrag_id: aktenzeichen,
      match_method: 'manual',
      match_confidence: 'high',
      candidate_antrag_ids: [],
      requires_review: false,
      triage_state: entry.triage_state === 'irrelevant' ? 'relevant' : entry.triage_state,
      triage_reason: 'manual_antrag_assigned',
    };
    await putManifestEntry(storage.idb, updated);
    // Falls die Datei vorher als irrelevant in der Skip-Liste war: rausnehmen.
    await deleteSkipEntry(storage.idb, entry.filename).catch(() => undefined);
    await onMutated(entry.filename);
    showToast(`Antrag zugeordnet: ${aktenzeichen}`);
  }, [storage.idb, onMutated, showToast, stamp]);

  const markIrrelevant = useCallback(async (entry: ManifestEntry): Promise<void> => {
    const ts = new Date().toISOString();
    const updated: ManifestEntry = {
      ...entry,
      ...stamp({}),
      triage_state: 'irrelevant',
      requires_review: false,
      triage_reason: 'manual_irrelevant',
    };
    const skipEntry: SkipListEntry = {
      filename: entry.filename,
      antrag_id: entry.matched_antrag_id ?? null,
      doc_type: entry.doc_type,
      classifier_version: CLASSIFIER_VERSION,
      classified_at: ts,
      reason: 'manual_irrelevant',
      first_seen_hash: '',
      source: 'manual',
      dms_bezeichnung: entry.dms_bezeichnung,
      dms_aktenplan: entry.dms_aktenplan,
      creator_kuerzel: entry.creator_kuerzel,
      extracted_fkz: entry.extracted_fkz,
      extracted_akronym: entry.extracted_akronym,
    };
    await putManifestEntry(storage.idb, updated);
    await putSkipEntry(storage.idb, skipEntry);
    await onMutated(entry.filename);
    showToast(`Als irrelevant markiert: ${entry.filename}`);
  }, [storage.idb, onMutated, showToast, stamp]);

  const confirmRelevantWithoutMatch = useCallback(async (entry: ManifestEntry): Promise<void> => {
    const updated: ManifestEntry = {
      ...entry,
      ...stamp({}),
      triage_state: 'relevant',
      requires_review: false,
      match_confidence: 'orphan',
      triage_reason: 'manual_relevant_orphan',
    };
    await putManifestEntry(storage.idb, updated);
    await onMutated(entry.filename);
    showToast(`Als relevant ohne Zuordnung bestaetigt: ${entry.filename}`);
  }, [storage.idb, onMutated, showToast, stamp]);

  const reTriage = useCallback(async (entry: ManifestEntry): Promise<void> => {
    await deleteManifestEntry(storage.idb, entry.filename);
    await deleteSkipEntry(storage.idb, entry.filename).catch(() => undefined);
    onRemoved(entry.filename);
    showToast(
      `Eintrag entfernt — beim naechsten Bulk-Scan im Suchindex-Plugin wird ${entry.filename} neu klassifiziert.`,
      'info',
    );
  }, [storage.idb, onRemoved, showToast]);

  return { changeDocType, assignAntrag, markIrrelevant, confirmRelevantWithoutMatch, reTriage };
}
