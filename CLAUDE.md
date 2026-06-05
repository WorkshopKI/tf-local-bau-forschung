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

[#file-size-limit](#file-size-limit)

**Kohäsion vor Zeilenzahl.** Eine Datei soll **eine kohärente Verantwortung** haben — nicht eine bestimmte Zeilenzahl treffen. Die Leitfrage beim Review ist „tut diese Datei mehr als eine Sache?", nicht „hat sie mehr als N Zeilen?".

Ab **~400–500 Zeilen** lohnt ein prüfender Blick: Vermischt die Datei mehrere Verantwortlichkeiten? Falls ja → entlang dieser Grenzen aufteilen. Falls nein (eine kohärente Einheit) → so lassen. Die Zeilenzahl ist ein **Prüf-Hinweis, kein hartes Limit**. Begründung: kleinere Files sind oft lesbarer, testbarer und verhindern kollidierende Patches bei paralleler Arbeit — aber das gilt nur, solange die Aufteilung echten logischen Grenzen folgt. Moderne Coding-Agents halten 400–500 Zeilen problemlos im Arbeitskontext; die früher harte 300-Zeilen-Grenze ist überholt.

**Niemals splitten, nur um eine Zahl zu treffen.** Künstliches Aufteilen einer zusammenhängenden Einheit zerreißt Logik, erzeugt Fragmentierung und verschlechtert die Lesbarkeit. Wenn ein Refactoring-Tool eine kohärente Datei allein wegen der Zeilenzahl als „Optimierungspotential" meldet, ist das ein Fehlalarm — ignorieren.

**Kohärente Einheiten dürfen größer sein (Beispiele):**

- **Statische Daten-Files** (z.B. `src/core/services/search/example-docs.ts`, `src/dev-fixtures/fixture-schemas.ts`): Größe ergibt sich aus den Daten, nicht aus Logik-Struktur. Keine Aufteilung nötig.
- **Kohärente State-Machines** (z.B. `src/plugins/csv-sources-kuration/wizard/useCsvWizardState.ts`): Eine in sich geschlossene State-Machine ist oft lesbarer als in drei Module aufgeteilt. Aufteilen nur wenn klare logische Grenzen auftauchen.
- **Orchestrator-Services** (z.B. `src/core/services/search/batch-indexer.ts`): Ein Service, der eine Pipeline von 8–10 Schritten orchestriert, darf länger sein — solange die einzelnen Schritte klar trennbar bleiben.


**Trotzdem aufteilen (echte Mehrfach-Verantwortung):**

- UI-Komponenten: eine Komponente pro Verantwortlichkeit.
- Multi-Step-Wizards als einzelne JSX-Komponente: Step-Sub-Komponenten extrahieren (`Step1Meta`, `Step2Mapping`, …).
- Services die mehrere Domains abdecken (z.B. CRUD + Sync + FAQ in einem Service): Domain-spezifische Services trennen.


Aufgeteilt wird **nicht proaktiv**, sondern **opportunistisch**: wenn ein Patch die Datei ohnehin anfasst und eine echte Mehrfach-Verantwortung sichtbar wird, gleich aufteilen. Die Top-10 oversized Files tragen seit v2.3 einen `// TODO(refactor v2.4+)`-Header mit Split-Vorschlag — diese sind Kandidaten für eine echte logische Trennung, nicht für ein Splitten nach Zeilenzahl.

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
| Suche | ✓ | ✓ | – | ✓ | ✓ | ✓ |
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

**Feature-Flags `features.maLogin` / `features.maVerwaltungPasswort`** (v2.11, beide default false): `maLogin` (nur `prod` + `dev`) erzwingt beim Start die MA-Login-Wall — das Bearbeiter-Kürzel wird aus dem persönlichen Passwort entschlüsselt; zentraler Getter `useMeinKuerzel` (Pitfall #27), Detail im v2.11-Abschnitt unten. `maVerwaltungPasswort` (nur `pl` + `dev`, braucht `datenShareSchreibrecht` — sonst Build-Warnung via `validateConfig()`) blendet in der MA-Verwaltung „Zugangspasswort generieren" ein.

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

### v2.10 — Kurator-Login-Wall beim App-Start (Mai 2026)

> **Abgelöst durch v2.16** (siehe unten): Die Start-Gate-Logik läuft heute über das build-time Rollen-Passwort-Gate [AppPasswordGate](src/core/AppPasswordGate.tsx) + `isAppGateRequired()`. `KuratorLoginGate` ist deprecated; das Flag `features.requireKuratorLogin` bleibt nur als Legacy-Config-Feld (Deprecation-Warnung in `validateConfig`, [scripts/config-schema.mjs](scripts/config-schema.mjs)). Der TS-Helper `isKuratorLoginRequired()` wurde entfernt (war ohne Aufrufer). Block bleibt als Historie (append-only).

MINOR-Bump v2.10: Die **kurator-Variante** erzwingt beim Start einen Kurator-Login. Neuer Build-Flag `features.requireKuratorLogin` (nur in [configs/kurator.config.json](configs/kurator.config.json) `true`; dev hat zwar `kuratorMenus`, aber keine Wall — Auto-Kurator via Fixtures). Nach dem `StartupScreen` (Daten-Share-Permission steht, damit `kurator-config.enc` lesbar ist) entscheidet `decideKuratorGate` in [App.tsx](src/core/App.tsx): gültige rehydrierte Session → direkt App; konfiguriert + keine Session → **Pflicht-Login** via [KuratorLoginGate](src/core/KuratorLoginGate.tsx) (setzt bei Erfolg `profile.is_kurator` = Menüs frei + aktiviert die Session + stuft den Daten-Share-Handle per `refreshAllPermissions({isKurator:true})` auf `readwrite` hoch, vgl. Pitfall #25); nicht konfiguriert / offline (`isKuratorConfigured`=false) → still übersprungen. Da `kurator-config.enc` auf dem geteilten Daten-Share liegt, ist „konfiguriert" team-weit nach dem ersten Setup immer wahr. Additiv, keine Migration; dev/prod/pl/demo unverändert (`requireKuratorLogin: false`).

### v2.11 — MA-Login via Passwort (Kürzel-Ableitung) (Juni 2026)

MINOR-Bump v2.11: Die **prod-Variante** erzwingt beim Start eine MA-Login-Wall. Neuer Build-Flag `features.maLogin` (nur `prod` + `dev` `true`; demo/kurator/pl `false`). Das Bearbeiter-Kürzel wird nicht mehr frei im Profil getippt, sondern aus dem **persönlichen Passwort entschlüsselt** (Decrypt = Auth, kein Hash-Vergleich) — das verhindert beiläufiges Fremd-Eintragen durch normale User. Pro MA liegt in `_intern/auslastung-zugang.enc` ein eigenes Salt + AES-GCM-verschlüsseltes Kürzel (selbe Krypto wie `kurator-config.enc`, [crypto.ts](src/core/services/infrastructure/crypto.ts) wiederverwendet) + pseudonyme `anonId` für sauberes Replace/Revoke; kein Klartext-Kürzel/-Passwort/-Hint. `verifyPasswortAgainstAll` ([zugang-config.ts](src/core/services/infrastructure/zugang-config.ts)) probiert das eingegebene Passwort gegen alle Einträge durch (Early-Exit) — im Web Worker (`?worker&inline`, [zugang-worker.ts](src/core/services/infrastructure/zugang-worker.ts)) mit Main-Thread-Fallback. Nach dem `StartupScreen` (Daten-Share-Permission steht, damit die Zugangsdatei lesbar ist) entscheidet `decideMaGate` in [App.tsx](src/core/App.tsx): Flag aus → keine Wall; rehydrierte sessionStorage-Session (Same-Tab-Reload) → direkt App; Zugangsdatei vorhanden + nicht angemeldet → **Pflicht-Login** via [MaLoginGate](src/core/MaLoginGate.tsx); **Zugangsdatei fehlt → übersprungen** (sanfter Rollout: solange `_intern/auslastung-zugang.enc` nicht existiert, bleibt das alte editierbare Kürzelfeld aktiv). Mutual-exclusive zur Kurator-Wall (prod hat `maLogin`, kurator `requireKuratorLogin` — nie beides; `validateConfig()` warnt sonst). Session in `sessionStorage` ([useMAIdentity](src/core/hooks/useMAIdentity.ts), Key `tf-ma-kuerzel`): abgelegt wird NUR das **Kürzel**, nie Passwort/Key; TTL = Browser-Tab (Login pro Arbeitstag). Zentraler Getter [useMeinKuerzel](src/core/hooks/useMeinKuerzel.ts) (Session > Profilfeld) — alle Kürzel-Konsumenten lesen darüber statt `profile.bearbeiter_kuerzel` direkt (Pitfall #27); das Profil-Kürzelfeld ist im Login-Modus read-only. Die **PL** (pl-Variante, Flag `features.maVerwaltungPasswort`, nur `pl` + `dev`, braucht `datenShareSchreibrecht`) erzeugt im MA-Bearbeiten-Tab Passwörter (pro MA + Batch „für alle aktiven MAs", auf eine aktive De-Anon-Session gated) via [ZugangPasswortSection](src/plugins/auslastung/components/ZugangPasswortSection.tsx) + 2-Wort-Passphrase und zeigt das generierte Klartext-Passwort einmalig im PasswortAnzeigeDialog. Additiv, keine Migration; demo/kurator unverändert (`maLogin: false`).

### v2.15 — PL-Kompetenz-Vorbelegung per XLSX + editierbare Matrix (Juni 2026)

MINOR-Bump v2.15: Die **PL** lädt eine Kompetenz-XLSX (pro TIB-Kürzel: Antragstyp-Kontingent DL/DS/NW/FuE als Anträge/Jahr, Abschlag %, sowie Kompetenz-Level 1/2/3 je Unterkategorie über die fünf Überkategorien IT/DT/EU/LG/NM) hoch und kann die Werte danach in einer xlsx-ähnlichen, editierbaren Tabelle pflegen. Damit sind alle MAs sofort matchbar — auch ohne MA-Selbsteingabe. Neuer Tab **„Kompetenzen"** im Auslastungs-Plugin ([KompetenzMatrixView](src/plugins/auslastung/views/KompetenzMatrixView.tsx) + [KompetenzMatrix](src/plugins/auslastung/components/kompetenz/KompetenzMatrix.tsx) + [KompetenzImportDialog](src/plugins/auslastung/components/KompetenzImportDialog.tsx)). Die Matrix-Tabelle ist in `src/plugins/auslastung/components/kompetenz/` in Sub-Komponenten zerlegt (`MatrixRow`, `MatrixHeader`, `MatrixToolbar`, `MatrixControls`, `LevelCell`, `CapCell`, `HauptkatChip`, `RevealBar`). Additive optionale Felder auf `AnonymerMitarbeiter`: `kompetenzMatrix` (ÜberkatID → Unterkat.-Label → Level), `jahresKapazitaetProTyp` (Anträge/Jahr je Bucket), `kompetenzQuelle: 'pl-upload'`; sowie `config.kompetenzSchema` (Spalten-Schema aus dem XLSX-Header) + `config.kompetenzLevelGewicht`/`kontingentGewicht`. Parser [kompetenz-import.ts](src/plugins/auslastung/services/kompetenz-import.ts) liest das Merge-Header-Layout (Zeile 1 Überkat-Merges, Zeile 2 Unterkat-Labels), löst `TIB_KUERZ` → anonId via Kürzel-Map (NFC, Pitfall #22), unbekannte Kürzel → warnen+überspringen (keine Phantom-MAs); reine Ableitung in [kompetenz-derivation.ts](src/plugins/auslastung/services/kompetenz-derivation.ts) (`deriveHauptNeben`, `kompetenzTokens`, `normLevelForUeber`). Merge = **Überschreiben** über eine Batch-Store-Action `applyKompetenzMatrixBatch` (ein setState + ein persist, Pitfall #16/#20); leitet Haupt-/Nebenkategorie aus der Matrix ab + setzt `onboardingAbgeschlossen` (Matcher-Gate). Matcher: BM25-Profil-Doc bekommt level-gewichtete Unterkat.-Tokens (Level 3 = Token 3×), Engine skaliert den Kompetenz-Score mit dem Überkat.-Level der Primärkategorie und deckelt weich per Antragstyp-Kontingent ([kontingent.ts](src/plugins/auslastung/services/kontingent.ts)) — alles backward-kompatibel (ohne Matrix Faktor 1.0 = altes Verhalten). Datenschutz: Matrix-Tabelle zeigt anonIds; Klartext-Kürzel nur in Varianten mit Flag `deAnonymisierung` (pl/dev — seit v2.17 ohne zusätzliches De-Anon-Passwort). Additiv, keine Migration; bestehende `auslastung.json` ohne die Felder laden mit Defaults.

### v2.16 — Build-Time Rollen-Passwort-Wall für PL + Kurator (Juni 2026)

MINOR-Bump v2.16: Die **pl-** und die **kurator-Variante** sind jetzt passwortgeschützt — ohne korrektes Rollen-Passwort ist die App nicht nutzbar. Hintergrund: der geplante „geschützte SMB-Bereich" für die PL existiert nicht (alle haben AD-seitig read+write, Schutz nur clientseitig), daher Zugangskontrolle per Passwort statt SMB-Berechtigung. Ein **build-time eingebackener** Verifier (kein Klartext, keine SMB-Datei) löst die alte v2.10-Kurator-Wall ab und vereinheitlicht beide Rollen über **ein** generisches Vollbild-Gate [AppPasswordGate](src/core/AppPasswordGate.tsx).

Neuer optionaler Config-Block `auth: { required, salt, verifier, hint? }` ([runtime-config.ts](src/config/runtime-config.ts), `TeamflowAuthConfig`); fließt automatisch via Vite-`define` zur Laufzeit (kein Whitelist nötig). Gesetzt wird er **nie von Hand**, sondern via `npm run set-password -- <pl|kurator> "<passwort>"` ([scripts/set-app-password.mjs](scripts/set-app-password.mjs)) — berechnet Salt + AES-GCM-Verifier (selbe Krypto wie [crypto.ts](src/core/services/infrastructure/crypto.ts): PBKDF2-SHA256 200k, AES-GCM-256, Blob `[12B IV][ct+tag]`) und schreibt nur den Verifier in die Variant-Config. Runtime-Verify: [verifyAppPassword](src/core/services/infrastructure/app-password.ts) (decrypt = auth, Sentinel `{v:1,role}`; alle Fehler → `{ok:false}`). Helper `isAppGateRequired()` ([feature-flags.ts](src/config/feature-flags.ts)); `isKuratorLoginRequired` ist `@deprecated`.

Gate-Entscheidung `decideAppGate` ([App.tsx](src/core/App.tsx)) läuft NACH dem StartupScreen, **synchron + unbedingt**: kein `auth.required` → keine Wall; sessionStorage-Flag (`tf-app-gate`, [useAppGateSession](src/core/hooks/useAppGateSession.ts), TTL = Browser-Tab) → übersprungen; sonst Pflicht-Login. Render-Kette: Onboarding → Welcome → Startup → **AppPasswordGate** → MaLoginGate → AppRouter. **Rollenbewusst**: in der kurator-Variante (`isKuratorMenusEnabled()`) führt der Erfolg die volle Kurator-Eskalation aus — `is_kurator` (Menüs), Schreib-Session via neuer Store-Methode `useKuratorSession.activateSynthetic` (IDB-Meta + Audit `kurator_login_buildtime`, **ohne** SMB-Lesen von `kurator-config.enc`), readwrite-Handle-Upgrade (`refreshAllPermissions`, Pitfall #25) — exakt wie der alte [KuratorLoginGate](src/core/KuratorLoginGate.tsx) (deprecated, bleibt für `KuratorSessionPanel`-Referenz). Die pl-Variante schaltet nur frei (hat `datenShareSchreibrecht` build-time). Build-Guard in `validateConfig()`: `auth.required=true` ohne `salt`/`verifier` → ERROR (sonst wäre die App ausgesperrt).

**Audit-Identität:** bei Shared-Passwort gibt es keine Person → Audit-`user` = Build-Label (z.B. „ZAH Kurator"). **Sicherheits-Einordnung:** Casual-Access-Gate (verhindert versehentliches Öffnen durch normale MAs), konsistent mit dem Single-Team-Trust-Modell; der Verifier ist offline brute-forcebar (starkes Passwort wählen). Passwort wechseln = `set-password` + Rebuild. Additiv, keine Daten-/IDB-/SMB-Migration; dev/prod/demo unverändert (kein `auth` → keine Wall; prod behält die per-User-MA-Wall `maLogin`). Mutual-exclusive zur MA-Wall (pl/kurator haben `maLogin:false`).

### v2.17 — De-Anon-Passwort + anonymer Export entfernt (Juni 2026)

MINOR-Bump v2.17: Da der pl-Build seit v2.16 beim App-Start per Rollen-Passwort gated ist, ist die **zweite** Schutzschicht im Auslastungs-Modul redundant und entfällt:

- **De-Anon-Passwort/Session weg.** Die `useDeAnonSession`-Wall (24h-TTL, Chip „Klartext (Xh)" + Popover) ist gelöscht — samt [PrivacyChip]/[PrivacyPopover] und `deanon-config.ts` (+ `DEANON_*`-Konstanten in [types.ts](src/core/services/infrastructure/types.ts)). `useDeAnonName`/`useDeAnonResolver` ([AnonymIdBadge.tsx](src/plugins/auslastung/components/AnonymIdBadge.tsx)) gaten nur noch auf das **bestehende** Feature-Flag `deAnonymisierung` (true in pl/dev) → echte Kürzel werden dort **immer** angezeigt (kein zweites Passwort). Konsumenten (VorschlagCard, KompetenzMatrix, KalibrierungsReport, OnboardingImportDialog, MaListSection, ZugangPasswortSection) lesen unverändert über die Resolver — der MA-Login-Passwort-Generator ([ZugangPasswortSection](src/plugins/auslastung/components/ZugangPasswortSection.tsx)) ist nicht mehr auf die De-Anon-Session gated, nur noch auf `maVerwaltungPasswort`.
- **Anonymer Export weg.** „Export (anonym)" / „Anonym (XLSX)" sind aus beiden Oberflächen ([ZuweisungsCockpit](src/plugins/auslastung/views/ZuweisungsCockpit.tsx) + [admin/ImportExportSection](src/plugins/auslastung/views/admin/ImportExportSection.tsx)) entfernt; `exportAnonymousXlsx` ist gelöscht. Es bleibt nur der Kürzel-Export.

**Bewusst behalten:** die Anonymisierung der *gespeicherten* Daten (`auslastung.json` = MA01-IDs; echte Kürzel nur in `auslastung-kuerzel-map.json` + RAM) — schützt die Daten *at rest* auf dem geteilten Share, unabhängig vom Passwort. Additiv, keine Daten-/IDB-/SMB-Migration; ein evtl. vorhandenes `_intern/deanon-config.enc` verwaist harmlos (nichts liest es mehr). dev/prod/demo/kurator unverändert (kein De-Anon-Modul sichtbar).

### v2.18 — CSV-Auto-Refresh-Banner auch in der PL-Variante (Juni 2026)

MINOR-Bump v2.18: Der Homepage-**CSV-Auto-Refresh-Banner** (registrierte CSV-Quelle hat neueres `lastModified` → „Jetzt aktualisieren" → Import-Pipeline) läuft jetzt auch in der **pl-Variante**, nicht nur im Kurator-Build. Neuer Build-Flag `features.csvAutoRefresh` (default false; nur `pl` + `dev` true) — eine *zusätzliche* OR-Bedingung neben `kuratorMenus` für Render-Gate ([ShellLayout.tsx](src/core/ShellLayout.tsx)) und Hintergrund-Check ([useCsvAutoRefreshCheck.ts](src/plugins/csv-sources-kuration/hooks/useCsvAutoRefreshCheck.ts)). Helper `isCsvAutoRefreshEnabled()` ([feature-flags.ts](src/config/feature-flags.ts)). Die Import-Pipeline (`importCsvSource` → `acquireBuildLock` → Snapshot-Write) hat keinen Kurator-Session-Guard, braucht nur ein `readwrite`-Daten-Share-Handle — das hat die pl via `datenShareSchreibrecht` (`canWriteDatenShare`).

**v2.19.1-Fix:** Bereits verknüpfte CSV-Dateien lösten bei JEDEM Neustart erneut den „braucht Verknüpfung"-Banner aus — Ursache: FSAPI-Datei-Berechtigungen gehen unter `file://` pro Session verloren (`queryPermission` → `prompt` → `permission_required`), und die CSV-Handles wurden — anders als der Daten-Share — beim Start nicht neu freigegeben. `refreshAllPermissions` ([smb-handle.ts](src/core/services/infrastructure/smb-handle.ts)) re-grantet jetzt im selben Start-Gesture auch die `CSV_SOURCE_HANDLES_IDB_KEY`-Datei-Handles (gated `kuratorMenus || csvAutoRefresh`, best-effort) → der Banner erscheint danach nur noch für nie-verknüpfte Quellen oder echte Updates.

Drei Rollen-Unterschiede pl vs. kurator: (1) **Trigger ohne Kurator-Session** — im pl-Modus (`csvAutoRefresh` ohne `kuratorMenus`) genügt SMB-online beim Mount statt `session.isActive`; der Session-Reset-Effekt ist auf den Kurator-Modus gegated. (2) **Datei-Handle-Lücke** — die pl bekommt die Schemas per Share-Snapshot, aber nie ein `FileSystemFileHandle` (entsteht sonst nur im kurator-only Wizard). Ein schlanker Picker schließt die Lücke: der Banner listet Quellen ohne Handle, `pickAndLinkCsvSource` ([csv-source-handle.ts](src/plugins/csv-sources-kuration/csv-source-handle.ts)) öffnet `showOpenFilePicker` + speichert das Handle (validiert grob gegen `column_mapping`, überschreibt `source_last_modified` NICHT) — UI: [CsvSourceLinkDialog](src/plugins/csv-sources-kuration/components/CsvSourceLinkDialog.tsx). (3) **Keine Kuration-Navigation** — die pl hat das `csv-sources-kuration`-Plugin nicht; `permission_required`/`no_handle` routen über den Picker statt „Zu CSV-Sources", Drift kann nur gemeldet, nicht aufgelöst werden (Spalten-Remapping = Kurator-Wizard). **Audit-Identität** in der pl = Build-Label „ZAH PL" (konsistent mit v2.16 Shared-Passwort-Rollen). **Bekannte Kosmetik:** der Build-Lock-Owner kommt aus `readKuratorName() ?? 'dev-user'` — in der pl also `'dev-user'`. Additiv, keine Migration; demo/prod/kurator unverändert (`csvAutoRefresh: false`).

### v2.19 — Auslastungs-Embedding-Korpus: Selbstheilung auf neuem Rechner + Verbund-Mirror (Juni 2026)

MINOR-Bump v2.19: Fix für „automatische Klassifizierung fehlt + Kompetenz/Kapazität nicht verknüpft" bei einem **PL auf einem neuen Rechner**. Ursache: Die Embedding-Caches des Auslastungs-Moduls liegen **maschine-lokal in der IDB** und wurden auf einem frischen Rechner nicht (vollständig) vom Share rekonstruiert; der Download/Build steckte nur im zugeklappten „Erweitert"-Accordion. Zwei Lücken geschlossen ([corpus-share-sync.ts](src/plugins/auslastung/services/corpus-share-sync.ts)):

- **Verbund-Embeddings werden jetzt mitgespiegelt.** Die Klassifizierung matcht **Verbund-Embeddings** (`auslastung-emb-verbund:*`) gegen Kategorie-Centroids; der core-Mirror ([mirror.ts](src/core/services/embedding-corpus/mirror.ts)) deckt nur den **per-Antrag**-Korpus ab. Neue Sidecar-Dateien `_intern/auslastung-embedding-corpus-verbund.{manifest.json,bin}` (Reuse der key-agnostischen `serializeCorpus`/`parseCorpus`; Manifest-Feld `aktenzeichen` hält hier verbundIds). Upload in `EmbeddingCorpusSection.build()` direkt nach dem per-Antrag-`uploadMirror`.
- **Selbstheilung statt Accordion-Suche.** `ensureVerbundEmbeddings()` / `ensureAntragCorpus()` laden den jeweiligen Korpus „download-if-empty" vom Share (Modell-kompat-gegated, per-Antrag zusätzlich `aktenzeichenSetHash`-gegated), eingehängt direkt in die Lade-Pfade der Views ([KlassifizierungsReview](src/plugins/auslastung/views/KlassifizierungsReview.tsx) bzw. [useMatchingCorpus](src/plugins/auslastung/hooks/useMatchingCorpus.ts) für das Zuweisungs-Cockpit) — keine Race mit dem View-State, idempotent (Count-Guard) + Modul-Inflight-Dedupe. Schlägt der Download fehl (kein/inkompatibler Korpus auf dem Share), zeigt die Klassifizierung einen Hinweis-Banner mit dem Build-Pfad statt stiller 0-Vorschläge.

**Transition:** Bestehende Shares haben noch keinen Verbund-Mirror → ein Kurator/PL muss den Korpus **einmal neu aufbauen** (Tab „Auslastung MA" → „Erweitert" → „Corpus aufbauen"), danach laden neue Rechner Klassifizierung **und** Matching in Sekunden vom Share (ohne lokales Modell/Rebuild). Klassifizierung braucht nach dem Download kein Embedding-Modell mehr (Vergleich vorberechneter Vektoren); das Zuweisungs-Cockpit embedded die Antrags-Query weiterhin live (Modell nötig). Additiv, keine Migration; core `mirror.ts` unverändert. Schreib-Profil der Verbund-Sidecars: `skipBackup` (rebuildbar, Pitfall #23); Modell-Wechsel bleibt team-weiter Bruch (Pitfall #19).

**v2.21 (Tab „Einstellungen"):** Die Admin-/Konfig-Sektionen (Kategorien, CSV-Import/Export, Konfiguration, Themen-Vektoren/Embedding-Korpus) sind aus dem default-zugeklappten „Erweitert"-Aufklapper des Tabs „Auslastung MA" in einen **eigenen Tab „Einstellungen"** am Ende der Tab-Leiste gewandert ([EinstellungenView.tsx](src/plugins/auslastung/views/EinstellungenView.tsx)); [UebersichtView](src/plugins/auslastung/views/UebersichtView.tsx) zeigt nur noch Statistik + MA-Liste. Nebeneffekt: weil der Tab eager gemountet wird (v2.9-Pattern), läuft der Embedding-Korpus-Auto-Download/Manifest-Check jetzt beim Modul-Open statt erst beim Aufklappen — die Themen-Vektoren sind also leichter auffindbar UND der Share-Korpus wird früher gezogen. UI-Refactor, keine Daten-/Verhaltensänderung an den Sektionen selbst.

**v2.20 (Korpus 1-Klick vom Share laden):** Workflow „GPU-Build einmal auf dev → auf den zentralen Share kopieren → PL-Rechner laden nur noch" robuster gemacht. Neuer Button **„Vom Datenspeicher laden"** in [EmbeddingCorpusSection](src/plugins/auslastung/views/admin/EmbeddingCorpusSection.tsx) (sichtbar wenn ein modell-kompatibles Share-Manifest existiert + lokal nicht voll synchron): räumt den lokalen Cache (ein angefangener CPU-Build würde den Auto-Download sonst blockieren) und zieht **per-Antrag- + Verbund-Korpus** in ~10 s — ignoriert bewusst den `aktenzeichenSetHash` (manueller „trotzdem laden"-Pfad; Modell-Kompat bleibt Pflicht via Button-Gate). Der Hash-Mismatch-Hinweis bietet den Download jetzt als schnelle Alternative zum Rebuild an. Lädt der Verbund-Teil nicht (Share-Korpus von vor dem v2.19-Verbund-Mirror), weist der Button darauf hin, dass auf einem aktuellen Build „Corpus aufbauen" laufen muss. Damit muss der GPU-intensive Build nur **einmal** auf einem starken Rechner laufen; alle PL-Rechner laden per Klick statt stundenlang auf CPU zu rebuilden.

**v2.19.2-Fix (Auslastung-Cold-Start):** Auf der pl zeigte das Auslastungs-Modul nach (Neu-)Start „0 MAs · 5 Kategorien · keine Centroids" — der Leer-/Default-Zustand. Ursache: der Plugin-`onInit` lädt `auslastung.json` schon bei `storage.init()`, also VOR dem StartupScreen-Permission-Grant; `loadAuslastungData` schluckt den Permission-Fehler still und liefert Leer-Daten, die der Store als `loaded:true` festschreibt — die Idempotenz-Guard (`if loaded && !error return`) blockt dann jeden Post-Grant-Reload. Fix: der Store setzt `loaded` nur noch scharf, wenn der Daten-Share beim Laden wirklich lesbar war (neuer Core-Helper [`isDatenShareReadable`](src/core/services/infrastructure/smb-handle.ts) — silent `queryPermission` read==='granted'); sonst bleibt `loaded:false` und der erste AuslastungView-Mount nach dem Grant lädt nach. **Hinweis:** zeigt der Rechner nach dem Fix weiter 0 MAs, fehlen die Setup-Daten (Kompetenz/Centroids) tatsächlich in `_intern/auslastung.json` auf dem zentralen Share → einmal auf einem Schreib-Rechner persistieren.

### v2.27 — CSV-Auto-Refresh: EIN Ordner-Handle statt N Per-Datei-Handles (Juni 2026)

MINOR-Bump v2.27: Behebt den hartnäckigen pl-Bug „nach jedem Browser-Neustart müssen die CSV-Quellen erneut verknüpft werden" (Folgebug des v2.19.1-Fixes). **Root Cause:** Unter `file://` verlieren FSAPI-Permissions bei jedem Browser-Neustart ihre Berechtigung, und Chromium verbraucht die transiente User-Activation **pro Permission-Prompt** — nur der **erste** Prompt pro User-Gesture wird angezeigt. In [`refreshAllPermissions`](src/core/services/infrastructure/smb-handle.ts) prompted der Daten-Share zuerst und verbrauchte den Gesture; die nachgelagerte CSV-Datei-Handle-Schleife (v2.19.1) schlug still fehl. Auf der pl half auch der zweite Boot-Gesture (AppPasswordGate-Login) nicht, weil dessen `refreshAllPermissions`-Aufruf hinter `isKuratorMenusEnabled()` gated war (pl: `kuratorMenus:false` → verschenkter Gesture). Auf dev unsichtbar, weil dort CSV-Quellen aus Fixture-Blobs geseedet werden (kein Datei-Handle in IDB).

**Fix:** Statt N Per-Datei-Handles wird **EIN** `FileSystemDirectoryHandle` für den Ordner verknüpft, in dem alle CSV-Quelldateien liegen (neuer IDB-Key `CSV_SOURCE_DIR_HANDLE_IDB_KEY`, [types.ts](src/core/services/infrastructure/types.ts)). FSAPI-Directory-Permission **kaskadiert** auf die Kind-Dateien (`dirHandle.getFileHandle(name)`), also deckt **ein** Re-Grant alle CSVs mit **einem** Prompt ab — das umgeht das one-prompt-per-gesture-Limit. Der Re-Grant läuft im **sauberen** pl-AppPasswordGate-Gesture über die neue [`refreshCsvSourceDirPermission`](src/core/services/infrastructure/smb-handle.ts) (NUR das Ordner-Handle — nicht `refreshAllPermissions`, sonst stiehlt der persoenlich-Handle den Prompt-Slot). [csv-source-handle.ts](src/plugins/csv-sources-kuration/csv-source-handle.ts): `resolveFileViaDir` (Match per `source_file_name`, Fallback Header-Validierung — `source_file_name` ist auf pl-Snapshot-Schemas nicht zuverlässig gesetzt), `pickAndLinkCsvFolder` (Ordner-Picker statt Datei-Picker), `checkSourceForUpdate`/`loadFileFromStoredHandle` lösen bevorzugt über das Ordner-Handle auf (Per-Datei-Handle bleibt Fallback). UI: [CsvSourceLinkDialog](src/plugins/csv-sources-kuration/components/CsvSourceLinkDialog.tsx) bietet primär „CSV-Ordner verknüpfen".

**Migration:** keine stille — der User verknüpft **einmalig** den Ordner über den Banner („CSV-Ordner verknüpfen"); gematchte Quellen verlieren ihr nun überflüssiges Per-Datei-Handle (`removeCsvSourceHandle`). Bis dahin läuft der Legacy-Per-Datei-Pfad als Fallback weiter (nichts regrediert). **Constraint:** die Kaskade ist nicht rekursiv — alle CSVs müssen **direkt** im gewählten Ordner liegen. Additiv, keine Daten-/IDB-/SMB-Migration; demo/prod/kurator unverändert (kurator nutzt weiter den Wizard-Per-Datei-Pfad, profitiert aber automatisch vom Dir-Handle, falls eins existiert).

**v2.27.1 (CSV-Ordner in Einstellungen/Speicher):** Der CSV-Quellen-Ordner erscheint jetzt in **Einstellungen → Speicher** als dritte Datenquelle neben „Datenordner" und „Persönlicher Ordner" (gated `csvAutoRefresh || kuratorMenus` → pl + kurator + dev), [SpeicherTab.tsx](src/plugins/einstellungen/SpeicherTab.tsx). Zeigt Ordnername + Online/Offline (silent `queryCsvSourceDirPermission`) und bietet „Verknüpfen"/„Ändern" (`pickAndLinkCsvFolder`, Picker direkt im Klick-Gesture — CSV-Schemas werden im Mount-Effect vorab geladen, damit kein `await` vor dem Picker die file://-User-Activation verbrennt) + „Trennen" (`clearCsvSourceDirHandle`). Reiner UI-Zusatz, keine Logik-/Daten-Änderung.

**v2.27.2-Fix (Cold-Start-Perf des Ordner-Scans):** Nach dem Ordner-Verknüpfen dauerte der erste Home-Load auf der pl ~10 s statt ~2 s (danach schnell, weil OS-SMB-Cache warm). Ursache: `resolveFileViaDir` fand die Datei zu einem Schema per **Header-Scan** (liest + parst JEDE CSV im Ordner) — und `checkSourceForUpdate` lief das bei **jedem** Mount für **jede** Quelle erneut, weil keine schemaId→Datei-Zuordnung persistiert war (`source_file_name` ist auf pl-Snapshot-Schemas leer). Auf kaltem SMB-Cache = mehrere Sekunden, schlecht skalierend. **Fix:** eine **lokale, nicht synchronisierte** IDB-Filemap `CSV_SOURCE_DIR_FILEMAP_IDB_KEY` (schemaId→Dateiname), geschrieben in `pickAndLinkCsvFolder` + **self-heal** beim ersten `checkSourceForUpdate`/`loadFileFromStoredHandle`. `resolveFileViaDir(dir, schema, knownFileName?)` nimmt damit den schnellen `getFileHandle`-Pfad (nur Metadaten, kein Scan/Parse) → auch bei kaltem Cache schnell. Bewusst ein **eigener** Key statt `source_file_name` auf dem Schema, damit der Share-Snapshot die Zuordnung nicht überschreibt. `clearCsvSourceDirHandle` löscht die Filemap mit. Reiner Perf-Fix, keine Datenänderung.

### v2.28 — CSV-Quellen: Dateinamen-Zuordnung team-weit auf dem Daten-Ordner (Juni 2026)

MINOR-Bump v2.28: Die schemaId→Dateiname-Zuordnung der CSV-Quellen wird **einmal team-weit** auf dem Daten-Ordner gespeichert, statt sie auf jedem PL-Rechner per Header-Scan neu zu ermitteln (Folge-Optimierung zum v2.27.2-Perf-Fix). Damit muss ein **neuer PL-Rechner nur noch den CSV-Ordner freigeben** — die App kennt die exakten Dateinamen aus der geteilten Datei und löst direkt per `getFileHandle(name)` auf (kein Scan, auch nicht einmalig).

Neue Sidecar-Datei `_intern/csv-source-filenames.json` (`{version, updatedAt, mappings: schemaId→fileName}`, [csv-source-filenames.ts](src/plugins/csv-sources-kuration/csv-source-filenames.ts), Schreib-Profil idempotent-overwrite/atomicWrite, Pitfall #23). **Zwei Schreib-Pfade:** (1) der Kurator bei der Erstregistrierung im Wizard ([CsvSourceWizard.tsx](src/plugins/csv-sources-kuration/wizard/CsvSourceWizard.tsx) — setzt zusätzlich `source_file_name`/`source_last_modified` am Schema, das via Snapshot zu den PLs fließt), (2) der **erste PL** beim Ordner-Verknüpfen (`pickAndLinkCsvFolder`, hat die echten Dateien → validierte Namen). Beide best-effort (braucht Daten-Share-Schreibrecht: Kurator-Session ODER `datenShareSchreibrecht`/pl). **Lese-Pfad:** `collectCandidates` ([useCsvAutoRefreshCheck.ts](src/plugins/csv-sources-kuration/hooks/useCsvAutoRefreshCheck.ts)) seedet beim Check die **lokale** Filemap (v2.27.2) aus der geteilten Datei — **lokale Einträge (eigener Scan/Heal) haben Vorrang** und werden nicht überschrieben. Danach nimmt `resolveFileViaDir` den schnellen Dateinamen-Pfad.

**Robust gegen Abweichungen:** passt ein geteilter Dateiname auf einem Rechner nicht (umbenannt / anderer Export), schlägt `getFileHandle` fehl → Fallback auf den lokalen Header-Scan + Self-Heal (v2.27.2). Der erste PL mit den echten Dateien korrigiert die geteilte Zuordnung beim Verknüpfen. Additiv, keine Migration; ein evtl. fehlendes Sidecar = altes Verhalten (lokaler Scan einmalig). demo/prod unverändert (kein CSV-Auto-Refresh).

**v2.28.1-Fix (Home zeigt importierte Daten erst nach Reload):** Auf einem frischen System lud `runRefresh` (Banner „Datenbestand aktualisieren") via `importCsvSource` die Anträge nach IDB, aber der In-Memory-`useAntraegeStore` wurde NICHT neu geladen — die Home blieb leer bis zum manuellen Browser-Reload (cold-start-store-refresh-Klasse, vgl. [cold-start-store-refresh-pattern]). Fix: `runRefresh` ([useCsvAutoRefreshCheck.ts](src/plugins/csv-sources-kuration/hooks/useCsvAutoRefreshCheck.ts)) ruft nach erfolgreichem Import pro betroffenem Programm `refreshAntraegeStoreAfterSync` ([snapshot-refresh.ts](src/plugins/antraege/snapshot-refresh.ts)) auf — dieselbe `force`-Reload-Logik (inkl. Cold-Start-Guard) wie nach dem Snapshot-Sync (v2.21.3). Die Home liest den Store reaktiv → Daten erscheinen sofort. Gilt für pl + kurator (gemeinsamer Banner-Pfad).

**v2.28.2-Fix (gleiche Store-Refresh-Lücke in den Kurator-Import-Pfaden):** Derselbe Reload fehlte in den beiden Kurator-only-Import-Pfaden, die NICHT über den Banner laufen — Registrierungs-Wizard ([CsvSourceWizard.tsx](src/plugins/csv-sources-kuration/wizard/CsvSourceWizard.tsx) `handleSave`) und Reimport-/„CSV neu wählen"-Dialog ([CsvSourceReimportDialog.tsx](src/plugins/csv-sources-kuration/CsvSourceReimportDialog.tsx) `runImport`). Beide rufen jetzt nach `importCsvSource` ebenfalls `refreshAntraegeStoreAfterSync(idb, schema.programm_id, ['antraege','verbuende'])` → Kurator-Home zeigt importierte Daten sofort, ohne TTL-Wartezeit/Reload. Reiner Bugfix, kurator-only.

**v2.28.3-Fix (Snapshot-„Jetzt laden" → Home erst nach Reload, Cold-Start):** Nach „clear site data" + frischem Start zeigte der Klick auf den Snapshot-Banner („Neuer Datenbestand · Jetzt laden", [NewSnapshotBanner](src/core/components/NewSnapshotBanner.tsx)/[useSnapshotWatcher](src/core/hooks/useSnapshotWatcher.ts)) die Daten erst nach manuellem Browser-Reload. **Ursache:** `syncProgrammSnapshot` ([snapshot-sync.ts](src/core/services/csv/snapshot-sync.ts)) schreibt via `replaceStore` nur den **vollen** `ANTRAEGE`-Store — die **Slim-Projektion `ANTRAEGE_LIST_VIEW`** (die Home/Listen/Dashboards lesen) ist NICHT Teil des Snapshots und wird sonst nur beim App-Start von `ensureListViewProjection` ([list-view-migration.ts](src/core/services/csv/list-view-migration.ts)) aus dem vollen Store gebaut. Nach einem In-Session-Sync blieb die Projektion also leer → `loadAll`/Home leer bis zum Reload (der die Start-Migration neu laufen lässt). Der CSV-Import-Pfad (`importCsvSource`→Merger) war NIE betroffen, weil der Merger beide Stores schreibt — deshalb wirkte der v2.28.1-Fix nur dort. **Fix:** `syncProgrammSnapshot` ruft nach dem Reload des `antraege`-Stores `rebuildAntraegeListView` (clear + reproject aller Antraege) auf → die Projektion ist sofort konsistent, die Home zeigt ohne Reload. **Merke:** wer den `ANTRAEGE`-Store schreibt, MUSS die `ANTRAEGE_LIST_VIEW`-Projektion mitziehen (Merger tut das, Snapshot-`replaceStore` tat es nicht).

**v2.28.4 (Snapshot-Banner-Fortschritt von Anfang an):** Der „Jetzt laden"-Balken stand ~4 s bei 0 (SMB-Dir-Navigation + Manifest-Read + großer `antraege`-Store + v2.28.3-Rebuild meldeten keinen feinen Fortschritt). `SyncProgress` ([snapshot-sync.ts](src/core/services/csv/snapshot-sync.ts)) trägt jetzt eine monotone `fraction` 0..1 über alle Phasen (Budget Manifest 5% / Stores 65% / List-View-Rebuild 30%) inkl. **Chunk-Fortschritt** innerhalb großer Stores (`replaceStore`/`rebuildAntraegeListView` mit `onChunk`-Callback). [NewSnapshotBanner](src/core/components/NewSnapshotBanner.tsx) zeigt zusätzlich einen ~5%-Floor, damit der Balken sofort sichtbar startet. Reine UX-Politur, keine Logik-/Daten-Änderung.

**v2.28.5-Fix (CSV-Auto-Refresh-Check läuft nur 1× → kein Banner nach Cold-Start, Verknüpfen wirkt erst nach Reload):** `useCsvAutoRefreshCheck` prüfte die CSV-Quellen nur EINMAL beim Mount (`checkedRef`; auf der pl gibt es keinen Kurator-Session-Reset, der den Check neu armt). Folge auf der pl: (a) nach „clear site data" erschien KEIN „CSV-Ordner verknüpfen"-Banner, weil die Schemas erst NACH dem Erst-Check per Snapshot-Sync in die IDB kamen; (b) das Ordner-Verknüpfen in Einstellungen → Speicher wirkte erst nach einem Browser-Reload. Fix: globaler Signal-Store [csv-sources-signal.ts](src/core/services/csv/csv-sources-signal.ts) (`useCsvSourcesSignal`/`bumpCsvSourcesSignal`), gebumpt vom Snapshot-Sync ([App.tsx](src/core/App.tsx) Startup-Sync + [useSnapshotWatcher](src/core/hooks/useSnapshotWatcher.ts) `applyNow`) und vom Ordner-Verknüpfen ([SpeicherTab](src/plugins/einstellungen/SpeicherTab.tsx)); `useCsvAutoRefreshCheck` re-triggert `runCheck` (idempotenter IDB-Read) bei jeder Signal-Änderung. **Hinweis zum Permission-Modell:** `showDirectoryPicker` IST die Freigabe — nach dem Verknüpfen gibt es bewusst KEIN separates „Zugriff erlauben"-Popup; ein Re-Grant-Prompt kommt erst nach einem vollständigen Browser-Neustart (AppPasswordGate, Pitfall #28/v2.27).

### v2.29 — Themen-Vektoren beim Start automatisch vom Daten-Share laden (Juni 2026)

MINOR-Bump v2.29: Der Auslastungs-**Embedding-Korpus** („Themen-Vektoren für Klassifizierung") wird nach einem Cold-Start (Browser „clear site data") jetzt **beim App-Start** automatisch vom Daten-Share geladen — nicht erst, wenn der User in Auslastung → Einstellungen/Klassifizierung navigiert. Hintergrund: die Embedding-Caches liegen maschine-lokal in der IDB (auf einem frischen Rechner leer); der Download lief bisher nur im `useEffect` der jeweiligen View ([EmbeddingCorpusSection](src/plugins/auslastung/views/admin/EmbeddingCorpusSection.tsx) per-Antrag, [KlassifizierungsReview](src/plugins/auslastung/views/KlassifizierungsReview.tsx) Verbund) — es gab keinen Start-Trigger.

Neuer Shell-Level Background-Hook [useAuslastungCorpusAutoload](src/core/hooks/useAuslastungCorpusAutoload.ts) (gemountet in [ShellLayout.tsx](src/core/ShellLayout.tsx) neben `useSnapshotWatcher`): lädt einmalig, sobald SMB online ist — fire-and-forget, non-blocking. Reuse vorhandener Bausteine: `useEmbeddingCorpusMirror.loadManifest`/`downloadAndApply` (per-Antrag, [useEmbeddingCorpusMirror.ts](src/core/hooks/useEmbeddingCorpusMirror.ts)) + `ensureVerbundCorpus` (Verbund, [corpus-share-sync.ts](src/plugins/auslastung/services/corpus-share-sync.ts), eigener Count-/Inflight-Guard). **Reine Lade-Operation**: read vom Share / write nur in die lokale IDB → kein `readwrite`-Handle nötig.

**Kernentscheidung:** Der per-Antrag-Download läuft **bewusst OHNE** `aktenzeichenSetHash`-Gate (= Äquivalent zum manuellen Button „Vom Datenspeicher laden", [EmbeddingCorpusSection.tsx:277](src/plugins/auslastung/views/admin/EmbeddingCorpusSection.tsx)). Begründung: der Korpus wird selten (GPU-schwer) neu gebaut, CSV-Importe sind häufig → der Hash-Mismatch (Share deckt z.B. 13931 von 13953 Anträgen ab) ist der häufige Normalzustand und blockierte bisher selbst im Einstellungen-Tab den Auto-Download (0%-Banner „Sätze unterscheiden sich"). Der vorhandene Share-Korpus wird jetzt automatisch geladen; die wenigen neueren Anträge bleiben un-embedded bis zum nächsten manuellen „Corpus aufbauen". Gegated nur durch **lokal-leer** (`countEmbeddings === 0` → kein Clobbern eines frisch gebauten lokalen Korpus) + **Modell-Kompatibilität** (`checkCompat`, Pitfall #19). Das Hash-Gate im manuellen Einstellungen-Tab bleibt unverändert (bewusste Wahl Rebuild vs. „trotzdem laden").

Gegated auf `isAuslastungEnabled()` ([feature-flags.ts](src/config/feature-flags.ts)) → läuft nur in **pl + dev** (wo das Modul existiert); kein neues Feature-Flag. Additiv, keine Daten-/IDB-/SMB-Migration; prod/demo/kurator unverändert (No-Op). Siehe Memory `embedding-caches-machine-local` (Ursache) + `cold-start-store-refresh-pattern` (Bug-Klasse).

**v2.29.1-Fix (Korpus-Daten erst nach Browser-Reload verfügbar):** Nach dem v2.29-Start-Autoload — und schon vorher beim manuellen „Vom Datenspeicher laden" — schrieb der Download die Embeddings in die IDB, aber die In-Memory-Konsumenten lasen sie NICHT nach: Klassifizierung/Matching blieben leer bis zu einem manuellen Browser-Reload (Reload = Remount = frischer IDB-Read). Klassische cold-start-store-refresh-Lücke. **Ursache:** [KlassifizierungsReview](src/plugins/auslastung/views/KlassifizierungsReview.tsx) hält die Verbund-Embeddings in `useState` (Effekt-Deps `[storage]`, Guard verhindert Re-Fire); [useMatchingCorpus](src/plugins/auslastung/hooks/useMatchingCorpus.ts) cached den per-Antrag-Korpus über die `antraege`-Array-Referenz, die sich beim Download NICHT ändert. **Fix:** globaler Signal-Store [corpus-signal.ts](src/plugins/auslastung/services/corpus-signal.ts) (`useAuslastungCorpusSignal`/`bumpAuslastungCorpusSignal`, Vorbild [csv-sources-signal.ts](src/core/services/csv/csv-sources-signal.ts)), gebumpt bei jeder Korpus-IDB-Mutation: Start-Autoload ([useAuslastungCorpusAutoload](src/core/hooks/useAuslastungCorpusAutoload.ts)) + „Vom Datenspeicher laden"/„Corpus aufbauen" ([EmbeddingCorpusSection](src/plugins/auslastung/views/admin/EmbeddingCorpusSection.tsx)). Konsumenten re-lesen bei Bump: `KlassifizierungsReview` lädt die Verbund-Embeddings neu (ref-gegated, damit der Warm-Remount ohne Änderung keinen Loading-Flash bekommt), `useMatchingCorpus` verwirft seinen Cache (nächster `loadCorpus` liest frisch). Konsumenten, die den Download SELBST auslösen (Mount-Load), bumpen NICHT — kein Self-Trigger-Loop. **Merke:** wer Embeddings extern in die IDB schreibt, MUSS `bumpAuslastungCorpusSignal()` rufen (analog zur `ANTRAEGE_LIST_VIEW`-Regel in v2.28.3). Reiner Bugfix, keine Daten-/Migration; pl + dev (wo die Views existieren).

**v2.29.2 (Zuweisungs-Cockpit re-matcht automatisch):** Ergänzung zu v2.29.1 — bei einem Korpus-Bump verwarf [useMatchingCorpus](src/plugins/auslastung/hooks/useMatchingCorpus.ts) zwar seinen Cache, der nächste Match lief aber erst beim nächsten User-Trigger (Antrag re-selektieren). Jetzt steht `corpusVersion` in den `useCallback`-Deps von `loadCorpus` → die Funktion bekommt bei jedem Bump eine neue Identität, und der Matching-Effekt im [ZuweisungsCockpit](src/plugins/auslastung/views/ZuweisungsCockpit.tsx) (führt `loadCorpus` in seinen Deps) re-matcht die **aktuelle Selektion** automatisch — ohne Re-Klick/Reload. Das Query-Embedding ist pro Antrag gecacht (`queryEmbeddingCacheRef`), der Re-Match also ohne Modell-Inferenz. Cache-Invalidierung läuft jetzt ordering-unabhängig im Callback (Versions-Ref) statt über einen separaten Effekt.

### v2.30.1 — kurator-Variante schreibt auf den Daten-Share (Juni 2026)

PATCH-Bump v2.30.1: Die **kurator-Variante** zeigte beim Start die irreführende „Sicherheits-Update / Datenordner neu verbinden · … damit die App nur lesend zugreift"-Wall ([StartupScreen](src/core/StartupScreen.tsx) `needsDowngrade`-Branch). Falsch für die Rolle: **alle kurator-User haben AD-seitig SMB read+write** auf dem Daten-Share — Read-Only gilt nur für `prod` (End-User). **Ursache:** der Grant-Mode läuft ausschließlich über `canWriteDatenShare(isKurator)` (Pitfall #25), aber der `StartupScreen` rendert VOR dem `AppPasswordGate`-Login (Render-Kette `… → Startup → AppPasswordGate → …`), wo `profile.is_kurator` noch `false` ist → `canWriteDatenShare(false)` = `false` → `needsDatenShareDowngrade` schlug an, sobald ein bestehendes `readwrite`-Handle vorlag. Die spätere v2.16-Login-Eskalation stufte zwar wieder hoch, aber erst nach einem **zweiten** Ordner-Prompt + der falschen Read-Only-Re-Pick-Wall. **Fix:** `features.datenShareSchreibrecht: true` in [configs/kurator.config.json](configs/kurator.config.json) (wie `pl`) → `canWriteDatenShare` ist in der kurator-Variante durchgehend `true`, kein Startup-Downgrade, fremd gesetzte Downgrade-Flags werden weggeräumt ([App.tsx](src/core/App.tsx)), der Start grantet direkt `readwrite`. Die kurator-only-Blöcke (User-Folders-Root, DMS) in `refreshAllPermissions` bleiben bewusst an `opts.isKurator` (erst nach Login). Additiv, keine Daten-/IDB-/SMB-Migration; bestehende kurator-Installationen mit altem `read`-Handle werden beim nächsten Start transparent auf `readwrite` hochgestuft (ein Browser-Prompt). dev/prod/demo/pl unverändert (`prod` bleibt read-only).

### v2.31 — Förderanträge-Tabellenansicht mit konfigurierbaren Spalten (Juni 2026)

MINOR-Bump v2.31: Die **Kompakt-Ansicht** der Förderanträge ist jetzt eine echte **Header-Tabelle mit Spalten-Picker + Header-Klick-Sortierung** — gleiches Muster wie die Suche, gebaut auf der generischen Tabellen-Infrastruktur [src/components/data-table/](src/components/data-table/index.ts) (`SortableTable`/`ColumnPicker`/`useTableSort`), die schon Suche + Auslastung nutzen. Der View-Mode-Key bleibt `'compact'` (keine Persistenz-Migration), das Toggle-Icon/-Label wurde auf „Tabellenansicht" (lucide `Table`) umbenannt ([ViewModeToggle](src/plugins/antraege/ViewModeToggle.tsx)).

- **Spalten-Registry** [tableColumns.tsx](src/plugins/antraege/tableColumns.tsx) (`ANTRAG_TABLE_COLUMNS: SortableColumn<AntragListItem>[]`, analog `SEARCH_COLUMNS`): FKZ (locked, mit Eingangs-Ampel-Punkt im Cell), Akronym, Antragsteller, Status, Frist default-sichtbar; zuschaltbar Typ, Bewilligungsdatum, Antragseingang, Ort AST, Zuwendung, Laufzeitbeginn/-ende, Branche, Fördergeber. Alle Felder sind in `LIST_VIEW_FIELDS` projiziert. Cell-Renderer reusen `getStatusLabel`/`getStatusVariant` (nur Label-Lookups, kein Status-Literal-Vergleich, Pitfall #12), `getEingangAmpel`, `daysUntilFristAware`, `getKategorieLabel`.
- **Sichtbare Spalten** in einem eigenen Zustand-Store [useAntraegeColumnsStore](src/plugins/antraege/useAntraegeColumnsStore.ts) (localStorage `teamflow_antraege_table_columns`, Locked-/Default-Enforcement, Muster aus `suche/store.ts`) — geteilt zwischen „Spalten"-Picker im Header ([AntraegeHeader](src/plugins/antraege/AntraegeHeader.tsx), nur im `compact`-Modus sichtbar) und Tabelle [AntraegeTable](src/plugins/antraege/AntraegeTable.tsx) in [AntraegeMain](src/plugins/antraege/AntraegeMain.tsx).
- **Sortierung:** flach (keine Gruppierung in diesem Modus → „Gruppiert"-Pille dort ausgeblendet, [QuickfilterToolbar](src/plugins/antraege/filter/QuickfilterToolbar.tsx)). `filtered` (Toolbar-Sort + Verbund-Clustering) ist die Default-Reihenfolge; ein Header-Klick überschreibt lokal via `useTableSort` (sortiert VOR dem Pagination-Slice → ganze Liste, nicht nur sichtbare Seite). Selektierte Zeile per neuem rückwärtskompatiblem `isRowSelected`-Prop auf `SortableTable` hervorgehoben.
- **Cleanup:** die durch den Umbau toten `CompactList`/`CompactGroup`/`CompactRow` entfernt.

Additiv, keine Daten-/IDB-/SMB-Migration; nur ein neuer localStorage-Key. Sichtbar in allen Varianten mit Förderanträge-Plugin (dev/demo/prod/kurator/pl).

### v2.32 — Feedback-Board-Sponsoring: Balken aktualisiert + Punkte hoch-/runterzählen + prod-Outbox (Juni 2026)

MINOR-Bump v2.32: Auf dem öffentlichen Feedback-Board ([FeedbackBoardPage](src/plugins/feedback-board/FeedbackBoardPage.tsx)) ließen sich Feature-Stimmen („+1 Punkt") **nicht wirksam vergeben**: das Budget sank, aber der Fortschrittsbalken blieb bei `0/5`, und die Stimme ging still verloren. **Zwei Ursachen** (beide gefixt): (1) `sponsorTicket`/`unsponsorTicket` ([feedbackSponsoring.ts](src/core/services/feedback/feedbackSponsoring.ts)) gateten ihren Shared-Write auf den Legacy-Handle `storage.fs`, der im modernen Flow **nie gesetzt** ist (Sponsoring wurde bei der `writeSharedFile`-Migration der übrigen Feedback-CRUD-Ops vergessen) → Stimmen landeten nur im localStorage; (2) `mergeItems` ([feedbackSharedFile.ts](src/core/services/feedback/feedbackSharedFile.ts)) war für `sponsors` „shared-wins" und verwarf den lokalen Stand beim nächsten Reload.

- **Persistenz-Fix:** beide Funktionen schreiben jetzt über `writeSharedFile` (self-gated wie die Geschwister-Ops). `mergeItems` macht einen **Union-Merge** der `sponsors` (neuer Helper `unionMergeSponsors`): der eigene lokale Eintrag überlebt den Reload, fremde Stimmen aus Shared bleiben. **Anti-Stale-Regel:** lokale Items tragen nur die **eigenen** Sponsor-Einträge des Users (`saveOwnSponsorsLocally`), damit der Union nie einen veralteten fremden Eintrag wiederbelebt.
- **Hoch-/Runterzählen (Stepper):** für Punkte ist `sponsor.amount` jetzt die **Ziel-Punktzahl** (Upsert): „+" gibt nur die Differenz aus dem Quartals-Budget aus, „−" erstattet sie zurück, bei 0 verschwindet der Eintrag ([SponsorButton](src/components/feedback/SponsorButton.tsx), compact-Stepper `[−] Du: N Pkt [+]`). **Stunden bleiben Single-Entry** (unverändert, hinter „Mehr…"). Punkte-absteigende Board-Sortierung greift damit automatisch (war schon da).
- **prod-Outbox + Einsammeln:** read-only prod-User können `_intern/feedback/feedback.json` nicht schreiben → ihre Stimmen landen in `ZAH/feedback/sponsor-wuensche.json` ([feedbackSponsorOutbox.ts](src/core/services/feedback/feedbackSponsorOutbox.ts), Map `ticketId → Punkte`, IDB-Cache-Fallback, Spiegelbild der Übernahme-Wünsche). Der **Kurator** sammelt sie über den User-Folders-Root ein (`autoCollectSponsorVotes` in [feedbackOutboxCollect.ts](src/core/services/feedback/feedbackOutboxCollect.ts), pure-Merge `mergeSponsorVotesIntoItems` mit Retraktion) — automatisch beim Öffnen des Feedback-Admins ([useAutoCollectFeedback](src/plugins/feedback/hooks/useAutoCollectFeedback.ts)) ODER manuell per Button „Sponsor-Stimmen einsammeln" im Inbox-Tab.
- **Identität** vereinheitlicht auf `useMeinKuerzel() ?? profile.name` (Sponsor-Eintrag, Outbox-Datei, Budget-Key; Pitfall #27).

Additiv, keine Daten-/IDB-/SMB-Migration; neue Sidecar `ZAH/feedback/sponsor-wuensche.json` (idempotent-overwrite, Pitfall #23). Sichtbar in allen Varianten mit Feedback-Board; Einsammeln nur im kurator-Build (kuratorOnly). Budget-Key wechselt ggf. von `profile.name` auf das Kürzel — verwaist alte Quartals-Budgets harmlos (Quartals-Reset).

### v2.33 — Stunden pro Teilvorhaben antragstyp-spezifisch (FuE/DS/DL/NW) (Juni 2026)

MINOR-Bump v2.33: Der bisher globale Faktor `config.stundenProTV` (pauschal 9 h) ist jetzt **pro Antragstyp** konfigurierbar. Neues optionales Config-Feld `stundenProTVProTyp?: Partial<Record<AntragstypBucket, number>>` neben dem `stundenProTV`-Standard + zentraler Aufloeser `stundenProTVFor(config, bucket?)` ([types.ts](src/plugins/auslastung/types.ts)): typ-spezifischer Wert > globaler Standard > 9. UI: vier Felder FuE/DS/DL/NW in der Sektion „Konfiguration" (Tab „Einstellungen", [KonfigurationSection.tsx](src/plugins/auslastung/views/admin/KonfigurationSection.tsx)), leer = Standard.

Der per-Typ-Faktor fliesst in alle **type-aware** Pfade ein (Bucket via `getKategorieLabel(vb_phase)` bekannt): Stundenbedarf + Pro-Typ-Kontingent-Deckel im Matcher ([matching-engine.ts](src/plugins/auslastung/services/matching-engine.ts)), per-Typ-Kapazitaetsbalken ([kapazitaet-pro-typ.ts](src/plugins/auslastung/services/kapazitaet-pro-typ.ts)), verbrauchte Stunden im Quartals-Index ([quartals-auslastung.ts](src/plugins/auslastung/services/quartals-auslastung.ts), per Verbund-Anteil), manuelle Zuweisung ([manual-match.ts](src/plugins/auslastung/services/manual-match.ts) + [ZuweisungsCockpit](src/plugins/auslastung/views/ZuweisungsCockpit.tsx)) und der Quartals-Index-Cache-Key ([useAuslastungIndex.ts](src/plugins/auslastung/hooks/useAuslastungIndex.ts)). **Typ-uebergreifende Aggregat-Anzeigen** („X TVs frei" in MaTile/Vorschlag/Statistik/Export, `computeKapazitaet.restTVs`) bleiben bewusst auf dem Standard-Faktor. Beispiel: bei DS = 4,5 h hat ein MA mit gleichem Stunden-Konto doppelt so viele freie DS-Teilvorhaben wie bei FuE = 9 h.

Voll abwaertskompatibel (leeres `stundenProTVProTyp` = altes Verhalten; Load-Merge gegen `DEFAULT_AUSLASTUNG_CONFIG` ergaenzt das Feld als `{}`). Keine Migration. Sichtbar/wirksam in **pl + dev** (wo das Auslastungs-Modul existiert); prod/demo/kurator unveraendert.

### v2.34 — Klassifizierung: manuelle PL-Vergabe = grüner „Von Hand"-Punkt + Auto-Save-Bestätigung (Juni 2026)

MINOR-Bump v2.34: In der Klassifizierungs-Tabelle (Tab „Anträge klassifizieren", [KlassifizierungsReview.tsx](src/plugins/auslastung/views/KlassifizierungsReview.tsx)) zählt ein PL-Pill-Klick jetzt als **menschliche Klassifizierung**: `applyVerbundOverride` schreibt die Primär mit `methode: 'manuell'` (statt `'regel'`). Der bisher nie gesetzte `methode`-Wert `'manuell'` ([PrimaerVorschlag](src/plugins/auslastung/types.ts)) ist damit endlich aktiv.

- **Grüner Punkt + Tooltip:** Die Aggregation ([verbund-aggregation.ts](src/plugins/auslastung/services/verbund-aggregation.ts)) liefert pro Verbund-Zeile ein neues `manuell`-Flag (`vorgeschlagenePrimaer.methode === 'manuell'`, Helper `istManuell`) auf `VerbundKlassifizierungsView` + `VerbundZuweisungRow`. [ConfidenceDot](src/plugins/auslastung/components/ConfidenceDot.tsx) bekommt einen optionalen `manuell`-Prop → **immer grün** (eine menschliche Entscheidung gilt als sicher, überschreibt auch eine vorherige rote LLM-/Low-Conf-Bewertung) mit Tooltip **„Von Hand klassifiziert"** statt „Hohe Sicherheit". Durchgereicht in [verbund-columns.tsx](src/plugins/auslastung/views/verbund-columns.tsx) (Klassifizierungs-Tabelle) + [ZuweisungsCockpit.tsx](src/plugins/auslastung/views/ZuweisungsCockpit.tsx) (Zuweisungs-Tab).
- **Auto-Save-Bestätigung:** Die Persistenz nach SMB (`_intern/auslastung.json`) lief schon zuverlässig (debounced `schedulePersist` + `flushPersist` beim Verlassen der Tabelle → andere PL sehen die Änderung nach Reload). Neu: `schedulePersist(storage, onSaved?)` ([useAuslastungData.ts](src/plugins/auslastung/hooks/useAuslastungData.ts)) feuert einen Completion-Callback nach erfolgreichem Write; die View zeigt dann ~1,5 s ein dezentes **„✓ gespeichert"** in der Toolbar.

Additiv, keine Daten-/IDB-/SMB-Migration (das `methode`-Feld existierte schon im Schema). pl + dev (Auslastungs-Modul); prod/demo/kurator unverändert.

## Ältere Releases (v2.0–v2.6.2)

*Historie, chronologisch absteigend. Bei Konflikt mit einem neueren Block oben gilt der neuere.*

### v2.0 — 2-Handle-Architektur (Persoenlicher Ordner + Offline-Modus + Feedback-Inbox)

MAJOR-Bump v2.0 erzwingt Re-Pick beim Start. Neuer Handle-Slot `SMB_HANDLE_PERSOENLICH` pro User für `ZAH/{profile,einstellungen}.json` + Feedback-Outbox. Nicht-Kurator-Daten-Share-Handle wird automatisch von `readwrite` auf `read` heruntergestuft. Details: [docs/architecture/v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md).

### v2.6.2 — Persönlicher Unterordner `teamflow/` → `ZAH/` (Mai 2026)

PATCH-Bump v2.6.2: Der im persönlichen Ordner angelegte Unterordner heißt jetzt `ZAH/` (App-Branding) statt `teamflow/`. Betrifft alle `PERSOENLICH_*`-Pfade ([types.ts](src/core/services/infrastructure/types.ts), Konstante `PERSOENLICH_ZAH_DIR`), `ensurePersoenlichFolders`, den Feedback-Inbox-Reader und die `personalFolder.subfolder`-Defaults in allen `configs/*.json`. **Keine Auto-Migration**: bestehende `teamflow/`-Ordner werden nicht umbenannt — profile/einstellungen werden beim nächsten Save neu unter `ZAH/` geschrieben (IDB-Cache bleibt Quelle), eine noch nicht eingesammelte Feedback-Outbox unter `teamflow/` würde verwaisen. Bei produktivem Einsatz mit bestehenden persönlichen Ordnern vorab klären, ob ein Migrationsschritt nötig ist.

### v2.6 — MA-Selbst-Profil über persönlichen Ordner (Mai 2026)

MINOR-Bump v2.6: Der Tab „Meine Technologien" schreibt nicht mehr direkt nach `_intern/auslastung.json` (für Nicht-Kuratoren seit v2.0 read-only), sondern nach `ZAH/auslastung-profil.json` im persönlichen Ordner. Die PL sammelt die Profile über den User-Folders-Root ein (Button „Team-Profile einsammeln" in der Auslastungs-Übersicht) und merged sie in `auslastung.json`. Additive Änderung, keine User-Aktion oder Migration nötig — fehlt das neue File, bleibt der bisherige `auslastung.json`-Stand. Details: Pitfall #24 + [v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md).

### v2.3 — Auslastungs-Modul Deprecation-Cleanup (Mai 2026)

MINOR-Bump v2.3 entfernt die seit v2.1 deprecated Felder im Auslastungs-Modul: `AnonymerMitarbeiter.ueberKategorien` sowie `Klassifizierung.vorgeschlageneKategorien` / `freigegebeneKategorien`. Die `withLegacyFields()`-Wrapper-Funktion im Save-Path ist weg, der Save schreibt nur noch das v2.1-Schema (Primaer + Aspekte / hauptKategorie + nebenKategorien). Die Migrations-Funktionen `normalizeMitarbeiterRecord` + `normalizeKlassifizierungArray` lesen Pre-v2.1-Roh-JSON weiterhin (für Legacy-IDB/SMB-Daten), heben es aber jetzt sofort auf das aktuelle Schema. Keine User-Aktion nötig.

## Common Pitfalls

> **Hinweis zur Nummerierung**: append-only. Niemals umnummerieren — Querverweise (in Code-Kommentaren, anderen Docs, Commit-Messages) werden sonst ungültig. Wer einen Pitfall für überholt hält, markiert ihn mit *„(überholt seit vX.Y, siehe …)"* statt ihn zu löschen.

**Index nach Thema** (Sprung-Hilfe — die Pitfalls selbst stehen darunter in Nummern-Reihenfolge):

- **`file://`-Constraints**: #1 import(), #2 fetch, #3 BroadcastChannel, #4 ServiceWorker, #5 Worker, #6 crypto.subtle, #7 FSAPI, #8 Embedding-Main-Thread
- **Status-Vergleiche (Domain-getrennt)**: #9 Vorgang vs Feedback, #12 Antrag-Status, #21 Feedback-Status
- **Feature-Flags & Build-Varianten / Auth**: #11 Flag-Gating, #25 `datenShareSchreibrecht`, #28 `auth`-Block
- **Async-UI**: #15 `useAsyncAction`
- **Persistenz & Sidecars**: #10 `atomicWrite`, #23 Sidecar-Schreib-Profile
- **Personal-Folder-Flows (Nicht-Kurator read-only)**: #24 MA-Selbst-Profil, #26 Übernahme-Wünsche
- **Identität**: #27 `useMeinKuerzel`
- **Auslastungs-Modul (Store/Matching/Anonymisierung)**: #14 Pill-Breite, #16 + #20 ein setState+persist, #17 + #18 AnonymMap, #19 Embedding-Modell-Wechsel, #22 NFC-Kürzel
- **Seeds**: #13 Förderantrag-Seeds aus CSV

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
21. **Feedback-Status nicht als String-Literal vergleichen** — Analog Pitfall #12 (Antrag-Status), aber für die Feedback-Domain. `if (item.kurator_status === 'geplant')` ist refactor-fragil (Tippfehler, IDE-Rename-Lücke, Status-Rename übersieht Stellen). Für **Vergleiche** die Konstante `FEEDBACK_STATUS` bzw. die Prädikate `istOffen` / `istUmgesetzt` / `istArchiviert` aus [src/core/services/feedback/feedback-status.ts](src/core/services/feedback/feedback-status.ts) nutzen (für **Rendering** weiterhin `STATUS_LABELS` / `STATUS_COLORS` aus [src/components/feedback/constants.ts](src/components/feedback/constants.ts)). Beim Hinzufügen eines neuen Status: Cheatsheet [docs/agents/add-feedback-status.md](docs/agents/add-feedback-status.md). **Maschinell erzwungen** durch den Convention-Test `no-direct-feedback-status-compare` in [src/__tests__/codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts) (Inline-Ausnahme: `// allow-feedback-status-literal: <grund>`).
22. **Unicode-Kürzel (THÜ/BIB/ZTP) immer NFC-normalisieren** — Umlaut-Kürzel kommen in IDB/JSON je nach Browser/OS in NFC oder NFD an. Wer Kürzel in der `kuerzel-map` speichert oder daraus liest, muss `s.normalize('NFC')` durchlaufen (`bootstrapKuerzelMap()` in [src/plugins/auslastung/services/kuerzel-map.ts](src/plugins/auslastung/services/kuerzel-map.ts)), sonst silent-mismatch in `findAnonId(kuerzel)` und doppelter `anonId`-Eintrag für „THÜ" vs „THÜ". Tritt v.a. bei manuellen Imports aus Excel oder beim Onboarding-XLSX-Upload auf. Test-Helper: `__tests__/test-helpers.ts:buildAnonymMapForTests()` läuft denselben Pfad wie Prod.
23. **Sidecar-Dateien: Schreib-Profil bewusst wählen** — Kombiniert mit Pitfall #10. Drei Profile, je nach Datei-Charakter:
    - **Idempotent-overwrite** (Standard, Single-Source-of-Truth): `atomicWrite()` mit Backup-Rotation. Beispiel: `_intern/auslastung.json`, `_intern/feedback/feedback.json`.
    - **Append-only** (immutable History, Order matters): `appendToFile()` ohne Rotation, mit Version-Feld im Schema. Beispiel: `_intern/audit-log.jsonl`, `_intern/auslastung-kuerzel-map.json` (Pitfall #18 erzwingt diese Append-Semantik).
    - **Atomic ohne Backup** (große Binär-Files, Recovery via Re-Build): `atomicWrite(..., { skipBackup: true })`. Beispiel: `_intern/auslastung-embedding-corpus.bin` (~40 MB; Backup-Rotation würde die Share-Quota fluten).
    Entscheidung beim Anlegen einer neuen Sidecar als Header-Kommentar in der Datei festhalten. Cheatsheet [docs/agents/add-sidecar-persistence.md](docs/agents/add-sidecar-persistence.md) erweitern, wenn neue Profile dazukommen.
24. **MA-Selbst-Daten gehen über den Personal-Handle, nicht direkt nach `auslastung.json`** (v2.6) — Nicht-Kuratoren haben seit v2.0 nur `read` auf dem Daten-Share (Pitfall: `atomicWrite` auf `_intern/auslastung.json` wirft für sie `NotAllowedError`). Wer eine MA-Selbst-Eingabe persistiert (z.B. „Meine Technologien"), schreibt in `ZAH/auslastung-profil.json` im persönlichen Ordner via `writeAuslastungProfil` ([persoenliches-profil.ts](src/plugins/auslastung/services/persoenliches-profil.ts)); die PL sammelt über den User-Folders-Root ein (`profil-einsammeln.ts` → `applyAggregatedProfiles`-Store-Action) und merged in `auslastung.json` **ohne** PL-only-Felder (Kapazität, `aktiv`, `abschlagProzent`, `antragstypUeberschreibung`) zu überschreiben. Cross-Browser: beim Tab-Mount IMMER `loadAuslastungProfil` (persönlicher Ordner → IDB-Cache) priorisieren, NICHT den `auslastung.json`-Record (der ist erst nach PL-Aggregation aktuell). Spiegelbild des Feedback-Outbox-Flows (Pitfall #23 + [v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md)). **Ausnahme seit Pitfall #25:** Die PL (pl-Variante) hat per `features.datenShareSchreibrecht` Schreibrecht auf dem Daten-Share und schreibt `auslastung.json` (inkl. Klassifizierungen) direkt — der NotAllowedError-Fall oben gilt nur für echte Nicht-Kurator-Builds (prod ohne Flag).
25. **`features.datenShareSchreibrecht` hebt das v2.0-read-only-Hardening rollen-gezielt auf** — Der Daten-Share-Picker/Grant-Mode (`read` vs `readwrite`) wird AUSSCHLIESSLICH über `canWriteDatenShare(isKurator)` ([feature-flags.ts](src/config/feature-flags.ts)) entschieden = `isKurator || features.datenShareSchreibrecht`. Der Flag ist in `dev` + `pl` + `kurator` true: bei `pl` damit die PL die Auslastungs-Klassifizierung nach `_intern/auslastung.json` schreiben kann (sonst silent `NotAllowedError`, siehe Pitfall #24); bei `kurator` (seit v2.30.1) weil alle kurator-User AD-seitig SMB-Schreibrecht haben und die Variante durchgehend `readwrite` halten soll — sonst zeigt der `StartupScreen` VOR dem Passwort-Login (wo `is_kurator` noch `false` ist) die irreführende „nur lesend"-Downgrade-Wall. Read-only (`datenShareSchreibrecht: false`) gilt nur für `prod` (End-User). Alle Mode-Entscheidungen routen durch diesen Helper: `WelcomeScreen`, `StartupScreen` (initial pick + Start), `SpeicherTab`, `refreshAllPermissions` + `needsDatenShareDowngrade` ([smb-handle.ts](src/core/services/infrastructure/smb-handle.ts)), `useVisibilityPermissionProbe`. Wer eine neue Stelle einführt, die den Daten-Share-Mode braucht, MUSS `canWriteDatenShare()` nutzen — nicht erneut `isKurator ? 'readwrite' : 'read'` hart kodieren. Die kurator-only-Blöcke (User-Folders-Root, DMS-Sources) in `refreshAllPermissions` bleiben bewusst an `opts.isKurator` (nicht `canWriteDatenShare`). Bestehende pl-Installationen mit altem `read`-Handle werden beim nächsten Start über die Permission-Kette transparent auf `readwrite` hochgestuft (ein Browser-Prompt).
26. **Übernahme-Wünsche („Kann ich übernehmen") laufen über den Personal-Handle, nicht per Direkt-Write** (v2.9) — Zweite Instanz des Personal-Folder-Patterns aus Pitfall #24 (NICHT in `auslastung.json` schreiben — prod-User sind read-only → `NotAllowedError`). Der Homepage-Button `NeueAntraegeFuerDich` schreibt den Wunsch via `writeUebernahmeWuensche` nach `ZAH/auslastung-uebernahme.json` ([uebernahme-wuensche.ts](src/plugins/auslastung/services/uebernahme-wuensche.ts)); die PL sammelt im Zuweisung-Tab per Button „Übernahme-Wünsche einsammeln" über den User-Folders-Root ein (`collectUebernahmeWuensche` → `applyUebernahmeWuensche`-Store-Action → `mergeWuenscheIntoZuweisungen`, [uebernahme-einsammeln.ts](src/plugins/auslastung/services/uebernahme-einsammeln.ts)) und merged sie als `Zuweisung{status:'selbst'}`. Merge-Regeln: dedupe per `(antragId, anonId)`, `freigegeben`/`abgelehnt` NIE überschreiben, **Retraktion** (Undo) entfernt selbst-Einträge nur für anonIds, deren Datei im aktuellen Batch gelesen wurde. Homepage liest „meine Wünsche" via `useMyUebernahmeWuensche` aus dem persönlichen Ordner (NICHT `auslastung.json` — der ist erst nach PL-Einsammeln aktuell, analog Pitfall #24); vorgemerkte Anträge bleiben gedämpft sichtbar mit „Rückgängig". Mehrere MAs können denselben Antrag wünschen → PL sieht alle Interessenten und weist gezielt einem zu. Spiegelbild von Profil-Einsammeln (Pitfall #24) + Feedback-Outbox (Pitfall #23).
27. **Bearbeiter-Kürzel kommt aus `useMeinKuerzel()`, nicht direkt aus `profile.bearbeiter_kuerzel`** (v2.11) — Mit der MA-Login-Wall ist das effektive Kürzel im Login-Modus das aus dem Passwort entschlüsselte **Session-Kürzel** (sessionStorage, [useMAIdentity](src/core/hooks/useMAIdentity.ts)), NICHT der Profil-Wert (im Login-Modus read-only und ggf. leer). Neue Kürzel-Konsumenten (Dashboard „Meine Anträge"/„Meine Fristen", Selbsteintragung, Übernahme-Wünsche, Feedback-Reviewer, „nur meine"-Filter) MÜSSEN [`useMeinKuerzel()`](src/core/hooks/useMeinKuerzel.ts) nutzen (Session > Profilfeld, drop-in-kompatibel zu `profile?.bearbeiter_kuerzel`, Rückgabe `string | undefined`) — sonst lesen sie im Login-Modus den leeren/veralteten Profilwert statt der echten Identität. Der Hook greift nur bei `isMaLoginEnabled()` + angemeldet; sonst (kein Login, weil Zugangsdatei fehlt, oder Varianten ohne `maLogin` wie pl/kurator/demo) liefert er weiter das editierbare Profilfeld. **Im Login-Modus ist nur EIN einzelnes echtes Kürzel verfügbar** — die früheren Profil-Spezialwerte „MUE,SCH" (Vertretung) / „alle" (Übersicht) stehen prod-Usern dann nicht mehr zur Verfügung (by design: Identität ist abgeleitet, nicht frei; die PL behält ohne MA-Login volle Freiheit). Spiegelt das v2.11-Kürzel-aus-Passwort-Modell. **Maschinell erzwungen** durch den Convention-Test `no-direct-bearbeiter-kuerzel` in [src/__tests__/codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts) (verbietet direkten `.bearbeiter_kuerzel`-Lesezugriff; Pre-Login-Ausnahme via `// allow-direct-kuerzel: <grund>` — siehe `StartupScreen`).
28. **Rollen-Passwort (`auth`-Block) gehört in den Build, nicht von Hand in die Config** (v2.16) — Die pl-/kurator-Wall ([AppPasswordGate](src/core/AppPasswordGate.tsx)) prüft gegen `runtimeConfig.auth` (Salt + AES-GCM-Verifier, build-time eingebacken). Niemals `salt`/`verifier` selbst tippen — `npm run set-password -- <pl|kurator> "<pw>"` ([scripts/set-app-password.mjs](scripts/set-app-password.mjs)) erzeugt sie mit **denselben** Krypto-Params wie [crypto.ts](src/core/services/infrastructure/crypto.ts) (PBKDF2-200k, AES-GCM-256, Blob `[12B IV][ct+tag]`). Build↔Runtime-Param-Match ist der kritische Punkt: ändert sich ein Param in crypto.ts (Iterationen, IV-Länge), muss set-app-password.mjs mitgezogen werden, sonst schlägt jeder Login fehl. Drei Fallen: (a) **Kurator-Eskalation darf nicht verloren gehen** — der Gate-Erfolg muss in der kurator-Variante (`isKuratorMenusEnabled()`) `is_kurator` setzen + `useKuratorSession.activateSynthetic` rufen (Schreib-Buttons via `isActive`, Audit-Identität via `kuratorName`) + `refreshAllPermissions({isKurator:true})` (readwrite-Handle, Pitfall #25); nur dann sind Menüs sichtbar UND Schreiben möglich. Menü-Gate ist `profile.is_kurator` ([ShellLayout.tsx](src/core/ShellLayout.tsx)), NICHT die Gate-Session. (b) **Passwort ändern = Rebuild** (set-password + build:pl/build:kurator); ein im Build eingebackener Verifier ist nicht zur Laufzeit änderbar. (c) **Gate-Session ≠ Kurator-Session**: das Gate nutzt sessionStorage (`tf-app-gate`, Tab-TTL, [useAppGateSession](src/core/hooks/useAppGateSession.ts)) nur für „Wall zeigen?"; die Schreib-Berechtigung läuft weiter über `useKuratorSession` (IDB-12h, Reload → `rehydrate`). `validateConfig()` bricht ab, wenn `auth.required=true` ohne `salt`/`verifier`. Sicherheits-Einordnung: Casual-Access-Gate, Verifier offline brute-forcebar (starkes Passwort) — Single-Team-Trust-Modell.
