/**
 * Hart kodierte Column-Mappings für Test-CSVs aus src/plugins/csv-sources-admin/wizard/testCorpus.ts.
 *
 * Diese Schemas umgehen bewusst den 5-Schritt-Wizard (Encoding-Detection,
 * Mapping-UI, Unterprogramm-Bestätigung) und sind AUSSCHLIESSLICH für Dev-
 * Szenarien gedacht. Nicht für echte Produktivdaten verwenden.
 *
 * Jeder Fixture-Schema-Input wird in importTestCsv zu einem vollständigen
 * CsvSchema ergänzt (id, programm_id, csv_source_name, created_at).
 */

import type { CsvSchema } from '@/core/services/csv/types';

export type FixtureKey =
  | 'stammdaten-mini'
  | 'projektzusammenfassung-mini'
  | 'status-aktive-mini'
  | 'stammdaten-big'
  | 'deskriptoren-big'
  | 'stammdaten-mini-de'
  | 'projektzusammenfassung-mini-de'
  | 'status-aktive-mini-de'
  | 'stammdaten-mit-up';

type FixtureSchema = Pick<
  CsvSchema,
  'is_master' | 'join_key' | 'priority' | 'column_mapping' | 'encoding' | 'separator'
>;

const STAMMDATEN_MAPPING: FixtureSchema['column_mapping'] = {
  AKZ_LFD: { canonical: 'aktenzeichen', type: 'string', required: true },
  PROJ_KURZ: { canonical: 'akronym', type: 'string' },
  TITEL: { canonical: 'titel', type: 'string' },
  ANTRAGSTELLER: { canonical: 'antragsteller', type: 'string' },
  STATUS_FLG: { canonical: 'status', type: 'string', trackHistory: true },
  VB_NR: { canonical: 'verbund_id', type: 'string' },
  BEW_DAT: { canonical: 'bewilligung_datum', type: 'date' },
  EXPORT_TS: { ignore: true },
};

export const FIXTURE_SCHEMAS: Record<FixtureKey, FixtureSchema> = {
  'stammdaten-mini': {
    is_master: true,
    join_key: 'aktenzeichen',
    priority: 100,
    encoding: 'UTF-8',
    separator: ',',
    column_mapping: STAMMDATEN_MAPPING,
  },
  'projektzusammenfassung-mini': {
    is_master: false,
    join_key: 'akronym',
    priority: 30,
    encoding: 'UTF-8',
    separator: ',',
    column_mapping: {
      PROJ_KURZ: { canonical: 'akronym', type: 'string', required: true },
      ZUSAMMENFASSUNG: { custom: 'zusammenfassung', type: 'string' },
      THEMA_URBAN: { custom: 'thema_urban', type: 'string' },
      THEMA_ENERGIE: { custom: 'thema_energie', type: 'string' },
      DESKRIPTOR_NEU: { custom: 'deskriptor_neu', type: 'string' },
    },
  },
  'status-aktive-mini': {
    is_master: false,
    join_key: 'aktenzeichen',
    priority: 70,
    encoding: 'UTF-8',
    separator: ',',
    column_mapping: {
      AKZ_LFD: { canonical: 'aktenzeichen', type: 'string', required: true },
      STATUS_FLG: { canonical: 'status', type: 'string' },
      BEARBEITER: { custom: 'bearbeiter', type: 'string' },
      FRIST_NEU: { canonical: 'frist_datum', type: 'date' },
    },
  },
  'stammdaten-big': {
    is_master: true,
    join_key: 'aktenzeichen',
    priority: 100,
    encoding: 'UTF-8',
    separator: ',',
    column_mapping: STAMMDATEN_MAPPING,
  },
  'deskriptoren-big': {
    is_master: false,
    join_key: 'akronym',
    priority: 20,
    encoding: 'UTF-8',
    separator: ',',
    column_mapping: {
      AKRONYM: { canonical: 'akronym', type: 'string', required: true },
      THEMA_URBAN: { custom: 'thema_urban', type: 'string' },
      THEMA_ENERGIE: { custom: 'thema_energie', type: 'string' },
      THEMA_MOBILITAET: { custom: 'thema_mobilitaet', type: 'string' },
      THEMA_DIGITAL: { custom: 'thema_digital', type: 'string' },
      THEMA_KLIMA: { custom: 'thema_klima', type: 'string' },
      DESKRIPTOR_INNOVATION: { custom: 'deskriptor_innovation', type: 'string' },
      DESKRIPTOR_FORSCHUNG: { custom: 'deskriptor_forschung', type: 'string' },
      NOTIZ: { custom: 'notiz', type: 'string' },
    },
  },
  'stammdaten-mini-de': {
    is_master: true,
    join_key: 'aktenzeichen',
    priority: 100,
    encoding: 'windows-1252',
    separator: ';',
    column_mapping: {
      AKZ_LFD: { canonical: 'aktenzeichen', type: 'string', required: true },
      PROJ_KURZ: { canonical: 'akronym', type: 'string' },
      TITEL: { canonical: 'titel', type: 'string' },
      ANTRAGSTELLER: { canonical: 'antragsteller', type: 'string' },
      STATUS_FLG: { canonical: 'status', type: 'string', trackHistory: true },
      VB_NR: { canonical: 'verbund_id', type: 'string' },
      BEW_DAT: { canonical: 'bewilligung_datum', type: 'date' },
      FOERDERSUMME: { canonical: 'foerdersumme', type: 'string' },
    },
  },
  'projektzusammenfassung-mini-de': {
    is_master: false,
    join_key: 'akronym',
    priority: 30,
    encoding: 'windows-1252',
    separator: ';',
    column_mapping: {
      PROJ_KURZ: { canonical: 'akronym', type: 'string', required: true },
      ZUSAMMENFASSUNG: { custom: 'zusammenfassung', type: 'string' },
      THEMA_URBAN: { custom: 'thema_urban', type: 'string' },
      THEMA_ENERGIE: { custom: 'thema_energie', type: 'string' },
    },
  },
  'status-aktive-mini-de': {
    is_master: false,
    join_key: 'aktenzeichen',
    priority: 70,
    encoding: 'windows-1252',
    separator: ';',
    column_mapping: {
      AKZ_LFD: { canonical: 'aktenzeichen', type: 'string', required: true },
      STATUS_FLG: { canonical: 'status', type: 'string' },
      BEARBEITER: { custom: 'bearbeiter', type: 'string' },
      FRIST_NEU: { canonical: 'frist_datum', type: 'date' },
    },
  },
  'stammdaten-mit-up': {
    is_master: true,
    join_key: 'aktenzeichen',
    priority: 100,
    encoding: 'UTF-8',
    separator: ',',
    column_mapping: {
      AKZ_LFD: { canonical: 'aktenzeichen', type: 'string', required: true },
      PROJ_KURZ: { canonical: 'akronym', type: 'string' },
      TITEL: { canonical: 'titel', type: 'string' },
      ANTRAGSTELLER: { canonical: 'antragsteller', type: 'string' },
      STATUS_FLG: { canonical: 'status', type: 'string', trackHistory: true },
      VB_NR: { canonical: 'verbund_id', type: 'string' },
      BEW_DAT: { canonical: 'bewilligung_datum', type: 'date' },
      FM_NUMMER: { canonical: 'unterprogramm_id', type: 'string' },
    },
  },
};

export const DEV_PROGRAMM_ID = 'dev-programm';
export const DEV_PROGRAMM_NAME = 'Dev-Programm (Fixtures)';

export function fixtureSchemaId(key: FixtureKey): string {
  return `dev-${key}`;
}
