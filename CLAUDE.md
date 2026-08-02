# CLAUDE.md — TeamFlow Local App

## Project Overview

TeamFlow Local is a serverless browser app for collaborative task management with AI integration, deployed exclusively via file server (`file://` protocol). A research-grants team manages funding applications (Förderanträge), plans capacity, classifies documents, and uses AI-powered hybrid search — all without IT infrastructure.

**Read `DESIGN_GUIDE.md` for visual design rules before making any UI changes.**

## Ich will… → wo nachsehen

Decision-Tree für häufige Aufgaben. Erst hier nachsehen, **bevor** du die Codebase scannst:

| Aufgabe | Wo nachsehen |
|---------|--------------|
| Plugin / CSV-Feld / Filter / IDB-Store / Feedback-Status / Embedding-Modell / Tab / … anlegen | [docs/agents/](docs/agents/README.md) — passenden Cheatsheet wählen |
| Bildschirmseiten-Kontext-Doc pflegen (Feedback-KI-Kontext) | [docs/agents/update-screen-context.md](docs/agents/update-screen-context.md) |
| UI-Patch (Komponenten, Farben, Tokens) | [DESIGN_GUIDE.md](DESIGN_GUIDE.md) |
| Tabellenartige Seite mit Detail/Editor (Master-Detail-Split) | [docs/agents/add-table-detail-page.md](docs/agents/add-table-detail-page.md) — `MasterDetailLayout` |
| UI-Muster wählen (Seitenkopf, Listen-Sicht-Tabs-mit-Zähler, Status-Badge/Dot, Filter-Chip) | [docs/architecture/ui-muster.md](docs/architecture/ui-muster.md) + [docs/layout-audit.md](docs/layout-audit.md) |
| `file://`-Constraint vergessen? | [docs/agents/file-protocol-pitfalls.md](docs/agents/file-protocol-pitfalls.md) + Critical Constraints unten |
| Bug-Risiko-Check vor Commit | [Common Pitfalls](#common-pitfalls) unten (nummerierte Liste) überfliegen |
| Wiederkehrende Bug-Klassen (Cold-Start-Refresh, FSAPI, Parallel-Varianten, Embedding-Caches) | [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md) |
| Welche(n) Build nach dem Patch bauen | [docs/agents/which-build-to-run.md](docs/agents/which-build-to-run.md) |
| App ansehen / UI selbst prüfen (Pflicht bei jeder sichtbaren Änderung) | [local-variante.md](docs/architecture/local-variante.md) — `npm run dev:local` + [Abnahme-Regel](#abnahme-selbst-ansehen-nicht-ansagen) |
| Build-Varianten (Configs, Sichtbarkeits-Matrix, Feature-Flags) | [docs/architecture/build-varianten.md](docs/architecture/build-varianten.md) |
| npm audit meldet etwas | [docs/audit-akzeptiert.md](docs/audit-akzeptiert.md) |
| ONNX/Transformers-WASM, Bundle-Größe (Inline-gzip + `wasmBinary`, Post-Build-Strip) | Pitfall #39 + [docs/architecture/runtime-layers.md](docs/architecture/runtime-layers.md) |
| Async-UI-Aktion ohne silent-fail | [docs/agents/async-error-pattern.md](docs/agents/async-error-pattern.md) |
| Antrag-Status-Vergleich | Pitfall #12 + [docs/architecture/antrag-status-domaenen.md](docs/architecture/antrag-status-domaenen.md) |
| Status-System neu (Status-Katalog/Historie/Ableitung/Cockpit/Timeline/Widget; gerätelokal, Flag `statusCockpit`) | [docs/status-system/README.md](docs/status-system/README.md) + Pitfall #40 |
| Vorgangssystem (Companion zum Fachsystem: Status-Erklärung, Kürzel-Navigator, To-do-Kaskade, Stillstands-Wächter, Fristen-Cockpit; Flag `vorgangssystem`) | [vorgangssystem.md](docs/architecture/vorgangssystem.md) + Pitfall #44 |
| Code-Katalog des Fachsystems (505 Statuseinträge aus der Kürzel-Zuarbeit, Ordnerbaum, Rollen AB/FB/QS/PA/Juristen, `D_`/`T_`/`X`-Spaltenkonvention, Ordner-Spalten der Fördertabelle) | [docs/status-system/KATALOG-CODES.md](docs/status-system/KATALOG-CODES.md) + Pitfalls #42/#43 |
| Bearbeitungs-Meilensteine (Soll-Wochen ab Eingang, Frist-Prognose, Team-Sidecar, Flag `meilensteinMonitoring`) | [meilensteine.md](docs/architecture/meilensteine.md) + Pitfall #41 |
| Datei-Pfade auf SMB-Share | [docs/architecture/data-layout.md](docs/architecture/data-layout.md) |
| CSV-Auto-Refresh (täglicher Selbst-Import, Frische-Ampel „● CSV", Projektions-Rebuild bei Mapping-Nachzug) | [docs/architecture/csv-auto-refresh.md](docs/architecture/csv-auto-refresh.md) |
| Source-Tree (welche Datei gehört wo?) | [docs/architecture/project-structure.md](docs/architecture/project-structure.md) |
| Codebase-Überblick / wo liegt was (LOC-Karte, Datei-Größen) | [docs/architecture/code-map.md](docs/architecture/code-map.md) (generiert; falls fehlt: `npm run map`) |
| Infrastructure-Layer-Internals | [docs/architecture/infrastructure-layer.md](docs/architecture/infrastructure-layer.md) |
| Auslastungs-Modul (Klassifizierung + Matching) | [docs/architecture/auslastung.md](docs/architecture/auslastung.md) |
| Gutachten-Kurzfassung-Testballon (Skill + Aufnahme + DOCX-Füller) | [docs/architecture/gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md) |
| Artefakt-Engine (Substrat artefaktTyp/ebene/pruefart, Run-Keying, generische Füllung) + NF-Nachforderungen + GA-QS | [docs/architecture/artefakt-engine.md](docs/architecture/artefakt-engine.md) |
| Textbaustein-Katalog (NF/RNE/ABL als versionierte, freigebbare App-Daten; eigene Sidecar `textbausteine.json`, NF-Seed-Migration, geteilter Suchkern, `katalogRef`-Audit; dev/pl/kurator-Parität) | [docs/architecture/textbaustein-katalog.md](docs/architecture/textbaustein-katalog.md) |
| Skill-Vorgaben (Umfang & Form am Skill) + persönliche Ebene | [docs/architecture/skill-vorgaben.md](docs/architecture/skill-vorgaben.md) |
| Anfragen-Modul (.msg → interne Anonymisierung → externer ZIM-FAQ-Assistent → deterministische Wiedereinsetzung) | [docs/architecture/anfragen-modul.md](docs/architecture/anfragen-modul.md) |
| Antrag-Aufbereitung (Vollbild-Seite: VB-Gliederung + Tabellen-Ernte, Zeitplan-Gantt + Plausibilität inkl. Kapazität; Steckbrief + Abdeckung + Zahlen-Inventar als interne LLM-Bausteine mit Fundstellen + deterministischen Quervergleichen; Fragen-Tab aggregiert alle offenen Punkte; getrennte Baustein-Caches, Verdächtig-Guard/Retry, dev+pl) | [docs/architecture/antrag-aufbereitung.md](docs/architecture/antrag-aufbereitung.md) |
| MAP-Förderfähigkeitsprüfung (Einreichungs-JSON, Rechenchecks, editierbare Checkliste, Abschluss-Entwürfe; dev+pl) | [map-foerderfaehig.md](docs/architecture/map-foerderfaehig.md) + [map-testleitfaden.md](docs/map-testleitfaden.md) |
| Assistent-Ereignisprotokoll (Phase 0: gerätelokales, opt-in Protokoll app-semantischer Aktionen; kein LLM/Chat/UI; Fundament für den späteren persönlichen Assistenten) | [docs/architecture/assistent-protokoll.md](docs/architecture/assistent-protokoll.md) |
| Assistent-Panel (Phase 1: kontextbewusstes Frage-Antwort-Panel; deterministisch assemblierter Kontext + intern-only Transport + resetChat/Turn; shell-weites Dock, session-only, dev+pl+kurator) | [docs/architecture/assistent-panel.md](docs/architecture/assistent-panel.md) |
| Assistent-Gedächtnis (Phase 2: Sleep-time-Konsolidierung des Protokolls in Memory-Blocks via internem Modell; Operationen statt Neuschrieb, invalidieren statt löschen, Belege-Pflicht, Bridge-Mutex, doppeltes Opt-in, Store nie im Snapshot; dev+pl+kurator) | [docs/architecture/assistent-gedaechtnis.md](docs/architecture/assistent-gedaechtnis.md) |
| Home-Widget-System (Katalog, persönliche Config, Kanban-Widget, Settings-Sektion) | [docs/architecture/home-widgets.md](docs/architecture/home-widgets.md) |
| Skill-Eval-GUI (dev): Abschnitt A–G gegen fiktive Fixtures + externer Judge | [docs/architecture/skill-eval-gui.md](docs/architecture/skill-eval-gui.md) |
| Strukturierte Skill-Ausgabe (JSON-Teilfelder + render-only Badges, `teilStruktur`) | [docs/architecture/teilstruktur.md](docs/architecture/teilstruktur.md) |
| Streamlit-Bridge (Bookmarklet-Installer + postMessage-Transport zum internen LLM) | [docs/architecture/streamlit-bridge.md](docs/architecture/streamlit-bridge.md) |
| KI-Transport / DSGVO (dokument-tragende Läufe intern halten) | Pitfall #30 + [docs/architecture/transport-policy.md](docs/architecture/transport-policy.md) |
| Feedback-System (FAB + Board + Sponsoring + KI-Verbesserung) | [docs/architecture/feedback-system.md](docs/architecture/feedback-system.md) |
| Phase-2 Triage + Review-Queue | [docs/architecture/phase2-triage.md](docs/architecture/phase2-triage.md) + [phase2-review-queue.md](docs/architecture/phase2-review-queue.md) |
| v2.0 Handle-Architektur (Offline-Modus, Feedback-Outbox) | [docs/architecture/v2-handle-architektur.md](docs/architecture/v2-handle-architektur.md) |
| Storage / Search / Theming / Onboarding-Tour | [docs/architecture/runtime-layers.md](docs/architecture/runtime-layers.md) |

**Exploration beginnt hier**, nicht mit einem Blind-Scan: [docs/architecture/code-map.md](docs/architecture/code-map.md) (Datei-Inventar + LOC, generiert) für „wo liegt was & wie groß", [docs/architecture/project-structure.md](docs/architecture/project-structure.md) für den Zweck der Ordner. Erst **danach** gezielt Glob/Grep über `src/`.

## Ignorierte Verzeichnisse

Folgende Pfade NICHT lesen oder referenzieren beim Arbeiten am Code:

- `_archive/` — Historische Architektur-Docs, erledigte Audits, überholte Test-Daten, archivierte Eval-Reports (`_archive/eval-reports/`). Enthält die alte MVP-Architektur (postMessage-AI-Bridge, Vorgang-zentriertes Datenmodell, "Admin"-Terminologie) und führt bei aktuellem Code zu falschen Annahmen. Ein Agent, der hier sucht, bekommt mit hoher Wahrscheinlichkeit überholte Guidance.
- `node_modules/`, `dist*/`, `.vite/` — Build-Artefakte.
- `_reference/` — externe Referenz-Apps und Mockup-Bilder, nicht Teil von TeamFlow. Wird von Vite (`server.watch.ignored`) ignoriert.
- `CHANGELOG.md` + `docs/CHANGELOG-ARCHIV.md` — nie am Stück lesen (~400 KB / ~330 KB); Einträge werden nur oben angefügt (ab v2.248 per Script). Zum Nachschlagen einzelner Versionen: grep nach `### vX.Y`.
- `src/core/services/skill-eval/fixtures/eval-fixtures.data.json` — ~2 MB generierte Fixture-Daten.
- `docs/phase-2/triage-beispiele/` — Beispiel-DOCX/-PDFs (~1 MB).
- `docs/superpowers/` — erledigte Plan-/Spec-Dokumente vergangener Feature-Runden; für aktuellen Code irrelevant, führt Explorer in die Irre.

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
- **ZIP**: `jszip` (DOCX-Vorlagenfüllung, ZIP-Durchläufe, Beispiel-Korpus) — unverschlüsselt. Passwort-/Zugangs-Krypto läuft über `crypto.subtle` (AES-GCM, `infrastructure/crypto.ts`), nicht über ZIP-Verschlüsselung.

## Architecture Principles

### File Size Limit

**Kohäsion vor Zeilenzahl** — eine Datei = **eine kohärente Verantwortung**, nicht eine Zeilenzahl. Ab **~400–500 Zeilen** prüfen, ob mehrere Verantwortlichkeiten vermischt sind (dann entlang dieser Grenzen aufteilen); **nie nach Zeilenzahl splitten** (künstliches Zerreißen kohärenter Einheiten = Fehlalarm). Aufteilung **opportunistisch**, wenn ein Patch die Datei ohnehin anfasst. Detail + Beispiele (kohärente Daten-Files / State-Machines / Orchestratoren dürfen größer sein; echte Mehrfach-Verantwortung wie UI-Komponenten / Multi-Domain-Services trennen): [docs/architecture/project-structure.md](docs/architecture/project-structure.md#file-size-limit).

### UI-Muster / Layout-Schicht

Geteilte, domänenfreie Layout-Schicht in `src/components/` — neue Module bauen Layout **nicht** selbst nach: kein paralleles Master/Detail (→ `MasterDetailLayout`), **keine eigene Listen-Sicht-Tab-Leiste** (→ `ScopeTabs`, Guard `no-parallel-scope-tabs`), kein eigener Page-Header/Badge. Entscheidungstabelle (welches Bauteil wofür), die `AntraegePage`-Ausnahme (eigenes Master/Detail + Kompakt-Spalte) und Inventar/Drift: [docs/architecture/ui-muster.md](docs/architecture/ui-muster.md) + [docs/layout-audit.md](docs/layout-audit.md).

### Plugin System

Jedes Feature ist ein Plugin in `src/plugins/{name}/` mit `TeamFlowPlugin`-Manifest (`id`, `name`, `icon`, `category` `'workflow'|'tools'|'erprobung'|'system'|'kuration'`, `order`, `component`; optional `kuratorOnly`, `hideFromNav`, `navHint`, `badge`, `onInit`, `route`, `featureFlag`), registriert in `src/plugins.config.ts`. Sidebar-Gruppierung/Sortierung/Beschriftung in der puren [groupNavPlugins.ts](src/core/nav/groupNavPlugins.ts) (kein id-Sonderfall im ShellLayout); **neue Plugins starten in `erprobung`** ([add-plugin.md](docs/agents/add-plugin.md)). `hideFromNav: true` nimmt aus Nav + Nav-Commands, **ohne** die Route zu deregistrieren (Bookmarks/Redirects bleiben, Routen aus der ungefilterten Liste, [Router.tsx](src/core/Router.tsx)).

Das `chat`-Plugin ist `hideFromNav`-Redirect `/chat → /suche?assistent=1` ([ChatRedirect.tsx](src/plugins/chat/ChatRedirect.tsx)); der Chat lebt als andockendes [ChatPanelHost.tsx](src/plugins/chat/ChatPanelHost.tsx) rechts in der Suche (reused `useChatController`/`useChatStore` **ohne** Fork, Suchtreffer via `extraContext`/`getPinnedContext`). Die Suche nutzt **immer** diesen vollen Host; das schlanke shell-weite Assistent-Panel ist auf `/suche` bewusst **nicht** gemountet (kein Doppel-Panel). Neues Plugin: [docs/agents/add-plugin.md](docs/agents/add-plugin.md); `onInit`-Pattern: [docs/architecture/runtime-layers.md](docs/architecture/runtime-layers.md).

### Infrastructure Layer (Phase 1a + v1.9)

Kurator-Session, SMB-Handles, Atomic-Writes, Audit-Log, Build-Lock, Backup, Migration — alle in [src/core/services/infrastructure/](src/core/services/infrastructure/). Stores in [src/core/hooks/](src/core/hooks/).

**Alle Infrastructure-Writes müssen `atomicWrite()` / `appendToFile()` verwenden** (siehe Pitfall #10). Pfad-Konstanten + Sidecar-Layout: [docs/architecture/data-layout.md](docs/architecture/data-layout.md). Detail zu Session, Migration, Welcome-Screen, Dev-Plugin-Panels: [docs/architecture/infrastructure-layer.md](docs/architecture/infrastructure-layer.md).

### Storage, Search, Theming, Onboarding

Cross-Cutting-Layers (IndexedDB + File-System-Access-API, Orama-Hybrid-Search mit EmbeddingGemma, CSS-Custom-Properties-Theming, 5-Schritt-Onboarding-Tour): [docs/architecture/runtime-layers.md](docs/architecture/runtime-layers.md).

### Feedback-System

User-Feedback + Board mit Sponsoring, Verwaltung, Fortschreibung. Seit **v2.364 EINE Oberfläche**: FAB + Bausteine in `src/components/feedback/`, Service in `src/core/services/feedback/`, Board `src/plugins/feedback-board/` (id `feedback-board`, inkl. `verwaltung/`); `feedback-kuration` ist nur ein Redirect. Recht: **`canManageFeedback`** (aus `canWriteDatenShare`; prod read-only).

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

Auf der Verbund-Detailseite erstellt ein Gutachter KI-gestützt die **Kurzfassung** eines ZIM-Gutachtens (Aufnahme → Skill → Review/Freigabe → Word-Vorlage), hinter Flag `gutachtenKurzfassung` (**dev + pl**). **Leitprinzip**: LLM ist optional (nur die Generierung braucht die Transport-Ladder, degradiert mit klarer Meldung). **Ebene = Verbund**; Persistenz + VB-Relation über `kv`-Präfix (`gutachten-kurzfassung:<key>`, `doc:*`-Tags), **kein** CSV-`Antrag`-Write (Pitfall #29). Skill-Service-Struktur (v2.89): `src/core/services/skills/` = `run/` + `registry/` + `tweaks/`, Import immer über das Barrel `@/core/services/skills` (`splitSentences`/`CheckResult`/`SkillModifierKey` genau **eine** Heimat in `registry/`). Detail (4 Bausteine, Datenfluss, DOCX-Füller, Persistenz-Keys): [docs/architecture/gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

### Artefakt-Engine (Substrat: `artefaktTyp` / `ebene` / `pruefart`)

Generisches Substrat hinter Gutachten + Nachforderungen — eine **Artefakt-Achse orthogonal** zum amtlichen Antrags-Status (Pitfall #12) ([types.ts](src/core/services/skills/registry/types.ts)). `ArtefaktTyp` (`'ga'|'nf'|'abl'|'rne'`) × `WorkflowEbene` (`'verbund'|'tv'`); ein `WorkflowRun` ist **je (Typ, Scope)** gekeyt (`workflow-run:<typ>:<scopeId>`, [workflow-store.ts](src/plugins/antraege/gutachten/workflow-store.ts)). `pruefart` = `textlich` (deterministische Check-Engine) | `fachlich` (LLM-QS) | `administrativ`. Regel-Kategorie **immer** über `effektiveKategorie()` (Pitfall #31; `TYP_ZU_KATEGORIE` lebt nur in [kategorien.ts](src/core/services/skills/registry/kategorien.ts)); NF-Bausteine = kuratierte App-Daten, **wortgetreu** verwendet (Pitfall #34, [nf-bausteine.seed.ts](src/core/services/skills/registry/nf-bausteine.seed.ts)).

Kategorie-Modell, Journey-Paket 3 (Regel→Korrektur, `regelKorrekturAnweisung`) + 4 (Belege↔Satz, deterministische Ableitung), Run-Keying, generische DOCX-Füllung, NF-/GA-QS: [docs/architecture/artefakt-engine.md](docs/architecture/artefakt-engine.md).

**Abschnitts-Journey** (v2.334–v2.337, additiv): Ziel-Fallback agentisch→standard (ein Retry, nur wo `ziel` wirkt), auto-angehängter Feinschliff (Scheitern degradiert zum Rohentwurf, auch Abbruch), Abnahme-Kriterien am Skill (`qsKriterien` als Prompt-Anhang statt Seed-Write), Vier-Ebenen-Karte — [gutachten-kurzfassung.md](docs/architecture/gutachten-kurzfassung.md).

### Skill-Eval-GUI (dev)

Dev-only Eval-Tab in der Skill-Verwaltung: ein Gutachten-Abschnitt (A–G) gegen **fiktive** VB-Fixtures (Browser-Schwester der Node-CLI). Reuse statt Fork (`runOneSection`/`runJudge`/`aggregate` byte-vergleichbar zur CLI), DSGVO-Guard (Fixtures nur aus dem gebündelten Asset, Convention-Test `eval-gui-fictional-only`), strikt abgegrenzt vom Real-Daten-`SkillTestlaufPanel`. Detail: [docs/architecture/skill-eval-gui.md](docs/architecture/skill-eval-gui.md).

### Strukturierte Skill-Ausgabe (`teilStruktur`)

**Opt-in pro Skill** (additiv): lange `### Finaler Text`-Blöcke als deklarierte JSON-Teilfelder (render-only Badges) statt Textwand. `finalerText` bleibt die flache Quelle der Wahrheit (alle Konsumenten lesen nur ihn); kaputtes JSON → **Plain-Text-Fallback** (nie unter heute regredieren); `normalizeSkill` whitelistet `teilStruktur`/`teilJoin` explizit; Aktivierung erst nach CLI-Mess-Gate. Detail: [docs/architecture/teilstruktur.md](docs/architecture/teilstruktur.md).

### Assistent-Ereignisprotokoll (Phase 0)

Fundament für den späteren persönlichen Assistenten: ein **rein deterministisches, strikt gerätelokales, opt-in** Protokoll app-semantischer Aktionen (welche Entität geöffnet, welche Suche, welcher Skill gestartet). **Phase 0 enthält kein LLM, keinen Chat, keine Assistenz-UI** — nur die Datengrundlage. Feature-Flag `features.assistentProtokoll` (`isAssistentProtokollEnabled()`, dev + pl + kurator) gated Aufzeichnung + Einstellungs-Sektion „Assistent & Gedächtnis" — Freischaltung ≠ Aufzeichnung, das Opt-in bleibt beim User.

Modul [src/core/services/assistent/protokoll/](src/core/services/assistent/protokoll/): dedizierter IDB-Store `assistent_ereignisprotokoll` (IDBStore **v9**, keyPath `id`, Index `zeitstempel`) — **kein** kv-Prefix, weil Append-Log mit Retention + Zeit-Queries. Die **einzige** Schreib-Gate-Stelle ist `protokolliereEreignis` (Flag **und** Opt-in). Init einmalig in [App.tsx](src/core/App.tsx) über `initProtokoll(storage.idb)`. Katalog v1 ist **abschließend** (~8 Typen). Instrumentierung minimal-invasiv (ein Aufruf je Stelle: Router, Dokument-Öffnen, Suche-`done`, `runSkill`-Hülle, `bearbeitenStep`, Home-Fristen-Balken). Die harten Invarianten 1–5 (strikt lokal / strikt Opt-in / keine Verhaltensmetrik / kein LLM+Netzwerk / additiv) und der Katalog: [docs/architecture/assistent-protokoll.md](docs/architecture/assistent-protokoll.md) (siehe **Pitfall #37**).

### Assistent-Panel (Phase 1)

Kontextbewusstes, **read-only** Frage-Antwort-Panel: die App assembliert den Kontext (Route, Entität, `naechsterSchritt()`, Fristen, Orama-Retrieval) **rein deterministisch** und schickt **genau einen** Prompt ans **interne** Modell (Flag `assistentPanel`, dev + pl + kurator; Historie session-only). Harte Invarianten (nur-intern-Transport via `getTransportForAssistent`, resetChat pro Turn/Pitfall #36, ein Aufruf pro Turn, Fundstellen = Orama + Chat-Zitatsystem, shell-weit gemountet außer auf `/suche`): [docs/architecture/assistent-panel.md](docs/architecture/assistent-panel.md).

### Assistent-Gedächtnis (Phase 2)

Sleep-time-Konsolidierung des [[assistent-protokoll]] in wenige benannte Memory-Blocks via **internem** Modell (Flag `assistentGedaechtnis`, dev + pl + kurator; Store `assistent_gedaechtnis`). Kernprinzipien (Pitfall #38): rohes Protokoll = Wahrheit / Einträge = Cache; **Operationen statt Neuschrieb** (LLM liefert nur Ops + Faktensätze, nie IDs/Belege); invalidieren statt löschen; reine `wendeOperationenAn`; Bridge-Mutex (Vordergrund-Vorrang); doppeltes Opt-in + strikt lokal; `npm run eval:gedaechtnis` als Gate. Detail: [docs/architecture/assistent-gedaechtnis.md](docs/architecture/assistent-gedaechtnis.md).

### Home-Widget-System

Die Homepage rendert seit v2.227 **Widget-Instanzen** aus einer persönlichen Config statt hart verdrahteter Sektionen ([src/plugins/home/widgets/](src/plugins/home/widgets/)). Kernregeln: Widget-Katalog ist Code ([widgetCatalog.ts](src/plugins/home/widgets/widgetCatalog.ts); `reconcileVerfuegbareWidgets` zieht neue Typen als Opt-in nach); **Persistenz-Invariante HART** — Config IDB-primär + nur Personal-Mirror, NIE registry.json/Share/Snapshot (Guard `home-widgets-local-only`; Notizen strikt IDB-only); Kanban-Lanes binden an `StatusCategory`/`FeedbackStatus` (Pitfall #12, nie Roh-Status). Widget-Liste, Config-UI und „Neues Widget"-Rezept: [docs/architecture/home-widgets.md](docs/architecture/home-widgets.md).

### MAP-Förderfähigkeitsprüfung (Plugin `map-foerderfaehig`, dev + pl)

Demonstrator der Fachprüfung: Einreichungs-JSON → Rechenchecks → **editierbare, versionierte** Checkliste → Abschluss-Entwurf. Flag `mapFoerderfaehig` (**dev + pl**). Zwei harte Regeln: eigene `kv`-Entität, **kein `Antrag`-Record** (Pitfall #13); **keine `.tsx` rechnet** (Vitest node-only) — ein modul-lokaler Convention-Test bewacht Deny-Liste, Zeilengrenze und die Fixture-Herkunft des Smoke-Panels.

**Substanzcheck** (v2.279): Der Infografik-Lauf hält den Text gegen einen Fakten-Block → `widersprueche`+`unschaerfeBegriffe`, **kein zusätzlicher LLM-Aufruf**. Leere Listen = **gutes** Ergebnis; NF-Leitplanke im Code (Zahl+Messverfahren); Zielkriterien speichern die **Abwahl**. **Zweitmeinung** (dev): Gate „Urteil zuerst", nirgends aggregiert (Guard).

### Vorgangssystem (Flag `vorgangssystem`, dev + pl)

**Companion des Fachsystems (Foyer), nicht zweite Workflow-Engine**: `STATUS_TV`/`STATUS_VB` gelten wie importiert, **die App leitet keinen Status ab** (Pitfall #44). Alles Neue steht daneben — erklären, navigieren, warnen, steuern. Wohnt in `src/core/status/` und **erweitert** das Status-System, statt ein paralleles Modul danebenzusetzen (ein Evaluator, ein Bedingungs-Formatierer, eine Sidecar-Mechanik für Katalog + Trigger). UI: [vorgangs-board](src/plugins/vorgangs-board/) + Erweiterungen am Status-Katalog und Verbund-Detail. Konzept, Bausteine, Messwerte: [vorgangssystem.md](docs/architecture/vorgangssystem.md); Regel-Herkunft: [todo-regeln-ab-seed.md](docs/architecture/todo-regeln-ab-seed.md); Rückbau: [vorgangssystem-p6-inventar.md](docs/architecture/vorgangssystem-p6-inventar.md).

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
- **Reines Geschwister-Modul eines Components nie nur per Casing benennen** (`KompaktListe.tsx` + `kompaktListe.ts` = TS1149/1261-Kollision unter Windows/case-insensitive FS). Eigenen Wortstamm wählen: `KompaktListe.tsx` + `kompaktRows.ts`, `ArtefaktLeiste.tsx` + `artefaktKarten.ts`.

### Tests

Die Vitest-Suite läuft in **zwei Projekten** (`vitest.config.mts`): `fast` (ohne Isolation, `isolate: false` — der Großteil der Dateien) und `isolated` (Standard-Isolation, für Dateien mit geteiltem Modul-Zustand). Schlägt ein neuer Test **nur im Suite-Lauf** fehl, läuft aber einzeln grün (`npx vitest run <pfad>`) → die **Datei** in `ISOLATED_TESTS` (`vitest.config.mts`, alphabetisch) aufnehmen, **nie** den Test verbiegen. Neue Tests sollen ohne Modul-globalen Zustand auskommen.

## Entwicklungs-Gate (innerer Loop vs. Phasen-Gate)

- **Innerer Loop** (nach jedem Fix/Teilschritt): `npm run check:quick` — inkrementeller Typecheck + gecachtes Lint + nur betroffene Tests (`vitest run --changed`). Sekunden statt Minuten.
- **Phasen-Gate** (vor jedem Commit): `npm run check` — voll: Typecheck + Lint + `cycles` + komplette Testsuite + `build:dev`.
- **Zyklen** ([check-cycles.mjs](scripts/check-cycles.mjs), nicht in `check:quick`): Allowlist ist **leer** — neuer Laufzeit-Zyklus wird aufgelöst (Barrel-Import → Direktimport), nicht eingetragen.
- Bei Verdacht auf stale Typecheck-Cache (Branch-Wechsel, seltsame Fehler): `npm run typecheck:full` (`tsc --build --force`).

## Abnahme: selbst ansehen, nicht ansagen

Grün heißt „kompiliert", nicht „funktioniert". **Jede Änderung, die sich in der App zeigt, prüft Claude Code selbst** — in der Variante „local" ([local-variante.md](docs/architecture/local-variante.md)): `npm run dev:local` (Port 5175) → `await window.__tf.bereit()` → die betroffene Stelle mit `read_page`/Screenshot **und** `window.__tf.fehler()` (muss 0 sein). Ohne diesen Lauf ist eine UI-Änderung nicht fertig; „bitte manuell prüfen" ist keine Abnahme. Gilt für Zahlen und Texte genauso wie für Layout: die gerenderte Zeichenkette gegenprüfen, nicht die Absicht im Code.

**Beim Nutzer bleibt nur, was der Dev-Server nicht zeigen kann**: `file://`-Betrieb (Single-File-Build, dynamische Importe, rohe Worker, relative `fetch`, Bundle-/WASM-Größe), der FSAPI-Ordner-Picker samt Berechtigungs-Dialogen, und alles, was echte Team-Schreibrechte auf dem SMB-Share braucht. Diese Fälle benennen und `npm run build:dev` + Doppelklick ansagen — pauschal auf den Handtest verweisen gilt nicht.

## Shell-Konventionen (Windows)

Die Dev-Maschine ist Windows — Heredocs/Here-Strings schlagen in der Shell fehl und kosten jedes Mal einen Selbstkorrektur-Turn. Daher verbindlich:

1. **Keine Heredocs/Here-Strings** (`<<EOF`, `<<<`, `@"…"@`, `"$(cat <<…)"`) in Bash-Aufrufen.
2. **Mehrzeilige Datei-Inhalte** ausschließlich über das Write/Edit-Tool erzeugen — nie per `echo`/`cat` zusammenbauen.
3. **Commit-Messages**: Message per Write-Tool nach `.git/COMMIT_MSG.tmp`, dann `git commit -F .git/COMMIT_MSG.tmp`. Einzeiler dürfen weiter `git commit -m "…"` nutzen.
4. **Kein mehrzeiliges Inline-`python -c` / `node -e`** — stattdessen Wegwerf-Script unter `scripts/tmp/` anlegen (gitignored), ausführen, löschen.

## Build-Varianten (v1.10)

TeamFlow wird pro Einsatz-Kontext als eigene Variante aus `configs/*.config.json` gebaut: **dev** (alle Features + OpenRouter), **prod** (End-User schlank), **kurator** (schlank + Kuration-Menüs nach Login), **pl** (+ Auslastung), **as** (wie pl, ohne Auslastung). `configs/_shared.json` = org-weite Defaults (via `deepMerge` aus [scripts/config-schema.mjs](scripts/config-schema.mjs)).

Bauen: `npm run build:dev|prod|kurator|pl|as` (→ `dist-single/…`), `npm run build:variant -- --config …`, `npm run config-ui`. Testen: HTML per Doppelklick (`file://`), keine Console-Errors. **Sicherheits-Check**: OpenRouter in einer `variant: "production"`-Config mit festem Share-Pfad bricht `validateConfig()` ab (per Design). Config im Code: `import { features, isOpenRouterEnabled } from '@/config/feature-flags'`; Plugin-Gating über `src/plugins.config.ts`.

Sichtbarkeits-Matrix, alle Feature-Flags (`auslastung`/`maLogin`/`maVerwaltungPasswort`/`gutachtenKurzfassung`), prebuild-Pipeline: [docs/architecture/build-varianten.md](docs/architecture/build-varianten.md).

## Versionierung

App-Version steht in `package.json#version` (Single Source of Truth, via Vite-`define` als `appVersion` in `src/config/runtime-config.ts` exposed). Sidebar-Footer zeigt `v<major>.<minor>` (z.B. `v1.14`); Hover-Tooltip enthält die volle Version + Variant + Git-Hash + Build-Datum.

Bump-Regeln (semver-pragmatisch für diese App):

- **MAJOR** (`1.14 → 2.0`) — wenn eine bestehende Installation einen **Migrationsschritt** braucht. Konkret: SMB-Daten-Layout ändert sich (z.B. wie v1.9: `programm-test/admin/` → `_intern/`), `CONFIG_SCHEMA_VERSION` in `scripts/config-schema.mjs` bumpt, IndexedDB-Stores werden umgeschrieben, oder User muss aktiv etwas tun (Berechtigung neu erteilen, Pfad neu wählen, etc.).
- **MINOR** (`1.14 → 1.15`) — neues Plugin, neues Feature, neue Felder, größere UI-Refactors. **Additive** Änderungen, bestehende Daten/Configs bleiben funktional.
- **PATCH** (`1.14.0 → 1.14.1`) — Bugfix, Style-Tweak, Text-Korrektur. Keine Verhaltensänderung außer "es ist jetzt richtig".

Beim MAJOR-Bump zusätzlich: Migrations-Notiz in [CHANGELOG.md](CHANGELOG.md) ergänzen (analog v1.9-Block in [docs/architecture/infrastructure-layer.md](docs/architecture/infrastructure-layer.md)), und sicherstellen dass `migrateLegacyStructure()` (oder Pendant) die alte Struktur erkennt.

**Bump + Changelog-Skeleton** laufen über `npm run version:bump -- <major|minor|patch> "<Titel>" [--user]`: das Script bumpt `package.json#version`, fügt oben in CHANGELOG.md ein Kompakt-Skeleton ein (bei `--user` zusätzlich in `changelog-user.md`) und rotiert übergroße CHANGELOG.md-Blöcke ins Archiv (> 100 KB → ≤ 80 KB, ≥ 30 neueste bleiben). CHANGELOG.md wird **nie manuell am Kopf editiert** — nur das Skeleton ausfüllen.

Versionshistorie: jüngste Versionen in **[CHANGELOG.md](CHANGELOG.md)**, ältere in **[docs/CHANGELOG-ARCHIV.md](docs/CHANGELOG-ARCHIV.md)** (beide append-only, chronologisch absteigend). Migrationsnotizen stehen beim jeweiligen MAJOR-Block.

## Doku-Konventionen

1. Docs beschreiben den **Ist-Zustand**; Überholtes wird umgeschrieben, nicht per Korrektur-Absatz angehängt (Historie → Git/CHANGELOG).
2. Die Pitfall-Liste unten ist ein **Index**: pro Pitfall eine fett gesetzte Ein-Satz-Regel + `[test:…]`-Marker (falls vorhanden) + Link; das Detail lebt genau **einmal** im Themen-Doc.
3. Pitfall-Nummern sind **append-only** (Code/Commits/`describe`-Strings referenzieren sie); überholte behalten ihre Nummer + Ein-Zeiler „(überholt, siehe …)".
4. Neue Lesson Learned: **grep-bar → Convention-Test** ([codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts)); sonst [recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md); ein nummerierter Pitfall nur bei projektweiter Geltung.
5. Bildschirmseiten-Kontext-Docs (`docs/feedback-kontext/`) folgen derselben Ist-Zustand-Regel — bei UI-/Datenmodell-Änderungen an einem Plugin das zugehörige Doc mitziehen (siehe [docs/agents/update-screen-context.md](docs/agents/update-screen-context.md)); Guard `screen-context-coverage` erzwingt Vollständigkeit, nicht Aktualität.
6. Changelog-Kompaktformat: pro Version max. 3 Zeilen Motivation + max. 5 Bullets à 1 Zeile (WAS + Datei-Link, **kein** WIE); Architektur-Detail lebt genau einmal im Themen-Doc, der Changelog verlinkt nur.
7. `changelog-user.md` (geglättete Fassung) nur bei **nutzersichtbaren** Änderungen pflegen (`--user`-Flag von `npm run version:bump`), nicht pro Version.

## Common Pitfalls

> **Hinweis zur Nummerierung**: append-only. Niemals umnummerieren — Querverweise (in Code-Kommentaren, anderen Docs, Commit-Messages) werden sonst ungültig. Wer einen Pitfall für überholt hält, markiert ihn mit *„(überholt seit vX.Y, siehe …)"* statt ihn zu löschen.
>
> **Maschinell erzwungen**: Pitfalls mit `[test: …]` fängt [codebase-conventions.test.ts](src/__tests__/codebase-conventions.test.ts) (Vitest, Inline-Ausnahme `// allow-<rule>: <grund>`). Aktuelle Convention-Tests: `no-direct-status-compare` (#12), `no-direct-feedback-status-compare` (#21), `no-direct-bearbeiter-kuerzel` (#27), `no-hardcoded-datenshare-mode` (#25), `no-raw-async-onclick` (#15), `no-raw-worker` (#5), `no-raw-clipboard` (v2.301.3), `no-raw-modal` (Klasse 7) + `no-new-tf-ui-files` (P1a/P1b) + `no-raw-active-transport` (#30) + `no-hardcoded-kategorie-mapping` (#31) + `eval-gui-fictional-only` (Skill-Eval-GUI dev) + `theme-token-contract` (Design-Handoff-Token-Vertrag, v2.67.1-„nackt"-Falle: `var(--tf-…)` ohne Fallback muss global in `theme.css` existieren) + `preset-contrast-contract` (jedes `PRESET_COLORS`-Preset ≥ 4,5:1 weißer CTA-Text) + `no-parallel-scope-tabs` (Listen-Sicht-Tabs gehören in `ScopeTabs`, siehe [UI-Muster / Layout-Schicht](#ui-muster--layout-schicht)) + `arbeitskontext-log-idb-only` (das Home-„Weitermachen"-Log bleibt IDB-lokal — kein Share-/Mirror-Write) + `no-blanket-idb-wipe` (wer alle kv-Keys holt UND löscht, muss die Setup-Keys via `istSetupKey` aussparen — sonst wirft der Reset den User ins Onboarding, siehe Bug-Klasse 12) sowie die Klasse-1/-5-Checks `import-requires-store-refresh`, `antraege-write-requires-listview-rebuild` und `no-hardcoded-canonical-field`. **Wiederkehrende, NICHT-nummerierte Bug-Klassen** (Cold-Start-Store-Refresh, FSAPI-One-Prompt-per-Gesture, Parallel-Varianten-Storage, machine-lokale Embedding-Caches) stehen separat in [docs/architecture/recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md).

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
- **DSGVO-Transport-Policy**: #30 dokument-tragende Läufe nur intern (`getTransportForSkillRun`), #35 Policy-Ableitung scannt den Template-Text (`{{vbMarkdown}}`), nicht das `slots`-Array
- **Artefakt-Achse (Substrat artefaktTyp/ebene/pruefart)**: #31 Kategorie-Einzelquelle (`effektiveKategorie`), #33 Vorlage frisch + Audit-Hash, #34 NF-Baustein wortgetreu
- **Snapshot-/Store-Konsistenz**: #32 Snapshot = Voll-Store (verbuende heilen) ≠ Slim-List-View
- **Streamlit-Bridge (stateful Chat)**: #36 jeder Einzel-Skill-Lauf resettet zuerst (`starteFrischenChat`)
- **Assistent-Ereignisprotokoll (Phase 0)**: #37 strikt gerätelokal (nie Share/Snapshot/Export), zentrale Gate-Funktion, nur additiv
- **Assistent-Gedächtnis (Phase 2)**: #38 Operationen statt Neuschrieb (LLM liefert nur Ops+Fakten), invalidieren statt löschen, strikt lokal + doppeltes Opt-in, Bridge-Mutex (Vordergrund-Vorrang)
- **ORT-WASM-Bereitstellung (Bundle-Diät)**: #39 nur über `ensureOrtWasmBinary()` (Inline-gzip + `wasmBinary`), nie `wasmPaths`/Asset-URLs (Post-Build-Strip leert sie)
- **Vorgangssystem (Companion, nicht zweite Engine)**: #44 kein Status abgeleitet, Kürzel nur über `todoFeld()`, Unbelegbares bekommt ein eigenes Urteil, Trigger je Richtlinie
- **Status-Code-Katalog (Ordnerbaum, Rollen, Spalten-Auflösung)**: #42 Baum = Daten, `feldId` = roher Spalten-Code, `ebene` ≠ `herkunft`, Rang 0 = wirkungslos · #43 Zuarbeit = Fremddaten, leere Rollen = jeder

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
30. **Dokument-tragende Skill-Läufe (Generierung/QS/Batch) nur über `bridge.getTransportForSkillRun(skill)`, nie rohes `getActiveTransport()`; Klassifizierung fail-safe (Default intern), Ableitung schlägt Flag.** `[test: no-raw-active-transport]` → [transport-policy.md](docs/architecture/transport-policy.md)
31. **Regel-Kategorie immer über `effektiveKategorie()` ableiten (explizite `kategorie` > `typ`-Map > `pruefart`-Fallback) — kein zweites typ→kategorie-Mapping; `TYP_ZU_KATEGORIE` lebt nur in `kategorien.ts`.** `[test: no-hardcoded-kategorie-mapping]` → [artefakt-engine.md](docs/architecture/artefakt-engine.md)
32. **Snapshot serialisiert den VOLL-Store ≠ Slim-`ANTRAEGE_LIST_VIEW`-Projektion; vor dem Schreiben `verbuende` heilen (`healMissingVerbuende`, heal-before-serialize), beim Voll-Write die List-View mitziehen.** → [recurring-bug-classes.md](docs/architecture/recurring-bug-classes.md)
33. **DOCX-Vorlage je Run FRISCH lesen (nie gecacht) + SHA-256 in `WorkflowRun.vorlageRef` stempeln (Audit/Reproduzierbarkeit); fehlende/kaputte Vorlage → `FillResult.fehler` statt throw.** → [artefakt-engine.md](docs/architecture/artefakt-engine.md)
34. **NF-Bausteine sind kuratierte App-Daten und werden wortgetreu verwendet — der Skill-Pfad (Template/System-Prompt/Modifier) formuliert den Baustein-Text nie um, füllt nur Platzhalter.** `[test: nf-skill.test.ts]` → [artefakt-engine.md](docs/architecture/artefakt-engine.md)
35. **`skillEnthaeltDokumentInhalte` leitet die DSGVO-Klasse aus dem `promptTemplate`-TEXT ab (literal `{{vbMarkdown}}`/`INHALTS_SLOTS`), NICHT aus dem `slots`-Array — dokument-tragende Skills müssen den Slot-Platzhalter im Template führen (Skill-Record = Policy-Subjekt).** → [transport-policy.md](docs/architecture/transport-policy.md)
36. **Der Streamlit-Chat ist stateful — jeder Einzel-Skill-Lauf resettet zuerst (`starteFrischenChat` VOR dem Submit); Läufe ohne bestätigten Reset laufen best-effort weiter, sind aber markiert (Chat-Panel + `begruendung.ts` ausgenommen).** → [streamlit-bridge.md](docs/architecture/streamlit-bridge.md)
37. **Das Assistent-Ereignisprotokoll (Phase 0) ist strikt gerätelokal (nur Varianten-IDB, NIE Share/`registry.json`/Snapshot/Export); einzige Schreib-Gate-Stelle `protokolliereEreignis` (Flag + Opt-in); nie Verhaltens-/Zeitmetrik oder Dokumenttext; Schema nur additiv.** `[test: recorder.test.ts]` → [assistent-protokoll.md](docs/architecture/assistent-protokoll.md)
38. **Das Assistent-Gedächtnis (Phase 2) folgt „Operationen statt Neuschrieb" (LLM liefert nur Ops ADD/UPDATE/INVALIDATE/NOOP + Faktensätze, nie IDs/Belege — der Code prüft in der reinen `wendeOperationenAn`); invalidieren statt löschen; strikt lokal + doppeltes Opt-in; Konsolidierung nur intern via `getTransportForKonsolidierung()` + `BridgeMutex` (Vordergrund-Vorrang).** `[test: operationen.test.ts / store.test.ts / bridge-vordergrund.test.ts]` → [assistent-gedaechtnis.md](docs/architecture/assistent-gedaechtnis.md)
39. **ORT-WASM kommt ausschließlich über `ensureOrtWasmBinary()` (Inline-gzip aus `src/generated/ort-wasm-gz.ts` → `DecompressionStream` → `env.backends.onnx.wasm.wasmBinary`); nie `wasmPaths`/Asset-URLs reaktivieren — der Post-Build-Strip (`strip-inline-wasm.mjs`) leert die inlined WASM-`data:`-URLs.** → [runtime-layers.md](docs/architecture/runtime-layers.md)
40. **Status-System (neu): `getStatusCategory` liest snapshot-first mit byte-identischem `CATEGORY_MAP`-Fallback (kein zweiter Kategorien-Weg); der Katalog ist TEAM-Sidecar (`_intern/status-katalog.json`, Zugriff nur über `katalog-share.ts`, Abgleich einmal beim Start), das append-only Event-Log (`status_event`) + der Unkuratiert-Puffer bleiben gerätelokal (nie Share/Snapshot/Personal-Mirror), Event-Log nie mutieren/löschen; alles gated hinter `statusCockpit`.** `[test: status-katalog-share-only / status-event-log-local-only / byte-identitaet]` → [docs/status-system/README.md](docs/status-system/README.md)
41. **Bearbeitungs-Meilensteine: Plan = TEAM-Sidecar (Schreiben nur via `canWriteDatenShare`), ausgewertet wird nur die FREIGEGEBENE Fassung; Bedingungen über den geteilten Evaluator `status/bedingung.ts` (kein zweiter), CSV-Spalten über den Code (Schema-Auflösung); Projektions-Signatur enthält den Kalendertag; Risiko-Meldungen nur in den persönlichen Ordner, nie löschen.** `[test: meilenstein-plan-share-only]` → [meilensteine.md](docs/architecture/meilensteine.md)
42. **Der Statusbaum ist kuratierbare Team-Daten, kein Code: Kategorie-Ids (`vb.…`/`tv.…`) stehen nur im Seed, die Anwendung liest `version.kategorien`; Code-Felder tragen den ROHEN Spalten-Code als `feldId` und werden über `baueFeldAufloesung` gegen das Programm-Schema aufgelöst (Kollision ⇒ kanonisches Feld gewinnt); `ebene` sagt WORÜBER, `herkunft` WO — die `X`-Codes stehen im TV-Record; Datums-/Textfelder tragen nur mit `rang > 0` zur Ableitung bei, Konflikte bleiben Wert-Feld-Sache.** `[test: status-kategorie-nur-aus-katalog]` → [KATALOG-CODES.md](docs/status-system/KATALOG-CODES.md)
43. **Bezeichnung + Rolle der Statuscodes sind FREMDDATEN aus der Kürzel-Zuarbeit (generiert nach `seed-codes.data.ts`, nie von Hand); unsere Kuration (Ordner/Phase/Rang) lebt getrennt in `seed-codes.ts` und überlebt jede Neugenerierung. Rollen immer über `rollenVonFeld`/`betrifftRolle` lesen (übersetzt die abgelöste `zustaendigkeit` mit) — LEERE Rollen heißen „jeder darf setzen", nie „niemand": ein neutraler Eintrag bleibt unter JEDER Rollenwahl sichtbar.** `[test: rollen.test.ts]` → [KATALOG-CODES.md](docs/status-system/KATALOG-CODES.md)
44. **Vorgangssystem: die App leitet KEINEN Status ab, alles Neue steht neben dem importierten. Kürzel nie als `D_<code>`-Literal, sondern über `todoFeld()` (`AAE`/`ABB`/`AZ1`/`VBE` hängen an kanonischen Feldern — `KANONISCHE_CODE_FELDER`); ein Code an zwei Feldern wird entdoppelt. Unbelegbares bekommt ein EIGENES Urteil (`unbewertet`, „nicht prüfbar") — nie „ok", nie Schweigen. Trigger gelten **je Richtlinie**: Schlüssel = (Programm, Kürzel, Folge), Auswahl über `FM_NUMMER`, nie ein Ersatz-Programm.** `[test: waechter/navigator/referenz-import.test.ts]` → [vorgangssystem.md](docs/architecture/vorgangssystem.md)
