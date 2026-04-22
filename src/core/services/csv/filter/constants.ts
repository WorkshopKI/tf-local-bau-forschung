import type { FilterDefinition } from './types';

export const FILTER_STORES = {
  FILTER_DEFINITIONEN: 'filter_definitionen',
} as const;

export const FILTER_DEFINITIONS_PATH = 'admin/filter-definitionen.json';

export const USER_PRESETS_IDB_KEY_PREFIX = 'user_filter_presets_';

export function userPresetsKey(programmId: string): string {
  return `${USER_PRESETS_IDB_KEY_PREFIX}${programmId}`;
}

type SystemFilterSeed = Omit<FilterDefinition, 'programm_id' | 'erstellt_am' | 'aktualisiert_am'>;

export const SYSTEM_FILTERS_SEED: SystemFilterSeed[] = [
  {
    id: 'system-status',
    scope: 'system',
    name: 'Status',
    feld: 'status',
    typ: 'multi_select',
    config: { werte_quelle: 'auto', werte_reihenfolge: 'haeufigkeit' },
    anzeige_reihenfolge: 10,
    versteckt: false,
  },
  {
    id: 'system-verbund-vorhanden',
    scope: 'system',
    name: 'Verbund-Zugehörigkeit',
    feld: 'verbund_id',
    typ: 'boolean_ja_nein',
    config: {
      ja_werte: ['*nonempty*'],
      nein_werte: [],
    },
    anzeige_reihenfolge: 20,
    versteckt: false,
  },
  {
    id: 'system-unterprogramm',
    scope: 'system',
    name: 'Unterprogramm',
    feld: 'unterprogramm_id',
    typ: 'single_select',
    config: { werte_quelle: 'auto', werte_reihenfolge: 'alphabetisch', leer_bucket: true },
    anzeige_reihenfolge: 30,
    versteckt: false,
  },
  {
    id: 'system-bewilligung-datum',
    scope: 'system',
    name: 'Bewilligungsdatum',
    feld: 'bewilligung_datum',
    typ: 'date_range',
    config: {},
    anzeige_reihenfolge: 40,
    versteckt: false,
  },
  {
    id: 'system-antragsdatum',
    scope: 'system',
    name: 'Antragsdatum',
    feld: 'antragsdatum',
    typ: 'date_range',
    config: {},
    anzeige_reihenfolge: 50,
    versteckt: false,
  },
  {
    id: 'system-frist-datum',
    scope: 'system',
    name: 'Fristdatum',
    feld: 'frist_datum',
    typ: 'date_range',
    config: {},
    anzeige_reihenfolge: 60,
    versteckt: false,
  },
  {
    id: 'system-dokumenttyp',
    scope: 'system',
    name: 'Dokumenttyp',
    description: 'Wird in Phase 3 aktiviert',
    feld: '__dokumenttyp_platzhalter__',
    typ: 'multi_select',
    config: { werte_quelle: 'manual', manuelle_werte: [], disabled: true },
    anzeige_reihenfolge: 100,
    versteckt: false,
  },
];
