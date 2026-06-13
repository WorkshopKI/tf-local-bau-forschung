# Project Structure

*Last reviewed: 2026-06-04 (v2.18)*

```
src/
├── core/
│   ├── App.tsx                  <- Entry, providers, onboarding check + Start-Gate-Kette (decideAppGate/decideMaGate)
│   ├── ShellLayout.tsx          <- Sidebar + content layout (Render-Gate für Kurator-/CSV-Auto-Refresh)
│   ├── Router.tsx               <- Plugin-Routing (flatIds)
│   ├── ErrorBoundary.tsx        <- React error boundary
│   ├── Onboarding.tsx           <- First-run setup wizard
│   ├── WelcomeScreen.tsx        <- Daten-Share-Pick + expectedFolderName-Validation (v2.0)
│   ├── StartupScreen.tsx        <- Daten-Share-Permission/Re-Pick beim Start (v2.0)
│   ├── OfflineBanner.tsx        <- Nicht-dismissbarer Offline-Hinweis + letztes Snapshot-Datum (v2.0)
│   ├── AppPasswordGate.tsx      <- v2.16: build-time Rollen-Passwort-Wall (pl + kurator), generisch
│   ├── MaLoginGate.tsx          <- v2.11: MA-Login-Wall (Kürzel aus Passwort, prod + dev)
│   ├── KuratorLoginGate.tsx     <- @deprecated v2.16 (abgelöst durch AppPasswordGate); bleibt für KuratorSessionPanel-Referenz
│   ├── components/
│   │   ├── ArtefakteTab.tsx     <- Shared artifact management (both departments)
│   │   ├── SimilarCases.tsx     <- AI-powered similar case suggestions
│   │   ├── VerlaufTab.tsx       <- Workflow history timeline
│   │   ├── VorgangDokumenteTab.tsx <- Document viewer per Vorgang
│   │   ├── DokumentAufnahme.tsx <- v2.68: wiederverwendbare Dokumenten-Aufnahmefläche (Drag&Drop + FKZ-Relation, Verbund-Ebene) + dokumentAufnahmeFkz.ts (pure classifyFkz)
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
│   │   ├── useVorgangDetail.ts  <- Shared Detail-View logic (states, handlers)
│   │   ├── useMAIdentity.ts     <- v2.11: MA-Login-Session (sessionStorage, Key tf-ma-kuerzel)
│   │   ├── useMeinKuerzel.ts    <- v2.11: zentraler Kürzel-Getter (Session > Profilfeld, Pitfall #27)
│   │   └── useAppGateSession.ts <- v2.16: App-Passwort-Gate-Session (sessionStorage, Key tf-app-gate)
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
│   │   ├── skills/              <- v2.68: Gutachten-Skill als Datenstruktur (kurzfassung-skill + parseSkillOutput + checks + transport-agnostischer run-skill) — Registry-ready
│   │   ├── gutachten-vorlagen/  <- v2.68: DOCX-Vorlagen-Füller (fill-template Run-Splitting + Anker + Dry-Run, field-mapping, vorlagen-quelle Handle, save-docx)
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
│   │   │   ├── smb-handle.ts        <- Daten-Share + Persönlich + DMS-Source + User-Folders-Root Handles + ensureFolderStructure
│   │   │   ├── migration.ts         <- v1.9: validateSelectedFolder + migrateLegacyStructure
│   │   │   ├── offline-check.ts     <- Offline-Detection-Helpers
│   │   │   ├── zugang-config.ts     <- v2.11: MA-Login-Zugangsdatei (verifyPasswortAgainstAll, _intern/auslastung-zugang.enc)
│   │   │   ├── zugang-worker.ts     <- v2.11: Passwort-Verify im Worker (?worker&inline) + Main-Thread-Fallback
│   │   │   ├── app-password.ts      <- v2.16: verifyAppPassword (build-time Rollen-Passwort-Verifier)
│   │   │   ├── types.ts             <- AuditEntry, BuildLock, BackupEntry, SessionMeta, KuratorConfigPlain, ZugangsEintrag/-File, FolderValidationResult, Pfad-Konstanten
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
│   │   └── kurzfassung/         <- v2.68: Gutachten-Kurzfassung-Sektion auf Verbund-Ebene (KurzfassungSection/ReviewCard/CheckList/VorlageDialog + useKurzfassung + kv-Store, features.gutachtenKurzfassung)
│   ├── auslastung/              <- Auslastungs-Modul (id='auslastung', features.auslastung-gegated, Tabs Klassifizierung/Zuweisung/Übersicht + Kompetenzen (v2.15), Anonymisierung MA01..MAxx, dreistufiges Matching, Standalone-Onboarding-HTML-Generator)
│   │   ├── views/KompetenzMatrixView.tsx <- v2.15: PL-Kompetenz-Tab (XLSX-Upload + editierbares Grid)
│   │   ├── components/kompetenz/    <- v2.15: zerlegte Matrix-Grid-Komponenten (KompetenzMatrix + MatrixRow/Header/Toolbar/Controls/LevelCell/CapCell)
│   │   └── services/kompetenz-*.ts  <- v2.15: import (XLSX-Parser) + derivation + geometry + codes + matrix-colors
│   ├── bauantraege/             <- Bauanträge-Workflow (id='bauantraege', Vorgang-Typ bauantrag — nur in dev/demo-Variants sichtbar)
│   ├── dokumente/               <- Dokumenten-Browser (id='dokumente', Phase-2-Platzhalter)
│   ├── suche/                   <- Hybrid-Suche-UI (id='suche', Orama + Vector)
│   ├── chat/                    <- AI-Chat (id='chat')
│   ├── feedback-board/          <- Öffentliches Feedback-Board (id='feedback-board', KEIN kuratorOnly)
│   ├── einstellungen/           <- Profil, Theme, AI-Provider, is_kurator-Toggle (id='einstellungen')
│   # Kurator-Plugins (category 'kuration', kuratorOnly: true) — Directory-Name == Plugin-ID
│   ├── kurator/                 <- Suchindex-Kurations-Panel (id='kurator', route /kuration/suchindex)
│   ├── programme-kuration/      <- Programm-Verwaltung inkl. Unterprogramme-Sub-Feature (id='programme-kuration')
│   ├── csv-sources-kuration/    <- CSV-Import-Wizard (id='csv-sources-kuration', 5-Step-Wizard + Label-XLS-Hierarchie; v2.18: csv-source-handle.ts pickAndLinkCsvSource + components/CsvSourceLinkDialog.tsx für pl-Handle-Lücke)
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
│   ├── dev-infrastructure-test/ <- DEV-Test-Harness (id='dev-infrastructure-test', 5+ Panels inkl. Phase-2-Triage)
│   │   ├── DevPanel.tsx
│   │   ├── panels/
│   │   └── index.ts
│   └── dev-state-inspector/     <- DEV-State-Viewer (id='dev-state-inspector', Fixture-Sibling)
├── components/
│   ├── ui/                      <- EINZIGE UI-Bibliothek: shadcn-Primitives + TF-Komponenten (Button, Card, Badge, Tabs, Dialog, SectionHeader, MarkdownRenderer, theme.ts, …)
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
├── ui/                          <- Re-Export-Shim (Kompatibilität, P1b), keine Implementierungen (außer Dialog-Adapter + vorerst TF-Select); re-exportiert aus components/ui/
├── plugins.config.ts            <- Build-time plugin selection
└── main.tsx
```

## Außerhalb von `src/`

- `tools/config-ui/` — Vanilla-JS Build-Konfigurator (siehe `npm run config-ui`)
- `tools/kompetenz-onboarding/` — Standalone-HTML-Template für das Auslastungs-Onboarding (Vanilla-JS + Inline-SheetJS, wird vom Generator-Service über Vite-`?raw`-Import verarbeitet, kein eigener Build-Schritt)
- `_labels/` — Quell-XLSX für CSV-Spalten-Klarnamen + ZT-Themenfeld-Mapping. Wird von `scripts/build-default-labels.mjs` verarbeitet (prebuild-Hook) → `src/plugins/auslastung/services/default-labels.ts`.
- `docs/architecture/` — Tiefen-Dokumentation pro Modul/Layer (dieses Verzeichnis).
- `docs/agents/` — Cheatsheets für wiederkehrende Erweiterungen.
- `docs/fixtures/` — Anonymisierte Real-CSVs für Dev-Seeds (mit `schema-*.ts`-Definitionen).
- `configs/` — Build-Varianten-Configs (`dev`, `demo`, `prod`, `kurator`, `pl`).
- `scripts/` — Build-Scripts (Test-Assets-Generierung, Label-XLSX-Build, Filter-DMS-CSV).
