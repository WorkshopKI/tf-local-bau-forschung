# Refactoring-Audit — Pre-Phase-2

Datum: 2026-04-21
Basis: git-hash `ed778b3` auf `master` (v1.9 + Phase-1a/1b + Build-Varianten v1.10)
Umfang: Kategorien A bis J (Stores, Komponenten, Types, Utilities, Naming, Dead Code, Plugin-Struktur, Build, Tests, Doc-Abgleich) + zwei manuell gemeldete Findings
Methode: READ-ONLY Code-Analyse via Glob/Grep/Read, keine Änderungen am Code

---

## Executive Summary

Das Repo ist **insgesamt gesund**. Plugin-Architektur konsistent, File-System-Access-API sauber gekapselt, TypeScript streng konfiguriert (`strict`, `noUnusedLocals`, `noUncheckedIndexAccess`), die Admin→Kurator-Migration ist mit deprecated-markierten Legacy-Fallbacks sauber durchgezogen. **Zwei echte Phase-2-Blocker**: der Kurator-Toggle in den Einstellungen ignoriert das `features.kuratorMenus`-Flag, und das `demoDataBundled`-Flag wird nirgends gelesen (daher leere Demo-Variante). Größtes technisches Thema ohne Blocker-Charakter: elf Dateien überschreiten das in CLAUDE.md festgelegte 300-Zeilen-Limit — davon vier kritische UI-Wizards/Panels. Empfehlung: zuerst die zwei Blocker fixen (≈1-2 Stunden zusammen), dann Phase 2 starten; Komponenten-Split parallel oder nach Phase 2.

---

## Quick Wins (sofort angehen)

### QW1 — Duplizierter `generateId()` in zwei Vorgangs-Stores
- **Wo**: [src/plugins/bauantraege/store.ts:18-26](src/plugins/bauantraege/store.ts#L18) und [src/plugins/forschung/store.ts:18-24](src/plugins/forschung/store.ts#L18)
- **Problem**: Identische Logik bis auf Präfix (`BA-{year}-{index}` vs `FA-{year}-{index}`). Copy-Paste, zwei Wartungs-Punkte.
- **Behebung**: Extrahieren zu `generatePrefixedId(prefix: string)` in neuer Datei `src/core/services/id-generator.ts`. Beide Stores darauf umstellen.
- **Aufwand**: S (10 min)

### QW2 — CLAUDE.md nennt Re-Ranker fälschlich "deaktiviert"
- **Wo**: [CLAUDE.md:82](CLAUDE.md#L82) versus [src/core/hooks/useSearch.ts](src/core/hooks/useSearch.ts) + [src/core/services/search/re-ranker.ts](src/core/services/search/re-ranker.ts)
- **Problem**: Doku sagt "PHASE 2, deaktiviert — Code vorhanden aber nicht aktiv", aber `useSearch.ts` ruft `initReRanker()`, prüft `isReRankerReady()` und nutzt `rerank()` in der Suche aktiv.
- **Behebung**: Zeile 82 in CLAUDE.md aktualisieren — Re-Ranker ist aktiv und per Pipeline-Config steuerbar.
- **Aufwand**: S (2 min)

### QW3 — Inline-ID in Dokumente-Store
- **Wo**: [src/plugins/dokumente/store.ts:74](src/plugins/dokumente/store.ts#L74)
- **Problem**: `DOC-${Date.now()}` als Inline-String; nicht kollisionssicher bei schnellen Folge-Uploads.
- **Behebung**: Zentrale `uuid()`-Funktion aus [src/core/services/csv/merger.ts:20](src/core/services/csv/merger.ts#L20) (oder künftig `id-generator.ts` aus QW1) nutzen.
- **Aufwand**: S (5 min)

### QW4 — Alter TODO-Kommentar im XLS-Parser
- **Wo**: [src/core/services/csv/filter/xlsLabelParser.ts:225](src/core/services/csv/filter/xlsLabelParser.ts#L225)
- **Problem**: `TODO V2: bei niedriger Konfidenz zusätzlich group_path.join(' / ') + label versuchen…` — veraltet, nicht im Roadmap-Doc verankert.
- **Behebung**: Entweder ins Architektur-Doc-Backlog (Abschnitt 17) aufnehmen oder ersatzlos löschen. Entscheidung liegt beim Developer.
- **Aufwand**: S (2 min)

---

## Phase-2-Blocker

Zwei Findings müssen vor Phase 2 adressiert werden. Beide kamen aus manueller Verifikation durch den Developer und wurden im Code bestätigt.

### B1 — Kurator-Toggle umgeht `features.kuratorMenus`
- **Warum Phase-2-Blocker**: In der `foerderprogramm.config.json` ist `kuratorMenus: false` gesetzt, weil das Produkt-Team die Kurator-Bereiche für Förderprogramm-Kunden ausblenden will. Der Plugin-Filter in [src/plugins.config.ts:45](src/plugins.config.ts#L45) entfernt die Kurator-Plugins korrekt aus `enabledPlugins`. **Aber**: [src/plugins/einstellungen/EinstellungenPage.tsx:87-97](src/plugins/einstellungen/EinstellungenPage.tsx#L87) zeigt den Aktivierungs-Toggle unabhängig von der Flag, und [src/core/ShellLayout.tsx:58](src/core/ShellLayout.tsx#L58) prüft nur `profile.is_kurator` — das Feature-Flag wird zur Runtime nicht konsultiert. Heute unkritisch (Kurator-Plugins sind alle `category: 'kuration'`, werden beim Config-Load entfernt). Wird Phase 2 einen Kurator-Workflow als `category: 'workflow'` mit `kuratorOnly: true` einbauen (z.B. "Dokumenten-Scan starten"), schaltet der User ihn aus Versehen frei — das untergräbt die Produkt-Intent.
- **Skizze für Patch**:
  1. In [EinstellungenPage.tsx](src/plugins/einstellungen/EinstellungenPage.tsx): Section "Kurator-Funktionen" nur rendern, wenn `isKuratorMenusEnabled()` (Helper existiert in [src/config/feature-flags.ts:21-23](src/config/feature-flags.ts#L21)).
  2. In [ShellLayout.tsx:58-65](src/core/ShellLayout.tsx#L58): `isKurator` zusätzlich mit `isKuratorMenusEnabled()` gaten — Belt-and-Suspenders, falls Profile aus Legacy-Bestand einen aktiven Toggle tragen.
  3. Optional: bei Build-Zeit-Filterung in `plugins.config.ts:45` den Kommentar erweitern ("aber nicht ausreichend für Runtime — siehe ShellLayout").
- **Aufwand**: S (30 min inklusive Test in allen drei Varianten via `npm run build:dev/demo/foerderprogramm`)

### B2 — Demo-Variante lädt keine Daten trotz `demoDataBundled: true`
- **Warum Phase-2-Blocker**: Phase 2 baut auf einer funktionierenden Demo-Umgebung auf (Stakeholder-Präsentationen, Produkt-Owner-Reviews, Dev-Smoke-Tests der Scan-/Klassifikations-Pipeline). Aktuell startet `npm run build:demo` eine komplett leere App — das Flag wird gesetzt, aber nie gelesen. Ergebnis: jeder Entwickler muss nach dem Build manuell ins Admin-Panel und `seedTestData()` klicken, sonst ist die Demo leer. Das ist in Phase 2 mit Scan-Workflow mehr als ärgerlich: der Scan braucht vorhandene Anträge als Matching-Ziele.
- **Befund im Detail**:
  - Flag definiert in [src/config/runtime-config.ts:18](src/config/runtime-config.ts#L18)
  - Gesetzt in [configs/demo.config.json:13](configs/demo.config.json#L13) und [configs/dev.config.json:13](configs/dev.config.json#L13)
  - Keine Read-Stelle in `src/` (Grep `demoDataBundled` findet nur Definition, Config-Einträge und Config-UI — keine Code-Logik)
  - `seedTestData()` existiert in [src/core/services/seed/seed-data.ts:14](src/core/services/seed/seed-data.ts#L14) und wird manuell aus [src/plugins/admin/sections/ConfigSection.tsx:87](src/plugins/admin/sections/ConfigSection.tsx#L87) und [src/plugins/admin/IndexHelpers.tsx:24](src/plugins/admin/IndexHelpers.tsx#L24) getriggert
- **Skizze für Patch**:
  1. Helper `isDemoDataBundled()` in [src/config/feature-flags.ts](src/config/feature-flags.ts) ergänzen.
  2. In [src/core/App.tsx](src/core/App.tsx) nach Onboarding-Check (Welcome-Screen-Gate passiert) und vor dem AppRouter-Render: wenn `isDemoDataBundled() && !smbHandle.dataShare`, prüfe Leere (keine Antraege/Verbuende in IDB) und rufe `seedTestData(storage)` auf. Idempotent: Check auf bereits vorhandene Daten vermeidet Double-Seed.
  3. Eindeutiges Log/Toast `"Demo-Daten geladen"` damit der Developer erkennt was passierte.
  4. Guard-Annahme: In `foerderprogramm`-Variante ist `demoDataBundled: false` — Flag sollte dort nie true werden. Validator in [scripts/config-schema.mjs](scripts/config-schema.mjs) könnte das durchsetzen (Bonus, nicht blockierend).
- **Aufwand**: M (1-2 h inkl. Testen in Demo-Variante per `file://`-Build)

---

## Größere Aufräum-Pakete

Findings die zu groß sind für Quick-Wins aber keine Phase-2-Blocker sind.

### P1 — 300-Zeilen-Limit-Verletzungen (CLAUDE.md Architecture-Principles)
- **Thema**: CLAUDE.md §"File Size Limit" gibt ein striktes Limit von 300 Zeilen pro Source-File vor. Aktuell verletzen elf Dateien dieses Limit — drei davon deutlich (>400).
- **Betroffene Dateien** (absteigend):

  | Datei | Zeilen | Charakter |
  |---|---|---|
  | [src/core/services/search/example-docs.ts](src/core/services/search/example-docs.ts) | 575 | Statische Seed-Daten |
  | [src/core/services/feedback/feedbackService.ts](src/core/services/feedback/feedbackService.ts) | 533 | CRUD + Sync + FAQ + Sponsoring |
  | [src/plugins/filter-admin/dialogs/FilterEditDialog.tsx](src/plugins/filter-admin/dialogs/FilterEditDialog.tsx) | 477 | 4-Step-Wizard inline |
  | [src/plugins/csv-sources-admin/wizard/useCsvWizardState.ts](src/plugins/csv-sources-admin/wizard/useCsvWizardState.ts) | 453 | Wizard-State-Machine |
  | [src/plugins/csv-sources-admin/wizard/CsvSourceWizard.tsx](src/plugins/csv-sources-admin/wizard/CsvSourceWizard.tsx) | 384 | Wizard-Container |
  | [src/plugins/admin/MetadataSmokeTest.tsx](src/plugins/admin/MetadataSmokeTest.tsx) | 372 | Test-Runner + GPU-Init + UI |
  | [src/components/feedback/FeedbackPanel.tsx](src/components/feedback/FeedbackPanel.tsx) | 365 | 2-Step + Auto-Klassifikation + FAQ |
  | [src/core/services/search/batch-indexer.ts](src/core/services/search/batch-indexer.ts) | 353 | Orchestrator |
  | [src/core/services/search/metadata-extractor.ts](src/core/services/search/metadata-extractor.ts) | 347 | LLM-Extraktion |
  | [src/core/services/infrastructure/migration.ts](src/core/services/infrastructure/migration.ts) | 318 | v1.9-Legacy-Migration |
  | [src/core/services/csv/merger.ts](src/core/services/csv/merger.ts) | 309 | CSV-Merge-Logik |

- **Empfehlung**: **nach Phase 2** oder opportunistisch, wenn eine dieser Dateien ohnehin angefasst wird. Wizards (Filter + CSV) wären der beste Kandidat für eine geplante Aufteilung, weil sie in Phase 2 vermutlich erweitert werden (Dokumenten-Klassifikations-Regeln brauchen evtl. eigenen Wizard-Schritt). `example-docs.ts` ist reine Daten — nur nach Bereichen splitten (bauantrag vs forschung) und unkritisch. `migration.ts` bleibt bis Phase 2 stabil und kann danach aufgeteilt werden, wenn neue Migrations-Schritte dazukommen.
- **Aufwand**: L (ca. 1-2 Tage für alle elf Dateien, oder 2-4 h pro Wizard wenn isoliert)

### P2 — `Vorgang`-Typen nicht einheitlich
- **Thema**: Generischer `Vorgang`-Type in [src/core/types/vorgang.ts](src/core/types/vorgang.ts) hat `type: 'bauantrag' | 'forschung'`, aber Plugin `forschung` definiert zusätzlich einen eigenen Type in [src/plugins/forschung/types.ts](src/plugins/forschung/types.ts). [src/core/hooks/useVorgangDetail.ts:12](src/core/hooks/useVorgangDetail.ts#L12) bekommt `vorgang: any` als Workaround — typisch für ungelöste Typ-Divergenz.
- **Betroffene Dateien**: die drei genannten plus alle Konsumenten von `useVorgangDetail` (Bauanträge-Detail, Forschung-Detail, Artefakte-Tab).
- **Empfehlung**: **vor Phase 2**, wenn Scan/Klassifikation Anträge als Ziele taggt — dort werden Type-Narrowing-Pfade kritisch. Discriminated Union: `type AnyVorgang = BauantragVorgang | ForschungsVorgang` mit gemeinsamer Basis und `type`-Diskriminator. Aufwand überschaubar, Risiko mittel (Compile-Fehler in Konsumenten).
- **Aufwand**: M (3-5 h inkl. Anpassen aller Konsumenten)

### P3 — Feedback Legacy-Felder Write-Path
- **Thema**: [src/core/services/feedback/feedbackService.ts:28-38](src/core/services/feedback/feedbackService.ts#L28) normalisiert `admin_*` → `kurator_*` beim **Lesen** aus dem Shared-File. Beim **Schreiben** wird nicht zurückgespiegelt. Folge: Wenn zwei Rechner mit unterschiedlichem Build-Stand (vor/nach v1.9) auf dasselbe Shared-File zugreifen, kann der alte Stand `admin_priority` schreiben, der neue liest sie zwar als Fallback, aber ein folgender Write des neuen Rechners vergisst den Fallback-Pfad und verliert Änderungen des Alt-Clients.
- **Empfehlung**: nach Phase 2 (niedrige reale Kollisions-Wahrscheinlichkeit). Oder: zum Zeitpunkt, wo der letzte alte Build deploy-weg ist, Legacy-Felder komplett entfernen. Bis dahin `normalizeLegacyFields()` auch in `updateFeedback`/`saveSharedFile` Path integrieren.
- **Aufwand**: M (2 h)

---

## Niedrig-Schmerz-Findings

- Directory-Namen tragen noch `*-admin/` (z.B. `src/plugins/csv-sources-admin/`), während Plugin-IDs bereits `*-kuration` sind. Rein kosmetisch, keine funktionale Auswirkung.
- IDB-Zugriffe über ~174 Stellen verteilt (keine Repository-Abstraktion). Funktioniert gut, Abstraktion würde unnötige Indirektion einführen — lassen.
- Cross-Plugin-Imports nur im `home`-Plugin ([src/plugins/home/useDashboardData.ts](src/plugins/home/useDashboardData.ts) importiert aus `bauantraege/store` und `forschung/store`). Akzeptabel für Dashboard-Aggregator.
- 25 `any`-Verwendungen im Code: 23 davon Library-bedingt (Orama, Transformers.js, PDF.js-Worker). Zwei eigene Stellen: [src/core/hooks/useVorgangDetail.ts:12](src/core/hooks/useVorgangDetail.ts#L12) (löst sich mit P2) und [src/core/services/search/re-ranker.ts:44-45](src/core/services/search/re-ranker.ts#L44) (Tokenizer/Model — könnte via `FeatureExtractionPipeline`-Type getypt werden).
- Keine zentrale Datum-Formatter-Suite: `parseGermanDate()` existiert in [src/core/services/csv/dateParse.ts](src/core/services/csv/dateParse.ts), aber kein `formatGermanDate()`/`toISOString()`-Paar. Aktuell inline via `new Date().toISOString()`. Erst zentralisieren, wenn echte Inkonsistenzen auftreten.
- Admin-Panel-Naming inkonsistent: `admin/`, `csv-sources-admin/`, `filter-admin/`, `feedback/` — siehe auch P1/Directories oben.
- Wizard-Validierung inline in [CsvSourceWizard.tsx:62-92](src/plugins/csv-sources-admin/wizard/CsvSourceWizard.tsx#L62) statt in eigenem Service. Beim P1-Split ohnehin mitziehen.
- IDB-Keys mit Präfixen (`doc:`, `smb-handles`, `kurator-session-meta`) nicht zentral dokumentiert — Konvention verteilt sich auf 3-4 Call-Sites. Könnte in `types.ts` als Konstanten gebündelt werden.

---

## Architektur-Doc-Diskrepanzen

### CLAUDE.md
- **Zeile 82**: "Re-Ranker: Cross-Encoder (PHASE 2, deaktiviert)" — **falsch**. Code nutzt ihn aktiv (siehe QW2).
- **Projekt-Struktur-Baum** (Zeilen ~238-290): Listet nicht alle aktuellen Plugins. Fehlen/unvollständig: `programme-admin`, `csv-sources-admin`, `filter-admin`, `unterprogramme-admin`, `antraege`, `dev-state-inspector`. Aktueller Stand in [src/plugins.config.ts:1-18](src/plugins.config.ts#L1) gegenprüfen und Baum aktualisieren.

### ARCHITEKTUR_BAU_FORSCHUNG_REAL.md
- Grundstruktur stimmt mit dem Ist-Code überein. Stores, Pfad-Konstanten, Feature-Flags, v1.9-Migration korrekt beschrieben.
- Kein grober Drift gefunden. Dokument wird offenbar aktiv gepflegt (letzter Stand v1.12).
- Hinweis: Das Dokument ist 1365 Zeilen lang und beim Lesen auf einmal LLM-Context-sprengend. Split in thematische Unter-Dokumente wäre mittelfristig sinnvoll — kein aktueller Blocker.

### Fehlende Dokumentation
- Kein dedizierter Abschnitt zu `features.*`-Flag-Semantik (Welche Flag zieht welche Plugins? Was sind die Produkt-Intent-Grenzen?). Aktuell nur aus `plugins.config.ts` ableitbar.
- Keine Dokumentation zur Konvention der IDB-Key-Präfixe (`doc:`, `smb-handles`, `profile` im `kv`-Store).

---

## Dependencies und Build

### Dependencies
- `package.json` `dependencies`: alle ~15 Einträge aktiv im Gebrauch (geprüft via Grep pro Package-Name).
- `devDependencies`: alle sinnvoll (Vite, TypeScript, Tailwind, Plugin-React, Single-File-Plugin, XLSX für Test-Asset-Gen).
- Keine unbenutzten Dependencies gefunden.

### Scripts
- `npm run generate:test-csvs`, `generate:test-label-xlsx`: als prebuild-Hooks korrekt verdrahtet.
- `npm run build:dev/demo/foerderprogramm/variant`: Build-Varianten-Orchestrator, alle aktiv.
- `npm run config-ui`: Config-Verwaltungs-UI auf Port 5174, aktiv (`tools/config-ui/`).
- Keine Script-Leichen.

### Vite / TypeScript
- `vite.config.ts`: sinnvoll strukturiert, nimmt `TEAMFLOW_CONFIG` env-var, `worker.format: 'iife'` für file://-Kompatibilität. Keine Akkumulation.
- `tsconfig.app.json`: `strict`, `noUnusedLocals`, `noUnusedParameters`, `noUncheckedIndexAccess`, `isolatedModules` alle an. Sehr gut — keine Löcher.

### Configs
- Drei aktive Varianten (`dev`, `demo`, `foerderprogramm`) + kommentiertes `_template.config.jsonc`. Alle aktuell. `scripts/config-schema.mjs` enthält den Validator samt `DEFAULT_CONFIG` — wird von `build-with-config.mjs` + `config-ui` gemeinsam genutzt.
- **Mit B2 zusammenhängend**: Validator könnte durchsetzen, dass `variant === "production"` zwingend `demoDataBundled === false` hat (Guard gegen Prod-Leak von Demo-Daten).

### Tests
- **Status**: Keine Unit-Tests, keine E2E-Tests, keine Test-Runner-Dependencies.
- Grep nach `**/*.test.ts`, `**/*.spec.ts`, `**/*.test.tsx`, `**/*.spec.tsx` → 0 Treffer.
- Kein `vitest`/`jest`/`playwright`/`cypress` in `package.json`.
- Test-Strategie explizit nicht im Scope dieses Audits (eigenes späteres Thema).

---

## Abschluss

**Empfohlene Reihenfolge vor Phase 2:**

1. **B1** Kurator-Toggle gaten — ~30 min. Einzel-Commit.
2. **B2** Demo-Daten-Auto-Seed — ~1-2 h. Einzel-Commit (mit Smoke-Test in Demo-Variante).
3. **QW2** CLAUDE.md Re-Ranker-Notiz korrigieren — 2 min. Kann in (4) gebündelt werden.
4. **QW1** + **QW3** Zentrale ID-Generator-Datei, bauantraege/forschung/dokumente darauf umstellen — ~20 min. Ein Commit.
5. **QW4** TODO-Kommentar entscheiden (Issue oder löschen) — 5 min.
6. Optional **P2** Vorgang-Union-Type — 3-5 h. Lohnt sich wenn Phase 2 den Scan-Klassifikator schreibt (vermeidet neue `any`-Stellen).

Nach Phase 2 oder opportunistisch:

- **P1** (Komponenten-Splits), zuerst die beiden Wizards.
- **P3** (Feedback Legacy-Write-Path) wenn Feedback-System ohnehin angefasst wird.
- Niedrig-Schmerz-Findings bei Gelegenheit.

**Geschätzter Aufwand bis Phase-2-Start**: zwischen 2 h (nur B1+B2) und einem halben Arbeitstag (B1+B2+alle QWs+P2). Der Developer kann P2 auch nach Phase 2 schieben, ohne damit blockiert zu sein — die Blocker sind allein B1 und B2.

**Fazit**: Das Repo ist **bereit für Phase 2**, sobald die zwei UI-Blocker gefixt sind. Die Architektur-Grundlagen (Plugin-System, Storage-Kapselung, Feature-Flags, TypeScript-Strictness, Legacy-Migration) sind tragfähig genug, um einen Dokumenten-Scan und Klassifikations-Workflow zusätzlich zu tragen. Keine strukturellen Umbauten nötig.
