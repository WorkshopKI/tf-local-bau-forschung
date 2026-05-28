# CLAUDE.md — TeamFlow Local App

## Project Overview

TeamFlow Local is a serverless browser app for collaborative task management with AI integration, deployed exclusively via file server (`file://` protocol). Two departments (building permits / research grants) manage workflows, generate artifacts, and use AI-powered search — all without IT infrastructure.

**Read `DESIGN_GUIDE.md` for visual design rules before making any UI changes.**

## Ich will… → wo nachsehen

Decision-Tree für häufige Aufgaben. Erst hier nachsehen, **bevor** du die Codebase scannst:

| Aufgabe | Wo nachsehen |
|---------|--------------|
| Plugin / CSV-Feld / Filter / IDB-Store / Feedback-Status / Embedding-Modell / Tab / … anlegen | [docs/agents/](docs/agents/README.md) — passenden Cheatsheet wählen |
| UI-Patch (Komponenten, Farben, Tokens) | [DESIGN_GUIDE.md](DESIGN_GUIDE.md) |
| `file://`-Constraint vergessen? | [docs/agents/file-protocol-pitfalls.md](docs/agents/file-protocol-pitfalls.md) + Critical Constraints unten |
| Bug-Risiko-Check vor Commit | [Common Pitfalls](#common-pitfalls) unten — 23 Items überfliegen |
| Async-UI-Aktion ohne silent-fail | [docs/agents/async-error-pattern.md](docs/agents/async-error-pattern.md) |
| Antrag-Status-Vergleich | Pitfall #12 + [docs/architecture/antrag-status-domaenen.md](docs/architecture/antrag-status-domaenen.md) |
| Datei-Pfade auf SMB-Share | [docs/architecture/data-layout.md](docs/architecture/data-layout.md) |
| Source-Tree (welche Datei gehört wo?) | [docs/architecture/project-structure.md](docs/architecture/project-structure.md) |
| Infrastructure-Layer-Internals | [docs/architecture/infrastructure-layer.md](docs/architecture/infrastructure-layer.md) |
| Auslastungs-Modul (Klassifizierung + Matching) | [docs/architecture/auslastung.md](docs/architecture/auslastung.md) |
| Feedback-System (FAB + Board + Sponsoring) | [docs/architecture/feedback-system.md](docs/architecture/feedback-system.md) |
| Phase-2 Triage + Review-Queue | [docs/architecture/phase2-triage.md](docs/architecture/phase2-triage.md) + [phase2-review-queue.md](docs/architecture/phase2-review-queue.md) |
| v2.0 Handle-Architektur (Offline-Modus, Feedback-Outbox) | [docs/architecture/v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md) |
| Storage / Search / Theming / Onboarding-Tour | [docs/architecture/runtime-layers.md](docs/architecture/runtime-layers.md) |

## Ignorierte Verzeichnisse

Folgende Pfade NICHT lesen oder referenzieren beim Arbeiten am Code:

- `_archive/` — Historische Architektur-Docs, erledigte Audits, überholte Test-Daten. Enthält die alte MVP-Architektur (postMessage-AI-Bridge, Vorgang-zentriertes Datenmodell, "Admin"-Terminologie) und führt bei aktuellem Code zu falschen Annahmen. Ein Agent, der hier sucht, bekommt mit hoher Wahrscheinlichkeit überholte Guidance.
- `node_modules/`, `dist*/`, `.vite/` — Build-Artefakte.
- `_reference/` — externe Referenz-Apps und Mockup-Bilder, nicht Teil von TeamFlow. Wird von Vite (`server.watch.ignored`) ignoriert.

## Agent-Cheatsheets

Wiederkehrende Erweiterungen haben jeweils mehrere Touch-Points, die synchron gepflegt werden müssen. Vor dem Patchen das passende Cheatsheet öffnen statt die Codebase neu zu scannen:

- [docs/agents/add-plugin.md](docs/agents/add-plugin.md) — Neues Plugin registrieren
- [docs/agents/add-csv-field.md](docs/agents/add-csv-field.md) — Neues `CanonicalField`
- [docs/agents/add-csv-field-type.md](docs/agents/add-csv-field-type.md) — Neuer `FieldType` für CSV-Wert-Koerzion
- [docs/agents/add-doc-type.md](docs/agents/add-doc-type.md) — Neuer Phase-2 doc_type
- [docs/agents/add-feature-flag.md](docs/agents/add-feature-flag.md) — Neuer Build-Time-Flag
- [docs/agents/add-idb-store.md](docs/agents/add-idb-store.md) — Neuer IndexedDB-Store
- [docs/agents/add-auslastung-tab.md](docs/agents/add-auslastung-tab.md) — Neuer Tab im Auslastungs-Plugin
- [docs/agents/add-view.md](docs/agents/add-view.md) — Neue View in `src/plugins/antraege/views.ts`
- [docs/agents/add-filter-facet.md](docs/agents/add-filter-facet.md) — Neue Filter-Facet in der Filter-Sidebar
- [docs/agents/add-phase2-stage.md](docs/agents/add-phase2-stage.md) — Neue Stage in der Triage-Pipeline
- [docs/agents/add-feedback-status.md](docs/agents/add-feedback-status.md) — Neuer `FeedbackStatus`-Wert
- [docs/agents/add-embedding-model.md](docs/agents/add-embedding-model.md) — Neues Embedding-Modell registrieren
- [docs/agents/add-sidecar-persistence.md](docs/agents/add-sidecar-persistence.md) — Sidecar-Datei auf SMB-Daten-Share spiegeln
- [docs/agents/add-build-script.md](docs/agents/add-build-script.md) — Neues Build-Script / Prebuild-Hook anlegen
- [docs/agents/async-error-pattern.md](docs/agents/async-error-pattern.md) — Async-UI-Aktion mit Error-Handling (`useAsyncAction`)
- [docs/agents/optimize-remount-latency.md](docs/agents/optimize-remount-latency.md) — Re-Mount-Latenz eines Plugins optimieren
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
- **UI Components**: shadcn/ui (Radix, Nova-Preset) — `src/components/ui/`. Fehlende Komponenten per `npx shadcn@latest add <name>` nachinstallieren
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

Konkrete Stellen, die unter diese Regel fallen und aufzuteilen wären, werden **nicht proaktiv** refactored — sondern **opportunistisch**: wenn ein Patch die Datei ohnehin anfasst, gleich aufteilen. Die Top-10 oversized Files tragen seit v2.3 einen `// TODO(refactor v2.4+)`-Header mit Split-Vorschlag.

### Plugin System

Every major feature is a plugin in `src/plugins/{name}/`. Each plugin exports a `TeamFlowPlugin` object mit `id`, `name`, `icon`, `category` (`'workflow' | 'tools' | 'kuration'`), `order`, `component`. Optional: `kuratorOnly`, `badge: () => number | null`, `onInit`, `route`, `featureFlag`. Plugins are registered in `src/plugins.config.ts`.

Schritt-für-Schritt-Anleitung für ein neues Plugin: [docs/agents/add-plugin.md](docs/agents/add-plugin.md). Plugin-Init-Hook (`onInit`)-Pattern: [docs/architecture/runtime-layers.md](docs/architecture/runtime-layers.md).

### Infrastructure Layer (Phase 1a + v1.9)

Kurator-Session, SMB-Handles, Atomic-Writes, Audit-Log, Build-Lock, Backup, Migration — alle in [src/core/services/infrastructure/](src/core/services/infrastructure/). Stores in [src/core/hooks/](src/core/hooks/).

**Alle Infrastructure-Writes müssen `atomicWrite()` / `appendToFile()` verwenden** (siehe Pitfall #10). Pfad-Konstanten + Sidecar-Layout: [docs/architecture/data-layout.md](docs/architecture/data-layout.md). Detail zu Session, Migration, Welcome-Screen, Dev-Plugin-Panels: [docs/architecture/infrastructure-layer.md](docs/architecture/infrastructure-layer.md).

### Storage, Search, Theming, Onboarding

Cross-Cutting-Layers (IndexedDB + File-System-Access-API, Orama-Hybrid-Search mit EmbeddingGemma, CSS-Custom-Properties-Theming, 5-Schritt-Onboarding-Tour): [docs/architecture/runtime-layers.md](docs/architecture/runtime-layers.md).

### Feedback-System

Integriertes User-Feedback + Kurator-Dashboard + öffentliches Board mit Sponsoring (Phase 1+2+3 komplett). 4 Touchpoints: globaler FAB in `src/components/feedback/`, Service-Layer in `src/core/services/feedback/`, Kurator-Plugin `src/plugins/feedback/` (id `feedback-kuration`), öffentliches Board `src/plugins/feedback-board/` (id `feedback-board`).

Detail (Datenmodell, Sponsoring-Logik, Komponenten-Liste): [docs/architecture/feedback-system.md](docs/architecture/feedback-system.md). Neue Status-Werte: [docs/agents/add-feedback-status.md](docs/agents/add-feedback-status.md).

### CSV-Import-Wizard + Verbund-Aggregation

5-Step Kurator-Wizard für CSV-Sources mit optionalem hierarchischem Label-XLS-Upload. Verbund-Aggregation bündelt Teilanträge unter gemeinsamer Projektbeschreibung.

Detail (Schritte, Merge-Konflikte, Test-Assets): [docs/architecture/csv-import.md](docs/architecture/csv-import.md). Neue Standardspalte: [docs/agents/add-csv-field.md](docs/agents/add-csv-field.md). Neuer Wert-Typ: [docs/agents/add-csv-field-type.md](docs/agents/add-csv-field-type.md).

### Phase-2 Triage- & Matcher-Baustein (`src/phase2/`)

Eingangsfilter für die DMS-Dokumenten-Pipeline: pro Datei wird kaskadiert entschieden (relevant?, doc_type?, zugehöriger Antrag?). 4-Stage-Kaskade (DMS-CSV-Lookup → strukturell → Keywords → Nemotron-LLM), Matcher gegen IDB-Stores `antraege` + `akronym_index`, Skip-Liste mit `classifier_version`-Reset, Pending-Bucket für Projektbeschreibungen ohne Match. Multi-Source-Indexierung über das DMS-Quellen-Plugin (v1.15).

Details (Build-Config `runtimeConfig.scan`, Vorfilter-Script, FKZ-Regex, Eval-Suite): [docs/architecture/phase2-triage.md](docs/architecture/phase2-triage.md).

### Phase-2 Review-Queue UI (`src/plugins/dokument-review/`)

Kurator-Plugin (`id: 'dokument-review'`, `kuratorOnly: true`, sichtbar wenn `features.dokumentenscan === true`) für die Bearbeitung der Phase-2-Triage-Ergebnisse. 50/50-Split-Layout, 5 Override-Aktionen, Keyboard-Shortcuts (`j/k/n/i/r/a`), Auto-Cleanup-Heuristiken.

Details (Layout, Hook-Liste, Filter/Sort, Auto-Cleanup-Regeln, Anti-Patterns): [docs/architecture/phase2-review-queue.md](docs/architecture/phase2-review-queue.md).

### Auslastungs-Modul (Plugin "auslastung", v2.2)

Plugin (`id: 'auslastung'`, `category: 'workflow'`, sichtbar wenn `features.auslastung === true`) für automatische Antrags-Klassifizierung in Überkategorien + MA-Zuweisung mit dreistufigem Matching (Stage 0 Boolean-Match → Stage 1 Regel-Mapping → Stage 2 Embedding-Centroid). Quartalsbasierte Kapazitäts-Planung.

**Datenschutz-Kernprinzip**: MAs nur als anonyme IDs (MA01-MAxx) sichtbar; echte TIB-Kürzel nur im RAM während passwortgeschütztem XLSX-Export. Sidecar `_intern/auslastung-kuerzel-map.json` ist append-only Klartext-Map (Pitfall #18). Aktiv/Inaktiv-Flag pro MA filtert UI + Matching (inaktive MAs bleiben aber im Embedding-Corpus als Kompetenz-Referenz). Stage-2-Korpus wird auf SMB-Share gespiegelt (Cold-Start: 46 min → Download).

Datenmodell + Klassifizierungs-Schema + Workflow-Revisionen + Standalone-Onboarding-HTML + Build-Pipeline: [docs/architecture/auslastung.md](docs/architecture/auslastung.md). Neuer Tab: [docs/agents/add-auslastung-tab.md](docs/agents/add-auslastung-tab.md).

### Legacy: Vorgang-Infrastruktur

`src/core/types/vorgang.ts`, `src/core/components/SimilarCases.tsx`, `src/core/components/VorgangDokumenteTab.tsx`, `src/core/hooks/useVorgangDetail.ts` — Überbleibsel des alten Vorgang-zentrierten Datenmodells. Wird nur noch vom Bauanträge-Plugin (`src/plugins/bauantraege/`) genutzt, das laut Sichtbarkeits-Matrix nur in `dev`- und `demo`-Variants in der Sidebar erscheint (in `prod`/`kurator`/`pl` toter Pfad). **Neue Features verwenden das `Antrag`-Interface aus dem CSV-Schema (`src/core/types/csv/types.ts`), nicht `Vorgang`. Patches für `prod`/`kurator`/`pl` brauchen Vorgang-Code nicht anzufassen.**

### Referenz-App

Historische Referenz-Implementierung lag unter `_reference/lernapp/` — seit dem Cleanup in `_archive/_reference/lernapp/`. Nicht für neue Features als Vorbild verwenden.

### Datenverzeichnis + Source-Tree

- SMB-Daten-Share-Layout (`programm/`, `_intern/`, `backups/`, Sidecars): [docs/architecture/data-layout.md](docs/architecture/data-layout.md).
- Source-Tree mit Verantwortlichkeiten pro Datei: [docs/architecture/project-structure.md](docs/architecture/project-structure.md).

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
- shadcn/ui Komponenten für Standard-UI-Elemente — Import via `@/components/ui/...`
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
- `configs/_shared.json` (v2.0.2) — **Org-weite invariante Defaults** (aktuell: `data.fixedDataSharePath` + `data.expectedFolderName`). `build-with-config.mjs` + `vite.config.ts` mergen diese Datei mit der Variant-Config via `deepMerge` aus [scripts/config-schema.mjs](scripts/config-schema.mjs).

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

Beim MAJOR-Bump zusätzlich: Migrations-Notiz in CLAUDE.md ergänzen (analog v1.9-Block in [docs/architecture/infrastructure-layer.md](docs/architecture/infrastructure-layer.md)), und sicherstellen dass `migrateLegacyStructure()` (oder Pendant) die alte Struktur erkennt.

### v2.0 — 2-Handle-Architektur (Persoenlicher Ordner + Offline-Modus + Feedback-Inbox)

MAJOR-Bump v2.0 erzwingt Re-Pick beim Start. Neuer Handle-Slot `SMB_HANDLE_PERSOENLICH` pro User für `teamflow/{profile,einstellungen}.json` + Feedback-Outbox. Nicht-Kurator-Daten-Share-Handle wird automatisch von `readwrite` auf `read` heruntergestuft. Details: [docs/architecture/v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md).

## Common Pitfalls

> **Hinweis zur Nummerierung**: append-only. Niemals umnummerieren — Querverweise (in Code-Kommentaren, anderen Docs, Commit-Messages) werden sonst ungültig. Wer einen Pitfall für überholt hält, markiert ihn mit *„(überholt seit vX.Y, siehe …)"* statt ihn zu löschen.

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
15. **Async UI-Aktionen: `useAsyncAction` ist Standard** — `try/finally` ohne `catch` + `onClick={() => void asyncFn()}` schluckt Promise-Rejections silent. Unter `file://` ist die Browser-Console oft nicht offen, der User sieht nichts. **Pflicht für neuen Code**: `useAsyncAction(fn)` aus [src/core/hooks/useAsyncAction.ts](src/core/hooks/useAsyncAction.ts) — liefert `{ run, busy, error, clearError }`, fängt Rejections automatisch und schützt vor Doppelklick. Cheatsheet: [docs/agents/async-error-pattern.md](docs/agents/async-error-pattern.md). Referenz-Migration: [CsvSourcesPage.tsx](src/plugins/csv-sources-kuration/CsvSourcesPage.tsx). Hand-gerolltes try/catch (Pattern: `try { ... } catch (err) { setError(err.message); } finally { setBusy(false); }` + Error-Banner) bleibt fuer Edge-Cases zulässig (z.B. wenn Inline-Validierung vor dem Async-Call läuft). **Bestehender Code**: Grep nach `onClick={() => void` zeigt ~50 ältere Vorkommen (vor allem in `src/plugins/auslastung/` + `src/plugins/dev-infrastructure-test/`). Diese sind opportunistisch zu migrieren — wenn die Datei ohnehin angefasst wird, dabei mitnehmen.
16. **Multi-Step-Setup: EIN finaler setState + EIN persist** (Auslastungs-Modul Lesson) — der `useAuslastungData`-Store hat einen `if (saving) return;`-Lock im `persist`. Mehrere parallele `persist`-Aufrufe (z.B. wenn jede `upsertX`-Action ihren eigenen persist triggert) fallen raus → inkonsistenter Save. Im finalen Wizard-Schritt alle Mutationen in EINEM `setState({...})`-Call sammeln, dann EIN `await persist(storage)`. Gleiche Regel gilt für andere Stores mit save-lock-Pattern (`feedbackService`-Sync z.B.). Verallgemeinerung siehe Pitfall #20.
17. **Auslastungs-AnonymMap nutzt ausschliesslich `tib_kuerz`** — nicht BIB/ZTP/PFM. `bootstrapKuerzelMap()` filtert hart auf das `tib_kuerz`-Feld. Ehemalige Bearbeiter (TIBs, die im aktuellen Programm nicht mehr aktiv sind) werden bewusst mitgezählt — deren historische Antraege liefern beim Embedding-Match wertvolle Kompetenz-Referenzen für neue MAs mit ähnlichem Hintergrund. Wer das filtern möchte (z.B. „nur aktive MAs"), muss eine separate Schicht oberhalb der AnonymMap einziehen.
18. **Auslastungs-Modul: AnonymMap kommt aus der persistenten kuerzel-map** — die Sidecar-Datei `_intern/auslastung-kuerzel-map.json` ist append-only: einmal vergebene anonIds bleiben stabil, neue Kürzel hängen hinten an (kein Identitäts-Drift bei alphabetischer Mitten-Insertion). Code-Konsumenten lesen `cache.anonymMap` aus [useAntraegeCache.ts](src/plugins/auslastung/hooks/useAntraegeCache.ts) bzw. nutzen [`useKuerzelMap`](src/plugins/auslastung/hooks/useKuerzelMap.ts) + [`buildAnonymMapFromKuerzelMap`](src/plugins/auslastung/services/kuerzel-map.ts). Unit-Tests: `buildAnonymMapForTests(antraege)` aus [`__tests__/test-helpers.ts`](src/plugins/auslastung/__tests__/test-helpers.ts) (intern: `bootstrapKuerzelMap` + `buildAnonymMapFromKuerzelMap` — derselbe Code-Pfad wie Prod).
19. **Embedding-Modell-Wechsel ist team-weiter Bruch** — wenn ein Kurator das Embedding-Modell via [ActionCardModels.tsx](src/plugins/kurator/actions/ActionCardModels.tsx) wechselt, werden ALLE bestehenden Embedding-Caches strukturell inkompatibel: lokaler Suchindex muss neu gebaut werden, der gespiegelte Auslastungs-Stage-2-Korpus auf SMB (`_intern/auslastung-embedding-corpus.bin`) ist für alle anderen Teammitglieder unbrauchbar bis er von einem PL mit dem neuen Modell neu gebaut wird (~46 min), und die Kategorie-Centroids in `auslastung.json` sind falsch dimensioniert. Die UI zeigt vor dem Wechsel einen Confirm-Dialog mit allen drei Konsequenzen — Wechsel nicht leichtfertig durchführen. Cheatsheet für das *Hinzufügen* eines Modells (ohne Aktivierung): [docs/agents/add-embedding-model.md](docs/agents/add-embedding-model.md).
20. **Auslastungs-Store: Multi-Mutation in EINEM `setState` + EINEM `persist`** — Verallgemeinerung von Pitfall #16. Jede zusammengehörende Mutationsserie (Import + Klassifizierung + Zuweisung, oder Setup-Wizard-Abschluss) muss alle Mutationen in einem finalen `setState({...})`-Block sammeln, gefolgt von EINEM `await persist(storage)`. Mehrere parallele `persist`-Aufrufe (z.B. eine pro Action) fallen durch den `if (saving) return;`-Lock im Store, was zu inkonsistenten Saves führt. In der Git-History sichtbar als wiederkehrende „doppelte Zeilen"-Fixes. Gleiche Regel gilt für andere Stores mit Save-Lock-Pattern (z.B. `feedbackService`-Sync).
21. **Feedback-Status nicht als String-Literal vergleichen** — Analog Pitfall #12 (Antrag-Status), aber für die Feedback-Domain. `if (item.kurator_status === 'geplant')` ist refactor-fragil (Tippfehler, IDE-Rename-Lücke, Status-Rename übersieht Stellen). Stattdessen Konstanten/Helper aus [src/components/feedback/constants.ts](src/components/feedback/constants.ts) verwenden (`STATUS_LABELS`, `STATUS_COLORS`). Beim Hinzufügen eines neuen Status: Cheatsheet [docs/agents/add-feedback-status.md](docs/agents/add-feedback-status.md). Optional als Convention-Test `no-direct-feedback-status-compare` analog `no-direct-status-compare` in [src/__tests__/codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts) einziehen.
22. **Unicode-Kürzel (THÜ/BIB/ZTP) immer NFC-normalisieren** — Umlaut-Kürzel kommen in IDB/JSON je nach Browser/OS in NFC oder NFD an. Wer Kürzel in der `kuerzel-map` speichert oder daraus liest, muss `s.normalize('NFC')` durchlaufen (`bootstrapKuerzelMap()` in [src/plugins/auslastung/services/kuerzel-map.ts](src/plugins/auslastung/services/kuerzel-map.ts)), sonst silent-mismatch in `findAnonId(kuerzel)` und doppelter `anonId`-Eintrag für „THÜ" vs „THÜ". Tritt v.a. bei manuellen Imports aus Excel oder beim Onboarding-XLSX-Upload auf. Test-Helper: `__tests__/test-helpers.ts:buildAnonymMapForTests()` läuft denselben Pfad wie Prod.
23. **Sidecar-Dateien: Schreib-Profil bewusst wählen** — Kombiniert mit Pitfall #10. Drei Profile, je nach Datei-Charakter:
    - **Idempotent-overwrite** (Standard, Single-Source-of-Truth): `atomicWrite()` mit Backup-Rotation. Beispiel: `_intern/auslastung.json`, `_intern/feedback/feedback.json`.
    - **Append-only** (immutable History, Order matters): `appendToFile()` ohne Rotation, mit Version-Feld im Schema. Beispiel: `_intern/audit-log.jsonl`, `_intern/auslastung-kuerzel-map.json` (Pitfall #18 erzwingt diese Append-Semantik).
    - **Atomic ohne Backup** (große Binär-Files, Recovery via Re-Build): `atomicWrite(..., { skipBackup: true })`. Beispiel: `_intern/auslastung-embedding-corpus.bin` (~40 MB; Backup-Rotation würde die Share-Quota fluten).
    Entscheidung beim Anlegen einer neuen Sidecar als Header-Kommentar in der Datei festhalten. Cheatsheet [docs/agents/add-sidecar-persistence.md](docs/agents/add-sidecar-persistence.md) erweitern, wenn neue Profile dazukommen.
