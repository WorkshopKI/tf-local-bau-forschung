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
| Bug-Risiko-Check vor Commit | [Common Pitfalls](#common-pitfalls) unten (nummerierte Liste) überfliegen |
| Wiederkehrende Bug-Klassen (Cold-Start-Refresh, FSAPI, Parallel-Varianten, Embedding-Caches) | [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md) |
| Welche(n) Build nach dem Patch bauen | [docs/agents/which-build-to-run.md](docs/agents/which-build-to-run.md) |
| Async-UI-Aktion ohne silent-fail | [docs/agents/async-error-pattern.md](docs/agents/async-error-pattern.md) |
| Antrag-Status-Vergleich | Pitfall #12 + [docs/architecture/antrag-status-domaenen.md](docs/architecture/antrag-status-domaenen.md) |
| Datei-Pfade auf SMB-Share | [docs/architecture/data-layout.md](docs/architecture/data-layout.md) |
| Source-Tree (welche Datei gehört wo?) | [docs/architecture/project-structure.md](docs/architecture/project-structure.md) |
| Infrastructure-Layer-Internals | [docs/architecture/infrastructure-layer.md](docs/architecture/infrastructure-layer.md) |
| Auslastungs-Modul (Klassifizierung + Matching) | [docs/architecture/auslastung.md](docs/architecture/auslastung.md) |
| Gutachten-Kurzfassung-Testballon (Skill + Aufnahme + DOCX-Füller) | [docs/architecture/gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md) |
| Feedback-System (FAB + Board + Sponsoring) | [docs/architecture/feedback-system.md](docs/architecture/feedback-system.md) |
| Phase-2 Triage + Review-Queue | [docs/architecture/phase2-triage.md](docs/architecture/phase2-triage.md) + [phase2-review-queue.md](docs/architecture/phase2-review-queue.md) |
| v2.0 Handle-Architektur (Offline-Modus, Feedback-Outbox) | [docs/architecture/v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md) |
| Storage / Search / Theming / Onboarding-Tour | [docs/architecture/runtime-layers.md](docs/architecture/runtime-layers.md) |

## Ignorierte Verzeichnisse

Folgende Pfade NICHT lesen oder referenzieren beim Arbeiten am Code:

- `_archive/` — Historische Architektur-Docs, erledigte Audits, überholte Test-Daten. Enthält die alte MVP-Architektur (postMessage-AI-Bridge, Vorgang-zentriertes Datenmodell, "Admin"-Terminologie) und führt bei aktuellem Code zu falschen Annahmen. Ein Agent, der hier sucht, bekommt mit hoher Wahrscheinlichkeit überholte Guidance.
- `node_modules/`, `dist*/`, `.vite/` — Build-Artefakte.
- `_reference/` — externe Referenz-Apps und Mockup-Bilder, nicht Teil von TeamFlow. Wird von Vite (`server.watch.ignored`) ignoriert.

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
- **UI Components**: shadcn/ui (Radix, Nova-Preset) — `src/components/ui/` ist die **einzige** UI-Bibliothek (eine Implementierung pro Primitive). `@/ui` ist seit P1b nur noch ein Re-Export-Shim (Kompatibilität); neuer Code importiert direkt `@/components/ui/*`. Fehlende Komponenten per `npx shadcn@latest add <name>` nachinstallieren
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

Detail (Datenmodell, Sponsoring-Logik, Komponenten-Liste): [docs/architecture/feedback-system.md](docs/architecture/feedback-system.md). Neue Status-Werte: [docs/agents/add-feedback-status.md](docs/agents/add-feedback-status.md). Neue Kategorie: [docs/agents/add-feedback-category.md](docs/agents/add-feedback-category.md) (nutzt den `isSponsorableCategory`-Helper statt verstreuter `=== 'idea'`-Vergleiche).

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

### Gutachten-Kurzfassung-Testballon (v2.68, erster „Mini-Agent")

Auf der **Verbund**-Detailseite ([VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx), oberhalb der Felder-Liste) erstellt ein Gutachter KI-gestützt die **Kurzfassung** eines ZIM-Gutachtens — Durchstich von Dokumenten-Aufnahme über Skill-Ausführung + Review/Freigabe bis zur ausgefüllten Word-Vorlage. Hinter Feature-Flag `gutachtenKurzfassung` (**nur dev**). Erster Baustein der späteren Skill-Registry / des Workflow-Runners.

**Leitprinzip**: LLM ist optional — Aufnahme ([src/core/components/DokumentAufnahme.tsx](src/core/components/DokumentAufnahme.tsx)), Review eines vorhandenen Stands und der DOCX-Füller ([src/core/services/gutachten-vorlagen/](src/core/services/gutachten-vorlagen/)) laufen ohne LLM; nur die Generierung (Skill, [src/core/services/skills/](src/core/services/skills/)) braucht die Transport-Ladder und degradiert mit klarer Meldung. **Ebene = Verbund** (eine VB pro Verbund); Persistenz + VB-Relation laufen über die Verbund-ID als `kv`-Präfix-Key/Tag (`gutachten-kurzfassung:<key>`, `doc:*`-Tags), **kein** Schreiben in den CSV-`Antrag`-Record (Pitfall #29).

Detail (4 Bausteine, Datenfluss, Skill-Struktur, Run-Splitting im DOCX-Füller, Persistenz-Keys, Generalisierungs-Notizen): [docs/architecture/gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

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
| Auslastung | ✓ | – | – | ○ | ○ | ✓ |
| Dokumente | ✓ | ✓ | – | – | – | – |
| Suche | ✓ | ✓ | – | ✓ | ✓ | ✓ |
| Chat | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Feedback Übersicht | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Einstellungen | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kurator-Toggle in Einstellungen | ✓ | – | – | ✓ | ✓ | – |
| Kuration-Menüs (Suchindex, Programme, CSV, DMS, Filter, Feedback, Review) | ✓ | – | – | – | ✓ | – |

○ = **Auslastung in kurator nur als „Themen-Vektoren"** (v2.56, `features.auslastungNurKorpus`): schlanker Korpus-Pflege-View zum Aktuell-Halten des Embedding-Katalogs — **kein** MA-Auslastung/Zuweisung/Kompetenzen, nur „Inkrementell" (kein Vollbuild, der bleibt dev-exklusiv). Sichtbar als Workflow-Plugin (unabhängig vom Kurator-Toggle).

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

**Feature-Flag `features.gutachtenKurzfassung`** (v2.68, optional, default false via `=== true` — NICHT in `requiredFlags`, daher in jeder Config nur optional zu setzen; gesetzt: dev = true, alle anderen = false): blendet die KI-Kurzfassung-Sektion auf der Verbund-Detailseite ein. Kein Plugin/Routing — nur die eingebettete Sektion ist gegated (`isGutachtenKurzfassungEnabled()`). Detail: [docs/architecture/gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

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

Beim MAJOR-Bump zusätzlich: Migrations-Notiz in [CHANGELOG.md](CHANGELOG.md) ergänzen (analog v1.9-Block in [docs/architecture/infrastructure-layer.md](docs/architecture/infrastructure-layer.md)), und sicherstellen dass `migrateLegacyStructure()` (oder Pendant) die alte Struktur erkennt.

Vollständige Versionshistorie (v2.0–v2.38) + Migrationsnotizen: **[CHANGELOG.md](CHANGELOG.md)** (append-only, chronologisch absteigend).

## Common Pitfalls

> **Hinweis zur Nummerierung**: append-only. Niemals umnummerieren — Querverweise (in Code-Kommentaren, anderen Docs, Commit-Messages) werden sonst ungültig. Wer einen Pitfall für überholt hält, markiert ihn mit *„(überholt seit vX.Y, siehe …)"* statt ihn zu löschen.
>
> **Maschinell erzwungen**: Pitfalls mit `[test: …]` fängt [codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts) (Vitest, Inline-Ausnahme `// allow-<rule>: <grund>`). **Wiederkehrende, NICHT-nummerierte Bug-Klassen** (Cold-Start-Store-Refresh, FSAPI-One-Prompt-per-Gesture, Parallel-Varianten-Storage, machine-lokale Embedding-Caches) stehen separat in [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md). Auch **Klasse 7** (hand-gerollte Modals) ist test-erzwungen: `no-raw-modal` verbietet `fixed inset-0` außerhalb des kanonischen Dialogs (`@/components/ui/dialog`); Vollbild-Zustände + Drawer per `// allow-raw-modal: <grund>` whitelisten.

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
- **Gutachten-Kurzfassung (Testballon)**: #29 Verbund-Ebene + kv-Tag-Relation

1. **Don't use `import()` for lazy loading** — dynamic imports break under `file://` in single-file builds
2. **Don't use `fetch()` for local assets** — everything must be inlined or from IndexedDB/FSAPI
3. **Don't use `BroadcastChannel` for Streamlit bridge** — cross-origin between `file://` and `http://` fails. Use `postMessage` via `window.open()`
4. **Don't use `navigator.serviceWorker`** — unavailable under `file://`
5. **Web Workers must use `?worker&inline`** `[test: no-raw-worker]` — standard Worker constructor fails under `file://`
6. **`crypto.subtle` works under `file://`** — it's a secure context
7. **File System Access API works under `file://`** — it's a secure context
8. **Embedding models run in Main Thread** — Web Workers cannot load ONNX models under `file://` (Blob URL CSP restrictions). This means large models may block the UI briefly during init.
9. **Status-Mappings sind domain-getrennt** — `src/core/utils/status-mappings.ts` ist NUR für Vorgang-Status (Bauantrag/Förderantrag: `neu`, `in_pruefung`, `genehmigt`, …). Feedback-Status (`neu`, `geplant`, `in_bearbeitung`, `umgesetzt`, `abgelehnt`, `archiviert`) hat seine eigenen Maps in `src/components/feedback/constants.ts` — bewusst getrennt, weil andere Semantik. Beim Hinzufügen neuer Status-Werte: Vorgang-Status zentral, Feedback-Status in der Feedback-Domain.
10. **Infrastructure-Writes müssen `atomicWrite()` / `appendToFile()` verwenden** (Phase 1a) — direkter `FileSystemWritableFileStream` umgeht die `.tmp`+Rename+`.backup`-Rotation und kann bei Crash korrumpieren. **Dokumentierte Ausnahme**: [src/phase2/triage/run-log.ts](src/phase2/triage/run-log.ts) schreibt bewusst per `createWritable({ keepExistingData: true })` direkt — siehe Datei-Kommentar (O(n)-Append wäre bei 13k+ Antraegen prohibitiv, Risk-Profil per Run-spezifischer JSONL akzeptabel).
11. **Neue Features hinter Flag setzen** (v1.10) — wenn ein Feature optional sein soll, in `scripts/config-schema.mjs` eine Flag ergänzen, in `src/config/feature-flags.ts` einen Helfer, und die betroffenen Stellen (Plugin-Filter, Komponenten-Rendering) damit gaten. OpenRouter in Prod-Builds wird zusätzlich in `validateConfig()` verboten
12. **Antrag-Status: zwei Domaenen, eine Kategorie** `[test: no-direct-status-compare]` — `Antrag.status` / `AntragListItem.status` / `Verbund.status` ist als `AntragStatusRaw = string & { __brand }` typisiert (Bauantrag-Snake-Case ODER Foerderantrag-CSV-Rohwerte). Direkter Vergleich gegen Literal (`status === 'bewilligt'`) verboten — Kategorie-Helper aus [src/core/utils/status-canonical.ts](src/core/utils/status-canonical.ts) nutzen (`isOpenStatus`, `isBewilligtStatus`, `isBegleitungStatus`, `isClosedStatus`, `getStatusCategory`). Convention-Test `no-direct-status-compare` ([src/__tests__/codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)) faengt eindeutige Verstoesse. Semantik-Details (Foerderantrag-Domain hat keinen final-`abgelehnt`-Endzustand, Begleit-Phase mit VN-/ZB-/Widerruf-Stati, Toggle `bearbeiter_inkl_begleitung` Doppelwirkung, Frist-Berechnung phasen-abhaengig): [docs/architecture/antrag-status-domaenen.md](docs/architecture/antrag-status-domaenen.md).
13. **Foerderantraege-Seeds kommen aus echten CSVs** (v2-Seed, ab Mai 2026) — Die Dev-Seed-Antraege werden nicht mehr in TypeScript handgeschrieben, sondern in [docs/fixtures/](docs/fixtures/) als anonymisierte Real-Foyer-CSVs abgelegt. Der Seed-Loader unter [src/core/services/seed/fixture-loader.ts](src/core/services/seed/fixture-loader.ts) durchlaeuft den vollen `importCsvSource`-Pfad — Bugs im Parser, Column-Mapping oder Merger werden so im Seed-Lauf sichtbar. Schemas (Master + Secondaries via FKZ-Join) sind in `docs/fixtures/schema-*.ts` committet, die CSVs sind via globalem `*.csv`-Pattern in `.gitignore` lokal-only. Fehlende CSVs → Loader returned graceful 0 Antraege, App startet trotzdem. Encoding-Pipeline: `scripts/normalize-fixture-csvs.mjs` konvertiert windows-1252 → UTF-8 idempotent als `prebuild`/`predev`. Migration: Seed-Flag heisst `seed-complete-v2` (Pre-v2 IDBs behalten ihre alten FA-2026-XXX-Antraege als Geister bis manuelles Reset im Kurator-Panel). Neue Fixture-CSV ergaenzen: (1) CSV in `docs/fixtures/` ablegen, (2) `schema-X.ts` schreiben, (3) `FIXTURE_DEFS` in `fixture-loader.ts` ergaenzen.
14. **Toggleable Pills brauchen konstante Breite** (Auslastungs-Modul Lesson) — bei farbcodierten Pills mit aktiv/inaktiv-Toggle (z.B. `KategoriePill` mit `active`-Prop): den optionalen Inhalt (Häkchen ✓) IMMER rendern, im Inaktiv-Modus mit Tailwind-`invisible` (CSS `visibility: hidden`). Sonst horizontaler Layout-Shift in Tabellen. Kontrast aktiv/inaktiv NICHT über `opacity-40` — wirkt wie disabled. Stattdessen Inactive-Variante mit outline-only (siehe [DESIGN_GUIDE.md](DESIGN_GUIDE.md) Kapitel 5 „Toggleable Pill").
15. **Async UI-Aktionen: `useAsyncAction` ist Standard** `[test: no-raw-async-onclick]` — `try/finally` ohne `catch` + `onClick={() => void asyncFn()}` schluckt Promise-Rejections silent. Unter `file://` ist die Browser-Console oft nicht offen, der User sieht nichts. **Pflicht für neuen Code**: `useAsyncAction(fn)` aus [src/core/hooks/useAsyncAction.ts](src/core/hooks/useAsyncAction.ts) — liefert `{ run, busy, error, clearError }`, fängt Rejections automatisch und schützt vor Doppelklick. Cheatsheet: [docs/agents/async-error-pattern.md](docs/agents/async-error-pattern.md). Referenz-Migration: [CsvSourcesPage.tsx](src/plugins/csv-sources-kuration/CsvSourcesPage.tsx). Hand-gerolltes try/catch (Pattern: `try { ... } catch (err) { setError(err.message); } finally { setBusy(false); }` + Error-Banner) bleibt fuer Edge-Cases zulässig (z.B. wenn Inline-Validierung vor dem Async-Call läuft). **Bestehender Code**: Grep nach `onClick={() => void` zeigt ~50 ältere Vorkommen (vor allem in `src/plugins/auslastung/` + `src/plugins/dev-infrastructure-test/`). Diese sind opportunistisch zu migrieren — wenn die Datei ohnehin angefasst wird, dabei mitnehmen.
16. **Multi-Step-Setup: EIN finaler setState + EIN persist** (Auslastungs-Modul Lesson) — der `useAuslastungData`-Store hat einen `if (saving) return;`-Lock im `persist`. Mehrere parallele `persist`-Aufrufe (z.B. wenn jede `upsertX`-Action ihren eigenen persist triggert) fallen raus → inkonsistenter Save. Im finalen Wizard-Schritt alle Mutationen in EINEM `setState({...})`-Call sammeln, dann EIN `await persist(storage)`. Gleiche Regel gilt für andere Stores mit save-lock-Pattern (`feedbackService`-Sync z.B.). Verallgemeinerung siehe Pitfall #20.
17. **Auslastungs-AnonymMap nutzt ausschliesslich `tib_kuerz`** — nicht BIB/ZTP/PFM. `bootstrapKuerzelMap()` filtert hart auf das `tib_kuerz`-Feld. Ehemalige Bearbeiter (TIBs, die im aktuellen Programm nicht mehr aktiv sind) werden bewusst mitgezählt — deren historische Antraege liefern beim Embedding-Match wertvolle Kompetenz-Referenzen für neue MAs mit ähnlichem Hintergrund. Wer das filtern möchte (z.B. „nur aktive MAs"), muss eine separate Schicht oberhalb der AnonymMap einziehen.
18. **Auslastungs-Modul: AnonymMap kommt aus der persistenten kuerzel-map** — die Sidecar-Datei `_intern/auslastung-kuerzel-map.json` ist append-only: einmal vergebene anonIds bleiben stabil, neue Kürzel hängen hinten an (kein Identitäts-Drift bei alphabetischer Mitten-Insertion). Code-Konsumenten lesen `cache.anonymMap` aus [useAntraegeCache.ts](src/plugins/auslastung/hooks/useAntraegeCache.ts) bzw. nutzen [`useKuerzelMap`](src/plugins/auslastung/hooks/useKuerzelMap.ts) + [`buildAnonymMapFromKuerzelMap`](src/plugins/auslastung/services/kuerzel-map.ts). Unit-Tests: `buildAnonymMapForTests(antraege)` aus [`__tests__/test-helpers.ts`](src/plugins/auslastung/__tests__/test-helpers.ts) (intern: `bootstrapKuerzelMap` + `buildAnonymMapFromKuerzelMap` — derselbe Code-Pfad wie Prod).
19. **Embedding-Modell-Wechsel ist team-weiter Bruch** — wenn ein Kurator das Embedding-Modell via [ActionCardModels.tsx](src/plugins/kurator/actions/ActionCardModels.tsx) wechselt, werden ALLE bestehenden Embedding-Caches strukturell inkompatibel: lokaler Suchindex muss neu gebaut werden, der gespiegelte Auslastungs-Stage-2-Korpus auf SMB (`_intern/auslastung-embedding-corpus.bin`) ist für alle anderen Teammitglieder unbrauchbar bis er von einem PL mit dem neuen Modell neu gebaut wird (~46 min), und die Kategorie-Centroids in `auslastung.json` sind falsch dimensioniert. Die UI zeigt vor dem Wechsel einen Confirm-Dialog mit allen drei Konsequenzen — Wechsel nicht leichtfertig durchführen. Cheatsheet für das *Hinzufügen* eines Modells (ohne Aktivierung): [docs/agents/add-embedding-model.md](docs/agents/add-embedding-model.md).
20. **Auslastungs-Store: Multi-Mutation in EINEM `setState` + EINEM `persist`** — Verallgemeinerung von Pitfall #16. Jede zusammengehörende Mutationsserie (Import + Klassifizierung + Zuweisung, oder Setup-Wizard-Abschluss) muss alle Mutationen in einem finalen `setState({...})`-Block sammeln, gefolgt von EINEM `await persist(storage)`. Mehrere parallele `persist`-Aufrufe (z.B. eine pro Action) fallen durch den `if (saving) return;`-Lock im Store, was zu inkonsistenten Saves führt. In der Git-History sichtbar als wiederkehrende „doppelte Zeilen"-Fixes. Gleiche Regel gilt für andere Stores mit Save-Lock-Pattern (z.B. `feedbackService`-Sync).
21. **Feedback-Status nicht als String-Literal vergleichen** `[test: no-direct-feedback-status-compare]` — Analog Pitfall #12 (Antrag-Status), aber für die Feedback-Domain. `if (item.kurator_status === 'geplant')` ist refactor-fragil (Tippfehler, IDE-Rename-Lücke, Status-Rename übersieht Stellen). Für **Vergleiche** die Konstante `FEEDBACK_STATUS` bzw. die Prädikate `istOffen` / `istUmgesetzt` / `istArchiviert` aus [src/core/services/feedback/feedback-status.ts](src/core/services/feedback/feedback-status.ts) nutzen (für **Rendering** weiterhin `STATUS_LABELS` / `STATUS_COLORS` aus [src/components/feedback/constants.ts](src/components/feedback/constants.ts)). Beim Hinzufügen eines neuen Status: Cheatsheet [docs/agents/add-feedback-status.md](docs/agents/add-feedback-status.md). **Maschinell erzwungen** durch den Convention-Test `no-direct-feedback-status-compare` in [src/__tests__/codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts) (Inline-Ausnahme: `// allow-feedback-status-literal: <grund>`).
22. **Unicode-Kürzel (THÜ/BIB/ZTP) immer NFC-normalisieren** — Umlaut-Kürzel kommen in IDB/JSON je nach Browser/OS in NFC oder NFD an. Wer Kürzel in der `kuerzel-map` speichert oder daraus liest, muss `s.normalize('NFC')` durchlaufen (`bootstrapKuerzelMap()` in [src/plugins/auslastung/services/kuerzel-map.ts](src/plugins/auslastung/services/kuerzel-map.ts)), sonst silent-mismatch in `findAnonId(kuerzel)` und doppelter `anonId`-Eintrag für „THÜ" vs „THÜ". Tritt v.a. bei manuellen Imports aus Excel oder beim Onboarding-XLSX-Upload auf. Test-Helper: `__tests__/test-helpers.ts:buildAnonymMapForTests()` läuft denselben Pfad wie Prod.
23. **Sidecar-Dateien: Schreib-Profil bewusst wählen** — Kombiniert mit Pitfall #10. Drei Profile, je nach Datei-Charakter:
    - **Idempotent-overwrite** (Standard, Single-Source-of-Truth): `atomicWrite()` mit Backup-Rotation. Beispiel: `_intern/auslastung.json`, `_intern/feedback/feedback.json`.
    - **Append-only** (immutable History, Order matters): `appendToFile()` ohne Rotation, mit Version-Feld im Schema. Beispiel: `_intern/audit-log.jsonl`, `_intern/auslastung-kuerzel-map.json` (Pitfall #18 erzwingt diese Append-Semantik).
    - **Atomic ohne Backup** (große Binär-Files, Recovery via Re-Build): `atomicWrite(..., { skipBackup: true })`. Beispiel: `_intern/auslastung-embedding-corpus.bin` (~40 MB; Backup-Rotation würde die Share-Quota fluten).
    Entscheidung beim Anlegen einer neuen Sidecar als Header-Kommentar in der Datei festhalten. Cheatsheet [docs/agents/add-sidecar-persistence.md](docs/agents/add-sidecar-persistence.md) erweitern, wenn neue Profile dazukommen.
24. **MA-Selbst-Daten gehen über den Personal-Handle, nicht direkt nach `auslastung.json`** (v2.6) — Nicht-Kuratoren haben seit v2.0 nur `read` auf dem Daten-Share (Pitfall: `atomicWrite` auf `_intern/auslastung.json` wirft für sie `NotAllowedError`). Wer eine MA-Selbst-Eingabe persistiert (z.B. „Meine Technologien"), schreibt in `ZAH/auslastung-profil.json` im persönlichen Ordner via `writeAuslastungProfil` ([persoenliches-profil.ts](src/plugins/auslastung/services/persoenliches-profil.ts)); die PL sammelt über den User-Folders-Root ein (`profil-einsammeln.ts` → `applyAggregatedProfiles`-Store-Action) und merged in `auslastung.json` **ohne** PL-only-Felder (Kapazität, `aktiv`, `abschlagProzent`, `antragstypUeberschreibung`) zu überschreiben. Cross-Browser: beim Tab-Mount IMMER `loadAuslastungProfil` (persönlicher Ordner → IDB-Cache) priorisieren, NICHT den `auslastung.json`-Record (der ist erst nach PL-Aggregation aktuell). Spiegelbild des Feedback-Outbox-Flows (Pitfall #23 + [v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md)). **Ausnahme seit Pitfall #25:** Die PL (pl-Variante) hat per `features.datenShareSchreibrecht` Schreibrecht auf dem Daten-Share und schreibt `auslastung.json` (inkl. Klassifizierungen) direkt — der NotAllowedError-Fall oben gilt nur für echte Nicht-Kurator-Builds (prod ohne Flag).
25. **`features.datenShareSchreibrecht` hebt das v2.0-read-only-Hardening rollen-gezielt auf** `[test: no-hardcoded-datenshare-mode]` — Der Daten-Share-Picker/Grant-Mode (`read` vs `readwrite`) wird AUSSCHLIESSLICH über `canWriteDatenShare(isKurator)` ([feature-flags.ts](src/config/feature-flags.ts)) entschieden = `isKurator || features.datenShareSchreibrecht`. Der Flag ist in `dev` + `pl` + `kurator` true: bei `pl` damit die PL die Auslastungs-Klassifizierung nach `_intern/auslastung.json` schreiben kann (sonst silent `NotAllowedError`, siehe Pitfall #24); bei `kurator` (seit v2.30.1) weil alle kurator-User AD-seitig SMB-Schreibrecht haben und die Variante durchgehend `readwrite` halten soll — sonst zeigt der `StartupScreen` VOR dem Passwort-Login (wo `is_kurator` noch `false` ist) die irreführende „nur lesend"-Downgrade-Wall. Read-only (`datenShareSchreibrecht: false`) gilt nur für `prod` (End-User). Alle Mode-Entscheidungen routen durch diesen Helper: `WelcomeScreen`, `StartupScreen` (initial pick + Start), `SpeicherTab`, `refreshAllPermissions` + `needsDatenShareDowngrade` ([smb-handle.ts](src/core/services/infrastructure/smb-handle.ts)), `useVisibilityPermissionProbe`. Wer eine neue Stelle einführt, die den Daten-Share-Mode braucht, MUSS `canWriteDatenShare()` nutzen — nicht erneut `isKurator ? 'readwrite' : 'read'` hart kodieren (**maschinell erzwungen** durch Convention-Test `no-hardcoded-datenshare-mode`). Die kurator-only-Blöcke (User-Folders-Root, DMS-Sources) in `refreshAllPermissions` bleiben bewusst an `opts.isKurator` (nicht `canWriteDatenShare`). Bestehende pl-Installationen mit altem `read`-Handle werden beim nächsten Start über die Permission-Kette transparent auf `readwrite` hochgestuft (ein Browser-Prompt).
26. **Übernahme-Wünsche („Kann ich übernehmen") laufen über den Personal-Handle, nicht per Direkt-Write** (v2.9) — Zweite Instanz des Personal-Folder-Patterns aus Pitfall #24 (NICHT in `auslastung.json` schreiben — prod-User sind read-only → `NotAllowedError`). Der Homepage-Button `NeueAntraegeFuerDich` schreibt den Wunsch via `writeUebernahmeWuensche` nach `ZAH/auslastung-uebernahme.json` ([uebernahme-wuensche.ts](src/plugins/auslastung/services/uebernahme-wuensche.ts)); die PL sammelt im Zuweisung-Tab per Button „Übernahme-Wünsche einsammeln" über den User-Folders-Root ein (`collectUebernahmeWuensche` → `applyUebernahmeWuensche`-Store-Action → `mergeWuenscheIntoZuweisungen`, [uebernahme-einsammeln.ts](src/plugins/auslastung/services/uebernahme-einsammeln.ts)) und merged sie als `Zuweisung{status:'selbst'}`. Merge-Regeln: dedupe per `(antragId, anonId)`, `freigegeben`/`abgelehnt` NIE überschreiben, **Retraktion** (Undo) entfernt selbst-Einträge nur für anonIds, deren Datei im aktuellen Batch gelesen wurde. Homepage liest „meine Wünsche" via `useMyUebernahmeWuensche` aus dem persönlichen Ordner (NICHT `auslastung.json` — der ist erst nach PL-Einsammeln aktuell, analog Pitfall #24); vorgemerkte Anträge bleiben gedämpft sichtbar mit „Rückgängig". Mehrere MAs können denselben Antrag wünschen → PL sieht alle Interessenten und weist gezielt einem zu. Spiegelbild von Profil-Einsammeln (Pitfall #24) + Feedback-Outbox (Pitfall #23).
27. **Bearbeiter-Kürzel kommt aus `useMeinKuerzel()`, nicht direkt aus `profile.bearbeiter_kuerzel`** (v2.11) `[test: no-direct-bearbeiter-kuerzel]` — Mit der MA-Login-Wall ist das effektive Kürzel im Login-Modus das aus dem Passwort entschlüsselte **Session-Kürzel** (sessionStorage, [useMAIdentity](src/core/hooks/useMAIdentity.ts)), NICHT der Profil-Wert (im Login-Modus read-only und ggf. leer). Neue Kürzel-Konsumenten (Dashboard „Meine Anträge"/„Meine Fristen", Selbsteintragung, Übernahme-Wünsche, Feedback-Reviewer, „nur meine"-Filter) MÜSSEN [`useMeinKuerzel()`](src/core/hooks/useMeinKuerzel.ts) nutzen (Session > Profilfeld, drop-in-kompatibel zu `profile?.bearbeiter_kuerzel`, Rückgabe `string | undefined`) — sonst lesen sie im Login-Modus den leeren/veralteten Profilwert statt der echten Identität. Der Hook greift nur bei `isMaLoginEnabled()` + angemeldet; sonst (kein Login, weil Zugangsdatei fehlt, oder Varianten ohne `maLogin` wie pl/kurator/demo) liefert er weiter das editierbare Profilfeld. **Im Login-Modus ist nur EIN einzelnes echtes Kürzel verfügbar** — die früheren Profil-Spezialwerte „MUE,SCH" (Vertretung) / „alle" (Übersicht) stehen prod-Usern dann nicht mehr zur Verfügung (by design: Identität ist abgeleitet, nicht frei; die PL behält ohne MA-Login volle Freiheit). Spiegelt das v2.11-Kürzel-aus-Passwort-Modell. **Maschinell erzwungen** durch den Convention-Test `no-direct-bearbeiter-kuerzel` in [src/__tests__/codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts) (verbietet direkten `.bearbeiter_kuerzel`-Lesezugriff; Pre-Login-Ausnahme via `// allow-direct-kuerzel: <grund>` — siehe `StartupScreen`).
28. **Rollen-Passwort (`auth`-Block) gehört in den Build, nicht von Hand in die Config** (v2.16) — Die pl-/kurator-Wall ([AppPasswordGate](src/core/AppPasswordGate.tsx)) prüft gegen `runtimeConfig.auth` (Salt + AES-GCM-Verifier, build-time eingebacken). Niemals `salt`/`verifier` selbst tippen — `npm run set-password -- <pl|kurator> "<pw>"` ([scripts/set-app-password.mjs](scripts/set-app-password.mjs)) erzeugt sie mit **denselben** Krypto-Params wie [crypto.ts](src/core/services/infrastructure/crypto.ts) (PBKDF2-200k, AES-GCM-256, Blob `[12B IV][ct+tag]`). Build↔Runtime-Param-Match ist der kritische Punkt: ändert sich ein Param in crypto.ts (Iterationen, IV-Länge), muss set-app-password.mjs mitgezogen werden, sonst schlägt jeder Login fehl. Drei Fallen: (a) **Kurator-Eskalation darf nicht verloren gehen** — der Gate-Erfolg muss in der kurator-Variante (`isKuratorMenusEnabled()`) `is_kurator` setzen + `useKuratorSession.activateSynthetic` rufen (Schreib-Buttons via `isActive`, Audit-Identität via `kuratorName`) + `refreshAllPermissions({isKurator:true})` (readwrite-Handle, Pitfall #25); nur dann sind Menüs sichtbar UND Schreiben möglich. Menü-Gate ist `profile.is_kurator` ([ShellLayout.tsx](src/core/ShellLayout.tsx)), NICHT die Gate-Session. (b) **Passwort ändern = Rebuild** (set-password + build:pl/build:kurator); ein im Build eingebackener Verifier ist nicht zur Laufzeit änderbar. (c) **Gate-Session ≠ Kurator-Session**: das Gate nutzt sessionStorage (`tf-app-gate`, Tab-TTL, [useAppGateSession](src/core/hooks/useAppGateSession.ts)) nur für „Wall zeigen?"; die Schreib-Berechtigung läuft weiter über `useKuratorSession` (IDB-12h, Reload → `rehydrate`). `validateConfig()` bricht ab, wenn `auth.required=true` ohne `salt`/`verifier`. Sicherheits-Einordnung: Casual-Access-Gate, Verifier offline brute-forcebar (starkes Passwort) — Single-Team-Trust-Modell.
29. **Gutachten-Kurzfassung: Verbund-Ebene, Relation über `kv`-Tag — kein CSV-Write** (v2.68) — Ein Gutachten / eine Kurzfassung gilt pro **Verbund** (die Vorhabensbeschreibung existiert nur einmal pro Verbund), NICHT pro Teilvorhaben: die Sektion sitzt in [VerbundDetail.tsx](src/plugins/antraege/VerbundDetail.tsx), nicht in `TvDetailBlock`. Persistenz-Key **und** VB-Relations-Tag = die **Verbund-ID** (`verbund.verbund_id`; bei Solo/pseudo das echte Aktenzeichen). Aufgenommene Dokumente werden über eine **Tag-Relation** im Dokumente-Store zugeordnet (`doc:*` mit `tags:[<verbund-key>, <typ>]`) — **niemals** in `Antrag.dokumente` (CSV-Record) schreiben: prod-User sind read-only (`NotAllowedError`, vgl. Pitfall #24) und es verletzt die `_field_sources`-Disziplin. Der Kurzfassung-Record liegt im generischen `kv`-Store unter `gutachten-kurzfassung:<key>` — bewusst **kein** dedizierter Object-Store + `version`-Bump (vermeidet das `file://`-`onblocked`-Upgrade bei parallel offenen Varianten, vgl. [recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md)). Die FKZ-Erkennung der Aufnahmefläche akzeptiert Verbund-FKZ UND alle TV-FKZ (`knownIds`, Substring-Match — fängt auch `ZEP…`-Verbund-IDs); uneindeutig → der Bearbeiter ordnet manuell zu. Detail: [docs/architecture/gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).
