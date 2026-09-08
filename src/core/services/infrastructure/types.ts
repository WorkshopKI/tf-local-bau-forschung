/** Shared Types für den Infrastruktur-Layer (Phase 1a + v1.9-Strukturkonsolidierung). */

export const SMB_HANDLES_IDB_KEY = 'smb-handles';
// Neue Slot-Keys ab v1.9. Legacy-Slot `test-programm` wird beim Laden
// transparent als Fallback gelesen (siehe smb-handle.ts).
export const SMB_HANDLE_DATEN_SHARE = 'daten-share';
/**
 * v2.0: Persoenlicher Ordner (User-rw). Liegt typischerweise auf dem
 * Home-Laufwerk des Users. Pflegt profile.json, einstellungen.json
 * und die Feedback-Outbox; siehe PERSOENLICH_*-Pfad-Konstanten.
 */
export const SMB_HANDLE_PERSOENLICH = 'persoenlich';
/**
 * v2.0: Wurzel-Ordner aller User-Home-Laufwerke (z.B. `\\share\home-laufwerke\`).
 * Wird vom Kurator einmalig gepickt, damit die App im FeedbackInboxTab
 * JSON-Dateien aus `<user>/ZAH/feedback/outbox/` einsammeln kann.
 *
 * @deprecated Seit v4.1 liegen die persoenlichen Ordner unter MEHREREN Wurzeln
 * (`USER_FOLDERS_ROOT_SLOT_PREFIX`). Dieser Einzel-Slot bleibt LESBAR, damit
 * bestehende Installationen bis zum Neu-Zuordnen weiter einsammeln — er wird
 * unter der Id `legacy` gefuehrt und keiner Gruppe automatisch zugeordnet.
 */
export const SMB_HANDLE_USER_FOLDERS_ROOT = 'user-folders-root';

/**
 * v4.1: Schluessel-Praefix fuer die Wurzeln der persoenlichen Ordner in der
 * `smb-handles`-Map. Ein Eintrag je Gruppe aus `personalFolder.roots`:
 * `user-folders-root-${rootId}` -> FileSystemDirectoryHandle.
 *
 * Beachte: `'user-folders-root'.startsWith('user-folders-root-')` ist FALSE —
 * der Praefix-Scan erfasst den Alt-Slot bewusst NICHT. Genau deshalb ist die
 * Config-Id `legacy` gesperrt (sonst hiesse ihr Slot `user-folders-root-legacy`
 * und kollidierte fachlich mit dem echten Alt-Slot).
 */
export const USER_FOLDERS_ROOT_SLOT_PREFIX = 'user-folders-root-';

export function userFoldersRootSlotKey(rootId: string): string {
  return `${USER_FOLDERS_ROOT_SLOT_PREFIX}${rootId}`;
}
/**
 * @deprecated Seit v1.15 wird Multi-Source via `dms-source-${id}`-Slots verwaltet
 * (siehe DMS_SOURCE_SLOT_PREFIX). Dieser Single-Slot bleibt nur bis die Migration
 * (`migrateLegacyDmsSource`) einmal pro Installation gelaufen ist.
 */
export const SMB_HANDLE_DOKUMENTENQUELLE = 'dokumentenquelle';
/** @deprecated Vor v1.9. Wird als Fallback beim Laden des Daten-Share-Handles verwendet. */
export const SMB_HANDLE_LEGACY_TEST_PROGRAMM = 'test-programm';

/**
 * v1.15: Schluessel-Praefix fuer DMS-Source-Handles in der `smb-handles`-Map.
 * Ein Eintrag pro Source: `dms-source-${sourceId}` -> FileSystemDirectoryHandle.
 */
export const DMS_SOURCE_SLOT_PREFIX = 'dms-source-';

export function dmsSourceSlotKey(sourceId: string): string {
  return `${DMS_SOURCE_SLOT_PREFIX}${sourceId}`;
}

// IDB-Key-Werte bleiben unverändert, damit bestehende Test-Sessions weiter valide sind.
export const KURATOR_SESSION_META_IDB_KEY = 'admin-session-meta';

/** v3.0: Freischaltung der per Zusatzpasswort gesperrten Module. Geraetelokal —
 *  gehoert NIE in Snapshot, Share oder Personal-Mirror (eine Freischaltung ist
 *  eine Aussage ueber DIESES Geraet, nicht ueber das Team). */
export const MODUL_FREISCHALTUNG_IDB_KEY = 'modul-freischaltung';

export const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

/** Programm-Ordner-Name (v1.9). Migration aus `programm-test/` liegt in migration.ts. */
export const PROGRAMM_DIR_NAME = 'programm';
/** @deprecated Vor v1.9. Migration-Helper prüft auf diesen Namen. */
export const LEGACY_PROGRAMM_DIR_NAME = 'programm-test';

/** Unterordner im Programm-Ordner (relative zum Programm-Handle). */
export const PROGRAMM_SUBDIRS = ['antraege', 'schemas', 'index'] as const;
/** Hardcoded Rohdaten-Subordner für CSV-Importe. */
export const ANTRAEGE_IMPORTS_DIR = 'antraege/imports';

/** `_intern/` liegt im PARENT (Daten-Share-Root), nicht im programm/. */
export const INTERN_DIR = '_intern';
export const INTERN_FEEDBACK_DIR = '_intern/feedback';
export const AUDIT_LOG_PATH = '_intern/audit-log.jsonl';
/** v2.11: Zugangsdatei der MA-Login-Wall. JSON-Huelle mit pro-Eintrag Salt +
 *  AES-GCM-verschluesseltem Kuerzel (kein Klartext-Kuerzel/Passwort/Hint).
 *  Liegt auf dem Daten-Share.
 *  Schreib-Profil (Pitfall #23): idempotent-overwrite via `atomicWrite` MIT
 *  Backup (ganze Datei wird pro Mutation neu geschrieben). */
export const ZUGANG_CONFIG_PATH = '_intern/auslastung-zugang.enc';

export interface ZugangsEintrag {
  /** Base64, randomBytes(16) — pro Eintrag eigenes Salt. */
  salt: string;
  /** Base64 von `[12B IV][ciphertext+tag]` (Output von `crypto.encrypt`). */
  verschluesseltesKuerzel: string;
  /** Pseudonyme MA-ID ("MA01"). Erlaubt der PL Replace/Revoke per anonId. Login
   *  nutzt das Feld NICHT (probiert weiterhin ALLE Eintraege per Passwort, kein
   *  Hint) — verraet nichts ueber die ohnehin im Klartext liegende
   *  `_intern/auslastung-kuerzel-map.json` hinaus. */
  anonId: string;
}

export interface ZugangsFile {
  version: 1;
  updatedAt: string;
  eintraege: ZugangsEintrag[];
}

/** v2.11: sessionStorage-Key fuer das eingeloggte MA-Kuerzel. sessionStorage
 *  (NICHT IDB): TTL = Browser-Tab, loescht sich beim Schliessen → erzwingt Login
 *  pro Arbeitstag. Es wird AUSSCHLIESSLICH das entschluesselte Kuerzel abgelegt,
 *  NIE Passwort oder abgeleiteter Key. */
export const MA_KUERZEL_SESSION_KEY = 'tf-ma-kuerzel';
export const BUILD_LOCK_PATH = '_intern/build-lock.json';
export const HEARTBEAT_PROBE_PATH = '_intern/heartbeat-probe';
export const SCAN_MANIFEST_PATH = '_intern/scan-manifest.json';
/** Phase 2: gefilterte DMS-CSV (Output von scripts/filter-dms-csv.mjs). */
export const DMS_INDEX_FILTERED_PATH = '_intern/dms-index-filtered.csv';
/** Phase 2: editierbares Override-Mapping Aktenplanzuordnung → doc_type. */
export const AKTENPLAN_MAPPING_PATH = '_intern/aktenplan-mapping.json';
export const README_PATH = 'README.txt';

/**
 * v2.0: Pfade auf dem persoenlichen Laufwerk (Subpfade unterhalb des Persoenlich-
 * Handles). Wird beim ersten Mount automatisch angelegt (siehe ensurePersoenlich-
 * Folders) — sind hier zentral definiert, damit Outbox-Reader im Kurator-Plugin
 * die gleiche Struktur erwartet.
 *
 * v2.6.2: Subordner von `teamflow` auf `ZAH` umbenannt (App-Branding). Der
 * Config-Wert `personalFolder.subfolder` (Anzeige im Onboarding) wird parallel
 * gepflegt. Legacy-`teamflow/`-Ordner werden NICHT automatisch migriert.
 */
export const PERSOENLICH_ZAH_DIR = 'ZAH';
export const PERSOENLICH_FEEDBACK_DIR = 'ZAH/feedback';
export const PERSOENLICH_FEEDBACK_OUTBOX_DIR = 'ZAH/feedback/outbox';
export const PERSOENLICH_PROFILE_FILE = 'ZAH/profile.json';
export const PERSOENLICH_EINSTELLUNGEN_FILE = 'ZAH/einstellungen.json';
export const PERSOENLICH_MEINE_FEEDBACKS_FILE = 'ZAH/feedback/meine-feedbacks.json';
/**
 * v2.32: Sponsoring-Stimmen des Feedback-Boards. Read-only prod-Enduser koennen
 * `_intern/feedback/feedback.json` nicht schreiben — ihre Punkte-Stimmen landen
 * hier im eigenen Ordner als Map `ticketId → Punkte`, der Kurator sammelt sie
 * ueber den User-Folders-Root ein und mergt sie in die zentrale feedback.json
 * (Sponsoring-Felder). Spiegelbild von `PERSOENLICH_AUSLASTUNG_UEBERNAHME_FILE`.
 * Relativ zum User-Home-Root, daher in beiden Lese-Kontexten identisch nutzbar.
 */
export const PERSOENLICH_FEEDBACK_SPONSOR_FILE = 'ZAH/feedback/sponsor-wuensche.json';
/**
 * v2.199 (Redesign): leichte Votes/Likes des Feedback-Boards. Read-only prod-User
 * spiegeln ihre Stimmen hier (Liste `ticketId[]` + `updatedAt`); der Kurator
 * sammelt sie ueber den User-Folders-Root ein und mergt sie in die zentrale
 * feedback.json (`votes`). Spiegelbild von {@link PERSOENLICH_FEEDBACK_SPONSOR_FILE}.
 */
export const PERSOENLICH_FEEDBACK_VOTES_FILE = 'ZAH/feedback/vote-wuensche.json';
/**
 * v2.199 (Redesign): Kommentar-Outbox des Feedback-Boards. Read-only prod-User
 * schreiben ihre neuen Kommentare hier (append-only Liste); der Kurator sammelt
 * sie ein und mergt sie in die zentrale feedback.json (`comments`, Union-by-id).
 */
export const PERSOENLICH_FEEDBACK_COMMENTS_FILE = 'ZAH/feedback/kommentar-outbox.json';
/**
 * v2.6: MA-Selbst-Profil fuers Auslastungs-Modul (Technologien/Kategorien).
 * Nicht-Kuratoren haben seit v2.0 nur `read` auf dem Daten-Share und koennen
 * `_intern/auslastung.json` nicht schreiben — sie pflegen ihr Profil hier im
 * eigenen Ordner; die PL sammelt alle Profile ueber den User-Folders-Root ein.
 * Relativ zum User-Home-Root, daher in beiden Lese-Kontexten (eigener
 * Persoenlich-Handle + fremder User-Ordner) identisch nutzbar.
 */
export const PERSOENLICH_AUSLASTUNG_PROFIL_FILE = 'ZAH/auslastung-profil.json';
/**
 * v2.9: Übernahme-Wünsche („Kann ich übernehmen"). Spiegelbild des Profils:
 * Nicht-Kuratoren (prod) haben nur `read` auf dem Daten-Share und koennen
 * `_intern/auslastung.json` nicht schreiben — der Wunsch landet hier im eigenen
 * Ordner, die PL sammelt alle Wünsche ueber den User-Folders-Root ein und mergt
 * sie als `Zuweisung{status:'selbst'}` in `auslastung.json`. Relativ zum
 * User-Home-Root, daher in beiden Lese-Kontexten identisch nutzbar.
 */
export const PERSOENLICH_AUSLASTUNG_UEBERNAHME_FILE = 'ZAH/auslastung-uebernahme.json';
/**
 * v2.59: Presence-Heartbeat fuer den PL-„Online"-Tab. Jeder Client schreibt,
 * solange die App offen ist, periodisch sein Kuerzel/Name + Zeitstempel hierher
 * (best-effort, `skipBackup` — verlusttolerant, Pitfall #23). Die PL sammelt
 * alle Heartbeats ueber den User-Folders-Root ein und zeigt „zuletzt aktiv vor
 * X Min". Relativ zum User-Home-Root, daher in beiden Lese-Kontexten (eigener
 * Persoenlich-Handle + fremder User-Ordner) identisch nutzbar — analog
 * PERSOENLICH_AUSLASTUNG_PROFIL_FILE.
 */
export const PERSOENLICH_ONLINE_STATUS_FILE = 'ZAH/online-status.json';
/**
 * Meilenstein-Risiken („Ich weiß, dass ich diesen Meilenstein nicht halte").
 * Spiegelbild der Übernahme-Wünsche: der Bearbeiter kann `_intern/*` nicht
 * schreiben, deshalb landet die Meldung im eigenen Ordner und die PL sammelt sie
 * über den User-Folders-Root ein. Relativ zum User-Home-Root, daher in beiden
 * Lese-Kontexten identisch nutzbar.
 */
export const PERSOENLICH_MEILENSTEIN_RISIKO_FILE = 'ZAH/meilenstein-risiken.json';
/**
 * User-Tweaks v2: persönliche Stil-Schicht für Skills (eigene Stil-Hinweise +
 * Beispiel-Formulierungen pro `skillId`). Anders als die übrigen ZAH-Dateien
 * wird diese NIE eingesammelt — Tweaks sind rein privat (kein Team-Aspekt, keine
 * Kurator-Sicht). Best-effort-Spiegel des IDB-Cache (`skill-tweaks:<skillId>`),
 * damit der Tweak dem Nutzer über Rechner/Sessions folgt + IDB-Verlust übersteht
 * (Last-Writer-Wins über `geaendert_am`). Format: `{ version, tweaks: Record<skillId, SkillTweak> }`.
 */
export const PERSOENLICH_SKILL_TWEAKS_FILE = 'ZAH/skill-tweaks.json';

/**
 * v2.0: IDB-Flag das die App beim Start anlegt, wenn ein bestehender Daten-
 * Share-Handle mit `readwrite`-Mode existiert obwohl der User Nicht-Kurator
 * ist. Der StartupScreen rendert dann ein Migrations-Banner und triggert
 * einen Re-Pick mit `read`-Mode. Wird nach erfolgreichem Re-Pick geloescht.
 */
export const NEEDS_HANDLE_DOWNGRADE_IDB_KEY = 'needs-handle-downgrade';

/**
 * v4.0: Die Generation des Ablageorts (`data.shareGeneration`), mit der diese
 * Installation zuletzt erfolgreich verbunden war. Fehlt der Wert, gilt `1`.
 *
 * Zieht der Daten-Share auf einen neuen Ordner um, reicht ein Config-Rollout
 * NICHT: ein FSAPI-Handle haengt am Dateisystem-Objekt, nicht am Anzeigepfad.
 * `App.tsx` wertet `fixedDataSharePath` nur aus, wenn ueberhaupt kein Handle in
 * der IDB liegt — bestehende Installationen wuerden still in den ALTEN Ordner
 * weiterschreiben (`isSmbAvailable` prueft nur, ob `_intern/` existiert). Ist
 * die gespeicherte Generation kleiner als die der Config, rendert der
 * StartupScreen deshalb ein Umzugs-Banner und erzwingt einen Re-Pick. Der alte
 * Handle bleibt dabei stehen, bis der neue erfolgreich gewaehlt wurde.
 *
 * Geschrieben wird ausschliesslich nach einem GELUNGENEN Verbinden — also in
 * `connectDataShare` (deckt Erstverknuepfung, Umzug, In-App-CTA und
 * Offline-Recovery) und im eigenen Pick-Pfad des `WelcomeScreen`.
 */
export const SHARE_GENERATION_IDB_KEY = 'share-generation';

/**
 * IDB-Key für die pro-CsvSchema gespeicherten `FileSystemFileHandle`s
 * (Auto-Refresh-Quelldateien). In Core definiert (zentrale IDB-Key-Registry),
 * genutzt vom csv-sources-kuration-Plugin UND vom Start-Re-Grant in
 * `refreshAllPermissions` (smb-handle.ts), das die FSAPI-Datei-Berechtigung
 * beim App-Start neu erteilt — sonst fragt der Auto-Refresh-Banner nach jedem
 * Neustart erneut nach Verknüpfung (v2.19.1).
 */
export const CSV_SOURCE_HANDLES_IDB_KEY = 'csv-source-handles';

/**
 * v2.27: EIN `FileSystemDirectoryHandle` für den Ordner, der alle CSV-Quell-
 * dateien einer pl-Installation enthält. Löst die N Per-Datei-Handles
 * (`CSV_SOURCE_HANDLES_IDB_KEY`) als Re-Grant-Ziel ab: FSAPI-Directory-Permission
 * **kaskadiert** auf Kind-Dateien, die über `dirHandle.getFileHandle(name)`
 * geöffnet werden — EIN `requestPermission`-Prompt deckt alle CSVs ab. Das
 * umgeht das Chromium-Limit „nur der erste Permission-Prompt pro User-Gesture
 * wird angezeigt": die alte Per-Datei-Schleife in `refreshAllPermissions` lief
 * nach dem Daten-Share-Prompt, der den Gesture bereits verbraucht hatte → die
 * CSV-Handles blieben nach jedem Neustart ungranted (v2.19.1-Folgebug).
 */
export const CSV_SOURCE_DIR_HANDLE_IDB_KEY = 'csv-source-dir-handle';

/**
 * v2.27.2: Lokale Zuordnung schemaId → Dateiname INNERHALB des CSV-Ordner-Handles
 * (`Record<schemaId, fileName>`). Macht das Auflösen einer CSV-Quelle zum
 * schnellen `dirHandle.getFileHandle(name)` (nur Metadaten), statt bei jedem
 * `checkSourceForUpdate` den ganzen Ordner zu scannen + jede CSV zu parsen, um
 * die Datei per Header-Validierung zu finden (auf einem SMB-Share = mehrere
 * Sekunden, v.a. bei kaltem OS-Cache). Bewusst ein EIGENER, **nicht
 * synchronisierter** Key (nicht `source_file_name` auf dem Schema), damit die
 * Zuordnung maschine-lokal bleibt und nicht vom Share-Snapshot überschrieben
 * wird. Wird in `pickAndLinkCsvFolder` geschrieben + beim ersten Lauf
 * selbst-geheilt; mit `clearCsvSourceDirHandle` zusammen gelöscht.
 */
export const CSV_SOURCE_DIR_FILEMAP_IDB_KEY = 'csv-source-dir-filemap';

/**
 * Lokaler Import-Stempel je CSV-Quelle (`Record<schemaId, LokalerImportStempel>`,
 * siehe `csv/lokaler-stempel.ts`): „DIESER Rechner hat DIESE Datei (mtime, Größe,
 * SHA-1) verarbeitet". Bewusst ein maschine-lokaler Key wie die Filemap — der
 * Team-Stempel im Schema wird beim Snapshot-Sync durch die Sicht des letzten
 * Publizierers ersetzt; sieht der die Quelle anders, gälte die eigene, längst
 * importierte Datei ohne diesen Beleg bei jedem Start wieder als „neu"
 * (Import-Publish-Kette zwischen zwei Rechnern, Produktiv-Fall Sept. 2026).
 */
export const CSV_SOURCE_LOKAL_STEMPEL_IDB_KEY = 'csv-source-lokal-stempel';

/** Backup-Root. v1.9: ohne programm-test-Zwischenordner; Rolling 4 Generationen. */
export const BACKUPS_DIR = 'backups';
export const BACKUP_MAX_GENERATIONS = 4;

export interface AuditEntry {
  ts: string;
  user: string;
  action: string;
  details?: unknown;
}

export interface BuildLock {
  programm_id: string;
  stufe: string;
  hostname: string;
  kurator_name: string;
  gestartet: string;
  heartbeat: string;
  geschaetzt_fertig?: string;
  /**
   * Wer haelt den Lock TECHNISCH — diese Modul-Ladung (= dieses Tab), unabhaengig
   * vom menschlichen `kurator_name`. Erst damit ist „das ist mein eigenes
   * Ueberbleibsel" von „da arbeitet jemand" unterscheidbar: derselbe Mensch in
   * einem zweiten Fenster ist NICHT derselbe Halter (v3.46.1).
   *
   * Optional: Locks aus aelteren Builds tragen das Feld nicht und gelten dann
   * nie als „meiner" — sie verhalten sich exakt wie bisher.
   */
  owner_id?: string;
}

export interface BackupEntry {
  datum: string;
  folderName: string;
  fileCount: number;
}

export interface SessionMeta {
  kuratorName: string;
  expiresAt: number;
}

/** Ordner-Validierungs-Status beim Auswählen eines Daten-Share-Ordners. */
export type FolderValidationResult =
  | { kind: 'empty' }
  | { kind: 'current' }
  | { kind: 'legacy'; legacyFilesCount: number; dokumenteFileCount: number }
  | { kind: 'subfolder'; detected: 'programm' | 'intern' | 'legacy-programm-test' };
