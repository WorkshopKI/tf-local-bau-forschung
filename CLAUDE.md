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
Integriertes User-Feedback + Admin-Dashboard + öffentliches Board mit Sponsoring (Phase 1+2+3 komplett).

**User-Komponenten** (`src/components/feedback/`):
- `FeedbackButton.tsx` — globaler FAB (z-index 40, bottom-right). Wird in `Shell.tsx` gerendert (innerhalb NavigationContext) und ist während aktiver Tour ausgeblendet.
- `FeedbackPanel.tsx` — 2-Step-Flow (Input → Bestätigung) + optional Chatbot. Panel öffnet direkt im Textfeld ("Was möchtest du uns mitteilen?"), keine Kategorie-Auswahl mehr. Unter dem Textarea drei Quick-Tag-Chips (aus `QUICK_TAGS` in `constants.ts`) die beim Klick einen Starter-Text vorfüllen und Cursor ans Ende setzen. Tags verschwinden nach Klick oder beim ersten Tippen. Bereich-Dropdown bleibt optional. Sterne-Rating entfernt. Bestätigungs-Step-Button heißt jetzt "Details ergänzen" (öffnet Chatbot mit Originaltext).
- `FeedbackChatbot.tsx` — Multi-Turn-LLM-Dialog via `transport.submitConversation()`. Bei Streamlit-Transport: freundliche Meldung + Navigation zu Einstellungen. Überschreibt Auto-Klassifikation mit dialogbasierter Klassifikation + `user_confirmed: true`.
- `FeedbackConfirmCard.tsx` — Yes/No auf LLM-generierte JSON-Summary.
- `FaqSuggestions.tsx` — Inline FAQ-Vorschläge **immer** (debounced 500ms, Wort-Overlap ≥2, Stoppwörter ignoriert). Erscheint direkt nach dem Textarea (zwischen Textfeld und Quick-Tags).
- `MyFeedbackList.tsx` — eigener Verlauf (gefiltert nach `user_id == profile.name`). Zeigt "Unklassifiziert" für Tickets ohne `category` (LLM-Call fehlgeschlagen oder noch nicht fertig).
- `constants.ts` — `TEAMFLOW_AREAS`, Category/Status-Labels + Tailwind-Color-Maps, **`QUICK_TAGS`** (3 Chip-Vorlagen), **`LLM_CATEGORY_MAP`** (bug→problem, feature→idea, ux→idea, praise→praise, question→question).

**Auto-Klassifikation (fire-and-forget)**:
Nach Absenden im FeedbackPanel startet `autoClassifyFeedback(transport, text, context, area?)` einen Single-Turn-LLM-Call (`transport.submitMessage` mit kurzem `CLASSIFICATION_PROMPT`, `thinkingBudget: 'low'`). Bei Erfolg: `updateFeedback` setzt `llm_classification`, `llm_summary`, `category` (via `LLM_CATEGORY_MAP`). Bei Fehler/Streamlit: Ticket bleibt ohne Kategorie (Badge "Unklassifiziert"), kein Error-Toast. UI wartet nicht auf den Call — Bestätigungs-Step erscheint sofort.

**Service-Layer** (`src/core/services/feedback/`):
- `feedbackService.ts` — CRUD: localStorage primär (`teamflow_feedback_items`) + Shared-File-Sync (`_intern/feedback/feedback.json` im Datenverzeichnis, v1.9). Merge-by-id (User-Felder lokal, Kurator-Felder `kurator_status`/`kurator_priority`/`kurator_notes` shared-wins; `normalizeLegacyFields` mappt alte `admin_*`-Einträge beim Laden). FAQ-Helpers (`matchFaqEntries`, `createStandaloneFaq`, `bumpFaqAskCount`). `updateFeedback` Pick-Whitelist enthält `category` (damit Auto-Klassifikation das Feld nachträglich setzen kann).
- `feedbackLlm.ts` — `loadSystemPrompt(storage)` liest `_intern/feedback/system-prompt.md` (Fallback `DEFAULT_SYSTEM_PROMPT`). `buildFeedbackSystemPrompt(template, context)` ersetzt `{{PAGE}}`/`{{ROUTE}}`/`{{DEVICE}}`/`{{VIEWPORT}}`/`{{LAST_ACTION}}`/`{{SESSION_MINUTES}}`/`{{ERRORS}}`. 3 Parser portiert verbatim aus Referenz: `parseFeedbackSummary`, `parseBotResponse`, `renderSimpleMarkdown`. `initSystemPromptFile(storage)` schreibt Default-Template ins Datenverzeichnis (Button im Kurator-Config-Panel). **`autoClassifyFeedback(transport, text, context, area?)`** + **`CLASSIFICATION_PROMPT`** (kurzer JSON-only-Prompt für stille Hintergrund-Klassifikation).
- `feedbackContext.ts` — `captureFeedbackContext(activeId, activeName)` + Ring-Buffer für `window.onerror`/`unhandledrejection` (max 5).
- `promptGenerator.ts` — `generateClaudeCodePrompt(ticket)` mit TeamFlow-Constraints-Block (file://, Single-File-Build, Tailwind v4, React 19, Zustand, lucide-react, Deutsche UI, CLAUDE.md primär).

**Kurator-Plugin** (`src/plugins/feedback/`, `id: 'feedback-kuration'`, `kuratorOnly: true`):
- `FeedbackAdminPage.tsx` — 4 Tabs (Tickets / FAQ / Sponsoring / Einstellungen) via `@/ui/Tabs`.
- `sections/FeedbackTicketList.tsx` — Filter (Kategorie/Status), Karten-Liste links.
- `sections/FeedbackTicketDetail.tsx` — Status-Dropdown, Priority-Slider, **Aufwand-Dropdown (S/M/L/XL, nur für Ideen)**, **Sponsoring-Fortschritt-Block mit "Schwelle erreicht"-Hinweis**, Notizen, FAQ-Markierung + Antwort + Stichwörter, "Claude Code Prompt generieren" mit Copy + Download .md.
- `sections/FeedbackFaqTab.tsx` — Übersicht aller `is_faq===true` Items + manuell anlegen + bearbeiten + Markierung entfernen + löschen.
- `sections/FeedbackSponsoringOverview.tsx` — Phase 3: Features-Ranking nach Progress, konfigurierbare Schwellen (S/M/L/XL + Hours-Faktor + Budget/Quartal), Budget-Statistik.
- `sections/FeedbackConfigPanel.tsx` — Modell-Dropdown (Default `openai/gpt-oss-120b`), Max-Turns-Slider (2–12), System-Prompt-Pfad + Vorschau + "System-Prompt initialisieren"-Button (nur wenn Datei fehlt), Shared-File Status.

**Öffentliches Board** (Phase 3, `src/plugins/feedback-board/`, `id: 'feedback-board'`, KEIN kuratorOnly):
- Sichtbar für alle User in Sidebar Tools-Gruppe (order: 75).
- `FeedbackBoardPage.tsx` — Header mit BudgetBadge + Filter-Pills (Alle/Bugs/Features/Offen/Umgesetzt) + sortierte Card-Liste.
- Zeigt nur Bugs (problem) + Features (idea); Fragen/Lob/archivierte ausgefiltert.
- Sortierung: `in_bearbeitung` oben, dann Sponsoring-Progress desc (bei Features), dann `created_at` desc.
- Bugs ohne Sponsoring-Balken (werden immer gefixt).
- Features mit `effort_estimate` zeigen Balken + Sponsor-Buttons.

**Board-Komponenten** (`src/components/feedback/`):
- `FeedbackBoardCard.tsx` — Einzelne Karte mit Status/Kategorie/Aufwand/Progress/Sponsor-Buttons/Sponsor-Liste.
- `SponsorButton.tsx` — Punkte-Dropdown (1/2/3/5) + Stunden-Dialog (hours + project_ref) + "Du sponsorst"-Badge mit Zurückziehen.
- `BudgetBadge.tsx` — `X/Y Punkte (Q2 2026)` mit Ampelfarbe (grün >5, gelb 2-5, rot 0-1).

**Sponsoring-Service** (`src/core/services/feedback/`):
- `budgetService.ts` — `getCurrentQuarter()`, `loadUserBudget(userId)` (auto-Reset bei Quartalswechsel), `spendPoints`, `refundPoints`, `checkQuarterReset` (beim App-Start).
- `feedbackService.ts` erweitert: `sponsorTicket()` (Budget-Check + Doppel-Check + Merge-Write), `unsponsorTicket()` (Refund), `getSponsoringProgress(ticket, config)` (combined = points + hours × factor), `isSponsoringOpen(ticket)` (nur Ideen mit Aufwand + Status `neu`/`geplant`), `setEffortEstimate(storage, id, effort)`.

**Sponsoring-Logik**:
- Zwei Währungen pro Ticket: Punkte + Stunden (mit Projekt-Referenz).
- User kann je Ticket 1x Punkte + 1x Stunden sponsern (nicht mehrfach pro Typ).
- Combined = points + hours × `hours_to_points_factor` (Default 3).
- Schwellen (konfigurierbar via `FeedbackConfig.sponsoring_thresholds`): S=5, M=15, L=30, XL=50.
- Quartals-Reset: App-Start prüft via `checkQuarterReset`, bei Wechsel Toast "Neues Quartal — Punkte aufgefrischt" (App.tsx).
- **Keine Auto-Transition**: Schwelle erreicht → Admin bekommt Hinweis "Status manuell auf Geplant setzen?", entscheidet selbst.
- Sponsoring geschlossen sobald Status `in_bearbeitung`/`umgesetzt`/`abgelehnt`.

**Admin-Gating**:
- `UserProfile.is_admin?: boolean` (`src/core/types/config.ts`)
- `ShellLayout.tsx` filtert `enabledPlugins` → Plugins mit `kuratorOnly: true` nur sichtbar wenn `profile?.is_kurator === true` (Fallback auf Legacy-Feld `is_admin` / `adminOnly` beim Laden vor-v1.9-Profile).
- Aktivierung: Onboarding Step 0 (Checkbox) ODER Einstellungen → Profil-Tab → "Kurator-Funktionen aktivieren"
- Default: `false` (jeder Nutzer kann sich selbst zum Kurator machen — single-user trust model)

**LLM-Transport-Erweiterung** (`src/core/services/ai/transports/`):
- Neue Methode `DirectLLMTransport.submitConversation(messages[], options?)` für Multi-Turn (vorher nur Single-Turn `submitMessage`).
- `AITransport`-Interface erweitert um optionale `submitConversation?(...)` für Feature-Detection.

**NavigationContext-Erweiterung** (`src/core/hooks/useNavigation.ts`):
- `activeId: string` exposed → erlaubt FeedbackPanel, das aktive Plugin für Kontext-Erfassung zu ermitteln.

**Datenverzeichnis-Layout** (v1.9):
- `_intern/feedback/feedback.json` — Shared-Tickets (`SharedFeedbackFile { version: 1, updated_at, items[] }`)
- `_intern/feedback/system-prompt.md` — Kurator-editierbarer Chatbot-Prompt (Fallback in `feedbackLlm.ts`)

**Bekannte Einschränkungen**:
- Streaming nicht implementiert (Buffer-Mode für Chatbot-Antworten)
- Sync-Konflikt: Last-writer-wins bei concurrent Schreibzugriff auf `feedback.json` (akzeptabel bei niedriger Frequenz)
- Budget (`teamflow_user_budget_v1_{userId}`) liegt in localStorage pro Gerät — User bekommt bei Browserwechsel neues 10-Punkte-Budget (Doppel-Sponsoring-Vektor theoretisch möglich, bei 5-15 User aber kein reales Problem)
- Budget-Statistik im Kurator-Tab nur dieser Browser (für team-weite Stats müsste Shared-Storage ergänzt werden — out of scope)
- `FeedbackItem.category` ist **optional** (`category?: FeedbackCategory`) — Tickets ohne LLM-Klassifikation (Streamlit-Transport, LLM-Fehler, ungültige Modell-Config) erscheinen als "Unklassifiziert". Kurator-Dashboard + MyFeedbackList + Board-Cards zeigen Fallback-Badge "Unklassifiziert" bei undefined.

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

Eingangsfilter für die DMS-Dokumenten-Pipeline. Pro Datei wird kaskadiert entschieden: relevant?, doc_type?, zugehöriger Antrag?

**Kaskade (`src/phase2/triage/triage.ts` als Orchestrator):**
- **Stage 0 — DMS-CSV-Lookup** (`stage0-dms-lookup.ts`): DocID-Lookup in der gefilterten DMS-CSV (`_intern/dms-index-filtered.csv`), erwartet ~60 % Treffer ohne Datei-Zugriff. Aktenplanzuordnung → doc_type via Mapping in `dms-csv/aktenplan-mapping.ts` (Defaults + Override-JSON unter `_intern/aktenplan-mapping.json`).
- **Stage 1 — Strukturell** (`stage1-structural.ts`): Format-Check, PDF-Searchability-Probe, Sonderregel `Gutachten + DOCX → irrelevant` (Arbeitsversion). pdfjs ist lazy importiert — Tests in Node nutzen den `legacy`-Build via vitest-Alias.
- **Stage 2 — Keywords** (`stage2-keywords.ts` + `keywords.ts`): erste ~500 Tokens via mammoth/pdfjs, Keyword-Marker pro doc_type, FKZ-Extraktion (strict + tolerant), Akronym-Hint. Sonderregel: `korrespondenz`-Top-Match wird auf `nachforderung` verfeinert wenn beide Keywords matchen.
- **Stage 3 — Nemotron** (`stage3-nemotron.ts`): nur für ambige Fälle, ruft `DirectLLMTransport.submitMessage()` mit JSON-only-Schema. `enable_thinking: false`.

**Matcher** (`matcher/`): nutzt **bestehende** IDB-Stores `antraege` + `akronym_index` — kein eigener FKZ/Akronym-Lookup. FKZ-Treffer im Antrags-Store → `confidence=high`. Akronym-Treffer eindeutig → `medium`, mehrdeutig → `review` mit `candidate_antrag_ids`. Konflikt FKZ vs. Akronym → `flag_conflict`.

**Skip-Liste** (`skip-list/`): IDB-Store `phase2_skip_list`, gekeyt auf `filename` (DocID ist global eindeutig im DMS). `classifier_version` als Reset-Mechanik — bei Klassifikator-Update: zentrale Konstante `CLASSIFIER_VERSION` in `triage.ts` erhöhen, dann `resetSkipListByVersion()`.

**Pending-Antrag-Bucket** (`pending-antrag/holding-bucket.ts`): IDB-Store `phase2_pending_antraege`, Index auf `akronym`. Projektbeschreibungen ohne Match landen hier statt in `orphan`. Re-Match wird automatisch getriggert:
- Nach erfolgreichem CSV-Import (`importer.ts` → `rematchOnSnapshotReload()` Best-Effort)
- Nach erfolgreichem Snapshot-Sync wenn `reloadedStores` `akronym_index`/`antraege` enthält (App.tsx-Sync-Bootstrap)

**Scanner** (`scanner/scan-roots.ts`): rekursiver Walker über den `dokumentenquelle`-Handle (`smb-handle.ts`). Iteriert `runtimeConfig.scan.sub_roots` als Top-Level-Roots (1–10 Förderunterprogramm-Verzeichnisse), steigt dann in beliebig tiefe Datums-Unterordner ab (Limit `scan.max_depth`, Default 20). Filter `scan.file_extensions`. Yield zwischen Verzeichnissen für UI-Responsiveness.

**Manifest-Store** (`scanner/manifest-store.ts`): IDB-Store `phase2_scan_manifest`, gekeyt auf `filename`, Indexe `matched_antrag_id` + `triage_state`. JSONL-Spiegelung auf den Daten-Share unter `SCAN_MANIFEST_PATH` (`_intern/scan-manifest.json`) ist vorbereitet, der Caller entscheidet wann gespiegelt wird.

**OCR-Side-Car** (`ocr/side-car.ts`): nur Stub-Interface `ocrFirstPage(pdfBlob)`, wirft `OcrNotImplementedError` — echte Tesseract-Side-Car-Anbindung kommt in einem Folge-Patch.

**DMS-Quellen-Verwaltung** (v1.15, `src/plugins/dokumentenquellen-kuration/`): Neues Kurator-Plugin (`id: 'dokumentenquellen-kuration'`, `kuratorOnly: true`, `category: 'kuration'`, sichtbar wenn `features.dokumentenscan === true`) mit zwei Sections:
- **VerwaltenSection** (Dev-Bereich, sichtbar wenn `features.devInfraPanel === true || import.meta.env.DEV`): Quellen anlegen, Read-Only-Picker (`pickAndStoreDmsSourceHandle`), Sub-Roots editieren, Label ändern, löschen.
- **AktivierenIndexierenSection** (immer sichtbar für Kuratoren): `is_active`-Switch pro Quelle + "Alle aktiven indexieren" + "Manifest auf Share spiegeln". Iteriert via `runBulkTriageForSources` sequentiell über aktive Sources mit globaler DMS-CSV-Cache.
- **Datenmodell** (`src/core/services/dms-sources/`): IDB-Store `dms_sources` (Index `by_active` auf `is_active`), Felder `id`, `label`, `sub_roots[]`, `is_active`, `created_at`, `created_by`, `updated_at`, `last_indexed_at?`, `last_index_stats?`. Source-Handles leben in der `smb-handles`-Map unter Schlüssel `dms-source-${id}`.
- **Manifest-Erweiterung**: `ManifestEntry.source_id?` (optional) — neuer Index `by_source_id` auf dem `phase2_scan_manifest`-Store. Listing-Helper `listManifestEntriesBySource(sourceId)` mappt Legacy-Einträge ohne `source_id` transparent auf die `default`-Source. Filename-Key bleibt unverändert; bei Cross-Source-Filename-Kollisionen Last-Write-Wins (dokumentierte Limitation, DMS-DocIDs sind in der Praxis pro Instanz eindeutig).
- **Migration**: `migrateLegacyDmsSource(idb)` läuft idempotent beim App-Start (in `App.tsx` nach `storage.init()`). Wenn `dms_sources` leer ist UND ein Legacy-`dokumentenquelle`-Handle existiert: legt eine Default-Source mit `id='default'` an, übernimmt `phase2_scan_config.selected_paths` als `sub_roots`, kopiert den Handle auf `dms-source-default`. Audit-Action: `dms_source_migrated_from_legacy`.
- **Audit-Actions**: `dms_source_added`, `dms_source_removed`, `dms_source_label_changed`, `dms_source_subroots_changed`, `dms_source_handle_picked`, `dms_source_handle_lost`, `dms_source_activated`, `dms_source_deactivated`, `dms_source_indexed_started`, `dms_source_indexed_finished`.
- **Phase2RescanCard im Suchindex-Plugin entfernt** (vor v1.15 in `src/plugins/kurator/sections/`); Multi-Source-Indexierung lebt jetzt komplett im neuen Plugin.
- **Einstellungen-Tab "Dokumentenquellen"** (`src/plugins/einstellungen/DokumentenquellenTab.tsx`): User-sichtbar, ausgegraut. Vorbereitend für persönliche User-Pfade, sobald internes Embedding/LLM-API verfügbar ist.

**Build-Time-Config** (`runtimeConfig.scan`): neue Felder in `scripts/config-schema.mjs` und `src/config/runtime-config.ts`:
- `scan.sub_roots: string[]` — relative Roots im dokumentenquelle-Handle
- `scan.file_extensions: string[]` — Pflicht wenn `features.dokumentenscan = true`
- `scan.max_depth: number`
- `scan.fkz_allowed_prefixes: string[]` — Format `^\d{2}[A-Z]{2}$` (strukturell geprüft)
`validateConfig()` prüft strukturell + erzwingt non-empty `file_extensions` wenn dokumentenscan an.

**Vorfilter-Script** (`scripts/filter-dms-csv.mjs`): Streaming-Filter der 5M-Zeilen-DMS-CSV → ~250k Zeilen via FKZ-Präfix-Regex. Ausgabe mit Zusatzspalte `extracted_fkz`. Encoding-Detection (UTF-8 vs. cp1252) anhand der ersten 4 KB. Summary mit `rows_total`/`rows_kept`/`per_prefix`/`top_aktenplan`/`top_von`. Aufruf: `node scripts/filter-dms-csv.mjs input.csv output.csv [--prefixes 16EP,16KN,16DS,16DL]`.

**FKZ-Regex-Detail**: `\b` matcht NICHT zwischen `\w` und `_`, aber FKZs sind im DMS-Export typischerweise von `_` umrahmt. Stattdessen: `(16EP|16KN|...)\d{6}(?!\d)` (nicht von einer Ziffer gefolgt). Gleiches Muster im `filter-dms-csv.mjs` und `fkz-extractor.ts`.

**Eval-Suite** (`src/phase2/__tests__/`): Vitest-basiert (Test-Runner als Devdependency neu, `npm run test:phase2`). Schwelle: ≥ 9/11 korrekt klassifiziert auf den Beispiel-Dokumenten in `docs/phase-2/triage-beispiele/`. Vitest-Setup polyfillt DOMMatrix/Path2D/ImageData für pdfjs-Module-Init und aliased `pdfjs-dist` auf den Legacy-Build (Node-kompatibel).

**Dev-Plugin** (`src/plugins/dev-infrastructure-test/panels/TriagePanel.tsx`): neues Panel "5 · Phase-2 Triage" — Buttons "Index laden", "Datei wählen + Triage", "Skip-Liste", "Pending". Output als JSON-Block für End-to-End-Validierung.

### Phase-2 Review-Queue UI (`src/plugins/dokument-review/`)

Kurator-Plugin (`id: 'dokument-review'`, `category: 'kuration'`, `kuratorOnly: true`, `order: 35`) für die Bearbeitung der Phase-2-Triage-Ergebnisse. Sichtbar wenn `features.dokumentenscan === true` UND `profile.is_kurator === true`. Phase-2-Pipeline und `Phase2RescanCard` (Bulk-Scan) bleiben unverändert.

**Layout** (50/50-Split unter Header-Bereich):
- `DashboardCard` — 6 Kacheln (relevant / irrelevant / review / pending / errors / gesamt) als klickbare Quick-Filter; "Pending re-matchen"-Button erscheint nur wenn `pending > 0`.
- `FilterBar` — vier Pill-Reihen (Ansicht / Confidence / Typ / Source) mit Count-Badges. Typ-Pills werden dynamisch aus den im Manifest tatsächlich vorkommenden `doc_type`-Werten generiert.
- `ManifestList` (linke Spalte) — paginiert 50 Einträge/Seite, Sort-Dropdown (Review zuerst / Dateiname / Typ / Confidence). Selektion synchron mit Store; Selektion springt automatisch auf den ersten Page-Eintrag wenn die aktuelle Wahl durch Filterwechsel rausfällt.
- `DetailPanel` (rechte Spalte) — 4 Read-Only-Sections (Datei-Info / Triage / Match / DMS-CSV) + Aktionsleiste.
- `PendingList` (col-span-2 statt Split, wenn `viewMode='pending'`) — Holding-Bucket-Einträge mit `Manuell zuordnen` (öffnet Inline-`AntragAutocomplete`) und `Eintrag entfernen`.

**Aktionen im DetailPanel** (alle gehen über `useReviewActions`, schreiben `triage_source='manual'`, `classifier_version=CLASSIFIER_VERSION`, frischen Timestamp; Auto-Advance auf nächsten Listeneintrag in `review-queue`/`all`-Ansicht):
- *Typ ändern* — `Select` mit allen 14 `DocType`-Werten → `putManifestEntry({ doc_type, triage_reason: 'manual_doc_type:<typ>' })`
- *Antrag zuordnen* — `AntragAutocomplete` (FKZ/Akronym/Titel-Substring auf in-RAM-Index des aktiven Programms, max 8 Vorschläge) ODER Quick-Pick-Button pro `candidate_antrag_id` → `putManifestEntry({ matched_antrag_id, match_method:'manual', match_confidence:'high', requires_review:false, candidate_antrag_ids:[] })` + Skip-Liste-Eintrag wird gelöscht falls vorhanden
- *Irrelevant* — `putManifestEntry({ triage_state:'irrelevant', requires_review:false })` + `putSkipEntry({ source:'manual', reason:'manual_irrelevant', dms_*, extracted_* })`
- *Relevant ohne Zuordnung* — `putManifestEntry({ triage_state:'relevant', requires_review:false, match_confidence:'orphan' })`
- *Erneut klassifizieren* — `deleteManifestEntry()` + `deleteSkipEntry()`. Toast: „Beim nächsten Bulk-Scan im Suchindex-Plugin wird neu klassifiziert" (kein eigener Re-Trigger im Plugin — User soll explizit zur `Phase2RescanCard` gehen).

**Pending-Aktionen**:
- *Manuell zuordnen* — liest den existierenden Manifest-Eintrag (Pending-Triage hat `triage_state='pending_antrag'` schon angelegt), setzt `triage_state='relevant'`, `match_method='manual'`, schreibt + löscht `phase2_pending_antraege`-Row.
- *Pending re-matchen* — `rematchOnSnapshotReload(idb, activeProgrammId)` global (Button im Header der `DashboardCard`).

**Keyboard-Shortcuts** (`KeyboardHandler` registriert globalen `keydown`-Listener; ignoriert Input/Textarea/Select/contenteditable; deaktiviert in `pending`-View):
| Taste | Aktion |
| --- | --- |
| `j` / `↓` / `k` / `↑` | Liste navigieren |
| `n` | nächster Review-Eintrag (skipt non-review) |
| `Enter` | Selektion fokussieren |
| `Escape` | Selektion zurücknehmen |
| `i` | Irrelevant + Auto-Advance |
| `r` | Relevant ohne Zuordnung + Auto-Advance |
| `a` | Antrag-Autocomplete-Input fokussieren (`document.querySelector('[data-tf-autocomplete-input="true"]')`) |

**Daten-Hooks**:
- `useManifestData` — lädt `listManifestEntries` / `listAllSkipEntries` / `listAllPending` parallel beim Mount, hält im React-State. `reloadEntry(filename)` mergt einen einzelnen IDB-Roundtrip in den Cache; `removeEntry(filename)` ist nur State-seitig (für Optimistic-Updates nach `deleteManifestEntry`); `rematchPending(programmId)` ruft `rematchOnSnapshotReload` und reloadet Manifest+Pending.
- `useAntraegeIndex` — `listAntraegeByProgramm(activeProgrammId)` einmal beim Mount/Programm-Switch; `filter(query, max)` und `byAktenzeichen(az)` als Substring-Such-Helper für `AntragAutocomplete`.
- `useReviewActions` — wrappt die 5 Aktionen, ruft danach `onMutated(filename)` (= `reloadEntry`) bzw. `onRemoved(filename)` (= `removeEntry`) und zeigt einen Toast.

**Filter + Sort** (`filtering.ts`): rein clientseitig auf dem in-memory-Array. `applyFilters({ viewMode, confidenceFilter, docTypeFilter, sourceFilter, sortKey })` + `isInReviewQueue(entry)` + `uniqueDocTypes(entries)`. Sort-Keys: `review_then_classified_desc` (Default) / `filename` / `doc_type` / `confidence`.

**Toast** (`ReviewToast`): kein globales Toast-System — eigener Auto-Dismiss-Mechanismus im Store via `setTimeout(..., 3000)`. Tones `success`/`info`/`error` mappen auf Border-Farben (`--tf-success-*`/`--tf-info-*`/`--tf-danger-*`).

**Persistenz** (localStorage): nur `viewMode` unter Key `teamflow_dokument_review_view`. Confidence/Typ/Source/Sort/Page/Selection werden bewusst nicht persistiert.

**Auto-Cleanup** (`AutoCleanupCard` zwischen DashboardCard und FilterBar): sechs Heuristiken zum Reduzieren der Review-Queue. „Vorschau anzeigen" zeigt pro Regel die Trefferanzahl auf den aktuell offenen Review-Einträgen, jede Regel via Checkbox einzeln aktivierbar. „Anwenden" schreibt jede betroffene `ManifestEntry` auf `triage_state='irrelevant'` + `requires_review=false` (bzw. nur `requires_review=false` bei `matched_with_fkz`) und legt für irrelevant-Regeln einen `SkipListEntry` an. Reihenfolge — erster Match gewinnt; spezifische Regeln vor generischer Whitelist:
1. `zero_byte` — `size_bytes === 0` → irrelevant
2. `parse_error` — `triage_reason` startet mit `parse_error` → irrelevant
3. `bescheid` — `doc_type === 'bescheid'` → irrelevant
4. `bewilligung` — `dms_bezeichnung` enthält `Bewilligung` → irrelevant
5. `zuwendungsbescheid` — `dms_bezeichnung` enthält `ZuwB`/`Zuwendungsbescheid` → irrelevant
6. `format_outside_whitelist` — Whitelist-Tupel `(gutachten,pdf)`, `(nachforderung,doc/docx)`, `(projektbeschreibung,pdf)`, `(verwendungsnachweis,pdf/doc/docx)` — alles andere → irrelevant. **`matched_antrag_id` bleibt erhalten** für Folge-Anzeige in der Antrag-Detail-Sonstige-Section.
7. `matched_with_fkz` — Whitelist-Treffer + `matched_antrag_id` + `extracted_fkz` → `requires_review=false`, Status bleibt.

**Dokumente am Antrag**: `AntragDokumenteSection` (`src/plugins/antraege/AntragDokumenteSection.tsx`) wird zweimal am Ende der Antrag-Detail-Seite eingebunden — als „Dokumente" (Whitelist-Treffer mit `triage_state='relevant'`) und „Sonstige Dokumente" (alle mit `triage_state='irrelevant'`). Beide Sections sind defaultmäßig zugeklappt. Index-Lookup via `listByMatchedAntrag(idb, aktenzeichen)` (neu in `src/phase2/scanner/manifest-store.ts`, nutzt den bestehenden `matched_antrag_id`-Index — kein Full-Table-Scan). Sortierung in „Dokumente" folgt dem Lebenszyklus (projektbeschreibung → gutachten → nachforderung → verwendungsnachweis → verwendungsnachweispruefung); in „Sonstige" stehen `gutachten_qs` und `korrespondenz` zuerst. „Öffnen"-Button lädt die Datei via `getDokumentenquelleHandle` + `makeLoadBlobFromHandle` als Blob und öffnet sie in einem neuen Tab; Object-URL wird nach 60 s revoked.

**Anti-Patterns** (in diesem Plugin nicht vornehmen):
- Keine externe Virtualisierungs-Library (Pagination 50/Seite reicht für die erwartete Skala).
- Keine direkten IDB-Transaktionen — alle Mutationen über die Phase-2-API in `@/phase2`.
- Keine modalen Dialoge — Aktionen inline im `DetailPanel`.
- Kein Renderer für PDF/DOCX-Inhalte (kommt erst wenn die Volltext-Pipeline steht).
- Keine Veränderungen an `Phase2RescanCard.tsx` oder `TriagePanel.tsx`. Read-only-Accessors in `src/phase2/scanner/manifest-store.ts` (z.B. `listByMatchedAntrag`) sind erlaubt; Triage-Pipeline-Logik bleibt unverändert.

### Auslastungs-Modul (Plugin "auslastung", v1.16)

Plugin (`id: 'auslastung'`, `category: 'workflow'`, `kuratorOnly: false`, sichtbar wenn `features.auslastung === true`) für automatische Antrags-Klassifizierung in Überkategorien + MA-Zuweisung mit dreistufigem Matching. Quartalsbasierte Kapazitäts-Planung. Datenschutz-Kernprinzip: **MAs sind im gesamten Modul nur als anonyme IDs (MA01-MAxx) sichtbar**; echte TIB-Kürzel kommen in Profil-Daten ausschließlich im RAM während eines passwortgeschützten XLSX-Exports vor und werden nicht in `auslastung.json` gespeichert. **Ausnahme**: die Sidecar-Datei `_intern/auslastung-kuerzel-map.json` enthält das Mapping `kuerzel ↔ anonId` als Klartext. Diese Datei ist nötig, weil Selbsteintragungen pro User ihre eigene anonId stabil auflösen müssen und eine echte Verschlüsselung dies brechen würde. Sicherheits-Effekt vs. dem alten ephemeral-Sort-Modell: effektiv unverändert, da die antraege selbst `tib_kuerz` als Klartext-Spalte enthalten und das Mapping daraus trivial ableitbar war. Die persistente Datei macht das Mapping explizit und stabilisiert die anonIds gegen alphabetische Re-Sort-Drift bei neuen Kürzeln. Profil-Daten (Kapazität, Zuweisungen, Kategorien) in `auslastung.json` referenzieren MAs weiterhin nur über anonId.

**5 vordefinierte Überkategorien** (aus FZD-Kontext, im Admin editierbar): `IT` Industrielle Technologien, `DT` Digitale Technologien, `EU` Energie- und Umwelttechnologien, `LG` Lebens- und Gesundheitswissenschaften, `NM` Naturwissenschaftliche Methoden.

**Tabs** (`AuslastungView`, role-gated): Selbsteintragung (alle User) · Klassifizierung · Zuweisung (50/50-Split-Cockpit) · Kapazität · Admin — letzte 4 nur für `is_kurator`. „Meine Technologien" als Tab im Einstellungs-Plugin.

**Aktiv/Inaktiv-Flag** (`AnonymerMitarbeiter.aktiv: boolean`, Mai 2026): Filter-Schicht für ehemalige Bearbeiter. Inaktive MAs werden aus UI (Admin-Tabelle, KapazitaetsDashboard, Zuweisungs-Cockpit) und Matching (Eligible-Sammlung in `matching-engine.ts`, Score-Aggregation in `embedding-matcher.ts`) ausgeblendet — ihre historischen Antraege bleiben aber im Embedding-Corpus als Kompetenz-Referenz für neue MAs mit ähnlichem Hintergrund. Default beim Anlegen: `true`. Migration alter Daten (`normalizeMitarbeiterRecord` in `services/auslastung-store.ts`): ebenfalls `true`. PL bekommt im Admin-Tab einen einmaligen Vorschlag-Banner (`AktivVorschlagBanner.tsx` + `services/aktiv-detection.ts`): "MAs mit Antrag im aktuellen Jahr → aktiv vorgeschlagen, sonst inaktiv". Banner erscheint nur wenn `shouldShowAktivVorschlag(mitarbeiter) === true` (alle MAs noch `aktiv: true`); ist auch nur ein MA inaktiv, gilt die Liste als gepflegt und der Banner kommt nicht wieder. Aktivieren/Deaktivieren einzeln über Aktiv-Toggle pro Tabellenzeile (Bestätigungsdialog beim Deaktivieren). "Inaktive anzeigen"-Checkbox im Header zeigt ausgegraute inaktive MAs in der Tabelle. **Lücken in der MA-Nummerierung** sind durch das Aktiv-Flag normal: anonIds bleiben stabil (siehe Pitfall #18), nur die Anzeige filtert. KapazitaetsDashboard zeigt dezenten Hilfetext "30 von 79 MAs aktiv …" wenn Lücken vorhanden sind.

**Engine-Layer** (`src/plugins/auslastung/services/`):
- `klassifizierung-engine.ts` — dreistufig: **Stage 0** (Boolean-Match auf ZT-Spalten der CSV `"Künstliche"`, `"Gesundes L"`, `"Energie/Re"`, ... → direkt der Default-Überkategorie zugeordnet, höchste Confidence), **Stage 1** (Regel-Mapping aus PL-konfigurierten Deskriptoren-Listen, Multi-Label wenn 2 Kategorien matchen), **Stage 2** (Embedding-Centroid-Match, optional via `config.stage2Aktiv`).
- `bm25-matcher.ts` — Mini-BM25 für MA-Profile mit deutschen Stoppwörtern.
- `embedding-corpus.ts` — IDB-Cache `auslastung-emb:<aktz>` für Antrags-Embeddings (~40 MB bei 13k × 768d), Corpus-Build mit Progress-Callback, AbortSignal-Support. Wird seit Mai 2026 als Sidecar-Dateipaar (`_intern/auslastung-embedding-corpus.{manifest.json,bin}`) auf den SMB-Daten-Share gespiegelt — Cold-Start eines neuen Rechners lädt vom Share statt 46 min neu zu bauen. Mirroring-Logik in `embedding-corpus-mirror.ts` + Hook `useEmbeddingCorpusMirror`. Modell-Mismatch (Share-Korpus mit anderem Modell als lokal aktiv) blockiert Download und Upload mit explizitem UI-Hinweis; Antraege-Drift (`aktenzeichenSetHash` weicht ab) gibt sanften Hinweis zum inkrementellen Re-Build. Upload nutzt den bestehenden `build-lock`-Mechanismus mit `stufe: 'auslastung-corpus'`.
- `embedding-matcher.ts` — Top-K Antrags-Similarity → TIB-Score-Aggregation mit virtueller-Projekt-Confidence.
- `matching-engine.ts` — dynamische α-Fusion (BM25 vs Embedding je nach Konfidenz) + Kapazitäts-Filter + Balance-Score → Top-3 pro Antrag.
- `anonym-map.ts` — deterministisches Mapping echtes TIB-Kürzel → MA01..MAxx, **nur im RAM**, nie persistiert. Liest ausschließlich `tib_kuerz` (nicht BIB/ZTP/PFM). Ehemalige Bearbeiter werden bewusst mitgezählt — deren Profile dienen als Embedding-Referenz für neue MAs mit ähnlichem Hintergrund.
- `onboarding-kalibrierung.ts` — Spearman-Korrelation + Grid-Search über Confidence-Faktoren, für die Validierung des Standalone-Onboarding gegen historisches Matching.

**Build-Pipeline** (`scripts/build-default-labels.mjs`, prebuild-Hook): liest `_labels/Labels PrjBsp_GPT.xlsx` → erzeugt `src/plugins/auslastung/services/default-labels.ts` (AUTO-GENERIERT, nicht manuell editieren) mit:
- `LABEL_BY_CSV_COLUMN` — 148 Klarnamen pro CSV-Spaltencode
- `ZUKUNFTSTECHNOLOGIE_FELDER` — 44 ZT-Felder (22 Themen × TV/VB-Ebene) mit Default-Mapping auf die 5 Kategorien
- `KATEGORIE_KEYWORD_HEURISTIK` — Substring-Heuristik für TECHN_/BRANCHE_-Werte als Fallback

**Pflegepunkt bei neuen ZT-Themen**: `ZT_TO_KATEGORIE`-Map in `build-default-labels.mjs` editieren → `npm run build:default-labels` → die VB-Spalten-Mappings in `docs/fixtures/schema-c.ts` ergänzen (PapaParse renamed Duplikate zu `<header>_1`). Stage-0-Match liest `customField`-Namen (`zt_*_tv` / `zt_*_vb`), nicht den CSV-Header.

**Datenmodell** (`auslastung.json` auf SMB unter `_intern/auslastung.json`; Legacy-Pfad `_intern/auslastung/data.json` wird beim Laden als Fallback berücksichtigt — siehe `loadAuslastungData()`):
```typescript
interface AuslastungData {
  version: 1;
  updatedAt: string;
  config: AuslastungConfig;              // ueberKategorien, gewichtungen, stage2Aktiv, setupAbgeschlossen
  mitarbeiter: Record<string, AnonymerMitarbeiter>;  // Key = anonId (MA01)
  klassifizierungen: Klassifizierung[];  // pro Antrag: vorgeschlagene + freigegebene Kategorien
  zuweisungen: Zuweisung[];              // antragId, anonId, quartal, stunden, status
  kalibrierung?: KalibrierungsState;     // Spearman-Ergebnisse + optimale Confidence-Faktoren
}
```

**Standalone Kompetenz-Onboarding** (`tools/kompetenz-onboarding/`): Single-HTML-Datei (Vanilla-JS + Inline-SheetJS, file://-kompatibel) für neue MAs ohne SMB-Zugang. PL generiert die HTML im Admin (`generateOnboardingHtml`) — Generator liest `template.html` via Vite-`?raw`-Import + injiziert JSON-Blob mit 30-60 Beispiel-Anträgen. MA füllt aus, schickt XLSX zurück, PL importiert via `OnboardingImportDialog` → neuer MA mit `virtuelleProjekte` + Confidence-Faktoren.

**Schema-Erweiterung** (`docs/fixtures/schema-c.ts`): mapped alle 22 ZT-TV-Spalten (`'Digitale W'`, `'Künstliche'`, ...) UND 22 ZT-VB-Spalten (`'Digitale W_1'`, `'Künstliche_1'`, ...) als Custom-Boolean-Felder. Beim Stage-0-Match werden TV und VB gleichwertig ausgewertet — Verbund-Deskriptoren vererben implizit auf alle TVs.

**Sichtbarkeits-Gates**:
- Plugin selbst: `features.auslastung` (default false; in `configs/dev.config.json` true). Andere Variants müssen das Flag aktiv setzen wenn das Modul gewünscht ist.
- Routing: `routes.ts` (`PLUGIN_ROUTES['auslastung']`) + `Router.tsx` (`flatIds` enthält `'auslastung'`) — Pflicht-Einträge, sonst Sidebar-Klick landet auf Home.

**Nicht anfassen**:
- Bestehende Bearbeiter-Filter-Logik im `antraege`-Plugin (das nutzt `bearbeiter_kuerzel` aus dem Profil mit Mehrfach-Kürzel + Begleitungs-Spalten — andere Domain).
- Embedding-Modell-Init: Plugin nutzt den Singleton `embeddingService` aus dem Such-Stack, lädt kein eigenes Modell.

### Legacy: Vorgang-Infrastruktur

`src/core/types/vorgang.ts`, `src/core/components/SimilarCases.tsx`, `src/core/components/VorgangDokumenteTab.tsx`, `src/core/hooks/useVorgangDetail.ts` — Überbleibsel des alten Vorgang-zentrierten Datenmodells. Wird nur noch vom Bauanträge-Plugin (`src/plugins/bauantraege/`) genutzt. **Neue Features verwenden das `Antrag`-Interface aus dem CSV-Schema (`src/core/types/csv/types.ts`), nicht `Vorgang`.**

Auch in dieser Kategorie: `src/core/services/seed/docs/forschung-*.ts` (25 Dateien, gehörten zum alten Forschungs-Demo-Modell). Werden vom Real-Fixtures-Loader (`src/core/services/seed/fixture-loader.ts`) abgelöst — beim nächsten Patch entfernen, NICHT als Referenz für neue Features nutzen.

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
- `configs/demo.config.json` — Showcase-Build, reduzierter Funktionsumfang, synthetische Daten
- `configs/foerderprogramm.config.json` — Produktion Forschungsförderung, fester Daten-Share, OpenRouter **aus**
- `configs/_template.config.jsonc` — kommentierte Referenz (nicht direkt bauen)

Build-Kommandos:

```bash
npm run build:dev            # → dist-single/teamflow-dev.html
npm run build:demo           # → dist-single/teamflow-demo.html
npm run build:foerderprogramm   # → dist-single/teamflow-forschungsfoerderung.html
npm run build:variant -- --config configs/<datei>.config.json   # beliebige Variante
npm run config-ui            # HTML-Konfigurator auf http://localhost:5174
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
10. **Infrastructure-Writes müssen `atomicWrite()` / `appendToFile()` verwenden** (Phase 1a) — direkter `FileSystemWritableFileStream` umgeht die `.tmp`+Rename+`.backup`-Rotation und kann bei Crash korrumpieren
11. **Neue Features hinter Flag setzen** (v1.10) — wenn ein Feature optional sein soll, in `scripts/config-schema.mjs` eine Flag ergänzen, in `src/config/feature-flags.ts` einen Helfer, und die betroffenen Stellen (Plugin-Filter, Komponenten-Rendering) damit gaten. OpenRouter in Prod-Builds wird zusätzlich in `validateConfig()` verboten
12. **Antrag-Status: zwei Domaenen, eine Kategorie** — `AntragListItem.status` traegt entweder Bauantrag-Snake-Case-Werte (`neu`, `in_pruefung`, `genehmigt`, `abgelehnt`, `archiviert`, …) oder Foerderantrag-CSV-Rohwerte (Foyer-Quellsystem: `beantragt`, `VN geprüft`, `NF gestellt`, `bewilligt`, `Schlussvermerk`, `abgelehnt/zurückgezogen`, …). **Strukturelle Sicherung (Mai 2026)**: `Antrag.status`, `AntragListItem.status` und `Verbund.status` sind seit dem Branding-Patch als `AntragStatusRaw = string & { __brand }` typisiert. Direkte Schreib-Aktionen mit String-Literal (`antrag.status = 'bewilligt'`) sind TS-Compile-Errors. An Boundary-Stellen (CSV-Merger, Test-Fixtures, Seed-Loader) wird `asAntragStatusRaw(s)` aufgerufen — kein Branding-Cast im Plugin-Code. Views, Dashboard, Eingangs-Ampel und Workflow-Logik **NIE direkt** gegen einen der Werte-Saetze vergleichen (`status === 'bewilligt'`). Stattdessen die Kategorie-Helper aus [src/core/utils/status-canonical.ts](src/core/utils/status-canonical.ts) nutzen: `isOpenStatus()`, `isBewilligtStatus()`, `isNachforderungStatus()`, `isBegleitungStatus()`, `isClosedStatus()`, `getStatusCategory()`. Hinweis: TypeScript erlaubt `===` zwischen branded und literal noch wegen string-overlap (Sprach-Quirk), aber Helper-Pflicht ist Konvention und schlaegt in PR-Reviews durch. Die Filter-Sidebar ([statusGroups.ts](src/plugins/antraege/filter/statusGroups.ts)) zeigt weiter Foerderantrag-Rohwerte als Phasen-Gruppen — sie ist hiervon unberuehrt. Neuer Foerderantrag-Status: in `statusGroups.ts` UND `status-canonical.ts` UND `status-mappings.ts` ergaenzen. **Wichtig zur Semantik:** (a) Foerderantraege haben keinen final-`abgelehnt`-Endzustand; `Ablehnung`/`Widerruf`/`Anhörung zum Widerruf` zaehlen als Kategorie `entscheidung` (= noch im Verfahren, `isOpenStatus`-true), und der final-negative Pfad geht ueber `abgelehnt/zurückgezogen` (Kategorie `abgeschlossen`). Nur die Bauantrag-Domain hat `abgelehnt` als finalen Endzustand. (b) **Begleit-Phase**: Status-Werte mit Praefix `VN ` (Verwendungsnachweis) oder `ZB ` (Zwischenbericht) zaehlen als Kategorie `begleitung` — die Phase nach Bewilligung und vor Schlussvermerk. Bekannte Vertreter: `VN geprüft`, `VN techn. geprüft`. Unbekannte VN-/ZB-Varianten werden automatisch via Pattern-Fallback (`/^(vn|zb)[\s.]/`) erkannt, neue Spielarten muessen nicht explizit gelistet werden. Zustaendigkeit wechselt von TIB/BIB (Antrag) zu ZTP/PFM (Begleitung). (c) **Bearbeiter-Filter-Toggle `bearbeiter_inkl_begleitung`** steuert NUR welche KUERZ-Spalten gematcht werden — NICHT die Phase. Ohne Toggle: nur TIB/BIB-Spalten. Mit Toggle: zusaetzlich ZTP/PFM-Spalten. Ein TIB-/BIB-Treffer ueberstimmt die Phase: Antraege, bei denen das TIB-/BIB-Kuerzel matched, bleiben sichtbar auch nach Uebergang in die Begleit-Phase (VN-/ZB-Stati). Begruendung: Recherche-Workflows brauchen die Sicht auch auf abgeschlossene/in-Begleitung-uebergegangene eigene Faelle (Textvorlagen aus alten aehnlichen Antraegen). Geaendert Mai 2026, vorher blendete `inkl_begleitung=false` Begleit-Phase pauschal aus. Tests in [src/plugins/antraege/__tests__/](src/plugins/antraege/__tests__/) laufen mit zwei handgeschriebenen Fixture-Saetzen (`seed-antraege.ts` Bauantrag, `real-csv-antraege.ts` Foerderantrag) plus den echten Real-Fixture-CSVs (`realCsvImport.test.ts`) — wenn ein Test mit Bauantrag-Fixture passt aber mit Foerderantrag-Fixture failt, ist genau das ein Domain-Mismatch-Bug.
13. **Foerderantraege-Seeds kommen aus echten CSVs** (v2-Seed, ab Mai 2026) — Die Dev-Seed-Antraege werden nicht mehr in TypeScript handgeschrieben, sondern in [docs/fixtures/](docs/fixtures/) als anonymisierte Real-Foyer-CSVs abgelegt. Der Seed-Loader unter [src/core/services/seed/fixture-loader.ts](src/core/services/seed/fixture-loader.ts) durchlaeuft den vollen `importCsvSource`-Pfad — Bugs im Parser, Column-Mapping oder Merger werden so im Seed-Lauf sichtbar. Schemas (Master + Secondaries via FKZ-Join) sind in `docs/fixtures/schema-*.ts` committet, die CSVs sind via globalem `*.csv`-Pattern in `.gitignore` lokal-only. Fehlende CSVs → Loader returned graceful 0 Antraege, App startet trotzdem. Encoding-Pipeline: `scripts/normalize-fixture-csvs.mjs` konvertiert windows-1252 → UTF-8 idempotent als `prebuild`/`predev`. Migration: Seed-Flag heisst `seed-complete-v2` (Pre-v2 IDBs behalten ihre alten FA-2026-XXX-Antraege als Geister bis manuelles Reset im Kurator-Panel). Neue Fixture-CSV ergaenzen: (1) CSV in `docs/fixtures/` ablegen, (2) `schema-X.ts` schreiben, (3) `FIXTURE_DEFS` in `fixture-loader.ts` ergaenzen.
14. **Toggleable Pills brauchen konstante Breite** (Auslastungs-Modul Lesson) — bei farbcodierten Pills mit aktiv/inaktiv-Toggle (z.B. `KategoriePill` mit `active`-Prop): den optionalen Inhalt (Häkchen ✓) IMMER rendern, im Inaktiv-Modus mit Tailwind-`invisible` (CSS `visibility: hidden`). Sonst horizontaler Layout-Shift in Tabellen. Kontrast aktiv/inaktiv NICHT über `opacity-40` — wirkt wie disabled. Stattdessen Inactive-Variante mit outline-only (siehe [DESIGN_GUIDE.md](DESIGN_GUIDE.md) Kapitel 5 „Toggleable Pill").
15. **Async UI-Aktionen brauchen `try/catch` + sichtbares Error-Banner** (Auslastungs-Modul Lesson) — `try/finally` ohne `catch` + `onClick={() => void asyncFn()}` schluckt Promise-Rejections silent. Unter `file://` ist die Browser-Console oft nicht offen, der User sieht nichts. **Strukturelle Lösung (Mai 2026)**: `useAsyncAction(fn)` aus [src/core/hooks/useAsyncAction.ts](src/core/hooks/useAsyncAction.ts) kapselt das Pattern — liefert `{ run, busy, error, clearError }`, fängt Rejections automatisch und schützt vor Doppelklick. Cheatsheet: [docs/agents/async-error-pattern.md](docs/agents/async-error-pattern.md). Referenz-Migration: [CsvSourcesPage.tsx](src/plugins/csv-sources-kuration/CsvSourcesPage.tsx). Hand-gerolltes try/catch (Pattern: `try { ... } catch (err) { setError(err.message); } finally { setBusy(false); }` + Error-Banner) bleibt fuer Edge-Cases zulässig (z.B. wenn Inline-Validierung vor dem Async-Call läuft). **TODO**: ~10 weitere Vorkommen in `src/plugins/auslastung/` opportunistisch auf den Hook umstellen, sobald das Plugin stabilisiert ist.
16. **Multi-Step-Setup: EIN finaler setState + EIN persist** (Auslastungs-Modul Lesson) — der `useAuslastungData`-Store hat einen `if (saving) return;`-Lock im `persist`. Mehrere parallele `persist`-Aufrufe (z.B. wenn jede `upsertX`-Action ihren eigenen persist triggert) fallen raus → inkonsistenter Save. Im finalen Wizard-Schritt alle Mutationen in EINEM `setState({...})`-Call sammeln, dann EIN `await persist(storage)`. Gleiche Regel gilt für andere Stores mit save-lock-Pattern (`feedbackService`-Sync z.B.).
17. **Auslastungs-AnonymMap nutzt ausschliesslich `tib_kuerz`** — nicht BIB/ZTP/PFM. `buildAnonymMap()` filtert hart auf das `tib_kuerz`-Feld. Ehemalige Bearbeiter (TIBs, die im aktuellen Programm nicht mehr aktiv sind) werden bewusst mitgezählt — deren historische Antraege liefern beim Embedding-Match wertvolle Kompetenz-Referenzen für neue MAs mit ähnlichem Hintergrund. Wer das filtern möchte (z.B. „nur aktive MAs"), muss eine separate Schicht oberhalb der AnonymMap einziehen.
18. **Auslastungs-Modul: nie ohne persistierte kuerzel-map arbeiten** — das alte `buildAnonymMap(antraege)` aus `services/anonym-map.ts` produziert Identitäts-Drift, sobald neue TIB-Kürzel alphabetisch in der Mitte einsortieren (alle nachfolgenden anonIds verschieben sich um +1, aber die Store-Keys `mitarbeiter[anonId]` folgen nicht — Profile werden falsch zugeordnet). Seit dem Drift-Fix (Mai 2026) gilt: immer `useKuerzelMap` (Hook) + `buildAnonymMapFromKuerzelMap` (Service) nutzen. Die persistente Map (`_intern/auslastung-kuerzel-map.json`) wird durch `useAntraegeCache` automatisch synchronisiert (Bootstrap beim ersten Render aus aktuellem alphabetischen Sort, danach append-only für neue Kürzel). Code-Konsumenten brauchen `cache.anonymMap` zu lesen — keine direkten `buildAnonymMap`-Aufrufe mehr außer in Unit-Tests mit expliziten Fixture-Maps. `buildAnonymMap()` ist als `@deprecated` markiert und bleibt nur als Fallback für Edge-Cases / Tests.
19. **Embedding-Modell-Wechsel ist team-weiter Bruch** — wenn ein Kurator das Embedding-Modell via [ActionCardModels.tsx](src/plugins/kurator/actions/ActionCardModels.tsx) wechselt, werden ALLE bestehenden Embedding-Caches strukturell inkompatibel: lokaler Suchindex muss neu gebaut werden, der gespiegelte Auslastungs-Stage-2-Korpus auf SMB (`_intern/auslastung-embedding-corpus.bin`) ist für alle anderen Teammitglieder unbrauchbar bis er von einem PL mit dem neuen Modell neu gebaut wird (~46 min), und die Kategorie-Centroids in `auslastung.json` sind falsch dimensioniert. Die UI zeigt vor dem Wechsel einen Confirm-Dialog mit allen drei Konsequenzen — Wechsel nicht leichtfertig durchführen.
