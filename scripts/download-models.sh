#!/bin/bash
# Lädt alle ONNX-Modelle für TeamFlow herunter.
# Aufruf: ./scripts/download-models.sh /pfad/zum/modell-verzeichnis

MODEL_DIR="${1:-.}"

echo "=== TeamFlow Modell-Download ==="
echo "Zielverzeichnis: $MODEL_DIR"

# Embedding-Modelle
echo ">>> EmbeddingGemma 300M (~200MB)..."
npx @huggingface/cli download onnx-community/EmbeddingGemma-300M-ONNX --local-dir "$MODEL_DIR/embedding-gemma-300m" --include "onnx/*q8*" "*.json"

echo ">>> Qwen3 Embedding 0.6B (~560MB)..."
npx @huggingface/cli download onnx-community/Qwen3-Embedding-0.6B-ONNX --local-dir "$MODEL_DIR/qwen3-embedding-0.6b" --include "onnx/*q8*" "*.json"

# Metadata-LLMs
echo ">>> Gemma 4 E2B (~1.5GB)..."
npx @huggingface/cli download onnx-community/gemma-4-E2B-it-ONNX --local-dir "$MODEL_DIR/gemma-4-e2b" --include "onnx/*q8*" "*.json"

echo ">>> Gemma 4 E4B (~3GB)..."
npx @huggingface/cli download onnx-community/gemma-4-E4B-it-ONNX --local-dir "$MODEL_DIR/gemma-4-e4b" --include "onnx/*q8*" "*.json"

echo ">>> Qwen 3 4B (~3.5GB)..."
npx @huggingface/cli download onnx-community/Qwen3-4B-ONNX --local-dir "$MODEL_DIR/qwen3-4b" --include "onnx/*q8*" "*.json"

echo ">>> Qwen 3.5 2B (~2.2GB)..."
npx @huggingface/cli download onnx-community/Qwen3.5-2B-ONNX --local-dir "$MODEL_DIR/qwen35-2b" --include "onnx/*q8*" "*.json"

# Re-Ranker
echo ">>> ms-marco MiniLM Re-Ranker (~40MB)..."
npx @huggingface/cli download cross-encoder/ms-marco-MiniLM-L-6-v2 --local-dir "$MODEL_DIR/ms-marco-reranker" --include "onnx/*" "*.json"

echo "=== Fertig. Alle Modelle in: $MODEL_DIR ==="
ls -la "$MODEL_DIR"
