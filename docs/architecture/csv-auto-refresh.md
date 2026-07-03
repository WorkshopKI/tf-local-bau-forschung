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

- **Drift-Behandlung**: **reine `newColumns`-Drift** (nichts fehlt, nur Zusatzspalten) wird **headless** als
  `{ ignore: true }` adoptiert (`isNewColumnsOnlyDrift` → `adoptNewColumnsAsIgnored`) und importiert weiter —
  der tägliche Import blockiert nicht (v2.153.1). **`missingFromCsv > 0`** bleibt **blockierend**
  (`report.drift` → Modal), weil eine verschwundene gemappte Spalte echte Felder leeren kann.
- **Gebündelter Snapshot-Write**: bei N Quellen wird der (sekundenlange) Snapshot **einmal pro betroffenem
  Programm** nach dem Batch geschrieben (`deferSnapshotWrite`, v2.96.2), unter Build-Lock + Heartbeat;
  Delta-Snapshots wenn `isDeltaSnapshotWriteEnabled()`. `onAfterMerge` aktualisiert den lokalen Store **vor**
  dem Publish (der lokale User sieht neue Anträge sofort, v2.96.3).
- **Lock-Konflikt**: hält ein anderer Kurator den Build-Lock → `BuildLockBusyError` bricht den Lauf sauber ab
  („Kurator X aktualisiert seit Y Min", „Trotzdem aktualisieren" = `forceRefresh`).
- **`skippedInactiveUnterprogramm`**: aufsummierte Zeilen, die der Master-Import wegen inaktivem/unbekanntem
  Unterprogramm-Code verwarf. `>0` heißt: die Unterprogramm-Allowlist greift und schluckt Anträge — bei
  leerem `unterprogramme`-Store der stille Datenverlust (Prod-Vorfall 2026-07, v2.156). Sichtbar für Diagnose.

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
