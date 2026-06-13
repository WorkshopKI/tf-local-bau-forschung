# App-Name / Untertitel / HTML-Filename ändern

Ändert das sichtbare Branding einer Build-Variante: Sidebar-Header (Label + Untertitel), Browser-Tab-Titel und den Dateinamen der gebauten `.html` unter `dist-single/`. Keine Code-Änderungen nötig — nur die jeweilige Variant-Config.

## Touch-Points (Pflicht)

Genau **eine** Variant-Config anfassen — die, deren Build umgebrandet werden soll:

- `configs/dev.config.json` (gebaut via `npm run build:dev`)
- `configs/prod.config.json` (gebaut via `npm run build:prod`)
- `configs/kurator.config.json` (gebaut via `npm run build:kurator`)
- `configs/pl.config.json` (gebaut via `npm run build:pl`)

Im `build`-Block:

```json
"build": {
  "label": "ZAH",                       // Sidebar-Header oben
  "sidebarSubtitle": "ZIM Arbeitshilfe",// Sidebar-Header unten (optional, Fallback "Verwaltung")
  "browserTabTitle": "ZAH",             // <title> der HTML
  "outputFilename": "zah",              // → dist-single/zah.html
  "outputSubdir": "dev"                 // optional → dist-single/dev/zah.html
}
```

## Validierungs-Regeln (`scripts/config-schema.mjs`)

- `label`, `browserTabTitle`: **Pflicht**, nicht-leer
- `outputFilename`: **Pflicht**, nur `[a-zA-Z0-9_-]`
- `sidebarSubtitle`: **optional**, wenn gesetzt nicht-leer (Fallback `"Verwaltung"` aus `ShellLayout.tsx`)
- `outputSubdir`: optional, nur `[a-zA-Z0-9_-]`. Weglassen → File landet direkt unter `dist-single/`

## Renderpfad

- Sidebar-Header: [src/core/ShellLayout.tsx:235](../../src/core/ShellLayout.tsx) (`runtimeConfig.build.label` + `runtimeConfig.build.sidebarSubtitle ?? 'Verwaltung'`)
- Browser-Tab-Titel: [src/core/App.tsx](../../src/core/App.tsx) (`document.title = runtimeConfig.build.browserTabTitle`)
- HTML-Dateiname: [scripts/build-with-config.mjs](../../scripts/build-with-config.mjs) — `outputSubdir` + `outputFilename` bestimmen den Zielpfad

## Andere Varianten nicht mit-bauen

`npm run build:prod` / `build:kurator` / `build:pl` werden **nicht** routinemäßig nach Branding-Änderungen mitgebaut. Nur die geänderte Variant-Config bauen.

## Verifikation

1. `npm run build:dev` (bzw. `:demo` / `:prod` / `:kurator` / `:pl`) — fehlerfrei.
2. `dist-single/<outputFilename>.html` (bzw. `dist-single/<outputSubdir>/<outputFilename>.html`) existiert.
3. Per Doppelklick in Chrome/Edge öffnen (`file://`):
   - Sidebar oben links zeigt `label` (groß) + `sidebarSubtitle` (klein darunter).
   - Browser-Tab zeigt `browserTabTitle`.
   - Console: keine Errors.
