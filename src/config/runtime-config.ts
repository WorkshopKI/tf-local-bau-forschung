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
}

export interface TeamflowDataConfig {
  fixedDataSharePath: string | null;
  allowUserToChangePath: boolean;
  allowLocalFallback: boolean;
  demoDataBundled: boolean;
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
