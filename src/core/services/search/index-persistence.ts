import { save, load, create } from '@orama/orama';
import { getOramaDB } from './orama-store';
import type { StorageService } from '@/core/services/storage';

const INDEX_DIR = 'search-index';
const INDEX_FILE = 'orama-index.json';
const META_FILE = 'index-meta.json';

export interface IndexMeta {
  lastUpdate: string;
  modelId: string;
  chunkCount: number;
  docCount: number;
  version: number;
}

export async function saveIndexToFileServer(
  storage: StorageService,
): Promise<boolean> {
  const fs = storage.fs;
  if (!fs || fs.isReadOnly()) return false;

  const db = getOramaDB();
  if (!db) return false;

  try {
    await fs.ensureDir(INDEX_DIR);

    const indexData = save(db);
    await fs.writeJSON(`${INDEX_DIR}/${INDEX_FILE}`, indexData);

    const currentVersion = await getFileServerVersion(storage);
    const meta: IndexMeta = {
      lastUpdate: new Date().toISOString(),
      modelId: await storage.idb.get<string>('index-model-id') ?? '',
      chunkCount: await storage.idb.get<number>('index-chunk-count') ?? 0,
      docCount: 0,
      version: currentVersion + 1,
    };
    await fs.writeJSON(`${INDEX_DIR}/${META_FILE}`, meta);
    await storage.idb.set('index-fs-version', meta.version);

    return true;
  } catch (err) {
    console.error('Failed to save index to file server:', err);
    return false;
  }
}

export async function loadIndexFromFileServer(
  storage: StorageService,
): Promise<boolean> {
  const fs = storage.fs;
  if (!fs) return false;

  try {
    const serverMeta = await fs.readJSON<IndexMeta>(`${INDEX_DIR}/${META_FILE}`);
    if (!serverMeta) return false;

    const localVersion = await storage.idb.get<number>('index-fs-version') ?? 0;
    if (serverMeta.version <= localVersion) return false;

    const indexData = await fs.readJSON<Record<string, unknown>>(`${INDEX_DIR}/${INDEX_FILE}`);
    if (!indexData) return false;

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const db = create({ schema: { id: 'string' } as any });
    load(db!, indexData as any);

    await storage.idb.set('orama-db', indexData);
    await storage.idb.set('index-model-id', serverMeta.modelId);
    await storage.idb.set('index-chunk-count', serverMeta.chunkCount);
    await storage.idb.set('index-last-update', serverMeta.lastUpdate);
    await storage.idb.set('index-fs-version', serverMeta.version);

    return true;
  } catch {
    return false;
  }
}

export async function checkFileServerIndexStatus(
  storage: StorageService,
): Promise<{ available: boolean; newerThanLocal: boolean; meta: IndexMeta | null }> {
  const fs = storage.fs;
  if (!fs) return { available: false, newerThanLocal: false, meta: null };

  try {
    const meta = await fs.readJSON<IndexMeta>(`${INDEX_DIR}/${META_FILE}`);
    if (!meta) return { available: false, newerThanLocal: false, meta: null };

    const localVersion = await storage.idb.get<number>('index-fs-version') ?? 0;
    return { available: true, newerThanLocal: meta.version > localVersion, meta };
  } catch {
    return { available: false, newerThanLocal: false, meta: null };
  }
}

async function getFileServerVersion(storage: StorageService): Promise<number> {
  const fs = storage.fs;
  if (!fs) return 0;
  try {
    const meta = await fs.readJSON<IndexMeta>(`${INDEX_DIR}/${META_FILE}`);
    return meta?.version ?? 0;
  } catch { return 0; }
}
