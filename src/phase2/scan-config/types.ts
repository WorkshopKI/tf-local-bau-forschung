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
}

export const SCAN_CONFIG_SHARE_PATH = '_intern/phase2/scan-config.json';
