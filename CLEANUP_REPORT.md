# Cleanup Report — 2026-04-11

## Geloeschte Dateien
- `src/core/services/search/fulltext.ts` — MiniSearch-Wrapper (ersetzt durch Orama)
- `src/core/services/search/vector-store.ts` — Alter VectorStore (ersetzt durch Orama)
- `src/core/services/search/hybrid-search.ts` — Alter Hybrid-Combiner (ersetzt durch OramaStore)

## Bereinigte Imports
- Keine verwaisten Imports — die 3 geloeschten Dateien waren nur untereinander referenziert

## LLM-Dropdown bereinigt
- `src/plugins/einstellungen/AIProviderTab.tsx`: COMMON_MODELS von 7 auf 3 Eintraege reduziert
- Entfernt: Qwen 3.5 9B, Gemma 4 26B, Gemma 4 31B, Liquid LFM 24B
- Behalten: gpt-oss-120b (Empfohlen), Nemotron 120B (Gratis), Eigenes Modell...

## Re-Ranker isoliert (PHASE 2)
- `// PHASE 2: Re-Ranker` Kommentare an allen 7 Referenz-Stellen gesetzt
- Conditional-Checks evaluieren sauber zu `false` wenn Feature deaktiviert
- Betroffene Dateien: useSearch.ts, IndexStep.tsx, pipeline-logger.ts, batch-indexer.ts, eval-runner.ts, eval-types.ts, MetadataSmokeTest.tsx

## Debug console.logs entfernt
- `useSearch.ts`: 3 Debug-Logs entfernt (Sync-Meldung, ReRanker-Toggle)
- `re-ranker.ts`: ~15 Debug-Logs entfernt (initReRanker, Modellwechsel, Scoring-Details, Top-5-Listen)
- `embedding-service.ts`: 1 Debug-Log entfernt, 1 durch pipelineLog ersetzt
- `metadata-extractor.ts`: 3 Info-Logs entfernt, unbenutzte Variablen bereinigt
- Behalten: alle console.error (Fehlerbehandlung), alle pipelineLog.* (DEV-gated)

## Entfernte npm Dependencies
- `minisearch` (^7.2.0) — nur von geloeschter fulltext.ts genutzt
- `@codemirror/merge` (^6.12.1) — nirgends importiert

## TypeScript Errors
- Vorher: 0
- Nachher: 0

## Bundlegroesse
- Vorher: 67,362,601 Bytes (67.36 MB)
- Nachher: 67,360,494 Bytes (67.36 MB)
- Differenz: ~2 KB (geloeschte Dateien waren bereits tree-shaken)

## Offene TODOs
- Re-Ranker (PHASE 2): Code bleibt verdrahtet, aber Feature ist deaktiviert. Bei Aktivierung in Phase 2 die PHASE 2 Kommentare entfernen.
- `npm install` ausfuehren nach package.json Aenderung um node_modules zu synchronisieren
