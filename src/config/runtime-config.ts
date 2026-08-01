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
  /** User-Plugin "Suche" (Hybrid-Suche). Trennt sich von `volltextsuche` (das gated den Suchindex-Kurator). */
  suche: boolean;
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
  /** v2.59: „Online"-Tab in den Einstellungen — zeigt zuletzt aktive Team-User
   *  aus den eingesammelten Heartbeats. Nur pl (+ dev). Optional, default false. */
  onlineStatusTab?: boolean;
  /** Kürzel-Auswahl als Dropdown (statt Freitext) im Einstellungs-Profil, OHNE
   *  das volle Auslastungs-Modul — für Varianten wie AS, die den Bearbeiter-
   *  Filter wie PL haben sollen (auslastung aus). Fällt auf `auslastung` zurück,
   *  pl/dev/kurator bleiben unverändert. Optional, default false. */
  kuerzelDropdown?: boolean;
  /** Gutachten-Testballon: KI-gestuetzte Kurzfassung-Sektion auf der Foerder-
   *  antrags-Detailseite (Dokumenten-Aufnahme → Skill → Review → DOCX-Vorlage).
   *  Erster „Mini-Agent". Nur dev (Testballon). Optional, default false. */
  gutachtenKurzfassung?: boolean;
  /** Gutachten-Workflow A–G: deterministischer Workflow-Runner ueber Registry-
   *  Skills (loest die Kurzfassung-Sektion ab). Nur dev. Optional, default false. */
  gutachtenWorkflow?: boolean;
  /** Workflow-Entwuerfe sichtbar + ausfuehrbar: in dev werden WorkflowDefs mit
   *  `freigabe:'entwurf'` angezeigt und zur Laufzeit gewaehlt; pl/prod/as/kurator
   *  sehen nur `'freigegeben'`. Die `registry.json` ist geteilt (global), daher
   *  trennt dieses Flag die Variant-Sichtbarkeit von `aktiv`. Nur dev. Optional,
   *  default false (fehlt → ueber `variant==='development'` abgeleitet). */
  workflowEntwuerfe?: boolean;
  /** NF-Nachforderungen (Artefakt-Engine): Pro-TV-NF-Entwuerfe auf der Verbund-
   *  Detailseite. Nur dev (Testballon). Optional, default false. */
  nfNachforderungen?: boolean;
  /** Artefakt-Werkbank: EIN Workspace (offene Punkte -> Baustein-Auswahl -> Entwurf
   *  NF/RNE/ABL) auf der Verbund-Detailseite. Ersetzt die NachforderungenSection.
   *  Nur dev (Pilot). Optional, default false. */
  artefaktWerkbank?: boolean;
  /** Antrag-Aufbereitung: Vollbild-Aufbereitung der VB (Gliederung + Tabellen-
   *  Ernte, Zeitplan-Gantt + Text↔Anlage-5-Plausibilitaet). Paket 1 rein
   *  deterministisch (kein LLM). Nur dev. Optional, default false. */
  antragAufbereitung?: boolean;
  /** Skill-Verwaltung: Kurator-pflegbare Skill-/Regel-Registry + Sandbox-Testlauf.
   *  Sichtbar dev + kurator + pl. Optional, default false. */
  skillVerwaltung?: boolean;
  /** Modul „Anfragen": E-Mail-Kurzanfrage (.msg) → interne Anonymisierung →
   *  Export in den externen ZIM FAQ-Assistenten → deterministische Wiedereinsetzung.
   *  Plugin-Flag. Nur dev (Testballon). Optional, default false. */
  anfragen?: boolean;
  /** In-App „Streamlit Bridge"-Installer (KI-Assistent-Tab): Streamlit-URL +
   *  Bookmarklet + tf-ping-Test. Zugang zum internen gpt-oss ohne API.
   *  Sichtbar dev + prod + kurator + pl. Optional, default false. */
  streamlitBridge?: boolean;
  /** v2.97: Delta-Snapshots SCHREIBEN — der Writer publiziert nur geänderte
   *  antraege-Records (`antraege.delta.<seq>.jsonl`) statt der vollen Datei.
   *  Braucht `datenShareSchreibrecht`; nur pl + kurator (+ dev). Der LESER
   *  versteht Deltas immer (kein Flag). Optional, default false. ERST aktivieren,
   *  wenn der Delta-Leser (v2.97) flächig ausgerollt ist (2-Phasen-Rollout). */
  deltaSnapshotWrite?: boolean;
  /** Assistent Phase 0: gerätelokales, opt-in Ereignisprotokoll (Fundament für
   *  den späteren persönlichen Assistenten). Gated Aufzeichnung + Einstellungs-
   *  Sektion. Nur dev. Optional, default false. */
  assistentProtokoll?: boolean;
  /** Assistent Phase 1: kontextbewusstes Assistenz-Panel (deterministisch
   *  assemblierter Kontext, intern-only Transport, session-only Historie). Shell-
   *  weites Dock. Nur dev. Optional, default false. */
  assistentPanel?: boolean;
  /** Assistent Phase 2: Gedächtnis-Konsolidierung (Sleep-time). Hintergrundlauf
   *  destilliert das Ereignisprotokoll per INTERNEM Modell in Memory-Blocks;
   *  doppeltes Opt-in. Nur dev. Optional, default false. */
  assistentGedaechtnis?: boolean;
  /** MAP „Neuer Prüf-Workflow": Einreichungs-Import (Drag & Drop), Rechenchecks
   *  und editierbare, versionierte Förderfähigkeits-Checkliste. Eigene Entität
   *  im kv-Store, kein Eingriff in die Antrags-Pipeline. Nur dev. Optional,
   *  default false. */
  mapFoerderfaehig?: boolean;
  /** Status-System neu: kuratierbarer Status-Katalog + append-only Historie +
   *  deterministische Ableitungs-Engine, plus Cockpit/Timeline/Widget. Gated die
   *  GESAMTE neue Schicht (Katalog-Init, Event-Emission, Cockpit, Timeline,
   *  Konflikt-Badges, Widget). Der `getStatusCategory`-Snapshot-Refactor ist der
   *  einzige immer-aktive Eingriff (bei fehlendem Snapshot bitweise identisch).
   *  dev/pl/kurator. Optional, default false. */
  statusCockpit?: boolean;
  /** Bearbeitungs-Meilensteine + Fristen-Monitoring: kuratierbarer Meilenstein-
   *  Plan (Soll-Wochen nach Antragseingang), deterministische Bewertung
   *  erreicht/fällig/gerissen + Prognose zur 3-Monats-Gesamtfrist. Gated Plugin,
   *  Home-Widget, Detailseiten-Sektion und den Post-Import-Pass. Eigene Achse
   *  neben dem amtlichen Status — die Anzeige-`Prominenz` des Status-Katalogs
   *  bleibt davon unberuehrt. dev/pl/as/kurator. Optional, default false. */
  meilensteinMonitoring?: boolean;
  /** Vorgangssystem: Status-Erklärung (Info-Icon), Kürzel-Glossar +
   *  Nächster-Schritt-Navigator, To-do-Board, Stillstands-Wächter und
   *  Fristen-Cockpit. Die App leitet dabei KEINEN Status ab — alles steht neben
   *  dem importierten `STATUS_TV`/`STATUS_VB`. Setzt `statusCockpit` voraus
   *  (ohne Katalog keine Codes). dev/pl. Optional, default false. */
  vorgangssystem?: boolean;
}

export interface TeamflowMenuLabels {
  antraege?: string;
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

/**
 * Variante „local" (nur Entwickler-Maschine, nur Vite-Dev-Server): feste lokale
 * Ordner statt File-System-Access-API-Picker, damit die App ohne einen einzigen
 * Browser-Dialog startet und automatisiert bedienbar ist.
 *
 * Die Pfade wirken NUR serverseitig (Vite-Plugin, `scripts/local-fs/`) — der
 * Client adressiert Ordner ausschliesslich ueber Slot-Namen und kennt keinen
 * absoluten Pfad. `validateConfig` verbietet den Block in `variant: "production"`,
 * und `__TEAMFLOW_LOCAL_FS__` haengt an `command === 'serve'`: jeder Build faltet
 * den Zweig weg. Siehe docs/architecture/local-variante.md.
 */
export interface TeamflowLocalConfig {
  /** Daten-Share-Wurzel (enthaelt `programm/`, `_intern/`, `backups/`). */
  datenShare?: string | null;
  /** Home-Ordner des Users — die App navigiert selbst nach `ZAH/`. */
  persoenlich?: string | null;
  /** Wurzel der Home-Laufwerke; Kinder = User-Verzeichnisse. */
  userFoldersRoot?: string | null;
  /** Ordner der CSV-Quelldateien (eigener IDB-Key, nicht in der smb-handles-Map). */
  csvSourceDir?: string | null;
  /** Ordner der DOCX-Gutachten-Vorlagen. */
  vorlagenDir?: string | null;
  /** DMS-Quellen je Source-Id → Ordner (Slot `dms-source-<id>`). */
  dmsSources?: Record<string, string>;
  /**
   * Profil-Seed. Ohne ihn landet die frische Varianten-IDB im Onboarding-Formular,
   * weil `App.tsx` `onboarding-complete` VOR dem Handle-Gate prueft.
   */
  profil?: { name: string; kuerzel?: string; isKurator?: boolean };
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
  variant: 'development' | 'production' | 'custom';
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
  /** Variante „local" — feste Entwickler-Ordner statt FSAPI-Picker. Nie in Prod. */
  local?: TeamflowLocalConfig | null;
  /** Modul „Anfragen" — externes ZIM FAQ-Assistent-Artifact (nur dev). Konfigwert
   *  (kein Hardcode): ein einmal unpublished Artifact bekommt eine neue URL,
   *  Tausch dann an EINER Stelle. */
  anfragen?: TeamflowAnfragenConfig;
  /** Antrag-Aufbereitung — Deep-Research-Ziel-URLs (nur dev). Konfigwert (kein
   *  Hardcode): Ziel-Seiten der externen Recherche-Dienste, an EINER Stelle tauschbar. */
  aufbereitung?: TeamflowAufbereitungConfig;
}

export interface TeamflowAnfragenConfig {
  /** URL des published Claude-Artifacts (FAQ-Suche + ZIM-Beratung). */
  dashboardUrl?: string;
}

export interface TeamflowAufbereitungConfig {
  /** Ziel-URL „Kopieren & ChatGPT öffnen" (Default in feature-flags.ts). */
  chatgptUrl?: string;
  /** Ziel-URL „Kopieren & Claude öffnen". */
  claudeUrl?: string;
  /** Ziel-URL „Kopieren & Mistral öffnen". */
  mistralUrl?: string;
}

export const runtimeConfig: TeamflowConfig = __TEAMFLOW_CONFIG__;
export const buildTime: string = __TEAMFLOW_BUILD_TIME__;
export const gitHash: string = __TEAMFLOW_GIT_HASH__;
export const appVersion: string = __TEAMFLOW_APP_VERSION__;

const DB_NAME_BASE = 'teamflow';

/**
 * Variantenspezifischer IndexedDB-Name (pure, testbar).
 *
 * Unter `file://` teilen alle Build-Varianten denselben Origin — ein konstanter
 * DB-Name liess prod/kurator/pl in DIESELBE IndexedDB schreiben (Bug-Klasse 1/3,
 * Datenverlust beim Varianten-Wechsel). Der Name wird deshalb aus dem pro Variante
 * eindeutigen `build.outputFilename` suffigiert.
 *
 * NIE der nackte `'teamflow'`: der Dev-Server (DEFAULT_CONFIG.outputFilename ===
 * 'teamflow') und ein fehlender/leerer Wert mappen auf den stabilen `'teamflow-dev'`.
 */
export function deriveVariantDbName(outputFilename: string | undefined): string {
  const suffix = outputFilename && outputFilename !== DB_NAME_BASE ? outputFilename : 'dev';
  return `${DB_NAME_BASE}-${suffix}`;
}

/** Laufzeit-Wrapper: leitet den IDB-Namen aus der aktiven Variant-Config ab. */
export function getVariantDbName(): string {
  return deriveVariantDbName(runtimeConfig.build.outputFilename);
}
