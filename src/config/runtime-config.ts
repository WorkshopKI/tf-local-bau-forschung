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
  /**
   * Grundfarbe des Favicons (`#rrggbb`). Wird ausschliesslich zur BAUZEIT
   * ausgewertet (vite.config.ts → scripts/favicon.mjs backt das SVG als
   * data:-URI ins HTML) — zur Laufzeit liest das Feld niemand.
   */
  faviconColor?: string;
}

export interface TeamflowDataConfig {
  fixedDataSharePath: string | null;
  /**
   * v2.0: Erwarteter Ordner-Name beim Daten-Share-Picker. Wenn gesetzt, prueft
   * WelcomeScreen `handle.name` gegen diesen Wert; bei Mismatch wird der Picker
   * erneut geoeffnet mit Hinweis.
   */
  expectedFolderName: string | null;
  /**
   * v4.0: Generation des Ablageorts (ganze Zahl >= 1). Zieht der Daten-Share
   * um, wird sie zusammen mit `fixedDataSharePath` hochgezaehlt. Die App merkt
   * sich die zuletzt verbundene Generation unter `SHARE_GENERATION_IDB_KEY` und
   * erzwingt beim Start einen Re-Pick, solange die gespeicherte kleiner ist.
   */
  shareGeneration: number;
  /**
   * v4.0: Pfad des CSV-Import-Ordners. Liegt AUSSERHALB des Daten-Shares und
   * zieht nicht mit um. Wird beim Verknuepfen nur angezeigt und ist kopierbar —
   * die File System Access API erlaubt keine programmatische Vorauswahl.
   */
  fixedCsvImportPfad: string | null;
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
  /**
   * v4.1: Wurzeln, unter denen die persoenlichen Ordner der Anwender liegen.
   * Die `id` ist Teil des Handle-Slots `user-folders-root-<id>` und muss stabil
   * bleiben; `legacy` ist fuer den Alt-Slot reserviert. Fehlend/leer = keine
   * Wurzel konfiguriert.
   */
  roots?: TeamflowPersonalRootConfig[];
}

export interface TeamflowPersonalRootConfig {
  id: string;
  label: string;
}

/**
 * Build-Time-Feature-Flags.
 *
 * **Ein Flag lohnt sich nur, wenn er in den Varianten UNTERSCHIEDLICHE Werte hat.**
 * Mit v3.0 (Zusammenlegung auf dev/pl/prod) sind elf Flags entfallen, die überall
 * denselben Wert trugen oder nur eine abgeschaffte Variante bedienten:
 * `feedback`, `suche`, `antraege`, `streamlitBridge` (schon vorher überall an),
 * `volltextsuche`, `auslastungSelbstEintragung`, `embeddingCorpusBuild` (durch die
 * Zusammenlegung überall an), `auslastungNurKorpus`, `kuerzelDropdown` (nur für
 * abgeschaffte Varianten) sowie `deAnonymisierung` und `maVerwaltungPasswort`
 * (beide gaten nur Oberfläche INNERHALB des Auslastungs-Moduls, das seinerseits
 * hinter dem Zusatzpasswort liegt — ein Schloss im Tresor).
 */
export interface TeamflowFeatures {
  kuratorMenus: boolean;
  dokumentenscan: boolean;
  devInfraPanel: boolean;
  devFixtures: boolean;
  dokumente: boolean;
  /** Plugin "Auslastung" — automatische Kategorisierung + MA-Zuweisung (PL-Tool).
   *  Seit v3.0 heisst `true` nur „einkompiliert": in pl liegt das Modul hinter
   *  einem Zusatzpasswort (`moduleAuth.auslastung`). */
  auslastung: boolean;
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
  /** v2.97: Delta-Snapshots SCHREIBEN — der Writer publiziert nur geänderte
   *  antraege-Records (`antraege.delta.<seq>.jsonl`) statt der vollen Datei.
   *  Braucht `datenShareSchreibrecht`; nur pl + kurator (+ dev). Der LESER
   *  versteht Deltas immer (kein Flag). Optional, default false. ERST aktivieren,
   *  wenn der Delta-Leser (v2.97) flächig ausgerollt ist (2-Phasen-Rollout). */
  deltaSnapshotWrite?: boolean;
  /** Assistent Phase 0: gerätelokales, opt-in Ereignisprotokoll (Fundament für
   *  den späteren persönlichen Assistenten). Gated Aufzeichnung + Einstellungs-
   *  Sektion. dev + pl + kurator + as; Freischaltung ≠ Aufzeichnung (das Opt-in
   *  bleibt beim User). Optional, default false. */
  assistentProtokoll?: boolean;
  /** Assistent Phase 1: kontextbewusstes Assistenz-Panel (deterministisch
   *  assemblierter Kontext, intern-only Transport, session-only Historie). Shell-
   *  weites Dock. dev + pl + kurator + as. Optional, default false. */
  assistentPanel?: boolean;
  /** Assistent Phase 2: Gedächtnis-Konsolidierung (Sleep-time). Hintergrundlauf
   *  destilliert das Ereignisprotokoll per INTERNEM Modell in Memory-Blocks;
   *  doppeltes Opt-in. dev + pl + kurator + as; setzt `assistentPanel` +
   *  `assistentProtokoll` voraus (von `validateConfig` erzwungen). Optional,
   *  default false. */
  assistentGedaechtnis?: boolean;
  /** Suche mit natürlicher Sprache: die interne KI übersetzt eine Frage in einen
   *  Frageplan (Leitbegriffe mit ihren Schreibweisen, Einschränkungen, Facetten);
   *  die Suchstufe läuft unverändert weiter und wertet wie immer nach Abdeckung.
   *  dev + pl. Optional, default false. */
  sucheNatuerlicheSprache?: boolean;
  /** Doppelförderungs-Prüfung: eine gemeldete Frühkoordinierungs-Liste (XLSX)
   *  wird zeilenweise gegen den Antragsbestand gehalten — drei Schlagworte je
   *  Zeile von der internen KI, danach Wortlaut- und Ähnlichkeitsstufe der
   *  vorhandenen Suche. Eigene Seite ausserhalb der Navigation, erreichbar über
   *  das ⋯-Menü der Suchseite. Braucht die interne KI (Bridge). dev + pl.
   *  Optional, default false. */
  doppelfoerderung?: boolean;
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
  /** Eigene Spalten der Fördertabelle: Feld-, Sammel- und Regel-Spalten, die der
   *  Nutzer selbst anlegt. Gated Picker-Fuß, Editor und die Projektion der
   *  referenzierten Rohfelder. dev/pl. Optional, default false. */
  eigeneSpalten?: boolean;
  /** Metadaten-Extraktion über eine frei konfigurierte API-Adresse — die Einträge
   *  „Interne KI-API" und „OpenRouter API" im Aufklappmenü der Seite „Suche &
   *  Index". Beide bauen ihren `DirectLLMTransport` aus dem `ai-provider`-Eintrag,
   *  den nur die dev-Provider-Klappe setzt; in pl steht dort die Streamlit-Adresse,
   *  gegen die ein OpenAI-kompatibler Ping scheitert. Ohne den Flag zeigt das Menü
   *  nur die Wege, die in dieser Variante auch laufen können. dev + local.
   *  Optional, default false. */
  metadatenDirektApi?: boolean;
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
 * v3.0: Module, die zur LAUFZEIT per Zusatzpasswort freigeschaltet werden.
 *
 * Hintergrund: bis v2.x trennten eigene Build-Varianten (`pl`/`as`/`kurator`) die
 * Zielgruppen. Seit der Zusammenlegung entscheidet ein Passwort statt eines Builds.
 */
export type ModulSlot = 'auslastung' | 'kurator';

/** Alle bekannten Slots — Reihenfolge = Prüfreihenfolge in `verifyAnyPassword`. */
export const MODUL_SLOTS: readonly ModulSlot[] = ['auslastung', 'kurator'] as const;

/** Ein Schloss: dieselbe Krypto wie `auth`, erzeugt vom selben Build-Tool. */
export interface TeamflowModuleAuthEntry {
  /** Base64, 16 Random-Bytes (PBKDF2-Salt). */
  salt: string;
  /** Base64, [12B IV][ciphertext+tag]; Sentinel trägt `role: <slot>`. */
  verifier: string;
  /** Optionaler Hinweis im Freischalt-Dialog. */
  hint?: string;
}

/**
 * **Vorhandener Slot = gesperrt, fehlender Slot = offen.** Kein `required` je Slot.
 *
 * Diese Regel hält `dev` und `local` verhaltensgleich: beide führen keinen Block,
 * also ist dort nichts gesperrt — sonst wäre ausgerechnet in der Abnahme-Umgebung
 * (`npm run dev:local`) das Modul unsichtbar.
 */
export type TeamflowModuleAuth = Partial<Record<ModulSlot, TeamflowModuleAuthEntry>>;

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
  /**
   * v4.1: Wurzeln der persoenlichen Ordner je Gruppe (`rootId → Pfad`), passend
   * zu `personalFolder.roots`. Der Singular oben bleibt daneben bedienbar und
   * bedient den Alt-Slot — so ist der „legacy"-Fall lokal durchspielbar.
   */
  userFoldersRoots?: Record<string, string>;
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
  /** v2.16 — optionales Build-Time Rollen-Passwort-Gate (App-Start, ganze App). */
  auth?: TeamflowAuthConfig;
  /** v3.0 — optionale Modul-Schlösser (Auslastung / Kurator). Fehlt = nichts gesperrt. */
  moduleAuth?: TeamflowModuleAuth;
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
