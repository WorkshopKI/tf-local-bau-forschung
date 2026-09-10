# Das gespeicherte `frist_datum` entfällt — Umsetzungsplan

> **Für agentische Bearbeiter:** ERFORDERLICHER SUB-SKILL: `superpowers:executing-plans` (Schritte mit Checkboxen). Gate/Abnahme/Commit bleiben im Hauptlauf.

**Grundlage:** [docs/superpowers/specs/2026-09-10-frist-datum-entfaellt-design.md](../specs/2026-09-10-frist-datum-entfaellt-design.md)

## Ziel

Die App kennt nur noch eine Frist: die der Frist-Spalte (`berechneFrist`). Das beim Import gerechnete `frist_datum` und die beiden toten Rechenwege, die nur `D_AAE` lesen, entfallen. Mit ihnen gehen der System-Filter „Fristdatum" und der Standardfeld-Slot. Altwerte im Bestand werden nur beim Lesen ausgeblendet.

## Architektur

```
vorher:  CSV ─▶ Merger ─▶ applyFristDatumFallback ─▶ Antrag.frist_datum ─▶ List-View ─▶ Filter / Alle Felder / Eckdaten
                                                                          (13 021 von 13 690 ohne laufende Uhr)
nachher: CSV ─▶ Merger ─▶ Antrag                ─▶ List-View (v10) ─▶ fristErgebnisVon ─▶ Frist-Spalte · Sicht · Sortierung · Home
         Altbestand: frist_datum ∈ AUSGEMUSTERTE_FELDER → nur sichtbar, wenn ein Schema es mappt
```

## Tech-Stack

TypeScript, React 19, Vitest (node), IndexedDB (`antraege`, `antraege_list_view`, `filter_definitionen`).

## Global Constraints

- **Pitfalls:** #45 (Abgeleitetes nicht daneben speichern), #32 (Voll-Store ≠ List-View; Projektions-Version hochzählen), #13 (Fixtures über `importCsvSource`), Bug-Klasse 5 (`CANONICAL_FIELDS` ist ein Wunsch, kein Mapping).
- **Gate:** innerer Loop `npm run check:quick`, Phasen-Gate `npm run check`, danach `npm run build:devpl` im Hintergrund mit geprüftem Exit-Code.
- **Tests:** Schlägt ein neuer Test nur im Suite-Lauf fehl, gehört die Datei in `ISOLATED_TESTS`; den Test nicht verbiegen.
- **Windows-Shell:** keine Heredocs; die Commit-Message per Write nach `.git/COMMIT_MSG.tmp`.
- **Parallele Session:** Die vier geänderten Dateien unter `src/plugins/home/widgets/` gehören ihr. Nur eigene Pfade stagen.
- **dev:local läuft auf Port 5176** (`local-b`), weil 5175 einer anderen Sitzung gehört. Vor jeder Messung sauber neu laden.

## Dateien im Überblick

| Datei | Rolle |
|---|---|
| `src/core/services/csv/frist.ts` (+ `__tests__/frist.test.ts`) | tote Wege raus, Kopfkommentar |
| `src/core/services/csv/merger/{helpers,single,batched}.ts`, `__tests__/merger-frist-fallback.test.ts` | Rückfall raus, Test gelöscht |
| `src/core/services/csv/{types,constants,list-view,list-view-migration}.ts` (+ `list-view.test.ts`) | Datenmodell, `AUSGEMUSTERTE_FELDER`, Projektion v10 |
| `src/core/services/csv/filter/{constants,filterRegistry}.ts` (+ neuer Test) | Seed-Eintrag raus, Seed räumt ab |
| `src/plugins/antraege/filter/{pinnedFilters.ts,PinLeiste.tsx}` (+ Test) | Kombi-Pin ohne Definition ausblenden |
| `src/plugins/antraege/alleFelder/{buildDisplayRows,felderGruppen}.ts`, `AlleFelderSection.tsx` (+ Tests) | Lesen ohne Altwert, Tooltip-Satz raus |
| `src/plugins/csv-sources-kuration/wizard/{StandardFieldSlots.tsx,useCsvWizardState.ts}` (+ `new-column-mapping.test.ts`) | Slot und `/frist/`-Regel raus |
| `src/dev-fixtures/fixture-schemas.ts`, `src/plugins/antraege/__tests__/{fixtures/real-csv-antraege.ts,zeigtWasDasteht.test.ts}` | Fixtures ohne das Feld |
| Kommentare: `frist-ergebnis.ts`, `assistent/kontext/types.ts`, `arbeitsvorratUebersicht.ts`, `dashboardAggregate.ts`, `views.ts`, `sort.ts` | Ist-Zustand statt entfallener Namen |
| Doku: `antrag-status-domaenen.md`, `ui-muster.md`, `feedback-kontext/antraege.md`, `CONTEXT.md`, CHANGELOG + `changelog-user.md` | Ist-Zustand, Begriff „Frist" |

## Tasks

- [x] **T0 Vorher:** dev:local sauber neu laden, `bereit()`. Festhalten, alles in einer gemeinsamen Notiz:
  - Verteilung der Frist-Zustände und Hash über `aktenzeichen|zustand|zielDatum` aus `fristErgebnisVon` über die List-View;
  - Anzahl der Listen-Einträge mit `frist_datum` (erwartet 13 690);
  - Definitionen in `filter_definitionen`;
  - Zeitstempel der CSV-Frische.
- [x] **T1 Tote Rechenwege:**
  - `computeVerbundFristDatum` und `daysUntilFristAware` samt ihrer Test-Blöcke entfernen.
  - Kommentare, die sie nennen, auf den Ist-Zustand bringen.
  - Verifikation: `check:quick`.
- [x] **T2 Merger-Rückfall:**
  - `applyFristDatumFallback` und seine Aufrufe entfernen, ungenutzte Importe weg.
  - `merger-frist-fallback.test.ts` löschen.
  - Kopfkommentar in `frist.ts`, den „Bewusst additiv"-Absatz an `wirksamerEingang` neu fassen.
  - Verifikation: `check:quick`.
- [x] **T3 Datenmodell und Projektion:**
  - `frist_datum` aus der Union, `AntragListItem`, `CANONICAL_FIELDS`, `LIST_VIEW_FIELDS` und `toAntragListItem` nehmen.
  - `AUSGEMUSTERTE_FELDER` anlegen, mit Warum-Kommentar.
  - `LIST_VIEW_PROJECTION_VERSION` von 9 auf 10, der Kommentar nennt den Anlass.
  - `list-view.test.ts` umkehren: Ein Altdatensatz ergibt ein Listen-Item ohne das Feld.
  - Verifikation: `check:quick`, die Typfehler zeigen die übrigen Leser.
- [x] **T4 Filter und Pins:**
  - Den Seed-Eintrag streichen.
  - `seedSystemFilters` löscht System-Definitionen, deren Id nicht im Seed steht, über `deleteFilterDef`; `removeFilter` wirft bei System-Filtern.
  - Test nach dem vorhandenen IDB-Testmuster: Die veraltete System-Definition verschwindet, eine `'admin'`-Definition mit gleichem Feld bleibt.
  - Kombi-Pin-Prädikat in `pinnedFilters.ts` samt Test; `PinLeiste` gibt `null` zurück, wenn eine Definition fehlt.
  - Verifikation: `check:quick`.
- [x] **T5 „Alle Felder", Wizard, Fixtures:**
  - `buildDisplayRows` überspringt ausgemusterte Schlüssel ohne Mapping. Tests für beide Richtungen.
  - Den Satz aus `quellTitel` und die Einträge in `felderGruppen` entfernen, Test anpassen.
  - Im Wizard Slot und Regel entfernen; `new-column-mapping.test` auf `bewilligung_datum`.
  - `FRIST_NEU` wird zum Custom-Feld `frist_neu`; `real-csv-antraege` und `zeigtWasDasteht.test` ohne das Feld, die Aussage des Tests bleibt dieselbe.
  - Verifikation: `check:quick`.
- [x] **T6 Gate und Nachher:**
  - `npm run check`.
  - dev:local sauber neu laden, T0 wiederholen: Verteilung und Hash identisch, 0 Listen-Einträge mit dem Feld, kein `system-frist-datum`, CSV-Frische unverändert.
  - Abnahme mit ausgeschaltetem Beta-Schalter:
    - Filter-Sidebar ohne „Fristdatum";
    - „Alle Felder" eines Antrags mit Altwert ohne Zeile „Fristdatum";
    - Eckdaten-Editor ohne die Option;
    - `__tf.fehler()` = 0.
- [x] **T7 Doku, Version, Build, Commit:**
  - Die drei Docs auf den Ist-Zustand; in CONTEXT.md den Begriff „Frist" ergänzen („nicht sagen: Fristdatum als Feld").
  - Spec und Plan abhaken.
  - `npm run version:bump -- minor "Das gespeicherte Fristdatum entfällt" --user`, dann das Changelog-Skelett ausfüllen.
  - `build:devpl` im Hintergrund, Exit-Code prüfen.
  - Nur eigene Pfade committen.
