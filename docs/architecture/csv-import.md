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

## Gefiltert heißt „ich weiß es nicht", nicht „gibt es nicht" (v4.18.0)

Zweite Hälfte derselben Team-Entscheidung: `seen` füllt nur, was der Import auch **ausgewertet** hat.
Eine Zeile, die im Export steht, aber am Filter hängenbleibt, sah damit genauso aus wie eine Zeile,
die es nicht mehr gibt. Der Schnitt verläuft jetzt zwischen Entscheidung und Wissenslücke:

| Lage der Zeile | Import | Löschung |
|---|---|---|
| Unterprogramm-Code aktiv | ja | – |
| Code im Katalog, aber deaktiviert | nein | **ja** — Kurations-Entscheidung |
| Zelle leer oder Code unbekannt | nein | **nein** — `unknownUnterprogramm` |
| Zeile ohne Join-Wert | nein | unberührt — `rowsWithoutJoinValue` |

`beurteileUnterprogramm` ([importer.ts](../../src/core/services/csv/importer.ts)) trifft das Urteil,
`getUnterprogrammFilter` liefert dafür beide Mengen (`aktiv` **und** `bekannt`) statt nur der
Allowlist.

**Zeilen ohne Join-Wert werden bewusst nur gezählt, nicht gesondert behandelt.** Der naheliegende
Reflex — „nicht zuzuordnen, also in diesem Lauf gar nicht löschen" — hält der Messung am echten
Bestand nicht stand: die Projektbeschreibung führt **28 926 von 43 149 Zeilen ohne
Förderkennzeichen** (Irrläufer, frühe Phasen; alle übrigen Felder belegt). Das ist der Normalfall
dieser Quelle, kein Signal; eine Aussetz-Regel hätte ihre Löschungen dauerhaft stillgelegt. Ohne
Join-Wert stand die Zeile ausserdem nie in den Row-Hashes — für sich genommen kann sie gar keine
Löschung auslösen. Die Zahl ist trotzdem sichtbar, und zwar **exakt**: bis v4.15 rendete der Wizard
die Länge der auf zehn gedeckelten Warnungs-Stichprobe `skippedJoinValues` als Mengenangabe.

Der Row-Hash einer gefilterten Zeile bleibt **stehen** (anders als bei einer echten Löschung): die
Quelle trägt sie ja, sie hält den Antrag also weiter gegen die Löschung durch andere Quellen.

**Whitespace im Spaltennamen** ist damit ebenfalls zu: `normalizeRow`
([parser.ts](../../src/core/services/csv/parser.ts)) baut die Zeile zwar auf die getrimmten
Spaltennamen um, liest die Werte aber unter dem **rohen** Namen, wie PapaParse sie ablegt. Vorher war
„FKZ " eine still geleerte Spalte — in der Join-Spalte hätte das den kompletten Bestand als entfernt
gemeldet, ohne dass der Kopfzeilen-Guard (v4.9.0) etwas bemerkt.

Ebenfalls seit v4.18.0 nicht mehr stumm:

- **PapaParse-Zeilenfehler** (`TooFewFields`, ungeschlossene Anführungszeichen) landen als
  `ImportResult.parseErrors` im Wizard und im Audit-Log. Der Import läuft weiter — ein Ausreißer soll
  den Tages-Import nicht kippen —, aber die betroffenen Zeilen sind gegenüber der Kopfzeile
  verschoben, ihre Werte stehen in den falschen Feldern.
- **`saveCsvSourceFile` ist kein best-effort mehr.** Der Merge liest ausschließlich diese Share-Kopie
  zurück; ein still gescheiterter Write ließ ihn mit der alten oder gar keiner Fassung rechnen und
  Anträge schreiben, denen ihre Felder fehlen. Ein Fehler bricht den Import jetzt ab. `loadCsvSourceFile`
  wirft entsprechend bei einer **vorhandenen, aber unlesbaren** Kopie und liefert `null` nur noch für
  „gibt es nicht" (Pitfall-Klasse 17).
- **Ein nicht veröffentlichter Snapshot** steht als `ImportResult.publishError` im Wizard („Import
  lokal abgeschlossen") und im Auto-Refresh in `report.errors`.

Übrig bleibt der **abgeschnittene Export**: er führt weiter in `removedJoinValues`, trifft aber nur
noch Anträge, die keine zweite Quelle trägt. Gegen seinen team-weiten Teil steht der Publish-Guard in
[csv-auto-refresh.md](csv-auto-refresh.md).

## Verbund-Aggregation (Forschungs-Domäne)

Ein **Verbund** bündelt mehrere Teilanträge unter einer gemeinsamen Projektbeschreibung. Der CSV-Master-Import erkennt Verbünde über das Akronym + Teilantragsindex und dedupliziert geteilte Dokumente per Content-Hash. Anzeige in der Antrags-Liste: Teilvorhaben werden visuell unter dem Verbund-Header geclustert (siehe `src/plugins/antraege/` Cluster-Komponenten).

## Verwandte Cheatsheets

- [add-csv-field.md](../agents/add-csv-field.md) — Neues `CanonicalField` ergänzen
- [add-csv-field-type.md](../agents/add-csv-field-type.md) — Neuer `FieldType` für Wert-Koerzion
- [add-filter-facet.md](../agents/add-filter-facet.md) — Neue Filter-Facet
