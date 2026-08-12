# Infrastructure Layer (Phase 1a + v1.9)

*Last reviewed: 2026-05-28 (v2.2.0)*

Kurator-Session-Verwaltung, SMB-Connectivity-Monitoring und sichere Datei-Operationen. Alle Module in [src/core/services/infrastructure/](../../src/core/services/infrastructure/), Stores in [src/core/hooks/](../../src/core/hooks/).

## Kurator-Session

`useKuratorSession`: 12h-TTL-Session mit verschlüsselter Kurator-Config (AES-GCM 256 + PBKDF2-SHA-256 @ 200k Iterations, Web Crypto API). Meta (`expiresAt`, `kuratorName`, `ttlMs`) in IndexedDB persistiert (`KURATOR_SESSION_META_IDB_KEY`, Value-String bleibt `'admin-session-meta'` für Kompat). Aktivität verlängert Session (`useKuratorActivityTracker`). ShellLayout hält Tick-Loop. Actions: `setup`, `activate`, `deactivate`, `extend`, `changePassword`, `rehydrate` (liest Legacy-Feld `adminName` als Fallback).

## SMB-Handles

[smb-handle.ts](../../src/core/services/infrastructure/smb-handle.ts): IDB-Map `smb-handles` mit drei Slot-Kategorien:
- `daten-share` (Hauptordner mit `programm/`, `backups/`, `_intern/`, readwrite),
- Multi-Source-DMS-Slots `dms-source-${id}` (read-only, ab v1.15 — Verwaltung im Plugin „Dokumentenquellen"),
- Legacy-Slot `dokumentenquelle` (read-only, vor v1.15; wird beim ersten v1.15-Start in eine Default-Source migriert).

Legacy-Slot `test-programm` wird beim Lesen als Fallback verwendet.

## SMB-Connectivity

`useSmbStatus`: 5-Min-Polling via `probeSmb()`. Status: `online`/`offline`/`unknown`/`denied`. Probe öffnet `_intern/`. Dev-Panel kann Offline simulieren. Gate `requireOnline()` für Kurator-Aktionen. In-Memory only (keine Persistenz).

## Atomic Writes

[atomic-write.ts](../../src/core/services/infrastructure/atomic-write.ts): Schreiben über `.tmp`-Datei + Rename zu Ziel; altes Ziel → `.backup` (1-Generations-Rotation). Native `move()` mit Read-Write-Delete-Fallback. Append-Writes (`appendToFile`) überspringen Backup.

**Alle Infrastructure-Writes müssen diese Helper verwenden** — direkter `FileSystemWritableFileStream` kann bei Crash korrumpieren. Dokumentierte Ausnahme: [src/phase2/triage/run-log.ts](../../src/phase2/triage/run-log.ts) (CLAUDE.md Pitfall #10).

## Audit-Log

[audit-log.ts](../../src/core/services/infrastructure/audit-log.ts): JSONL-Append-Only in `_intern/audit-log.jsonl`. `logAudit({ user, action, details })` / `getRecentAudits(n)`. Session-Events mit Action-Keys `kurator_login`/`kurator_logout`/`kurator_setup`/`kurator_password_changed`. Strukturelle Migration schreibt `kurator_structure_migrated` mit Statistik. (v1.9-Legacy-Pfad-Fallback wurde mit v2.3 entfernt.)

## Build-Lock

[build-lock.ts](../../src/core/services/infrastructure/build-lock.ts): Heartbeat-basierter Lock in `_intern/build-lock.json` verhindert parallele Builds. Schema: `{ programm_id, stufe, hostname, kurator_name, owner_id?, gestartet, heartbeat }`. Stale-Detection: Heartbeat > 2h, für `stufe: 'csv-import'` > 3 Min (`staleThresholdForStufe`). Actions: `acquireBuildLock`, `forceLock`, `heartbeat`, `startHeartbeat`, `releaseLock`. Legacy-Feld `admin_name` wird beim Lesen auf `kurator_name` gemappt (Content-Level, defense-in-depth).

Drei Zusagen seit v3.46.1 (Pitfall #52, [recurring-bug-classes §19](recurring-bug-classes.md)):

- **`owner_id`** ist die technische Kennung DIESER Modul-Ladung (= dieses Tabs), erzeugt per `uuid()` und bewusst **nicht persistiert** — nach einem Reload ist es absichtlich ein anderer Halter. Erst damit ist ein eigenes Überbleibsel von einem fremden Schreiber unterscheidbar: `acquireBuildLock` übernimmt einen aktiven Lock, wenn `darfEigenenLockUebernehmen` gilt (eigene `owner_id` **und** dieses Modul hält gerade nicht selbst), sonst blockiert es und meldet `besitz` (`fremd` / `gleicher-name` / `eigener-tab`). Locks ohne das Feld verhalten sich wie vorher.
- **`startHeartbeat(idb) → { stop(): Promise<void> }`** ist der einzige zulässige Takt (Guard `no-raw-lock-heartbeat-interval`). `stop()` wartet den laufenden Schlag ab; `heartbeat` prüft sein Stopp-Flag unmittelbar vor dem Write und hält **keinen fremden** Lock frisch.
- **`releaseLock` verifiziert.** Nach dem Löschen wird erneut gelesen (`bewerteFreigabe`), einmal nachgefasst und im Zweifel `build_lock_release_failed` protokolliert — vorher meldete der Erfolgs-Eintrag auch dann Erfolg, wenn das Löschen scheiterte.

## Backup

[backup.ts](../../src/core/services/infrastructure/backup.ts): Wöchentliche Snapshots in `backups/YYYY-MM-DD/` (ab v1.9 direkt am Daten-Share-Root). Rolling 4 Generationen; `deleteOldestBackup()` beim Überlauf. `dokumente/` wird ausgeschlossen (GB-Scale-Files; kommt in Phase 2 in separaten Dokumentenquelle-Handle). `shouldSuggestWeeklyBackup()` als UX-Hint. Trigger: prüft beim ersten Kurator-Login einer Woche und schlägt manuelles Backup vor.

Recovery läuft manuell über den Explorer (Kurator kopiert relevante Dateien aus `backups/YYYY-MM-DD/` zurück); Volumen typisch ~2 GB, Wiederherstellung ~2–5 min über LAN-SMB.

## Migration

[migration.ts](../../src/core/services/infrastructure/migration.ts):
- `validateSelectedFolder(handle)` klassifiziert Ordner in `current`/`empty`/`legacy`/`subfolder`.
- `migrateLegacyStructure(idb, parent)` verschiebt Legacy-Daten aus `programm-test/` und `feedback/` in die v1.9-Struktur, benennt `admin-*` → `kurator-*`, löscht `programm-test/dokumente/` (mit Count-Anzeige im Dialog vor Bestätigung), rotiert Backups aus der Zwischenebene. Idempotent.

## Kurator-Config (entfallen mit v3.0)

`kurator-config.ts` und `_intern/kurator-config.enc` gibt es nicht mehr. Der Kurator-Zugang
existierte doppelt — als Passwortdatei auf dem Share und als build-eingebackenes Passwort der
Start-Wall. Geblieben ist der Build-Weg (`verifyModulPassword` in
[app-password.ts](../../src/core/services/infrastructure/app-password.ts)); die Session hält seither
nur noch Zustand. Die Audit-Identität kommt aus dem Profilnamen statt aus der Datei —
inhaltlich ein Gewinn, weil der kurator-Build bei Shared-Passwort das Build-Label in jeden
Eintrag stempelte. Detail: [modul-freischaltung.md](modul-freischaltung.md).

## Shared Types/Constants

[types.ts](../../src/core/services/infrastructure/types.ts): `AuditEntry`, `BuildLock`, `BackupEntry`, `SessionMeta`, `FolderValidationResult` + Pfad-Konstanten:

- `AUDIT_LOG_PATH='_intern/audit-log.jsonl'`
- `BUILD_LOCK_PATH='_intern/build-lock.json'`

- `PROGRAMM_DIR_NAME='programm'`
- `PROGRAMM_SUBDIRS=['antraege','schemas','index']`
- `INTERN_DIR='_intern'`

Legacy-Konstanten (`LEGACY_PROGRAMM_DIR_NAME` etc.) bleiben nur für Migration-Detection in `migration.ts` — die LEGACY_*-Pfad-Reads in audit-log/build-lock/kurator-config wurden mit v2.3 entfernt.

## Welcome-Seite

[src/core/WelcomeScreen.tsx](../../src/core/WelcomeScreen.tsx) (v1.9): Wird beim ersten App-Start angezeigt, wenn Profil existiert aber kein `smb-handles.daten-share`. Zeigt Beispiel-Pfad + „Pfad kopieren"-Button + 4-Schritte-Anleitung + Ordner-Picker. Nach Auswahl: Validierungs-Dialog (einrichten / migrieren / anderen wählen). Legacy-Migration-Dialog zeigt orangen Warnblock mit Datei-Count für `programm-test/dokumente/` (wird gelöscht).

Gate-Logik in `App.tsx`: `Onboarding → WelcomeScreen → AppRouter`.

## Dev-Plugin

[src/plugins/dev-infrastructure-test/](../../src/plugins/dev-infrastructure-test/) (`id: 'dev-infrastructure-test'`, KEIN kuratorOnly):
Test-Harness mit 5+ Panels (SMB & Handle inkl. Dokumentenquelle-Slot / Kurator-Modus / Atomic Writes & Backup / Build-Lock / Phase-2-Triage + Fixtures). `icon: 'FlaskConical'`, `category: 'kuration'`, `order: 99`.
