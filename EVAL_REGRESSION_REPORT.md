# Eval-Regression Report — 2026-04-11

## Root Cause

**Geaendertes Metadata-LLM** hat die kontextuellen Prefixes und damit die Embedding-Vektoren veraendert.

Die Kausalkette:

1. Metadata-LLM wurde gewechselt (z.B. von API-Modell auf `browser-nemotron`)
2. Metadata-Cache (`metadata-extractor.ts:115-123`) prueft `modelId` — bei Wechsel wird gesamter Cache invalidiert
3. Neues LLM produziert andere `doc_type`, `micro_summary`, `macro_summary`
4. `contextual-chunker.ts:48-49` baut Prefixes aus Metadata: `[doc_type] micro_summary\nchunkText`
5. `batch-indexer.ts:254` embedded die **prefixed** Texte — andere Prefixes = andere Vektoren
6. Semantisch schwierige Queries verlieren ihre Top-Treffer

**Kein Code-Bug.** Alle Search-Kernmodule (`orama-store.ts`, `query-embedder.ts`, `chunking.ts`, `eval/*`) sind seit dem letzten funktionierenden Stand (4b32f3d) inhaltlich unveraendert.

## Chunk-Differenz (1099 vs 1055)

`contextual-chunker.ts:22-33` fuegt pro Dokument einen **Summary-Chunk** hinzu, wenn `macro_summary.length > 50`.

- Altes LLM: ~47 Dokumente mit brauchbarer macro_summary
- Neues LLM: ~91 Dokumente mit brauchbarer macro_summary (bessere Extraktion)
- Differenz: **+44 Summary-Chunks** (= 1055 + 44 = 1099)

Zusaetzlich aendert die Score-Normalisierung in `orama-store.ts:66-71` (`score * 1/log2(chunkCount+1)`) den Normalisierungsfaktor leicht, wenn ein Dokument einen Chunk mehr hat.

## Betroffene Tests

| Test | Query | Erwartet | Ursache |
|---|---|---|---|
| S15 | Foerdergelder Nachhaltigkeit | FA009, FA013, FA016 | Abstraktes Konzept — andere Prefixes verschieben Embedding-Naehe |
| X2 | Risse in Beton erkennen Bruecke | API_090 (Rissdiagnose) | Near-Miss Distraktor — anderer Prefix kippt Score-Abstand zu FA001/API_053 |

Bereits vorher fehlgeschlagen (unveraendert): S7, X3, X4, X6

## Git-Diff-Analyse (4b32f3d → HEAD)

| Datei | Aenderung | Eval-Relevant? |
|---|---|---|
| `chunking.ts` | NEU (extrahiert aus batch-indexer) | Nein — Logik 1:1 |
| `batch-indexer.ts` | VRAM-Sequencing fuer Browser-LLM | Nein — Indexing-Reihenfolge, nicht Logik |
| `metadata-extractor.ts` | Browser-LLM Backend + Date-Sanitierung | **JA** — anderes LLM = andere Metadata |
| `metadata-prompts.ts` | NEU (extrahiert) | Nein — Prompts unveraendert |
| `browser-llm.ts` | NEU (Nemotron 4B) | Indirekt — neues LLM-Backend |
| `orama-store.ts` | Keine | Nein |
| `query-embedder.ts` | Keine | Nein |
| `eval/*` | Keine | Nein |
| `example-docs.ts` | Keine | Nein |

## Fix-Vorschlag

### Option A: Baseline wiederherstellen (schnell)
1. Im Browser das **gleiche Metadata-LLM** wie am 9.4.2026 auswaehlen (vermutlich `openrouter-gpt-oss` oder `intern-gpt-oss`)
2. Metadata-Cache leeren (wird automatisch durch modelId-Mismatch gemacht)
3. Index komplett neu aufbauen (Full Reindex)
4. Eval erneut laufen lassen

### Option B: Neue Baseline mit besserem LLM (empfohlen)
1. Den aktuellen Index mit dem neuen LLM (z.B. `browser-nemotron`) als neue Baseline akzeptieren
2. Fehlgeschlagene Tests S15 und X2 analysieren:
   - Top-5 Ergebnisse pruefen — sind die Treffer qualitativ sinnvoll?
   - Falls ja: `expectedDocs` in `test-cases.ts` anpassen
   - Falls nein: Metadata-Prompts in `metadata-prompts.ts` tunen
3. Neue Baseline-Metriken dokumentieren

### Option C: Score-Normalisierung anpassen
Die `log2(chunkCount+1)`-Normalisierung in `orama-store.ts:66-71` bestraft Dokumente mit Summary-Chunk staerker. Moegliche Anpassung: Summary-Chunks (`level: 'summary'`) nicht mitzaehlen, oder Normalisierung abschwaechen.
