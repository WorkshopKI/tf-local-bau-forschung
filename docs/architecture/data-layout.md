# Datenverzeichnis & Pfad-Layout (v1.9+)

*Last reviewed: 2026-05-28 (v2.2.0)*

Alle geteilten Daten und Config-Dateien liegen im **Daten-Share** (separater SMB-Share vom App-Share mit `teamflow.html`). Struktur:

## `programm/` — domänenspezifische Daten

- `programm/antraege/imports/` — rohe CSV-Importe (ersetzt v1.8-Pfad `csv-sources/`)
- Förderanträge liegen im IDB-Store ANTRAEGE (CSV-Import-Schema), nicht als Dateien unter `programm/antraege/`.
- `programm/schemas/` — Column-Mapping-JSONs (ersetzt `csv-schemas/`)
- `programm/index/` — Orama-Snapshots + `index-meta.json`

## `_intern/` — Infrastruktur + Sidecars

- `_intern/feedback/feedback.json` — Multi-User-Tickets
- `_intern/feedback/system-prompt.md` — Kurator-editierbarer Chatbot-Prompt
- `_intern/changelog-user.md` — (v2.126–v2.161.2, **obsolet seit v2.161.3**) ehemals der zur Laufzeit gelesene geglättete Nutzer-Changelog. Der geglättete Changelog wird jetzt hand-gepflegt in der committed Quelle [changelog-user.md](../../src/core/components/changelog/changelog-user.md) und zur Build-Zeit eingebettet (kein Runtime-Share-Weg, kein „Mit KI glätten"-Editor mehr). Eine evtl. noch vorhandene Share-Datei wird ignoriert und kann gelöscht werden.
- `_intern/anfragen-settings.json` — (v2.137) Modul „Anfragen": team-weite Modul-Einstellungen, derzeit nur `dashboardUrl` (Override der externen ZIM-FAQ-Assistent-URL). Schema `{ version: 1, updatedAt?, dashboardUrl? }`. Idempotent-overwrite via `atomicWrite` (kurator-gated). Mirror, nicht Master: Auflösung GUI-Override → IDB-Cache → Build-Default. Service: [settings.ts](../../src/plugins/anfragen/settings.ts).
- `_intern/audit-log.jsonl` — Kurator-Events (Append-Only JSONL)
- `_intern/build-lock.json` — Aktiver Build-Lock (Heartbeat)
- ~~`_intern/kurator-config.enc`~~ / ~~`_intern/kurator-name-*.txt`~~ — **entfallen mit v3.0**: der Kurator-Zugang lief doppelt (Share-Datei UND build-eingebackenes Passwort). Geblieben ist der Build-Weg, siehe [modul-freischaltung.md](modul-freischaltung.md). Vorhandene Dateien werden nicht mehr gelesen und können nach dem Rollout gelöscht werden.
- `_intern/scan-manifest.json` — Phase 2: JSONL-Spiegel des `phase2_scan_manifest`-IDB-Stores (optional, Caller-getriggert)
- `_intern/dms-index-filtered.csv` — Phase 2: gefilterte DMS-CSV (Output von `scripts/filter-dms-csv.mjs`)
- `_intern/aktenplan-mapping.json` — Phase 2: optionales Override des Aktenplanzuordnung→doc_type Mappings
- `_intern/vorgangssystem/journal/stand.json` — (v2.392) Import-Diff-Journal: die Projektion des letzten Nacht-Exports (`D_*`-Spalten + `STATUS_TV`/`STATUS_VB`, Datumswerte als `YYYYMMDD`-Zahl), gegen die der nächste Export verglichen wird. Schema `{ schema:1, journalAb, letzterStempel, verarbeitet[], bereich[], werte{} }`. Idempotent-overwrite **gestreamt** (`atomicWriteStream` über `sidecar-datei.ts`, mit Backup — die einzige nicht rekonstruierbare Datei des Journals). Gemessen 3,38 MB bei 7 269 Anträgen. **Keine Bearbeiterspalten** (Pitfall #48).
- `_intern/vorgangssystem/journal/journal-YYYY-MM.jsonl` — (v2.392) die Änderungs-Einträge, append-only mit monatlicher Rotation. Dedupliziert wird beim **Lesen** über `(stempel, antragId, feld, art)`, weil der Lauf bewusst erst das JSONL und dann den Stand schreibt.
- `_intern/skills/registry.json` — (v2.69) Skill-Verwaltung: Kurator-pflegbare Skills + Qualitätsregeln (gemeinsam, „zusammen Geändertes zusammen speichern"). Schema `{ version:1, updated_at, skills[], regeln[] }`. Idempotent-overwrite via `atomicWrite` (mit Backup), Schreiben self-gated auf `queryPermission` (Kurator/PL/dev). IDB-Cache unter Key `skill-registry:cache` im generischen `kv`-Store — KEIN eigener Object-Store/Version-Bump (würde unter `file://` mit parallel offenen Varianten `onblocked` triggern, vgl. `kurzfassung-store.ts`).

## `_intern/auslastung*` — Auslastungs-Modul

- `_intern/auslastung.json` — Konfig (Überkategorien, Gewichtungen, Setup-Flag), anonyme MA-Profile, Klassifizierungen, Zuweisungen, Kalibrierungs-Ergebnisse. Last-Write-Wins. KEINE echten Bearbeiter-Kürzel. Legacy-Pfad `_intern/auslastung/data.json` vor Mai 2026 — Load liest beide, Save schreibt nur den neuen.
- `_intern/auslastung-kuerzel-map.json` — persistente `kuerzel ↔ anonId`-Map (append-only, Klartext). Stabilisiert anonIds gegen ephemeral-Sort-Drift bei neuen TIB-Kürzeln. Schema: `{ version: 1, updatedAt, entries: Array<{ kuerzel, anonId, createdAt }> }`. Invariante: `entries[i].anonId === MA{i+1}`, einmal vergebene Einträge werden nie geändert oder gelöscht. Wird beim ersten Render des `useAntraegeCache` aus dem aktuellen alphabetischen Sort der Antraege bootstrapped; danach werden neue Kürzel nur hinten angehängt.
- `_intern/auslastung-embedding-corpus.manifest.json` — (Mai 2026) Metadaten zum geteilten Stage-2-Embedding-Korpus. Schema: `{ version: 1, modellId, dim, antraegeCount, builtAt, builderProfile?, aktenzeichenSetHash, aktenzeichen[], binFormat: 'f32-stream', binBytes }`. Klein (~200 KB für 13k aktenzeichen), `.backup`-Rotation deaktiviert.
- `_intern/auslastung-embedding-corpus.bin` — (Mai 2026) konkatenierte float32-Vektoren in der Reihenfolge `manifest.aktenzeichen[]`. Größe = `count × dim × 4 Bytes` (typisch ~40 MB bei 13k × 768d). Wird nach jedem erfolgreichen Build automatisch hochgeladen; Auto-Download wenn lokal leer + Modell/Dim/Hash passen. Atomar geschrieben mit `skipBackup: true` (Recovery via Re-Build).
- `_intern/auslastung-embedding-corpus-verbund.{manifest.json,bin}` — (v2.19) separater Mirror der **Verbund**-Embeddings (`auslastung-emb-verbund:*`, für die Klassifizierung). Gleiche Serialisierung wie der per-Antrag-Korpus, aber das Manifest-Feld `aktenzeichen` hält hier verbundIds; klein (~hunderte Verbünde). Upload zusammen mit dem per-Antrag-Korpus in `EmbeddingCorpusSection.build()`; Auto-Download „download-if-empty" beim Öffnen der Klassifizierung ([corpus-share-sync.ts](../../src/plugins/auslastung/services/corpus-share-sync.ts)). `skipBackup: true`, Recovery via Re-Build.

## Wurzel-Ebene

- `backups/YYYY-MM-DD/` — Wöchentliche Snapshots (Rolling 4 Gen., Daten-Share-Root)
- `README.txt` — Orientierungs-Text (von der App beim Setup angelegt)

## Browser-IndexedDB (machine-lokaler Cache, pro Variante getrennt)

Die IndexedDB ist der **maschine-lokale Cache** im Browser (nicht auf dem Share). Seit v2.87 ist der DB-Name **pro Build-Variante** suffigiert: `teamflow-<outputFilename>` — also `teamflow-zim-dashboard`, `teamflow-zah-pl`, `teamflow-zah-dev` (Dev-Server: `teamflow-dev`). Abgeleitet via `getVariantDbName()` / `deriveVariantDbName()` in [runtime-config.ts](../../src/config/runtime-config.ts), reingereicht in den `IDBStore`-Konstruktor ([idb-store.ts](../../src/core/services/storage/idb-store.ts)).

Hintergrund: Unter `file://` teilen alle Varianten denselben Origin; ein konstanter Name `teamflow` ließ prod/kurator/pl in **dieselbe** DB schreiben (Bug-Klasse 1/3, Datenverlust beim Varianten-Wechsel). Eine frisch suffigierte Variant-DB startet **leer** und lädt beim Erststart per normalem Snapshot-Sync aus dem Daten-Share (kein Migrations-/Kopier-Code; Share = Source of Truth). Eine alte `teamflow`-DB aus Pre-v2.87-Nutzung bleibt verwaist liegen (harmlos, manuell via DevTools löschbar).

## Externe Handles

- Phase 2: separater Dokumentenquelle-Handle (`smb-handles.dokumentenquelle`) für die Scan-Source — wird via `pickAndStoreDokumentenquelleHandle()` gesetzt; Scanner traversiert von dort über `runtimeConfig.scan.sub_roots`. Seit v1.15 multi-source via `smb-handles.dms-source-${id}`.

## v2.0 — Persoenlicher Ordner

Pro User auf dem Home-Laufwerk (Subpfade unterhalb des Persoenlich-Handles, siehe `PERSOENLICH_*`-Konstanten in [types.ts](../../src/core/services/infrastructure/types.ts)):

- `ZAH/profile.json` — User-Profil
- `ZAH/einstellungen.json` — User-Settings
- `ZAH/feedback/outbox/` — Feedback-Outbox (Nicht-Kurator) für späteren Einsammel-Schritt
- `ZAH/feedback/meine-feedbacks.json` — User-eigene Feedback-Items
- `ZAH/auslastung-profil.json` (v2.6) — MA-Selbst-Profil fürs Auslastungs-Modul (Technologien/Kategorien/Antragstypen). Nicht-Kuratoren können `_intern/auslastung.json` nicht schreiben (v2.0-Read-Only-Daten-Share), pflegen ihr Profil daher hier; die PL sammelt alle Profile über die Wurzeln der persönlichen Ordner ein (seit v4.1 mehrere Gruppen, siehe [v2-handle-architektur.md](v2-handle-architektur.md)) und merged sie in `auslastung.json`. Atomic-overwrite, kein Backup nötig (Re-Build aus dem Tab). Idempotent über `updatedAt` (LWW).

Details zur 2-Handle-Architektur: [v2-handle-architektur.md](v2-handle-architektur.md).
