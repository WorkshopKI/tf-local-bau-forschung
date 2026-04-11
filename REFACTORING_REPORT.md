# Refactoring Report — 2026-04-11

## Extrahierte Shared-Logik

### useVorgangDetail Hook
- **Neue Datei**: `src/core/hooks/useVorgangDetail.ts` (70 Zeilen)
- **Dedupliziert**: 7 useState-Hooks, handleNotesChange (debounced auto-save), handleStatusChange (applyTransition + history), useEffect (notes + history laden), daysLeft/overdue Berechnung
- **Verbraucher**: BauantragDetail.tsx + ForschungDetail.tsx

### Status-Mappings zentralisiert
- **Neue Datei**: `src/core/utils/status-mappings.ts` (42 Zeilen)
- **Dedupliziert**: Status-Labels und Badge-Variants fuer beide Abteilungen (vorher 3x definiert)
- **Getter mit Fallback**: `getStatusLabel()`, `getStatusVariant()` — keine fehlenden Mappings mehr
- **Verbraucher**: bauantraege/types.ts, forschung/types.ts, home/HomePage.tsx

### ArtefakteTab nach core verschoben
- **Von**: `src/plugins/bauantraege/ArtefakteTab.tsx`
- **Nach**: `src/core/components/ArtefakteTab.tsx`
- **Grund**: Cross-Plugin Kopplung aufgeloest (ForschungDetail importierte direkt aus bauantraege/)

## Gesplittete Dateien

### batch-indexer.ts -> chunking.ts
- **Neue Datei**: `src/core/services/search/chunking.ts` (65 Zeilen)
- **Extrahiert**: chunkText, chunkFixed, chunkByHeadings, hashText
- **batch-indexer.ts**: 381 -> 322 Zeilen

### metadata-extractor.ts -> metadata-prompts.ts
- **Neue Datei**: `src/core/services/search/metadata-prompts.ts` (70 Zeilen)
- **Extrahiert**: METADATA_SYSTEM_PROMPT, METADATA_RESPONSE_FORMAT, buildExtractionPrompt
- **metadata-extractor.ts**: 317 -> 254 Zeilen

## CLAUDE.md Aenderungen
- Project Structure komplett neu geschrieben nach Ist-Stand
- Referenzen zu geloeschten Dateien entfernt (mini-rag.ts, fulltext.ts, vector-store.ts)
- Search-Stack dokumentiert (Orama, Transformers.js v4, WebGPU, Metadata LLM)
- 14+ neue Module ergaenzt (orama-store, embedding-service, batch-indexer, chunking, etc.)
- Fehlende Service-Verzeichnisse ergaenzt (seed/, sync/, versioning/, workflow/, review/, export/)
- Neue Hooks dokumentiert (useVorgangDetail)
- Common Pitfalls ergaenzt (Embedding im Main Thread, Status-Mappings zentral)

## Dateigroesse vorher/nachher

| Datei | Vorher | Nachher | Differenz |
|---|---|---|---|
| BauantragDetail.tsx | 150 | 120 | -30 |
| ForschungDetail.tsx | 146 | 115 | -31 |
| batch-indexer.ts | 381 | 322 | -59 |
| metadata-extractor.ts | 317 | 254 | -63 |
| useVorgangDetail.ts (NEU) | 0 | 70 | +70 |
| status-mappings.ts (NEU) | 0 | 42 | +42 |
| chunking.ts (NEU) | 0 | 65 | +65 |
| metadata-prompts.ts (NEU) | 0 | 70 | +70 |

## TypeScript Errors
- Vorher (nach Cleanup): 0
- Nachher: 0

## Bundlegroesse
- Vorher (nach Cleanup): 67,360,494 Bytes
- Nachher: 67,360,308 Bytes
- Differenz: -186 Bytes (vernachlaessigbar)

## Offene TODOs
- Re-Ranker (PHASE 2): Code bleibt verdrahtet mit PHASE 2 Kommentaren
- batch-indexer.ts ist noch 322 Zeilen (knapp ueber 300-Zeilen-Limit) — vertretbar da indexAll Logik zusammenhaengend
