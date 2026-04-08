import type { StorageService } from '@/core/services/storage';

export interface IndexCheckpoint {
  processedDocIds: string[];
  totalDocs: number;
  chunkCount: number;
  startTime: string;
  lastUpdate: string;
  modelId: string;
  metadataLLMId: string | null;
}

const CHECKPOINT_KEY = 'index-checkpoint';

export async function saveCheckpoint(
  storage: StorageService,
  checkpoint: IndexCheckpoint,
): Promise<void> {
  await storage.idb.set(CHECKPOINT_KEY, checkpoint);
}

export async function loadCheckpoint(
  storage: StorageService,
): Promise<IndexCheckpoint | null> {
  return storage.idb.get<IndexCheckpoint>(CHECKPOINT_KEY);
}

export async function clearCheckpoint(
  storage: StorageService,
): Promise<void> {
  await storage.idb.delete(CHECKPOINT_KEY);
}

export function isDocProcessed(checkpoint: IndexCheckpoint | null, docId: string): boolean {
  if (!checkpoint) return false;
  return checkpoint.processedDocIds.includes(docId);
}

export function estimateRemainingTime(checkpoint: IndexCheckpoint): string {
  const processed = checkpoint.processedDocIds.length;
  const remaining = checkpoint.totalDocs - processed;
  if (processed === 0 || remaining <= 0) return '';

  const elapsed = Date.now() - new Date(checkpoint.startTime).getTime();
  const msPerDoc = elapsed / processed;
  const remainingMs = msPerDoc * remaining;

  const minutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) return `~${hours}h ${mins}min`;
  if (minutes > 0) return `~${minutes} min`;
  return '< 1 min';
}
