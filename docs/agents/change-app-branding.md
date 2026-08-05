# App-Name / Untertitel / Favicon / HTML-Filename ändern

Ändert das sichtbare Branding einer Build-Variante: Sidebar-Header (Label + Untertitel), Browser-Tab-Titel, Favicon-Farbe und den Dateinamen der gebauten `.html` unter `dist-single/`. Keine Code-Änderungen nötig — nur die jeweilige Variant-Config.

**`outputFilename` ist kein Branding-Feld.** Er bestimmt zusätzlich den IndexedDB-Namen (`teamflow-<outputFilename>`, `deriveVariantDbName` in [runtime-config.ts](../../src/config/runtime-config.ts)) — wer ihn umbenennt, schneidet die Variante ohne Migration von ihrem gerätelokalen Speicher ab (Notizen, Assistent-Protokoll, Status-Event-Log, Embedding-Caches). Für eine reine Umbenennung nach außen reicht `browserTabTitle`.

## Touch-Points (Pflicht)

Genau **eine** Variant-Config anfassen — die, deren Build umgebrandet werden soll:

- `configs/dev.config.json` (gebaut via `npm run build:dev`)
- `configs/pl.config.json` (gebaut via `npm run build:pl`)
- `configs/prod.config.json` (gebaut via `npm run build:prod`)

Im `build`-Block:

```json
"build": {
  "label": "ZAH",                       // Sidebar-Header oben
  "sidebarSubtitle": "ZIM Arbeitshilfe",// Sidebar-Header unten (optional, Fallback "Verwaltung")
  "browserTabTitle": "zim-dashboard",   // <title> der HTML
  "faviconColor": "#506786",            // Grundfarbe des Favicons (optional, Fallback #506786)
  "outputFilename": "zah",              // → dist-single/zah.html
  "outputSubdir": "dev"                 // optional → dist-single/dev/zah.html
}
```

Belegte Favicon-Farben (pro Variante verschieden, ein Guard-Test hält das fest): prod `#506786`, pl `#3f7a5a`, dev `#b5651d`, local `#6b6b6b`.

## Validierungs-Regeln (`scripts/config-schema.mjs`)

- `label`, `browserTabTitle`: **Pflicht**, nicht-leer
- `outputFilename`: **Pflicht**, nur `[a-zA-Z0-9_-]`
- `sidebarSubtitle`: **optional**, wenn gesetzt nicht-leer (Fallback `"Verwaltung"` aus `ShellLayout.tsx`)
- `faviconColor`: **optional**, wenn gesetzt exakt `#rrggbb` (Fallback `#506786`)
- `outputSubdir`: optional, nur `[a-zA-Z0-9_-]`. Weglassen → File landet direkt unter `dist-single/`

## Renderpfad

- Sidebar-Header: [src/core/ShellLayout.tsx:235](../../src/core/ShellLayout.tsx) (`runtimeConfig.build.label` + `runtimeConfig.build.sidebarSubtitle ?? 'Verwaltung'`)
- Browser-Tab-Titel: [src/core/App.tsx](../../src/core/App.tsx) (`document.title = runtimeConfig.build.browserTabTitle`) — plus der `<title>`-Ersatz beim Build, damit vor dem Mount nichts Falsches flasht
- Favicon: **nur Bauzeit** — [scripts/favicon.mjs](../../scripts/favicon.mjs) baut das SVG (Monogramm „Z"), der Hook `teamflow-index-html-branding` in [vite.config.ts](../../vite.config.ts) ersetzt damit den `<link rel="icon">` aus [index.html](../../index.html). Zur Laufzeit liest `faviconColor` niemand. Icon-**Dateien** funktionieren hier nicht: Vite lehnt das Inlinen von Icon-Links ab (`noInlineLinkRels`) und `vite-plugin-singlefile` inlined nur JS/CSS — das Asset läge separat neben dem HTML und wäre unter `file://` tot.
- HTML-Dateiname: [scripts/build-with-config.mjs](../../scripts/build-with-config.mjs) — `outputSubdir` + `outputFilename` bestimmen den Zielpfad

## Andere Varianten nicht mit-bauen

`npm run build:prod` / `build:pl` werden **nicht** routinemäßig nach Branding-Änderungen mitgebaut. Nur die geänderte Variant-Config bauen.

## Verifikation

1. `npm run build:dev` (bzw. `:demo` / `:prod` / `:kurator` / `:pl`) — fehlerfrei.
2. `dist-single/<outputFilename>.html` (bzw. `dist-single/<outputSubdir>/<outputFilename>.html`) existiert.
3. Per Doppelklick in Chrome/Edge öffnen (`file://`):
   - Sidebar oben links zeigt `label` (groß) + `sidebarSubtitle` (klein darunter).
   - Browser-Tab zeigt `browserTabTitle` **und** das Favicon in der Variant-Farbe.
   - Console: keine Errors.
4. Favicon zusätzlich im HTML belegen: genau ein `<link rel="icon" href="data:image/svg+xml,…">`, die Farbe darin URL-kodiert (`%23506786`).
