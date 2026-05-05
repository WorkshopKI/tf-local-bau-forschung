/**
 * Singleton-Eintrag im phase2_scan_config-Store.
 *
 * id ist konstant 'default' — wir brauchen aktuell nur eine Konfiguration
 * pro Browser/Geraet, kein Multi-Profile.
 */
export interface ScanConfigEntry {
  id: 'default';
  /**
   * Liste der zu scannenden Pfade relativ zum Dokumentenquelle-Handle.
   * Mehrstufig erlaubt (z.B. "zim/abc"). Leerer String ('') = ganzer Handle.
   */
  selected_paths: string[];
  updated_at: string;
  /**
   * Rolling-History der letzten Scan-Runs pro Pfad-Liste. Wird genutzt um beim
   * Re-Scan derselben Pfade eine ETA aus dem letzten Total zu schaetzen.
   * Optional weil Pre-Update-Konfigs das Feld nicht haben.
   */
  last_runs?: ScanRunHistoryEntry[];
}

/** Historischer Scan-Run pro Pfad-Liste-Hash. */
export interface ScanRunHistoryEntry {
  /** Hash der sortierten Pfad-Liste (siehe pathsHash() in scan-history.ts). */
  paths_hash: string;
  /** Pfade die gescannt wurden (denormalisiert fuer einfaches Debuggen). */
  paths: string[];
  /** Anzahl gefundener Dateien. */
  total: number;
  /** Wall-Clock-Dauer in Millisekunden. */
  duration_ms: number;
  /** ISO-Zeitpunkt des Run-Endes. */
  ran_at: string;
}

export const SCAN_CONFIG_SHARE_PATH = '_intern/phase2/scan-config.json';
