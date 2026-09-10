import type { CanonicalField, CanonicalLevel, FieldType } from './types';

interface CanonicalFieldDef {
  key: CanonicalField;
  type: FieldType;
  label: string;
  /** 'antrag' (Default) = pro Teilvorhaben; 'verbund' = pro Verbund (gleich für alle TVs). */
  level: CanonicalLevel;
}

export const CANONICAL_FIELDS: CanonicalFieldDef[] = [
  // Antrag-Ebene (TV)
  { key: 'aktenzeichen', type: 'string', label: 'Aktenzeichen', level: 'antrag' },
  { key: 'akronym', type: 'string', label: 'Akronym', level: 'antrag' },
  { key: 'verbund_id', type: 'string', label: 'Verbund-ID', level: 'antrag' },
  { key: 'titel', type: 'string', label: 'Titel (TV)', level: 'antrag' },
  { key: 'antragsteller', type: 'string', label: 'Antragsteller', level: 'antrag' },
  { key: 'status', type: 'string', label: 'Status (TV)', level: 'antrag' },
  { key: 'vb_phase', type: 'number', label: 'VB-Phase', level: 'antrag' },
  { key: 'unterprogramm_id', type: 'string', label: 'Unterprogramm-ID', level: 'antrag' },
  { key: 'bewilligung_datum', type: 'date', label: 'Bewilligungsdatum', level: 'antrag' },
  { key: 'antragsdatum', type: 'date', label: 'Antragsdatum', level: 'antrag' },
  { key: 'erstentscheidung', type: 'date', label: 'Erstentscheidung', level: 'antrag' },
  { key: 'vn_eingang_datum', type: 'date', label: 'Eingang VN-Sach', level: 'antrag' },
  { key: 'foerdersumme', type: 'number', label: 'Fördersumme', level: 'antrag' },
  { key: 'ort_ast', type: 'string', label: 'Ort Antragsteller', level: 'antrag' },
  { key: 'laufzeitbeginn', type: 'date', label: 'Laufzeitbeginn', level: 'antrag' },
  { key: 'laufzeitende', type: 'date', label: 'Laufzeitende', level: 'antrag' },
  // Bearbeiter / Begleitung — Namenskürzel pro Antrag, für den Profil-Filter „Nur meine".
  { key: 'tib_kuerz', type: 'string', label: 'Bearbeiter TiB (Kürzel)', level: 'antrag' },
  { key: 'bib_kuerz', type: 'string', label: 'Bearbeiter BIB (Kürzel)', level: 'antrag' },
  { key: 'ztp_kuerz', type: 'string', label: 'Begleitung ZTP (Kürzel)', level: 'antrag' },
  { key: 'pfm_kuerz', type: 'string', label: 'Begleitung PFM (Kürzel)', level: 'antrag' },
  { key: 'tib_mail', type: 'string', label: 'Bearbeiter TiB (E-Mail)', level: 'antrag' },
  // Bemerkung + Vollständigkeits-Datum (Auslastungs-Modul)
  { key: 't_hint', type: 'string', label: 'Bemerkung (T_HINT)', level: 'antrag' },
  { key: 'd_xtec', type: 'date', label: 'Vollständig erfasst (D_XTEC)', level: 'antrag' },
  { key: 'd_adv', type: 'date', label: 'Vollständig erfasst (D_ADV)', level: 'antrag' },
  // Verbund-Ebene (gleich für alle TVs eines Verbundes)
  { key: 'verbund_titel', type: 'string', label: 'Verbund-Titel', level: 'verbund' },
  { key: 'verbund_status', type: 'string', label: 'Verbund-Status', level: 'verbund' },
];

export const CANONICAL_FIELD_KEYS = CANONICAL_FIELDS.map(f => f.key);

/**
 * **Ausgemusterte Felder**: Schlüssel, die ältere Stände selbst in den
 * Antrag-Datensatz schrieben und die heute niemand mehr schreibt.
 *
 * Ein Import rechnet nur geänderte Zeilen neu (`touchedAz`); im Voll-Store und
 * im Snapshot bleiben solche Schlüssel deshalb liegen, bis der Antrag das
 * nächste Mal angefasst wird. Umgeschrieben wird der Bestand dafür nicht — ein
 * Schreiblauf über alle Datensätze und den Share für einen Schlüssel, den
 * niemand mehr liest, wäre das größere Risiko. Leser zeigen einen
 * ausgemusterten Schlüssel nur, wenn ein Schema ihn mappt.
 *
 * - `frist_datum` (bis v6.52): beim Import aus `D_AAE` + 90 Tage gerechnet,
 *   ohne wirksamen Eingang und ohne Haltekriterium — 13 021 von 13 690 Werten
 *   standen dort, wo die Frist-Spalte „angehalten" zeigte. Die Frist ist ein
 *   Zustand (`berechneFrist`), kein gespeichertes Feld.
 */
export const AUSGEMUSTERTE_FELDER: ReadonlySet<string> = new Set(['frist_datum']);

/**
 * Bekannte abweichende CSV-Spaltennamen, die im Quell-System eingebürgert sind
 * und auf ein Canonical-Field gemappt werden sollen. Wird im CSV-Wizard für die
 * Name-basierte Auto-Suggestion genutzt (`buildSuggestionsFromColumnNames`),
 * sodass der Kurator die Mappings nicht bei jedem Import manuell setzen muss.
 *
 * Vergleich ist case-insensitiv und ignoriert `_`/`-`/Leerzeichen
 * (siehe `normalize()` im Helper) — `D_AAE` und `d_aae` matchen identisch.
 *
 * Direkte Key-Matches (z.B. `aktenzeichen` → `aktenzeichen`) müssen hier nicht
 * gelistet werden — die werden automatisch erkannt.
 */
export const CANONICAL_FIELD_NAME_ALIASES: Record<string, CanonicalField> = {
  d_aae: 'antragsdatum',
  d_abb: 'bewilligung_datum',
  d_az1_1: 'erstentscheidung',
  d_vbe: 'vn_eingang_datum',
  org_afs: 'antragsteller',
  thema_ad: 'titel',
  vb_nummer: 'verbund_id',
  lfz_tv_b: 'laufzeitbeginn',
  lfz_tv_e: 'laufzeitende',
  // Finanz: ZUW_MU_FST ("aktuelle Zuwendung", aktueller Förderbetrag) ist die
  // Quelle für das Standardfeld `foerdersumme` (= Such-Spalte „Zuwendung").
  // Andere Finanzspalten (FST_AZX_GK „Zuwendung Bewilligung", GKO_AZX_GK
  // „Gesamtkosten", ZA_GS_GEZ „Auszahlungen") bleiben bewusst Custom-Felder.
  zuw_mu_fst: 'foerdersumme',
  // `ort_ast` (CSV-Header ORT_AST) ist Direct-Match auf Canonical-Key — kein Alias nötig.
};

/**
 * Whitelist der Felder, die in den schmalen `ANTRAEGE_LIST_VIEW`-Store
 * projiziert werden. Listen, Dashboards, Sort und Filter operieren
 * ausschließlich auf diesen Feldern. Custom-Felder aus den CSVs (z.B.
 * `foerdersumme_geplant_2024`) sind NICHT enthalten — Filter darauf
 * werden im Wizard mit Warn-Badge markiert.
 *
 * Wer hier ergänzt, muss `AntragListItem` in `csv/types.ts` und
 * `toAntragListItem()` in `csv/list-view.ts` mitnachziehen.
 */
export const LIST_VIEW_FIELDS: readonly string[] = [
  // Identifikation
  'aktenzeichen',
  'programm_id',
  // Anzeige
  'titel',
  'akronym',
  'status',
  'antragsteller',
  'branche',
  't_xsw',
  'vb_phase',
  // Sort + View-Predicates
  'bewilligung_datum',
  'erstentscheidung',
  'antragsdatum',
  'vn_eingang_datum',
  // D_XTE („alle Anträge da") — kein kanonisches Feld, im Master-Schema custom
  // gemappt. Trägt den wirksamen Eingang der Frist (`wirksamerEingang`).
  'alle_antraege_da',
  'laufzeitbeginn',
  'laufzeitende',
  // Numerische / sonstige Suchfeld-Spalten
  'foerdersumme',
  'ort_ast',
  // Filter-Standards
  'foerdergeber',
  'verbund_id',
  'unterprogramm_id',
  // Bearbeiter-Filter
  'tib_kuerz',
  'bib_kuerz',
  'ztp_kuerz',
  'pfm_kuerz',
  // Auslastungs-Modul (v2.63, Projektion v2 — siehe AntragListItem-Doku)
  't_hint',
  'd_xtec',
  'd_adv',
  'tib_mail',
  'verbund_titel',
  // Datums-Status-Gruppen (Projektion v4) — abgeleitet, siehe status-datum-gruppen.ts
  'fb_status_label',
  'fb_status_datum',
  'precheck_status_label',
  'precheck_status_datum',
  // Meta
  '_updated_at',
];

export const LIST_VIEW_FIELDS_SET: ReadonlySet<string> = new Set(LIST_VIEW_FIELDS);

export function getCanonicalLabel(key: string): string {
  return CANONICAL_FIELDS.find(f => f.key === key)?.label ?? key;
}

export function getCanonicalLevel(key: string): CanonicalLevel {
  return CANONICAL_FIELDS.find(f => f.key === key)?.level ?? 'antrag';
}

export const HASH_SEPARATOR = '\u001f';
export const BUILD_LOCK_STUFE = 'csv-import';
export const MAX_SKIP_WARNINGS = 10;
export const MAX_WRITES_PER_TX = 500;

export const DEFAULT_PROGRAMM_ID = 'default-programm';
export const DEFAULT_PROGRAMM_NAME = 'ZIM';
/**
 * Platzhalter-Name aus Pre-„ZIM"-Installationen. `ensureDefaultProgramm` migriert
 * bestehende Default-Records mit exakt diesem Namen automatisch auf
 * DEFAULT_PROGRAMM_NAME (user-umbenannte Programme bleiben unangetastet).
 */
export const LEGACY_DEFAULT_PROGRAMM_NAME = 'Standard-Programm';
export const DEFAULT_SMB_HANDLE_KEY = 'daten-share';

// v1.9: Schemas liegen unter programm/schemas/, Imports unter programm/antraege/imports/.
export const CSV_SCHEMAS_SUBDIR = 'schemas';
export const CSV_SOURCES_SUBDIR = 'antraege/imports';

/**
 * Marker der zuletzt gebauten Slim-Projektion (`ANTRAEGE_LIST_VIEW`). Liegt
 * hier statt in `list-view-migration.ts`, weil ihn auch `idb-csv.ts` beim
 * Zurücksetzen löschen muss — und ein Wert-Import von dort zurück wäre ein
 * Laufzeit-Zyklus.
 */
export const LIST_VIEW_VERSION_KEY = 'list-view-projection-version';
