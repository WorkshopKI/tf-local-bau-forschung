# CLAUDE.md — TeamFlow Local App

## Project Overview

TeamFlow Local is a serverless browser app for collaborative task management with AI integration, deployed exclusively via file server (`file://` protocol). A research-grants team manages funding applications (Förderanträge), plans capacity, classifies documents, and uses AI-powered hybrid search — all without IT infrastructure.

**Read `DESIGN_GUIDE.md` for visual design rules before making any UI changes.**

## Ich will… → wo nachsehen

Decision-Tree für häufige Aufgaben. Erst hier nachsehen, **bevor** du die Codebase scannst:

| Aufgabe | Wo nachsehen |
|---------|--------------|
| Plugin / CSV-Feld / Filter / IDB-Store / Feedback-Status / Embedding-Modell / Tab / … anlegen | [docs/agents/](docs/agents/README.md) — passenden Cheatsheet wählen |
| UI-Patch (Komponenten, Farben, Tokens) | [DESIGN_GUIDE.md](DESIGN_GUIDE.md) |
| Tabellenartige Seite mit Detail/Editor (Master-Detail-Split) | [docs/agents/add-table-detail-page.md](docs/agents/add-table-detail-page.md) — `MasterDetailLayout` |
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
| Streamlit-Bridge (Bookmarklet-Installer + postMessage-Transport zum internen LLM) | [docs/architecture/streamlit-bridge.md](docs/architecture/streamlit-bridge.md) |
| Feedback-System (FAB + Board + Sponsoring) | [docs/architecture/feedback-system.md](docs/architecture/feedback-system.md) |
| Phase-2 Triage + Review-Queue | [docs/architecture/phase2-triage.md](docs/architecture/phase2-triage.md) + [phase2-review-queue.md](docs/architecture/phase2-review-queue.md) |
| v2.0 Handle-Architektur (Offline-Modus, Feedback-Outbox) | [docs/architecture/v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md) |
| Storage / Search / Theming / Onboarding-Tour | [docs/architecture/runtime-layers.md](docs/architecture/runtime-layers.md) |

## Ignorierte Verzeichnisse

Folgende Pfade NICHT lesen oder referenzieren beim Arbeiten am Code:

- `_archive/` — Historische Architektur-Docs, erledigte Audits, überholte Test-Daten, archivierte Eval-Reports (`_archive/eval-reports/`). Enthält die alte MVP-Architektur (postMessage-AI-Bridge, Vorgang-zentriertes Datenmodell, "Admin"-Terminologie) und führt bei aktuellem Code zu falschen Annahmen. Ein Agent, der hier sucht, bekommt mit hoher Wahrscheinlichkeit überholte Guidance.
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
- **IDB PRO BUILD-VARIANTE GETRENNT** (v2.87): Der IndexedDB-Name ist pro Variante suffigiert — `teamflow-<outputFilename>` (z.B. `teamflow-zah-prod` / `teamflow-zah-pl`), abgeleitet via `getVariantDbName()` in `src/config/runtime-config.ts`. Unter `file://` teilen sonst alle Varianten denselben Origin und damit **dieselbe** DB (Datenverlust beim Varianten-Wechsel, Bug-Klasse 1/3). Varianten-Wechsel auf einem Rechner: die neue Variant-DB startet **leer** und lädt frisch aus dem Daten-Share (kein geteilter IDB-Zustand, **keine** Migration — Share = Source of Truth, IDB = Cache). Hinweis: localStorage + die Share-Dateien bleiben origin-/share-weit geteilt — die „nicht zwei Varianten gleichzeitig schreibend offen"-Regel gilt für Share-Writes weiter.
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

**Kohäsion vor Zeilenzahl** — eine Datei = **eine kohärente Verantwortung**, nicht eine Zeilenzahl. Ab **~400–500 Zeilen** prüfen, ob mehrere Verantwortlichkeiten vermischt sind (dann entlang dieser Grenzen aufteilen); **nie nach Zeilenzahl splitten** (künstliches Zerreißen kohärenter Einheiten = Fehlalarm). Aufteilung **opportunistisch**, wenn ein Patch die Datei ohnehin anfasst. Detail + Beispiele (kohärente Daten-Files / State-Machines / Orchestratoren dürfen größer sein; echte Mehrfach-Verantwortung wie UI-Komponenten / Multi-Domain-Services trennen): [docs/architecture/project-structure.md](docs/architecture/project-structure.md#file-size-limit).

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

**Skill-Service-Struktur** (v2.89): `src/core/services/skills/` ist ein Dach mit drei kohäsiven Submodulen — `run/` (Ausführung/Parsing), `registry/` (Skill-/Regel-Datenmodell, Check-Engine, Seed, Storage), `tweaks/` (private User-Tweaks). Import immer über das Dach-Barrel `@/core/services/skills`; `splitSentences`/`CheckResult`/`SkillModifierKey` haben dort genau **eine** Heimat (in `registry/`).

Detail (4 Bausteine, Datenfluss, Skill-Struktur, Run-Splitting im DOCX-Füller, Persistenz-Keys, Generalisierungs-Notizen): [docs/architecture/gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

### Legacy: Vorgang-Typ

`src/core/types/vorgang.ts` (`Vorgang` + `VorgangStatus`) — Überbleibsel des alten Vorgang-zentrierten Datenmodells. Die zugehörige Bauantrag-Demo-Domäne (Plugin, Seed, Workflow-/Artefakt-Stack) wurde mit **v2.88 entfernt**; übrig bleibt der `Vorgang`-Typ als reines Projektions-Shape für die **Home-Dashboard**-Aggregation (`AntragVorgang = Vorgang & {…}` in [dashboardAggregate.ts](src/plugins/home/dashboardAggregate.ts)) — kein eigener IDB-Store mehr. **Neue Features verwenden das `Antrag`-Interface aus dem CSV-Schema (`src/core/types/csv/types.ts`), nicht `Vorgang`.**

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
- `configs/prod.config.json` — Produktion (End-User), nur Home + Förderanträge + Einstellungen, kein Kurator-Login
- `configs/kurator.config.json` — Produktion (Kurator-Rolle), Standard-Sidebar wie prod + Kuration-Menüs nach Login
- `configs/pl.config.json` — Produktion (Projektleitung), Home + Förderanträge + Auslastung + Einstellungen, kein Kurator-Login
- `configs/_template.config.jsonc` — kommentierte Referenz (nicht direkt bauen)
- `configs/_shared.json` (v2.0.2) — **Org-weite invariante Defaults** (aktuell: `data.fixedDataSharePath` + `data.expectedFolderName`). `build-with-config.mjs` + `vite.config.ts` mergen diese Datei mit der Variant-Config via `deepMerge` aus [scripts/config-schema.mjs](scripts/config-schema.mjs).

Sichtbarkeits-Matrix (was steht in der Sidebar):

| Plugin | dev | prod | kurator (vor Login) | kurator (nach Login) | pl |
| --- | --- | --- | --- | --- | --- |
| Home | ✓ | ✓ | ✓ | ✓ | ✓ |
| Förderanträge | ✓ | ✓ | ✓ | ✓ | ✓ |
| Auslastung | ✓ | – | ○ | ○ | ✓ |
| Dokumente | ✓ | – | – | – | – |
| Suche | ✓ | – | ✓ | ✓ | ✓ |
| Chat | ✓ | ✓ | ✓ | ✓ | ✓ |
| Feedback Übersicht | ✓ | ✓ | ✓ | ✓ | ✓ |
| Einstellungen | ✓ | ✓ | ✓ | ✓ | ✓ |
| Kurator-Toggle in Einstellungen | ✓ | – | ✓ | ✓ | – |
| Kuration-Menüs (Suchindex, Programme, CSV, DMS, Filter, Feedback, Review) | ✓ | – | – | ✓ | – |

○ = **Auslastung in kurator nur als „Themen-Vektoren"** (v2.56, `features.auslastungNurKorpus`): schlanker Korpus-Pflege-View zum Aktuell-Halten des Embedding-Katalogs — **kein** MA-Auslastung/Zuweisung/Kompetenzen, nur „Inkrementell" (kein Vollbuild, der bleibt dev-exklusiv). Sichtbar als Workflow-Plugin (unabhängig vom Kurator-Toggle).

Die kurator-Variante ist der einzige Produktions-Build mit `features.kuratorMenus: true`. Sie kombiniert User-seitig einen schlanken Stack (Förderanträge + Einstellungen) mit allen Kuration-Plugins, die erst nach Aktivierung des Kurator-Toggles in den Einstellungen erscheinen.

Build-Kommandos:

```bash
npm run build:dev       # → dist-single/dev/zah-dev.html
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

**Feature-Flag `features.auslastung`** (default false; dev/pl true): aktiviert das Auslastungs-Plugin (Sidebar + Routing). Routing-Pflicht + Modul-Detail: [docs/agents/add-plugin.md](docs/agents/add-plugin.md), [docs/architecture/auslastung.md](docs/architecture/auslastung.md).

**Feature-Flags `features.maLogin` / `features.maVerwaltungPasswort`** (v2.11, default false): `maLogin` (prod/dev) erzwingt die MA-Login-Wall (Kürzel aus Passwort entschlüsselt → `useMeinKuerzel`, Pitfall #27); `maVerwaltungPasswort` (pl/dev, braucht `datenShareSchreibrecht`) blendet „Zugangspasswort generieren" ein. Detail: [docs/architecture/v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md).

**Feature-Flag `features.gutachtenKurzfassung`** (v2.68, optional, default false via `=== true`, NICHT in `requiredFlags`; dev true): blendet die KI-Kurzfassung-Sektion auf der Verbund-Detailseite ein (kein Plugin/Routing, nur `isGutachtenKurzfassungEnabled()`). Detail: [docs/architecture/gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

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

Versionshistorie: jüngste Versionen in **[CHANGELOG.md](CHANGELOG.md)**, ältere in **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)** (beide append-only, chronologisch absteigend). Migrationsnotizen stehen beim jeweiligen MAJOR-Block.

## Doku-Konventionen

1. Docs beschreiben den **Ist-Zustand**; Überholtes wird umgeschrieben, nicht per Korrektur-Absatz angehängt (Historie → Git/CHANGELOG).
2. Die Pitfall-Liste unten ist ein **Index**: pro Pitfall eine fett gesetzte Ein-Satz-Regel + `[test:…]`-Marker (falls vorhanden) + Link; das Detail lebt genau **einmal** im Themen-Doc.
3. Pitfall-Nummern sind **append-only** (Code/Commits/`describe`-Strings referenzieren sie); überholte behalten ihre Nummer + Ein-Zeiler „(überholt, siehe …)".
4. Neue Lesson Learned: **grep-bar → Convention-Test** ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)); sonst [recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md); ein nummerierter Pitfall nur bei projektweiter Geltung.

## Common Pitfalls

> **Hinweis zur Nummerierung**: append-only. Niemals umnummerieren — Querverweise (in Code-Kommentaren, anderen Docs, Commit-Messages) werden sonst ungültig. Wer einen Pitfall für überholt hält, markiert ihn mit *„(überholt seit vX.Y, siehe …)"* statt ihn zu löschen.
>
> **Maschinell erzwungen**: Pitfalls mit `[test: …]` fängt [codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts) (Vitest, Inline-Ausnahme `// allow-<rule>: <grund>`). Aktuelle Convention-Tests: `no-direct-status-compare` (#12), `no-direct-feedback-status-compare` (#21), `no-direct-bearbeiter-kuerzel` (#27), `no-hardcoded-datenshare-mode` (#25), `no-raw-async-onclick` (#15), `no-raw-worker` (#5), `no-raw-modal` (Klasse 7) + `no-new-tf-ui-files` (P1a/P1b) sowie die Klasse-1/-5-Checks `import-requires-store-refresh`, `antraege-write-requires-listview-rebuild` und `no-hardcoded-canonical-field`. **Wiederkehrende, NICHT-nummerierte Bug-Klassen** (Cold-Start-Store-Refresh, FSAPI-One-Prompt-per-Gesture, Parallel-Varianten-Storage, machine-lokale Embedding-Caches) stehen separat in [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).

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
9. **Status-Mappings sind domain-getrennt: Vorgang-Status (`status-mappings.ts`) und Feedback-Status haben getrennte Maps; Werte je Domain pflegen.** → [antrag-status-domaenen.md](docs/architecture/antrag-status-domaenen.md)
10. **Infrastructure-Writes immer über `atomicWrite()` / `appendToFile()` (nie roher `FileSystemWritableFileStream`).** → [add-sidecar-persistence.md](docs/agents/add-sidecar-persistence.md)
11. **Neue optionale Features hinter ein Flag (`config-schema.mjs` + `feature-flags.ts` + Gating); OpenRouter in Prod-Builds verboten.** → [add-feature-flag.md](docs/agents/add-feature-flag.md)
12. **`Antrag.status` / `Verbund.status` nie gegen ein Literal vergleichen — Kategorie-Helper aus `status-canonical.ts` nutzen.** `[test: no-direct-status-compare]` → [antrag-status-domaenen.md](docs/architecture/antrag-status-domaenen.md)
13. **Förderantrag-Dev-Seeds aus den anonymisierten Fixture-CSVs (`docs/fixtures/`) über den vollen `importCsvSource`-Pfad, nicht handgeschrieben.** → [fixtures/README.md](docs/fixtures/README.md)
14. **Toggleable Pills mit konstanter Breite rendern (Häkchen via `invisible`, kein `opacity-40`).** → [DESIGN_GUIDE.md](DESIGN_GUIDE.md) Kap. 5
15. **Async-UI-Aktionen über `useAsyncAction` (kein `onClick={() => void asyncFn()}`).** `[test: no-raw-async-onclick]` → [async-error-pattern.md](docs/agents/async-error-pattern.md)
16. **Multi-Step-Store-Mutationen in EINEM finalen `setState` + EINEM `persist` sammeln (Save-Lock verwirft parallele persists).** → [auslastung.md](docs/architecture/auslastung.md)
17. **Auslastungs-AnonymMap nutzt ausschließlich `tib_kuerz` (ehemalige Bearbeiter bewusst inklusive als Kompetenz-Referenz).** → [auslastung.md](docs/architecture/auslastung.md)
18. **AnonymMap kommt aus der append-only `auslastung-kuerzel-map.json` (stabile anonIds, kein Sort-Drift).** → [auslastung.md](docs/architecture/auslastung.md)
19. **Embedding-Modell-Wechsel bricht alle Caches team-weit (Suchindex + Auslastungs-Korpus + Kategorie-Centroids).** → [add-embedding-model.md](docs/agents/add-embedding-model.md)
20. **Verallgemeinerung von #16: jede Store-Mutationsserie mit Save-Lock = ein `setState` + ein `persist`.** → [auslastung.md](docs/architecture/auslastung.md)
21. **Feedback-Status nie als Literal vergleichen — `FEEDBACK_STATUS` / Prädikate (`istOffen`/`istUmgesetzt`/`istArchiviert`).** `[test: no-direct-feedback-status-compare]` → [feedback-system.md](docs/architecture/feedback-system.md)
22. **Umlaut-Kürzel (THÜ/BIB/ZTP) immer `s.normalize('NFC')` vor Map-Lookup/Speicherung.** → [auslastung.md](docs/architecture/auslastung.md)
23. **Sidecar-Schreib-Profil bewusst wählen (idempotent-overwrite / append-only / atomic-ohne-Backup).** → [add-sidecar-persistence.md](docs/agents/add-sidecar-persistence.md)
24. **MA-Selbst-Daten in den persönlichen Ordner via `writeAuslastungProfil` schreiben, nie direkt nach `auslastung.json` (prod read-only).** → [v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md)
25. **Daten-Share-Modus ausschließlich über `canWriteDatenShare(isKurator)` (nie `isKurator ? 'readwrite' : 'read'` hart kodieren).** `[test: no-hardcoded-datenshare-mode]` → [v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md)
26. **Übernahme-Wünsche über den Personal-Handle (`writeUebernahmeWuensche`), PL sammelt ein — kein Direkt-Write nach `auslastung.json`.** → [v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md)
27. **Bearbeiter-Kürzel über `useMeinKuerzel()` lesen, nicht direkt `profile.bearbeiter_kuerzel` (Login-Modus: Session-Kürzel).** `[test: no-direct-bearbeiter-kuerzel]` → [v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md)
28. **Rollen-Passwort (`auth`-Block) per `npm run set-password` in den Build erzeugen, nie `salt`/`verifier` von Hand; Passwort ändern = Rebuild.** → [v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md)
29. **Gutachten-Kurzfassung gilt pro Verbund; Persistenz im `kv`-Store (`gutachten-kurzfassung:<key>`) + Doc-Tag-Relation, kein CSV-Write.** → [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md)
