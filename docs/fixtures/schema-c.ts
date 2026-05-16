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
  // Klassifikation — Branche / Technologie / Anwendung (alle 5 Slots fuer
  // das Auslastungs-Modul, das die TECHN_/BRANCHE_-Werte aggregiert auswertet).
  BRANCHE_1: { canonical: 'branche', type: 'string' },
  BRANCHE_2: { custom: 'branche_2', type: 'string' },
  BRANCHE_3: { custom: 'branche_3', type: 'string' },
  BRANCHE_4: { custom: 'branche_4', type: 'string' },
  BRANCHE_5: { custom: 'branche_5', type: 'string' },
  NACE: { custom: 'nace', type: 'string' },
  NACE_LANG: { custom: 'nace_lang', type: 'string' },
  TECHN_1: { custom: 'techn_1', type: 'string' },
  TECHN_2: { custom: 'techn_2', type: 'string' },
  TECHN_3: { custom: 'techn_3', type: 'string' },
  TECHN_4: { custom: 'techn_4', type: 'string' },
  TECHN_5: { custom: 'techn_5', type: 'string' },
  ANWEND_1: { custom: 'anwend_1', type: 'string' },
  ANWEND_2: { custom: 'anwendung_2', type: 'string' },
  ANWEND_3: { custom: 'anwendung_3', type: 'string' },
  ANWEND_4: { custom: 'anwendung_4', type: 'string' },
  ANWEND_5: { custom: 'anwendung_5', type: 'string' },
  // Zukunftstechnologie-Boolean-Spalten (col 46-89). CSV-Header
  // sind dupliziert (TV + VB), PapaParse benennt die VB-Variante zu
  // `<header>_1` um. Wir mappen hier die TV-Spalten als Custom-Felder.
  // Die Slugs muessen mit `default-labels.ts` / `makeCustomFieldName()`
  // uebereinstimmen — bei XLSX-Aenderungen `npm run build:default-labels`
  // und das hier per Hand nachziehen.
  'Digitale W': { custom: 'zt_digitale_wirtschaft_und_gesellschaft_ikt_tv', type: 'boolean' },
  'Industrie': { custom: 'zt_industrie_4_0_tv', type: 'boolean' },
  'Cloud Comp': { custom: 'zt_cloud_computing_tv', type: 'boolean' },
  'Big Data A': { custom: 'zt_big_data_analyse_tv', type: 'boolean' },
  'Künstliche': { custom: 'zt_kuenstliche_intelligenz_ki_tv', type: 'boolean' },
  'sonstigeDW': { custom: 'zt_sonstige_digitale_wirtschaft_tv', type: 'boolean' },
  'Intelligen': { custom: 'zt_intelligente_mobilitaet_tv', type: 'boolean' },
  'Elektromob': { custom: 'zt_elektromobilitaet_tv', type: 'boolean' },
  'sonstigeIM': { custom: 'zt_sonstige_intelligente_mobilitaet_tv', type: 'boolean' },
  'Nachhaltig': { custom: 'zt_nachhaltiges_wirtschaften_green_economy_tv', type: 'boolean' },
  'Energie/Re': { custom: 'zt_energie_ress_effizienz_tv', type: 'boolean' },
  'sonstigeNW': { custom: 'zt_sonstige_nachhaltiges_wirtschaften_tv', type: 'boolean' },
  'Zivile Sic': { custom: 'zt_zivile_sicherheit_inkl_it_tv', type: 'boolean' },
  'IT-Sicherh': { custom: 'zt_it_sicherheit_tv', type: 'boolean' },
  'sonstigeZS': { custom: 'zt_sonstige_zivile_sicherheit_tv', type: 'boolean' },
  'Gesundes L': { custom: 'zt_gesundes_leben_tv', type: 'boolean' },
  'Innovative': { custom: 'zt_innovative_arbeitswelt_tv', type: 'boolean' },
  'Leichtbaut': { custom: 'zt_leichtbautechnologien_tv', type: 'boolean' },
  'Mikroelekt': { custom: 'zt_mikroelektronik_tv', type: 'boolean' },
  'Batteriete': { custom: 'zt_batterietechnik_tv', type: 'boolean' },
  'KuK-Innova': { custom: 'zt_kuk_innovationen_technolog_fuer_bzw_von_kultur_medien_u_krea_tv', type: 'boolean' },
  'Additive F': { custom: 'zt_additive_fertigung_3d_druck_tv', type: 'boolean' },
  // VB-Ebene-Spalten — gleicher CSV-Header wie TV, PapaParse renamed zu `_1`.
  // Werden gebraucht weil viele Deskriptoren NUR auf Verbund-Ebene gesetzt sind.
  'Digitale W_1': { custom: 'zt_digitale_wirtschaft_und_gesellschaft_ikt_vb', type: 'boolean' },
  'Industrie_1': { custom: 'zt_industrie_4_0_vb', type: 'boolean' },
  'Cloud Comp_1': { custom: 'zt_cloud_computing_vb', type: 'boolean' },
  'Big Data A_1': { custom: 'zt_big_data_analyse_vb', type: 'boolean' },
  'Künstliche_1': { custom: 'zt_kuenstliche_intelligenz_ki_vb', type: 'boolean' },
  'sonstigeDW_1': { custom: 'zt_sonstige_digitale_wirtschaft_vb', type: 'boolean' },
  'Intelligen_1': { custom: 'zt_intelligente_mobilitaet_vb', type: 'boolean' },
  'Elektromob_1': { custom: 'zt_elektromobilitaet_vb', type: 'boolean' },
  'sonstigeIM_1': { custom: 'zt_sonstige_intelligente_mobilitaet_vb', type: 'boolean' },
  'Nachhaltig_1': { custom: 'zt_nachhaltiges_wirtschaften_green_economy_vb', type: 'boolean' },
  'Energie/Re_1': { custom: 'zt_energie_ress_effizienz_vb', type: 'boolean' },
  'sonstigeNW_1': { custom: 'zt_sonstige_nachhaltiges_wirtschaften_vb', type: 'boolean' },
  'Zivile Sic_1': { custom: 'zt_zivile_sicherheit_inkl_it_vb', type: 'boolean' },
  'IT-Sicherh_1': { custom: 'zt_it_sicherheit_vb', type: 'boolean' },
  'sonstigeZS_1': { custom: 'zt_sonstige_zivile_sicherheit_vb', type: 'boolean' },
  'Gesundes L_1': { custom: 'zt_gesundes_leben_vb', type: 'boolean' },
  'Innovative_1': { custom: 'zt_innovative_arbeitswelt_vb', type: 'boolean' },
  'Leichtbaut_1': { custom: 'zt_leichtbautechnologien_vb', type: 'boolean' },
  'Mikroelekt_1': { custom: 'zt_mikroelektronik_vb', type: 'boolean' },
  'Batteriete_1': { custom: 'zt_batterietechnik_vb', type: 'boolean' },
  'KuK-Innova_1': { custom: 'zt_kuk_innovationen_technolog_fuer_bzw_von_kultur_medien_u_krea_vb', type: 'boolean' },
  'Additive F_1': { custom: 'zt_additive_fertigung_3d_druck_vb', type: 'boolean' },
  // Adress-Metadaten
  ORT_AFS: { custom: 'ort_afs', type: 'string' },
  PLZ_AFS: { custom: 'plz_afs', type: 'string' },
  BULAND_AFS: { custom: 'buland_afs', type: 'string' },
  NETZWERKNA: { custom: 'netzwerkname', type: 'string' },
};
