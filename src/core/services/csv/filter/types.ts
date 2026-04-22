export type FilterTyp =
  | 'single_select'
  | 'multi_select'
  | 'boolean_ja_nein'
  | 'date_range'
  | 'number_range'
  | 'text_contains';

export type FilterScope = 'system' | 'admin' | 'user';

export type WerteQuelle = 'auto' | 'manual';

export type WerteReihenfolge = 'alphabetisch' | 'haeufigkeit' | 'manuell';

export interface FilterConfig {
  werte_quelle?: WerteQuelle;
  manuelle_werte?: string[];
  werte_reihenfolge?: WerteReihenfolge;
  ja_werte?: string[];
  nein_werte?: string[];
  leer_bucket?: boolean;
  disabled?: boolean;
}

export interface FilterDefinition {
  id: string;
  programm_id: string;
  scope: FilterScope;
  created_by?: string;
  name: string;
  description?: string;
  feld: string;
  typ: FilterTyp;
  config: FilterConfig;
  anzeige_reihenfolge: number;
  versteckt: boolean;
  /** Optionale Gruppenpfad-Anzeige aus column_mapping (für künftige Filter-Panel-Gruppierung). */
  display_group?: string[];
  erstellt_am: string;
  aktualisiert_am: string;
}

export type ActiveFilterValue =
  | string
  | string[]
  | 'ja'
  | 'nein'
  | 'beide'
  | { from?: string; to?: string }
  | { min?: number; max?: number };

export interface ActiveFilter {
  filterId: string;
  value: ActiveFilterValue;
}

export interface UserPreset {
  id: string;
  programm_id: string;
  name: string;
  description?: string;
  snapshot: ActiveFilter[];
  created_at: string;
}
