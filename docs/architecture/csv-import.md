# CSV-Import-Wizard & Verbund-Aggregation

*Last reviewed: 2026-05-28 (v2.2.0)*

## CSV-Import-Wizard (Phase 1b + Label-XLS-Hierarchie)

Kurator-Wizard unter [src/plugins/csv-sources-kuration/wizard/](../../src/plugins/csv-sources-kuration/wizard/) für CSV-Source-Registrierung. 5 Schritte:

1. **Metadata** — Datei-Upload, Encoding, Separator, Schema-Meta.
2. **Column-Mapping** — Spalten auf `CanonicalField` mappen, optional mit hierarchischem Label-XLS-Upload.
3. **Unterprogramme** (nur Master-Schema) — Hierarchie-Definition.
4. **Review** — Vorschau der Imports.
5. **Progress** — Import-Lauf mit Live-Status.

### Label-XLS-Hierarchie

Column-Mapping unterstützt optionalen **hierarchischen Label-XLS-Upload** ([xlsLabelParser](../../src/core/services/csv/filter/xlsLabelParser.ts)):

- Kurator wählt Anzahl Header-Zeilen (2–8, Default 4). Konvention: letzte Zeile = CSV-Namen, vorletzte = Labels (leer → Fallback CSV-Name), Zeilen darüber = Gruppen-Ebenen (merged cells).
- Vertikal-merged Gruppen-/Label-Zellen → als ambige Merges erkannt. Kurator entscheidet per Dropdown pro Merge (`Als Gruppe` / `Als Label wiederholt` / `Ignorieren`), Bulk-Leiste bei ≥2.
- `ColumnMappingEntry` persistiert `label`, `group_path`, `ambiguous_merge_resolution`; `CsvSchema.label_xlsx_header_rows` für konsistente Re-Imports.
- Wizard-Step 2 rendert die Mapping-Tabelle bei vorhandenem XLS gruppiert (Collapsible-Sections mit `›`-Separator); Fallback auf flache Tabelle wenn kein XLS geladen.
- Antrags-Detail-Ansicht (`/antraege/:aktenzeichen`) zeigt Felder in Gruppen-Abschnitten, „Weitere Felder" am Ende. Merge-Konflikt zwischen Sources: Master → höchste Priority → erste Source mit Pfad.
- `FilterDefinition.display_group` wird beim Erstellen eines Filters aus dem Schema vorgetragen (UI-Gruppierung im Filter-Panel in Folge-Patch).
- Test-Assets: `scripts/generate-test-label-xlsx.mjs` erzeugt 4 XLSX-Varianten (2/3/4 Zeilen + vertikal-merged "Branche") unter `public/test-korpus/bauforschung-v2/`. Läuft als prebuild-Hook.

## Verbund-Aggregation (Forschungs-Domäne)

Ein **Verbund** bündelt mehrere Teilanträge unter einer gemeinsamen Projektbeschreibung. Der CSV-Master-Import erkennt Verbünde über das Akronym + Teilantragsindex und dedupliziert geteilte Dokumente per Content-Hash. Anzeige in der Antrags-Liste: Teilvorhaben werden visuell unter dem Verbund-Header geclustert (siehe `src/plugins/antraege/` Cluster-Komponenten).

## Verwandte Cheatsheets

- [add-csv-field.md](../agents/add-csv-field.md) — Neues `CanonicalField` ergänzen
- [add-csv-field-type.md](../agents/add-csv-field-type.md) — Neuer `FieldType` für Wert-Koerzion
- [add-filter-facet.md](../agents/add-filter-facet.md) — Neue Filter-Facet
