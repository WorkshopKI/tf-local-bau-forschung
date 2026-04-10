import { embeddingService, TRANSFORMERS_LIB_VERSION } from './embedding-service';
import type { EmbeddingProgress } from './embedding-service';
import type { EmbeddingModelConfig } from './model-registry';
import { createOramaDB, loadOramaFromDB, insertDoc, saveOramaToDB, getOramaDB, getStoredDimensions, saveOramaDimensions } from './orama-store';
import type { StorageService } from '@/core/services/storage';
import { extractMetadata, initMetadataLLM, disposeMetadataLLM, getCachedMetadata, setCachedMetadata } from './metadata-extractor';
import type { DocumentMetadata, MetadataStorage } from './metadata-extractor';
import { contextualChunk } from './contextual-chunker';
import type { ContextualChunk } from './contextual-chunker';
import { saveCheckpoint, loadCheckpoint, clearCheckpoint, isDocProcessed } from './checkpoint';
import type { IndexCheckpoint } from './checkpoint';
import { pipelineLog } from './pipeline-logger';

export interface IndexStatus {
  phase: string;
  total: number;
  processed: number;
  currentDoc: string;
  skipped: number;
  modelProgress?: { status: string; loaded?: number; total?: number };
  chunkProgress?: { current: number; total: number };
}

const CHUNK_CONFIG = { size: 400, overlap: 75 };

export interface PipelineConfig {
  embeddingModelId: string;
  metadataLLMId: string | null;
  metadataParallelism?: number;
  metadataContext?: number;
  metadataPreferGPU?: boolean;
  useContextualPrefixes: boolean;
  useReRanker: boolean;
  resumeFromCheckpoint: boolean;
}

interface DocToProcess {
  id: string; filename: string; markdown: string; hash: string;
}

async function extractMetadataBatch(
  docs: DocToProcess[], parallelism: number, storage: MetadataStorage, modelId: string,
  contextTokens: number,
  onProgress: (done: number, total: number, currentDoc: string) => void,
): Promise<Map<string, DocumentMetadata>> {
  const results = new Map<string, DocumentMetadata>();
  let done = 0;
  for (let i = 0; i < docs.length; i += parallelism) {
    const batch = docs.slice(i, i + parallelism);
    const batchResults = await Promise.all(
      batch.map(async (doc) => {
        const cached = await getCachedMetadata(storage, doc.id, doc.hash, modelId);
        if (cached) return { id: doc.id, metadata: cached, fromCache: true };
        const metadata = await extractMetadata(doc.filename, doc.markdown, contextTokens);
        if (!metadata._isFallback) {
          await setCachedMetadata(storage, doc.id, doc.hash, modelId, metadata);
        }
        return { id: doc.id, metadata, fromCache: false };
      }),
    );
    for (const r of batchResults) results.set(r.id, r.metadata);
    done += batchResults.length;
    const lastName = batch[batch.length - 1]?.filename ?? '';
    onProgress(done, docs.length, lastName);
  }
  return results;
}

/** Heading-basiert mit Fallback auf Fixed 400W, 75 Overlap */
function chunkText(text: string): string[] {
  return chunkByHeadings(text);
}

function chunkFixed(text: string, size: number, overlap: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    const chunk = words.slice(i, i + size).join(' ');
    if (chunk.trim().length > 20) chunks.push(chunk);
    if (i + size >= words.length) break;
  }
  return chunks.length > 0 ? chunks : [text];
}

function chunkByHeadings(text: string): string[] {
  const sections = text.split(/(?=^#{2,3}\s)/m);
  const chunks: string[] = [];
  let buffer = '';

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    const wordCount = trimmed.split(/\s+/).length;

    if (wordCount < 50 && buffer) {
      buffer += '\n\n' + trimmed;
      continue;
    }
    if (buffer) {
      if (buffer.split(/\s+/).length > 500) {
        chunks.push(...chunkFixed(buffer, 400, 75));
      } else { chunks.push(buffer); }
      buffer = '';
    }
    if (wordCount > 500) {
      const headingMatch = trimmed.match(/^(#{2,3}\s+.+)\n/);
      const heading = headingMatch ? headingMatch[1]! : '';
      const body = heading ? trimmed.slice(heading.length).trim() : trimmed;
      for (const sub of chunkFixed(body, 400, 75)) {
        chunks.push(heading ? `${heading}\n${sub}` : sub);
      }
    } else { buffer = trimmed; }
  }

  if (buffer) {
    const bw = buffer.split(/\s+/).length;
    if (bw > 500) chunks.push(...chunkFixed(buffer, 400, 75));
    else if (bw > 20) chunks.push(buffer);
  }

  return chunks.length > 0 ? chunks : chunkFixed(text, 400, 75);
}

async function hashText(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export class BatchIndexer {
  private ready = false;
  private modelConfig: EmbeddingModelConfig | null = null;

  async init(
    modelConfig: EmbeddingModelConfig,
    preferGPU = false,
    onStatus?: (status: IndexStatus) => void,
  ): Promise<void> {
    this.modelConfig = modelConfig;
    await embeddingService.init(modelConfig, preferGPU, (p: EmbeddingProgress) => {
      onStatus?.({
        phase: p.phase === 'loading' ? 'Modell laden' : 'Bereit',
        total: 0, processed: 0, currentDoc: '', skipped: 0,
        modelProgress: p.modelProgress,
      });
    });
    this.ready = true;
  }

  async indexAll(
    storage: StorageService,
    config: PipelineConfig,
    onStatus: (status: IndexStatus) => void,
    signal?: AbortSignal,
  ): Promise<number> {
    if (!this.ready || !this.modelConfig) throw new Error('Not initialized');

    // Auto-force full reindex bei Modellwechsel
    const currentIndexModel = await storage.idb.get<string>('index-model-id');
    if (currentIndexModel && currentIndexModel !== this.modelConfig.id) {
      await storage.idb.delete('index-manifest');
      pipelineLog.warn('Indexer', `Modellwechsel erkannt: ${currentIndexModel} → ${this.modelConfig.id}`);
    }

    // Dimensionswechsel: Alte Orama-DB MUSS geloescht werden
    const storedDimensions = await getStoredDimensions(storage.idb);
    const newDimensions = this.modelConfig.dimensions;
    if (storedDimensions && storedDimensions !== newDimensions) {
      pipelineLog.warn('Indexer', `Dimensionswechsel: ${storedDimensions}d → ${newDimensions}d — DB wird neu erstellt`);
      await storage.idb.delete('orama-db');
      await storage.idb.delete('index-manifest');
    }

    // Library-Versionswechsel: Index invalidieren (ONNX-Format-Aenderungen)
    const storedLibVersion = await storage.idb.get<number>('index-transformers-version');
    if (storedLibVersion && storedLibVersion !== TRANSFORMERS_LIB_VERSION) {
      pipelineLog.warn('Indexer', `Transformers.js v${storedLibVersion} → v${TRANSFORMERS_LIB_VERSION} — Index wird neu gebaut`);
      await storage.idb.delete('orama-db');
      await storage.idb.delete('index-manifest');
    }

    // Bei inkrementeller Indexierung: bestehende DB laden, bei Full: frische DB
    const manifest0 = await storage.idb.get<Record<string, string>>('index-manifest') ?? {};
    const isFull = Object.keys(manifest0).length === 0;
    if (isFull) {
      createOramaDB(this.modelConfig.dimensions);
    } else {
      const loaded = await loadOramaFromDB(storage.idb);
      if (!loaded || !getOramaDB()) {
        createOramaDB(this.modelConfig.dimensions);
      }
    }

    const docs = await storage.idb.keys('doc:');
    pipelineLog.indexSummary({
      embeddingModel: this.modelConfig.label,
      metadataLLM: config.metadataLLMId ?? null,
      contextualPrefixes: config.useContextualPrefixes,
      totalDocs: docs.length,
      backend: embeddingService.isReady() ? 'bereit' : 'nicht geladen',
    });
    const manifest = await storage.idb.get<Record<string, string>>('index-manifest') ?? {};
    let totalChunks = isFull ? 0 : (await storage.idb.get<number>('index-chunk-count') ?? 0);
    let processed = 0;
    let skipped = 0;
    const docChunkCounts: Record<string, number> = isFull
      ? {}
      : (await storage.idb.get<Record<string, number>>('doc-chunk-counts') ?? {});

    // Checkpoint: resume support
    let checkpoint: IndexCheckpoint | null = null;
    if (config.resumeFromCheckpoint) {
      checkpoint = await loadCheckpoint(storage);
      if (checkpoint && checkpoint.modelId !== this.modelConfig.id) {
        checkpoint = null; // Model changed, discard checkpoint
      }
    }

    // Init metadata LLM if configured
    const useLLM = config.metadataLLMId != null && config.metadataLLMId !== 'none';
    if (useLLM) {
      onStatus({ phase: 'LLM laden', total: docs.length, processed: 0, currentDoc: '', skipped: 0 });
      await initMetadataLLM(config.metadataLLMId!, (msg) => {
        onStatus({ phase: msg, total: docs.length, processed: 0, currentDoc: '', skipped: 0 });
      }, storage);
    }

    // Fast-Path: bei inkrementeller Indexierung prüfen ob alle Hashes stimmen
    if (!isFull && Object.keys(manifest).length > 0) {
      onStatus({ phase: 'Prüfe Index...', total: docs.length, processed: 0, currentDoc: '', skipped: 0 });
      let allCurrent = true;
      for (const key of docs) {
        const doc = await storage.idb.get<{ id: string; markdown: string }>(key);
        if (!doc) continue;
        const hash = await hashText(doc.markdown);
        if (manifest[doc.id] !== hash) { allCurrent = false; break; }
      }
      if (allCurrent) {
        pipelineLog.info('Indexer', 'Index ist aktuell — nichts zu tun');
        if (useLLM) disposeMetadataLLM();
        return totalChunks;
      }
    }

    onStatus({ phase: 'Scanning', total: docs.length, processed: 0, currentDoc: '', skipped: 0 });

    // Phase A: Collect docs that need processing, extract metadata in parallel
    const docsToProcess: DocToProcess[] = [];
    for (const key of docs) {
      if (signal?.aborted) break;
      const doc = await storage.idb.get<{ id: string; filename: string; markdown: string }>(key);
      if (!doc) continue;
      if (isDocProcessed(checkpoint, doc.id)) { skipped++; processed++; continue; }
      const hash = await hashText(doc.markdown);
      if (manifest[doc.id] === hash) { skipped++; processed++; continue; }
      docsToProcess.push({ id: doc.id, filename: doc.filename, markdown: doc.markdown, hash });
    }

    let metadataMap = new Map<string, DocumentMetadata>();
    if (useLLM && docsToProcess.length > 0) {
      const parallelism = config.metadataParallelism ?? 3;
      const contextTokens = config.metadataContext ?? 8192;
      const phaseLabel = 'Metadata (parallel)';
      onStatus({ phase: phaseLabel, total: docsToProcess.length, processed: 0, currentDoc: '', skipped });
      metadataMap = await extractMetadataBatch(docsToProcess, parallelism, storage, config.metadataLLMId!,
        contextTokens,
        (done, total, currentDoc) => {
          onStatus({ phase: `Metadata ${done}/${total}`, total: docs.length, processed: skipped + done, currentDoc, skipped });
        },
      );
    }

    // Phase B: Chunk + Embed sequentially (wie bisher)
    for (const doc of docsToProcess) {
      if (signal?.aborted) break;

      const metadata: DocumentMetadata | null = metadataMap.get(doc.id) ?? null;

      // Chunk: contextual or plain
      let textsToEmbed: string[];
      let chunkIds: string[];
      let chunkTexts: string[];
      let tags: string;

      if (config.useContextualPrefixes) {
        onStatus({ phase: 'Chunking (contextual)', total: docs.length, processed, currentDoc: doc.filename, skipped });
        const ctxChunks: ContextualChunk[] = contextualChunk(doc.id, doc.filename, doc.markdown, metadata, CHUNK_CONFIG.size, CHUNK_CONFIG.overlap);
        textsToEmbed = ctxChunks.map(c => c.prefixedText);
        chunkIds = ctxChunks.map(c => c.id);
        chunkTexts = ctxChunks.map(c => c.text);
        tags = metadata?.topic_tags?.join(', ') ?? '';
      } else {
        onStatus({ phase: 'Chunking', total: docs.length, processed, currentDoc: doc.filename, skipped });
        const plainChunks = chunkText(doc.markdown);
        textsToEmbed = plainChunks;
        chunkIds = plainChunks.map((_, i) => `${doc.id}-${i}`);
        chunkTexts = plainChunks;
        tags = metadata?.topic_tags?.join(', ') ?? '';
      }

      onStatus({ phase: 'Embedding', total: docs.length, processed, currentDoc: doc.filename, skipped });
      const vectors = await embeddingService.embedBatch(
        textsToEmbed, this.modelConfig, 'document',
        (current, total) => {
          onStatus({
            phase: 'Embedding', total: docs.length, processed,
            currentDoc: doc.filename, skipped,
            chunkProgress: { current, total },
          });
        },
        signal,
      );

      for (let i = 0; i < chunkTexts.length; i++) {
        insertDoc({
          id: chunkIds[i] ?? `${doc.id}-${i}`,
          text: chunkTexts[i] ?? '',
          title: doc.filename,
          source: doc.filename,
          tags,
          type: 'dokument',
          embedding: vectors[i] ?? [],
        });
        totalChunks++;
        docChunkCounts[doc.filename] = (docChunkCounts[doc.filename] ?? 0) + 1;
      }

      manifest[doc.id] = doc.hash;
      processed++;
      onStatus({ phase: 'Done', total: docs.length, processed, currentDoc: doc.filename, skipped });

      // Save checkpoint every 10 docs
      if (processed % 10 === 0) {
        const cp: IndexCheckpoint = {
          processedDocIds: Object.keys(manifest),
          totalDocs: docs.length,
          chunkCount: totalChunks,
          startTime: checkpoint?.startTime ?? new Date().toISOString(),
          lastUpdate: new Date().toISOString(),
          modelId: this.modelConfig.id,
          metadataLLMId: config.metadataLLMId ?? null,
        };
        await saveCheckpoint(storage, cp);
      }
    }

    // Dispose LLM if loaded
    if (useLLM) {
      disposeMetadataLLM();
    }

    await saveOramaToDB(storage.idb);
    await storage.idb.set('index-chunk-count', totalChunks);
    await storage.idb.set('index-manifest', manifest);
    await storage.idb.set('index-last-update', new Date().toISOString());
    await storage.idb.set('index-model-id', this.modelConfig.id);
    await storage.idb.set('doc-chunk-counts', docChunkCounts);
    await saveOramaDimensions(storage.idb, this.modelConfig.dimensions);
    await storage.idb.set('index-transformers-version', TRANSFORMERS_LIB_VERSION);

    // Clear checkpoint on success
    await clearCheckpoint(storage);

    // Index auf File Server speichern (wenn verbunden)
    try {
      const { saveIndexToFileServer } = await import('./index-persistence');
      await saveIndexToFileServer(storage);
    } catch { /* File Server nicht verfuegbar */ }

    pipelineLog.info('Indexer', `Fertig: ${totalChunks} Chunks aus ${processed} Dokumenten (${skipped} uebersprungen)`);
    return totalChunks;
  }

  destroy(): void {
    this.ready = false;
    this.modelConfig = null;
  }
}
