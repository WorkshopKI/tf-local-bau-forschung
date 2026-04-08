import type { StorageService } from '@/core/services/storage';

export function getModelSource(
  storage: StorageService,
  _modelName: string,
): { source: 'cache' | 'fileserver' | 'huggingface'; path?: string } {
  const modelStore = storage.getModelDirectoryStore();
  if (modelStore) {
    return { source: 'fileserver' };
  }
  return { source: 'huggingface' };
}

export async function listAvailableModels(
  storage: StorageService,
): Promise<string[]> {
  const modelStore = storage.getModelDirectoryStore();
  if (!modelStore) return [];
  try {
    const dirs = await modelStore.listDirectories('.');
    return dirs;
  } catch {
    return [];
  }
}

export async function isModelAvailableLocally(
  storage: StorageService,
  modelDirName: string,
): Promise<boolean> {
  const modelStore = storage.getModelDirectoryStore();
  if (!modelStore) return false;
  try {
    return await modelStore.exists(`${modelDirName}/config.json`);
  } catch {
    return false;
  }
}
