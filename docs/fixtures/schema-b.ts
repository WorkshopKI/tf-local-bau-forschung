/**
 * Schema fuer `sample_7737_Bgl.csv` — Bewilligungsdetails (Secondary).
 *
 * Joinet auf `aktenzeichen` (= FKZ) gegen den Master `schema-a.ts`. Reichert
 * Antraege um zusaetzliche Bearbeiter-Slots (ZTP/PFM) und um Bewilligungs-
 * spezifische Datumsfelder an, die im Master nicht stehen.
 *
 * Priority < Master, damit Master bei gemeinsamen Feldern (Status, Phase,
 * Datum) gewinnt.
 */
import type { ColumnMapping } from '@/core/services/csv/types';

export const SCHEMA_B_NAME = 'Bewilligungsdetails';
export const SCHEMA_B_FILENAME = 'sample_7737_Bgl.csv';
export const SCHEMA_B_ID = 'fixture-real-bgl';
export const SCHEMA_B_PRIORITY = 50;
export const SCHEMA_B_IS_MASTER = false;

export const SCHEMA_B_COLUMN_MAPPING: ColumnMapping = {
  // Identifikation
  FKZ: { canonical: 'aktenzeichen', type: 'string', required: true },
  AKZ: { custom: 'akz_intern_bgl', type: 'string' },
  VB_NUMMER: { canonical: 'verbund_id', type: 'string' },
  FM_NUMMER: { canonical: 'unterprogramm_id', type: 'string' },
  // Anzeige
  VB_KURZNAM: { canonical: 'akronym', type: 'string' },
  ORG_AST: { custom: 'antragsteller_ast_bgl', type: 'string' },
  ORG_AFS: { canonical: 'antragsteller', type: 'string' },
  // Workflow
  STATUS_TV: { canonical: 'status', type: 'string' },
  STATUS_VB: { canonical: 'verbund_status', type: 'string' },
  VB_PHASE: { canonical: 'vb_phase', type: 'number' },
  // Datumsfelder
  D_AAE: { canonical: 'antragsdatum', type: 'date' },
  D_ABB: { canonical: 'bewilligung_datum', type: 'date' },
  // Bearbeiter — Bgl ist die Quelle fuer ZTP/PFM-Begleitung
  TIB_KUERZ: { canonical: 'tib_kuerz', type: 'string' },
  BIB_KUERZ: { canonical: 'bib_kuerz', type: 'string' },
  ZTP_KUERZ: { canonical: 'ztp_kuerz', type: 'string' },
  PFM_KUERZ: { canonical: 'pfm_kuerz', type: 'string' },
  // Adress-Metadaten
  ORT_AFS: { custom: 'ort_afs', type: 'string' },
  PLZ_AFS: { custom: 'plz_afs', type: 'string' },
  BULAND_AFS: { custom: 'buland_afs', type: 'string' },
};
