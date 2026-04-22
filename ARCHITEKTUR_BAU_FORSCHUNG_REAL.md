# TeamFlow Local (Bau-Forschung) — Architektur Real-Daten-Integration

**Status**: Architektur-Entwurf v1.14, teilweise implementiert
**Zielgruppe**: Forschungsförderung (Verwaltung von Förderanträgen). Der Repo-Name `tf-local-bau-forschung` ist Git-historisch und wird nicht umbenannt. Die Dateinamen `ARCHITEKTUR_BAU_FORSCHUNG_REAL.md` und `public/test-korpus/bauforschung-v2/` sind ebenfalls Artefakt-Bezeichnungen der Test-Daten und bleiben.
**Gilt für**: `WorkshopKI/tf-local-bau-forschung`
**Abgrenzung zu CLAUDE.md**: Dieses Dokument beschreibt die Ziel-Architektur nach Integration echter Förderantrags-Daten. CLAUDE.md beschreibt den aktuellen Code-Stand. Bei Konflikten: Dieses Dokument ist die Richtung, CLAUDE.md ist der Ist-Stand.

**Änderungen in v1.14**: Konsolidierung Forschung → Förderanträge. Das separate `forschung`-Plugin (Vorgang-basiert mit `type: 'forschung'` + `ForschungsantragMeta`) wurde aufgelöst, weil es konzeptuell dasselbe beschrieb wie `antraege` (CSV-Import-basiert mit `Antrag`-Interface): Förderanträge mit Metadaten plus verknüpfte Dokumente. Die 16 synthetischen Forschungs-Einträge (FA-2026-001 bis FA-2026-016) wurden in ein erweitertes `Antrag`-Schema migriert und um 4 zusätzliche Fixture-Einträge (FA-2026-017 bis FA-2026-020) mit abweichenden Förderprogrammen (DFG Heisenberg, ZIM-Kooperation, BMBF KMU-innovativ, EU EIC Accelerator) ergänzt. Neue Felder am `Antrag`: `foerdergeber`, `branche`, `dokumente?: AntragDokumentRef[]`. Die 4 Volltext-Seed-Markdown-Dokumente (FA-001/-010/-013/-016) bleiben im Dokumente-Bundle und werden aus den migrierten Anträgen via `dokumente`-Array referenziert; übrige Anträge haben fiktionale Metadaten-Refs für Filter-Abdeckung. Feature-Flag `features.forschung` und `menuLabels.forschung` sind entfernt; `scripts/config-schema.mjs` gibt für Alt-Configs eine Legacy-Warning aus. Menü-Default-Label „Anträge" → „Förderanträge" (dev/demo/foerderprogramm/template-Configs synchron). `UserProfile.department`-Typ auf `'antraege' | 'bauantraege' | 'beide'` verengt, Legacy-Wert `'forschung'` wird in `useProfile.reloadProfile()` stumm auf `'antraege'` gemappt und persistiert. Abteilungs-Dropdown in Einstellungen + Onboarding rendert dynamisch aus aktiven Bereichs-Flags (bei nur 1 aktivem Bereich: Section unsichtbar). `Vorgang.type` auf `'bauantrag'` reduziert. Workflow-Engine enthält nur noch `BAU_TRANSITIONS`; `FORSCHUNG_TRANSITIONS` entfernt. AI-Prompts `forschung_*` in `foerderung_*` umbenannt. Orama-Index-Typ beim Seed wechselt von `'forschung'` zu `'antrag'`. Historischer Hinweis: Das `forschung`-Plugin existierte von v1.0 bis v1.13 und wurde mit v1.14 aufgelöst — die Fixtures wurden originalgetreu in den Antraege-Seed übernommen, nicht neu erfunden.

**Änderungen in v1.12**: Zielgruppen-Klärung und Menü-Flag-System. Ursprünglich als „Bauforschung"-Produkt geplant, ist die tatsächliche Zielgruppe die Forschungsförderungs-Abteilung mit Förderanträgen. Neue Feature-Flags `features.antraege`, `features.bauantraege`, `features.forschung`, `features.dokumente` steuern die Sichtbarkeit der Bereichs-Menüs pro Variante. Neues Top-Level-Objekt `menuLabels` erlaubt pro Variante überschreibbare Sidebar-Labels (z.B. „Förderanträge" statt „Anträge"). Config-Schema-Validation fordert mindestens eines der drei Hauptbereiche aktiv. Sidebar-Labels + Command-Palette nutzen `menuLabel(key, fallback)` aus `feature-flags.ts`. Plugin-Filter in `src/plugins.config.ts` entfernt deaktivierte Bereiche aus der Plugin-Liste; Router fängt unbekannte Pfade per Catch-All-Route auf `/` ab. Alte `configs/bauforschung.config.json` entfernt, ersetzt durch `configs/foerderprogramm.config.json` mit SMB-Pfad `\\server\teamflow-forschungsfoerderung\`, Label „TeamFlow Forschungsförderung", `menuLabels.antraege: "Förderanträge"` und allen Showcase-Menüs deaktiviert. Build-Script `npm run build:foerderprogramm` ersetzt `npm run build:bauforschung`. Produktbegriff „Bauforschung" aus Welcome-Screen-Default-Hint, CLAUDE.md, DEV_SETUP.md, config-ui, _template-Kommentaren entfernt. Test-Korpus-Ordner `public/test-korpus/bauforschung-v2/` bleibt als Artefakt-Bezeichnung (enthält FKZ-Referenzen aus Bau+Forschung). Neue Sektion 18.

**Änderungen in v1.11**: Dev-Ergonomie-Schicht. Neues Feature-Flag `features.devFixtures` + optionale `dev`-Sektion in der Build-Config (`dev.defaultKuratorName`, `dev.defaultKuratorPassword`, `dev.dataSharePath`, `dev.sessionTtlDays`, `dev.autoRefreshSmbPermission`). In `demo`/`production` strukturell blockiert (Schema-Validation bricht Build ab). Neues Modul `src/dev-fixtures/` mit programmatischen Szenarien (`frisch`, `kurator-bereit`, `mit-testdaten`, `voll-populiert`, `encoding-tests`, `unterprogramm-vielfalt`), programmatischem CSV-Import ohne Wizard-Klicks (hart-kodierte Fixture-Schemas), Kurator-Session-Auto-Activate mit 30-Tage-TTL und Auto-SMB-Permission-Refresh beim ersten Click. Tree-Shake über Vite-Literal-Define `__TEAMFLOW_DEV_FIXTURES__`: Fixture-Code (inkl. aller Panels) ist in Prod-Bundles vollständig entfernt (grep-verifiziert). Neue UI-Komponenten: Dev-Quick-Bar als schmale gelbe Top-Bar im ShellLayout mit Szenario-Dropdown, State-Inspector-Link, Offline-Toggle; FixturesPanel als 5. Sektion im Dev-Infra-Test-Panel; dediziertes `dev-state-inspector`-Plugin mit IDB-Counts, Sample-Ansichten, SMB-/Session-Status, Feature-Flag-Tabelle, Build-Info. Doku: `docs/DEV_SETUP.md`. Neue Sektion 17.

**Änderungen in v1.10**: Build-Time-Config-System. JSON-Configs pro Variante (`configs/dev.config.json`, `configs/demo.config.json`, `configs/bauforschung.config.json` + `_template.config.jsonc`) werden vom Build-Orchestrator (`scripts/build-with-config.mjs`) geladen, via `validateConfig()` geprüft (inkl. Sicherheits-Check: OpenRouter + fester Daten-Share + `variant=production` bricht den Build ab), und per Vite-`define` als Compile-Time-Konstanten (`__TEAMFLOW_CONFIG__`, `__TEAMFLOW_BUILD_TIME__`, `__TEAMFLOW_GIT_HASH__`) in den Bundle inlined. App-Seite greift via `src/config/runtime-config.ts` + `src/config/feature-flags.ts` auf die Config zu — Sidebar-Label, Tab-Titel, Kurator-Plugins, Feedback-FAB, Dev-Infra-Plugin, OpenRouter-Transport, Welcome-Screen-Pfad (fest vs. User-Auswahl) sind alle flag-gesteuert. Neuer `BuildInfo`-Footer in Sidebar zeigt Variant/Git-Hash/Build-Datum. Komfort-HTML-Config-UI unter `tools/config-ui/` (Start via `npm run config-ui`, lokaler Node-Server auf Port 5174, File-System-Access-API-Speichern). Neue Build-Scripts `build:variant`, `build:dev`, `build:demo`, `build:bauforschung`; altes `build:single` ersatzlos entfernt (`.bat`-Kopie jetzt im Orchestrator). Neue Sektion 16.

**Änderungen in v1.9**: Strukturkonsolidierung und Rollen-Umbenennung. (a) Zwei SMB-Shares: App-Share mit `teamflow.html` + Daten-Share (Kurator-benannter Root-Ordner) mit `programm/`, `backups/`, `_intern/`, `README.txt`. Dokumentenquelle als getrennter Handle. (b) Rolle „Admin" → „Kurator" in Code, UI, Audit-Log und Rollen-Flag (`UserProfile.is_kurator`, `TeamFlowPlugin.kuratorOnly`, `FeedbackItem.kurator_*`). (c) Plugin-IDs `*-admin` → `*-kuration`, Routen `/admin/*` → `/kuration/*` mit Legacy-Redirect für Bookmarks. Sidebar-Kategorie „KURATION". (d) Infrastructure-Dateien wandern aus `programm-test/admin/` in `_intern/` am Daten-Share-Root; Vorgang-Artefakte aus `vorgaenge/` in `programm/antraege/{bauantraege,forschung}/`; CSV-Importe in `programm/antraege/imports/`; Schemas in `programm/schemas/`; Feedback in `_intern/feedback/`. (e) Welcome-Seite mit Pfad-Hinweis + validateSelectedFolder-Dialog (empty / legacy / subfolder / current) + idempotente Migration-Funktion `migrateLegacyStructure` die Legacy-Daten verschiebt und `programm-test/dokumente/` nach expliziter Count-Anzeige löscht. (f) AD-Permission-Modell präzisiert: alle User haben read+write auf den Daten-Share; Schutz erfolgt clientseitig (User-App hat keine Write-Pfade).

**Änderungen in v1.8**: Hierarchische Label-XLS mit Gruppierung — Parser erkennt variable Anzahl Header-Zeilen (2–8, Default 4). Konvention: letzte Zeile = CSV-Spaltennamen, vorletzte = individuelles Label (Fallback CSV-Name bei leerer Zelle), Zeilen darüber = Gruppen-Ebenen als merged cells. Vertikal-merged Gruppen-/Label-Zellen werden als ambig erkannt und bekommen im Wizard ein Admin-Dropdown (`Als Gruppe` / `Als Label wiederholt` / `Ignorieren`) + Bulk-Leiste. `column_mapping`-Einträge speichern `label`, `group_path`, `ambiguous_merge_resolution`; `CsvSchema` trägt `label_xlsx_header_rows`. Wizard-Schritt 2 rendert Mapping-Tabelle gruppiert (Collapsible). Antrags-Detail-Ansicht zeigt Felder in Gruppen-Sections. Filter-Registry trägt `display_group` aus dem Schema vor (UI-Nutzung folgt).

**Änderungen in v1.7**: Patch SMB-Permission-Recovery-UX — Warn-Banner bekommt inline Action-Buttons (`Zugriff erneuern` / `Anderen Ordner wählen` bei `permission_denied`, `Erneut verbinden` bei `offline`). `requestPermission()` wird synchron aus dem Click-Handler aufgerufen (User-Geste-Compliance). Home-Seite zeigt bei fehlendem Handle einen prominenten Call-to-Action zum initialen Ordner-Setup. Neue Audit-Events `smb_permission_refresh` und `smb_handle_replace`.

**Änderungen in v1.6**: Patch 1b-REPAIR — (a) CSV-Import erkennt und persistiert Encoding (UTF-8/Windows-1252) + Separator (`;`/`,`/Tab/Pipe), Wizard-Schritt 1 zeigt Format-Panel mit Dropdowns + Live-Preview; `CsvSchema` erweitert um `encoding`/`separator`, Re-Imports nutzen persistierte Werte. (b) DE-Format-Test-CSVs (`*-de.csv`, Windows-1252 + Semikolon) als Beispieldaten im Wizard. (c) URL-Routing via HashRouter (`react-router-dom` v6) — alle Plugin-Views haben Deep-Links, Detail-Pfade wie `#/antraege/:aktenzeichen` und `#/bauantraege/:id`. Layout-Kompatibilitäts-Layer (`ShellLayout` + `NavigationBridge`) hält den bestehenden `NavigationContext` stabil. Neue Sektion 13 "Routing-Architektur".

**Änderungen in v1.5**: Unterprogramm-Filter beim Master-Import (Patch 1b-5). `unterprogrammen`-Schema erweitert um `aktiv`, `code`, `name?`, Zeitraum-Felder, `antrag_count_cached`, Timestamps. Wizard-Schritt 3 "Unterprogramm-Auswahl" mit Pflicht-Mapping `unterprogramm_id` für Master-CSVs. Import-Pipeline filtert Zeilen nach `aktiv`-Flag; Deaktivierung triggert Löschung beim nächsten Re-Import (nicht sofort). Neue Sektion 4.6 "Unterprogramm-Verwaltung" mit Admin-Panel `/admin/unterprogramme`.

**Änderungen in v1.1**: Index-Deployment auf SMB mit IndexedDB-Cache; Admin/User-Rollen mit geteiltem Passwort; OCR aktiviert (Tesseract.js); Backup-Strategie; Sicherheitsmodell explizit dokumentiert.

---

## 1. Ziel und Abgrenzung

### Zweck

Übergang vom **RAG-zentrierten Test-Korpus** (90 synthetische Dokumente, Eval-Suite) zu einem **CSV-First-Katalog mit selektiver Volltext-Tiefe** für echte Förderantrags-Daten.

Hauptnutzen:
- **Fleißarbeit abnehmen** bei der Recherche in historischen Anträgen
- **Ähnliche Anträge / Konstellationen finden** für Gutachten-Bezugnahmen, Textwiederverwendung in Nachforderungen, Präzedenzfälle
- **Strukturierte Übersicht** über den gesamten Antragsbestand mit Filter-Facetten
- **Volltext-Recherche nur dort, wo sie Mehrwert bringt** — nicht blind über alle Dateien

### Was sich ändert gegenüber v1

| v1 (Test-Korpus) | v2 (Real-Daten) |
|---|---|
| 90 synthetische Dokumente | 39K+ Anträge × ~25 Dateien/Antrag → ~1M Dateien |
| Alle Dokumente werden indexiert | Nur ~5 Whitelist-Dokumenttypen pro Antrag werden indexiert |
| Keine strukturierten Metadaten | 2–5 CSV-Quellen pro Programm mit 20–30 relevanten Spalten |
| Volltext-Suche ist der Kern | CSV-Facet-Filter ist der Kern, Volltext ist Zusatz |
| Nemotron-Summary für jedes Doc | Nemotron-Summary optional, nachrüstbar, nur für aktuelle Programme |
| Keine Trennung Test/Produktion | Harte Trennung synthetisch vs. real, zwei Indizes |

### Explizit NICHT im Scope

- Änderungs-Historie aller Dokumente (Dokumente werden als immutable betrachtet)
- Volltextindizierung von MSG-Dateien, Excel-Sheets, Bildern
- OCR als aktive Pipeline (wird extern erwartet, nur Fallback-Skizze im Dokument)
- Authentifizierung / Berechtigungen (Zugriff erfolgt via SMB-Share-Berechtigung auf OS-Ebene)

---

## 2. Trennung Synthetisch / Real

### Motivation

Zwei Zielgruppen mit strikter Trennung:
- **Real-Modus**: Produktivnutzung durch Sachbearbeiter mit SMB-Berechtigung auf vertrauliche Antragsdaten
- **Synthetisch-Modus**: Demo/Test für User ohne Programm-Berechtigung, Eval-Suite, Entwicklung

### Strukturelle Durchsetzung

Nicht UI-Toggle, sondern getrennte Datenpfade ab Ordnerebene. Ab v1.9 **zwei getrennte SMB-Shares**: einer für die App-HTML (keine Daten), einer für die Kurator-benannten Daten-Shares. Dokumentenquelle als drittes optionales Handle nur beim Kurator-Scan.

```
SMB-Share 1 — App:
  \\server\teamflow-app\
    teamflow.html                      (einzige Datei, vom Kurator bereitgestellt)

SMB-Share 2 — Datenspeicher (Root-Name vom Kurator gewählt):
  \\server\[kurator-root]\
    programm/
      antraege/
        imports/                       (rohe CSV-Importe; was früher csv-sources)
        bauantraege/                   (Vorgang-Artefakte Abteilung Bauanträge)
        (forschung/ entfällt ab v1.14 — Förderanträge liegen im IDB-Store ANTRAEGE, nicht als Vorgang-Artefakte)
      schemas/                         (Column-Mapping-JSONs)
      index/                           (Orama-Snapshots + index-meta.json)
    backups/                           (Rolling 4 Generationen: YYYY-MM-DD/)
    _intern/                           (System-Dateien — nicht manuell anfassen)
      kurator-config.enc               (AES-256-GCM, Passwort-gated)
      audit-log.jsonl                  (Append-only Kurator-Aktionen)
      build-lock.json                  (Heartbeat, verhindert Parallel-Builds)
      kurator-name-*.txt               (rechnerspezifische Kurator-Kennung)
      scan-manifest.json               (Persistentes Datei-Manifest, Phase 2)
      feedback/
        feedback.json                  (Shared Multi-User-Tickets)
        system-prompt.md               (Kurator-editierbarer Chatbot-Prompt)
    README.txt                         (Orientierungs-Text, Kontakt-Info vom Kurator)

Separater Dokumentenquelle-Handle (Phase 2, nur Kurator-Scan):
  \\legacy-system\dokumente\           (Original-Scans, kryptische Ordner-Namen)
```

**Migration von v1.8-Legacy:** Der alte `programm-test/`-Ordner mit Subordnern `csv-sources/`, `csv-schemas/`, `dokumente/`, `index/`, `admin/` wird beim Welcome-Seite-Start automatisch erkannt (`validateSelectedFolder` → `kind: 'legacy'`) und nach expliziter Kurator-Bestätigung via `migrateLegacyStructure()` verschoben. `programm-test/dokumente/` wird mit Count-Anzeige **gelöscht** — Produktiv-Dokumente kommen in Phase 2 über den separaten Dokumentenquelle-Handle.

**Alte synthetische/real-Trennung entfällt** in v1.9. Stattdessen: Kurator benennt den Root-Ordner selbst und verwaltet Real- vs. Test-Daten über separate Daten-Shares (ein Daten-Share pro App-Instanz).

### Modus-Auswahl

Bei App-Start: Erkennung des aktiven Ordners über eine Konfigurationsdatei `teamflow-config.json` neben der `teamflow.html`. Feld `mode: "real" | "synthetic"`. Keine Mischung zur Laufzeit möglich.

### OpenRouter-Absicherung

Strukturell, nicht per Toggle: OpenRouter-Transport ist im Code nur hinter `if (config.mode === "synthetic")` erreichbar. Im Real-Build wird der Import konditional. Keine UI-Option „Cloud-LLM verwenden" im Real-Modus.

---

## 3. Datenmodell

### Entity-Hierarchie

```
Programm (z.B. "Forschungsprogramm X")
  │
  ├── Unterprogramm (per FM_Nummer-Code, optional mit Klartext-Label)
  │     │  z.B. code="4711", name="Klimaforschung 2016–2019"
  │     │
  │     └── Antrag (Primärschlüssel: aktenzeichen)
  │           │  Felder: akronym, titel, antragsteller, status, verbund_id?, …
  │           │          + alle gemergten Felder aus den N CSV-Sources
  │           │
  │           ├── Dokument (Primärschlüssel: hash)
  │           │     │  Felder: dateipfad, dateiname, doktyp, erste-seite-text,
  │           │     │          zugeordnet_via ("aktenzeichen" | "akronym" | "manuell"),
  │           │     │          volltext?, summary?, embedding-chunks?
  │           │     │
  │           │     └── Chunk (im Orama-Index)
  │           │
  │           └── Verbund-Referenz (optional)
  │
  └── Verbund (Primärschlüssel: verbund_id)
        │  Felder: verbund_id, akronym, titel, teilantrags_ids[]
        │
        └── Verbund-Dokument (Projektbeschreibung geteilt über alle Teilanträge)
              │  Content-Hash-dedupliziert, einmal gespeichert
              │  Referenzen auf alle teilantrags_ids
```

### Wichtige Modell-Entscheidungen

**Antrag ist Aggregation, nicht CSV-Zeile.** Ein Antrag entsteht durch Merge über alle registrierten CSV-Sources eines Programms. Die Master-CSV definiert die Existenz eines Antrags; andere CSVs augmentieren.

**Verbund ist eigenständiges Entity.** Nicht nur Filter-Feld am Antrag. Weil:
- Dokumente (Projektbeschreibung) können am Verbund hängen statt am Teilantrag
- UI gruppiert Suchtreffer im Verbund zusammen
- Verwendungsnachweise bleiben pro Teilantrag (nicht dedupliziert)

**Dokument-Primärschlüssel ist Content-Hash.** SHA-256 über extrahierten Plaintext. Gleicher Hash → ein Dokument, mehrfache Antrags-Referenzen. Das löst das „gleiche Projektbeschreibung bei 10 Teilanträgen"-Problem automatisch.

**Dokument-Status ist abgestuft.** Nicht binär „indexiert/nicht", sondern:
- `entdeckt` — Datei im Scan gefunden, Metadaten erfasst
- `klassifiziert` — Dokumenttyp erkannt, ist Whitelist-Typ
- `zugeordnet` — Antrag/Verbund gefunden
- `volltext-extrahiert` — Plaintext vorhanden, chunk-ready
- `embedded` — Chunks im Orama-Index mit Embedding
- `summarized` — Nemotron-Summary vorhanden (optional)

Jede Stufe kann inkrementell nachgezogen werden.

### IndexedDB-Schema (grob)

```
db: teamflow-bauforschung-{mode}
stores:
  programme          { id, name, ... }
  unterprogramme     { id, programm_id, code, name?, zeitraum_von?, zeitraum_bis?,
                       aktiv, antrag_count_cached?, created_at, updated_at }
  csv_schemas        { id, programm_id, csv_source_name, column_mapping, join_key, priority }
  csv_row_hashes     { key: aktenzeichen+csv_source, hash }     → für Diff
  antraege           { aktenzeichen, programm_id, unterprogramm_id?, ...merged_fields }
  antrag_historie    { id, aktenzeichen, feld, alt, neu, geaendert_am, csv_source }
  verbuende          { verbund_id, akronym, titel, teilantrags_ids[] }
  dokumente          { hash, dateipfade[], antrags_referenzen[], verbund_ref?, status, ...metadata }
  scan_manifest      { dateipfad, mtime, size, last_scan, klassifikation }
  orama_index        (persistiert als Blob, siehe Volltext-Indexing)
  filter_definitionen { id, name, feld, typ, scope: "programm"|"user", custom: boolean }
```

**`column_mapping`-Einträge** (v1.8-Erweiterung):

Jeder Eintrag in `CsvSchema.column_mapping[col]` trägt neben den bestehenden Feldern (`canonical`, `custom`, `type`, `required`, `trackHistory`, `ignore`):
- `label?: string` — lesbares Label aus der vorletzten Header-Zeile des Label-XLS (Fallback: CSV-Spaltenname).
- `group_path?: string[]` — Gruppen-Ebenen von oben nach unten (z.B. `["Administration", "Stammdaten"]`). Leere Zellen im XLS werden herausgefiltert.
- `ambiguous_merge_resolution?: 'group' | 'label_repeated' | 'ignore'` — vom Admin gesetzt bei vertikal-merged Gruppen-/Label-Zellen; wird für konsistente Re-Imports persistiert.

`CsvSchema` bekommt zusätzlich `label_xlsx_header_rows?: number` (2–8) für die beim Upload gewählte Header-Zeilen-Anzahl.

### 3.1 Gruppen-Hierarchie aus Label-XLS

**Herkunft**: Behörden-XLS-Exporte haben eine deterministische Header-Struktur mit N Zeilen (N zwischen 2 und 8):
- Zeile N: kryptische CSV-Spaltennamen (Join zur CSV).
- Zeile N-1: individuelles Label pro Spalte; kann leer sein → Fallback auf CSV-Name.
- Zeilen 1..N-2: Gruppen-Ebenen von Hoch-Gruppe bis feinster Sub-Gruppe, umgesetzt als horizontal-merged cells.
- Sonderfall: Eine merged cell kann sich vertikal über Gruppen- UND Label-Zeile erstrecken (z.B. eine „Branche"-Gruppe ohne individuelle Spalten-Labels). Der Parser sammelt solche Fälle, der Admin entscheidet pro Fall und die Entscheidung wird im Schema hinterlegt.

**Nutzung**:
- **Wizard-Schritt 2 (Column-Mapping)**: Die Spalten werden gruppiert in Collapsibles dargestellt (Pfad mit `›`-Separator, Reihenfolge = Auftreten im XLS, „Ohne Gruppierung" am Ende).
- **Antrags-Detail-Ansicht** (`/antraege/:aktenzeichen`): Felder werden in Abschnitte mit Gruppen-Header strukturiert. Merge-Konflikt zwischen Sources wird nach dominanter Quelle aufgelöst: Master-Source → höchste `priority` → erste Source mit `group_path`. Felder ohne Pfad landen unter „Weitere Felder" am Ende.
- **Filter-Registry**: `FilterDefinition.display_group` wird beim Erstellen eines Filters aus dem Schema vorgetragen (nur Datenvorbereitung; UI-Gruppierung im Filter-Panel kommt in einem Folge-Patch).

**Unterprogramm-Felder** (Patch 1b-5):
- `id` / `code`: FM_Nummer als String (z.B. "4711"), Primärschlüssel. `code` ist technisch redundant zu `id` — dient der Klarheit im Code (UI/Export zeigt `code`, IDB-Lookup nutzt `id`).
- `name?`: optionales Klartext-Label, vom Admin im Admin-Panel nachgepflegt (z.B. "Klimaforschung 2016–2019"). Fällt zurück auf `code` in Facet-Filtern, wenn leer.
- `zeitraum_von?` / `zeitraum_bis?`: optionale Jahr-Strings für die UI-Anzeige. Keine Filter-Logik auf diesen Feldern.
- `aktiv`: Import-Filter-Flag. `false` → beim nächsten Master-Import werden Zeilen dieses Unterprogramms übersprungen und zuvor importierte Anträge gelöscht.
- `antrag_count_cached?`: letzter bekannter Zählerstand aus der `antraege`-Tabelle, aktualisiert am Ende jedes Master-Imports. Nur UI-Anzeige, nicht autoritativ für Filter-Logik.
- `created_at` / `updated_at`: ISO-8601 Timestamps.

---

## 4. CSV-Import-Pipeline

### 4.1 Schema-Registry

Jede CSV-Source wird einmalig durch einen Admin-Wizard registriert und erhält eine persistente Definition.

**CSV-Source-Typen (initial 4 geplant + 1 Zukunft):**

1. **Stammdaten** (Master) — definiert Existenz der Anträge
2. **Projektzusammenfassung** — Gutachter-Text, Deskriptoren, verfügbar nach Prüfung
3. **Status aktive Anträge** — Teilmenge der Master mit Workflow-Feldern, häufig updated
4. **Verbund-/Partnerdaten** — joinet auf verbund_id
5. **Verwendungsnachweis-Extrakte** (zukünftig) — extern generiertes Skript, ersetzt OCR

**Schema-Definition pro Source (JSON):**

```json
{
  "id": "stammdaten-v1",
  "programm_id": "forschung-A",
  "csv_source_name": "Stammdaten",
  "is_master": true,
  "join_key": "aktenzeichen",
  "column_mapping": {
    "AKZ_LFD": { "canonical": "aktenzeichen", "type": "string", "required": true },
    "PROJ_KURZ": { "canonical": "akronym", "type": "string", "required": true },
    "VB_NR": { "canonical": "verbund_id", "type": "string", "required": false },
    "BEW_DAT": { "canonical": "bewilligung_datum", "type": "date" },
    "STATUS_FLG": { "canonical": "status", "type": "string", "trackHistory": true },
    "INTERN_TS_1": { "ignore": true },
    "EXPORT_TS": { "ignore": true }
  },
  "priority": 100
}
```

### 4.2 Admin-Wizard für Column-Mapping

Fünf-Schritt-Flow (erstmalige Registrierung einer CSV-Source):

**Schritt 1 — Metadata**: Dateiupload, Display-Name, Schema-ID, `join_key`-Auswahl (`aktenzeichen` / `verbund_id` / `akronym`), Master-Flag, Priority.

**Schritt 2 — Column-Mapping**: Preview (erste 3 Zeilen) plus Mapping-Tabelle. Pro Spalte entscheidet der Admin: `Kanonisch zuordnen` / `Custom behalten` / `Ignorieren`.

Optional Label-XLS-Upload (v1.8: hierarchisch) — Admin wählt zunächst die Anzahl Header-Zeilen im XLS (2–8, Default 4). Parser erkennt:
- Lesbare Labels pro Spalte (Fuzzy-Match gegen kanonische Feld-Labels, „Alle akzeptieren"-Bulk-Button).
- Gruppen-Hierarchie über merged cells (Sektion 3.1).
- Vertikal-merged Gruppen-/Label-Zellen als „ambige" Merges. Pro Merge kann der Admin `Als Gruppe` (Default), `Als Label wiederholt` oder `Ignorieren` wählen; Bulk-Leiste bei ≥2 ambigen Merges. Die Resolution wird pro Spalte im Schema persistiert für konsistente Re-Imports.

Die Mapping-Tabelle wird bei vorhandenem Label-XLS in Collapsibles pro Gruppen-Pfad dargestellt (Default: alle aufgeklappt; Reihenfolge = Auftreten im XLS; „Ohne Gruppierung" am Ende). Bei fehlendem XLS oder rein flachem 2-Zeilen-Format bleibt die bisherige flache Tabelle.

Pflichtfeld-Check:
- Join-Key-Spalte muss kanonisch gemappt sein
- Master-CSV: `aktenzeichen` + **`unterprogramm_id`** sind Pflicht (letzteres neu in Patch 1b-5 — Auto-Erkennung für `FM_NUMMER`, `Foerdermassnahme`, `Unterprogramm`)

**Schritt 3 — Unterprogramm-Auswahl** (nur Master-CSVs, sonst übersprungen; Patch 1b-5):
- Papa-Parse-Distinct-Scan auf der `unterprogramm_id`-Spalte liefert Code → Count
- Bei Re-Import: Abgleich mit IDB-`unterprogrammen` → bestehende zeigen Klartext-Label und den vorherigen `aktiv`-Zustand
- UI: Checkbox-Liste mit Code, Label, Zeitraum, Zeilen-Count, Status-Badge `bereits registriert` / `neu`. Bulk-Buttons `Alle auswählen` / `Keine auswählen` / `Nur neue auswählen`
- Erst-Import (kein Master-Vorgänger): alle default aktiv. Re-Import: neue Unterprogramme default inaktiv — der Admin soll bewusst entscheiden, bestehende behalten ihren letzten `aktiv`-Zustand
- Labels und Zeiträume werden **nur** im Admin-Panel `/admin/unterprogramme` gepflegt, nicht im Wizard (einfachere UI)

**Schritt 4 — Review**: Mapping-Zusammenfassung vor Speichern.

**Schritt 5 — Progress**: Import-Fortschritt + Summary-Modal mit Bucket-Counts (new/changed/unchanged/removed), leere Join-Values, und bei Master-CSV zusätzlich `N Zeilen in deaktivierten Unterprogrammen übersprungen`.

**Re-Import-Diff-Dialog**: Wenn die Admin-Auswahl in Schritt 3 vom vorherigen IDB-Stand abweicht, erscheint vor Schritt 5 ein modaler Dialog mit getrennten HINZUGEFÜGT- und ENTFERNT-Listen plus Zeilenzahlen. Explizite Bestätigung per Button (kein Enter-Shortcut).

Bei Folge-Imports: Schema wird geladen und angewandt. Wenn neue Spalte auftaucht (nicht im Mapping): Notification an Admin „Neue Spalte XYZ in Stammdaten.csv, bitte zuordnen", Spalte wird bis zur Zuordnung ignoriert.

**Speicherung**: Schema als `csv-schema-{id}.json` im Programm-Ordner (SMB) via Atomic Write. Unterprogramme pro Master-Änderung als Einträge im IDB-Store.

### 4.3 Row-Hash-Diff

Bei jedem täglichen Import:

```
für jede CSV-Source:
  1. SHA-1 über gesamte Datei berechnen → wenn identisch zu letztem Import: skip komplett
  2. Streaming-Parse (Papa Parse):
     für jede Zeile:
       a. joinKey-Wert extrahieren (aktenzeichen | verbund_id | akronym)
       b. Skip-Regel: leerer Join-Value → überspringen (max 10 Warnungen gesammelt)
       c. NEU (Patch 1b-5, nur Master): Unterprogramm-Filter
          upVal = row[unterprogramm_column]
          wenn upVal nicht in aktiven Unterprogramm-Codes:
            skippedInactiveUnterprogramm++
            überspringen
       d. murmurhash3 über alle nicht-ignorierten Spalten berechnen
       e. mit gespeichertem Hash für (joinKey, csv_source) vergleichen
       f. Bucket: new / changed / unchanged
  3. Für alle im Diff nicht gesehenen Keys → removed-Bucket
     (→ beinhaltet automatisch Zeilen, die wegen Unterprogramm-Filter weggefallen sind,
      weil sie nicht mehr in der "seen"-Menge landen)
  4. Antrags-Merge nur für new + changed Keys neu berechnen
  5. removedJoinValues: Aufruf von removeAntragAndCleanup() pro Key —
     räumt antraege, antrag_historie, teilantrags_ids in Verbünden,
     akronym_index-Einträge auf (Chunk-Transaktionen à 500)
  6. Hash-Map aktualisieren
  7. recomputeAntragCounts() aktualisiert antrag_count_cached pro Unterprogramm
```

**Unterprogramm-Filter-Stufe**: Nur aktiv wenn `schema.is_master === true` und eine Spalte kanonisch auf `unterprogramm_id` gemappt ist. Die Menge der aktiven Codes kommt aus `listUnterprogrammeByProgramm().filter(u => u.aktiv)` — vor dem Scan einmal geladen, als `Set<string>` für O(1)-Lookup.

**Lösch-Pfad bei Deaktivierung** (über den `removed`-Bucket umgesetzt):
- Admin deaktiviert Unterprogramm 4713 im Admin-Panel → `aktiv: false` gesetzt, keine sofortige Löschung
- Beim nächsten Master-Re-Import werden Zeilen mit `FM_Nummer=4713` durch den Filter übersprungen → landen nicht in `seen` → alle bisher dazugehörigen `join_values` tauchen im `removed`-Bucket auf → `removeAntragAndCleanup` cleanup-t Anträge, Historie, Verbund-Referenzen, Akronym-Index
- Das vermeidet Inkonsistenzen zwischen Flag-Änderung und Bestand: erst ein kontrollierter Import führt die Löschung durch

**Verbund-Konsistenz bei Deaktivierung**: Wenn ein Verbund Teilanträge in mehreren Unterprogrammen hat und eines deaktiviert wird, werden via `removeAntragAndCleanup` die betroffenen `aktenzeichen` aus `teilantrags_ids` entfernt. Bleibt der Verbund leer, wird er gelöscht; verbleibende Teilanträge bleiben unangetastet.

**Audit-Log-Eintrag** pro Import enthält zusätzlich zu den Buckets:
- `activeUnterprogramme: string[] | null` — sortierte Liste der aktiven Codes (null für Nicht-Master)
- `skippedInactiveUnterprogramm: number`

**Performance-Erwartung**: 39K Zeilen × 25 Spalten bei ~200ms für reines Hashing + ~3–5s Parsing = <10s total bei 95% unchanged. Unterprogramm-Filter fügt nur einen Set-Lookup pro Zeile hinzu — vernachlässigbar.

**Zeilen-Reihenfolge irrelevant**: Hash-Vergleich erfolgt über joinKey-Key, nicht Positionsindex.

### 4.4 Multi-CSV-Merge

Nach Diff pro Source: Rekompution des Antrag-Objekts.

```
antrag = {}
für jede CSV-Source in Priority-Reihenfolge (aufsteigend):
  zeile = source.lookup(joinKey_für_antrag)
  wenn zeile:
    für jedes kanonische Feld in zeile:
      wenn feld in antrag und feld.trackHistory:
        wenn antrag[feld] != zeile[feld]:
          append antrag_historie
      antrag[feld] = zeile[feld]  // höhere Priority überschreibt
```

**Verbund-Propagation**: Bei `join_key = verbund_id` → Werte werden an alle Teilanträge des Verbundes geschrieben. Bei `join_key = akronym` → Akronym-Index gibt Teilantragsliste aus.

**Join-Key-Schutz**: Das Feld, das als `join_key` einer CSV-Source konfiguriert ist, wird beim Merge nicht durch diese Source geschrieben — es dient nur dem Lookup. Die Quelle eines Join-Key-Feldes im fertigen Antrag ist daher immer die erste Source, die diesen Antrag erzeugt hat (üblicherweise der Master). Ausnahme: Beim Initial-Insert eines neuen Antrags durch eine Master-CSV wird das Join-Key-Feld implizit mit dem Join-Value befüllt und als Quelle der Master-Source attribuiert.

### 4.5 Feld-Historie

Opt-in pro Feld via `trackHistory: true` in Schema-Definition. Typische Kandidaten: `status`, `bearbeitung_stand`, `frist_datum`.

Speicherung in separater `antrag_historie`-Tabelle. UI: am Feld ein „↻ N Änderungen"-Indikator, Click öffnet Modal mit Zeitleiste.

Keine Historie für Master-Felder (aktenzeichen, akronym) — die ändern sich nicht.

### 4.6 Unterprogramm-Verwaltung

Eingeführt mit Patch 1b-5. Motivation: reale Master-CSVs enthalten Anträge aus mehreren Fördermaßnahmen mit unterschiedlichen Zeiträumen, unterschieden durch eine Code-Spalte (typisch `FM_Nummer`). Abgelaufene Maßnahmen sollen aus der Antragsliste ausgeblendet bleiben, nur relevante Unterprogramme werden indexiert.

#### Admin-Panel `/admin/unterprogramme`

Einfache Tabellen-Verwaltung, nur im Admin-Modus (Plugin `unterprogramme-admin`, `adminOnly: true`, Icon `Layers`). Zeigt alle `unterprogrammen`-Einträge des aktiven Programms:

| Spalte | Editierbar | Verhalten |
|---|---|---|
| Code | nein | Primärschlüssel aus CSV, unveränderlich |
| Label | Inline (Klick → Input, Enter/Blur commit) | `name`-Feld |
| Zeitraum von / bis | Inline | `zeitraum_von` / `zeitraum_bis` |
| Aktiv | Checkbox mit Bestätigungs-Dialog | `aktiv`-Flag |
| Anträge | readonly | `antrag_count_cached`, Anzeige per `toLocaleString('de-DE')` |

**Bestätigungs-Dialog bei Aktiv-Toggle** (`AktivConfirmDialog`):
- Deaktivierung: „N Anträge werden beim nächsten Re-Import der Master-CSV gelöscht — inklusive Feld-Historie und Verbund-Referenzen. Die Änderung wird erst mit dem nächsten Import wirksam."
- Aktivierung: „Beim nächsten Re-Import werden Anträge dieses Unterprogramms neu importiert. Solange nicht neu importiert wird, bleibt der Bestand unverändert."

#### Aktiv-Flag-Semantik: Flag ≠ sofortige Löschung

Wichtige Design-Entscheidung: Eine Aktiv-Flag-Änderung im Admin-Panel **löscht nichts sofort**. Der Ablauf ist:

1. Admin setzt `aktiv: false` → IDB-Update, Audit-Log-Eintrag `unterprogramm_deactivated`
2. Bestand bleibt unangetastet — Anträge, Historie, Verbünde unverändert
3. Admin triggert Re-Import der Master-CSV (Wizard → Step 1 mit Schema-Pick, oder CSV-Sources-Liste → Re-Import-Button)
4. Wizard-Step 3 lädt den aktualisierten `aktiv`-Zustand → Diff-Dialog zeigt "ENTFERNT" für das deaktivierte Unterprogramm
5. Nach Bestätigung: Import-Pipeline filtert Zeilen heraus → Anträge landen im `removed`-Bucket → `removeAntragAndCleanup` löscht tatsächlich

**Begründung**: Vermeidet Inkonsistenzen zwischen Admin-Flag und tatsächlichem Bestand. Auch bei versehentlichem Toggle ist kein Daten-Verlust möglich, solange nicht importiert wird. Der Import ist der einzige Zeitpunkt, zu dem Lösch-Aktionen laufen.

**Reaktivierung behält Label**: Der `unterprogrammen`-Eintrag wird bei Deaktivierung nie gelöscht, nur `aktiv: false` gesetzt und `antrag_count_cached` auf 0 zurückgefallen. Nach Reaktivierung + Re-Import sind die Anträge zurück, und das vorher gepflegte Klartext-Label bleibt erhalten.

#### Label-Map-Integration in Facet-Filter

Der System-Filter `unterprogramm_id` (aus Phase 1c Filter-Registry) nutzt die Unterprogramm-Labels für die Anzeige:

- Mit Label: „Klimaforschung 2016–2019 (4711)"
- Ohne Label: Fallback auf den nackten Code, z.B. „4712"

Die Label-Map wird beim `useFilterState.init` einmalig geladen (`listUnterprogrammeByProgramm` → `Map<code, name>`) und an `SingleSelectFacet` / `MultiSelectFacet` durchgereicht.

#### Wizard-Integration

Im Wizard-Step 3 wird auf das Admin-Panel als Pflege-Einstieg hingewiesen („Labels und Zeiträume können unter Admin → Unterprogramme nachgepflegt werden"). Kein Inline-Edit im Wizard — bewusst einfach gehalten.

#### Audit-Log-Events

Alle Änderungen protokolliert:
- `unterprogramm_activated` / `unterprogramm_deactivated` (mit `code`, `name?`, `previous_count`)
- `unterprogramm_edited` (mit `code` + Patch-Delta)
- `csv_import` enthält `activeUnterprogramme[]` und `skippedInactiveUnterprogramm`

---

## 5. Dokumenten-Scan-Pipeline

### 5.1 Ziel-Architektur

**Zwei Scan-Modi:**

- **Initial-Scan**: einmalig, nachts, ggf. mehrere Nächte, ca. 42h hochgerechnet für 1M Dateien
- **Inkrementell-Scan**: täglich, nur neu angelegte Unter-Ordner seit letztem Scan, Sekunden bis Minuten

### 5.2 Scan-Manifest

Persistent in IndexedDB: `scan_manifest` Tabelle.

Pro Datei: `{dateipfad, mtime, size, last_scan, klassifikation, antrags_ref?}`

Beim Scan:
- Datei bereits im Manifest + mtime unverändert → komplett überspringen
- Datei unbekannt oder mtime neuer → verarbeiten

Neue Ordner werden erkannt durch Directory-Listing-Diff gegen Manifest.

### 5.3 Billig-Klassifikation (Stufe 1)

Ziel: Pro Datei <200ms, keine LLM-Inferenz, Entscheidung „Whitelist ja/nein + Typ".

**DOCX-Pfad:**
```
1. ZIP öffnen (JSZip), nur word/document.xml laden
2. Erste ~5KB extrahieren (Text ohne XML-Tags)
3. Regex-Match gegen Whitelist-Muster (siehe 5.4)
4. Bei Treffer: Klassifikation setzen + AntragsID/Akronym extrahieren
```

**PDF-Pfad:**
```
1. pdf.js mit disableAutoFetch: true
2. getPage(1).getTextContent() → erste Seite Text
3. Wenn Textlayer leer: markieren als "kein-textlayer", skip für Initial-Scan
4. Regex-Match gegen Whitelist-Muster
5. Bei Treffer: Klassifikation setzen + AntragsID/Akronym extrahieren
```

**MSG und andere**: skip, nur im Manifest registrieren mit `klassifikation: "ignored"`.

### 5.4 Whitelist-Regex-Katalog

Reihenfolge (billigste / spezifischste zuerst):

| Dokumenttyp | Format | Seite-1-Marker (Regex) | Join-Feld |
|---|---|---|---|
| Gutachten | DOCX | `/Gutachten zum Vorhaben/i` | AntragsID |
| Verwendungsnachweis | PDF | `/Verwendungsnachweis.{0,20}Teil 2.{0,20}Sachbericht/i` | AntragsID (oft OCR-Fall) |
| Projektbeschreibung | PDF | `/Anlage 4/i` + `/Projektbeschreibung/i` (in ersten 1–4 Seiten) | Akronym |
| Nachforderung | DOCX | AntragsID-Regex + kein anderer Marker | AntragsID |

**Nicht in Whitelist (aber relevant):**
- Zwischenbericht — explizit als „erstmal weggelassen" markiert
- Alles andere → Status `nicht-whitelist`, CSV-Metadaten bleiben findbar

### 5.5 Zuordnungs-Kaskade

```
für jedes Whitelist-Dokument:
  wenn typ == "Projektbeschreibung":
    akronym = regex_extract_akronym(seite_1_text)
    antrags_refs = akronym_index.lookup(akronym)
    // kann 1 (Einzelantrag) oder N (Verbund) zurückgeben
  sonst:
    antragsId = regex_extract_antragsId(seite_1_text)
    antrags_ref = antragsId_index.lookup(antragsId)

  wenn zuordnung erfolgreich:
    zugeordnet_via = "aktenzeichen" | "akronym"
  sonst:
    dokument.status = "unzugeordnet"
    → landet in Admin-Zuordnungs-Bucket
```

**Content-Hash-Dedup vor Zuordnung**: Bevor ein Dokument abgespeichert wird, Content-Hash gegen existierende Dokumente prüfen. Bei Match: nur Antrags-Referenz hinzufügen, kein neues Dokument anlegen.

### 5.6 Sampling-Kalibrierung

**Vor dem Initial-Scan verpflichtend**: `scan-sample.ts` zieht ~200 Dokumente zufällig aus dem Zielverzeichnis, läuft Klassifikation + Zuordnung, erstellt Report:

```
200 Dokumente gescannt:
  - 142 Whitelist-Treffer, davon 138 zugeordnet (97%), 4 unzugeordnet
  - 48 nicht-Whitelist (korrekt ignoriert)
  - 10 Fehler beim Parsen

Treffer nach Typ:
  Gutachten: 18 / 18 zugeordnet (100%)
  Verwendungsnachweis: 42 / 40 zugeordnet (95%) — 2 fehlende Textlayer
  Projektbeschreibung: 52 / 52 zugeordnet (100%)
  Nachforderung: 30 / 28 zugeordnet (93%)
```

Akzeptanz-Kriterium vor Initial-Scan: **mindestens 90% Zuordnungsquote auf Sample.**
Wenn unter 90% → Regex-Kalibrierung bevor 42h-Scan gestartet wird.

### 5.7 OCR für Verwendungsnachweise

OCR wird **aktiv unterstützt** für Verwendungsnachweise ohne PDF-Textlayer. Tesseract.js v5 mit deutschem Sprachmodell, browser-basiert, kein externes Setup.

**Pipeline-Integration — zweistufig:**

**Stufe 1 (automatischer Dokumenten-Scan):** Verwendungsnachweise ohne Textlayer werden erkannt und mit Status `warte-auf-ocr` markiert. KEIN automatischer OCR-Lauf während des Scans — wäre pro Dokument ~5–8 Minuten und würde den Scan unnötig ausbremsen. CSV-Metadaten des Antrags sind bereits findbar, nur der Sachbericht-Volltext fehlt.

**Stufe 2 (separate Admin-Aktion): OCR-Queue-Panel**

Admin-UI listet alle Dokumente mit Status `warte-auf-ocr`:
- Filter: nach Programm, Zeitraum, Seitenanzahl, Antrags-Status
- Sortierung: nach Priorität (aktuelle Bearbeitung zuerst)
- Mehrfachauswahl + Button „OCR starten für N ausgewählte"
- Progress-Modal mit Abbruch-Option + Restlaufzeit-Schätzung
- Resume-Fähigkeit: Pro Dokument wird nach Abschluss sofort persistiert (IndexedDB + SMB). Abbruch oder Crash verliert nur das aktuell laufende Dokument.

**Realistische Leistung:**
- Ø 45s pro Seite auf CPU (deutsche Schrift, Tesseract.js v5)
- Ø 10 Seiten pro Verwendungsnachweis → ~7–8 min/Dokument
- Laptop über Nacht (10h): ~75–85 Dokumente

**Nach OCR-Abschluss eines Dokuments:**
- `volltext`-Feld gefüllt mit OCR-Output
- Status springt von `warte-auf-ocr` → `volltext-extrahiert`
- Fließt in die normale Chunking + Embedding-Pipeline ein
- Index-Rebuild **inkrementell** (nur neue Chunks), nicht komplett

**Zukünftige Ablösung (nicht jetzt):** Wenn das geplante externe OCR-Skript auf potenter Hardware realisiert wird und `verwendungsnachweis-extrakte-{datum}.csv` im Projektverzeichnis ablegt, wird dessen CSV als 5. CSV-Source registriert. Das Tesseract-Panel bleibt als Fallback bestehen, OCR-Queue wird dann idR leer sein weil Extrakte bereits per CSV reinkommen.

**Wichtig für die Architektur-Dauerhaftigkeit:** Egal ob Tesseract.js oder externes Skript OCR macht — das Dokument-Feld `volltext` wird einheitlich befüllt. Downstream (Chunking, Embedding, Suche) unterscheidet nicht, woher der Volltext kommt.

---

## 6. Volltext-Indexing

### 6.1 Scope

Nur Whitelist-Dokumente mit Status `volltext-extrahiert`. Grob:
- ~5 relevante Dokumente / Antrag × 39K Anträge = ~195K Dokumente → ca. 1–2M Chunks insgesamt pro Programm

### 6.2 Chunking

Heading-basiert (bleibt wie v1, hartgecodet). Für Nicht-Hierarchie-Dokumente (Formulare): Fallback auf Absatz-basiert.

Contextual Prefix pro Chunk wird erweitert um CSV-Metadaten:
```
[Projektbeschreibung | Akronym SMART-CITY | Verbund VB-2023-042 | Programm Forschung-A]
Der Abschnitt beschreibt…
```

Das verbessert sowohl BM25- als auch Embedding-Relevanz erheblich, weil das Akronym und Programm in jedem Chunk mit-embeddet wird.

### 6.3 Embedding

EmbeddingGemma 300M q8 bleibt Default (siehe v1-Entscheidung, Main-Thread, file://-kompatibel).

Bei 1–2M Chunks pro Programm: Embedding-Zeit dominierend.
- Ø 0.15s / Chunk auf CPU-Main-Thread → ~40–80h pro Programm
- Einmalig beim Initial-Build, danach nur für neue Chunks
- Optional später: Migration auf NVIDIA L40 wenn verfügbar, dann via externem Skript + Embedding-Ingestion-CSV

**Inkrementelle Neueinbettung**: nur für Dokumente mit Status `volltext-extrahiert && !embedded`.

### 6.4 Nemotron-Summary — optional

**Strategie für Phase 1 des Vollindex**: Nemotron-Pipeline **ausgeschaltet**. Reine strukturierte Felder + Volltext-Chunks + Embeddings.

**Evaluation nach Vollindex**: Suchqualität + Ähnlichkeitssuche testen. Wenn ausreichend → Nemotron bleibt aus.

**Wenn Nemotron wieder aktiviert wird**, dann gezielt:
- nur für aktuelles Programm + das davor (nichts vor 2020)
- oder nur für Verwendungsnachweise (wenn OCR-Extrakt-CSV da ist)
- oder nur für Projektbeschreibungen

**Nachrüst-Mechanik**: Nemotron läuft separat (z.B. auf NVIDIA L40 extern), Ergebnisse landen als `dokumente-summaries-{programm}.json` im Projektverzeichnis. Import aktualisiert `summary`-Feld an existierenden Dokumenten. Kein Reindex nötig.

### 6.5 Orama-Index

**Entscheidung: ein Index pro Programm, nicht global.**

Begründung:
- Bei 1–2M Chunks / Programm wird ein globaler Index über alle Programme zu groß für Single-File Ladezeiten
- Programmübergreifende Suche ist seltenerer Use Case, kann über Multi-Index-Merge in UI gelöst werden
- Rebuild eines Programms isoliert andere
- Persistierung: `index-{programm}-{mode}.orama` im Programm-Ordner

**Schema muss beim Load korrekt sein** (v1-Bug-Lektion): Vector-Dimension = 768, BM25-Felder = [text, title, akronym, antragsId].

---

## 7. Verbund-Modell und Dedup

### Content-Hash-Dedup

Bei jedem Dokument-Scan:
1. Plaintext extrahieren
2. SHA-256 über Plaintext
3. Hash-Lookup in `dokumente`-Tabelle
4. Bei Treffer: `antrags_referenzen` um neuen Antrag erweitern, KEIN zweites Dokument anlegen
5. Bei Miss: neues Dokument mit Hash als Primärschlüssel

### Verbund-Aggregation in UI

Suchergebnisse mit Treffern in Dokumenten die an einem Verbund hängen werden gruppiert:

```
[Verbund: SMART-CITY-NETWORK (VB-2023-042, 8 Teilanträge)]
  → Projektbeschreibung.pdf (gemeinsam)
    Score 0.87 — Abschnitt "Urbane Infrastruktur…"
  → 8 Verwendungsnachweise (je Teilantrag)
    - BA-2023-042-01 "Teilvorhaben München" — Score 0.71
    - BA-2023-042-02 "Teilvorhaben Hamburg" — Score 0.65
    …
```

Collapse/Expand in UI. Default: Verbund gezeigt, Teilanträge zugeklappt.

---

## 8. Such-UI und Filter-Registry

### 8.1 Such-Architektur

**Zwei Such-Modi parallel:**

1. **Facet-Filter-Suche (Primär)**: Dropdowns + Checkboxen für Programm, Unterprogramm, Verbund, Status, Zeitraum, Deskriptoren-Ja/Nein-Flags, Dokumenttyp, etc.
   - Lookup auf strukturierten CSV-Feldern
   - Millisekunden-Latenz
   - Deckt ~80% der typischen Use Cases

2. **Volltext-Suche (Sekundär)**: Orama-Query über Chunks
   - Optional in Kombination mit Facets (Pre-Filter reduziert Suchraum)
   - Verbund-Aggregation der Treffer

### 8.2 Filter-Registry

**Drei Filter-Scopes:**

1. **System-Filter**: Hard-coded, immer präsent (Programm, Unterprogramm, Verbund, Dokumenttyp, Zeitraum)
2. **Admin-Custom-Filter**: Admin kann per UI auf jedem kanonischen oder custom CSV-Feld einen Filter definieren
   - Typ: Single-Select / Multi-Select / Range / Boolean
   - Scope: pro Programm sichtbar für alle User
   - Speicherung in `filter_definitionen` mit `scope: "programm"`
3. **User-Preset-Filter**: User speichert eigene Filter-Kombination als Preset
   - Scope: nur eigener User
   - Speicherung in `filter_definitionen` mit `scope: "user"`

### 8.3 Facet-Counts und Leer-Ausblendung

Jeder Filter zeigt Facet-Counts (wie viele Anträge erfüllen diesen Wert).

Für Boolean-Deskriptoren die oft leer/Nein sind:
- Default-UI zeigt nur Checkbox wenn >= 1 Ja-Treffer
- Ansonsten wird der Filter eingeklappt / ausgeblendet

Das hält die UI schlank ohne Information zu verlieren.

---

## 9. Volumen-Schätzungen

### Pro Programm (Beispiel: Programm A mit 39K Anträgen historisch)

| Pipeline-Stufe | Volumen | Dauer (Schätzung) | Inkrementell |
|---|---|---|---|
| CSV-Import (4 Sources, 95% unchanged) | 4× 39K Zeilen | ~30s / Nacht | ja |
| Datei-Scan initial | ~1M Dateien | ~42h einmalig | nach: nur neue Ordner |
| Klassifikation + Zuordnung | ~200K Whitelist-Treffer | in Scan enthalten | ja |
| Volltext-Extraktion (DOCX+PDF) | ~200K Dokumente | ~10–20h | ja |
| Chunking | ~1–2M Chunks | ~2–5h | ja |
| Embedding (EmbeddingGemma) | ~1–2M Chunks | ~40–80h | ja |
| Nemotron-Summary (optional, deferred) | bis zu 200K | ~12–30 Tage CPU / 1–3 Tage L40 | ja |

**Praktischer Plan**: Initial-Build über 2–3 Wochen nebenher laufen lassen, parallel UI entwickeln. Synthetisch-Korpus zum Testen während Real-Build läuft.

### Aktuelles Jahr inkrementell

- 1500 neue Anträge / Jahr
- Ø 5 Whitelist-Dokumente / Antrag = 7500 neue Dokumente / Jahr
- Tägliche Pipeline-Last: ~20 Dokumente — verschwindend gering

---

## 10. Sicherheitsmodell und Rollen

### 10.1 Bedrohungsmodell — was wird geschützt, was nicht

**Kontext**: Intranet-Team von ~10–30 Usern, davon 3 Admins, vertrauliche Antragsdaten, kein adversarialer Angreifer innerhalb des Teams.

**Geschützt:**
- Versehentliches Starten langlaufender Admin-Aktionen (42h-Build, OCR-Batch) durch normale User
- Versehentliches Überschreiben von Indexen / CSV-Schemas
- Race Conditions bei parallelem Admin-Zugriff (zwei Admins bauen gleichzeitig)
- Verlust durch versehentliches Löschen (via Backup-Strategie, Sektion 12)

**NICHT geschützt:**
- Motivierter Insider mit Browser-DevTools-Kenntnissen. Die App ist clientseitig, Code ist lesbar, UI-Toggles manipulierbar.
- Böswillige Modifikation von Indexen durch jemanden mit SMB-Schreibzugriff
- Datenexfiltration (wer Lesezugriff auf die Dokumente hat, kann sie auch kopieren)

**Explizite Dokumentation für das Team**: Das Sicherheitsniveau verlässt sich primär auf das Team-Vertrauen. Die App-Mechanismen verhindern Versehensaktionen, keine Böswilligkeit. Wer Admin-Rechte hat, hat faktisch volle Kontrolle über den TeamFlow-Zustand.

### 10.2 AD-Permissions-Modell (ab v1.9)

**„Alle read+write, App-seitig kontrolliert"**. Eine AD-Gruppe pro Daten-Share (z.B. `TeamFlow-Forschung`). Alle Mitglieder haben NTFS read+write auf den gesamten Daten-Share. Keine feingranulare Subfolder-Permissions, keine Trennung zwischen Kurator und normalem User auf OS-Ebene.

Der Schutz findet **clientseitig** statt:

- Die App hat für normale User **keine Write-Pfade**: keine Buttons, keine UI, keine Code-Pfade die schreiben. Alle Schreiboperationen (CSV-Import, Index-Build, Backup-Trigger, Schema-Änderung, Filter-Edit) sind hinter dem Kurator-Passwort (`kurator-config.enc`) gated.
- Wer den Code via DevTools manipuliert, könnte theoretisch schreiben — in Intranet-Team-Kontext kein realistisches Bedrohungsszenario.
- Versehens-Schutz im Explorer: User sieht den Daten-Share nicht im Datei-Explorer (keine Verknüpfung, kein Mount), sondern nur die App per Desktop-Icon (Verknüpfung auf `teamflow.html` am App-Share). Wenn die App geschlossen ist, ist der Daten-Share nicht mehr sichtbar.
- Backups sind das Recovery-Netz für die seltenen Fälle.

Dieses Modell vermeidet AD-Pflege bei Personalwechseln und hält den bisherigen „hat Zugriff / hat kein Zugriff"-Granularitätslevel bei.

Pflegeaufwand: Person wird bei Eintritt in Gruppe aufgenommen, bei Austritt entfernt. Ein einzelner AD-Vorgang.

### 10.2a Rollen-Glossar (ab v1.9)

- **Kurator**: Person mit fachlicher Inhaltspflege-Verantwortung für einen TeamFlow-Datenspeicher. Verwaltet Schemas, startet Importe, triggert Backups, setzt Filter. Keine IT-Administration — der Begriff wurde bewusst gewählt, um die Rolle als **inhaltliche** Pflege zu kennzeichnen, nicht als technische Wartung.
- **User**: Sachbearbeiter mit Lesezugriff auf Anträge. Nutzt die App über Desktop-Verknüpfung, sieht nur fachliche Bereiche (Home, Anträge, Suche, Chat, Feedback-Board, Einstellungen).
- **Dev**: Entwickler mit Zugriff auf das Dev-Panel (`/dev-infrastructure-test`). Nicht identisch mit Kurator — das Dev-Panel ist immer sichtbar, enthält aber Debug-Tools die für normale User irrelevant sind.

### 10.3 Kurator-Rolle via App-Passwort

> **v1.9-Hinweis**: Die Rolle hieß vor v1.9 „Admin". Die Mechanik ist unverändert, nur Naming + Pfade. Aktueller Pfad: `_intern/kurator-config.enc` am Daten-Share-Root (vor v1.9: `programm-test/admin/admin-config.enc`). Session-Meta-IDB-Key: `kurator-session-meta`. Audit-Actions: `kurator_login`, `kurator_logout`, `kurator_setup`, `kurator_password_changed`. Legacy-Read-Fallback liest alte Pfade/Feldnamen bis die Migration gelaufen ist.

**Mechanik:**

Im `_intern/`-Ordner am Daten-Share-Root: `kurator-config.enc`, AES-256-GCM verschlüsselt mit PBKDF2-abgeleitetem Key (200.000 Iterationen, 16-Byte Salt).

```
App-Start: User-Modus. admin-config.enc wird nicht entschlüsselt.

Admin-Modus aktivieren:
  1. User klickt "Admin-Modus" im UI
  2. Passwort-Prompt
  3. PBKDF2(passwort, salt, 200000) → key
  4. Versuch admin-config.enc zu entschlüsseln
  5. Bei Erfolg: Admin-UI-Bereiche für diese Session sichtbar
  6. Bei Fehler: generische Fehlermeldung "Passwort falsch"

Session-TTL: 12 Stunden Inaktivität → zurück in User-Modus
```

**Ein geteiltes Passwort** für alle 3 Admins. Namens-Identifikation für Audit-Log + Build-Lock läuft über OS-Username (abfragbar per `navigator.userAgentData` oder Prompt beim ersten Setup).

**Passwort-Rotation** (z.B. beim Ausscheiden eines Admins): Admin-Wizard-Flow „Passwort ändern" — entschlüsselt `admin-config.enc` mit altem Passwort, reverschlüsselt mit neuem, schreibt zurück. 30 Sekunden Aufwand.

**Initial-Setup**: Einmaliger Setup-Wizard des ersten Admins: Passwort festlegen, `admin-config.enc` erstellen, in Admin-Ordner ablegen. Andere Admins bekommen das Passwort auf dem üblichen Team-Weg (Passwort-Manager, persönlich, etc.).

### 10.4 Admin-Aktions-Katalog

Admin-Modus wird benötigt für:
- Neue CSV-Source registrieren (Schema-Registry)
- Column-Mapping bearbeiten
- Filter-Definitionen mit Scope „Programm" erstellen/ändern
- Datei-Scan starten
- Klassifikation / Zuordnungs-Pipeline starten
- Embedding-Pipeline starten
- OCR-Queue abarbeiten
- Index auf SMB schreiben (manuelle Trigger + automatisch am Pipeline-Ende)
- Unzugeordnete Dokumente manuell zuordnen
- Backup manuell triggern

Im User-Modus verfügbar:
- Suche, Katalog-Browsing, Detail-Ansicht
- User-Filter-Presets (Scope „User")
- Feedback-Panel

### 10.5 Audit-Log

Append-only Datei `admin/audit-log.jsonl` pro Programm. Jede Admin-Aktion schreibt eine Zeile:

```jsonl
{"ts":"2026-04-19T21:30:00Z","user":"thomas@behoerde","action":"index_rebuild","programm":"Forschung-A","dauer_min":2580}
{"ts":"2026-04-20T08:15:00Z","user":"maria@behoerde","action":"csv_schema_edit","source":"stammdaten-v1","diff":{"column_mapping":["+STATUS_NEU","−STATUS_ALT"]}}
{"ts":"2026-04-20T14:20:00Z","user":"thomas@behoerde","action":"ocr_batch_run","programm":"Forschung-A","dokumente":42,"dauer_min":310}
```

Nicht manipulationssicher (jeder mit Schreibzugriff kann editieren), aber explizites Überschreiben wäre prozessual auffällig und damit abschreckend.

Beim Start des Admin-Modus: die letzten 10 Einträge werden im UI angezeigt → Sichtbarkeit schafft informelle Kontrolle.

### 10.6 Build-Lock

Datei `admin/build-lock.json` verhindert parallele Builds:

```json
{
  "programm_id": "forschung-A",
  "stufe": "embedding",
  "hostname": "LAPTOP-ADMIN-2",
  "admin_name": "thomas@behoerde",
  "gestartet": "2026-04-19T21:30:00Z",
  "heartbeat": "2026-04-19T23:15:00Z",
  "geschaetzt_fertig": "2026-04-20T14:00:00Z"
}
```

**Vor Build-Start:**
1. Lock lesen
2. Wenn kein Lock oder Heartbeat älter als 2h (vermutlich abgestürzt): Lock überschreiben, weitermachen
3. Wenn aktiver Lock: Dialog „Admin Thomas baut seit 1h 45min, geschätzt fertig 14:00 morgen. Trotzdem übernehmen?" → explizite Bestätigung nötig

**Während Build**: Heartbeat alle 5 Minuten. Am Build-Ende: Lock löschen.

---

## 11. Index-Deployment und Sync

### 11.0 Initial-Setup (ab v1.9)

Beim ersten App-Start (kein Daten-Share-Handle in IndexedDB) zeigt die App eine **Welcome-Seite** statt der regulären UI:

- Großes Heading „Willkommen bei TeamFlow"
- Beispiel-SMB-Pfad (`\\server\teamflow-bauforschung\` oder via `#path=…`-Hash-Parameter überschreibbar) in Read-only-Code-Block plus Button „📋 Pfad kopieren"
- 4-Schritte-Anleitung (Pfad kopieren → Ordner auswählen → Adresszeile → Bestätigen)
- Button „Ordner auswählen" ruft `showDirectoryPicker()`
- Nach Auswahl: `validateSelectedFolder(handle)` klassifiziert den Ordner in
  - **current** (`programm/` + `_intern/` vorhanden) → direkt weiter, nur README.txt sicherstellen
  - **empty** → Setup-Dialog „Einrichten" legt `programm/{antraege,schemas,index}`, `backups/`, `_intern/feedback/`, `README.txt` an
  - **legacy** (`programm-test/` oder `feedback/` vorhanden) → Migration-Dialog mit Datei-Count + **Warnblock** für `programm-test/dokumente/` (wird gelöscht) + Bestätigung → `migrateLegacyStructure()` verschiebt Dateien und entfernt leere Ordner
  - **subfolder** → Warn-Dialog mit Hinweis auf Parent-Ordner

Handle-Slots in IndexedDB (`smb-handles`):
- `daten-share`: das Haupthandle, das auf den Daten-Share-Root zeigt
- `dokumentenquelle` (optional, nur Kurator): separater Handle für das Scan-Ziel in Phase 2
- Legacy-Slot `test-programm` wird beim Lesen als Fallback berücksichtigt

### 11.1 Grundarchitektur: Kurator baut, User lesen

Bei 42h Initial-Build plus ~40–80h Embedding pro Programm ist ein lokaler Rebuild pro User unrealistisch. Deshalb:

- **Kurator baut** den Index einmal auf seinem Rechner, persistiert auf SMB
- **User laden** den Index vom SMB beim ersten Start, cachen in IndexedDB, führen Queries lokal aus
- Tägliche Neu-Synchronisation per Meta-Fingerprint-Check

### 11.2 Build-Flow (Admin-Rechner)

```
1. Admin öffnet App, aktiviert Admin-Modus
2. App fordert File System Access API Handle auf SMB-Programm-Ordner
3. CSV-Import + Dokumenten-Scan + Klassifikation (lokal in IndexedDB)
4. Volltext-Extraktion + Chunking + Embedding (lokal, kann Tage dauern, resumeable)
5. Orama-Index persistieren → Blob (~1–2 GB)
6. Inline-Backup: index-chunks.orama → index-chunks.orama.backup (via File System Access API)
7. Neuen Index schreiben nach index-chunks.orama.tmp
8. Atomic rename: .tmp → index-chunks.orama
9. Neue index-meta.json schreiben mit Timestamp + SHA-256
10. Audit-Log-Eintrag
11. Build-Lock freigeben
```

**Resumability**: Der Build-Prozess persistiert pro Dokument inkrementell in IndexedDB. Bei Abbruch (Laptop-Crash, Admin bricht ab) kann beim nächsten Build-Start per Status-Modell (`entdeckt / klassifiziert / zugeordnet / volltext-extrahiert / embedded`) genau an der Abbruchstelle weitergemacht werden.

### 11.3 Sync-Flow (User-Rechner)

```
App-Start im User-Modus:
  1. SMB erreichbar? Wenn nein: Offline-Modus (siehe 11.5)
  2. index-meta.json vom SMB holen (wenige KB)
  3. Vergleich mit lokalem Cache-Fingerprint in IndexedDB:
     a. Wenn gleich: Cache direkt laden, Start sofort
     b. Wenn anders oder kein Cache: index-chunks.orama komplett vom SMB laden
        (~30–60s übers LAN bei 1–2 GB)
        In IndexedDB cachen, neuen Fingerprint speichern
  4. Orama-Index deserialisieren, Queries laufen lokal
```

**Warum kompletter Re-Download statt Diff**: Inkrementelle Orama-Updates sind nicht trivial — Vector-Indexe müssen rebalanciert werden, BM25-Statistiken neu berechnet. Ein Full-Reload ist robuster und bei LAN-Geschwindigkeit pragmatisch. Kann später optimiert werden, wenn es weh tut.

**Cache-Größe in IndexedDB**: ~1–2 GB pro Programm. Browser-Quotas sind großzügig (oft 50%+ des freien Speichers), im Produktivkontext kein Problem. Bei mehreren aktiven Programmen: Cache kann pro Programm invalidiert werden.

### 11.4 Mehrere Programme

Pro Programm ein eigener Index:
```
programm-A/index/index-chunks.orama
programm-B/index/index-chunks.orama
...
```

Client lädt nur den Index des **aktiven Programms** in den Cache. Programmwechsel im UI = neuer Sync-Check + ggf. Nachladen.

Programmübergreifende Suche (falls später gewünscht): Multi-Index-Merge zur Query-Zeit. Mehrere Indexe parallel in IndexedDB, Query läuft gegen alle, Ergebnisse gemergt + re-ranked.

### 11.5 Offline-Fallback

Wenn beim App-Start SMB nicht erreichbar ist (z.B. Home-Office ohne VPN):

- App startet mit letztem IndexedDB-Cache-Stand
- Banner oben: „Offline-Modus — letzter Sync: vor N Stunden/Tagen. Einige Daten könnten veraltet sein."
- Alle Lese-Funktionen (Suche, Katalog, Filter, Detail) funktionieren
- Admin-Aktionen (Build, OCR-Run, Schema-Edit, Index-Write) sind deaktiviert mit Tooltip „Kein SMB-Zugriff"
- Periodischer Retry im Hintergrund (alle 5 min), bei Erfolg: Sync-Check + Banner entfernen

**Recovery-Actions im Banner**: Der Offline/Permission-Banner bietet einen direkten Button „Zugriff erneuern" bzw. „Erneut verbinden" um ohne Umweg über das Dev-Panel die Verbindung zu reaktivieren. Plus „Anderen Ordner wählen" als Fallback wenn der persistierte Handle nicht mehr gültig ist. Die Aktion `requestPermission()` muss synchron aus dem Click-Handler heraus aufgerufen werden (User-Geste-Compliance der File System Access API). Bei frischen Installationen ohne Handle zeigt die Home-Seite einen prominenten Call-to-Action zum initialen Ordner-Setup statt der Dashboard-Kachel. Beide Aktionen werden als Audit-Events geloggt (`smb_permission_refresh` mit Ergebnis; `smb_handle_replace` mit altem/neuem Ordnernamen).

### 11.6 Atomic Writes und Inline-Backup

Jeder Admin-Write auf eine Live-Datei auf SMB folgt dem Muster:

```
1. Aktuelle Datei (X) nach X.backup kopieren (überschreibt alte .backup)
2. Neue Version nach X.tmp schreiben
3. Rename X.tmp → X (atomic auf demselben FS)
```

Betroffene Dateien: `index-chunks.orama`, `index-meta.json`, `scan-manifest.json`, CSV-Schemas, `admin-config.enc`.

**Recovery bei kaputtem Build**: Admin benennt im Explorer manuell `X.backup` → `X`. Kein Code-Feature nötig, bewusst manuell gehalten für Seltenheit des Falls.

---

## 12. Backup-Strategie

### 12.1 Zwei Ebenen

**Ebene 1 — Inline (1 Generation, automatisch):** Jeder Admin-Write erzeugt `.backup`-Datei. Deckt „Build kaputt, vorige Version zurückholen" ab. Bereits in 11.6 beschrieben.

**Ebene 2 — Wöchentlich (4 Generationen, automatisch):** Snapshot aller relevanten Dateien im separaten `backups/`-Pfad. Deckt „versehentliches Löschen des Programm-Ordners" und „Stand von vor zwei Wochen wiederherstellen" ab.

### 12.2 Struktur des Backup-Ordners

```
\\smb\teamflow-bauforschung\backups\programm-A\
  ├── 2026-04-19/
  │   ├── index/
  │   │   ├── index-chunks.orama
  │   │   └── index-meta.json
  │   ├── csv-sources/
  │   │   └── [alle CSVs des Snapshot-Tages]
  │   ├── csv-schemas/
  │   └── admin/
  │       ├── audit-log.jsonl
  │       ├── admin-config.enc
  │       └── scan-manifest.json
  ├── 2026-04-12/
  ├── 2026-04-05/
  └── 2026-03-29/
```

### 12.3 Mechanik

**Trigger:**
- Beim ersten Admin-Login einer Kalenderwoche: Prompt „Wöchentliches Backup jetzt starten?" (defaulted auf Ja)
- Zusätzlich: manueller Button im Admin-Panel „Backup jetzt erstellen"
- Optional zukünftig: automatisch getriggert wenn älter als 7 Tage und Admin-Modus aktiv

**Ablauf:**
1. Neuen Unterordner `backups/programm-A/YYYY-MM-DD/` anlegen
2. Relevante Dateien per File System Access API einzeln kopieren
3. Am Ende: ältesten Snapshot löschen wenn >4 vorhanden
4. Audit-Log-Eintrag
5. Dauer-Schätzung: 2–5 min bei 2 GB über LAN-SMB

**Kein ZIP**: Bewusst File-Copy statt Archiv. Gründe: direktes Browsing im Explorer, kein Memory-Overhead beim Packen eines 2-GB-Blobs im Browser, keine Kompressions-Vorteile bei Embedding-Dichten.

### 12.4 Retention-Rechnung

Pro Programm ~2 GB × 4 Wochen = 8 GB. Bei 5 Programmen: ~40 GB Backup-Storage auf demselben Share. Überschaubar. Perspektivisch kann `backups/` auf ein separates NAS verschoben werden, ohne App-Änderung (nur Pfad-Config).

### 12.5 Recovery-Prozess

**Manuell, bewusst kein automatisierter Rollback-Button** — Recovery soll bewusst und dokumentiert erfolgen:

1. Admin öffnet Explorer, navigiert zu `backups/programm-A/YYYY-MM-DD/`
2. Kopiert relevante Dateien über die Live-Versionen
3. Öffnet App, triggert Sync (Cache-Invalidation)
4. Audit-Log-Eintrag manuell mit Notiz warum Recovery nötig war

### 12.6 Was NICHT im Backup

- Die eigentlichen Dokument-Dateien (PDFs, DOCX, MSGs) — die sind der SMB-Master, Backup wäre redundant und vervierfacht den Storage
- IndexedDB-Caches der User — jederzeit aus dem SMB-Index neu generierbar
- Synthetisch-Korpus — ist im Repo versioniert, braucht kein Backup

---

## 13. Implementierungs-Phasen

Die Architektur wird über vier Claude-Code-Prompts umgesetzt. Jede Phase ist eigenständig lauffähig und evaluierbar. **Sicherheits-, Sync- und Backup-Mechanik wird in Phase 1 grundgelegt** und in allen Folgephasen genutzt.

### Phase 1: Daten-Fundament + Infrastruktur

- Synthetisch/Real-Modus-Erkennung via Config
- **SMB-Anbindung via File System Access API** — einmaliges Handle-Grant, persistiert in IndexedDB
- **Admin/User-Rollen + Passwort-Mechanik** (admin-config.enc, PBKDF2, 12h-Session)
- **Build-Lock mit Heartbeat** (nur Skelett, wird in späteren Phasen genutzt)
- **Audit-Log** (append-only jsonl)
- **Atomic Writes + Inline-Backup** als Utility-Layer
- **Wöchentliches Snapshot-Backup** mit Rolling 4 Generationen
- IndexedDB-Schema für Programm, Unterprogramm, Antrag, Verbund, CSV-Schema-Registry
- Admin-Wizard: CSV-Upload, Column-Mapping, Label-XLS-Auto-Match
- Multi-CSV-Merge mit Priority + Feld-Historie
- Row-Hash-Diff-Import
- Katalog-UI: Antragsliste, Detail-Ansicht, Facet-Filter (System-Filter only)
- Admin-Custom-Filter UI

**Evaluierbarkeit**: Lade 1–2 reale CSVs, prüfe Katalog-UI, filtere, bestätige Merge-Verhalten. Test Admin-Passwort-Flow, Session-TTL, Audit-Log. Ein Backup manuell erstellen + wöchentliche Rotation im Test-Szenario auslösen.

### Phase 2: Dokumenten-Scan + Klassifikation + Zuordnung

- Scan-Manifest + Initial-/Inkrementell-Modi
- Billig-Klassifikation (DOCX-ZIP-peek, PDF-first-page)
- Whitelist-Regex-Katalog
- FKZ/Akronym-Extraktion
- Zuordnungs-Kaskade + Content-Hash-Dedup + Verbund-Zuordnung
- Sampling-Kalibrierung-Skript
- Admin-UI: „Unzugeordnete Dokumente" + manuelle Zuordnung
- Build-Lock-Nutzung für langlaufende Scans
- **Kein Volltext-Indexing, kein OCR in Phase 2** — nur Metadaten-Verknüpfung

**Evaluierbarkeit**: Sample-Run auf 200 realen Dokumenten, Zuordnungsquote prüfen, Regex kalibrieren, dann Full-Scan mit Resume-Fähigkeit.

### Phase 3: Volltext-Pipeline + OCR + Index-Deployment

- Plaintext-Extraktion für zugeordnete Whitelist-Dokumente (mammoth.js, pdf.js)
- **OCR-Queue-Panel** (Tesseract.js v5 deutsch) für Verwendungsnachweise ohne Textlayer
- Heading-basiertes Chunking mit erweitertem Contextual Prefix
- EmbeddingGemma Main-Thread-Embedding (resumeable)
- Orama-Index-Persistierung auf SMB mit Meta-Fingerprint
- User-Sync-Flow: Meta-Check, IndexedDB-Cache, Offline-Fallback
- Such-UI: Volltext + Verbund-Aggregation

**Evaluierbarkeit**: Eval-Suite adaptieren auf synthetisch-Programm, 40 Testabfragen laufen lassen, Qualität messen. OCR-Pipeline auf 5–10 VWN testen. User-Sync auf zweitem Rechner validieren.

### Phase 4: Nemotron-Nachrüst-Pipeline (optional, deferred)

- Ingestion-Format für extern generierte Summary-CSVs
- UI-Integration der Summary-Felder in Detail-Ansicht + Chunk-Prefix
- Config für Nemotron-Zielgruppe (welche Programme, welche Dokumenttypen)

**Nicht jetzt starten.** Wird nach Phase 3 und basierend auf gemessener Suchqualität entschieden.

---

## 14. Offene Entscheidungen / Risiken

### Offen für spätere Klärung

- **Multi-Programm-Suche**: Wenn User oft über Programme hinweg sucht, braucht es Merge-Ranking-UI über N Orama-Indizes.
- **Export/Reporting**: Nicht im Scope dieser Architektur, aber absehbar gewünscht.
- **Externes OCR-Skript**: Integration als 5. CSV-Source-Typ wenn verfügbar, ersetzt dann Tesseract-Queue für die Masse.

### Risiken

- **Initial-Scan-Dauer**: 42h + Embedding ist lang. Wenn der Rechner in der Zeit unterbrochen wird, muss die Pipeline resumeable sein (Scan-Manifest + Document-Status erlauben das).
- **Regex-Qualität unter 90%**: Sampling-Kalibrierung ist Pflicht. Wenn Real-Dokumente mehr Variation haben als erwartet, braucht es Nemotron-Klassifikations-Fallback (Nano-Call, ein Token).
- **CSV-Schema-Drift**: Wenn die Stammdaten-CSV ihre Spaltennamen ändert (Behörden-Refactoring), bricht das Mapping. Admin-Notification + manuelle Neuzuordnung.
- **Projektzusammenfassung nur nach Prüfung**: Nicht alle Anträge haben sie. RAG-Ähnlichkeitssuche hat dann lückenhafte Abdeckung. Fallback: Embedding über Akronym + Titel für ungeprüfte Anträge.
- **OCR-Durchsatz begrenzt**: Bei ~75–85 VWN pro Nacht dauert der Vollbestand Monate. Mitigation: Priorisierung nach aktuell bearbeiteten Vorgängen, externes OCR-Skript als mittelfristige Ablösung.
- **SMB-Indisponibilität bei Build**: Wenn SMB während eines 40h-Embedding-Jobs wegbricht, kann das Ergebnis nicht geschrieben werden. Mitigation: Lokale IndexedDB-Persistenz bleibt, Write wird beim nächsten Admin-Start erneut versucht.
- **Passwort-Verlust**: Wenn alle 3 Admins das Admin-Passwort vergessen, ist der Admin-Modus nicht mehr zugänglich. `admin-config.enc` ist nicht rekonstruierbar. Mitigation: dokumentiertes Initial-Setup-Verfahren, dass ein neuer `admin-config.enc` mit neuem Passwort erstellt werden kann (überschreibt alten). Keine Datenverlust-Gefahr, nur kurze Setup-Wiederholung.
- **Zwei Admins arbeiten unkoordiniert trotz Lock**: Build-Lock ist kein technischer Zwang, nur Warn-Dialog. Prozessuale Abstimmung bleibt im Team nötig.

---

## 15. Referenzen auf bestehende Entscheidungen

- **EmbeddingGemma 300M q8, Main-Thread**: bleibt unverändert (CLAUDE.md, v1-Entscheidung)
- **Heading-basiertes Chunking hartgecodet**: bleibt
- **file:// Protokoll**: bleibt primärer Constraint
- **Orama Schema bei Load**: muss korrekt sein (v1-Bug)
- **Smart Trim 22K, contextTokens 8192, thinking off**: nur relevant wenn Nemotron reaktiviert wird
- **Streamlit Transport**: bleibt für Streamlit-Workflow erhalten, nicht in der realen Pipeline

---

## 13. Routing-Architektur

### Constraint: HashRouter ist Pflicht

Die App wird als Single-File via `file://` oder SMB-Share ausgeliefert. `createBrowserRouter` (HTML5 History API) scheidet aus, weil es einen HTTP-Server mit SPA-Fallback braucht — der existiert bei `file://` nicht. `createHashRouter` arbeitet mit dem URL-Hash-Fragment (`teamflow.html#/admin/unterprogramme`), das vom Browser nicht als Dateipfad interpretiert wird, sodass Deep-Links und Reloads in beiden Deployment-Szenarien funktionieren.

Alternativen wurden verworfen:
- Query-Parameter (`?view=antraege`): Deep-Linking und Browser-Back umständlich, keine URL-Param-Abbildung für Detail-Views.
- React Router v7 Data Routers in anderer Form: Bundle-Overhead ohne Vorteil.

### Routen-Katalog

Zentrale Routen-Map in `src/core/routes.ts`:

```
/                            → home
/antraege                    → antraege
/antraege/:aktenzeichen      → antraege (Detail)
/antraege/verbund/:verbundId → antraege (Verbund-Detail)
/bauantraege                 → bauantraege
/bauantraege/:id             → bauantraege (Detail)
/dokumente                   → dokumente
/suche                       → suche
/chat                        → chat
/feedback-board              → feedback-board
/einstellungen               → einstellungen
/admin/suchindex             → admin (Suchindex)
/admin/programme             → programme-admin
/admin/csv-sources           → csv-sources-admin
/admin/unterprogramme        → unterprogramme-admin
/admin/filter                → filter-admin
/admin/feedback              → feedback-admin
/dev-infrastructure-test     → dev-infrastructure-test
```

Jeder neue Plugin muss eine Route in `PLUGIN_ROUTES` erhalten. `routeToPluginId(pathname)` ermittelt die aktive Plugin-ID aus dem aktuellen Pfad (längste Route wins, damit `/admin/programme` vor `/admin` matcht).

### Layout-Kompatibilität

`ShellLayout` liefert Sidebar, SmbBanner, CommandPalette, Tour-Overlay und FeedbackButton wie zuvor. Statt `useState(activeId)` kommt `activeId = routeToPluginId(location.pathname)`. Sidebar-Clicks rufen `useNavigate()` + `pluginIdToRoute()`.

Der bestehende `NavigationContext` bleibt erhalten (für `useNavigation()`-Aufrufer in Home, Tour, Feedback). Eine dünne `NavigationBridge` in `src/core/Router.tsx` implementiert die alte API über React-Router-Hooks — inklusive dem Legacy-`navigate(pluginId, { selectedId })`-Pfad, der programmatisch zum passenden Detail-URL navigiert und parallel den bestehenden Store-Setter für `selectedId`/`selectedAktenzeichen` befüllt.

### Detail-View-Sync

Bauanträge, Forschung und Anträge verwalten ihren `selectedId`/`selectedAktenzeichen`-State weiterhin in Zustand-Stores. Dünne Wrapper-Components (`BauantraegeRoute`, `ForschungRoute`, `AntraegeRoute`, `VerbundRoute`) lesen den Route-Param per `useParams()` und synchronisieren ihn via `useEffect` in den Store. Back-Buttons rufen `navigate('/antraege')` bzw. `navigate('/bauantraege')` statt `setSelectedId(null)`, damit URL und State beim Zurückgehen konsistent bleiben.

Die vollständige Migration weg von den Store-`selectedId`-Feldern ist ein eigener Folge-Patch; in v1.6 reicht der URL↔Store-Sync.

### Scroll-Restoration

`ShellLayout` führt bei `pathname`-Wechsel `window.scrollTo(0, 0)` aus — einfaches Top-Scroll ohne History-State. Für den initialen Use Case genügt das; ein voller Scroll-Preserve ist kein Requirement.

### Deep-Link-Verhalten

- `teamflow.html#/admin/unterprogramme` direkt eingegeben → lädt Unterprogramme-Panel.
- Reload auf Detail-Seiten → Detail-Ansicht bleibt.
- Browser-Zurück funktioniert chronologisch.
- Bookmarks und E-Mail-Links funktionieren.

### Build-Kompatibilität

`vite-plugin-singlefile` ist von der Routing-Wahl unberührt — Router ist bloß JavaScript im Bundle. `base: ''` in `vite.config.ts` bleibt unverändert. Verifikations-Schritt: nach `npm run build:dev` die resultierende `dist-single/teamflow-dev.html` per `file://` öffnen und alle Deep-Links testen.

---

## 16. Build-Time-Konfiguration

### 16.1 Motivation und Feature-Flags-Konzept

TeamFlow wird in verschiedenen Varianten ausgeliefert: interne Entwickler-Builds (alles offen, OpenRouter erlaubt), Demo-Builds für Showcase-Zwecke (reduzierter Funktionsumfang, synthetische Daten, OpenRouter OK), und abteilungs­spezifische Produktions-Builds (fester Daten-Share-Pfad, OpenRouter aus, kein Dev-Panel). Ohne Config-System müsste die Entwicklung pro Variante Code ändern und neu bauen — fehleranfällig, besonders sicherheitskritisch bei OpenRouter in Prod-Builds mit Echt-Daten.

Kern-Mechanismus: eine JSON-Config pro Variante liegt unter `configs/*.config.json`, wird vom Build-Orchestrator geladen, validiert und per Vite-`define` als Compile-Time-Konstante `__TEAMFLOW_CONFIG__` in den Bundle inlined. Code-Seite: `src/config/runtime-config.ts` exponiert die Config typisiert (`TeamflowConfig`), `src/config/feature-flags.ts` liefert Convenience-Accessors (`isKuratorMenusEnabled()`, `isOpenRouterEnabled()`, …). UI-Stellen (Sidebar-Label, Tab-Titel, Plugin-Liste, Feedback-FAB, Welcome-Screen, AI-Bridge) lesen die Flags und rendern konditional.

### 16.2 Config-Varianten und Presets

| Datei | variant | Label | Output | OpenRouter | Fester Pfad | Kurator | Feedback | Dev-Panel | Bereiche |
|---|---|---|---|---|---|---|---|---|---|
| `dev.config.json` | development | TeamFlow DEV | `teamflow-dev.html` | ✓ | – | ✓ | ✓ | ✓ | antraege/bauantraege/dokumente |
| `demo.config.json` | demo | TeamFlow Demo | `teamflow-demo.html` | ✓ | – | – | – | – | antraege/bauantraege |
| `foerderprogramm.config.json` | production | TeamFlow Forschungsförderung | `teamflow-forschungsfoerderung.html` | **×** | **✓** | ✓ | ✓ | – | nur `antraege` („Förderanträge") |

`_template.config.jsonc` dient als kommentierte Referenz (JSONC erlaubt Kommentare; wird nicht direkt geladen).

### 16.3 Sicherheits-Validierung

`validateConfig()` in `scripts/config-schema.mjs` prüft bei jedem Build:

- **KRITISCH (Build-Abbruch)**: `ki.openrouter.enabled === true` UND `data.fixedDataSharePath` gesetzt UND `variant === "production"`. Rationale: In Prod-Builds mit Echt-Daten würde OpenRouter Antrags-Inhalte an Cloud-APIs senden. Nur Dev/Demo dürfen OpenRouter mit Echt-Daten-Annahme nutzen.
- **Build-Abbruch**: Pflicht-Felder fehlen (`build.label`, `build.outputFilename` nicht matcht `[a-zA-Z0-9_-]+`, `configVersion` ≠ aktuelle Version).
- **Build-Abbruch**: App wäre unbenutzbar (kein fester Pfad + keine User-Auswahl + kein Lokal-Fallback).
- **Warnung**: Fester Pfad + User-Auswahl gleichzeitig → User kann überschreiben (selten gewollt).
- **Warnung**: `!features.kuratorMenus` + fester Daten-Pfad → wer importiert dann Daten?
- **Warnung**: Weder OpenRouter noch lokales Llama aktiv → keine KI-Funktionen.

### 16.4 Output-Dateinamen-Konvention

Jede Variante wird zu `dist-single/<build.outputFilename>.html` (z.B. `teamflow-forschungsfoerderung.html`). Der Orchestrator löscht anschließend das generische `dist-single/index.html`, damit im Filesystem keine Verwechslung mit älteren Builds entsteht. Zusätzlich wird `Dokumentenindex-aktualisieren.bat` aus dem Repo-Root nach `dist-single/` kopiert (bisher als Inline-Node-Snippet in `package.json`, jetzt zentralisiert im Orchestrator).

### 16.5 Config-UI

Unter `tools/config-ui/` liegt ein eigenständiges HTML-Tool (Vanilla-JS, keine Vite-Bindings) für komfortable Config-Bearbeitung. Gestartet via `npm run config-ui` — ein Mini-Node-HTTP-Server auf Port 5174 (`scripts/serve-config-ui.mjs`) serviert die UI plus Aliase auf `configs/*` und `scripts/config-schema.mjs`. Funktionen: Preset-Loader (Dev/Demo/Bauforschung), bestehende Config von Disk laden (File-System-Access-API), Live-Validierung mit Fehler-/Warnblöcken, JSON-Vorschau, Speichern als neue `*.config.json` + Copy-Button für das fertige Build-Kommando. Bewusst technisch-nüchternes Styling (Serif-Headings, Fieldsets, reduzierte Palette), damit sofort als Admin-Tool erkennbar und nicht mit der Haupt-App verwechselt.

### 16.6 Runtime-Zugriff

`src/config/runtime-config.ts` stellt `runtimeConfig: TeamflowConfig`, `buildTime: string`, `gitHash: string` bereit. `src/config/feature-flags.ts` liefert Boolean-Helfer. Build-Info-Footer (`src/core/components/BuildInfo.tsx`) zeigt `<variant> · <gitHash>` + Build-Datum klein/dezent unten in der Sidebar (für Support-Fälle: „welche Variante, wann gebaut?").

`src/plugins.config.ts` filtert die Plugin-Liste zweistufig: zuerst nach Feature-Flags (z.B. `features.kuratorMenus === false` entfernt alle `category === 'kuration'`-Plugins), anschließend nach `VITE_PLUGINS`-Env-Var als Developer-Override.

`src/core/services/ai/bridge.ts` lehnt Switch zu `type === 'openrouter'` oder Endpoints mit `openrouter` im Text ab, wenn `isOpenRouterEnabled()` false liefert (doppelter Gürtel zum Build-Time-Validierungs-Check). `src/plugins/einstellungen/AIProviderTab.tsx` blendet die OpenRouter-Option aus der Provider-Auswahl aus.

`src/core/WelcomeScreen.tsx` liest `dataConfig.fixedDataSharePath` und `dataConfig.allowUserToChangePath`. Wenn fester Pfad + Sperre gesetzt, zeigt die Welcome-Seite den Pfad als vorgegeben an, mit einem erklärenden Text „Dieser Build ist auf einen festen Daten-Share konfiguriert".

## 17. Dev-Ergonomie und Fixtures

### Zweck

Beschleunigt den manuellen Iterationsschritt des Einzel-Entwicklers: IDB-Clear, Welcome-Screen-Durchklicken, Kurator-Passwort-Eingabe, mehrfacher CSV-Import per Wizard, Permission-Refresh pro Browser-Restart. Jeder dieser Schritte wird durch einen Ein-Klick-Szenario-Aufruf ersetzbar.

### Feature-Flag-Konzept

`features.devFixtures` ist der Haupt-Schalter (Default `true` nur in `configs/dev.config.json`). `scripts/config-schema.mjs` prüft in `validateConfig()`:

- `devFixtures === true` + `variant === 'production'` → KRITISCH-Fehler, Build-Abbruch
- `devFixtures === true` + `variant === 'demo'` → KRITISCH-Fehler, Build-Abbruch

Dieselbe Struktur wie der OpenRouter-in-Prod-Check aus v1.10. Optionale Sektion `config.dev` mit Kurator-Defaults (`defaultKuratorName`, `defaultKuratorPassword`), Dev-Daten-Pfad-Info (`dataSharePath`, rein informativ — der File-System-Access-API-Picker muss trotzdem einmal manuell laufen), `sessionTtlDays` (Default 30), `autoRefreshSmbPermission` (Default true).

Zweite Verteidigungslinie: `__TEAMFLOW_DEV_FIXTURES__` als Vite-Literal-Define (boolean, `JSON.stringify(config.features.devFixtures)`). Consumer-Sites guarden `if (__TEAMFLOW_DEV_FIXTURES__) { ... }` bzw. `{__TEAMFLOW_DEV_FIXTURES__ && <Component />}`. Rollup eliminiert den Branch in Prod, droppt nachfolgend die Imports — Grep im Prod-Bundle (`dist-single/teamflow-bauforschung.html`) findet keine Fixture-Symbole (`applyScenario`, `FIXTURE_SCHEMAS`, `importTestCsv`, `FixturesPanel`, …).

### Szenarien und Zusammensetzung

`src/dev-fixtures/scenarios.ts` exportiert `SCENARIOS: ScenarioDescriptor[]` und `applyScenario(storage, key)`:

| Key | Zusammensetzung | Zweck |
|---|---|---|
| `frisch` | `resetAll` | Leere DB, SMB-Handle bleibt. Wie erste App-Nutzung nach Setup. |
| `kurator-bereit` | `frisch` + `ensureSmbHandle` + `ensureKuratorSession` | Session aktiv mit Default-Passwort. Keine Daten. |
| `mit-testdaten` | `kurator-bereit` + 3 Mini-CSVs (Stammdaten, Zusammenfassung, Status) | ~20 Anträge. Alltags-Test. |
| `voll-populiert` | `kurator-bereit` + Big-Korpus (5000 + 3000) | Performance-Test. |
| `encoding-tests` | `kurator-bereit` + DE-Format-CSVs (Windows-1252, Semikolon) | Encoding-Auto-Detection-Test. |
| `unterprogramm-vielfalt` | `kurator-bereit` + `stammdaten-mit-up` (4 UPs, 40 Anträge) | Unterprogramm-Wizard + Filter. |

`resetAll()` abweichend vom ersten Patch-Entwurf: Der KV-Schlüssel `smb-handles` bleibt erhalten. Damit überlebt der einmal gewählte Daten-Share-Ordner ein Reset — keine erneute Picker-Interaktion pro Szenario. Der Rest der IDB (CSV-Stores, Filter-Store, sonstige KV-Keys) wird geleert. Begründung: Picker-Interaktion ist nicht programmatisch bypassbar (Browser-Sicherheit), und die Ordner-Auswahl ist nicht Teil dessen, was Tests variieren wollen.

`importTestCsv(idb, fixtureKey)` umgeht den 5-Schritt-Wizard komplett. Hart-kodierte Column-Mappings in `src/dev-fixtures/fixture-schemas.ts` ersetzen Encoding-Detection, Mapping-UI und Unterprogramm-Bestätigungs-Step. Die Funktion refused jede Schema-`id`, die nicht mit `dev-` beginnt — Fixtures dürfen nicht für echte Produktiv-CSVs missbraucht werden.

### State-Inspector als Debug-Tool

Eigenständiges Plugin `dev-state-inspector` mit Route `/dev-state-inspector`, gegated über `features.devFixtures`. Rendert tabellarisch:

- IDB-Store-Counts (CSV_STORES + FILTER_STORE_NAME) mit Sample-Modal (erste 20 Items als JSON)
- SMB-Handle-Präsenz + Permission (`queryPermission`) + Status (`useSmbStatus`)
- Kurator-Session: aktiv, Name, TTL, Ablauf-Countdown
- Feature-Flag-Tabelle der Runtime-Config
- Build-Info: Variant, Label, Git-Hash, Build-Zeit, Config-Version

Erreichbar auch via Dev-Quick-Bar-Button `Inspector`.

### Dev-Quick-Bar

Fixe, schmale Top-Bar (28px, gelb, monospace) oberhalb der Shell. Wird nur gerendert wenn `__TEAMFLOW_DEV_FIXTURES__` true ist. Enthält:

- Dropdown „Szenario" mit 4 Basis-Szenarien
- Dropdown „Spezialfälle" mit encoding-tests + unterprogramm-vielfalt
- Button „Offline 60s" (simuliert SMB-Offline für Reconnect-UX-Test)
- Button „State" (Clipboard-JSON des aktuellen IDB-Zustands)
- Button „Inspector" (Navigation zum State-Inspector)
- Button „Infra" (Navigation zum Dev-Infra-Test-Panel)
- Status-Zeile rechts (aktuelle Operation / Flash-Timer für letzten Erfolg/Fehler)

In Demo/Prod-Builds existiert die Komponente nicht im DOM (Tree-Shake über Literal-Define).

### Sicherheits-Validierung

Doppel-Guard in jeder destruktiven Fixture-Funktion (`resetAll`, `importTestCsv`, `clearAllCsvSources`, `setKuratorOn/Off`, `applyOfflineMode`, `exportCurrentState`):

```ts
function assertDevFixtures(): void {
  if (!__TEAMFLOW_DEV_FIXTURES__ || !features.devFixtures) {
    throw new Error('dev-fixtures: aufgerufen ohne aktive features.devFixtures');
  }
}
```

Compile-Time-Check (`__TEAMFLOW_DEV_FIXTURES__`) UND Runtime-Check (`features.devFixtures`) — auch wenn irgendwann jemand versucht, den Fixture-Code in eine Demo/Prod-Build zu ziehen, schlägt die Laufzeit-Prüfung zu.

### Auto-SMB-Permission-Refresh

`src/dev-fixtures/useAutoSmbRefresh.ts` — React-Hook, der beim ersten Document-Click nach App-Start (capture-Phase, `once: true`) prüft, ob ein Daten-Share-Handle existiert und `queryPermission` nicht `granted` zurückgibt. Falls so, wird `requestPermission()` aufgerufen, anschließend `useSmbStatus.check()`. Der User-Gesture-Constraint der File-System-Access-API macht den ersten Click zur einzigen Möglichkeit. Gated über `dev.autoRefreshSmbPermission`.

### 30-Tage-Session

`ensureKuratorSession` setzt vor `activate()` explizit `ttlMs = dev.sessionTtlDays * 86_400_000`. Session-Meta persistiert in IDB (`admin-session-meta`-Key) mit absoluter `expiresAt`. Rehydrate beim App-Start holt sie zurück, solange nicht abgelaufen. Effekt: Einmal über ein Szenario aktiviert, bleibt die Kurator-Session über Wochen aktiv, auch nach Browser-Restart.

### Dateistruktur

```
src/
├── dev-fixtures/               <- Nur in Dev-Builds vorhanden (Tree-Shake entfernt in Demo/Prod)
│   ├── index.ts                <- Barrel-Export
│   ├── dev.config.ts           <- runtimeConfig.dev + Defaults
│   ├── fixture-schemas.ts      <- Hart-kodierte CsvSchema-Shapes für Test-CSVs
│   ├── helpers.ts              <- resetAll, ensureSmbHandle, ensureKuratorSession, applyOfflineMode
│   ├── import.ts               <- importTestCsv (bypasst Wizard)
│   ├── scenarios.ts            <- SCENARIOS + applyScenario
│   ├── actions.ts              <- clearAllCsvSources, setKuratorOn/Off, exportCurrentState
│   ├── DevQuickBar.tsx         <- Top-Bar im ShellLayout
│   └── useAutoSmbRefresh.ts    <- First-click-permission-refresh-Hook
├── plugins/
│   ├── dev-infrastructure-test/
│   │   └── panels/
│   │       └── FixturesPanel.tsx  <- 5. Sektion des Dev-Infra-Panels
│   └── dev-state-inspector/    <- Neues Plugin (id: 'dev-state-inspector')
│       ├── index.ts
│       └── StateInspectorPanel.tsx
```

## 18. Feature-Flags für Bereichs-Menüs

### Zweck

Unterschiedliche Einsatzszenarien zeigen unterschiedliche Bereiche. Die Forschungsförderungs-Variante braucht nur einen Bereich („Förderanträge"), die Demo-Variante zeigt alle Showcase-Bereiche, die Dev-Variante zeigt alles inkl. Phase-2-Platzhalter. Die Bereichs-Sichtbarkeit wird über Feature-Flags pro Variante gesteuert — nicht über einen Runtime-Modus-Switch.

### Flags

`features.antraege`, `features.bauantraege`, `features.dokumente`. Die Validierung in `scripts/config-schema.mjs` fordert: **mindestens eines aus `antraege | bauantraege` muss `true` sein** (`dokumente` zählt nicht — reiner Phase-2-Platzhalter). `features.forschung` wurde mit v1.14 entfernt; Alt-Configs mit gesetztem Flag bekommen eine Legacy-Warning und der Wert wird ignoriert.

### menuLabels

Neues Top-Level-Config-Objekt `menuLabels: Partial<Record<'antraege'|'bauantraege'|'dokumente', string>>`. Pro aktivem Feature-Flag muss ein nicht-leerer Label-String gesetzt sein. Fehlende Keys fallen auf Plugin-Default-Namen zurück. Default ab v1.14: `antraege: "Förderanträge"`. `menuLabels.forschung` ist entfernt (Legacy-Warning analog zum Flag).

### Gating-Mechanik

**Sidebar**: `src/core/ShellLayout.tsx` nutzt `displayName(plugin)` — mappt Bereichs-Plugin-IDs auf `menuLabel(key, fallback)` aus `src/config/feature-flags.ts`.

**Plugin-Filter**: `src/plugins.config.ts` filtert Bereichs-Plugins raus, deren Flag `false` ist. Das entfernt das Plugin aus Sidebar-Navigation und Router-flatIds gleichzeitig.

**Route-Gating**: `src/core/Router.tsx` registriert einen Catch-All `path: '*'` am Ende, der auf `/` redirected. Damit landen Bookmarks oder Direkt-URLs auf deaktivierte Bereiche (z.B. `#/bauantraege` in der Forschungsförderungs-Variante) zuverlässig auf der Home-Route.

### Config-Beispiele

```jsonc
// dev.config.json — alles an
"features": { "antraege": true, "bauantraege": true, "dokumente": true }

// demo.config.json — zwei Showcase-Bereiche
"features": { "antraege": true, "bauantraege": true, "dokumente": false }

// foerderprogramm.config.json — nur Förderanträge
"features": { "antraege": true, "bauantraege": false, "dokumente": false }
"menuLabels": { "antraege": "Förderanträge" }
```

---

**Dokument-Version**: 1.14 — Konsolidierung Forschung → Förderanträge
**Pflegehinweis**: Bei Design-Änderungen hier updaten bevor neuer Claude-Code-Prompt läuft. Claude Code muss dieses Dokument bei jedem Folge-Prompt mitlesen.

**Changelog**:
- v1.14: Konsolidierung Forschung → Förderanträge. `forschung`-Plugin (Vorgang-basiert) aufgelöst und in `antraege` (CSV-basiert) integriert, weil beide konzeptuell dasselbe beschrieben haben. `Antrag`-Schema erweitert um `foerdergeber`, `branche`, `dokumente?: AntragDokumentRef[]`. Neue Seed-Fixture `src/core/services/seed/foerderantraege-data.ts` mit 20 Einträgen (16 migriert + 4 neu); 4 echte Markdown-Dokumente (FA-001/-010/-013/-016) aus `seed/docs/forschung-*.ts` werden via `dokumente`-Array referenziert, übrige Anträge haben fiktionale Refs für Filter-Abdeckung. Feature-Flag `features.forschung` + `menuLabels.forschung` entfernt (Legacy-Warning für Alt-Configs). Menü-Default „Anträge" → „Förderanträge" (dev/demo/foerderprogramm/template synchronisiert). `UserProfile.department` auf `'antraege' | 'bauantraege' | 'beide'` verengt; Legacy `'forschung'` wird in `useProfile.reloadProfile()` stumm auf `'antraege'` gemappt. Abteilungs-Dropdown in Einstellungen + Onboarding rendert dynamisch aus aktiven Bereichs-Flags. `Vorgang.type` auf `'bauantrag'` reduziert, `FORSCHUNG_TRANSITIONS` + `ForschungRoute` + `useForschungStore`-Cross-Refs entfernt. AI-Prompts `forschung_*` → `foerderung_*`. Orama-Index-Type beim Seed `'forschung'` → `'antrag'`. Dokument-Struktur am Daten-Share: `programm/antraege/forschung/` entfällt (Förderanträge leben im IDB-Store ANTRAEGE). Historischer Hinweis: Das `forschung`-Plugin existierte v1.0 bis v1.13.
- v1.13: Pre-Phase-2-Cleanup. Demo-Daten-Auto-Seed: `data.demoDataBundled=true` ruft `seedTestData()` nach Onboarding-/Welcome-Gate automatisch auf (idempotent via bestehendem `seed-complete`-IDB-Flag); Toast „Demo-Daten geladen" beim ersten Seed. Kurator-Gating zweistufig: Build-Time-Filter in `plugins.config.ts` (`category: 'kuration'` + `features.kuratorMenus`) **plus** Runtime-Gate in `EinstellungenPage` (Toggle-Sichtbarkeit) und `ShellLayout` (Ableitung `isKurator`). Neue `isDemoDataBundled()`-Helper in `feature-flags.ts`. Config-Validator verbietet zusätzlich `variant=production` + `demoDataBundled=true` (analog zum OpenRouter-Prod-Check aus v1.10). Zentraler ID-Generator (`src/core/services/id-generator.ts`) mit `generatePrefixedId(prefix, existing)` und `uuid()`; Bauantraege/Forschung/Dokumente/CSV-Merger nutzen ihn (Duplikat-Logik entfernt). Dokumenten-IDs wechseln von `DOC-${Date.now()}` auf UUIDv4 (bestehende IDs bleiben kompatibel, nur neue Dokumente bekommen neues Format). CLAUDE.md: 300-Zeilen-Regel präzisiert mit Ausnahmen (statische Daten-Files, kohärente State-Machines, Orchestrator-Services) und expliziter „keine Ausnahme für UI-Komponenten + Multi-Domain-Services", Re-Ranker-Notiz von „deaktiviert" auf „aktiv, per Pipeline-Config steuerbar" korrigiert, Plugin-Baum auf Ist-Stand aller 15+ Plugins gebracht. Veralteter TODO-Kommentar in `xlsLabelParser.ts:225-226` entfernt. Keine strukturellen Änderungen; P1 (>300-Zeilen-Komponenten), P2 (Vorgang-Union-Type) und P3 (Feedback-Legacy-Write-Path) aus dem Audit-Bericht bewusst ausgelassen — werden opportunistisch bzw. als erster Schritt von Phase 2 adressiert.
- v1.12: Zielgruppen-Klärung, Menü-Flag-System, Umbenennung Bauforschung → Forschungsförderung. Neue Feature-Flags `features.antraege`, `features.bauantraege`, `features.forschung`, `features.dokumente` steuern Bereichs-Menüs pro Variante; Validation fordert mindestens ein Bereichs-Menü aktiv. Neues Top-Level `menuLabels`-Objekt erlaubt Sidebar-Label-Überschreibung (z.B. „Förderanträge"). Sidebar + Command-Palette nutzen `displayName(plugin)` mit `menuLabel(key, fallback)`. `plugins.config.ts` filtert Bereichs-Plugins nach Flag; `Router.tsx` Catch-All redirected auf Home. `configs/bauforschung.config.json` entfernt, ersetzt durch `configs/foerderprogramm.config.json` (`variant=production`, fester SMB-Pfad `\\server\teamflow-forschungsfoerderung\`, Label „TeamFlow Forschungsförderung", nur `antraege` aktiv mit Label „Förderanträge"). Build-Script `npm run build:foerderprogramm` ersetzt `npm run build:bauforschung`. Produktbegriff „Bauforschung" aus WelcomeScreen-Default, CLAUDE.md, DEV_SETUP.md, tools/config-ui entfernt. Test-Korpus-Ordner `public/test-korpus/bauforschung-v2/` sowie Architektur-Doc-Dateiname bleiben als Artefakt-Bezeichnungen. Neue Sektion 18.
- v1.11: Dev-Ergonomie-Schicht. Feature-Flag `features.devFixtures` + `dev`-Config-Sektion; strukturell blockiert in `variant=demo|production` via `scripts/config-schema.mjs` (KRITISCH-Fehler). `__TEAMFLOW_DEV_FIXTURES__` als Vite-Literal-Define für Tree-Shake. Neues Modul `src/dev-fixtures/` mit Szenarien (`frisch`, `kurator-bereit`, `mit-testdaten`, `voll-populiert`, `encoding-tests`, `unterprogramm-vielfalt`), `resetAll` (SMB-Handle-preservierend), `ensureSmbHandle`, `ensureKuratorSession` (mit 30-Tage-TTL-Override), `importTestCsv` (hart-kodierte Fixture-Schemas für Test-Korpus-CSVs), `applyOfflineMode`, `exportCurrentState`, `setKuratorOn/Off`, `useAutoSmbRefresh` (request-permission bei erstem Click). Neue UI: Dev-Quick-Bar oben im ShellLayout (gelb, monospace, Szenario-Dropdowns + Offline + State + Inspector + Infra), FixturesPanel als 5. Sektion im Dev-Infra-Test-Panel, eigenständiges `dev-state-inspector`-Plugin (Route `/dev-state-inspector`, IDB-Counts + Sample + Handle/Session-Status + Feature-Flags + Build-Info). Doku: `docs/DEV_SETUP.md`. Neue Sektion 17.
- v1.10: Build-Time-Config-System. `configs/*.config.json` pro Variante (Dev/Demo/Bauforschung) + `_template.config.jsonc`. `scripts/config-schema.mjs` mit `DEFAULT_CONFIG` und `validateConfig` (Sicherheits-Check: OpenRouter + fester Daten-Pfad + variant=production = Build-Abbruch). `scripts/build-with-config.mjs` als Orchestrator; Vite-`define` inlined Config + `buildTime` + `gitHash`. `src/config/runtime-config.ts` + `feature-flags.ts`. UI-Verdrahtung: Sidebar-Label, `document.title`, Plugin-Filter (kuratorMenus/feedback/volltextsuche/devInfraPanel), Feedback-FAB, Welcome-Screen-fester-Pfad, AI-Bridge-OpenRouter-Gate, `AIProviderTab` blendet OpenRouter aus. `BuildInfo`-Footer in Sidebar. Komfort-HTML-UI `tools/config-ui/` + `scripts/serve-config-ui.mjs` (Port 5174, File-System-Access-API-Speichern). Scripts: `build:variant`, `build:dev`, `build:demo`, `build:bauforschung`; `build:single` entfernt (`.bat`-Kopie im Orchestrator). Neue Sektion 16.
- v1.9: Strukturkonsolidierung und Rollen-Umbenennung (Kurator statt Admin; Daten-Share mit `programm/`, `backups/`, `_intern/`; getrennter Dokumentenquelle-Handle; Welcome-Seite mit Migration-Dialog; Plugin-IDs `*-admin` → `*-kuration`).
- v1.8: Hierarchische Label-XLS — neuer Parser (`xlsLabelParser`) mit variabler Header-Zeilen-Zahl (2–8), Erkennung von Gruppen-Hierarchie über merged cells, Sammlung vertikal-merged Gruppen-/Label-Zellen als ambige Merges. `ColumnMappingEntry` um `label`, `group_path`, `ambiguous_merge_resolution` erweitert. `CsvSchema` bekommt `label_xlsx_header_rows`. `FilterDefinition.display_group` aus Schema übernommen. Wizard-Schritt 2 rendert Mapping gruppiert (Collapsible-Sections) und enthält Header-Zeilen-Picker + Ambig-Resolution-Dropdowns + Bulk-Leiste. Antrags-Detail-Ansicht zeigt Felder in Gruppen-Abschnitten, dominante Source gewinnt bei Merge-Konflikt zwischen Sources. Neue Test-Assets: `scripts/generate-test-label-xlsx.mjs` erzeugt 4 XLSX-Varianten (2/3/4 Header-Zeilen + vertikal-merged "Branche") + passende CSV `stammdaten-branche-mini.csv`. Neue Sektion 3.1.
- v1.7: SMB-Permission-Recovery-UX
- v1.6: Patch 1b-REPAIR — Separator-Detection (`detectSeparator` über Varianz-Score), `CsvSchema.encoding`/`separator` persistiert, Wizard-Step-1-Dateiformat-Panel mit Live-Preview. DE-Format-Test-CSVs (`*-de.csv`, Windows-1252/Semikolon) im Wizard und Generator-Script. URL-Routing via HashRouter (`react-router-dom` v6) mit Deep-Link-Support für alle Plugins und Detail-Pfade (`/bauantraege/:id`, `/antraege/:aktenzeichen`, `/antraege/verbund/:verbundId`, `/forschung/:id`). Neue Sektion 13. Sidebar-Eintrag für `unterprogramme-admin` auf „Admin: Unterprogramme" vereinheitlicht.
- v1.5: Patch 1b-5 — Unterprogramm-Filter beim CSV-Import. Sektion 3 `unterprogrammen`-Schema erweitert um `aktiv`, `code`, `name?`, `zeitraum_von/bis?`, `antrag_count_cached?`, `created_at`, `updated_at`. Entity-Diagramm präzisiert („Unterprogramm per FM_Nummer-Code, optional mit Klartext-Label"). Sektion 4.2 Wizard-Schritt 3 „Unterprogramm-Auswahl" dokumentiert, Pflicht-Mapping `unterprogramm_id` für Master. Sektion 4.3 Filter-Stufe in der Import-Pipeline nach Skip-Regeln, Lösch-Pfad über `removed`-Bucket. Neue Sektion 4.6 „Unterprogramm-Verwaltung" mit Admin-Panel `/admin/unterprogramme`, Flag-≠-sofort-Löschung-Semantik, Label-Map-Integration in Facet-Filter.
- v1.2: Join-Key-Schutz in Sektion 4.4 (Multi-CSV-Merge) ergänzt — Join-Key-Feld wird beim Merge nicht von der joinenden Source geschrieben; Master-Initial-Insert befüllt das Feld implizit aus dem Join-Value.
- v1.1: Sektionen 10 (Sicherheitsmodell), 11 (Index-Deployment & Sync), 12 (Backup-Strategie) hinzugefügt. OCR-Sektion 5.7 von deferred auf aktiv (Tesseract.js v5) umgestellt. SMB-Ordnerstruktur in Sektion 2 erweitert. Phasen-Plan um Infrastruktur/Security in Phase 1 ergänzt, OCR nach Phase 3 verschoben. Risiken um SMB, OCR-Durchsatz, Passwort-Verlust erweitert.
- v1.0: Initial-Entwurf basierend auf Klärungs-Diskussion
