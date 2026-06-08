/**
 * PersonalStorageService Domain-Types (v2.0).
 *
 * Schluessel-Konzept: Der pers. Ordner ist das User-Home (Cross-Browser-Persistenz);
 * IDB ist der Cache wenn der Share offline ist. Sync-Strategie ist Last-Writer-Wins
 * via `updatedAt`-Timestamp (analog snapshot-sync.ts).
 *
 * Die User-Einstellungen leben unter `ZAH/einstellungen.json`; Filter-Presets
 * sind heute (v2.0) noch nicht aktiv genutzt — die Schema-Slots existieren, damit
 * die App spaeter ergaenzen kann ohne IDB-Migration.
 */

import type { UserProfile } from '@/core/types/config';

export interface FilterPreset {
  id: string;
  name: string;
  /** Programm-ID auf das das Preset zielt (oder '*' fuer global). */
  programm_id: string;
  /** Frei-Form-Filter-State. Wird vom Antrags-Plugin interpretiert. */
  filter_state: Record<string, unknown>;
  created_at: string;
}

export interface ViewPreferences {
  /** ID der Default-View beim Oeffnen der Antrags-Liste. */
  default_view_id?: string;
  /** Letzte Suchanfrage (fuer Continue-Where-You-Left-Off). */
  last_query?: string;
  /** Sichtbare Spalten pro Listen-Typ. Frei-Form, Aufrufer-spezifisch. */
  visible_columns?: Record<string, string[]>;
}

export interface PersonalEinstellungen {
  version: 1;
  updatedAt: string;
  filterPresets: FilterPreset[];
  viewPreferences: ViewPreferences;
  /** Wann zuletzt der CSV-Snapshot gezogen wurde — fuer "Daten alt"-Banner. */
  lastSyncTimestamp: string | null;
}

export interface PersonalStorage {
  profile: UserProfile;
  einstellungen: PersonalEinstellungen;
}

export interface FeedbackOutboxItem {
  id: string;
  kuerzel: string;
  submitted_at: string;
  text: string;
  category?: string;
  /** Strukturierte Formular-Felder (key → wert) aus dem Typ-Formular. Wird beim
   *  Kurator-Einsammeln ins FeedbackItem.structured übernommen (Quelle für promptGenerator). */
  structured?: Record<string, string>;
  context?: unknown;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_at?: string;
  reviewer_kuerzel?: string;
  reviewer_comment?: string;
}

export interface PersonalCacheEntry {
  updatedAt: string;
  data: PersonalEinstellungen;
}

/** IDB-Key fuer den Einstellungen-Cache. */
export const PERSONAL_EINSTELLUNGEN_IDB_KEY = 'personal-einstellungen-cache';
/** IDB-Key fuer den Profil-Cache. */
export const PERSONAL_PROFILE_IDB_KEY = 'personal-profile-cache';
