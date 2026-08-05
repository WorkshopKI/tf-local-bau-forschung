# Neues CSV-Standardfeld (`CanonicalField`)

Wenn ein neues kanonisches Feld zum Antrag-Modell hinzukommt (z.B. `bewilligungssumme`, `projektbeginn`).

## Touch-Points (Pflicht)

1. **`src/core/services/csv/types.ts`** — `CanonicalField`-Union erweitern.
2. **`src/core/services/csv/types.ts`** — Falls das Feld im `Antrag`-Interface explizit getypt sein soll (statt nur über `[key: string]: unknown` zu fließen), Property hinzufügen.
3. **`src/core/services/csv/merger.ts`** — `recomputeAntrag()` prüfen: das Field-Merging läuft generisch über `column_mapping`, das sollte ausreichen. Wenn das Feld aber Spezial-Logik braucht (Datum-Normalisierung, Zahl-Konvertierung), den passenden Merge-Pfad ergänzen.
4. **CSV-Wizard-Step2** (`src/plugins/csv-sources-kuration/wizard/Step2Columns.tsx`) — bietet das Field automatisch im Mapping-Dropdown an, sobald in `CanonicalField`-Union vorhanden. Kontrolle: `CANONICAL_FIELDS`-Konstante in `src/core/services/csv/canonical-fields.ts` (falls vorhanden) ggf. ergänzen.
5. **Variant-Sichtbarkeit / Build** — der Mapping-Wizard lebt im `csv-sources-kuration`-Plugin (Kuration, nur nach Freischaltung). Eine neue Mapping-Möglichkeit wird im prod-Build nicht gerendert → nach dem Patch zusätzlich `npm run build:pl` (siehe [which-build-to-run.md](which-build-to-run.md)). Damit ein neues Feld real gemappt wird, muss die echte CSV-Quelle die Spalte enthalten und neu gemappt/importiert werden.

## Optional

- **`CanonicalLevel`**: ist das Feld auf Antrag- oder Verbund-Ebene? → `verbund_titel`/`verbund_status` als Vorbild ansehen.
- **History-Tracking**: wird per `trackHistory: true` im `ColumnMappingEntry` aktiviert; wenn der neue Field-Typ standardmäßig getrackt werden soll → Default in `Step2Columns` setzen.
- **Detail-View**: wenn das Feld in der Antrag-Detail-Ansicht sichtbar sein soll, in `src/plugins/antraege/AntragDetail.tsx` (oder vergleichbar) entweder als generisches Feld über `column_mapping`-Iteration oder als spezifisches Display-Element.
- **Filter**: `FilterDefinition.field` akzeptiert beliebige Strings; das neue Feld ist sofort in `filter-admin` als Filter-Subjekt verfügbar.

## Tests

- **`src/core/services/csv/__tests__/`** — Bei Spezial-Logik (Date-Parsing, Zahlformat) einen Vitest-Case ergänzen. Pattern siehe `unterprogrammLabelXlsx.test.ts`.
- **Smoke-Test**: existierendes CSV mit dem neuen Feld neu importieren → in IDB (`antraege`-Store via Dev-Plugin) prüfen, dass das Feld gesetzt ist.

## Verifikation

- `npx tsc --noEmit` — kein Type-Fehler im Wizard / Merger
- Wizard-Smoke: CSV-Source-Wizard öffnen → Step 2 → das neue Feld im Dropdown sichtbar
