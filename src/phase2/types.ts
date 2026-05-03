/**
 * Phase-2 Triage- & Matcher-Types.
 *
 * Diese Types beschreiben den Eingangsfilter für die Volltext-Pipeline:
 * pro Datei wird entschieden ob sie relevant ist, welcher Typ + welcher Antrag.
 * Der Output (ManifestEntry) wird sowohl als IDB-Row im scan-manifest-Store
 * als auch (optional) als JSONL auf dem Daten-Share persistiert.
 */

/** Interner doc_type — bewusst klein, wächst über Aktenplan-Mapping mit. */
export type DocType =
  | 'projektbeschreibung'
  | 'antragsunterlagen'
  | 'gutachten'
  | 'gutachten_qs'
  | 'verwendungsnachweis'
  | 'verwendungsnachweispruefung'
  | 'bescheid'
  | 'aenderungsbescheid'
  | 'nachforderung'
  | 'korrespondenz'
  | 'checkliste'
  | 'de_minimis'
  | 'sonstiges'
  | 'irrelevant';

export type TriageStage = 0 | 1 | 2 | 3;

export type TriageState = 'relevant' | 'irrelevant' | 'pending_antrag' | 'review';

export type MatchMethod = 'fkz' | 'akronym' | 'manual' | 'pending_antrag' | null;

export type MatchConfidence = 'high' | 'medium' | 'low' | 'orphan' | null;

/** Quelle einer Skip-List-Entscheidung — wichtig für Eval-Queries. */
export type ClassifierSource = 'dms_csv' | 'stage1' | 'stage2' | 'stage3' | 'manual';

/** Eintrag aus der gefilterten DMS-CSV — DocID als Key. */
export interface DmsEntry {
  docId: string;            // = Dateiname inkl. Endung, identisch zum Dateibaum
  bezeichnung: string;
  aktenplan: string;        // Original-Wert "6.1 QS zum Antrag" etc.
  typ: string;              // DMS-Typ-Code "DOK" / "DaD" / "BRF" …
  von: string | null;       // Ersteller-Kürzel (2–6 Zeichen)
  datum: string | null;     // "DD.MM.YYYY"
  extractedFkz: string | null;
}

/** Ergebnis einer Triage-Klassifikation für eine einzelne Datei. */
export interface TriageResult {
  filename: string;
  doc_type: DocType;
  triage_state: TriageState;
  triage_stage: TriageStage;
  source: ClassifierSource;
  reason: string;
  /** Erste 500 Tokens, falls Stage 2 sie geladen hat (für nachgelagerte Stages). */
  page1_text?: string;
  /** Aus DMS-CSV oder aus Inhalt extrahiert. */
  extracted_fkz: string | null;
  extracted_akronym: string | null;
  /** Aus DMS-CSV (nur Stage 0). */
  creator_kuerzel: string | null;
  dms_bezeichnung: string | null;
  dms_aktenplan: string | null;
}

/** Ergebnis des Matchers nach erfolgter Triage. */
export interface MatchResult {
  matched_antrag_id: string | null;     // = aktenzeichen aus antraege-Store
  match_method: MatchMethod;
  match_confidence: MatchConfidence;
  candidate_antrag_ids: string[];       // bei akronym-mehrdeutig
  requires_review: boolean;
  flag_conflict?: boolean;
}

/**
 * Persistierter Manifest-Eintrag pro Dokument im SCAN_MANIFEST-Store
 * sowie in der JSONL-Spiegelung auf dem Daten-Share.
 */
export interface ManifestEntry {
  filename: string;                       // = Schlüssel
  filepath: string;                       // Relativ zum dokumentenquelle-Root
  size_bytes: number;
  mtime: string;
  classifier_version: number;
  classified_at: string;

  // Triage-Outcome
  doc_type: DocType;
  triage_state: TriageState;
  triage_stage: TriageStage;
  triage_source: ClassifierSource;
  triage_reason: string;

  // Match-Outcome
  extracted_fkz: string | null;
  extracted_akronym: string | null;
  matched_antrag_id: string | null;
  match_method: MatchMethod;
  match_confidence: MatchConfidence;
  candidate_antrag_ids: string[];
  requires_review: boolean;

  // DMS-CSV-Daten (für Debug/UI auch wenn nicht gemacht)
  creator_kuerzel: string | null;
  dms_bezeichnung: string | null;
  dms_aktenplan: string | null;
}

/** Skip-List-Eintrag — gekeyt auf filename (DocID ist global eindeutig). */
export interface SkipListEntry {
  filename: string;                       // = Schlüssel
  antrag_id: string | null;               // null bei orphan-irrelevant
  doc_type: DocType;
  classifier_version: number;             // semver-major-Counter, manuell erhöht
  classified_at: string;                  // ISO datetime
  reason: string;                         // "irrelevant_typ" | "gutachten_docx" | "dms_csv_irrelevant" | …
  first_seen_hash: string;                // für Forensik bei Re-Klassifikation (kann '' sein)
  source: ClassifierSource;
  /** DMS-Felder zum Restoren des Manifests beim Schnellpfad. Optional, weil
      Skip-Einträge auch ohne DMS-Match entstehen können (z.B. orphan-irrelevant
      aus Stage 2/3). Alte Einträge ohne diese Felder kommen mit `undefined`
      und werden im Restore auf `null` gemappt. */
  dms_bezeichnung?: string | null;
  dms_aktenplan?: string | null;
  creator_kuerzel?: string | null;
  extracted_fkz?: string | null;
  extracted_akronym?: string | null;
}

/**
 * Holding-Bucket-Eintrag für Projektbeschreibungen, deren Antrag noch
 * nicht via CSV-Import / Snapshot-Sync angekommen ist.
 *
 * Re-Match-Trigger:
 *  - Nach erfolgreichem CSV-Import (importer.ts → finally)
 *  - Nach erfolgreichem Snapshot-Sync, wenn akronym_index oder
 *    antraege im reloadedStores-Set ist (App.tsx Bootstrap)
 */
export interface PendingAntragEntry {
  id: string;                             // uuid-light, = Schlüssel
  filename: string;
  filepath: string;
  akronym: string | null;                 // Index-Feld
  fkz_candidate: string | null;
  programm_id: string | null;
  enqueued_at: string;
  classifier_version: number;
}

/** Stage-2 Keyword-Marker pro doc_type. */
export interface KeywordMarker {
  doc_type: DocType;
  /** Lowercase-Substring-Treffer auf den ersten ~500 Tokens. */
  patterns: string[];
  /** Mindestanzahl Treffer für Match. Default 1. */
  min_hits?: number;
}

/** Result des Aktenplan→DocType-Mappings. */
export interface AktenplanLookup {
  doc_type: DocType;
  /** true wenn das gemappte Mapping als irrelevant gilt. */
  irrelevant: boolean;
}
