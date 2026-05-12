/**
 * Schema fuer `sample_9052_PrjBsp_AitisiGPT.csv` — Projektbeschreibung (Secondary).
 *
 * Joinet auf `aktenzeichen` (= FKZ) gegen den Master `schema-a.ts`. Reichert
 * Antraege um Volltext-Felder (VB_TITEL, VB_INHALT) und Branche an, die fuer
 * die Detail-Ansicht und Volltext-Suche relevant sind.
 *
 * Diese CSV enthaelt keinen ORG_AST, dafuer eine ausfuehrliche
 * Branchen-/Anwendungs-Klassifikation (BRANCHE_1..5, ANWEND_1..5, TECHN_1..5).
 * Im Mapping nehmen wir aus der Klassifikation nur die fuer die List-View
 * relevante `BRANCHE_1` als `branche`; die anderen 4 Slots lassen wir als
 * Custom-Felder fuer die Detail-Ansicht stehen.
 *
 * Priority < Master.
 */
import type { ColumnMapping } from '@/core/services/csv/types';

export const SCHEMA_C_NAME = 'Projektbeschreibung';
export const SCHEMA_C_FILENAME = 'sample_9052_PrjBsp_AitisiGPT.csv';
export const SCHEMA_C_ID = 'fixture-real-prjbsp';
export const SCHEMA_C_PRIORITY = 40;
export const SCHEMA_C_IS_MASTER = false;

export const SCHEMA_C_COLUMN_MAPPING: ColumnMapping = {
  // Identifikation
  FKZ: { canonical: 'aktenzeichen', type: 'string', required: true },
  VB_NUMMER: { canonical: 'verbund_id', type: 'string' },
  FM_NUMMER: { canonical: 'unterprogramm_id', type: 'string' },
  // Anzeige
  VB_KURZNAM: { canonical: 'akronym', type: 'string' },
  VB_TITEL: { canonical: 'verbund_titel', type: 'string' },
  THEMA_AD: { canonical: 'titel', type: 'string' },
  VB_INHALT: { custom: 'projektbeschreibung_text', type: 'string' },
  ORG_AFS: { canonical: 'antragsteller', type: 'string' },
  // Workflow
  STATUS_TV: { canonical: 'status', type: 'string' },
  STATUS_VB: { canonical: 'verbund_status', type: 'string' },
  VB_PHASE: { canonical: 'vb_phase', type: 'number' },
  // Datumsfelder
  D_AAE: { canonical: 'antragsdatum', type: 'date' },
  D_ABB: { canonical: 'bewilligung_datum', type: 'date' },
  // Bearbeiter
  ZTP_KUERZ: { canonical: 'ztp_kuerz', type: 'string' },
  // Klassifikation
  BRANCHE_1: { canonical: 'branche', type: 'string' },
  BRANCHE_2: { custom: 'branche_2', type: 'string' },
  BRANCHE_3: { custom: 'branche_3', type: 'string' },
  NACE: { custom: 'nace', type: 'string' },
  NACE_LANG: { custom: 'nace_lang', type: 'string' },
  TECHN_1: { custom: 'techn_1', type: 'string' },
  ANWEND_1: { custom: 'anwend_1', type: 'string' },
  // Adress-Metadaten
  ORT_AFS: { custom: 'ort_afs', type: 'string' },
  PLZ_AFS: { custom: 'plz_afs', type: 'string' },
  BULAND_AFS: { custom: 'buland_afs', type: 'string' },
  NETZWERKNA: { custom: 'netzwerkname', type: 'string' },
};
