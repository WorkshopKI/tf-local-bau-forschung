# CLAUDE.md — TeamFlow Local App

## Project Overview

TeamFlow Local is a serverless browser app for collaborative task management with AI integration, deployed exclusively via file server (`file://` protocol). Two departments (building permits / research grants) manage workflows, generate artifacts, and use AI-powered search — all without IT infrastructure.

**Read `DESIGN_GUIDE.md` for visual design rules before making any UI changes.**

## Critical Constraints

- **DEPLOYMENT**: App runs from `file://` protocol — NO HTTP server, NO backend, NO Node.js at runtime
- **SINGLE FILE BUILD**: Production build MUST compile to ONE `index.html` via `vite-plugin-singlefile`
- **NO CHROME FLAGS**: App must work in standard Chrome/Edge without `--allow-file-access-from-files` or any other flags
- **WEB WORKERS**: Must use Vite `?worker&inline` imports (Blob URL) — never `new Worker('./file.js')`
- **NO ES MODULE IMPORTS AT RUNTIME**: Everything must be bundled — `file://` blocks ES module imports
- **NO RELATIVE FETCH**: `fetch('./data.json')` fails under `file://` — all data via IndexedDB or File System Access API
- **NO SERVICE WORKERS**: Not available under `file://`
- **NO localStorage FOR LARGE DATA**: IndexedDB preferred for structured/large data (works under `file://`). localStorage OK for simple flags (e.g., `teamflow_tour_completed`, feedback items, user preferences)

## Tech Stack

- **Framework**: React 19 + ReactDOM + TypeScript
- **Build**: Vite + `vite-plugin-singlefile` + `@vitejs/plugin-react`
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite` — utility classes + CSS custom properties for theming
- **UI Components**: shadcn/ui (Radix, Nova-Preset) — `src/components/ui/` (Button, Textarea, Select, Tabs, Slider, Badge, Switch, Card). Fehlende Komponenten per `npx shadcn@latest add <name>` nachinstallieren
- **State**: Zustand (persisted to IndexedDB)
- **Search**: Orama (BM25 + Vector Hybrid), Transformers.js v4 (EmbeddingGemma 300M), WebGPU/WASM
- **AI Chat**: DirectLLM transport (OpenRouter / local llama.cpp) + Streamlit bridge
- **Icons**: lucide-react (tree-shakeable)

## Architecture Principles

### File Size Limit

Source-Files sollten **300 Zeilen nicht überschreiten**. Begründung: kleinere Files sind lesbarer, testbarer und verhindern kollidierende Patches bei paralleler Arbeit.

**Ausnahmen (explizit erlaubt):**

- **Statische Daten-Files** (z.B. `src/core/services/search/example-docs.ts`, `src/dev-fixtures/fixture-schemas.ts`): Größe ergibt sich aus den Daten, nicht aus Logik-Struktur. Keine Aufteilung nötig.
- **Kohärente State-Machines** (z.B. `src/plugins/csv-sources-admin/wizard/useCsvWizardState.ts`): Eine in sich geschlossene State-Machine ist oft lesbarer als in drei Module aufgeteilt. Aufteilen nur wenn klare logische Grenzen auftauchen.
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

### Storage Dual-Layer
- **IndexedDB**: Fast cache, embedding vectors, ONNX model cache, UI state, FS handle persistence
- **File System Access API**: Permanent storage on shared file server — vorgaenge, artifacts, index, config

### Infrastructure Layer (Phase 1a + v1.9)
Kurator-Session-Verwaltung, SMB-Connectivity-Monitoring und sichere Datei-Operationen. Alle Module in `src/core/services/infrastructure/`, Stores in `src/core/hooks/`.

- **Kurator-Session** (`useKuratorSession`): 12h-TTL-Session mit verschlüsselter Kurator-Config (AES-GCM 256 + PBKDF2-SHA-256 @ 200k Iterations, Web Crypto API). Meta (`expiresAt`, `kuratorName`, `ttlMs`) in IndexedDB persistiert (`KURATOR_SESSION_META_IDB_KEY`, Value-String bleibt `'admin-session-meta'` für Kompat). Aktivität verlängert Session (`useKuratorActivityTracker`). ShellLayout hält Tick-Loop. Actions: `setup`, `activate`, `deactivate`, `extend`, `changePassword`, `rehydrate` (liest Legacy-Feld `adminName` als Fallback).
- **SMB-Handles** (`smb-handle.ts`): Zwei Slots in IDB-Map `smb-handles`: `daten-share` (Hauptordner mit `programm/`, `backups/`, `_intern/`), optional `dokumentenquelle` (separater Handle nur für Kurator-Scan in Phase 2). Legacy-Slot `test-programm` wird beim Lesen als Fallback verwendet.
- **SMB-Connectivity** (`useSmbStatus`): 5-Min-Polling via `probeSmb()`. Status: `online`/`offline`/`unknown`/`denied`. Probe öffnet `_intern/` statt des ehemaligen `admin/`-Subordners. Dev-Panel kann Offline simulieren. Gate `requireOnline()` für Kurator-Aktionen. In-Memory only (keine Persistenz).
- **Atomic Writes** (`atomic-write.ts`): Schreiben über `.tmp`-Datei + Rename zu Ziel; altes Ziel → `.backup` (1-Generations-Rotation). Native `move()` mit Read-Write-Delete-Fallback. Append-Writes (`appendToFile`) überspringen Backup. **Alle Infrastructure-Writes müssen diese Helper verwenden** — direkter `FileSystemWritableFileStream` kann bei Crash korrumpieren.
- **Audit-Log** (`audit-log.ts`): JSONL-Append-Only in `_intern/audit-log.jsonl` (v1.9; vorher `programm-test/admin/audit-log.jsonl`, Legacy-Read-Fallback aktiv). `logAudit({ user, action, details })` / `getRecentAudits(n)`. Session-Events mit neuen Action-Keys `kurator_login`/`kurator_logout`/`kurator_setup`/`kurator_password_changed`. Strukturelle Migration schreibt `kurator_structure_migrated` mit Statistik.
- **Build-Lock** (`build-lock.ts`): Heartbeat-basierter Lock in `_intern/build-lock.json` verhindert parallele Builds. Schema: `{ programm_id, stufe, hostname, kurator_name, gestartet, heartbeat }`. Stale-Detection: Heartbeat > 2h → auto-discard. Actions: `acquireBuildLock`, `forceLock`, `heartbeat`, `releaseLock`. Legacy-Feld `admin_name` wird beim Lesen auf `kurator_name` gemappt.
- **Backup** (`backup.ts`): Wöchentliche Snapshots in `backups/YYYY-MM-DD/` (ab v1.9 direkt am Daten-Share-Root, keine `programm-test/`-Zwischenebene). Rolling 4 Generationen; `deleteOldestBackup()` beim Überlauf. `dokumente/` wird ausgeschlossen (GB-Scale-Files; kommt in Phase 2 in separaten Dokumentenquelle-Handle). `shouldSuggestWeeklyBackup()` als UX-Hint.
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

Kurator-Wizard unter `src/plugins/csv-sources-admin/wizard/` für CSV-Source-Registrierung. 5 Schritte: Metadata → Column-Mapping → (Unterprogramme, nur Master) → Review → Progress. Column-Mapping unterstützt optionalen **hierarchischen Label-XLS-Upload** ([xlsLabelParser](src/core/services/csv/filter/xlsLabelParser.ts)):

- Kurator wählt Anzahl Header-Zeilen (2–8, Default 4). Konvention: letzte Zeile = CSV-Namen, vorletzte = Labels (leer → Fallback CSV-Name), Zeilen darüber = Gruppen-Ebenen (merged cells).
- Vertikal-merged Gruppen-/Label-Zellen → als ambige Merges erkannt. Kurator entscheidet per Dropdown pro Merge (`Als Gruppe` / `Als Label wiederholt` / `Ignorieren`), Bulk-Leiste bei ≥2.
- `ColumnMappingEntry` persistiert `label`, `group_path`, `ambiguous_merge_resolution`; `CsvSchema.label_xlsx_header_rows` für konsistente Re-Imports.
- Wizard-Step 2 rendert die Mapping-Tabelle bei vorhandenem XLS gruppiert (Collapsible-Sections mit `›`-Separator); Fallback auf flache Tabelle wenn kein XLS geladen.
- Antrags-Detail-Ansicht (`/antraege/:aktenzeichen`) zeigt Felder in Gruppen-Abschnitten, „Weitere Felder" am Ende. Merge-Konflikt zwischen Sources: Master → höchste Priority → erste Source mit Pfad.
- `FilterDefinition.display_group` wird beim Erstellen eines Filters aus dem Schema vorgetragen (UI-Gruppierung im Filter-Panel in Folge-Patch).
- Test-Assets: `scripts/generate-test-label-xlsx.mjs` erzeugt 4 XLSX-Varianten (2/3/4 Zeilen + vertikal-merged "Branche") unter `public/test-korpus/bauforschung-v2/`. Läuft als prebuild-Hook.

### Referenz-App
In `_reference/lernapp/` liegt eine geklonte Referenz-Implementierung (KI-Prompting-Tutor). Wird NICHT gebaut oder deployed — dient ausschließlich als Code-Referenz für die Portierung von Features (Feedback-System, Onboarding-Tour). Vite ignoriert diesen Ordner (`server.watch.ignored`).

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
- `backups/YYYY-MM-DD/` — Phase 1a: Wöchentliche Snapshots (Rolling 4 Gen., Daten-Share-Root)
- `README.txt` — Orientierungs-Text (von der App beim Setup angelegt)
- Zukünftig: abteilungsspezifische Konfigurationen, separater Dokumentenquelle-Handle (`smb-handles.dokumentenquelle`) für Scan-Source in Phase 2

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
│       └── status-mappings.ts   <- Zentrale Status-Labels + Badge-Variants
├── plugins/
│   # Nutzer-Plugins (category 'workflow' / 'tools')
│   ├── home/                    <- Dashboard (id='home')
│   ├── antraege/                <- Förderanträge-Liste + Detail (id='antraege', generische Ansicht über CSV-Schema; seit v1.14 konsolidiert inkl. ehem. Forschungs-Fixtures + optionaler AntragDokumentRef[])
│   ├── bauantraege/             <- Bauanträge-Workflow (id='bauantraege', Vorgang-Typ bauantrag)
│   ├── dokumente/               <- Dokumenten-Browser (id='dokumente', Phase-2-Platzhalter)
│   ├── suche/                   <- Hybrid-Suche-UI (id='suche', Orama + Vector)
│   ├── chat/                    <- AI-Chat (id='chat')
│   ├── feedback-board/          <- Öffentliches Feedback-Board (id='feedback-board', KEIN kuratorOnly)
│   ├── einstellungen/           <- Profil, Theme, AI-Provider, is_kurator-Toggle (id='einstellungen')
│   # Kurator-Plugins (category 'kuration', kuratorOnly: true) — Directory-Namen `*-admin/` sind Legacy
│   ├── admin/                   <- Suchindex-Kurations-Panel (id='kurator', route /kuration/suchindex)
│   ├── programme-admin/         <- Programm-Verwaltung (id='programme-kuration')
│   ├── csv-sources-admin/       <- CSV-Import-Wizard (id='csv-sources-kuration', 5-Step-Wizard + Label-XLS-Hierarchie)
│   ├── unterprogramme-admin/    <- Unterprogramm-Verwaltung (id='unterprogramme-kuration')
│   ├── filter-admin/            <- Filter-Verwaltung (id='filter-kuration', 4-Step-Wizard)
│   ├── feedback/                <- Feedback-Verwaltung (id='feedback-kuration', 4 Tabs)
│   │   ├── FeedbackAdminPage.tsx    <- 4 Tabs (Tickets / FAQ / Sponsoring / Einstellungen)
│   │   ├── sections/
│   │   │   ├── FeedbackTicketList.tsx
│   │   │   ├── FeedbackTicketDetail.tsx      <- + Aufwand-Dropdown + Sponsoring-Info (Phase 3)
│   │   │   ├── FeedbackFaqTab.tsx
│   │   │   ├── FeedbackSponsoringOverview.tsx <- Phase 3: Features-Ranking + Schwellen-Form + Budget-Stats
│   │   │   └── FeedbackConfigPanel.tsx
│   │   └── index.ts
│   # Dev-Plugins (nur bei aktiven Dev-Flags sichtbar)
│   ├── dev-infrastructure-test/ <- DEV-Test-Harness (id='dev-infrastructure-test', 4 Panels)
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

Config-Zugriff im Code:

```ts
import { runtimeConfig, buildTime, gitHash } from '@/config/runtime-config';
import { features, isOpenRouterEnabled, isFeedbackEnabled } from '@/config/feature-flags';
```

Plugin-Gating: `src/plugins.config.ts` filtert die Plugin-Liste nach `features.*`; Plugin-Autoren brauchen nichts weiter zu tun, wenn das Plugin `category: 'kuration'` oder eine der bekannten IDs hat. Neue Flags werden dort ergänzt.

## Common Pitfalls

1. **Don't use `import()` for lazy loading** — dynamic imports break under `file://` in single-file builds
2. **Don't use `fetch()` for local assets** — everything must be inlined or from IndexedDB/FSAPI
3. **Don't use `BroadcastChannel` for Streamlit bridge** — cross-origin between `file://` and `http://` fails. Use `postMessage` via `window.open()`
4. **Don't use `navigator.serviceWorker`** — unavailable under `file://`
5. **Web Workers must use `?worker&inline`** — standard Worker constructor fails under `file://`
6. **`crypto.subtle` works under `file://`** — it's a secure context
7. **File System Access API works under `file://`** — it's a secure context
8. **Embedding models run in Main Thread** — Web Workers cannot load ONNX models under `file://` (Blob URL CSP restrictions). This means large models may block the UI briefly during init.
9. **Status-Mappings are zentral** — use `src/core/utils/status-mappings.ts` for all status label/variant lookups, not per-plugin definitions
10. **Infrastructure-Writes müssen `atomicWrite()` / `appendToFile()` verwenden** (Phase 1a) — direkter `FileSystemWritableFileStream` umgeht die `.tmp`+Rename+`.backup`-Rotation und kann bei Crash korrumpieren
11. **Neue Features hinter Flag setzen** (v1.10) — wenn ein Feature optional sein soll, in `scripts/config-schema.mjs` eine Flag ergänzen, in `src/config/feature-flags.ts` einen Helfer, und die betroffenen Stellen (Plugin-Filter, Komponenten-Rendering) damit gaten. OpenRouter in Prod-Builds wird zusätzlich in `validateConfig()` verboten
