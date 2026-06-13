# Build-Script (prebuild-Hook) anlegen

Für Pipeline-Schritte, die zur Build-Zeit ausgeführt werden müssen — typisch: Daten-Konvertierung (XLSX → TypeScript), Code-Generierung aus Fixtures, Asset-Generierung. Vermeidet, dass der Code zur Laufzeit parsen/konvertieren muss.

Referenz: [scripts/build-default-labels.mjs](../../scripts/build-default-labels.mjs) (liest `_labels/Labels PrjBsp_GPT.xlsx`, generiert `src/plugins/auslastung/services/default-labels.ts`).

## Touch-Points (Pflicht)

1. **Script unter `scripts/<name>.mjs`** mit Header-Kommentar:
   ```js
   #!/usr/bin/env node
   /**
    * Konvertiert <input> in <output>.
    *
    * Eingabe: <pfad>
    * Ausgabe: <pfad>  (AUTO-GENERIERT)
    *
    * Aufruf: node scripts/<name>.mjs [optionale-args]
    * Laeuft idempotent — keine Aenderung wenn Output identisch.
    */
   ```
   ESM (`.mjs`), keine TS-Dependencies (läuft pur in Node). Stable-Output (sortiert wo Reihenfolge nicht inhärent), damit der generierte File unter `src/` nicht bei jedem Build dirty wird.

2. **Generierter Code unter `src/.../<name>.ts`** mit Header:
   ```ts
   // AUTO-GENERIERT von scripts/<name>.mjs — bitte nicht manuell editieren.
   // Quelldatei: <pfad>
   // Neu generieren: npm run <generate-script>
   ```
   Datei wird committed (Idempotenz: kein Diff beim Re-Run wenn Input unverändert). `.gitignore` NICHT erweitern — bei manuellem Bypass des prebuild-Hooks (z.B. `--ignore-scripts`) wäre der Code sonst weg.

3. **npm-Scripts in `package.json`**:
   ```json
   "generate:<name>": "node scripts/<name>.mjs",
   ```
   Plus Einbindung in `generate:test-assets` (Sammel-Script, das vor jedem Build läuft):
   ```json
   "generate:test-assets": "npm run generate:test-csvs && ... && npm run generate:<name>"
   ```

4. **Pre-Hooks**:
   - `prebuild`: Pflicht, damit der CI-Build den generierten File aktuell hat.
   - `predev`: nur wenn der Dev-Server das Asset zur Laufzeit braucht (z.B. bei Test-CSV-Generation). Sonst überspringen — spart Dev-Start-Zeit.
   - Variant-spezifische `prebuild:dev` / `prebuild:prod` / `prebuild:kurator` / `prebuild:pl` greifen, wenn `npm run build:<variant>` ein dediziertes Pre-Script hat. In TeamFlow alle vier → `npm run generate:test-assets`.

## Konventionen

- **Output-Pfad immer absolut** im Script via `path.resolve(__dirname, '..', '...')` — nie relativ zum CWD, damit der Aufruf auch aus IDEs/Editors klappt.
- **Idempotenz prüfen**: Vor dem `writeFileSync` den existierenden Inhalt lesen und vergleichen. Bei Gleichheit nichts schreiben (verhindert Mtime-Änderung und unnötiges Vite-HMR-Trigger).
- **Sourcemap / Header-Kommentar zeigt Quell-Hash oder Quell-Datum**, damit man im Code-Review nachvollziehen kann woher der Inhalt kommt.
- **Fehler-Fall**: Script `process.exit(1)` bei Input-Fehler. Niemals einen leeren oder Default-Output schreiben — der Build bricht lieber laut ab als still mit falschen Daten zu kompilieren.

## Wann KEIN Build-Script

- Wenn der Output sich pro User unterscheidet (z.B. user-spezifische Config) → das gehört zur Runtime.
- Wenn die Input-Quelle nicht committed ist (z.B. ein externer Download) → ggf. ein separates Fetcher-Script + committed Cache.
- Wenn der Output kleiner als die Input-Datei ist und schnell zu parsen ist → direkt im Code parsen (z.B. JSON-Import).

## Verifikation

- `npm run generate:<name>` läuft ohne Fehler, generiert Output unter `src/`
- `git status` zeigt KEINE Änderung am Output beim Re-Run mit unverändertem Input (Idempotenz)
- `npm run typecheck` grün — der generierte Code ist syntaktisch korrekt
- `npm run build:dev` grün — der prebuild-Hook läuft transparent durch
- Generierter File hat `// AUTO-GENERIERT`-Header (Code-Review-Hilfe)
