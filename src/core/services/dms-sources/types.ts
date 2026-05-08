/**
 * Multi-Source-DMS-Konfiguration (v1.15).
 *
 * Eine `DmsSourceEntry` beschreibt EINE Dokumentenquelle. Mehrere Quellen
 * koennen parallel verwaltet werden; Kurator entscheidet via `is_active`,
 * welche bei einem Indexierungslauf beruecksichtigt werden.
 *
 * Der zugehoerige `FileSystemDirectoryHandle` wird unter dem Slot
 * `dms-source-${id}` in der `smb-handles`-IDB-Map persistiert (siehe
 * smb-handle.ts).
 */

import type { TriageState } from '../../../phase2/types';

/** Cached Permission-Status der zur Source gehoerenden Handle (UI-Hint). */
export type DmsSourceHandleStatus = 'connected' | 'permission_lost' | 'missing';

/** Aggregat-Statistik der letzten Indexierung — fuer UI ohne Manifest-Scan. */
export interface DmsSourceIndexStats {
  docs_total: number;
  docs_relevant: number;
  docs_irrelevant: number;
  docs_review: number;
  docs_pending: number;
  docs_errors: number;
}

export interface DmsSourceEntry {
  /** uuid-light, primary key. */
  id: string;
  /** Frei waehlbar, z.B. "DMS Hauptarchiv" oder "Aussenstelle Sued". */
  label: string;
  /**
   * Sub-Pfade INNERHALB des Handles (analog zum frueheren
   * `phase2_scan_config.selected_paths`). Leer = ganzer Handle wird gescannt.
   */
  sub_roots: string[];
  /** Kurator-Toggle: wird die Quelle bei "Indexieren" beruecksichtigt? */
  is_active: boolean;
  created_at: string;
  /** session.kuratorName, "dev" oder leerer String. */
  created_by: string;
  updated_at: string;
  /** Zeitpunkt des letzten erfolgreichen Indexierungslaufs auf dieser Source. */
  last_indexed_at?: string;
  /** Aggregat-Stats des letzten Laufs (fuer Anzeige ohne Manifest-Scan). */
  last_index_stats?: DmsSourceIndexStats;
  /** Cached Permission-Status. */
  handle_status?: DmsSourceHandleStatus;
}

/** Map TriageState → Stats-Feld fuer Aggregat-Berechnung. */
export const TRIAGE_TO_STATS_KEY: Record<TriageState, keyof DmsSourceIndexStats> = {
  relevant: 'docs_relevant',
  irrelevant: 'docs_irrelevant',
  review: 'docs_review',
  pending_antrag: 'docs_pending',
};

/** Default-Source-ID, die beim Migrieren aus dem Legacy-`dokumentenquelle`-Slot vergeben wird. */
export const DEFAULT_DMS_SOURCE_ID = 'default';
