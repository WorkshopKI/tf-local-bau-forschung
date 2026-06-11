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
  /** v2.10: Erzwingt beim App-Start eine Kurator-Login-Wall (Passwort). Nach
   *  erfolgreichem Login werden `is_kurator` (Menüs) + Schreib-Session
   *  freigeschaltet. Nur in der kurator-Variante true — dev hat zwar ebenfalls
   *  `kuratorMenus`, aber keine Wall (Auto-Kurator via Fixtures). */
  requireKuratorLogin: boolean;
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
  /** v2.x: Schreibrecht auf den Daten-Share auch fuer Nicht-Kuratoren (hebt das
   *  v2.0-read-only-Hardening gezielt auf, z.B. fuer die PL). Steuert Picker-/
   *  Grant-Mode via `canWriteDatenShare`. Nur dev + pl. */
  datenShareSchreibrecht: boolean;
  /** v2.11: MA-Login-Wall beim App-Start. Das Bearbeiter-Kuerzel wird aus dem
   *  persoenlichen Passwort entschluesselt (gegen `_intern/auslastung-zugang.enc`)
   *  statt frei im Profil getippt — verhindert Fremd-Eintragen. Greift nur wenn
   *  die Zugangsdatei existiert (sonst Fallback aufs alte Kuerzelfeld). Nur prod
   *  (+ dev zum Testen). */
  maLogin: boolean;
  /** v2.11: PL-UI „Zugangspasswort generieren" in der MA-Verwaltung. Verschluesselt
   *  das echte Kuerzel unter einem generierten 2-Wort-Passwort und schreibt den
   *  Eintrag in die Zugangsdatei. Braucht `datenShareSchreibrecht` +
   *  `deAnonymisierung`. Nur pl (+ dev zum Testen). */
  maVerwaltungPasswort: boolean;
  /** User-Plugin "Chat" (AI-Chat). Build-Time-Gate, unabhängig von KI-Backend-Config. */
  chat: boolean;
  /** User-Plugin "Suche" (Hybrid-Suche). Trennt sich von `volltextsuche` (das gated den Suchindex-Kurator). */
  suche: boolean;
  /** User-Plugin "Feedback-Board". Trennt sich von `feedback` (das gated die Feedback-Kuration). */
  feedbackBoard: boolean;
  /** Dev-only: Kurator-Dashboard darf Feedback-Tickets löschen (nach Bestätigung).
   *  Destruktiv (entfernt aus localStorage + geteilter feedback.json) — daher
   *  optional + default false (fehlt = aus), nur im dev-Build true. Optional
   *  gelassen, damit Variant-Configs den Flag weglassen dürfen (kein
   *  requiredFlags-Eintrag). */
  feedbackDelete?: boolean;
  /** v2.18: CSV-Auto-Refresh-Banner + Datei-Picker auch ohne Kurator-Menüs
   *  (z.B. pl-Variante). Pollt registrierte CSV-Quellen auf neuere
   *  `lastModified`-Stände; in Nicht-Kurator-Builds verknüpft ein schlanker
   *  Picker die Quelldatei. Braucht `datenShareSchreibrecht`. Nur dev + pl. */
  csvAutoRefresh: boolean;
  /** v2.47: Lokaler Themenkorpus-Build erlaubt (Embedding-Modell ~200 MB im
   *  Main-Thread-RAM). In geteilten Citrix-pl-Sitzungen (mehrere User/Host) auf
   *  false → Build-Buttons ausgeblendet, nur Download. Default true (optional,
   *  fehlt = erlaubt, kein requiredFlags-Eintrag). */
  embeddingCorpusBuild?: boolean;
  /** v2.56: kurator-Variante — Auslastungs-Modul nur als Themen-Vektoren-
   *  Korpus-Pflege (kein MA-Auslastung/Zuweisung). Schlanker View, MA-
   *  mutierende Mount-Hooks bleiben aus. Optional, default false. */
  auslastungNurKorpus?: boolean;
  /** v2.59: Hintergrund-Heartbeat-Writer (jede Variante). Schreibt periodisch
   *  `ZAH/online-status.json` in den persoenlichen Ordner, solange die App offen
   *  ist — Quelle fuer den PL-„Online"-Tab. Optional, default true (`!== false`). */
  presenceHeartbeat?: boolean;
  /** v2.59: „Online"-Tab in den Einstellungen — zeigt zuletzt aktive Team-User
   *  aus den eingesammelten Heartbeats. Nur pl (+ dev). Optional, default false. */
  onlineStatusTab?: boolean;
  /** Gutachten-Testballon: KI-gestuetzte Kurzfassung-Sektion auf der Foerder-
   *  antrags-Detailseite (Dokumenten-Aufnahme → Skill → Review → DOCX-Vorlage).
   *  Erster „Mini-Agent". Nur dev (Testballon). Optional, default false. */
  gutachtenKurzfassung?: boolean;
  /** Gutachten-Workflow A–G: deterministischer Workflow-Runner ueber Registry-
   *  Skills (loest die Kurzfassung-Sektion ab). Nur dev. Optional, default false. */
  gutachtenWorkflow?: boolean;
  /** Skill-Verwaltung: Kurator-pflegbare Skill-/Regel-Registry + Sandbox-Testlauf.
   *  Sichtbar dev + kurator + pl. Optional, default false. */
  skillVerwaltung?: boolean;
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

/**
 * v2.16: Build-Time Rollen-Passwort-Gate. Salt + AES-GCM-Verifier werden via
 * `npm run set-password -- <variant> <pw>` (scripts/set-app-password.mjs) erzeugt
 * und in die Variant-Config eingebacken — kein Klartext-Passwort, keine SMB-Datei.
 * Greift in pl + kurator (AppPasswordGate). Siehe app-password.ts.
 */
export interface TeamflowAuthConfig {
  /** True → unbedingte Vollbild-Login-Wall beim App-Start (kein Skip). */
  required: boolean;
  /** Base64, 16 Random-Bytes (PBKDF2-Salt). */
  salt: string;
  /** Base64, [12B IV][ciphertext+tag] = encrypt(Sentinel-JSON, deriveKey(pw, salt)). */
  verifier: string;
  /** Optionaler Hinweis unter dem Passwortfeld (z.B. „Wende dich an die PL"). */
  hint?: string;
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
  /** v2.16 — optionales Build-Time Rollen-Passwort-Gate (pl + kurator). */
  auth?: TeamflowAuthConfig;
}

export const runtimeConfig: TeamflowConfig = __TEAMFLOW_CONFIG__;
export const buildTime: string = __TEAMFLOW_BUILD_TIME__;
export const gitHash: string = __TEAMFLOW_GIT_HASH__;
export const appVersion: string = __TEAMFLOW_APP_VERSION__;
