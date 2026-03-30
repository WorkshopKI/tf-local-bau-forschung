import type { StorageService } from '@/core/services/storage';

export interface ScanResult {
  total: number;
  imported: number;
  updated: number;
  unchanged: number;
  errors: number;
}

export interface ScanProgress {
  phase: 'scanning' | 'importing' | 'done';
  current: number;
  total: number;
  currentFile: string;
}

interface DocFileInfo {
  path: string;
  name: string;
  directoryId: string;
  directoryLabel: string;
}

export async function scanDocDirectories(
  storage: StorageService,
): Promise<DocFileInfo[]> {
  const docDirs = storage.getDocDirectories();
  const files: DocFileInfo[] = [];

  for (const dir of docDirs) {
    const store = storage.getDirectoryStore(dir.id);
    if (!store) continue;

    try {
      const mdFiles = await store.listFiles('.', '.md');
      for (const filename of mdFiles) {
        files.push({ path: filename, name: filename, directoryId: dir.id, directoryLabel: dir.label });
      }

      // Unterverzeichnisse scannen (1 Ebene)
      const subDirs = await store.listDirectories('.');
      for (const subDir of subDirs) {
        try {
          const subFiles = await store.listFiles(subDir, '.md');
          for (const filename of subFiles) {
            files.push({ path: `${subDir}/${filename}`, name: filename, directoryId: dir.id, directoryLabel: dir.label });
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  return files;
}

export async function importDocuments(
  storage: StorageService,
  files: DocFileInfo[],
  onProgress?: (p: ScanProgress) => void,
): Promise<ScanResult> {
  const result: ScanResult = { total: files.length, imported: 0, updated: 0, unchanged: 0, errors: 0 };
  const fileHashes = await storage.idb.get<Record<string, string>>('doc-file-hashes') ?? {};

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    onProgress?.({ phase: 'importing', current: i + 1, total: files.length, currentFile: file.name });

    try {
      const store = storage.getDirectoryStore(file.directoryId);
      if (!store) { result.errors++; continue; }

      const content = await store.readFile(file.path);
      const hash = await hashText(content);
      const docId = `fs-${file.directoryId}-${file.path}`.replace(/[^a-zA-Z0-9-_]/g, '-');

      if (fileHashes[docId] === hash) { result.unchanged++; continue; }

      const existing = await storage.idb.get(`doc:${docId}`);
      await storage.idb.set(`doc:${docId}`, {
        id: docId, filename: file.name, markdown: content,
        tags: [file.directoryLabel], source: 'filesystem',
        path: file.path, directoryId: file.directoryId,
      });
      fileHashes[docId] = hash;

      if (existing) { result.updated++; } else { result.imported++; }
    } catch { result.errors++; }
  }

  await storage.idb.set('doc-file-hashes', fileHashes);
  onProgress?.({ phase: 'done', current: files.length, total: files.length, currentFile: '' });
  return result;
}

export async function countChangedDocuments(
  storage: StorageService,
): Promise<{ newFiles: number; totalFiles: number }> {
  const files = await scanDocDirectories(storage);
  const fileHashes = await storage.idb.get<Record<string, string>>('doc-file-hashes') ?? {};

  let newFiles = 0;
  for (const file of files) {
    const docId = `fs-${file.directoryId}-${file.path}`.replace(/[^a-zA-Z0-9-_]/g, '-');
    if (!fileHashes[docId]) newFiles++;
  }

  return { newFiles, totalFiles: files.length };
}

async function hashText(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
