# CLAUDE.md — TeamFlow Local App

## Project Overview

TeamFlow Local is a serverless browser app for collaborative task management with AI integration, deployed exclusively via file server (`file://` protocol). Two departments (building permits / research grants) manage workflows, generate artifacts, and use AI-powered search — all without IT infrastructure.

**Read `DESIGN_GUIDE.md` for visual design rules before making any UI changes.**

## Ignorierte Verzeichnisse

Folgende Pfade NICHT lesen oder referenzieren beim Arbeiten am Code:

- `_archive/` — Historische Architektur-Docs, erledigte Audits, überholte Test-Daten. Enthält die alte MVP-Architektur (postMessage-AI-Bridge, Vorgang-zentriertes Datenmodell, "Admin"-Terminologie) und führt bei aktuellem Code zu falschen Annahmen. Ein Agent, der hier sucht, bekommt mit hoher Wahrscheinlichkeit überholte Guidance.
- `node_modules/`, `dist*/`, `.vite/` — Build-Artefakte.
- `_reference/` — externe Referenz-Apps und Mockup-Bilder, nicht Teil von TeamFlow. Wird von Vite (`server.watch.ignored`) ignoriert.

## Agent-Cheatsheets

Wiederkehrende Erweiterungen haben jeweils mehrere Touch-Points, die synchron gepflegt werden müssen. Vor dem Patchen das passende Cheatsheet öffnen statt die Codebase neu zu scannen:

- [docs/agents/add-plugin.md](docs/agents/add-plugin.md) — Neues Plugin registrieren
- [docs/agents/add-csv-field.md](docs/agents/add-csv-field.md) — Neues `CanonicalField`
- [docs/agents/add-doc-type.md](docs/agents/add-doc-type.md) — Neuer Phase-2 doc_type
- [docs/agents/add-feature-flag.md](docs/agents/add-feature-flag.md) — Neuer Build-Time-Flag
- [docs/agents/add-idb-store.md](docs/agents/add-idb-store.md) — Neuer IndexedDB-Store
- [docs/agents/add-view.md](docs/agents/add-view.md) — Neue View in `src/plugins/antraege/views.ts`
- [docs/agents/add-filter-facet.md](docs/agents/add-filter-facet.md) — Neue Filter-Facet in der Filter-Sidebar
- [docs/agents/add-phase2-stage.md](docs/agents/add-phase2-stage.md) — Neue Stage in der Triage-Pipeline
- [docs/agents/add-sidecar-persistence.md](docs/agents/add-sidecar-persistence.md) — Sidecar-Datei auf SMB-Daten-Share spiegeln
- [docs/agents/add-build-script.md](docs/agents/add-build-script.md) — Neues Build-Script / Prebuild-Hook anlegen
- [docs/agents/async-error-pattern.md](docs/agents/async-error-pattern.md) — Async-UI-Aktion mit Error-Handling (`useAsyncAction`)
- [docs/agents/change-app-branding.md](docs/agents/change-app-branding.md) — App-Name, Untertitel und HTML-Filename ändern
- [docs/agents/file-protocol-pitfalls.md](docs/agents/file-protocol-pitfalls.md) — `file://`-Quick-Reference
- [docs/agents/port-design-export.md](docs/agents/port-design-export.md) — Claude-Design-Tool-Exporte portieren

Index: [docs/agents/README.md](docs/agents/README.md).

## Critical Constraints

- **DEPLOYMENT**: App runs from `file://` protocol — NO HTTP server, NO backend, NO Node.js at runtime
- **SINGLE FILE BUILD**: Production build MUST compile to ONE `index.html` via `vite-plugin-singlefile`
- **NO CHROME FLAGS**: App must work in standard Chrome/Edge without `--allow-file-access-from-files` or any other flags
- **WEB WORKERS**: Must use Vite `?worker&inline` imports (Blob URL) — never `new Worker('./file.js')`
- **NO ES MODULE IMPORTS AT RUNTIME**: Everything must be bundled — `file://` blocks ES module imports
- **NO RELATIVE FETCH**: `fetch('./data.json')` fails under `file://` — all data via IndexedDB or File System Access API
- **NO SERVICE WORKERS**: Not available under `file://`
- **NO localStorage FOR LARGE DATA**: IndexedDB preferred for structured/large data (works under `file://`). localStorage OK for simple flags (e.g., `teamflow_tour_completed`, feedback items, user preferences)
- **VERTRAUENS-MODELL**: Alle User haben AD-seitig SMB read+write auf den Daten-Share. Schutz erfolgt **clientseitig** — Schreib-Aktionen sind hinter dem Kurator-Passwort gated, normale User haben keine Write-Pfade im Code. Backups schützen gegen Versehens-Schäden; Böswilligkeit wird nicht präventiert (Single-Team-Trust-Modell).

## Tech Stack

- **Framework**: React 19 + ReactDOM + TypeScript
- **Build**: Vite + `vite-plugin-singlefile` + `@vitejs/plugin-react`
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite` — utility classes + CSS custom properties for theming
- **UI Components**: shadcn/ui (Radix, Nova-Preset) — `src/components/ui/` (Button, Textarea, Select, Tabs, Slider, Badge, Switch, Card). Fehlende Komponenten per `npx shadcn@latest add <name>` nachinstallieren
- **State**: Zustand (persisted to IndexedDB)
- **Search**: Orama (BM25 + Vector Hybrid), Transformers.js v4 (EmbeddingGemma 300M), WebGPU/WASM
- **AI Chat**: DirectLLM transport (OpenRouter / local llama.cpp) + Streamlit bridge
- **Icons**: lucide-react (tree-shakeable)
- **ZIP / AES-256**: `@zip.js/zip.js` (für passwortgeschützte Exports im Auslastungs-Modul). `jszip` bleibt für unverschlüsselte ZIPs in Verwendung — kann kein AES-256.

## Architecture Principles

### File Size Limit

Source-Files sollten **300 Zeilen nicht überschreiten**. Begründung: kleinere Files sind lesbarer, testbarer und verhindern kollidierende Patches bei paralleler Arbeit.

**Ausnahmen (explizit erlaubt):**

- **Statische Daten-Files** (z.B. `src/core/services/search/example-docs.ts`, `src/dev-fixtures/fixture-schemas.ts`): Größe ergibt sich aus den Daten, nicht aus Logik-Struktur. Keine Aufteilung nötig.
- **Kohärente State-Machines** (z.B. `src/plugins/csv-sources-kuration/wizard/useCsvWizardState.ts`): Eine in sich geschlossene State-Machine ist oft lesbarer als in drei Module aufgeteilt. Aufteilen nur wenn klare logische Grenzen auftauchen.
- **Orchestrator-Services** (z.B. `src/core/services/search/batch-indexer.ts`): Ein Service, der eine Pipeline von 8–10 Schritten orchestriert, darf länger sein — solange die einzelnen Schritte klar trennbar bleiben.

**Keine Ausnahme für:**

- UI-Komponenten: immer aufteilbar, eine Komponente pro Verantwortlichkeit.
- Multi-Step-Wizards als einzelne JSX-Komponente: Step-Sub-Komponenten extrahieren (`Step1Meta`, `Step2Mapping`, …).
- Services die mehrere Domains abdecken (z.B. CRUD + Sync + FAQ in einem Service): Domain-spezifische Services trennen.

Konkrete Stellen, die unter diese Regel fallen und aufzuteilen wären, werden **nicht proaktiv** refactored — sondern **opportunistisch**: wenn ein Patch die Datei ohnehin anfasst, gleich aufteilen.

### Plugin System
Every major feature is a plugin in `src/plugins/{name}/`. Each plugin exports a `TeamFlowPlugin` object:

```typescript
interface TeamFlowPlugin {
  id: string;
  name: string;           // Sidebar label
  icon: string;           // Lucide icon name
  category: 'workflow' | 'tools' | 'admin';
  order: number;          // Sidebar sort order
  component: ComponentType;
  adminOnly?: boolean;
  badge?: () => number | null;
  onInit?: (services: CoreServices) => Promise<void>;
}
```

Plugins are registered in `src/plugins.config.ts`. Build-time filtering via `VITE_PLUGINS` env var.

**Plugin-Initialisierung**: Plugins können optional einen `onInit?: (services: CoreServices) => Promise<void>` exportieren. Der Hook wird beim App-Start aufgerufen (asynchron, fehlertolerant) und ist der richtige Ort für IDB-Schema-Migrationen, Service-Bootstrap und Default-Seeds. Wer Daten erst beim ersten Render des Plugin-Bildschirms braucht, gehört NICHT in `onInit` (lädt sonst unnötig beim App-Start).

### Storage Dual-Layer
- **IndexedDB**: Fast cache, embedding vectors, ONNX model cache, UI state, FS handle persistence
- **File System Access API**: Permanent storage on shared file server — vorgaenge, artifacts, index, config

### Infrastructure Layer (Phase 1a + v1.9)
Kurator-Session-Verwaltung, SMB-Connectivity-Monitoring und sichere Datei-Operationen. Alle Module in `src/core/services/infrastructure/`, Stores in `src/core/hooks/`.

- **Kurator-Session** (`useKuratorSession`): 12h-TTL-Session mit verschlüsselter Kurator-Config (AES-GCM 256 + PBKDF2-SHA-256 @ 200k Iterations, Web Crypto API). Meta (`expiresAt`, `kuratorName`, `ttlMs`) in IndexedDB persistiert (`KURATOR_SESSION_META_IDB_KEY`, Value-String bleibt `'admin-session-meta'` für Kompat). Aktivität verlängert Session (`useKuratorActivityTracker`). ShellLayout hält Tick-Loop. Actions: `setup`, `activate`, `deactivate`, `extend`, `changePassword`, `rehydrate` (liest Legacy-Feld `adminName` als Fallback).
- **SMB-Handles** (`smb-handle.ts`): IDB-Map `smb-handles` mit drei Slot-Kategorien: `daten-share` (Hauptordner mit `programm/`, `backups/`, `_intern/`, readwrite), Multi-Source-DMS-Slots `dms-source-${id}` (read-only, ab v1.15 — Verwaltung im Plugin „Dokumentenquellen"), und Legacy-Slot `dokumentenquelle` (read-only, vor v1.15; wird beim ersten v1.15-Start in eine Default-Source migriert). Legacy-Slot `test-programm` wird beim Lesen als Fallback verwendet.
- **SMB-Connectivity** (`useSmbStatus`): 5-Min-Polling via `probeSmb()`. Status: `online`/`offline`/`unknown`/`denied`. Probe öffnet `_intern/` statt des ehemaligen `admin/`-Subordners. Dev-Panel kann Offline simulieren. Gate `requireOnline()` für Kurator-Aktionen. In-Memory only (keine Persistenz).
- **Atomic Writes** (`atomic-write.ts`): Schreiben über `.tmp`-Datei + Rename zu Ziel; altes Ziel → `.backup` (1-Generations-Rotation). Native `move()` mit Read-Write-Delete-Fallback. Append-Writes (`appendToFile`) überspringen Backup. **Alle Infrastructure-Writes müssen diese Helper verwenden** — direkter `FileSystemWritableFileStream` kann bei Crash korrumpieren.
- **Audit-Log** (`audit-log.ts`): JSONL-Append-Only in `_intern/audit-log.jsonl` (v1.9; vorher `programm-test/admin/audit-log.jsonl`, Legacy-Read-Fallback aktiv). `logAudit({ user, action, details })` / `getRecentAudits(n)`. Session-Events mit neuen Action-Keys `kurator_login`/`kurator_logout`/`kurator_setup`/`kurator_password_changed`. Strukturelle Migration schreibt `kurator_structure_migrated` mit Statistik.
- **Build-Lock** (`build-lock.ts`): Heartbeat-basierter Lock in `_intern/build-lock.json` verhindert parallele Builds. Schema: `{ programm_id, stufe, hostname, kurator_name, gestartet, heartbeat }`. Stale-Detection: Heartbeat > 2h → auto-discard. Actions: `acquireBuildLock`, `forceLock`, `heartbeat`, `releaseLock`. Legacy-Feld `admin_name` wird beim Lesen auf `kurator_name` gemappt.
- **Backup** (`backup.ts`): Wöchentliche Snapshots in `backups/YYYY-MM-DD/` (ab v1.9 direkt am Daten-Share-Root, keine `programm-test/`-Zwischenebene). Rolling 4 Generationen; `deleteOldestBackup()` beim Überlauf. `dokumente/` wird ausgeschlossen (GB-Scale-Files; kommt in Phase 2 in separaten Dokumentenquelle-Handle). `shouldSuggestWeeklyBackup()` als UX-Hint. Trigger: prüft beim ersten Kurator-Login einer Woche und schlägt manuelles Backup vor. Recovery läuft manuell über den Explorer (Kurator kopiert relevante Dateien aus `backups/YYYY-MM-DD/` zurück); Volumen typisch ~2 GB, Wiederherstellung ~2–5 min über LAN-SMB.
- **Migration** (`migration.ts`): `validateSelectedFolder(handle)` klassifiziert Ordner in `current`/`empty`/`legacy`/`subfolder`. `migrateLegacyStructure(idb, parent)` verschiebt Legacy-Daten aus `programm-test/` und `feedback/` in die v1.9-Struktur, benennt `admin-*` → `kurator-*`, löscht `programm-test/dokumente/` (mit Count-Anzeige im Dialog vor Bestätigung), rotiert Backups aus der Zwischenebene. Idempotent.
- **Kurator-Config** (`kurator-config.ts`, ehemals `admin-config.ts`): `isKuratorConfigured`, `setupKuratorConfig`, `verifyPassword`, `changeKuratorPassword`, `readKuratorName`, `writeKuratorName`. Physische Datei: `_intern/kurator-config.enc`; Legacy-Fallback liest `programm-test/admin/admin-config.enc`.
- **Shared Types/Constants** (`types.ts`): `AuditEntry`, `BuildLock`, `BackupEntry`, `KuratorConfigPlain`, `SessionMeta`, `FolderValidationResult` + Pfad-Konstanten (`AUDIT_LOG_PATH='_intern/audit-log.jsonl'`, `BUILD_LOCK_PATH='_intern/build-lock.json'`, `KURATOR_CONFIG_PATH='_intern/kurator-config.enc'`, `PROGRAMM_DIR_NAME='programm'`, `PROGRAMM_SUBDIRS=['antraege','schemas','index']`, `INTERN_DIR='_intern'`) + Legacy-Varianten (`LEGACY_*`) für Migration-Detection.

**Welcome-Seite** (`src/core/WelcomeScreen.tsx`, v1.9): Wird beim ersten App-Start angezeigt, wenn Profil existiert aber kein `smb-handles.daten-share`. Zeigt Beispiel-Pfad + „Pfad kopieren"-Button + 4-Schritte-Anleitung + Ordner-Picker. Nach Auswahl: Validierungs-Dialog (einrichten / migrieren / anderen wählen). Legacy-Migration-Dialog zeigt orangen Warnblock mit Datei-Count für `programm-test/dokumente/` (wird gelöscht). Gate-Logik in `App.tsx`: `Onboarding → WelcomeScreen → AppRouter`.

**Dev-Plugin** (`src/plugins/dev-infrastructure-test/`, `id: 'dev-infrastructure-test'`, KEIN kuratorOnly):
Test-Harness mit 4 Panels (SMB & Handle inkl. Dokumentenquelle-Slot / Kurator-Modus / Atomic Writes & Backup / Build-Lock). `icon: 'FlaskConical'`, `category: 'kuration'`, `order: 99`.

### Search Stack
- **Orama**: Hybrid search engine (BM25 fulltext + vector similarity in one DB)
- **Embeddings**: EmbeddingGemma 300M via Transformers.js v4, runs in Main Thread (no Worker under `file://`)
- **Backend**: WebGPU (preferred) or WASM fallback, auto-detected at init
- **Metadata-Extraktion**: LLM-basiert via OpenRouter API oder lokales llama.cpp (Nemotron)
- **Re-Ranker**: Cross-Encoder (aktiv, steuerbar per Pipeline-Config in `src/core/hooks/useSearch.ts`)

### Theming
All colors via CSS custom properties. Primary color is HSL-based — only `--tf-primary-h` (hue) changes.
Dark mode via `[data-theme="dark"]` attribute on `<html>`. See `DESIGN_GUIDE.md` for full specification.

### Onboarding-Tour
Geführte 5-Schritt-Tour für Erstnutzer (`src/core/components/tour/`, `src/core/hooks/useTour.ts`).
- Auto-Start 800ms nach Home-Seitenladen (nur wenn Daten vorhanden und Tour noch nicht abgeschlossen)
- Manueller Trigger über Sidebar-Button "Neu hier? So geht's" (unten vor SyncStatusIndicator)
- Ziele werden via `data-tour="..."` Attribut auf bestehende Elemente markiert
- Cross-Page: TourStep unterstützt `navigateTo: 'plugin-id'` für Auto-Navigation zur Zielseite
- Persistenz: `localStorage["teamflow_tour_completed"]` — funktioniert unter `file://`
- TourOverlay nutzt CSS `clip-path` für Spotlight + z-index 102 für Target-Elevation

### Feedback-System

Integriertes User-Feedback + Admin-Dashboard + öffentliches Board mit Sponsoring (Phase 1+2+3 komplett). 4 Touchpoints: globaler FAB in `src/components/feedback/`, Service-Layer in `src/core/services/feedback/`, Kurator-Plugin `src/plugins/feedback/` (id `feedback-kuration`), öffentliches Board `src/plugins/feedback-board/` (id `feedback-board`). Details + Datenmodell + Sponsoring-Logik + Komponenten-Liste: [docs/architecture/feedback-system.md](docs/architecture/feedback-system.md).

### CSV-Import-Wizard (Phase 1b + Label-XLS-Hierarchie)

Kurator-Wizard unter `src/plugins/csv-sources-kuration/wizard/` für CSV-Source-Registrierung. 5 Schritte: Metadata → Column-Mapping → (Unterprogramme, nur Master) → Review → Progress. Column-Mapping unterstützt optionalen **hierarchischen Label-XLS-Upload** ([xlsLabelParser](src/core/services/csv/filter/xlsLabelParser.ts)):

- Kurator wählt Anzahl Header-Zeilen (2–8, Default 4). Konvention: letzte Zeile = CSV-Namen, vorletzte = Labels (leer → Fallback CSV-Name), Zeilen darüber = Gruppen-Ebenen (merged cells).
- Vertikal-merged Gruppen-/Label-Zellen → als ambige Merges erkannt. Kurator entscheidet per Dropdown pro Merge (`Als Gruppe` / `Als Label wiederholt` / `Ignorieren`), Bulk-Leiste bei ≥2.
- `ColumnMappingEntry` persistiert `label`, `group_path`, `ambiguous_merge_resolution`; `CsvSchema.label_xlsx_header_rows` für konsistente Re-Imports.
- Wizard-Step 2 rendert die Mapping-Tabelle bei vorhandenem XLS gruppiert (Collapsible-Sections mit `›`-Separator); Fallback auf flache Tabelle wenn kein XLS geladen.
- Antrags-Detail-Ansicht (`/antraege/:aktenzeichen`) zeigt Felder in Gruppen-Abschnitten, „Weitere Felder" am Ende. Merge-Konflikt zwischen Sources: Master → höchste Priority → erste Source mit Pfad.
- `FilterDefinition.display_group` wird beim Erstellen eines Filters aus dem Schema vorgetragen (UI-Gruppierung im Filter-Panel in Folge-Patch).
- Test-Assets: `scripts/generate-test-label-xlsx.mjs` erzeugt 4 XLSX-Varianten (2/3/4 Zeilen + vertikal-merged "Branche") unter `public/test-korpus/bauforschung-v2/`. Läuft als prebuild-Hook.

**Verbund-Aggregation** (Forschungs-Domäne): Ein **Verbund** bündelt mehrere Teilanträge unter einer gemeinsamen Projektbeschreibung. Der CSV-Master-Import erkennt Verbünde über das Akronym + Teilantragsindex und dedupliziert geteilte Dokumente per Content-Hash. Anzeige in der Antrags-Liste: Teilvorhaben werden visuell unter dem Verbund-Header geclustert (siehe `src/plugins/antraege/` Cluster-Komponenten).

### Phase-2 Triage- & Matcher-Baustein (`src/phase2/`)

Eingangsfilter für die DMS-Dokumenten-Pipeline: pro Datei wird kaskadiert entschieden (relevant?, doc_type?, zugehöriger Antrag?). 4-Stage-Kaskade (DMS-CSV-Lookup → strukturell → Keywords → Nemotron-LLM), Matcher gegen IDB-Stores `antraege` + `akronym_index`, Skip-Liste mit `classifier_version`-Reset, Pending-Bucket für Projektbeschreibungen ohne Match. Multi-Source-Indexierung über das DMS-Quellen-Plugin (v1.15). Details, Build-Config (`runtimeConfig.scan`), Vorfilter-Script, FKZ-Regex und Eval-Suite: [docs/architecture/phase2-triage.md](docs/architecture/phase2-triage.md).

### Phase-2 Review-Queue UI (`src/plugins/dokument-review/`)

Kurator-Plugin (`id: 'dokument-review'`, `category: 'kuration'`, `kuratorOnly: true`) für die Bearbeitung der Phase-2-Triage-Ergebnisse. Sichtbar wenn `features.dokumentenscan === true`. 50/50-Split-Layout (Manifest-Liste + Detail-Panel), 5 Override-Aktionen (Typ ändern / Antrag zuordnen / Irrelevant / Relevant ohne Zuordnung / Re-Klassifizieren) via `useReviewActions`, Keyboard-Shortcuts (`j`/`k`/`n`/`i`/`r`/`a`), Auto-Cleanup-Heuristiken, integriert ins Antrag-Detail über `AntragDokumenteSection`. Layout, Hook-Liste, Filter/Sort, Auto-Cleanup-Regeln und Anti-Patterns: [docs/architecture/phase2-review-queue.md](docs/architecture/phase2-review-queue.md).

### Auslastungs-Modul (Plugin "auslastung", v1.16)

Plugin (`id: 'auslastung'`, `category: 'workflow'`, sichtbar wenn `features.auslastung === true`) für automatische Antrags-Klassifizierung in Überkategorien + MA-Zuweisung mit dreistufigem Matching (Stage 0 Boolean-Match auf ZT-Spalten → Stage 1 Regel-Mapping → Stage 2 Embedding-Centroid). Quartalsbasierte Kapazitäts-Planung. **Datenschutz-Kernprinzip**: MAs nur als anonyme IDs (MA01-MAxx) sichtbar; echte TIB-Kürzel nur im RAM während passwortgeschütztem XLSX-Export. Sidecar `_intern/auslastung-kuerzel-map.json` ist append-only Klartext-Map (Pitfall #18). Aktiv/Inaktiv-Flag pro MA filtert UI + Matching (inaktive MAs bleiben aber im Embedding-Corpus als Kompetenz-Referenz). Stage-2-Korpus wird auf SMB-Share gespiegelt (Cold-Start: 46 min → Download).

Details (Tabs, Engine-Layer, Datenmodell `auslastung.json`, Standalone-Onboarding-HTML, Schema-Erweiterung, Build-Pipeline): [docs/architecture/auslastung.md](docs/architecture/auslastung.md).

### Legacy: Vorgang-Infrastruktur

`src/core/types/vorgang.ts`, `src/core/components/SimilarCases.tsx`, `src/core/components/VorgangDokumenteTab.tsx`, `src/core/hooks/useVorgangDetail.ts` — Überbleibsel des alten Vorgang-zentrierten Datenmodells. Wird nur noch vom Bauanträge-Plugin (`src/plugins/bauantraege/`) genutzt. **Neue Features verwenden das `Antrag`-Interface aus dem CSV-Schema (`src/core/types/csv/types.ts`), nicht `Vorgang`.**


### Referenz-App

Historische Referenz-Implementierung lag unter `_reference/lernapp/` — seit dem Cleanup in `_archive/_reference/lernapp/`. Nicht für neue Features als Vorbild verwenden.

### Datenverzeichnis (v1.9)
Alle geteilten Daten und Config-Dateien liegen im Daten-Share (separater SMB-Share vom App-Share mit `teamflow.html`). Struktur:
- `programm/antraege/imports/` — rohe CSV-Importe (ersetzt v1.8-Pfad `csv-sources/`)
- `programm/antraege/bauantraege/` — Vorgang-Artefakte Bauanträge (ersetzt `vorgaenge/bauantrag`). Seit v1.14 entfällt `programm/antraege/forschung/`; Förderanträge leben im IDB-Store ANTRAEGE (CSV-Import-Schema), Artefakte werden dort (noch) nicht auf dem Share abgelegt.
- `programm/schemas/` — Column-Mapping-JSONs (ersetzt `csv-schemas/`)
- `programm/index/` — Orama-Snapshots + `index-meta.json`
- `_intern/feedback/feedback.json` (Multi-User-Tickets)
- `_intern/feedback/system-prompt.md` (Kurator-editierbarer Chatbot-Prompt)
- `_intern/audit-log.jsonl` — Phase 1a: Kurator-Events (append-only JSONL)
- `_intern/build-lock.json` — Phase 1a: Aktiver Build-Lock (Heartbeat)
- `_intern/kurator-config.enc` — verschlüsselte Kurator-Credentials
- `_intern/kurator-name-*.txt` — rechnerspezifische Kurator-Kennung (Fingerprint-suffixed)
- `_intern/scan-manifest.json` — Phase 2: JSONL-Spiegel des `phase2_scan_manifest`-IDB-Stores (optional, Caller-getriggert)
- `_intern/dms-index-filtered.csv` — Phase 2: gefilterte DMS-CSV (Output von `scripts/filter-dms-csv.mjs`)
- `_intern/aktenplan-mapping.json` — Phase 2: optionales Override des Aktenplanzuordnung→doc_type Mappings
- `_intern/auslastung.json` — Auslastungs-Modul: Konfig (Überkategorien, Gewichtungen, Setup-Flag), anonyme MA-Profile, Klassifizierungen, Zuweisungen, Kalibrierungs-Ergebnisse. Last-Write-Wins. KEINE echten Bearbeiter-Kürzel. Legacy-Pfad `_intern/auslastung/data.json` vor Mai 2026 — Load liest beide, Save schreibt nur den neuen.
- `_intern/auslastung-kuerzel-map.json` — Auslastungs-Modul: persistente `kuerzel ↔ anonId`-Map (append-only, Klartext). Stabilisiert anonIds gegen ephemeral-Sort-Drift bei neuen TIB-Kürzeln. Schema: `{ version: 1, updatedAt, entries: Array<{ kuerzel, anonId, createdAt }> }`. Invariante: `entries[i].anonId === MA{i+1}`, einmal vergebene Einträge werden nie geändert oder gelöscht. Wird beim ersten Render des `useAntraegeCache` aus dem aktuellen alphabetischen Sort der Antraege bootstrapped (identisch zum bisherigen ephemeral-Verhalten — kein Drift bei Migration); danach werden neue Kürzel nur hinten angehängt.
- `_intern/auslastung-embedding-corpus.manifest.json` — Auslastungs-Modul (Mai 2026): Metadaten zum geteilten Stage-2-Embedding-Korpus. Schema: `{ version: 1, modellId, dim, antraegeCount, builtAt, builderProfile?, aktenzeichenSetHash, aktenzeichen[], binFormat: 'f32-stream', binBytes }`. Klein (~200 KB für 13k aktenzeichen), `.backup`-Rotation deaktiviert.
- `_intern/auslastung-embedding-corpus.bin` — Auslastungs-Modul (Mai 2026): konkatenierte float32-Vektoren in der Reihenfolge `manifest.aktenzeichen[]`. Größe = `count × dim × 4 Bytes` (typisch ~40 MB bei 13k × 768d). Wird nach jedem erfolgreichen Build automatisch hochgeladen; Auto-Download wenn lokal leer + Modell/Dim/Hash passen. Atomar geschrieben mit `skipBackup: true` (Recovery via Re-Build).
- `backups/YYYY-MM-DD/` — Phase 1a: Wöchentliche Snapshots (Rolling 4 Gen., Daten-Share-Root)
- `README.txt` — Orientierungs-Text (von der App beim Setup angelegt)
- Phase 2: separater Dokumentenquelle-Handle (`smb-handles.dokumentenquelle`) für die Scan-Source — wird via `pickAndStoreDokumentenquelleHandle()` gesetzt; Scanner traversiert von dort über `runtimeConfig.scan.sub_roots`

## Project Structure

```
src/
├── core/
│   ├── App.tsx                  <- Entry, providers, onboarding check
│   ├── Shell.tsx                <- Sidebar + content layout
│   ├── ErrorBoundary.tsx        <- React error boundary
│   ├── Onboarding.tsx           <- First-run setup wizard
│   ├── components/
│   │   ├── ArtefakteTab.tsx     <- Shared artifact management (both departments)
│   │   ├── SimilarCases.tsx     <- AI-powered similar case suggestions
│   │   ├── VerlaufTab.tsx       <- Workflow history timeline
│   │   ├── VorgangDokumenteTab.tsx <- Document viewer per Vorgang
│   │   └── tour/
│   │       ├── TourOverlay.tsx  <- Spotlight-Overlay für Onboarding-Tour (clip-path, Retry, Auto-Nav)
│   │       └── tourSteps.ts     <- 5 Tour-Schritte mit data-tour Targets + navigateTo
│   ├── hooks/
│   │   ├── useAIBridge.ts       <- AI provider context
│   │   ├── useKuratorSession.ts   <- Phase 1a + v1.9: 12h-TTL Kurator-Session (IDB-persistiert)
│   │   ├── useKuratorActivityTracker.ts <- Phase 1a: Auto-Extend bei User-Aktivität
│   │   ├── useKeyboard.ts       <- Keyboard shortcut registration
│   │   ├── useNavigation.ts     <- Plugin navigation
│   │   ├── useProfile.ts        <- User profile management
│   │   ├── useSearch.ts         <- Search context (Orama + Embedding + Re-Ranker)
│   │   ├── useSmbStatus.ts      <- Phase 1a: SMB-Polling (5min) + Offline-Simulation
│   │   ├── useStorage.ts        <- Storage service context
│   │   ├── useTags.ts           <- Tag management (Zustand)
│   │   ├── useTour.ts           <- Onboarding-Tour State + Context (localStorage-persistiert)
│   │   └── useVorgangDetail.ts  <- Shared Detail-View logic (states, handlers)
│   ├── services/
│   │   ├── ai/
│   │   │   ├── bridge.ts        <- AIBridge orchestrator
│   │   │   ├── prompts.ts       <- Chat prompt templates
│   │   │   ├── rag-context.ts   <- RAG context builder
│   │   │   └── transports/      <- DirectLLM, Streamlit
│   │   ├── search/
│   │   │   ├── orama-store.ts       <- Orama DB CRUD + hybrid search
│   │   │   ├── embedding-service.ts <- Transformers.js embedding pipeline
│   │   │   ├── batch-indexer.ts     <- Document indexing orchestrator
│   │   │   ├── chunking.ts          <- Text chunking (heading-based + fixed)
│   │   │   ├── metadata-extractor.ts <- LLM-based metadata extraction
│   │   │   ├── metadata-prompts.ts  <- Prompt templates + JSON schema
│   │   │   ├── model-registry.ts    <- Embedding model definitions
│   │   │   ├── model-loader.ts      <- Model loading from file server
│   │   │   ├── contextual-chunker.ts <- Context-prefixed chunks
│   │   │   ├── query-embedder.ts    <- Query embedding wrapper
│   │   │   ├── pipeline-logger.ts   <- Structured console logging (DEV-only)
│   │   │   ├── document-scanner.ts  <- File server document sync
│   │   │   ├── checkpoint.ts        <- Index checkpoint management
│   │   │   ├── index-persistence.ts <- Index save/load to file server
│   │   │   ├── re-ranker.ts         <- Cross-encoder re-ranking (PHASE 2)
│   │   │   ├── example-docs.ts      <- Seed documents for testing
│   │   │   └── eval/                <- Search quality evaluation
│   │   │       ├── eval-runner.ts
│   │   │       ├── eval-types.ts
│   │   │       ├── eval-suites.ts
│   │   │       ├── eval-export.ts
│   │   │       └── test-cases.ts
│   │   ├── converter/
│   │   │   └── index.ts         <- PDF + DOCX to Markdown
│   │   ├── export/
│   │   │   ├── docx-export.ts   <- DOCX generation
│   │   │   └── docx-templates.ts
│   │   ├── seed/                <- Demo/test data generators
│   │   ├── storage/
│   │   │   ├── index.ts         <- StorageService facade
│   │   │   ├── idb-store.ts     <- IndexedDB wrapper
│   │   │   └── fs-store.ts      <- File System Access API wrapper
│   │   ├── sync/                <- File server sync queue
│   │   ├── versioning/          <- Document version management
│   │   ├── workflow/
│   │   │   ├── engine.ts        <- Status transitions
│   │   │   ├── history.ts       <- Workflow history
│   │   │   └── deadlines.ts     <- Deadline calculations
│   │   ├── review/              <- Document review service
│   │   ├── artifacts.ts         <- Artifact CRUD
│   │   ├── keyboard.ts          <- Shortcut registry
│   │   ├── tags.ts              <- Tag operations
│   │   └── templates.ts         <- Document templates
│   │   ├── feedback/            <- Feedback-System Service-Layer
│   │   │   ├── feedbackService.ts   <- CRUD + Shared-File-Sync + FAQ + Sponsoring (sponsorTicket/unsponsorTicket/getSponsoringProgress)
│   │   │   ├── feedbackLlm.ts       <- System-Prompt-Loader + Parser + DEFAULT_SYSTEM_PROMPT
│   │   │   ├── feedbackContext.ts   <- Auto-Kontext + window.onerror Ring-Buffer
│   │   │   ├── promptGenerator.ts   <- Claude-Code-Prompt-Generator
│   │   │   ├── budgetService.ts     <- Phase 3: Quartals-Budget (localStorage pro User)
│   │   │   └── index.ts
│   │   ├── infrastructure/      <- Phase 1a + v1.9: Kurator-Session + Datei-Integrität + Migration
│   │   │   ├── kurator-config.ts    <- Verschlüsselte Kurator-Creds (Setup/Activate/Password)
│   │   │   ├── crypto.ts            <- AES-GCM 256 + PBKDF2-SHA-256 (Web Crypto API)
│   │   │   ├── atomic-write.ts      <- Write-tmp+Rename + 1-Gen-Backup-Rotation
│   │   │   ├── audit-log.ts         <- JSONL-Append-Only Event-Log (_intern/audit-log.jsonl)
│   │   │   ├── build-lock.ts        <- Heartbeat-basierter Build-Lock (Stale > 2h)
│   │   │   ├── backup.ts            <- Wöchentliche Snapshots + 4-Gen-Rotation (backups/YYYY-MM-DD/)
│   │   │   ├── smb-handle.ts        <- Daten-Share + Dokumentenquelle Handles + ensureFolderStructure
│   │   │   ├── migration.ts         <- v1.9: validateSelectedFolder + migrateLegacyStructure
│   │   │   ├── offline-check.ts     <- Offline-Detection-Helpers
│   │   │   ├── types.ts             <- AuditEntry, BuildLock, BackupEntry, SessionMeta, KuratorConfigPlain, FolderValidationResult, Pfad-Konstanten + Legacy-Varianten
│   │   │   └── index.ts             <- Barrel-Export
│   ├── types/
│   │   ├── vorgang.ts           <- Vorgang + Artifact types
│   │   ├── config.ts            <- UserProfile (is_kurator + Legacy is_admin), AIProviderConfig
│   │   ├── plugin.ts            <- TeamFlowPlugin interface (kuratorOnly + Legacy adminOnly, category 'kuration')
│   │   ├── feedback.ts          <- FeedbackItem (kurator_status/_priority/_notes + Legacy admin_*), FeedbackCategory, FeedbackStatus, ChatMsg, etc.
│   │   ├── review.ts
│   │   └── version.ts
│   └── utils/
│       └── status-mappings.ts   <- Status-Labels + Badge-Variants für Vorgang-Status (NICHT Feedback)
├── phase2/                       <- Phase-2 Triage- & Matcher-Baustein (Eingangsfilter vor Volltext-Pipeline)
│   ├── types.ts                     <- DmsEntry, ManifestEntry, SkipListEntry, TriageResult, MatchResult, PendingAntragEntry
│   ├── index.ts                     <- Barrel-Export
│   ├── ui-tokens.ts                 <- CONFIDENCE_BADGE_CLASSES + TRIAGE_SOURCE_BADGE_CLASSES (für UI-Folge-Patch)
│   ├── dms-csv/                     <- DMS-CSV-Loader + Aktenplan-Mapping
│   ├── scanner/                     <- Rekursiver dokumentenquelle-Walker + Manifest-Store
│   ├── triage/                      <- Stage 0 (DMS-Lookup) → 1 (strukturell) → 2 (Keywords) → 3 (Nemotron) + Orchestrator
│   ├── matcher/                     <- FKZ-Extraktor (strict + tolerant) + Akronym-Matcher + Match-Orchestrator
│   ├── skip-list/                   <- IDB-Store + Versions-Reset
│   ├── pending-antrag/              <- Holding-Bucket für Projektbeschreibungen vor CSV-Import
│   ├── ocr/                         <- Side-Car-Stub (echte Implementation in Folge-Patch)
│   └── __tests__/                   <- Vitest: dms-csv-parser / aktenplan / fkz / keywords / stage0 / filter-script / triage.eval
├── plugins/
│   # Nutzer-Plugins (category 'workflow' / 'tools')
│   ├── home/                    <- Dashboard (id='home')
│   ├── antraege/                <- Förderanträge-Liste + Detail (id='antraege', generische Ansicht über CSV-Schema; seit v1.14 konsolidiert inkl. ehem. Forschungs-Fixtures + optionaler AntragDokumentRef[])
│   ├── auslastung/              <- Auslastungs-Modul (id='auslastung', features.auslastung-gegated, 5 Tabs, Anonymisierung MA01..MAxx, dreistufiges Matching, Standalone-Onboarding-HTML-Generator)
│   ├── bauantraege/             <- Bauanträge-Workflow (id='bauantraege', Vorgang-Typ bauantrag)
│   ├── dokumente/               <- Dokumenten-Browser (id='dokumente', Phase-2-Platzhalter)
│   ├── suche/                   <- Hybrid-Suche-UI (id='suche', Orama + Vector)
│   ├── chat/                    <- AI-Chat (id='chat')
│   ├── feedback-board/          <- Öffentliches Feedback-Board (id='feedback-board', KEIN kuratorOnly)
│   ├── einstellungen/           <- Profil, Theme, AI-Provider, is_kurator-Toggle (id='einstellungen')
│   # Kurator-Plugins (category 'kuration', kuratorOnly: true) — Directory-Name == Plugin-ID
│   ├── kurator/                 <- Suchindex-Kurations-Panel (id='kurator', route /kuration/suchindex)
│   ├── programme-kuration/      <- Programm-Verwaltung inkl. Unterprogramme-Sub-Feature (id='programme-kuration')
│   ├── csv-sources-kuration/    <- CSV-Import-Wizard (id='csv-sources-kuration', 5-Step-Wizard + Label-XLS-Hierarchie)
│   ├── dokumentenquellen-kuration/ <- DMS-Quellen-Verwaltung (id='dokumentenquellen-kuration', v1.15, Multi-Source + Indexierung)
│   ├── filter-kuration/         <- Filter-Verwaltung (id='filter-kuration', 4-Step-Wizard)
│   ├── feedback/                <- Feedback-Verwaltung (id='feedback-kuration', 4 Tabs)
│   │   ├── FeedbackAdminPage.tsx    <- 4 Tabs (Tickets / FAQ / Sponsoring / Einstellungen)
│   │   ├── sections/
│   │   │   ├── FeedbackTicketList.tsx
│   │   │   ├── FeedbackTicketDetail.tsx      <- + Aufwand-Dropdown + Sponsoring-Info (Phase 3)
│   │   │   ├── FeedbackFaqTab.tsx
│   │   │   ├── FeedbackSponsoringOverview.tsx <- Phase 3: Features-Ranking + Schwellen-Form + Budget-Stats
│   │   │   └── FeedbackConfigPanel.tsx
│   │   └── index.ts
│   ├── dokument-review/         <- Phase-2 Review-Queue UI (id='dokument-review', kuratorOnly + features.dokumentenscan)
│   │   ├── DokumentReviewPage.tsx
│   │   ├── store.ts                  <- Zustand: viewMode/Filter/Sort/Pagination/Toast
│   │   ├── filtering.ts              <- applyFilters + isInReviewQueue + Sort-Keys
│   │   ├── hooks/
│   │   │   ├── useManifestData.ts    <- Manifest/Skip/Pending parallel laden + reload/remove/rematch
│   │   │   ├── useAntraegeIndex.ts   <- listAntraegeByProgramm-Cache + Substring-Filter
│   │   │   └── useReviewActions.ts   <- 5 Override-Aktionen + Toast
│   │   ├── components/
│   │   │   ├── DashboardCard.tsx     <- 6 Quick-Filter-Kacheln + Pending-Re-Match-Button
│   │   │   ├── FilterBar.tsx         <- 4 Pill-Reihen (Ansicht / Confidence / Typ / Source)
│   │   │   ├── ManifestList.tsx      <- Pagination 50/Seite + Sort-Dropdown
│   │   │   ├── ManifestListItem.tsx  <- Listenzeile mit Badges
│   │   │   ├── DetailPanel.tsx       <- 4 Sections + Aktionsleiste
│   │   │   ├── AntragAutocomplete.tsx<- FKZ/Akronym/Titel-Substring (data-tf-autocomplete-input)
│   │   │   ├── PendingList.tsx       <- Holding-Bucket + Manuell-Zuordnen + Eintrag-Entfernen
│   │   │   ├── KeyboardHandler.tsx   <- j/k/n/i/r/a/Enter/Escape
│   │   │   └── ReviewToast.tsx       <- Auto-dismiss 3s
│   │   └── index.tsx                 <- Plugin-Registrierung (icon ClipboardCheck, order 35)
│   # Dev-Plugins (nur bei aktiven Dev-Flags sichtbar)
│   ├── dev-infrastructure-test/ <- DEV-Test-Harness (id='dev-infrastructure-test', 5 Panels inkl. Phase-2-Triage)
│   │   ├── DevPanel.tsx
│   │   ├── panels/
│   │   └── index.ts
│   └── dev-state-inspector/     <- DEV-State-Viewer (id='dev-state-inspector', Fixture-Sibling)
├── components/
│   ├── ui/                      <- shadcn/ui Komponenten (Button, Card, Select, Tabs, Label, Collapsible, etc.)
│   └── feedback/                <- Globales Feedback-System (FAB + Panel + Chatbot + ConfirmCard + FAQ + MyFeedbackList + Board-Cards)
│       ├── FeedbackButton.tsx
│       ├── FeedbackPanel.tsx
│       ├── FeedbackChatbot.tsx
│       ├── FeedbackConfirmCard.tsx
│       ├── FaqSuggestions.tsx
│       ├── MyFeedbackList.tsx
│       ├── FeedbackBoardCard.tsx <- Phase 3: Board-Karte mit Sponsoring-Progress
│       ├── SponsorButton.tsx     <- Phase 3: Punkte/Stunden-Sponsor-UI
│       ├── BudgetBadge.tsx       <- Phase 3: X/Y Punkte (Q.) mit Ampelfarbe
│       ├── constants.ts
│       └── index.ts
├── ui/                          <- App-spezifische shared components (legacy, ggf. nach components/ui/ migrieren)
├── plugins.config.ts            <- Build-time plugin selection
└── main.tsx
```

**Außerhalb von `src/`:**
- `tools/config-ui/` — Vanilla-JS Build-Konfigurator (siehe `npm run config-ui`)
- `tools/kompetenz-onboarding/` — Standalone-HTML-Template für das Auslastungs-Onboarding (Vanilla-JS + Inline-SheetJS, wird vom Generator-Service über Vite-`?raw`-Import verarbeitet, kein eigener Build-Schritt)
- `_labels/` — Quell-XLSX für CSV-Spalten-Klarnamen + ZT-Themenfeld-Mapping. Wird von `scripts/build-default-labels.mjs` verarbeitet (prebuild-Hook) → `src/plugins/auslastung/services/default-labels.ts`.

## Coding Standards

### TypeScript
- Strict mode enabled
- Explicit return types on exported functions
- Interfaces over types for public APIs
- Barrel exports (`index.ts`) for each directory

### React
- Functional components only, no class components
- Custom hooks for all shared logic
- Avoid `useEffect` for data fetching — use event handlers or init patterns
- Memoize expensive computations with `useMemo`, not `useEffect`

### Styling
- Tailwind utility classes as primary styling method
- shadcn/ui Komponenten für Standard-UI-Elemente (Button, Select, Tabs, etc.) — Import via `@/components/ui/...`
- CSS custom properties for theme values: `bg-[var(--tf-bg)]`, `text-[var(--tf-primary)]`
- No CSS-in-JS libraries
- No inline `style={{}}` except for dynamic values (e.g., progress bars, borders)

### File Naming
- Components: `PascalCase.tsx` (e.g., `BauantraegeListe.tsx`)
- Services/hooks: `camelCase.ts` (e.g., `useStorage.ts`)
- Types: `camelCase.ts` (e.g., `vorgang.ts`)
- Constants: `UPPER_SNAKE_CASE` in file, `camelCase.ts` filename

## Build-Varianten (v1.10)

TeamFlow wird pro Einsatz-Kontext als eigene Variante gebaut. Configs liegen unter `configs/`:

- `configs/dev.config.json` — Developer-Build, alle Features + OpenRouter aktiv
- `configs/demo.config.json` — Showcase-Build, mehrere Bereichs-Plugins + Suche/Chat/Board, kein Kurator
- `configs/prod.config.json` — Produktion (End-User), nur Home + Förderanträge + Einstellungen, kein Kurator-Login
- `configs/kurator.config.json` — Produktion (Kurator-Rolle), Standard-Sidebar wie prod + Kuration-Menüs nach Login
- `configs/pl.config.json` — Produktion (Projektleitung), Home + Förderanträge + Auslastung + Einstellungen, kein Kurator-Login
- `configs/_template.config.jsonc` — kommentierte Referenz (nicht direkt bauen)
- `configs/_shared.json` (v2.0.2) — **Org-weite invariante Defaults** (aktuell: `data.fixedDataSharePath` + `data.expectedFolderName`). `build-with-config.mjs` + `vite.config.ts` mergen diese Datei mit der Variant-Config via `deepMerge` aus [scripts/config-schema.mjs](scripts/config-schema.mjs). Variant-Configs können jedes Feld überschreiben (z.B. `demo.config.json` setzt `fixedDataSharePath: null` explizit). Datei fehlt → Build läuft trotzdem (Backward-Kompat).

Sichtbarkeits-Matrix (was steht in der Sidebar):

| Plugin | dev | demo | prod | kurator (vor Login) | kurator (nach Login) | pl |
| --- | --- | --- | --- | --- | --- | --- |
| Home | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Förderanträge | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Bauanträge | ✓ | ✓ | – | – | – | – |
| Auslastung | ✓ | – | – | – | – | ✓ |
| Dokumente | ✓ | ✓ | – | – | – | – |
| Suche | ✓ | ✓ | – | – | – | – |
| Chat | ✓ | ✓ | – | – | – | – |
| Feedback Übersicht | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Einstellungen | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kurator-Toggle in Einstellungen | ✓ | – | – | ✓ | ✓ | – |
| Kuration-Menüs (Suchindex, Programme, CSV, DMS, Filter, Feedback, Review) | ✓ | – | – | – | ✓ | – |

Die kurator-Variante ist der einzige Produktions-Build mit `features.kuratorMenus: true`. Sie kombiniert User-seitig einen schlanken Stack (Förderanträge + Einstellungen) mit allen Kuration-Plugins, die erst nach Aktivierung des Kurator-Toggles in den Einstellungen erscheinen.

Build-Kommandos:

```bash
npm run build:dev       # → dist-single/dev/zah-dev.html
npm run build:demo      # → dist-single/demo/zah-demo.html
npm run build:prod      # → dist-single/zah-prod.html
npm run build:kurator   # → dist-single/zah-kurator.html
npm run build:pl        # → dist-single/zah-pl.html
npm run build:variant -- --config configs/<datei>.config.json   # beliebige Variante
npm run config-ui       # HTML-Konfigurator auf http://localhost:5174
```

Jeder Build kopiert zusätzlich `Dokumentenindex-aktualisieren.bat` neben die HTML. Das generische `dist-single/index.html` wird nach dem Umbenennen gelöscht, damit im Filesystem kein Varianten-Mix entsteht.

Testen: HTML per Doppelklick direkt in Chrome/Edge (`file://`) öffnen. Keine Console-Errors, Sidebar rendert mit dem Variant-Label, Tab-Titel passt zum `build.browserTabTitle` der Config, BuildInfo-Footer unten in der Sidebar zeigt Variant + Git-Hash + Datum.

**Sicherheits-Check**: Wenn OpenRouter in einer `variant: "production"`-Config mit festem Daten-Share-Pfad aktiviert ist, bricht `validateConfig()` den Build ab — per Design, damit keine Echt-Daten versehentlich an Cloud-APIs gehen.

**Dev-Server**: `npm run dev` lädt `DEFAULT_CONFIG` aus `scripts/config-schema.mjs` (alle Features an). Das reicht für lokales Entwickeln; für Variant-Tests immer einen der oben genannten Builds fahren und per `file://` testen.

**prebuild-Pipeline** (`npm run generate:test-assets`, läuft automatisch vor jedem Build): generiert Test-CSVs, Label-XLSX, normalisiert Fixture-Encoding und **erzeugt `src/plugins/auslastung/services/default-labels.ts`** aus `_labels/Labels PrjBsp_GPT.xlsx` via `scripts/build-default-labels.mjs`. Das generierte TS-File ist committed (Idempotenz), kann aber jederzeit über `npm run build:default-labels` regeneriert werden.

**Feature-Flag `features.auslastung`** (default false; in `dev.config.json` true): aktiviert das Auslastungs-Plugin (Sidebar-Eintrag + Routing). Andere Variants müssen das Flag explizit setzen wenn das Modul gewünscht ist. Routing-Pflicht: `routes.ts` (`PLUGIN_ROUTES['auslastung']`) + `Router.tsx` (`flatIds`) — siehe [docs/agents/add-plugin.md](docs/agents/add-plugin.md).

Config-Zugriff im Code:

```ts
import { runtimeConfig, buildTime, gitHash } from '@/config/runtime-config';
import { features, isOpenRouterEnabled, isFeedbackEnabled } from '@/config/feature-flags';
```

Plugin-Gating: `src/plugins.config.ts` filtert die Plugin-Liste nach `features.*`; Plugin-Autoren brauchen nichts weiter zu tun, wenn das Plugin `category: 'kuration'` oder eine der bekannten IDs hat. Neue Flags werden dort ergänzt.

## Versionierung

App-Version steht in `package.json#version` (Single Source of Truth, via Vite-`define` als `appVersion` in `src/config/runtime-config.ts` exposed). Sidebar-Footer zeigt `v<major>.<minor>` (z.B. `v1.14`); Hover-Tooltip enthält die volle Version + Variant + Git-Hash + Build-Datum.

Bump-Regeln (semver-pragmatisch für diese App):

- **MAJOR** (`1.14 → 2.0`) — wenn eine bestehende Installation einen **Migrationsschritt** braucht. Konkret: SMB-Daten-Layout ändert sich (z.B. wie v1.9: `programm-test/admin/` → `_intern/`), `CONFIG_SCHEMA_VERSION` in `scripts/config-schema.mjs` bumpt, IndexedDB-Stores werden umgeschrieben, oder User muss aktiv etwas tun (Berechtigung neu erteilen, Pfad neu wählen, etc.).
- **MINOR** (`1.14 → 1.15`) — neues Plugin, neues Feature, neue Felder, größere UI-Refactors. **Additive** Änderungen, bestehende Daten/Configs bleiben funktional.
- **PATCH** (`1.14.0 → 1.14.1`) — Bugfix, Style-Tweak, Text-Korrektur. Keine Verhaltensänderung außer "es ist jetzt richtig".

Beim MAJOR-Bump zusätzlich: Migrations-Notiz in CLAUDE.md ergänzen (analog v1.9-Block in *Infrastructure Layer*), und sicherstellen dass `migrateLegacyStructure()` (oder Pendant) die alte Struktur erkennt.

### v2.0 — 2-Handle-Architektur (Persönlicher Ordner + Offline-Modus + Feedback-Inbox)

MAJOR-Bump v2.0 erzwingt Re-Pick beim Start. Neuer Handle-Slot `SMB_HANDLE_PERSOENLICH` pro User für `teamflow/{profile,einstellungen}.json` + Feedback-Outbox. Nicht-Kurator-Daten-Share-Handle wird automatisch von `readwrite` auf `read` heruntergestuft (Hardening, single-click Re-Pick auf neuem `StartupScreen`). `ConnectionMode` (`online`/`offline`) zeigt nicht-dismissbares `OfflineBanner` mit letztem Snapshot-Datum. Feedback-Dispatch domain-spezifisch: Kurator → direkt nach `_intern/feedback/feedback.json`, Nicht-Kurator → Outbox auf pers. Laufwerk (manueller Einsammel-Schritt im Kurator-Tab).

Details (Migrations-Flag, Config-Schema-Bump `CONFIG_SCHEMA_VERSION = 2`, neue Pfad-Konstanten, UI-Touchpoints): [docs/architecture/v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md).

## Common Pitfalls

1. **Don't use `import()` for lazy loading** — dynamic imports break under `file://` in single-file builds
2. **Don't use `fetch()` for local assets** — everything must be inlined or from IndexedDB/FSAPI
3. **Don't use `BroadcastChannel` for Streamlit bridge** — cross-origin between `file://` and `http://` fails. Use `postMessage` via `window.open()`
4. **Don't use `navigator.serviceWorker`** — unavailable under `file://`
5. **Web Workers must use `?worker&inline`** — standard Worker constructor fails under `file://`
6. **`crypto.subtle` works under `file://`** — it's a secure context
7. **File System Access API works under `file://`** — it's a secure context
8. **Embedding models run in Main Thread** — Web Workers cannot load ONNX models under `file://` (Blob URL CSP restrictions). This means large models may block the UI briefly during init.
9. **Status-Mappings sind domain-getrennt** — `src/core/utils/status-mappings.ts` ist NUR für Vorgang-Status (Bauantrag/Förderantrag: `neu`, `in_pruefung`, `genehmigt`, …). Feedback-Status (`neu`, `geplant`, `in_bearbeitung`, `umgesetzt`, `abgelehnt`, `archiviert`) hat seine eigenen Maps in `src/components/feedback/constants.ts` — bewusst getrennt, weil andere Semantik. Beim Hinzufügen neuer Status-Werte: Vorgang-Status zentral, Feedback-Status in der Feedback-Domain.
10. **Infrastructure-Writes müssen `atomicWrite()` / `appendToFile()` verwenden** (Phase 1a) — direkter `FileSystemWritableFileStream` umgeht die `.tmp`+Rename+`.backup`-Rotation und kann bei Crash korrumpieren. **Dokumentierte Ausnahme**: [src/phase2/triage/run-log.ts](src/phase2/triage/run-log.ts) schreibt bewusst per `createWritable({ keepExistingData: true })` direkt — siehe Datei-Kommentar (O(n)-Append wäre bei 13k+ Antraegen prohibitiv, Risk-Profil per Run-spezifischer JSONL akzeptabel).
11. **Neue Features hinter Flag setzen** (v1.10) — wenn ein Feature optional sein soll, in `scripts/config-schema.mjs` eine Flag ergänzen, in `src/config/feature-flags.ts` einen Helfer, und die betroffenen Stellen (Plugin-Filter, Komponenten-Rendering) damit gaten. OpenRouter in Prod-Builds wird zusätzlich in `validateConfig()` verboten
12. **Antrag-Status: zwei Domaenen, eine Kategorie** — `Antrag.status` / `AntragListItem.status` / `Verbund.status` ist als `AntragStatusRaw = string & { __brand }` typisiert (Bauantrag-Snake-Case ODER Foerderantrag-CSV-Rohwerte). Direkter Vergleich gegen Literal (`status === 'bewilligt'`) verboten — Kategorie-Helper aus [src/core/utils/status-canonical.ts](src/core/utils/status-canonical.ts) nutzen (`isOpenStatus`, `isBewilligtStatus`, `isBegleitungStatus`, `isClosedStatus`, `getStatusCategory`). Convention-Test `no-direct-status-compare` ([src/__tests__/codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)) faengt eindeutige Verstoesse. Semantik-Details (Foerderantrag-Domain hat keinen final-`abgelehnt`-Endzustand, Begleit-Phase mit VN-/ZB-/Widerruf-Stati, Toggle `bearbeiter_inkl_begleitung` Doppelwirkung, Frist-Berechnung phasen-abhaengig): [docs/architecture/antrag-status-domaenen.md](docs/architecture/antrag-status-domaenen.md).
13. **Foerderantraege-Seeds kommen aus echten CSVs** (v2-Seed, ab Mai 2026) — Die Dev-Seed-Antraege werden nicht mehr in TypeScript handgeschrieben, sondern in [docs/fixtures/](docs/fixtures/) als anonymisierte Real-Foyer-CSVs abgelegt. Der Seed-Loader unter [src/core/services/seed/fixture-loader.ts](src/core/services/seed/fixture-loader.ts) durchlaeuft den vollen `importCsvSource`-Pfad — Bugs im Parser, Column-Mapping oder Merger werden so im Seed-Lauf sichtbar. Schemas (Master + Secondaries via FKZ-Join) sind in `docs/fixtures/schema-*.ts` committet, die CSVs sind via globalem `*.csv`-Pattern in `.gitignore` lokal-only. Fehlende CSVs → Loader returned graceful 0 Antraege, App startet trotzdem. Encoding-Pipeline: `scripts/normalize-fixture-csvs.mjs` konvertiert windows-1252 → UTF-8 idempotent als `prebuild`/`predev`. Migration: Seed-Flag heisst `seed-complete-v2` (Pre-v2 IDBs behalten ihre alten FA-2026-XXX-Antraege als Geister bis manuelles Reset im Kurator-Panel). Neue Fixture-CSV ergaenzen: (1) CSV in `docs/fixtures/` ablegen, (2) `schema-X.ts` schreiben, (3) `FIXTURE_DEFS` in `fixture-loader.ts` ergaenzen.
14. **Toggleable Pills brauchen konstante Breite** (Auslastungs-Modul Lesson) — bei farbcodierten Pills mit aktiv/inaktiv-Toggle (z.B. `KategoriePill` mit `active`-Prop): den optionalen Inhalt (Häkchen ✓) IMMER rendern, im Inaktiv-Modus mit Tailwind-`invisible` (CSS `visibility: hidden`). Sonst horizontaler Layout-Shift in Tabellen. Kontrast aktiv/inaktiv NICHT über `opacity-40` — wirkt wie disabled. Stattdessen Inactive-Variante mit outline-only (siehe [DESIGN_GUIDE.md](DESIGN_GUIDE.md) Kapitel 5 „Toggleable Pill").
15. **Async UI-Aktionen: `useAsyncAction` ist Standard** — `try/finally` ohne `catch` + `onClick={() => void asyncFn()}` schluckt Promise-Rejections silent. Unter `file://` ist die Browser-Console oft nicht offen, der User sieht nichts. **Pflicht für neuen Code**: `useAsyncAction(fn)` aus [src/core/hooks/useAsyncAction.ts](src/core/hooks/useAsyncAction.ts) — liefert `{ run, busy, error, clearError }`, fängt Rejections automatisch und schützt vor Doppelklick. Cheatsheet: [docs/agents/async-error-pattern.md](docs/agents/async-error-pattern.md). Referenz-Migration: [CsvSourcesPage.tsx](src/plugins/csv-sources-kuration/CsvSourcesPage.tsx). Hand-gerolltes try/catch (Pattern: `try { ... } catch (err) { setError(err.message); } finally { setBusy(false); }` + Error-Banner) bleibt fuer Edge-Cases zulässig (z.B. wenn Inline-Validierung vor dem Async-Call läuft). **Bestehender Code**: Grep nach `onClick={() => void` zeigt ~50 ältere Vorkommen (vor allem in `src/plugins/auslastung/` + `src/plugins/dev-infrastructure-test/`). Diese sind opportunistisch zu migrieren — wenn die Datei ohnehin angefasst wird, dabei mitnehmen. Keine Big-Bang-Migration nötig, weil die meisten Service-Calls ihre Errors intern abfangen (siehe `embedding-corpus.ts`, `onboarding-import.ts`).
16. **Multi-Step-Setup: EIN finaler setState + EIN persist** (Auslastungs-Modul Lesson) — der `useAuslastungData`-Store hat einen `if (saving) return;`-Lock im `persist`. Mehrere parallele `persist`-Aufrufe (z.B. wenn jede `upsertX`-Action ihren eigenen persist triggert) fallen raus → inkonsistenter Save. Im finalen Wizard-Schritt alle Mutationen in EINEM `setState({...})`-Call sammeln, dann EIN `await persist(storage)`. Gleiche Regel gilt für andere Stores mit save-lock-Pattern (`feedbackService`-Sync z.B.).
17. **Auslastungs-AnonymMap nutzt ausschliesslich `tib_kuerz`** — nicht BIB/ZTP/PFM. `bootstrapKuerzelMap()` filtert hart auf das `tib_kuerz`-Feld. Ehemalige Bearbeiter (TIBs, die im aktuellen Programm nicht mehr aktiv sind) werden bewusst mitgezählt — deren historische Antraege liefern beim Embedding-Match wertvolle Kompetenz-Referenzen für neue MAs mit ähnlichem Hintergrund. Wer das filtern möchte (z.B. „nur aktive MAs"), muss eine separate Schicht oberhalb der AnonymMap einziehen.
18. **Auslastungs-Modul: AnonymMap kommt aus der persistenten kuerzel-map** — die Sidecar-Datei `_intern/auslastung-kuerzel-map.json` ist append-only: einmal vergebene anonIds bleiben stabil, neue Kürzel hängen hinten an (kein Identitäts-Drift bei alphabetischer Mitten-Insertion). Code-Konsumenten lesen `cache.anonymMap` aus [useAntraegeCache.ts](src/plugins/auslastung/hooks/useAntraegeCache.ts) bzw. nutzen [`useKuerzelMap`](src/plugins/auslastung/hooks/useKuerzelMap.ts) + [`buildAnonymMapFromKuerzelMap`](src/plugins/auslastung/services/kuerzel-map.ts). Unit-Tests: `buildAnonymMapForTests(antraege)` aus [`__tests__/test-helpers.ts`](src/plugins/auslastung/__tests__/test-helpers.ts) (intern: `bootstrapKuerzelMap` + `buildAnonymMapFromKuerzelMap` — derselbe Code-Pfad wie Prod).
19. **Embedding-Modell-Wechsel ist team-weiter Bruch** — wenn ein Kurator das Embedding-Modell via [ActionCardModels.tsx](src/plugins/kurator/actions/ActionCardModels.tsx) wechselt, werden ALLE bestehenden Embedding-Caches strukturell inkompatibel: lokaler Suchindex muss neu gebaut werden, der gespiegelte Auslastungs-Stage-2-Korpus auf SMB (`_intern/auslastung-embedding-corpus.bin`) ist für alle anderen Teammitglieder unbrauchbar bis er von einem PL mit dem neuen Modell neu gebaut wird (~46 min), und die Kategorie-Centroids in `auslastung.json` sind falsch dimensioniert. Die UI zeigt vor dem Wechsel einen Confirm-Dialog mit allen drei Konsequenzen — Wechsel nicht leichtfertig durchführen.
