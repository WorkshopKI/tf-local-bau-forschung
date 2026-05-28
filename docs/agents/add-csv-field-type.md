# Neuen CSV-FieldType (Wert-Koerzion) hinzufügen

`FieldType` definiert, wie ein CSV-Rohwert in das interne Schema gehoben wird (Trim, Parse, Cast). Aktuell: `'string' | 'date' | 'number' | 'boolean'`. Neue Typen (z.B. `'currency'`, `'percentage'`, `'iso-date'`) müssen sowohl im Type-System als auch im Merger + im Wizard-UI bekannt sein.

Nicht zu verwechseln mit:
- **`CanonicalField`** (Standard-Spaltenname wie `aktenzeichen`, `status`) — eigener Cheatsheet: [add-csv-field.md](add-csv-field.md).
- **Filter-Regel** (Suche/Facette) — eigener Cheatsheet: [add-filter-facet.md](add-filter-facet.md).

## Touch-Points (Pflicht)

1. **Type-Union** in [src/core/services/csv/types.ts](../../src/core/services/csv/types.ts):
   ```ts
   export type FieldType = 'string' | 'date' | 'number' | 'boolean' | 'currency';
   ```
   `ColumnMappingEntry.type` ist optional `FieldType` — TypeScript fängt nach diesem Patch alle Switch-Statements ohne neuen Case nicht von selbst (kein `never`-Check). Daher explizit grepen:

2. **Coerce-Logik** in [src/core/services/csv/merger/helpers.ts](../../src/core/services/csv/merger/helpers.ts):
   - `coerceValue(raw, entry)` switcht auf `entry.type` (Z. 13–33). Neuen Case ergänzen:
     ```ts
     if (entry.type === 'currency') {
       // Parse "1.234,56 €" → 1234.56 (number) oder original String bei Parse-Fehler.
       ...
     }
     ```
   - Fehler-Pfad: bei Parse-Failure den **Rohwert** zurückgeben (`return s`), nicht `null`/`undefined` — sonst kippt die Schema-Konsistenz.

3. **Wizard-UI** in [src/plugins/csv-sources-kuration/wizard/](../../src/plugins/csv-sources-kuration/wizard/):
   - Step 2 (Column-Mapping) hat ein Type-Dropdown pro Spalte (in `Step2ColumnMapping.tsx` oder einer Sub-Komponente). Option ergänzen, Label in der UI klar (z.B. „Währung (mit Komma)").
   - Default-Erkennung beim Auto-Detect: in der Inferenz-Funktion (suchen via Grep nach `inferType` oder `detectFieldType`) regex-basierte Heuristik ergänzen, falls automatische Vorbelegung gewünscht.

## Optional, je nach Use-Case

- **Filter-Engine** [src/core/services/csv/filter/engine.ts](../../src/core/services/csv/filter/engine.ts): wenn der neue Typ in Filtern als Range/Compare nutzbar sein soll, dort die Vergleichs-Logik erweitern. Reine String-Filter brauchen das nicht.

- **Detail-Ansicht-Rendering**: `src/plugins/antraege/AntragDetailView.tsx` rendert Felder generisch. Bei speziellen Typen (z.B. Currency mit `€`-Suffix) den Renderer um einen Case erweitern.

- **Fixture-Schema**: wenn der neue Typ in Dev-Seeds genutzt wird, in [docs/fixtures/schema-*.ts](../../docs/fixtures/) die entsprechenden Spalten mit `type: 'currency'` markieren.

## Nicht ändern

- **`coerceValue`-Signatur** — der Helper ist von batched + single Merger geteilt. Neue Optional-Argumente sind OK, Breaking-Changes nicht.
- **Legacy-Datenmigration** — bestehende Antraege haben den alten Wert als `string` im IDB. Bei Re-Import wird neu koerziert; bei nur-lesen passiert nichts.

## Verifikation

- `npm run typecheck` grün — der erweiterte FieldType wird in `ColumnMappingEntry` akzeptiert.
- `npm run test` — Tests in `src/core/services/csv/__tests__/` müssen grün bleiben. Idealerweise einen neuen Test in `merger-frist-fallback.test.ts`-Stil ergänzen, der den neuen Typ koerziert.
- Manueller Smoke: dev-Build → CSV-Wizard → eine CSV mit der neuen Spalte importieren, Step 2 zeigt den neuen Typ im Dropdown, Step-3-Vorschau zeigt den korrekt parsierten Wert.
