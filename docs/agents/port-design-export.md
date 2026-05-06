# Design-Export aus Claude Design Tool portieren — Quick Reference

Workflow für die Übernahme von Screen-Designs, die im Claude Design Tool (web-basiertes Tool, exportiert pro Screen `.html` + `.png`) erstellt wurden, in TeamFlow-React-Komponenten. Vollständige Workflow-Begründung im Repo-Root unter dem Plan-File aus der ersten Iteration; hier die kompakte Variante zum Quick-Lookup.

## Ablage

```
_design/<screen-name>/<beliebiger-name>.html   # gerendertes Markup, oft 1–2 MB
_design/<screen-name>/<beliebiger-name>.png    # visueller Referenz-Screenshot
```

`_design/` ist in `.gitignore` und in `vite.config.ts` → `server.watch.ignored`. Keine Re-Builds, keine Commits, keine HMR-Reloads.

## Was ich (der Agent) lese

| Datei | Wie | Warum |
|-------|-----|-------|
| `*.png` | Read (multimodal) — komplett | Visuelle Wahrheit. Layout, Hierarchie, Farb-Eindruck. |
| `*.html` | **Niemals voll** — Read mit `offset`/`limit`, oder Grep nach Klassen | Dumps sind 1.8 MB / 900k Tokens, Read-Limit ist 256 KB. Gezielt nach Sektion suchen. |

Strategie pro Screen: zuerst PNG ansehen, mit dem aktuellen React-Code vergleichen, **konkrete** Diff-Punkte identifizieren, dann nur in den HTML-Bereichen nachschlagen, in denen die Diff-Punkte stecken.

## Constraints beim Portieren (TeamFlow-spezifisch)

| Regel | Hintergrund |
|-------|-------------|
| shadcn/ui-Komponenten in `src/components/ui/` bevorzugen | Konsistenz mit Rest der App; das Design-Tool emittiert oft rohes Markup, das wir nicht 1:1 spiegeln wollen. |
| `--tf-*`-CSS-Variablen statt hartkodierter Hex-Farben | Dark-Mode + Theming (`DESIGN_GUIDE.md`). Das Design-Tool bakes oft Hex-Werte in — die müssen ins Token-System überführt werden. |
| `lucide-react` statt eingebettetes SVG aus dem Export | Tree-shakeable, einheitliche Icon-Sprache. |
| Tailwind v4-Utilities statt `style={{}}` | Ausnahmen nur für dynamische Werte (Progress-Bars, dynamische Borders). |
| Single-File-Build-Pflicht: keine externen Asset-Imports, keine `fetch()` für Design-Bilder | Siehe [file-protocol-pitfalls.md](file-protocol-pitfalls.md). |
| Status/Badge-Mapping über vorhandene Helfer | `getStatusVariant` aus `src/core/utils/status-mappings.ts` für Vorgang-Status, `src/components/feedback/constants.ts` für Feedback-Status. **Nicht** neue Status-Maps anlegen. |
| Bestehende Layout-Primitives wiederverwenden | `Badge`, `SectionHeader`, `ListItem`, `Button` aus `@/ui` — nicht durch Design-Markup ersetzen ohne Notwendigkeit. |

## Pro-Screen-Routine

1. **Briefing vom User**: welche Route/Plugin? Was hat sich geändert (Layout, neue Elemente, Typografie, Farben)? Soll ich Detail X 1:1 oder adaptieren?
2. **Diff-Analyse**: PNG ↔ aktueller Komponentenstand. Liste konkreter Änderungen mit Datei + Zeile.
3. **Implementierung**: Änderungen mit Edit-Tool, neue Sub-Komponenten nur extrahieren wenn 300-LOC-Limit erreicht oder klare Verantwortlichkeitsgrenze.
4. **Verifikation**: `npm run dev` + Browser; bei Layout-Changes auch `npm run build:dev` + Doppelklick-Test unter `file://`.
5. **Commit + Push** (Auto-Commit-Memory aktiv) mit Conventional-Commit-Prefix `style(<plugin-id>): …` oder `refactor(<plugin-id>): …`.

## Anti-Patterns

| Don't | Stattdessen |
|-------|-------------|
| HTML-Dump 1:1 als JSX einfügen | Komponenten-Hierarchie verstehen, einzelne Klassen + Layout übernehmen, Logik in den existierenden React-Code mergen. |
| Inline-Hex-Farben aus dem Export übernehmen | In `--tf-*`-Tokens übersetzen oder neuen Token in `DESIGN_GUIDE.md` ergänzen. |
| Eigene Icon-SVGs aus dem Export inlinen | `lucide-react`-Pendant nutzen. |
| Neue Datei-Struktur anlegen, weil das Design „anders" wirkt | Erst prüfen ob bestehende Komponenten reichen. Refactor nur bei klarem Bedarf. |
| Design-Tool-spezifische Klassen (z. B. ID-Hashes, Generator-Marker) übernehmen | Saubere Tailwind-Klassen schreiben. |
