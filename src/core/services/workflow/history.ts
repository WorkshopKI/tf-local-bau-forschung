import type { StorageService } from '@/core/services/storage';

export interface HistoryEntry {
  timestamp: string;
  fromStatus: string;
  toStatus: string;
  user: string;
  comment?: string;
}

export async function loadHistory(vorgangId: string, storage: StorageService): Promise<HistoryEntry[]> {
  const entries = await storage.idb.get<HistoryEntry[]>(`history:${vorgangId}`);
  return entries ?? [];
}

export async function addHistoryEntry(
  vorgangId: string,
  entry: HistoryEntry,
  storage: StorageService,
): Promise<void> {
  const existing = await loadHistory(vorgangId, storage);
  existing.unshift(entry);
  await storage.idb.set(`history:${vorgangId}`, existing);
}
