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

## Lokaler Import-Stempel + Divergenz-Warnung (v6.37.0)

> **Der Produktiv-Fall (Sept. 2026).** Fünf pl-Rechner am echten Share, kurz nach dem Umzug von
> App- und Share-Pfad: bei **jedem** Start importierte die App alle drei Quellen neu, obwohl die
> Exporte nur einmal nachts entstehen, und publizierte danach — jeder andere Rechner bekam
> „Neuer Datenbestand", holte den Stand und importierte beim nächsten Start selbst wieder. Die
> Konsole eines pl-Rechners zeigte den Mechanismus in einer Zeile: `[snapshot-sync] antraege
> delta … applied=6` (fremden Stand geholt), direkt danach `csv … imported=3 … upToDate=0`, drei
> Merges mit `touched=1094 / 824 / 903`, `snapshotWrite=25235ms` — und im selben Lauf
> `[journal] uebersprungen` für den Master, der Export war dem Journal also längst bekannt.

**Warum das eine Kette war.** Alles, woran die App „schon importiert" erkannte, lag im **Schema**
(`source_last_modified` / `last_file_size` / `file_checksum`) und in `csv_row_hashes` — beides
Stores, die `writeSmallStores` bei jedem Voll- **und** Delta-Publish neu schreibt und der Leser bei
Hash-Abweichung komplett ersetzt. Der Stempel beschreibt damit immer die Datei-Sicht **des
zuletzt publizierenden Rechners**. Sehen zwei Rechner die Quelle verschieden (andere Kopie, andere
Kodierung — die App-eigene UTF-8-Kopie unter `programm/antraege/imports`, 18.08.2026 —, ein anderer
Ordner nach dem Umzug, Citrix-mtime), gilt für B nach A's Publish die eigene, längst importierte
Datei wieder als neu; B importiert, findet gegen A's Row-Hashes „Änderungen", publiziert; A's
Stempel sind ersetzt, A importiert beim nächsten Start … Der Encoding-Sonderfall war seit v4.102.1
bekannt, die Klasse dahinter nicht ([recurring-bug-classes #26](recurring-bug-classes.md)).

**Lokaler Import-Stempel** ([lokaler-stempel.ts](../../src/core/services/csv/lokaler-stempel.ts), kv-Key
`csv-source-lokal-stempel`, `Record<schemaId, {fileName, lastModified, size, checksum, importedAt}>`):
„DIESER Rechner hat DIESE Datei verarbeitet" — maschine-lokal wie die Filemap, nie im Snapshot, von
keinem Sync ersetzt. **Ein** Schreibpunkt: `importCsvSource`, im vollen Pfad und im Checksum-Skip
(beide nur für echte `File`s). `decideSourceUpdateState` fragt ihn **vor** dem Team-Stempel (billig
per mtime + Größe, sonst per Checksum; die Datei wird höchstens einmal gehasht und gegen beide
Belege gehalten); `up_to_date` trägt `quelle: 'lokal' | 'team'`. Bestätigt der Team-Checksum die
Datei, merkt `checkSourceForUpdate` sie zusätzlich lokal (`merkeBestaetigteDatei`) — der nächste
Start nimmt den billigen Pfad, und ein später hereingesyncter fremder Stempel macht sie nicht wieder
zur Kandidatin. Wirkung: ein Rechner importiert eine gegebene Datei höchstens einmal; die Kette
braucht den Re-Import des jeweils anderen, und der bleibt aus. `forceRecheck` übergeht wie bisher alles.

**Divergenz-Warnung** ([csv-quell-divergenz.ts](../../src/plugins/csv-sources-kuration/services/csv-quell-divergenz.ts)):
nach jedem Import hält `laufeKandidatenAb` die eigene Datei-Sicht gegen den Team-Stempel, den
`candidate.schema` VOR dem Import trug. Team-Checksum vorhanden und ungleich, `|Δ mtime| <
DIVERGENZ_FENSTER_MS` (6 h — Exporte liegen ≥ 24 h auseinander, das Fenster verträgt
SMB-/Citrix-Versatz) **und** der Import hat Zeilen geändert ⇒ zwei Rechner lesen verschiedene
Kopien desselben Exports. Bewusst eine **Warnung, kein Block** (Entscheidung 08.09.2026): welche
Sicht die richtige ist, weiß nur der Mensch, und die Schleife stoppt der lokale Stempel ohnehin.
Sie steht in `RefreshReport.divergenzen`, im Banner („⚠ N Quelle(n) mit abweichender Datei"), im
Drift-Dialog (Team-Datei mit Größe, Datum, Urheber `source_stamped_by` neben der eigenen) und als
Audit-Eintrag `csv_quelle_divergenz`. Ohne Zeilen-Änderung ist es keine Divergenz, sondern nur ein
veralteter Stempel; mit einem Team-Stempel aus der Vornacht der normale Tages-Export.

**Veraltete Datei = Block** (v6.37.1, `istVeralteteDatei`): das Produktiv-Audit-Log vom 08.09.2026 nannte
den Verursacher — ein Laptop, auf dem für Dev-Zwecke ein anderer CSV-Ordner eingestellt war (Exporte
vom 21./23.08., 7 945 statt 8 011 Zeilen), lief an diesem Tag gegen den echten Share. Dreimal
importierte er die alten Dateien über den aktuellen Stand (`changed 1028, heldRemovals 66`), dreimal
drehte der nächste Kollege ihn wieder vor (`new 66, changed 1028`). Die 6-h-Divergenz greift hier
nicht, die Dateien liegen 18 Tage auseinander — in die **falsche** Richtung. Regel: ist die eigene
Datei um mindestens einen Export-Zyklus (`VERALTET_SCHWELLE_MS` = 24 h) **älter** als der
Team-Stempel und nicht byte-gleich, wird sie **nicht importiert** und nicht gestempelt (der nächste
Lauf meldet dieselbe Lage wieder); `RefreshReport.veraltet`, Audit `csv_quelle_veraltet`, Dialog mit
beiden Dateien und „Trotzdem importieren" (dieselbe `driftAkzeptiertFuer`-Zustimmung wie bei
Drift). Anders als die Divergenz derselben Nacht bewusst ein Block: eine ältere Datei über einen
neueren Stand zu legen ist nie richtig, egal welcher Rechner recht hat.

**Der Start-Bericht erreicht den Banner** ([start-bericht.ts](../../src/plugins/csv-sources-kuration/services/start-bericht.ts)):
der Start-Pass in App.tsx zeigte sein CSV-Ergebnis nur als 6-Sekunden-Toast; eine Divergenz oder
ein Fehler aus genau diesem Lauf erreichte niemanden (die Quelle ist gestempelt, also kein Kandidat,
und `useCsvAutoRefreshCheck.report` füllt nur der eigene Lauf). Jetzt legt App.tsx den Bericht in
einem Übergabefach ab — nur wenn `berichtZeigenswert` (Divergenz, Drift, Fehler, übergangene
Spalten, Encoding-Korrektur) —, der Hook holt ihn ab und zeigt ihn wie einen eigenen Lauf.
`DataUpdateBanners.runCombined` nutzt dieselbe Regel.

**Diagnose ohne IDB-Dump.** `csv_auto_refresh_started` trägt je Kandidat `grund`
(`keine-baseline` | `checksum` | `checksum-unlesbar` | `erzwungen`), die eigene Datei
(Name/mtime/Größe) und den Team-Stempel; `csv_source_auto_updated` zusätzlich `size` + `checksum`;
die `[data-update]`-Zeile und `teamflow_last_data_update_timing` führen `changed= errors=
divergenz=`. Der Kopie-Ordner-Guard (`istEigenerKopieOrdner`) steht nicht mehr nur in der Konsole,
sondern als `CollectResult.quellordnerIstKopie` im Banner.

Erstdiagnose am Share, wenn Importe sich wiederholen (PowerShell, Pfad anpassen):

```powershell
Select-String -Path '<share>\_intern\audit-log.jsonl' -Pattern '"action":"(csv_auto_refresh_started|csv_source_auto_updated|csv_import"|csv_quelle_divergenz|snapshot_written|csv_schema_encoding_korrigiert|csv_quellordner_ist_kopieordner)' | Select-Object -Last 60 | ForEach-Object { $_.Line }
```

Lesart: stempeln zwei Nutzer für dieselbe Quelle am selben Tag verschiedene `fileName`/`size`/`checksum`,
lesen sie verschiedene Dateien; `csv_import` mit `changed≈1000` auf unverändertem Export ist die
Row-Hash-Divergenz; abwechselnde `csv_schema_encoding_korrigiert` sind die UTF-8-Kopie.

Und auf einem einzelnen pl-Rechner, in der Browser-Konsole der laufenden App (nur lesend; DB-Name je
Variante, pl = `teamflow-zah-pl`): je Quelle Team-Stempel, lokaler Beleg und die tatsächlich
verknüpfte Datei nebeneinander — `gleich: false` heißt, dieser Rechner liest eine andere Datei als
der letzte Publizierer.

```js
(async () => {
  const db = await new Promise((res, rej) => { const r = indexedDB.open('teamflow-zah-pl'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const get = (store, key) => new Promise((res, rej) => { const q = db.transaction(store).objectStore(store).get(key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  const all = store => new Promise((res, rej) => { const q = db.transaction(store).objectStore(store).getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  const sha1 = async f => [...new Uint8Array(await crypto.subtle.digest('SHA-1', await f.arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join('');
  const dir = await get('kv', 'csv-source-dir-handle');
  const filemap = (await get('kv', 'csv-source-dir-filemap')) ?? {};
  const lokal = (await get('kv', 'csv-source-lokal-stempel')) ?? {};
  const zeilen = [];
  for (const s of await all('csv_schemas')) {
    const name = s.source_file_name ?? filemap[s.id];
    let datei = null;
    try { if (dir && name) { const f = await (await dir.getFileHandle(name)).getFile(); datei = { name: f.name, mtime: new Date(f.lastModified).toISOString(), size: f.size, sha1: await sha1(f) }; } }
    catch (e) { datei = { fehler: String(e) }; }
    zeilen.push({ quelle: s.id, teamSha: s.file_checksum?.slice(0, 8), dateiSha: datei?.sha1?.slice(0, 8), gleich: s.file_checksum === datei?.sha1,
      teamSize: s.last_file_size, dateiSize: datei?.size, teamMtime: s.source_last_modified ? new Date(s.source_last_modified).toISOString() : null,
      dateiMtime: datei?.mtime, von: s.source_stamped_by ?? null, lokalerBeleg: lokal[s.id]?.checksum?.slice(0, 8) ?? null,
      ordnerVerknuepft: !!dir, fehler: datei?.fehler });
  }
  db.close();
  console.table(zeilen);
  return zeilen;
})();
```

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

     > **Wenn die Heilung sich WIEDERHOLT, ist nicht der Export schuld.** Eine echte
     > Kodierungs-Umstellung passiert einmal. Kippt das `encoding` bei jedem Start,
     > lesen **zwei Instanzen denselben Schema-Record, aber zwei verschiedene Dateien**.
     > Gemessen am 18.08.2026 auf der Entwickler-Maschine: `zah-pl` las den echten Export
     > (`…\Täglicher Export\7737_Bgl.csv`, windows-1252), `dev:local` den Ordner
     > `…\ZAH\programm\antraege\imports` — also die App-**eigene**, nach UTF-8 normalisierte
     > Kopie aus `saveCsvSourceFile` (`CSV_SOURCES_SUBDIR`). Beide stempeln mtime/Größe/
     > Checksum/Encoding in dasselbe Schema und publizieren es; jeder Start fand die
     > Baseline des anderen vor, meldete „neuer Export", importierte voll (`buckets:
     > {new:0, changed:0, removed:0}`) und schrieb einen 0-Byte-Delta-Snapshot. Bilanz:
     > 195× `csv_schema_encoding_korrigiert`, streng abwechselnd, ohne eine einzige
     > inhaltliche Änderung.
     >
     > **Erstdiagnose** (das Audit-Log auf dem Share trägt es vollständig):
     > `grep '"action":"csv_schema_encoding_korrigiert"' _intern/audit-log.jsonl | tail -20`
     > — stehen dort abwechselnde Richtungen und **verschiedene** `user`, ist es dieser Fall;
     > die begleitenden `csv_source_auto_updated`-Zeilen nennen die jeweils gestempelte Datei.
     > Der Quellordner-Guard (`istEigenerKopieOrdner`, einmal je Lauf in `collectCandidates`)
     > meldet den Ordner-Fall seither von selbst — als `console.warn` + Audit-Eintrag
     > `csv_quellordner_ist_kopieordner`, ohne den Lauf abzubrechen; der Convention-Test
     > `csv-quellordner-nicht-kopieordner` hält die Configs davon frei.
  2. **Mehrdeutige Aliasgruppe** (v4.20.0) blockiert **härter als alles andere** — sie ist die einzige
     Stufe, die auch „Trotzdem importieren" nicht aufhebt. C16 kürzt Spaltenköpfe auf 10 Zeichen, dadurch
     stehen Namen mehrfach im Export (`9052_PrjBsp`: 163 Spalten, 35 mehrfach vergebene Namen, 72 betroffene
     Spalten); PapaParse benennt jedes weitere Vorkommen **positionsabhängig** in `<Name>_1`, `_2` um, und
     genau dieser synthetische Name ist der Mapping-Schlüssel. Ändert sich die **Größe** einer solchen
     Gruppe, verschiebt sich jeder Alias dahinter: eine neue gleichnamige Spalte vor dem bisherigen zweiten
     Vorkommen macht die echte Spalte zu `_2` — bisher „neue Spalte", headless als `{ ignore: true }`
     adoptiert, und das Feld las ab dann still aus der falschen Spalte. `validateHeaders` vergleicht deshalb
     die Gruppengrößen (`aliasGruppen`) und meldet `mehrdeutigeSpalten`. Warum keine Zustimmung hilft:
     „Trotzdem importieren" heißt „diese Felder bleiben leer" — hier wären sie **falsch belegt**, über den
     ganzen Bestand und ohne Spur. Ausweg ist „Spalten neu zuordnen" (baut das Mapping gegen die aktuelle
     Kopfzeile). **Grenze, offen benannt**: tauschen zwei gleichnamige Spalten die Plätze, ist die Kopfzeile
     byte-identisch — das kann kein Header-Vergleich sehen, nur ein Blick in die Werte.
  3. **Reine `newColumns`-Drift** (nichts fehlt, keine Mehrdeutigkeit, nur Zusatzspalten) wird **headless**
     als `{ ignore: true }` adoptiert (`adoptNewColumnsAsIgnored`) und importiert weiter — der tägliche
     Import blockiert nicht (v2.153.1).
  4. **`missingFromCsv > 0`** bleibt **blockierend** (`report.drift` → Modal), weil eine verschwundene
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

Grenze, bewusst: der Guard fängt den katastrophalen Fall, nicht den schleichenden — ein Verlust von
weniger als der Hälfte passiert ihn.

**Seit v4.18.0 ist der Abbruch nicht mehr still.** Beide Aufrufer protokollieren `snapshot_failed`
weiterhin ins Audit-Log, reichen die Meldung aber zusätzlich nach oben: `importCsvSource` als
`ImportResult.publishError` (der Wizard titelt dann „Import lokal abgeschlossen" und nennt den Grund),
der gebündelte Batch-Write als Eintrag in `report.errors` — und damit in die Fehler-Zahl des Banners
und in den Drift-Dialog. Vorher war der Share geschützt und der Kurator ahnungslos: die Daten lagen
lokal, das Team sah sie nie.

Seit v4.11.0 kommt der Publish-Guard seltener zum Zug: eine Zeile, die aus **einer** Quelle fällt,
löscht den Antrag nicht mehr, solange eine andere ihn trägt (siehe
[csv-import.md](csv-import.md#gelöscht-wird-erst-wenn-der-antrag-in-allen-quellen-weg-ist-v4110)).
`RefreshReport.heldRemovals` summiert diese Rückhalte über alle Quellen des Laufs und steht im
`[data-update]`-Log als `zurueckgehalteneLoeschungen=…`. Der Guard bleibt die letzte Instanz für den
Fall, dass ein Schwund **alle** Quellen gleichzeitig trifft.

Daneben führt der Bericht seit v4.18.0 `unknownUnterprogramm`: Zeilen mit leerer oder im Katalog
unbekannter Unterprogramm-Zelle — nicht importiert, aber auch nicht gelöscht. Steht im
`[data-update]`-Log als `unbekanntesUP=…`; die Regel dahinter in
[csv-import.md](csv-import.md#gefiltert-heißt-ich-weiß-es-nicht-nicht-gibt-es-nicht-v4180).

## Ein Snapshot gehört EINEM Programm (v4.22.0)

Drei Stellen behandelten den Snapshot, als wäre er der ganze Datenbestand des Rechners.

- **Der Sync fasst nur die Records des eigenen Programms an.** `replaceStore` rief `clear()` auf den
  GANZEN Objekt-Store, während `programme.jsonl` / `csv_schemas.jsonl` per Konstruktion nur die Records
  eines Programms enthalten. Auf einem Rechner mit zwei Programmen (Kurator-Seite „Programme", dev
  zusätzlich `dev-programm`) löschte der Sync von A die CSV-Schemas von B — und weil `listProgramme` B
  danach nicht mehr lieferte, wurde B **nie wieder** gesynct: keine Selbstheilung, auch nicht am
  Folgetag. `keysDesProgramms` ([snapshot-sync.ts](../../src/core/services/csv/snapshot-sync.ts)) löst
  die Zugehörigkeit je Store auf — per `programm_id`-Index (billig, Key-Cursor), über den Key selbst
  (`akronym_index`), oder über die Bezugsmenge des Nachbar-Stores (Historien über ihre Entität,
  Row-Hashes über ihr Schema), genau wie `listAntragHistorieByProgramm` es schon tat.
- **Eine Löschung überlebt das gebündelte Delta.** Der Auto-Refresh vereinigt `touched` und `removed`
  über alle Quellen; ein Aktenzeichen, das Quelle 1 als geändert meldete und der danach importierte
  Master gelöscht hat, fiel durch beide Raster (aus `removedKeys` gefiltert, mangels Record auch nicht
  in `changedRecords`). Der Schreiber zeigte es als gelöscht, jeder andere Rechner behielt die
  Karteileiche bis zur nächsten Compaction. Jetzt entscheidet der **Bestand**: `removedKeys` = alles,
  was der Lauf angefasst hat und danach nicht mehr im Store steht.
- **Ein reiner Demo-Rechner publiziert gar nicht.** Der Fixture-Filter schützte nur `csv_schemas.jsonl`;
  Anträge, Verbünde, Akronyme und Unterprogramme gingen ungefiltert raus (gemessen: Share 500 echte
  Anträge → 70 Demo-Anträge, `csv_schemas` dank Guard korrekt bei 1). Statt jeden Store einzeln zu
  filtern — und dabei Anträge, Verbünde und Akronym-Index auseinanderlaufen zu lassen — erkennt
  `loadSmallStoreData` den **Rechner**: hat das Programm CSV-Quellen und ist nach dem Fixture-Filter
  keine übrig, stammt sein ganzer Bestand aus den gebündelten Beispieldaten. Der Publish bricht ab.

## Was der Lauf meldet — und was er verschwieg (v4.23.0)

Zwei Türen (Fußzeilen-Ampel „● CSV" und Einstellungen → Speicher) bauten ihre Meldung je selbst aus
`processed` und sagten **„Bereits aktuell."** für drei sehr verschiedene Lagen. Die Regel steht jetzt
einmal in [datenUpdateMeldung.ts](../../src/plugins/csv-sources-kuration/services/datenUpdateMeldung.ts)
und ist ohne React prüfbar:

- **Es lief gar kein Lauf.** Ist das Daten-Mutations-Gate belegt (Start-Pass, Banner-Lauf, Watcher —
  jeweils über Minuten), kehrt `runDataUpdate` sofort mit dem unberührten Initial-Objekt zurück:
  kein Report, kein `lockBusy`, kein Fehler — exakt die Form von „geprüft, nichts gefunden". Das neue
  `DataUpdateResult.nichtGelaufen` macht den Unterschied lesbar. Besonders folgenreich am
  Force-Knopf: der parallele Lauf nutzt gerade den Fast-Path, den `forceRecheck` umgehen soll.
- **Der Lauf hat Quellen abgewiesen.** `report.drift` und `report.errors` blieben ungelesen — der
  Dialog zeigte daneben weiter „Neue Exporte verfügbar", der Punkt blieb rot.
- **Der Snapshot kam unvollständig.** `SyncResult.incomplete` gibt es seit v4.18.0, gelesen hat es
  niemand; jetzt reicht `runDataUpdate` es als `snapshotUnvollstaendig` weiter.

Dazu zwei Stellen, an denen die App etwas behauptete oder tat, was nicht stimmte:

- **Die Ampel wird nach einem Banner-Import neu geprüft.** Der Fußzeilen-Punkt hängt allein am
  Quellen-Signal, und der Banner-Pfad bumpte es nie. Nach einem erfolgreichen Import zeigte das
  Banner „N Quellen aktualisiert", die Ampel daneben blieb den Rest der Sitzung rot mit „Neue
  CSV-Exporte verfügbar" — samt einem „Letzter CSV-Import" von VOR dem Lauf.
- **`republishSnapshot` bricht bei besetztem Lock ab**, statt ihn zu überstempeln. Es war der einzige
  Publish-Pfad des Moduls ohne Rückfrage und ohne Abbruch; das `finally` löschte anschließend die
  Lock-Datei, obwohl der andere Lauf noch schrieb. Der Knopf ist dev-only — der dev-Build erbt aber
  den ECHTEN Team-Share.
- **Der Lock-Konflikt-Text beschreibt den echten Zustand.** `besitz: 'eigener-tab'` heißt „in diesem
  Fenster läuft JETZT ein zweiter Flow", nicht „Überbleibsel aus einem früheren Lauf"; übernommen
  wird nur nach Rückfrage. Und die Zusage „in 2-3 Min erneut versuchen" gilt nur für die
  CSV-Import-Stufe (3 Min) — jede andere verfällt erst nach 2 Stunden, allen voran der
  ~47-minütige Embedding-Build.

## Jede Tür zeigt ihren Lauf (v4.58.0)

`runDataUpdate` bietet seit je einen Fortschritts-Kanal (`onPhase`: `snapshot` → `csv-check`
→ `csv-import` → `publishing`, mit Quellen-Zähler „Name (2/3)"). Abgefragt hat ihn nur der
Start-Pass ([App.tsx](../../src/core/App.tsx)) und der kombinierte Banner
([DataUpdateBanners.tsx](../../src/plugins/csv-sources-kuration/components/DataUpdateBanners.tsx));
die beiden **manuellen** Türen riefen `runDataUpdate(idb, handle, {})` — leeres
Options-Objekt. Ein Lauf über mehrere Quellen dauert Minuten, und beide zeigten dabei nichts
als einen Knopf, der „Importiere…" hieß. Das liest sich als Hänger, nicht als Arbeit.

- **Fußzeilen-Dialog „● CSV"** ([CsvFreshnessIndicator.tsx](../../src/components/ui/CsvFreshnessIndicator.tsx)):
  Fortschritt steht **im Dialog** — der `Dialog` ist ein Overlay (`z-[80]`, `bg-black/40`),
  der globale `StartupDataUpdateBanner` liegt dahinter und ist verdeckt. Zusätzlich wird der
  Status-Store gefüttert, damit der Banner übernimmt, wenn der Nutzer das Fenster während des
  Laufs schließt (die Aktion läuft weiter, die Komponente bleibt in der Fußzeile gemountet).
  Nach dem Lauf erscheint **„Fertig"** neben dem Ergebnis: der Import-Knopf verschwindet,
  sobald der Status auf `fresh` kippt, und ohne ihn sagte nichts, dass man zumachen kann.
- **Einstellungen → Speicher** ([OrdnerGruppe.tsx](../../src/plugins/einstellungen/daten/OrdnerGruppe.tsx)):
  dort steht kein Overlay im Weg — es genügt, den Status-Store zu füttern, der gemountete
  Banner zeigt Spinner + Balken + Prozent.

Beide drosseln die Schreibe wie der Banner (nur bei Label-/Prozent-Wechsel), sonst löst jeder
feinkörnige `fraction`-Tick ein Re-Render aus.

**Drift ist keine Sackgasse mehr.** `beschreibeDatenUpdate` verwies auf „Details im Banner" —
den Banner-Report füllt aber ausschließlich `useCsvAutoRefreshCheck.doRefresh`. Ein Lauf aus
dem Dialog zeigte den Bericht damit **nirgends**, und „Trotzdem importieren" war unerreichbar.
Der Dialog öffnet den `CsvAutoRefreshDriftDialog` jetzt selbst; `MeldungOptionen.detailsInline`
schaltet den Verweis auf „Details unten" um. Damit das auch trägt, reicht
`RunDataUpdateOptions.driftAkzeptiertFuer` die Zustimmung an `runAutoRefresh` durch — der
Banner-Pfad ruft `runAutoRefresh` direkt und konnte das immer schon.

**„Verarbeitet" ist nicht „geändert".** `RefreshReport.changedAntraege` zählt die inhaltlich
angefassten Anträge (neu + geändert + entfernt, über alle Quellen nach Aktenzeichen
dedupliziert, aus derselben `changeByProgramm`-Basis wie der Delta-Snapshot). Die Meldung sagt
seitdem „2 CSV-Quelle(n) importiert · **keine inhaltlichen Änderungen**" statt eines Satzes,
der neue Daten verspricht: ein neuer Export mit unveränderten Werten importiert sauber und
lässt den Bestand in Ruhe — wer dann in der Liste nichts findet, hielt die App für hängend.

Dazu die Gegenprobe im Lesepfad: `loadAll` fing jeden Fehler **still**
([store.ts](../../src/plugins/antraege/store.ts)) — `end()` ist tfPerf und in Builds stumm.
Scheiterte der IDB-Read (Transaktionskonflikt gegen Merger/Snapshot-Write), blieben `antraege`
**und** `lastLoadedAt` unverändert; weil der Mount-Effekt ohne `force` lädt, heilte danach kein
Seitenwechsel mehr, nur ein Browser-Reload. Jetzt: `console.warn` (always-on) + `lastLoadedAt: 0`,
damit der nächste Lauf den TTL-Skip nicht mehr nimmt — dieselbe Logik wie beim leeren Erst-Load.

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
