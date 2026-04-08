# Claude Code Prompt: Default auf EmbeddingGemma + E5 Small entfernen

## Kontext

Eval-Ergebnisse der drei Embedding-Modelle:
- MiniLM L6 v2: 17/20 (Baseline, schnellste Indexierung 15s)
- Multilingual E5 Small: 15/20 (schlechtestes Ergebnis, 11:21 min Indexierung)
- EmbeddingGemma 300M: 17/20 (gleich wie MiniLM, aber S1+S15 bestanden, 1:21 min)

Entscheidung: EmbeddingGemma wird Default, MiniLM bleibt als Backup, E5 Small wird entfernt.

## Änderungen

### 1. `src/core/services/search/model-registry.ts`

- `DEFAULT_MODEL_ID` von `'minilm-l6-v2'` auf `'embeddinggemma-300m'` ändern
- Den kompletten E5-Small-Eintrag aus dem `EMBEDDING_MODELS`-Array entfernen (id: `'multilingual-e5-small'`)

### 2. Verifizieren

- `npm run build:single` muss fehlerfrei bauen
- Keine andere Datei referenziert `'multilingual-e5-small'` direkt — nur die Registry. Prüfe trotzdem mit `grep -r "e5-small\|e5.small\|multilingual-e5" src/` dass nichts übrig bleibt.
