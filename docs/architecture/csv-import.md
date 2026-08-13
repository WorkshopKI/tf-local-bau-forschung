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
Förderkennzeichen**. Das ist kein Datenfehler, sondern der Bauplan dieser Quelle: sie listet
*Beteiligungen an Verbünden*, nicht Anträge. Gemessen nach `STATUS_TV` — Sonderstatus 20 732,
Skizze eingegangen 3 188, assoziierter Partner 2 673, internationaler Partner 1 312,
abgelehnt/zurückgezogen 981, Irrläufer 40. Wer keinen Zuwendungsbescheid bekommt, bekommt kein
Förderkennzeichen; **27 492** dieser Zeilen gehören zu einer `VB_NUMMER`, die anderswo sehr wohl
eine Zeile mit FKZ hat. Zum Vergleich die Master-Quelle: dort trägt **jede** der 12 359 Zeilen ein
FKZ, in der Begleitung jede der 7 914 — jeder *Antrag* hat eines.

Eine Aussetz-Regel hätte die Löschungen dieser Quelle also dauerhaft stillgelegt. Ohne Join-Wert
stand die Zeile ausserdem nie in den Row-Hashes — für sich genommen kann sie gar keine Löschung
auslösen. Die Zahl ist trotzdem sichtbar, und zwar **exakt**: bis v4.17 rendete der Wizard die Länge
der auf zehn gedeckelten Warnungs-Stichprobe `skippedJoinValues` als Mengenangabe.

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

## Was der Merge schreibt — und was er nicht raten darf (v4.20.0)

Drei Stellen, an denen der Merge etwas *stiller* verfälschte, als ein Absturz es getan hätte. Gemeinsamer
Nenner: der geschriebene Wert sah plausibel aus, und niemand konnte ihm ansehen, dass er nicht aus der
Quelle stammte.

- **Die Slim-Projektion wird vollständig geschrieben.** `toAntragListItem` bekommt seit Projektion v6 die
  kuratierten Ordner-Spalten als dritten Parameter; Voll-Rebuild und beide Snapshot-Sync-Pfade reichten ihn
  durch, die beiden **Merge**-Pfade nicht ([batched.ts](../../src/core/services/csv/merger/batched.ts),
  [single.ts](../../src/core/services/csv/merger/single.ts)). Weil `putAntraegeListView` ein **Vollersatz**
  ist, verlor damit jeder frisch importierte oder geänderte Antrag seine `kat_status`-Werte wieder —
  unberührte behielten ihre. Die Spalte sah dadurch lückenhaft aus, nicht falsch, und heilte erst beim
  nächsten App-Start. Am echten Bestand gemessen: 12 369 von 14 225 Anträgen tragen Ordner-Werte, für einen
  von ihnen liefert der alte Aufruf `kat_status = null`, der neue alle drei Ordner. Die Auflösung kommt aus
  dem exportierten `loeseKategorieSpaltenFuer` — **eine** Definition für Rebuild, Sync und Merge.
- **Eine korrigierte `VB_KURZNAM` erreicht den Verbund-Record.** Dort galt `if (!next.akronym && …)` —
  first-write-wins —, während Titel und Status zwei Zeilen weiter überschrieben werden. Danach zeigten
  Antragsliste, Suche und Akronym-Index den neuen Namen, Verbund-Detailseite, Gruppenzeile und KI-Kontext
  den alten; weil `akronym` antrag-level ist, hielt auch die Verbund-Historie die Abweichung nicht fest.
  Jetzt gewinnt der nicht-leere Wert, ein leerer überschreibt weiterhin nichts.
- **Der Verbund-Heal erfindet nichts mehr** ([verbuende-rebuild.ts](../../src/core/services/csv/verbuende-rebuild.ts)).
  Er nahm `lead.verbund_titel ?? lead.titel` und `lead.status`. Verbund-Ebenen-Felder gehen im Merge aber
  **nie** auf den Antrag, also war `verbund_titel` am Slim-Item immer leer und der TV-Fallback griff immer;
  `status` war ohnehin STATUS_TV statt STATUS_VB. Am Fixture-Master weicht `VB_TITEL` in 44/44 Zeilen von
  `THEMA_AD` ab — 21 von 21 Verbünden hätten einen falschen Titel bekommen, und der Heal läuft bei **jedem
  App-Start und vor jedem Publish**. Beide Felder bleiben jetzt offen: die Konsumenten fallen von sich aus
  auf den Lead-TV zurück (`verbund?.titel ?? rep?.titel`), und die Detailseite leitet den Verbund-Status aus
  den TV-Status ab. Ein Fallback zur **Lesezeit** ist reparierbar, ein persistierter Falschwert wandert über
  `verbuende.jsonl` ins ganze Team. `akronym` bleibt — es ist antrag-level, also gelesen statt geraten.
- **Mis-filed Records werden repariert, nicht ersetzt.** `listVerbuendeByProgramm` liest über den
  `programm_id`-Index; ein Record mit falscher `programm_id` galt dort als *fehlend* und wurde vom `put` mit
  TV-Werten überschrieben — ein inhaltlich korrekter Verbund verlor dabei Titel und Status. Der Heal liest
  jetzt zusätzlich per **Key** und korrigiert an einem gefundenen Record nur Ablage (`programm_id`) und
  Teilvorhaben-Liste.

## Welche Datei gehört zu welcher Quelle (v4.22.0)

Der Ordner-Link ist der empfohlene Weg; er löscht die Per-Datei-Handles. Scheitert `getFileHandle`
ein einziges Mal (Datei fehlt, umbenannt, gerade in Bearbeitung, Groß-/Kleinschreibung), greift der
Header-Fallback in [csv-source-handle.ts](../../src/plugins/csv-sources-kuration/csv-source-handle.ts)
— und der nahm **jede** `.csv` mit `score > 0`, also mit auch nur einer bekannten Spalte. Weil die drei
C16-Quellen ihren Spaltenvorrat teilen, ist das keine theoretische Lücke: über alle 9 Schema/Datei-Paare
der Fixtures matchen **fremde** Dateien 14–20 von 21–24 gemappten Spalten.

Zwei Regeln stehen jetzt davor:

1. **Der Fallback muss überzeugen** — genommen wird nur eine Datei, die **keine** Schema-Spalte
   vermissen lässt, und nur, wenn genau eine das schafft. Bleibt es mehrdeutig, ist `null` („Datei
   fehlt") die Antwort: eine solche Meldung ist reparierbar, eine Fehlbindung nicht.
2. **`schema.source_file_name` schlägt die lokale Filemap.** Der Notnagel wurde als Self-Heal in die
   Filemap geschrieben, und weil der schnelle Pfad `knownFileName` **vor** dem Schema-Namen probierte,
   gewann die Fehlbindung dauerhaft — auch wenn die richtige Datei am nächsten Tag zurück war. Der
   kuratierte Name geht vor, der Cache füllt nur die Lücke.

## Demo-Quellen in echte umwandeln (v4.23.0)

Der Knopf „Demo-Quellen umwandeln" speicherte bisher nur das neue Schema und löschte das
Fixture-Schema — **ohne** `deleteRowHashes`, ohne Recompute (anders als `removeFixtureSeeds`). Die
Demo-Anträge blieben im Bestand, ihre Row-Hashes verwaisten unter nicht mehr existierenden
Schema-Ids, und die Lage war danach **schlechter als vorher**: `fixtureSourceWarning` fand keine
`fixture-real-*`-Id mehr (Banner weg), `removeFixtureSeeds` griff ins Leere, der Echt-Import unter
der neuen Id räumte nichts ab. Übrig blieb der Alles-oder-nichts-Reset — den der Erfolgs-Banner auch
noch empfahl, obwohl `clearAntragData` herkunftsblind löscht.

[convert-fixture-source.ts](../../src/plugins/csv-sources-kuration/services/convert-fixture-source.ts)
räumt jetzt mit auf, und zwar nach **derselben Löschregel wie der Import**
([loeschregel.ts](../../src/core/services/csv/loeschregel.ts), geteilt statt kopiert): weg ist nur,
was keine verbliebene Quelle mehr trägt; ein Antrag, den auch eine echte Quelle führt, wird ohne den
Fixture-Anteil neu zusammengebaut. Damit erledigt sich auch der zweite Defekt derselben Stelle —
dass die Share-CSV unter der ALTEN Id liegen bleibt und der (Master-)Schema danach 0 Zeilen liefert:
es gibt keine Demo-Anträge mehr, die ein Recompute verstümmeln könnte.

Dritter Defekt, andere Wurzel: **die abgeleitete Id kollidierte programmübergreifend.** Die
Kollisionsmenge kam aus `listSchemas(idb, programmId)` — den Quellen des AKTIVEN Programms —,
geschrieben wird per `putSchema` in den GLOBALEN `csv_schemas`-Store. Eine echte Quelle
„Bewilligungsdetails" in einem zweiten Programm wurde beim Klick vom Demo-Klon ersetzt: Mapping,
Priorität, `file_checksum` weg, `programm_id` auf das Default-Programm gesprungen, die Quelle aus
ihrem Programm verschwunden — und der Klon trug keine `fixture-real-*`-Id mehr, fiel also durch jede
Fixture-Prüfung. `listAllSchemas` liefert die Kollisionsmenge jetzt global.

## Was ein Dialog hinterlässt (v4.25.0)

Vier Stellen, an denen ein Kurations-Klick weniger tat, als er zusagte.

- **„Quelle löschen" räumt auf** ([quelle-entfernen.ts](../../src/plugins/csv-sources-kuration/services/quelle-entfernen.ts)).
  `removeSchema` löschte nur den IDB-Record — direkt danach stimmte die Zusage „Importierte Anträge
  bleiben". Beim nächsten Import einer ANDEREN Quelle baute `recomputeAntragIntoBatch` jeden
  BERÜHRTEN Antrag aus den verbliebenen Schemas neu auf und strich die Felder der gelöschten Quelle:
  dasselbe Feld war danach bei einem Teil der Anträge gefüllt und beim Rest leer, und der Riss
  wanderte mit jedem Nacht-Export weiter — publiziert wurde er mit. Jetzt fallen Row-Hashes und
  Anträge sofort, nach derselben Löschregel wie beim Import; der Bestätigungstext sagt das auch.
- **Ein abgebrochenes Re-Mapping nimmt sein Schema zurück**
  ([RemapCsvColumnsDialog](../../src/plugins/csv-sources-kuration/RemapCsvColumnsDialog.tsx),
  [CsvAddColumnsDialog](../../src/plugins/csv-sources-kuration/CsvAddColumnsDialog.tsx)). Beide
  speichern das neue Mapping VOR dem Import (der Importer braucht es). Der Abbruch ist bis in die
  Diff-Phase angeboten und passiert auch beim Unmount — danach trug das Schema das neue Mapping,
  Anträge und Row-Hashes das alte, und der Dialog meldete „Keine Änderungen am Datenbestand".
  Repariert wurde das nie: `file_checksum` blieb unangetastet, der tägliche Check meldete
  `up_to_date`.
- **Der Auto-Adopt überschreibt keine frisch gepflegte Spalte**
  ([new-column-mapping.ts](../../src/plugins/csv-sources-kuration/services/new-column-mapping.ts)).
  Der Banner hält seine Schema-Objekte als Momentaufnahme und kein Kurations-Dialog bumpt das
  Quellen-Signal; mappte der Kurator zwischenzeitlich eine Spalte und klickte danach den noch
  stehenden Banner, legte `adoptNewColumnsAsIgnored` `{ignore:true}` über die eben gepflegte
  Zuordnung — und die Spalte wurde ab dann bei jedem Import verworfen, ohne jede Meldung.
- **Auch Dialog-Importe journalisieren.** `handleAutoUpdate` löst den Re-Import über GENAU die
  Nacht-Export-Datei aus, die sonst `runAutoRefresh` verarbeitet — aber ohne `onRows`. Der Export
  wurde gemergt und gestempelt, ab da meldete `decideSourceUpdateState` `up_to_date`, und er wurde
  **nie** journalisiert: der Journal-Stand blieb auf dem Vorgänger, der nächste Auto-Refresh diffte
  über zwei Generationen, und die Änderungen des übersprungenen Tages waren endgültig weg. Der
  Remap-Dialog bleibt bewusst aussen vor — er liest die UTF-8-Kopie vom Share, nicht den Export.

## Der Rest der Bug-Jagd (v4.27.0)

Die letzten neun Befunde. Zwei davon ändern das Verhalten spürbar:

- **Der Typ gehört in den Row-Hash** ([hash.ts](../../src/core/services/csv/hash.ts)). `detectFieldType`
  rät bei leeren Preview-Zellen `'string'`, und die `D_*`-Spalten der C16-Exporte sind in den ersten
  Zeilen fast alle leer (`sample_9097_AnB`: 11 solcher Spalten). Korrigierte der Kurator den Typ auf
  `'date'`, lief `importCsvSource(force:true)` durch, ohne eine einzige Zeile als geändert zu sehen:
  `coerceValue` wurde nie erneut angewandt, im Antrag blieb „30.06.2028" stehen — während Filter-Engine
  und Spalten-Inventar den deklarierten Typ glaubten und der Dialog Vollzug meldete. **Einmaliger
  Preis**: der erste Import nach dem Update sieht jede Zeile als „geändert" und rechnet einen
  Voll-Merge; danach wieder normal.
- **Der Seed rührt einen belegten Suchindex nicht mehr an**
  ([seed-data.ts](../../src/core/services/seed/seed-data.ts)). Das Bestands-Gate stand hinter
  `createOramaDB` — der Fixture-Import wurde korrekt übersprungen, die geladene Orama-DB aber vorher
  schon durch eine leere ersetzt und persistiert. Gemessen: Chunk-Marker 10 → 0, `getDocCount` 8 → 3,
  `loadIndexFromFileServer()` danach `false`. Der Knopf war dauerhaft sichtbar, weil
  [IndexManager](../../src/plugins/kurator/IndexManager.tsx) den ALTEN Flag `seed-complete` las,
  während der Seed `seed-complete-v2` schreibt.

Die übrigen sieben:

- **`file_checksum` beschreibt wieder die verknüpfte Exportdatei**: der Remap-Dialog reicht die
  UTF-8-normalisierte Share-Kopie als Blob herein, deren SHA bei jeder windows-1252-/BOM-Quelle
  abweicht — gestempelt wird der Checksum jetzt nur noch für ein echtes `File`, wie die
  Baseline-Felder daneben.
- **Ein Abbruch während „Parse CSV…" ersetzt die Share-Kopie nicht mehr**: die Schranke steht jetzt
  VOR `saveCsvSourceFile`. Vorher trug die Kopie den neuen Export, während Row-Hashes und Anträge den
  alten beschrieben — und der nächste Import einer ANDEREN Quelle mischte beide Stände.
- **Der Wizard löst die bisherige Master-Quelle wirklich ab** (Step 1 sagt es zu; geschrieben wurde
  bisher nur der neue Record, das Programm trug danach zwei Master und `findMasterSchema` nahm den
  id-alphabetisch ersten).
- **Der Schema-Konfig-Import lässt den `join_key` eines Masters stehen** — sonst entstand ein Master
  mit fremdem Join, und neue Anträge entstanden nie mehr.
- **`isListViewProjectionCurrent` prüft auch die Schema-Signatur** — sie existiert genau deshalb, weil
  der Code-Marker Mapping- und Katalog-Änderungen nicht sieht.
- **Die vier Dialog-Importe nehmen das Daten-Mutations-Gate** (bisher nur den Build-Lock — die
  gefährliche Gegenseite `runDataUpdate` nimmt keinen Build-Lock und wird nur vom Gate serialisiert).
- **Vier UI-Zusagen stimmen wieder**: bei zwei Quellspalten auf demselben Standardfeld entscheidet die
  Reihenfolge im **Mapping**, nicht die in der CSV — und neu übernommene Spalten hängen sich ans Ende,
  gewinnen also.

## Verbund-Aggregation (Forschungs-Domäne)

Ein **Verbund** bündelt mehrere Teilanträge unter einer gemeinsamen Projektbeschreibung. Der CSV-Master-Import erkennt Verbünde über das Akronym + Teilantragsindex und dedupliziert geteilte Dokumente per Content-Hash. Anzeige in der Antrags-Liste: Teilvorhaben werden visuell unter dem Verbund-Header geclustert (siehe `src/plugins/antraege/` Cluster-Komponenten).

## Verwandte Cheatsheets

- [add-csv-field.md](../agents/add-csv-field.md) — Neues `CanonicalField` ergänzen
- [add-csv-field-type.md](../agents/add-csv-field-type.md) — Neuer `FieldType` für Wert-Koerzion
- [add-filter-facet.md](../agents/add-filter-facet.md) — Neue Filter-Facet
