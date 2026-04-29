# CSV-Import-Wizard: Vorschau-Tabelle mit höherer Spaltendichte

Date: 2026-04-29
Scope: `src/plugins/csv-sources-admin/wizard/Step1Metadata.tsx`

## Kontext

Der CSV-Source-Wizard zeigt in Schritt 1/5 eine Vorschau der hochgeladenen CSV — Header + ein paar Datenzeilen, damit der Kurator Encoding und Separator visuell verifiziert, bevor er zum Column-Mapping (Step 2) weitergeht.

Aktuell rendert die Vorschau hart die ersten 8 Spalten und zeigt am Ende eine Pseudo-Spalte „…+154". Bei realistischen Antrags-CSVs mit 150+ Spalten verbergen sich damit über 90 % der Datei. Selbst die acht sichtbaren Spalten beanspruchen breite Tracks (`max-w-180px`, `whitespace-nowrap`), obwohl viele Werte (z. B. „37", „2014", „BRF") nur wenige Zeichen lang sind.

Ziel ist ein Sanity-Check-Screen, auf dem der Kurator (a) ohne Scroll möglichst viele Spalten gleichzeitig im Blick hat und (b) bei Bedarf einen schnellen Überblick aller Spaltennamen bekommt.

## Anforderungen

1. Alle Spalten der CSV sind über horizontalen Scroll erreichbar (kein Slice mehr).
2. Spaltenbreiten orientieren sich am tatsächlichen Inhalt, nicht an einem Default-Maximum.
3. Bei trunkiertem Header- oder Zelleninhalt liefert ein Hover-Tooltip den vollen String.
4. Eine optional ausklappbare Liste zeigt alle Spaltennamen kompakt als Chips, ohne dass der Kurator scrollen muss.
5. Beim Wechsel von Encoding oder Separator passen sich die Breiten neu an, sobald die Vorschau neu geparst wird.
6. Die Vorschau zeigt 5 Datenzeilen (statt heute 3), die der Parser ohnehin schon liefert.
7. Touchpoint bleibt eine einzige Datei: [Step1Metadata.tsx](../../../src/plugins/csv-sources-admin/wizard/Step1Metadata.tsx).

## Lösung

### 1. Auto-Fit Spaltenbreiten

Eine reine Render-Helper-Funktion `computeColumnWidth(header, sampleValues)` berechnet pro Spalte einen Pixel-Wert:

```
ch = clamp(4, max(headerLength, maxSampleValueLength) capped at 24, 24)
width = clamp(56, ch * 7.2 + 12, 200)
```

- Untergrenze 56 px, damit auch zweistellige Werte (`37`) keinen unleserlich engen Track bekommen.
- Obergrenze 200 px, damit ein einzelnes Langfeld nicht halb sichtbare Nachbarspalten verdrängt.
- Cap auf 24 Zeichen, damit sehr lange Werte (Beschreibungstexte) nicht die Breite dominieren.
- Faktor 7.2 px/Zeichen ist auf die bestehende `text-[11px]`-Schriftgröße kalibriert.

Sample-Set: die ersten 5 geparsten Zeilen (lädt der Parser bereits, wir verwenden derzeit nur 3 davon — ändert sich gleich, siehe Punkt 4).

Berechnung mit `useMemo` über `state.preview` gepuffert; bei Encoding- oder Separator-Wechsel triggert das ohnehin neue Parsing → Re-Compute fällt automatisch ab. Akzeptiert wird das minimale Layout-Flackern, das durch die ein-Frame-Breitendifferenz entsteht.

Anwendung auf `<th>` und `<td>` per `style={{ width: w, minWidth: w, maxWidth: w }}`. `whitespace-nowrap` und `overflow-hidden text-ellipsis` bleiben.

### 2. Native Tooltips bei Trunkierung

Auf jedes `<th>` und `<td>` ein `title={fullValue}`-Attribut. Browser zeigen den Tooltip nur, wenn der Inhalt physisch trunkiert wird — keine extra Komponente, kein State, funktioniert auch bei Tastatur-Fokus.

### 3. Chip-Liste „Alle Spaltennamen"

Neues `<Collapsible>` (vorhanden in `@/components/ui/collapsible`, wird in derselben Datei bereits für „Beispieldaten zum Testen anzeigen" verwendet — gleiche Trigger-Optik):

- Position: zwischen Encoding/Separator-Selektoren und der Tabelle.
- Trigger: `Alle {n} Spaltennamen anzeigen ▾` mit `ChevronRight`/`ChevronDown` analog zum bestehenden Test-Korpus-Collapsible.
- Default eingeklappt — Tabelle ist der primäre Sanity-Check.
- Content: `flex flex-wrap gap-1` mit Chips (`bg-[var(--tf-hover)]`, `text-[10.5px]`, `px-1.5 py-0.5`, `rounded`, `text-[var(--tf-text-secondary)]`).
- Wrap-Container mit `max-h-[160px] overflow-y-auto`, damit bei sehr vielen Headern die Tabelle darunter sichtbar bleibt.
- Read-only in v1: kein Click-Verhalten, keine Suche/Filter.

### 4. Datenzeilen von 3 auf 5

`parseCsvPreview(file, 5)` lädt heute schon 5 Zeilen, die Render-Stelle slict aber auf 3. Cap von 3 auf 5 anheben — kein zusätzlicher I/O.

### Out of Scope (bewusst nicht gebaut)

- Click-on-Chip → Scroll-to-Column in der Tabelle. Step 2 ist die eigentliche Mapping-Bühne.
- Filter-Suchfeld über den Chips. Bei 162 Spalten verlockend, aber Step 2 dominiert das.
- Sticky erste Spalte / horizontaler Sticky-Header. Layout-Komplexität ohne klaren Nutzen für einen 5-Zeilen-Sanity-Check.
- Persistenz des Collapsible-Open-States. Pro Wizard-Aufruf frisch eingeklappt ist akzeptabel.

## Akzeptanz-Kriterien

- Eine CSV mit 162 Spalten und einer 1100-px-breiten Modal zeigt sichtbar mehr als 8 Spalten gleichzeitig (erwartet je nach Header-Länge ~20–30, abhängig von der konkreten Header-Verteilung).
- Die Pseudo-Spalte „…+154" existiert nicht mehr.
- Hover über trunkiertem Header oder trunkierter Zelle zeigt den vollen Wert in einem nativen Tooltip.
- Chip-Trigger ist sichtbar, default eingeklappt; ausgeklappt enthält er genau `headers.length` Chips.
- Beim Wechsel des Encodings ändern sich die Breiten so, dass der Schritt sich nicht „kaputt" anfühlt (≤1 Frame Layout-Shift).
- Der Wizard-Test mit den vorhandenen Fixtures unter `public/test-korpus/bauforschung-v2/` läuft visuell sauber durch (5-spaltig, 11-zeilig).

## Verifikation

1. `npm run build:dev` und HTML aus `dist-single/dev/teamflow-dev.html` öffnen.
2. Wizard öffnen (Kurator → CSV-Sources → Neue Source), eine reale Antrags-CSV (162 Spalten) hochladen.
3. Sicht-Check: viele Spalten gleichzeitig, kein „+154", Hover-Tooltips bei langen Werten.
4. Collapsible öffnen, alle Spaltennamen als Chips lesen.
5. Encoding-Wechsel UTF-8 ↔ Windows-1252: Breiten passen sich an, keine Layout-Bruchstellen.

## Touchpoints

- [src/plugins/csv-sources-admin/wizard/Step1Metadata.tsx](../../../src/plugins/csv-sources-admin/wizard/Step1Metadata.tsx) — geschätzt ~40 Zeilen geändert/ergänzt (Helper, Render-Block der Tabelle, neues Collapsible).

Keine weiteren Files. Insbesondere keine Änderung am Parser, an Wizard-State oder am Type-Schema.
