# CSV-Auto-Refresh — täglicher Selbst-Import + Frische-Ampel

Ist-Zustand des Auto-Refresh-Subsystems (v2.143 ff.). Ergänzt den [CSV-Import-Wizard](csv-import.md)
(die manuelle Erstanlage einer Quelle) um den **automatischen Nachzug**: erkennt geänderte Export-Dateien
und importiert sie ohne Wizard-Durchlauf. Orchestrator [auto-refresh.ts](../../src/plugins/csv-sources-kuration/services/auto-refresh.ts)
(~570 LOC), Banner-Hook [useCsvAutoRefreshCheck.ts](../../src/plugins/csv-sources-kuration/hooks/useCsvAutoRefreshCheck.ts),
Fußzeilen-Ampel [CsvFreshnessIndicator.tsx](../../src/components/ui/CsvFreshnessIndicator.tsx) +
[csv-freshness-state.ts](../../src/plugins/csv-sources-kuration/services/csv-freshness-state.ts).

## Gates & Trigger

Der Background-Check (`useCsvAutoRefreshCheck`) läuft, sobald **alle** Vorbedingungen erfüllt sind:

- **Flag**: `features.kuratorMenus` (Kurator-Banner) **oder** `features.csvAutoRefresh` (pl-Banner ohne Session).
  Im Kurator-Modus ist zusätzlich eine aktive **Kurator-Session** Vorbedingung; im reinen `csvAutoRefresh`-Modus (pl) nicht.
- **SMB online** + Start-Datenaktualisierung (`runDataUpdate`) auf `'done'` — sonst würde der Banner parallel zum
  laufenden Start-Auto-Import „X Quellen haben neue Daten" zeigen. Pro Session/Mount einmal (`checkedRef`);
  Re-Check bei Snapshot-Sync-Signal (Cold-Start: Schemas kamen erst nach dem Erst-Check in die IDB) oder Ordner-Verknüpfen.

## `collectCandidates` — sechs Buckets (still-Übersprungenes sichtbar)

Pro Quelle entscheidet `checkSourceForUpdate` (mtime + Größen-Guard `last_file_size` + autoritativer
`file_checksum`, weil mtime über SMB/Citrix unzuverlässig ist — v2.137.1). Ergebnis in sechs sichtbaren Buckets:

| Bucket | Bedeutung |
|---|---|
| `candidates` | neuerer Export → bereit zum Auto-Update |
| `permissionNeeded` | Handle/Permission neu zu erteilen |
| `unlinked` | Schema per Snapshot da, aber nie eine Datei gepickt (pl) → `linkSource`/`linkFolder` |
| `fixtures` | `fixture-real-*`-Quellen — **hart ausgeschlossen**; in prod ein Fehlkonfigurations-**Signal** (der 2026-06-Vorfall: echte Exporte werden nie importiert). Bewusst sichtbar statt still verworfen |
| `fileMissing` | verknüpfte Datei nicht (mehr) erreichbar |
| `upToDate` | unverändert (Fast-Path/Checksum) — für die Diagnose „warum 0 importiert" (Citrix-False-Negative landet hier) |

Der **erzwungene Re-Check** (`collectCandidates(idb, { forceRecheck })`) umgeht den mtime-Fast-Path — nötig,
wenn eine Inhaltsänderung ohne mtime-Bump vorlag (dev/kurator, v2.155/v2.156.1).

## `runAutoRefresh` — sequenzielle Pipeline

Pro Kandidat: Datei via gespeichertem Handle laden (kein Picker) → Header gegen Schema validieren →
`importCsvSource()` → `source_last_modified`/`source_file_name`/`last_file_size` im Schema nachziehen. Dazu:

> **Warum die Drift-Stufen so scharf getrennt sind.** Am 12.08.2026 hingen alle drei Quellen der lokalen
> Share-Kopie an „Spalten-Drift" — gemeldet wurden je 2–15 fehlende **und** ebenso viele neue Spalten.
> Tatsächlich war es dieselbe Spalte zweimal: der Export hatte auf UTF-8 gewechselt, `Nachrücker` las sich
> als `NachrÃ¼cker`. Ein „einfach trotzdem importieren" hätte hier nicht Felder geleert, sondern **jeden
> Umlaut im ganzen Bestand verstümmelt**. Darum heilt Stufe 1 zuerst, und Stufe 3 nennt beim Übergehen die
> Spalten und die Folge beim Namen.

- **Drift-Behandlung** — die Regel steht rein in [`entscheideDrift`](../../src/plugins/csv-sources-kuration/services/csv-drift-check.ts),
  der Orchestrator führt sie nur aus. Drei Stufen:
  1. **Encoding-Heilung zuerst** (v3.47.0): Wechselt ein Export von `windows-1252` auf UTF-8 (oder zurück),
     lesen sich alle Umlaut-Spalten falsch — `Nachrücker` steht als **fehlend** UND `NachrÃ¼cker` als
     **neu** in derselben Validierung. Das sieht aus wie „Spalten verschwunden", ist aber ein Lesefehler;
     ein Import mit dem falschen Encoding verstümmelte auch jeden **Wert**. Bei Drift wird die Datei
     deshalb einmal ohne erzwungenes Encoding gelesen (`parseCsvPreview` ohne `encoding` → Auto-Erkennung,
     UTF-8 mit `fatal:true` + Mojibake-Heuristik) und neu validiert. Übernommen wird nur, wenn danach
     **keine** Schema-Spalte mehr fehlt (`encodingHeilungTraegt`) — „etwas besser" reicht nicht. Dann geht
     das erkannte Encoding **vor** dem Import ins Schema (`csv_schema_encoding_korrigiert`), damit
     `importCsvSource` es über `loadSchema` selbst aufgreift. Der Re-Import-Dialog konnte das seit je,
     der automatische Weg nicht — dort war es eine Sackgasse.
  2. **Reine `newColumns`-Drift** (nichts fehlt, nur Zusatzspalten) wird **headless** als `{ ignore: true }`
     adoptiert (`adoptNewColumnsAsIgnored`) und importiert weiter — der tägliche Import blockiert nicht (v2.153.1).
  3. **`missingFromCsv > 0`** bleibt **blockierend** (`report.drift` → Modal), weil eine verschwundene
     gemappte Spalte echte Felder leert: der Merge baut jeden Antrag komplett neu aus allen CSVs auf
     ([batched.ts](../../src/core/services/csv/merger/batched.ts)), ein fehlender Wert wird also `''`.
     **Ausweg** (v3.47.0): `RunAutoRefreshOptions.driftAkzeptiertFuer` — der Knopf **„Trotzdem
     importieren"** im Drift-Bericht, pro Quelle. Der Bericht zeigt dafür die Spaltennamen, nicht nur
     Zähler, und benennt die Folge; die Zustimmung wird als `csv_auto_refresh_drift_akzeptiert`
     protokolliert und **nicht gespeichert** (ein persistiertes „immer ignorieren" wiederholte den
     Verlust ab dann unbemerkt). Nach dem Import ist die Quelle gestempelt und fällt aus den Kandidaten;
     ein neuer Export mit derselben Lücke fragt wieder. Der Nachlauf baut seine Kandidaten frisch aus den
     Schema-Ids und ist damit unabhängig davon, welcher Lauf den Bericht erzeugt hat (Banner-Lauf oder
     kombinierter Start-Lauf in [DataUpdateBanners](../../src/plugins/csv-sources-kuration/components/DataUpdateBanners.tsx)).
- **EIN Lock je Lauf** (v3.46.1): `runAutoRefresh` nimmt den Build-Lock **einmal** vor der Schleife und hält
  ihn über alle Quellen **plus** den Snapshot-Write; `importCsvSource` bekommt `lockHeldByCaller: true` und
  fasst weder Lock noch Heartbeat an. Vorher lockte jede Quelle selbst — und in jedem Freigabe-Fenster
  dazwischen konnte ein noch laufender Heartbeat-Schlag die gelöschte Lock-Datei neu anlegen, sodass die
  nächste Quelle gegen den **eigenen** Nachhall lief (Pitfall #52,
  [recurring-bug-classes #19](recurring-bug-classes.md)).
- **Gebündelter Snapshot-Write**: bei N Quellen wird der (sekundenlange) Snapshot **einmal pro betroffenem
  Programm** nach dem Batch geschrieben (`deferSnapshotWrite`, v2.96.2) — unter dem Lauf-Lock, ohne eigenen
  Acquire (der frühere `forceLock`-Notbehelf dort ist mit v3.46.1 entfallen);
  **Auslöser ist nicht nur ein Zeilen-Delta**: auch eine reine SCHEMA-Änderung (korrigiertes Encoding,
  adoptierte Zusatzspalte) publiziert (v3.47.0). Vorher wuchs `programmeToPublish` allein bei Deltas — ein
  Export, der nur seine Kodierung wechselt, ist inhaltlich identisch (`unchanged`), also blieb die Korrektur
  lokal, während der Snapshot die alte Schema-Kopie weitertrug. Jeder andere Rechner holte sie sich beim
  Sync zurück und heilte erneut: selbstkorrigierend, aber endlos. Gemessen am 12.08.2026 auf der lokalen
  Kopie — Schema-Dateien auf `UTF-8`, `csv_schemas.jsonl` im Snapshot noch auf `windows-1252`;
  Delta-Snapshots wenn `isDeltaSnapshotWriteEnabled()`. `onAfterMerge` aktualisiert den lokalen Store **vor**
  dem Publish (der lokale User sieht neue Anträge sofort, v2.96.3).
- **Lock-Konflikt**: hält ein anderer Schreiber den Build-Lock → `BuildLockBusyError` bricht den Lauf ab,
  **bevor** die erste Quelle importiert (und damit `source_last_modified` gestempelt) ist — es bleiben keine
  gemergten, aber unpublizierten Quellen liegen. `besitz` trennt drei Fälle, der Banner formuliert danach
  (`beschreibeLockKonflikt`): `fremd` („X aktualisiert seit Y Min"), `gleicher-name` (anderes Fenster desselben
  Menschen) und `eigener-tab` (eigenes Überbleibsel — läuft von selbst ab). „Trotzdem aktualisieren" =
  `forceRefresh`; beim eigenen Überbleibsel ohne Rückfrage.
- **`skippedInactiveUnterprogramm`**: aufsummierte Zeilen, die der Master-Import wegen inaktivem/unbekanntem
  Unterprogramm-Code verwarf. `>0` heißt: die Unterprogramm-Allowlist greift und schluckt Anträge — bei
  leerem `unterprogramme`-Store der stille Datenverlust (Prod-Vorfall 2026-07, v2.156). Sichtbar für Diagnose.

## Publish-Guard: Mengen-Plausibilität für `antraege` (v4.9.0)

`PUBLISH_PRESERVE_WHEN_EMPTY` schützt nur die kleinen Struktur-Stores — die Schleife in
[snapshot.ts](../../src/core/services/csv/snapshot.ts) überspringt `antraege` per `continue`, und der
Voll-Write streamt, was lokal in der IDB steht. Dort endete jede Ursache, die den lokalen Bestand
schrumpfen ließ (siehe [csv-import.md](csv-import.md)): der Schwund ging kommentarlos auf den Share und
von dort an jeden anderen Rechner. `last_row_count` existiert seit je, wird aber nirgends **verglichen**
— nur angezeigt.

`pruefeAntraegeSchwund` ist bewusst **kein** Leer-Verbot, sondern eine Schwelle: ab **20** Anträgen auf
dem Share bricht der Publish ab, wenn lokal weniger als die **Hälfte** davon übrig ist. Er greift in
beiden Pfaden — im Voll-Write gegen `existingManifest.stores.antraege.count`, im Delta-Write gegen
`baseCount − removedKeys.length` (dort steht die Löschung explizit, der Voll-Write-Guard sieht sie nie).
Beide prüfen **vor** dem ersten Byte, es bleiben also keine halben Dateien liegen.

Grenzen, bewusst: der Guard fängt den katastrophalen Fall, nicht den schleichenden — ein Verlust von
weniger als der Hälfte passiert ihn. Und er ist **still**: beide Aufrufer verschlucken den Publish-Fehler
(`importCsvSource` und der gebündelte Batch-Write protokollieren `snapshot_failed` mit der vollen
Meldung ins Audit-Log, melden dem Nutzer aber weiter Erfolg). Der Share ist geschützt, die Meldung fehlt.

Seit v4.11.0 kommt der Publish-Guard seltener zum Zug: eine Zeile, die aus **einer** Quelle fällt,
löscht den Antrag nicht mehr, solange eine andere ihn trägt (siehe
[csv-import.md](csv-import.md#gelöscht-wird-erst-wenn-der-antrag-in-allen-quellen-weg-ist-v4110)).
`RefreshReport.heldRemovals` summiert diese Rückhalte über alle Quellen des Laufs und steht im
`[data-update]`-Log als `zurueckgehalteneLoeschungen=…`. Der Guard bleibt die letzte Instanz für den
Fall, dass ein Schwund **alle** Quellen gleichzeitig trifft.

## Frische-Ampel „● CSV" (`deriveCsvFreshnessState`)

Reine, getestete Entscheidungslogik für den Fußzeilen-Punkt: `fresh` (grün) nur, wenn **erreichbare** Quellen
(`totalSchemas − permissionNeeded − unlinked`) existieren **und** kein `candidates`/keine Fehlkonfiguration
vorliegt; sonst `stale`; sonst `unknown`. **`misconfig`** (prod-Fixtures **oder** `fileMissing`) erzwingt einen
nicht-grünen Punkt — der Kernschutz gegen „läuft durch, ohne dass etwas ankommt". Fixtures zählen nur in prod
(`!isDevFixturesEnabled()`) als Fehlkonfiguration.

## Projektions-Rebuild bei Mapping-Nachzug (`list-view-migration.ts`)

Die Home-Liste liest die Slim-Projektion `ANTRAEGE_LIST_VIEW`, nicht den Voll-Store. Zwei Rebuild-Achsen
([list-view-migration.ts](../../src/core/services/csv/list-view-migration.ts)):

1. **Code-Versions-Marker** `LIST_VIEW_PROJECTION_VERSION` (aktuell **5**) — bumpt, wenn `toAntragListItem`
   neue Felder projiziert.
2. **Schema-Signatur** (`computeStatusDatumSchemaSig`, v2.158.2) — deterministischer Hash der aus **allen**
   Programm-Schemas aufgelösten FB/PC-Status-Datum-Felder (`code>feld#label`).

**Warum die Signatur nötig ist:** Wird eine FB/PC-Spalte **nachträglich** gemappt (bei gleichem Code-Marker und
unveränderten Rohdaten), ändert das **keinen** Antrag-Record → weder der Count-Backfill noch der inkrementelle
Snapshot-Diff bauen die Projektion neu, der Code-Marker bleibt gleich → die Spalten blieben für den Altbestand
dauerhaft leer (Vorfall 2026-07). Bei geänderter Signatur erzwingt der Boot-Guard einen Voll-Rebuild. Eine
**fehlende** Signatur (Bestand vor v2.158.2) erzwingt **keinen** Rebuild (das übernahm der v4→v5-Bump), sie wird
lazy nachgetragen. → Verallgemeinert als [recurring-bug-classes.md](recurring-bug-classes.md) **Klasse 9**.
