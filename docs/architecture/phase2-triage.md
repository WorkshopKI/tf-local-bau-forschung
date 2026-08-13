# Phase-2 Triage- & Matcher-Baustein (`src/phase2/`)

Eingangsfilter für die DMS-Dokumenten-Pipeline. Pro Datei wird kaskadiert entschieden: relevant?, doc_type?, zugehöriger Antrag?

## Kaskade (`src/phase2/triage/triage.ts` als Orchestrator)

- **Stage 0 — DMS-CSV-Lookup** (`stage0-dms-lookup.ts`): DocID-Lookup in der gefilterten DMS-CSV (`_intern/dms-index-filtered.csv`), erwartet ~60 % Treffer ohne Datei-Zugriff. Aktenplanzuordnung → doc_type via Mapping in `dms-csv/aktenplan-mapping.ts` (Defaults + Override-JSON unter `_intern/aktenplan-mapping.json`).
- **Stage 1 — Strukturell** (`stage1-structural.ts`): Format-Check, PDF-Searchability-Probe, Sonderregel `Gutachten + DOCX → irrelevant` (Arbeitsversion). pdfjs ist lazy importiert — Tests in Node nutzen den `legacy`-Build via vitest-Alias.
- **Stage 2 — Keywords** (`stage2-keywords.ts` + `keywords.ts`): erste ~500 Tokens via mammoth/pdfjs, Keyword-Marker pro doc_type, FKZ-Extraktion (strict + tolerant), Akronym-Hint. Sonderregel: `korrespondenz`-Top-Match wird auf `nachforderung` verfeinert wenn beide Keywords matchen.
- **Stage 3 — Nemotron** (`stage3-nemotron.ts`): nur für ambige Fälle, ruft `DirectLLMTransport.submitMessage()` mit JSON-only-Schema. `enable_thinking: false`.

## Matcher (`matcher/`)

Nutzt **bestehende** IDB-Stores `antraege` + `akronym_index` — kein eigener FKZ/Akronym-Lookup. FKZ-Treffer im Antrags-Store → `confidence=high`. Akronym-Treffer eindeutig → `medium`, mehrdeutig → `review` mit `candidate_antrag_ids`. Konflikt FKZ vs. Akronym → `flag_conflict`.

## Skip-Liste (`skip-list/`)

IDB-Store `phase2_skip_list`, gekeyt auf `filename` (DocID ist global eindeutig im DMS). `classifier_version` als Reset-Mechanik — bei Klassifikator-Update: zentrale Konstante `CLASSIFIER_VERSION` in `triage.ts` erhöhen, dann `resetSkipListByVersion()`.

## Pending-Antrag-Bucket (`pending-antrag/holding-bucket.ts`)

IDB-Store `phase2_pending_antraege`, Index auf `akronym`. Projektbeschreibungen ohne Match landen hier statt in `orphan`. Re-Match wird automatisch getriggert:
- Nach erfolgreichem CSV-Import (`importer.ts` → `rematchOnSnapshotReload()` Best-Effort)
- Nach erfolgreichem Snapshot-Sync wenn `reloadedStores` `akronym_index`/`antraege` enthält (App.tsx-Sync-Bootstrap)

## Scanner (`scanner/scan-roots.ts`)

Rekursiver Walker über den `dokumentenquelle`-Handle (`smb-handle.ts`). Iteriert `runtimeConfig.scan.sub_roots` als Top-Level-Roots (1–10 Förderunterprogramm-Verzeichnisse), steigt dann in beliebig tiefe Datums-Unterordner ab (Limit `scan.max_depth`, Default 20). Filter `scan.file_extensions`. Yield zwischen Verzeichnissen für UI-Responsiveness.

## Manifest-Store (`scanner/manifest-store.ts`)

IDB-Store `phase2_scan_manifest`, gekeyt auf `filename`, Indexe `matched_antrag_id` + `triage_state`. JSONL-Spiegelung auf den Daten-Share unter `SCAN_MANIFEST_PATH` (`_intern/scan-manifest.json`) ist vorbereitet, der Caller entscheidet wann gespiegelt wird.

## OCR-Side-Car (`ocr/side-car.ts`)

Nur Stub-Interface `ocrFirstPage(pdfBlob)`, wirft `OcrNotImplementedError` — echte Tesseract-Side-Car-Anbindung kommt in einem Folge-Patch.

## DMS-Quellen-Verwaltung (v1.15, `src/plugins/dokumentenquellen-kuration/`)

Neues Kurator-Plugin (`id: 'dokumentenquellen-kuration'`, `kuratorOnly: true`, `category: 'kuration'`, sichtbar wenn `features.dokumentenscan === true`) mit zwei Sections:

- **VerwaltenSection** (Dev-Bereich, sichtbar wenn `features.devInfraPanel === true || import.meta.env.DEV`): Quellen anlegen, Read-Only-Picker (`pickAndStoreDmsSourceHandle`), Sub-Roots editieren, Label ändern, löschen.
- **AktivierenIndexierenSection** (immer sichtbar für Kuratoren): `is_active`-Switch pro Quelle + "Alle aktiven indexieren" + "Manifest auf Share spiegeln". Iteriert via `runBulkTriageForSources` sequentiell über aktive Sources mit globaler DMS-CSV-Cache.
- **Datenmodell** (`src/core/services/dms-sources/`): IDB-Store `dms_sources` (Index `by_active` auf `is_active`), Felder `id`, `label`, `sub_roots[]`, `is_active`, `created_at`, `created_by`, `updated_at`, `last_indexed_at?`, `last_index_stats?`. Source-Handles leben in der `smb-handles`-Map unter Schlüssel `dms-source-${id}`.
- **Manifest-Erweiterung**: `ManifestEntry.source_id?` (optional) — neuer Index `by_source_id` auf dem `phase2_scan_manifest`-Store. Listing-Helper `listManifestEntriesBySource(sourceId)` mappt Legacy-Einträge ohne `source_id` transparent auf die `default`-Source. Filename-Key bleibt unverändert; bei Cross-Source-Filename-Kollisionen Last-Write-Wins (dokumentierte Limitation, DMS-DocIDs sind in der Praxis pro Instanz eindeutig).
- **Migration**: `migrateLegacyDmsSource(idb)` läuft idempotent beim App-Start (in `App.tsx` nach `storage.init()`). Wenn `dms_sources` leer ist UND ein Legacy-`dokumentenquelle`-Handle existiert: legt eine Default-Source mit `id='default'` an, übernimmt `phase2_scan_config.selected_paths` als `sub_roots`, kopiert den Handle auf `dms-source-default`. Audit-Action: `dms_source_migrated_from_legacy`.
- **Audit-Actions**: `dms_source_added`, `dms_source_removed`, `dms_source_label_changed`, `dms_source_subroots_changed`, `dms_source_handle_picked`, `dms_source_handle_lost`, `dms_source_activated`, `dms_source_deactivated`, `dms_source_indexed_started`, `dms_source_indexed_finished`.
- **Phase2RescanCard im Suchindex-Plugin entfernt** (vor v1.15 in `src/plugins/kurator/sections/`); Multi-Source-Indexierung lebt jetzt komplett im neuen Plugin.
- **Einstellungs-Gruppe „Persönliche Dokumentenquellen"** (`src/plugins/einstellungen/daten/DokumentenquellenGruppe.tsx`): User-sichtbar, ausgegraut. Vorbereitend für persönliche User-Pfade, sobald internes Embedding/LLM-API verfügbar ist.

## Build-Time-Config (`runtimeConfig.scan`)

Neue Felder in `scripts/config-schema.mjs` und `src/config/runtime-config.ts`:
- `scan.sub_roots: string[]` — relative Roots im dokumentenquelle-Handle
- `scan.file_extensions: string[]` — Pflicht wenn `features.dokumentenscan = true`
- `scan.max_depth: number`
- `scan.fkz_allowed_prefixes: string[]` — Format `^\d{2}[A-Z]{2}$` (strukturell geprüft)

`validateConfig()` prüft strukturell + erzwingt non-empty `file_extensions` wenn dokumentenscan an.

## Vorfilter-Script (`scripts/filter-dms-csv.mjs`)

Streaming-Filter der 5M-Zeilen-DMS-CSV → ~250k Zeilen via FKZ-Präfix-Regex. Ausgabe mit Zusatzspalte `extracted_fkz`. Encoding-Detection (UTF-8 vs. cp1252) anhand der ersten 4 KB. Summary mit `rows_total`/`rows_kept`/`per_prefix`/`top_aktenplan`/`top_von`. Aufruf: `node scripts/filter-dms-csv.mjs input.csv output.csv [--prefixes 16EP,16KN,16DS,16DL]`.

## FKZ-Regex-Detail

`\b` matcht NICHT zwischen `\w` und `_`, aber FKZs sind im DMS-Export typischerweise von `_` umrahmt. Stattdessen: `(16EP|16KN|...)\d{6}(?!\d)` (nicht von einer Ziffer gefolgt). Gleiches Muster im `filter-dms-csv.mjs` und `fkz-extractor.ts`.

## Eval-Suite (`src/phase2/__tests__/`)

Vitest-basiert (Test-Runner als Devdependency neu, `npm run test:phase2`). Schwelle: ≥ 9/11 korrekt klassifiziert auf den Beispiel-Dokumenten in `docs/phase-2/triage-beispiele/`. Vitest-Setup polyfillt DOMMatrix/Path2D/ImageData für pdfjs-Module-Init und aliased `pdfjs-dist` auf den Legacy-Build (Node-kompatibel).

## Dev-Plugin (`src/plugins/dev-infrastructure-test/panels/TriagePanel.tsx`)

Neues Panel "5 · Phase-2 Triage" — Buttons "Index laden", "Datei wählen + Triage", "Skip-Liste", "Pending". Output als JSON-Block für End-to-End-Validierung.
