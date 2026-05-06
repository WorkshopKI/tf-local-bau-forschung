# Neuer Feature-Flag

Build-Time-Flag, der ein Feature/Plugin/Bereich an- oder abschaltet (z.B. `features.dokumentenscan`).

## Touch-Points (Pflicht)

1. **`scripts/config-schema.mjs`** — drei Stellen:
   - `DEFAULT_CONFIG.features.<flag>` (Default-Wert für `npm run dev`)
   - `requiredFlags`-Array in `validateConfig()` (damit alle Variant-Configs den Flag setzen müssen)
   - Ggf. neue `validateConfig()`-Regeln (Abhängigkeiten, Prod-Verbote — vgl. `dokumentenscan` → `scan.file_extensions`)
2. **`src/config/runtime-config.ts`** — Type-Definition `TeamflowFeatures` erweitern, damit TypeScript den Flag kennt.
3. **`src/config/feature-flags.ts`** — Accessor-Funktion (`isXxxEnabled()`) ergänzen, damit Komponenten typsicher zugreifen.
4. **`src/plugins.config.ts`** — falls der Flag ein Plugin gated, in `passesFeatureFlags()` die entsprechende ID-Filter-Bedingung ergänzen.

## Variant-Configs synchronisieren

Alle Variant-Configs unter `configs/` müssen den neuen Flag explizit setzen, sonst schlägt `validateConfig()` fehl:

- `configs/dev.config.json`
- `configs/demo.config.json`
- `configs/foerderprogramm.config.json`
- `configs/_template.config.jsonc` (kommentierte Referenz)

## Sicherheits-Konstellationen

- Flag aktiviert eine Cloud-API (OpenRouter)? → Prod-Lock in `validateConfig()` ergänzen, analog zum bestehenden `openrouter.enabled + variant === 'production'`-Check.
- Flag aktiviert destruktive Dev-Funktionen (Fixtures, Reset)? → Prod/Demo-Verbot ergänzen, analog `features.devFixtures`.

## Runtime vs. Build-Time

`features.kuratorMenus` ist ein Build-Time-Filter, **reicht aber nicht alleine**: Plugin-Sichtbarkeit hängt zusätzlich an `profile.is_kurator` (Runtime). Wenn der neue Flag nur Build-Time wirkt, kommentieren analog zu `passesFeatureFlags()`.

## Verifikation

- `npx tsc --noEmit` — Typ-Lücke in Variant-Configs sichtbar (alle drei Variant-Configs aktualisieren)
- `npm run build:dev` — Dev-Build mit dem neuen Flag baut
- Bei Plugin-Gating: `VITE_PLUGINS=…` zur Sicherheit nicht setzen, dann Sidebar-Sichtbarkeit prüfen
