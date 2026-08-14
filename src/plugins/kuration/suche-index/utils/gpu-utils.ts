import { disposeMetadataLLM } from '@/core/services/search/metadata-extractor';
import { embeddingService } from '@/core/services/search/embedding-service';
import { disposeReRanker } from '@/core/services/search/re-ranker'; // PHASE 2: Re-Ranker

/** Entlaedt alle GPU-Modelle und gibt VRAM frei. Gibt Liste der entladenen Modelle zurueck. */
export function unloadAllGPU(): string[] {
  const unloaded: string[] = [];
  disposeMetadataLLM(); unloaded.push('Metadata-LLM');
  if (embeddingService.isReady()) { embeddingService.destroy(); unloaded.push('Embedding'); }
  try { disposeReRanker(); unloaded.push('Re-Ranker'); } catch { /* nicht geladen */ }
  return unloaded;
}

/** Gibt eine lesbare Status-Zeile zurueck, welche Modelle geladen sind. */
export function getGPUStatus(): string {
  const loaded: string[] = [];
  if (embeddingService.isReady()) loaded.push(`Embedding (${embeddingService.getModelId() ?? '?'})`);
  return loaded.length > 0 ? loaded.join(', ') : 'Keine Modelle geladen';
}
