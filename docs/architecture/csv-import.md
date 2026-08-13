# CSV-Import-Wizard & Verbund-Aggregation

*Last reviewed: 2026-05-28 (v2.2.0)*

> **Automatischer Nachzug:** Dieses Doc beschreibt die **manuelle Erstanlage** einer CSV-Quelle über den
> Wizard. Der **tägliche Auto-Import** geänderter Exporte, die Frische-Ampel „● CSV" und der
> Projektions-Rebuild bei Mapping-Nachzug stehen in [csv-auto-refresh.md](csv-auto-refresh.md).

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

## Schutz gegen Bestandsverlust beim Import (v4.9.0)

Der Row-Hash-Diff in [importer.ts](../../src/core/services/csv/importer.ts) leitet `removedJoinValues`
allein daraus ab, welche bisherigen Join-Werte in diesem Lauf **nicht** in `seen` gelandet sind. Damit
war „im Fachsystem gelöscht" nicht von „vom Import gefiltert" zu unterscheiden — und der Merge löscht
über [removeAntragIntoBatch](../../src/core/services/csv/merger/batched.ts) bedingungslos: Antrag,
List-View-Eintrag, Verbund-Referenz (samt Verbund, wenn es der letzte TV war) und Akronym-Index.

**Die Join-Spalte muss in der gelesenen Kopfzeile stehen, nicht nur im Mapping.** `findJoinColumn` löst
gegen `column_mapping` auf; eine im Export umbenannte oder weggefallene Join-Spalte lässt das Mapping
formal gültig, macht aber `row[joinCol]` in **jeder** Zeile leer — `seen` bleibt leer, der gesamte
Bestand der Quelle gilt als entfernt. Der Import bricht deshalb direkt nach dem Parsen ab, **vor**
`saveCsvSourceFile` und vor jedem Schema-Stempel: die Share-Kopie bleibt unangetastet, die Quelle gilt
nicht als erledigt und wird im nächsten Auto-Refresh erneut angeboten. Der Abbruch landet im
Reimport-Dialog als Meldung und im Auto-Refresh in `report.errors`.

## Gelöscht wird erst, wenn der Antrag in ALLEN Quellen weg ist (v4.11.0)

Fachliche Regel des Teams, nicht bloß eine Absicherung: die Quellen reichen **unterschiedlich weit
zurück** — Master und Begleitung (`7737_Bgl`) führen den Bestand bis 2015, die Projektbeschreibung
(`9052_PrjBsp`) bis 2012. „Fehlt in diesem Export" sagt deshalb nichts über die Existenz des Antrags,
sondern etwas über den Horizont der Quelle. Bis v4.10 übernahm `runMergeForDeltas` die
`removedJoinValues` **einer** Quelle unbesehen als `removedAz`.

`teileLoeschkandidaten` ([importer.ts](../../src/core/services/csv/importer.ts)) teilt sie deshalb in
*wirklich weg* und *gehalten*:

- Geprüft wird gegen die **Row-Hashes** der anderen Quellen (`getJoinValuesForSchema`), nicht gegen
  deren Dateien — die Hashes spiegeln exakt, was eine Quelle bei ihrem letzten Import getragen hat.
- Nur Quellen mit `join_key === 'aktenzeichen'` zählen; Verbund-Nummern und Akronyme sind keine
  Aktenzeichen.
- Jeder Import löscht die Hashes seiner ausgefallenen Zeilen **vollständig** — auch die gehaltenen.
  Genau daran löst sich der Rückhalt von selbst auf: die letzte Quelle, die eine Zeile fallen lässt,
  findet bei keiner anderen mehr einen Hash und löscht den Antrag. Das gilt innerhalb desselben
  Auto-Refresh-Laufs und **unabhängig von der Quellen-Reihenfolge**.
- Ein gehaltener Antrag wird **nicht** neu gemergt. Er behält seinen letzten vollen Stand, statt auf
  die Felder der verbliebenen Quellen zusammenzuschrumpfen — ein Teil-Export soll den Bestand nicht
  aushöhlen. Liefert die Quelle die Zeile wieder, zählt sie als `new` und der Merge holt alles zurück.
- Sichtbar statt still: `ImportResult.heldRemovals` (+ bis zu 10 Beispiele), Audit-Eintrag
  `csv_import_loeschung_zurueckgehalten`, Zeile im Wizard-Abschluss, Summe in `RefreshReport` und im
  `[data-update]`-Log.

**Grenze:** eine stillgelegte, aber noch registrierte Quelle hält ihre Row-Hashes und damit ihre
Anträge dauerhaft fest. Wer eine Quelle außer Betrieb nimmt, entfernt sie (`removeSchema`) — sonst
altert der Bestand nicht mehr.

Die verbleibenden Türen in dieselbe Löschung sind damit **enger, aber nicht zu**: leerer Join-Wert,
leere/unbekannte Unterprogramm-Zelle, Whitespace im Spaltennamen
([parser.ts](../../src/core/services/csv/parser.ts) trimmt die Kopfzeile, liest den Wert aber unter
dem getrimmten Schlüssel) und abgeschnittener Export führen weiterhin in `removedJoinValues` — sie
treffen jetzt nur noch Anträge, die **keine** zweite Quelle trägt. Gegen ihren team-weiten Teil steht
der Publish-Guard in [csv-auto-refresh.md](csv-auto-refresh.md).

## Verbund-Aggregation (Forschungs-Domäne)

Ein **Verbund** bündelt mehrere Teilanträge unter einer gemeinsamen Projektbeschreibung. Der CSV-Master-Import erkennt Verbünde über das Akronym + Teilantragsindex und dedupliziert geteilte Dokumente per Content-Hash. Anzeige in der Antrags-Liste: Teilvorhaben werden visuell unter dem Verbund-Header geclustert (siehe `src/plugins/antraege/` Cluster-Komponenten).

## Verwandte Cheatsheets

- [add-csv-field.md](../agents/add-csv-field.md) — Neues `CanonicalField` ergänzen
- [add-csv-field-type.md](../agents/add-csv-field-type.md) — Neuer `FieldType` für Wert-Koerzion
- [add-filter-facet.md](../agents/add-filter-facet.md) — Neue Filter-Facet
