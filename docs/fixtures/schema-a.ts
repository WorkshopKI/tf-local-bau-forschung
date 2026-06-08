/**
 * Schema fuer `sample_9097_AnB_AitisiGPT.csv` — Antragsbasis (Master).
 *
 * Master-CSV mit `is_master: true`. Andere Fixture-CSVs (Bgl, PrjBsp) joinen
 * via `aktenzeichen` (= FKZ-Spalte) auf diesen Master. Bei Konflikten in
 * gleichen Feldern entscheidet `priority` (hoehere Zahl gewinnt) — Master
 * bekommt die hoechste Priority.
 *
 * Spaltenheader sind 1:1 die Original-Foyer-Headerzeile. Encoding der CSV-
 * Datei ist Windows-1252; der Parser detected das automatisch via Mojibake-
 * Heuristik, daher hier explizit gesetzt damit das auch bei Force-Re-Imports
 * stabil bleibt.
 */
import type { ColumnMapping } from '@/core/services/csv/types';

export const SCHEMA_A_NAME = 'Antragsbasis (Master)';
export const SCHEMA_A_FILENAME = 'sample_9097_AnB_AitisiGPT.csv';
export const SCHEMA_A_ID = 'fixture-real-anb';
export const SCHEMA_A_PRIORITY = 100;
export const SCHEMA_A_IS_MASTER = true;

export const SCHEMA_A_COLUMN_MAPPING: ColumnMapping = {
  // Identifikation
  FKZ: { canonical: 'aktenzeichen', type: 'string', required: true },
  AKZ: { custom: 'akz_intern', type: 'string' },
  VB_NUMMER: { canonical: 'verbund_id', type: 'string' },
  FM_NUMMER: { canonical: 'unterprogramm_id', type: 'string' },
  // Anzeige
  VB_KURZNAM: { canonical: 'akronym', type: 'string' },
  VB_TITEL: { canonical: 'verbund_titel', type: 'string' },
  THEMA_AD: { canonical: 'titel', type: 'string' },
  ORG_AST: { custom: 'antragsteller_ast', type: 'string' },
  ORG_AFS: { canonical: 'antragsteller', type: 'string' },
  // Workflow
  STATUS_TV: { canonical: 'status', type: 'string' },
  STATUS_VB: { canonical: 'verbund_status', type: 'string' },
  VB_PHASE: { canonical: 'vb_phase', type: 'number' },
  // Datumsfelder
  D_AAE: { canonical: 'antragsdatum', type: 'date' },
  D_ABB: { canonical: 'bewilligung_datum', type: 'date' },
  D_AZ1_1: { canonical: 'erstentscheidung', type: 'date' },
  // Bearbeiter (Master fuehrt die TiB/BiB-Zuordnung)
  TIB_KUERZ: { canonical: 'tib_kuerz', type: 'string' },
  BIB_KUERZ: { canonical: 'bib_kuerz', type: 'string' },
  // Adress-Metadaten (custom fields, fuer Detail-View)
  ORT_AFS: { custom: 'ort_afs', type: 'string' },
  PLZ_AFS: { custom: 'plz_afs', type: 'string' },
  BULAND_AFS: { custom: 'buland_afs', type: 'string' },
  NETZWERKNA: { custom: 'netzwerkname', type: 'string' },
  NAT_ZUORD: { custom: 'nat_zuord', type: 'string' },
  // Antragsteller-Typ: 'U' = Unternehmen, 'F' = Forschungseinrichtung. Wird
  // im Auslastungs-Match-Boost ausgewertet (Unternehmen bekommen staerkeren
  // Wiederholungs-Boost als Forschungseinrichtungen, da letztere thematisch
  // breit aufgestellt sind).
  ATTR_AUFB: { custom: 'ast_typ', type: 'string' },
  // Wiedereinreicher-Hinweis: Freitext (z.B. "Wiedereinreicher ZEP250142_JoA/KaLa"),
  // enthaelt die TIB-Kuerzel des damaligen Bearbeiters. Wird in allen Titel-
  // Ansichten rot/fett hinter dem VB-Titel angezeigt; auf der Home sortiert ein
  // Match mit dem eigenen Kuerzel den Antrag nach oben (siehe xsw.ts).
  T_XSW: { custom: 't_xsw', type: 'string' },
};
