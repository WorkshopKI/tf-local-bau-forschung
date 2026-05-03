/**
 * Stage 0 — DMS-CSV-Lookup (sofort, kein Datei-Zugriff).
 *
 * Schlägt die DocID (= Dateiname) in der gefilterten DMS-CSV nach. Bei
 * Treffer: FKZ aus Bezeichnung, doc_type aus Aktenplanzuordnung-Mapping,
 * Ersteller-Kürzel aus Von-Spalte. Relevanz-Entscheidung anhand der
 * Aktenplanzuordnung — irrelevant-mappings landen direkt in der Skip-Liste.
 *
 * Erwartung: ~60 % aller Files werden hier abgefangen, ohne die Datei zu
 * öffnen. Stage 0 ist der größte Hebel der gesamten Pipeline.
 */

import type { AktenplanLookup, DmsEntry, TriageResult } from '../types';
import { lookupAktenplan } from '../dms-csv/aktenplan-mapping';
import { cleanDocId } from '../dms-csv/loader';

export interface Stage0Input {
  filename: string;
  dmsMap: Map<string, DmsEntry>;
  aktenplan: Map<string, AktenplanLookup>;
}

export type Stage0Output =
  | { matched: true; result: TriageResult; dmsEntry: DmsEntry }
  | { matched: false; reason: 'no_dms_entry' };

export function runStage0({ filename, dmsMap, aktenplan }: Stage0Input): Stage0Output {
  // Map-Keys sind case-normalisiert + Whitespace/Zero-Width-frei (siehe
  // loader.cleanDocId). Lookup-Pfad muss dieselbe Normalisierung anwenden.
  const lookupKey = cleanDocId(filename).toLowerCase();
  const entry = dmsMap.get(lookupKey) ?? null;
  if (!entry) {
    return { matched: false, reason: 'no_dms_entry' };
  }
  const akMap = lookupAktenplan(aktenplan, entry.aktenplan);
  const docType = akMap?.doc_type ?? 'sonstiges';
  const isIrrelevant = akMap?.irrelevant === true;

  const result: TriageResult = {
    filename,
    doc_type: docType,
    triage_state: isIrrelevant ? 'irrelevant' : 'relevant',
    triage_stage: 0,
    source: 'dms_csv',
    reason: akMap
      ? `aktenplan_mapped: "${entry.aktenplan}" → ${docType}`
      : `aktenplan_unknown: "${entry.aktenplan}" → sonstiges`,
    extracted_fkz: entry.extractedFkz,
    extracted_akronym: null,
    creator_kuerzel: entry.von,
    dms_bezeichnung: entry.bezeichnung,
    dms_aktenplan: entry.aktenplan,
  };
  return { matched: true, result, dmsEntry: entry };
}
