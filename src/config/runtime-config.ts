/**
 * Build-Time-Config-Zugriff zur Laufzeit.
 *
 * Die Werte werden von Vite via `define` als Compile-Time-Konstanten ersetzt.
 * In `vite-env.d.ts` sind die Globals deklariert.
 */

export interface TeamflowBuildInfo {
  label: string;
  outputFilename: string;
  browserTabTitle: string;
  /** Untertitel unter dem Label im Sidebar-Header. Fallback "Verwaltung", wenn weggelassen. */
  sidebarSubtitle?: string;
}

export interface TeamflowDataConfig {
  fixedDataSharePath: string | null;
  /**
   * v2.0: Erwarteter Ordner-Name beim Daten-Share-Picker. Wenn gesetzt, prueft
   * WelcomeScreen `handle.name` gegen diesen Wert; bei Mismatch wird der Picker
   * erneut geoeffnet mit Hinweis.
   */
  expectedFolderName: string | null;
  allowUserToChangePath: boolean;
  allowLocalFallback: boolean;
  demoDataBundled: boolean;
}

/**
 * v2.0: Persoenlicher Ordner (User-Home-Laufwerk). Steuert das Verhalten
 * des Onboarding-Schritts und das "Daten alt"-Warning.
 */
export interface TeamflowPersonalFolderConfig {
  subfolder: string;
  required: boolean;
  promptAfterProfile: boolean;
  snapshotAgeWarningDays: number;
}

export interface TeamflowFeatures {
  kuratorMenus: boolean;
  feedback: boolean;
  dokumentenscan: boolean;
  volltextsuche: boolean;
  devInfraPanel: boolean;
  devFixtures: boolean;
  antraege: boolean;
  bauantraege: boolean;
  dokumente: boolean;
  /** Plugin "Auslastung" — automatische Kategorisierung + MA-Zuweisung (PL-Tool). */
  auslastung: boolean;
  /** Homepage-Selbsteintragung + Benachrichtigungs-Banner (End-User-Feature).
   *  Getrennt von `auslastung`, damit prod-Builds nur die Selbsteintragung
   *  zeigen ohne das volle PL-Plugin in der Sidebar. Optional fuer
   *  Backwards-Kompat mit pre-1.17-Configs — Fallback ist `auslastung`. */
  auslastungSelbstEintragung?: boolean;
  /** v2.5: Klartext-Anzeige der TIB-Kuerzel im Auslastungs-Modul (passwort-
   *  geschuetzt, 24h-Session). Nur in dev/pl-Varianten aktiviert, die auf
   *  einem geschuetzten SMB-Bereich liegen. */
  deAnonymisierung: boolean;
  /** User-Plugin "Chat" (AI-Chat). Build-Time-Gate, unabhängig von KI-Backend-Config. */
  chat: boolean;
  /** User-Plugin "Suche" (Hybrid-Suche). Trennt sich von `volltextsuche` (das gated den Suchindex-Kurator). */
  suche: boolean;
  /** User-Plugin "Feedback-Board". Trennt sich von `feedback` (das gated die Feedback-Kuration). */
  feedbackBoard: boolean;
}

export interface TeamflowMenuLabels {
  antraege?: string;
  bauantraege?: string;
  dokumente?: string;
}

export interface TeamflowDevConfig {
  defaultKuratorName: string;
  defaultKuratorPassword: string;
  dataSharePath: string | null;
  sessionTtlDays?: number;
  autoRefreshSmbPermission?: boolean;
  autoReloadAfterScenario?: boolean;
}

export interface TeamflowKiConfig {
  localLlama: {
    enabled: boolean;
    endpoint: string;
  };
  openrouter: {
    enabled: boolean;
    allowedModels: string[];
  };
}

export interface TeamflowBranding {
  logoUrl: string | null;
  primaryColor: string | null;
}

export interface TeamflowScanConfig {
  /** Relative Unterprogramm-Roots im dokumentenquelle-Handle. Leer = ganzer Handle. */
  sub_roots: string[];
  /** Erlaubte Datei-Endungen, lowercase mit Punkt (z.B. '.pdf'). */
  file_extensions: string[];
  /** Maximale Rekursionstiefe für den Walker. */
  max_depth: number;
  /** Erlaubte FKZ-Präfixe (Format: 2 Ziffern + 2 Großbuchstaben). */
  fkz_allowed_prefixes: string[];
}

export interface TeamflowConfig {
  configVersion: number;
  variant: 'development' | 'demo' | 'production' | 'custom';
  build: TeamflowBuildInfo;
  data: TeamflowDataConfig;
  /** v2.0 — optional, Build-Layer fuellt mit Defaults wenn weggelassen. */
  personalFolder?: TeamflowPersonalFolderConfig;
  features: TeamflowFeatures;
  menuLabels: TeamflowMenuLabels;
  ki: TeamflowKiConfig;
  branding: TeamflowBranding;
  /** Phase 2 — optional, default-leere Werte werden vom Build-Layer gesetzt. */
  scan?: TeamflowScanConfig;
  dev?: TeamflowDevConfig;
}

export const runtimeConfig: TeamflowConfig = __TEAMFLOW_CONFIG__;
export const buildTime: string = __TEAMFLOW_BUILD_TIME__;
export const gitHash: string = __TEAMFLOW_GIT_HASH__;
export const appVersion: string = __TEAMFLOW_APP_VERSION__;
