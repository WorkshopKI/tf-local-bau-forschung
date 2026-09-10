# Das gespeicherte `frist_datum` entfällt

Stand: 10.09.2026 · Ausgangspunkt: Nach v6.49 lesen noch zwei Rechenwege nur `D_AAE` — der Merger-Rückfall, der `frist_datum` in jeden Datensatz schreibt, und `computeVerbundFristDatum`.

## 0. Anlass

Nutzer, 10.09.2026:

> „Zwei Rechenwege lesen noch NUR D_AAE: 1. `computeFristDatum` → `applyFristDatumFallback` im Merger […] schreibt das persistierte Feld `frist_datum` […] 2. `computeVerbundFristDatum` […] hat außerhalb von Tests keinen Aufrufer, ist also wahrscheinlich toter Code. Aufgabe: Mit dem Skill `grillen` klären, ob `frist_datum` (a) auf den wirksamen Eingang umgestellt, (b) als ‚gespeichert, veraltet' ausgeblendet oder (c) entfernt wird."

## 1. Warum

Die Bitte fragt nach dem Anker. Der Bedarf ist **eine** Frist-Wahrheit: Die Frist-Spalte (`berechneFrist` über `fristErgebnisVon`) kennt den wirksamen Eingang, das Haltekriterium der ZAH-Phase und die VN-Frist aus `eingang_vn_sach`. Das gespeicherte Feld kennt nichts davon und stimmt deshalb nur zufällig mit ihr überein. Den Anker umzustellen hieße, eine zweite Ableitung zu reparieren, die niemand braucht. Sie vollständig anzugleichen, hieße, Katalogwissen (`fristLaeuft` ist ohne Release änderbar) in einen Datensatz zu schreiben, der beim nächsten Freigeben einer Fassung veraltet (Pitfall #45).

## 2. Befunde aus dem Bestand

Gemessen am 10.09.2026 in dev:local (Port 5176, frisch geladen) an 14 225 Anträgen, `frist_datum` gegen `fristErgebnisVon` am selben Datensatz:

| Befund | Anträge |
|---|---|
| `frist_datum` gefüllt | 13 690 — **alle** aus dem Merger-Rückfall; kein Schema mappt die Spalte, kein echtes Schema führt eine Spalte mit „FRIST" |
| gleiches Datum wie die Frist-Spalte | 506 |
| anderes Datum, und zwar genau der `D_XTE`-Anker | 163 |
| Datum gespeichert, Frist-Spalte „angehalten" | **13 021** |
| Begleitphase: Spalte läuft, Feld leer (Merger liest `vn_eingang_datum`, real leer; `D_VBE` liegt unter `eingang_vn_sach`) | 313 |
| Variante (a): geänderte Werte | 3 536 (+1 … +713 T, Median +6), davon nur 163 mit laufender Uhr |

**Wer das Feld liest:**
- der System-Filter „Fristdatum" ([filter/constants.ts:89](../../../src/core/services/csv/filter/constants.ts), sichtbar in allen Varianten);
- „Alle Felder", Gruppe „Termine";
- die Kopf-Eckdaten, wo es wählbar ist ([eckdatenConfig.ts:42](../../../src/plugins/antraege/eckdatenConfig.ts));
- der Wizard, der es als Slot anbietet und für jede Spalte mit „frist" vorschlägt ([useCsvWizardState.ts:569](../../../src/plugins/csv-sources-kuration/wizard/useCsvWizardState.ts)).

**Genutzt wird nichts davon:** Weder `localStorage` noch der `kv`-Store enthält einen Pin, eine Eckdaten-Auswahl oder einen aktiven Filter auf `frist_datum`; die Kurator-Filter-Datei nennt das Feld nicht. Sortierung, Sichten, Startseite und Artefakt-Leiste lesen das Feld seit v4.121 bzw. v4.131 nicht mehr.

**Tote Rechenwege:** `computeVerbundFristDatum` und `daysUntilFristAware` (liest ebenfalls nur `D_AAE`) haben außerhalb der Tests keinen Aufrufer.

**Bestand:** Ein Import rechnet nur geänderte Zeilen neu (`touchedAz`). System-Filter kommen nur aus dem Seed, und `seedSystemFilters` legt an, löscht aber nie. Aktive Filter mit unbekannter Id fallen beim Laden still weg. Einzel-Pins ohne Definition blenden sich aus; ein Kombi-Pin bliebe als toter Chip „Filter-Kombination" stehen.

## 3. Entwurf

Grill-Entscheidungen: Q1 = entfernen · Q2 = beide toten Wege entfernen · Q3 = der Seed räumt ab · Q4 = nur beim Lesen abräumen · Q5 = der Standardfeld-Slot entfällt.

### 3.1 Rechenwege
- `applyFristDatumFallback` entfällt ([merger/helpers.ts](../../../src/core/services/csv/merger/helpers.ts)), ebenso seine Aufrufe in `single.ts` und `batched.ts`.
- `computeVerbundFristDatum` und `daysUntilFristAware` entfallen ([frist.ts](../../../src/core/services/csv/frist.ts)).
- `computeFristDatum` bleibt: Der Bestandslauf füttert es mit dem wirksamen Eingang.
- Die Kommentare, die die entfallenen Wege noch nennen, werden auf den Ist-Zustand gebracht.

### 3.2 Datenmodell und Projektion
- `frist_datum` verlässt `CanonicalField`, `AntragListItem`, `CANONICAL_FIELDS` und `LIST_VIEW_FIELDS`. `toAntragListItem` kopiert es nicht mehr.
- `LIST_VIEW_PROJECTION_VERSION` geht von 9 auf 10: Beim nächsten Start baut jede Installation die Liste ohne das Feld neu auf, auch Geräte, die nur den Snapshot lesen.
- Neu: `AUSGEMUSTERTE_FELDER` in `csv/constants.ts`. Das sind Schlüssel, die ältere Stände in den Datensatz schrieben. Im Voll-Store und im Snapshot bleiben sie liegen, bis der Antrag neu gerechnet wird. Leser zeigen sie nur, wenn ein Schema sie mappt.

### 3.3 Filter und Pins
- Der Seed-Eintrag `system-frist-datum` entfällt. `seedSystemFilters` löscht jede Definition mit `scope: 'system'`, deren Id nicht mehr im Seed steht. Kurator-Filter (`'admin'`) bleiben unberührt.
- Ein Kombi-Pin, dem eine Filter-Definition fehlt, blendet sich aus wie ein Einzel-Pin: als reines Prädikat in `pinnedFilters.ts`, genutzt von `PinLeiste`.

### 3.4 „Alle Felder", Eckdaten, Wizard
- `buildDisplayRows` überspringt ausgemusterte Schlüssel, die kein Schema mappt.
- Wegfallen: der `frist_datum`-Satz im Tooltip (`quellTitel`) und die Einträge in `felderGruppen`.
- Die Eckdaten folgen von selbst: Die Auswahl leitet sich aus `CANONICAL_FIELD_KEYS` ab, gespeicherte Auswahlen werden gegen `AVAILABLE_SET` gefiltert.
- Im Wizard entfallen der Slot und die `/frist/`-Regel. Eine solche Spalte wird Custom-Feld.
- Die Dev-Fixtures (`FRIST_NEU`) mappen auf das Custom-Feld `frist_neu` (Pitfall #13: der Weg bleibt `importCsvSource`).

### 3.5 Tests
- `merger-frist-fallback.test.ts` entfällt, ebenso die Blöcke der beiden toten Funktionen in `frist.test.ts`.
- `list-view.test.ts` prüft: Ein Altdatensatz mit `frist_datum` ergibt ein Listen-Item ohne das Feld.
- Neu:
  - Seed-Abräumen: Ein veralteter System-Filter verschwindet, ein Kurator-Filter bleibt.
  - Kombi-Pin-Prädikat.
  - `buildDisplayRows`: Das ausgemusterte Feld wird ohne Mapping übersprungen und mit Mapping gezeigt.
- Angepasst: `felderGruppen.test`, `new-column-mapping.test`, `zeigtWasDasteht.test` und die Fixture `real-csv-antraege`.

## 4. Verifikation

- **Gate:** `check:quick` im Loop, `check` vor dem Commit, danach `build:devpl` im Hintergrund, Exit-Code wird geprüft.
- **Gepaarte Messung** in dev:local, jeweils nach einem sauberen Reload (die Memory zu HMR-Modulständen):
  - Vorher halten wir die Verteilung der Frist-Zustände (`laeuft`/`angehalten`/`nicht_berechenbar`) und einen Hash über `aktenzeichen|zustand|zielDatum` fest.
  - Nachher müssen beide gleich sein, denn die Frist-Spalte liest das Feld nicht.
  - Dazu nachher: 0 Listen-Einträge mit `frist_datum` und keine Definition `system-frist-datum`. Der Voll-Store trägt den Schlüssel erwartungsgemäß weiter, bis ein Import die Zeile anfasst.
  - Zwischen den beiden Messungen darf kein Import laufen (Zeitstempel der CSV-Frische vergleichen).
- **Abnahme** mit ausgeschaltetem Beta-Schalter:
  - Die Filter-Sidebar zeigt kein „Fristdatum".
  - „Alle Felder" eines Antrags zeigt keine Zeile „Fristdatum".
  - Die Eckdaten-Auswahl bietet „Fristdatum" nicht an.
  - `__tf.fehler()` = 0.
- **Nicht `file://`-spezifisch:** Es entstehen keine Importe, keine Worker und keine Share-Schreibpfade. Die Snapshot-Leser erreicht die Änderung über die Projektions-Version, und die läuft in dev:local denselben Weg.
