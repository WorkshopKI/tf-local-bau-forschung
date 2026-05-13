# Neue Filter-Facet (Filter-Sidebar)

Wenn eine neue System-Filter-Facet zur Antrags-Sidebar kommt (z.B. `Bearbeiter-Kürzel`, `Land`, `Fördersumme-Range`). User-spezifische Filter werden **nicht** hier definiert — die werden im Kurator-Plugin `filter-kuration` über den 4-Step-Wizard zur Laufzeit angelegt.

## Touch-Points (Pflicht)

1. **`src/core/services/csv/filter/constants.ts`** — neuen Eintrag im `SYSTEM_FILTERS_SEED`-Array. Pflicht-Felder: `id` (Präfix `system-`), `scope: 'system'`, `name` (User-Label), `feld` (CSV-Spalten-Name oder canonical-Feld), `typ` (`multi_select` / `boolean_ja_nein` / `date_range` / `range`), `config` (typ-spezifisch), `anzeige_reihenfolge` (10er-Schritte, Status=10, VB-Phase=15, Verbund=20, …), `versteckt: false`.
2. **CSV-Schema** — der `feld`-Name muss in einem aktiven `CsvSchema.column_mapping` als Ziel-Property existieren (canonical-Field oder `custom: 'xxx'`). Wenn das Feld noch nicht in der Schema-Pipeline mappt, vorher [add-csv-field.md](add-csv-field.md) durchgehen.

## Automatisch (nicht anfassen)

3. **`src/core/services/csv/filter/filterRegistry.ts`** — `seedSystemFilters()` ruft `findDisplayGroup()` und zieht `display_group` automatisch aus dem Schema (Master, höchste Priority). **Kein** manuelles Pflegen von `display_group` im Seed.
4. **`src/core/services/csv/filter/types.ts`** — `FilterDefinition`-Interface stabil; nur erweitern wenn ein neuer `typ` (z.B. `range`) noch nicht existiert.
5. **Filter-Sidebar-Rendering** — `FilterSidebar.tsx` + `FilterSidebarItem.tsx` rendern alle `FilterDefinition`s generisch über `useFilterState`. Spezial-UI nur für Status (`StatusFilterFacet.tsx`) und VB-Phase. Für alle anderen Filter: keine UI-Arbeit.

## Werte-Quelle

- `werte_quelle: 'auto'` → Werte werden zur Laufzeit aus den geladenen Antraegen aggregiert (`werte_reihenfolge: 'haeufigkeit'` / `'alphabetisch'` / `'numerisch_absteigend'`).
- `werte_quelle: 'manual'` → `manuelle_werte: string[]` in der Reihenfolge wie sie gerendert werden sollen.
- `boolean_ja_nein` → `ja_werte` / `nein_werte` als String-Arrays; Spezial-Token `'*nonempty*'` matched alle nicht-leeren Werte.

## Anti-Patterns

- Keine direkte Modifikation am bereits seedeten Filter — User können System-Filter individualisieren, ein Re-Seed würde Custom-Configs überschreiben.
- Kein `anzeige_reihenfolge`-Wert, der mit einem bestehenden kollidiert (Sort ist stabil, aber unangenehm zu debuggen).
- `versteckt: true` als Default ist nur sinnvoll für rein technische Filter, die ein Workflow programmatisch setzt.

## Verifikation

- `npm run typecheck` grün
- Kurator-Plugin „Filter-Kuration" öffnen → neue Facet erscheint in der Sidebar mit Display-Group aus dem Schema
- Antraege-Plugin: Filter setzen, Liste filtert korrekt
- Mit beiden Fixture-Domänen (Bauantrag + Förderantrag) gegen-prüfen
