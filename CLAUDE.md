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
**Every source file MUST stay under 300 lines.** Split larger files into focused modules. This ensures LLM context compatibility and maintainability.

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

### Search Stack
- **Orama**: Hybrid search engine (BM25 fulltext + vector similarity in one DB)
- **Embeddings**: EmbeddingGemma 300M via Transformers.js v4, runs in Main Thread (no Worker under `file://`)
- **Backend**: WebGPU (preferred) or WASM fallback, auto-detected at init
- **Metadata-Extraktion**: LLM-basiert via OpenRouter API oder lokales llama.cpp (Nemotron)
- **Re-Ranker**: Cross-Encoder (PHASE 2, deaktiviert) — Code vorhanden aber nicht aktiv

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
- `FeedbackPanel.tsx` — 3-Step-Wizard (Kategorie → Details → Bestätigung) + optional Chatbot. Bereich-Dropdown statt visuellem Picker.
- `FeedbackChatbot.tsx` — Multi-Turn-LLM-Dialog via `transport.submitConversation()`. Bei Streamlit-Transport: freundliche Meldung + Navigation zu Einstellungen.
- `FeedbackConfirmCard.tsx` — Yes/No auf LLM-generierte JSON-Summary.
- `FaqSuggestions.tsx` — Inline FAQ-Vorschläge bei Kategorie "Frage" (debounced 500ms, Wort-Overlap ≥2, Stoppwörter ignoriert).
- `MyFeedbackList.tsx` — eigener Verlauf (gefiltert nach `user_id == profile.name`).
- `constants.ts` — `TEAMFLOW_AREAS`, Category/Status-Labels + Tailwind-Color-Maps.

**Service-Layer** (`src/core/services/feedback/`):
- `feedbackService.ts` — CRUD: localStorage primär (`teamflow_feedback_items`) + Shared-File-Sync (`feedback/feedback.json` im Datenverzeichnis). Merge-by-id (User-Felder lokal, Admin-Felder shared-wins). FAQ-Helpers (`matchFaqEntries`, `createStandaloneFaq`, `bumpFaqAskCount`).
- `feedbackLlm.ts` — `loadSystemPrompt(storage)` liest `feedback/system-prompt.md` (Fallback `DEFAULT_SYSTEM_PROMPT`). `buildFeedbackSystemPrompt(template, context)` ersetzt `{{PAGE}}`/`{{ROUTE}}`/`{{DEVICE}}`/`{{VIEWPORT}}`/`{{LAST_ACTION}}`/`{{SESSION_MINUTES}}`/`{{ERRORS}}`. 3 Parser portiert verbatim aus Referenz: `parseFeedbackSummary`, `parseBotResponse`, `renderSimpleMarkdown`. `initSystemPromptFile(storage)` schreibt Default-Template ins Datenverzeichnis (Button im Admin-Config-Panel).
- `feedbackContext.ts` — `captureFeedbackContext(activeId, activeName)` + Ring-Buffer für `window.onerror`/`unhandledrejection` (max 5).
- `promptGenerator.ts` — `generateClaudeCodePrompt(ticket)` mit TeamFlow-Constraints-Block (file://, Single-File-Build, Tailwind v4, React 19, Zustand, lucide-react, Deutsche UI, CLAUDE.md primär).

**Admin-Plugin** (`src/plugins/feedback/`, `id: 'feedback-admin'`, `adminOnly: true`):
- `FeedbackAdminPage.tsx` — 4 Tabs (Tickets / FAQ / Sponsoring / Einstellungen) via `@/ui/Tabs`.
- `sections/FeedbackTicketList.tsx` — Filter (Kategorie/Status), Karten-Liste links.
- `sections/FeedbackTicketDetail.tsx` — Status-Dropdown, Priority-Slider, **Aufwand-Dropdown (S/M/L/XL, nur für Ideen)**, **Sponsoring-Fortschritt-Block mit "Schwelle erreicht"-Hinweis**, Notizen, FAQ-Markierung + Antwort + Stichwörter, "Claude Code Prompt generieren" mit Copy + Download .md.
- `sections/FeedbackFaqTab.tsx` — Übersicht aller `is_faq===true` Items + manuell anlegen + bearbeiten + Markierung entfernen + löschen.
- `sections/FeedbackSponsoringOverview.tsx` — Phase 3: Features-Ranking nach Progress, konfigurierbare Schwellen (S/M/L/XL + Hours-Faktor + Budget/Quartal), Budget-Statistik.
- `sections/FeedbackConfigPanel.tsx` — Modell-Dropdown (Default `openai/gpt-oss-120b`), Max-Turns-Slider (2–12), System-Prompt-Pfad + Vorschau + "System-Prompt initialisieren"-Button (nur wenn Datei fehlt), Shared-File Status.

**Öffentliches Board** (Phase 3, `src/plugins/feedback-board/`, `id: 'feedback-board'`, KEIN adminOnly):
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
- `Shell.tsx` filtert `enabledPlugins` → Plugins mit `adminOnly: true` nur sichtbar wenn `profile?.is_admin === true`
- Aktivierung: Onboarding Step 0 (Checkbox) ODER Einstellungen → Profil-Tab → "Admin-Funktionen aktivieren"
- Default: `false` (jeder Nutzer kann sich selbst zum Admin machen — single-user trust model)

**LLM-Transport-Erweiterung** (`src/core/services/ai/transports/`):
- Neue Methode `DirectLLMTransport.submitConversation(messages[], options?)` für Multi-Turn (vorher nur Single-Turn `submitMessage`).
- `AITransport`-Interface erweitert um optionale `submitConversation?(...)` für Feature-Detection.

**NavigationContext-Erweiterung** (`src/core/hooks/useNavigation.ts`):
- `activeId: string` exposed → erlaubt FeedbackPanel, das aktive Plugin für Kontext-Erfassung zu ermitteln.

**Datenverzeichnis-Layout**:
- `feedback/feedback.json` — Shared-Tickets (`SharedFeedbackFile { version: 1, updated_at, items[] }`)
- `feedback/system-prompt.md` — Admin-editierbarer Chatbot-Prompt (Fallback in `feedbackLlm.ts`)

**Bekannte Einschränkungen**:
- Streaming nicht implementiert (Buffer-Mode für Chatbot-Antworten)
- Sync-Konflikt: Last-writer-wins bei concurrent Schreibzugriff auf `feedback.json` (akzeptabel bei niedriger Frequenz)
- Budget (`teamflow_user_budget_v1_{userId}`) liegt in localStorage pro Gerät — User bekommt bei Browserwechsel neues 10-Punkte-Budget (Doppel-Sponsoring-Vektor theoretisch möglich, bei 5-15 User aber kein reales Problem)
- Budget-Statistik im Admin-Tab nur dieser Browser (für team-weite Stats müsste Shared-Storage ergänzt werden — out of scope)

### Referenz-App
In `_reference/lernapp/` liegt eine geklonte Referenz-Implementierung (KI-Prompting-Tutor). Wird NICHT gebaut oder deployed — dient ausschließlich als Code-Referenz für die Portierung von Features (Feedback-System, Onboarding-Tour). Vite ignoriert diesen Ordner (`server.watch.ignored`).

### Datenverzeichnis
Alle geteilten Daten und Config-Dateien liegen im Datenverzeichnis auf dem SMB-Share (NICHT neben der App-HTML). Dort befinden sich:
- Suchindex-Daten (`search-index/`)
- `metadata-server-config.json`
- `feedback/feedback.json` (Multi-User-Tickets)
- `feedback/system-prompt.md` (Admin-editierbarer Chatbot-Prompt)
- Zukünftig: abteilungsspezifische Konfigurationen

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
│   │   ├── useKeyboard.ts       <- Keyboard shortcut registration
│   │   ├── useNavigation.ts     <- Plugin navigation
│   │   ├── useProfile.ts        <- User profile management
│   │   ├── useSearch.ts         <- Search context (Orama + Embedding + Re-Ranker)
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
│   ├── types/
│   │   ├── vorgang.ts           <- Vorgang + Artifact types
│   │   ├── config.ts            <- UserProfile (mit is_admin), AIProviderConfig
│   │   ├── plugin.ts            <- TeamFlowPlugin interface
│   │   ├── feedback.ts          <- FeedbackItem, FeedbackCategory, FeedbackStatus, ChatMsg, etc.
│   │   ├── review.ts
│   │   └── version.ts
│   └── utils/
│       └── status-mappings.ts   <- Zentrale Status-Labels + Badge-Variants
├── plugins/
│   ├── home/                    <- Dashboard
│   ├── bauantraege/             <- Building permit management
│   ├── forschung/               <- Research grant management
│   ├── dokumente/               <- Document browser
│   ├── suche/                   <- Full-text + vector search UI
│   ├── chat/                    <- AI chat interface
│   ├── einstellungen/           <- Settings (profile, theme, AI provider, is_admin toggle)
│   ├── admin/                   <- Admin panel (indexing, eval, smoke test) — adminOnly
│   ├── feedback/                <- Feedback-Verwaltung — adminOnly
│   │   ├── FeedbackAdminPage.tsx    <- 4 Tabs (Tickets / FAQ / Sponsoring / Einstellungen)
│   │   ├── sections/
│   │   │   ├── FeedbackTicketList.tsx
│   │   │   ├── FeedbackTicketDetail.tsx      <- + Aufwand-Dropdown + Sponsoring-Info (Phase 3)
│   │   │   ├── FeedbackFaqTab.tsx
│   │   │   ├── FeedbackSponsoringOverview.tsx <- Phase 3: Features-Ranking + Schwellen-Form + Budget-Stats
│   │   │   └── FeedbackConfigPanel.tsx
│   │   └── index.ts
│   └── feedback-board/          <- Phase 3: Öffentliches Board (KEIN adminOnly)
│       ├── FeedbackBoardPage.tsx
│       └── index.ts
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

## Testing the Build

After any change, verify the single-file build works:

```bash
npm run build:single
# Open dist-single/index.html directly in Chrome (file:// protocol)
# Verify: no console errors, sidebar renders, theme switching works
```

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
