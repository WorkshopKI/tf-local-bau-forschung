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

const DOCS_DIR = 'documents';
const DOCS_MANIFEST = 'documents/manifest.json';

interface DocManifestEntry {
  id: string;
  filename: string;
  hash: string;
  tags: string[];
  importedAt: string;
}

export interface DocManifest {
  version: number;
  updatedAt: string;
  entries: Record<string, DocManifestEntry>;
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

/**
 * Löscht ALLE filesystem-importierten Dokumente aus IDB.
 * Entfernt: doc:fs-* und doc:DOC-* mit source='filesystem' oder source='upload'.
 * Seed-Dokumente (kein source-Feld oder source='seed') bleiben erhalten.
 */
export async function purgeFilesystemDocs(
  storage: StorageService,
): Promise<number> {
  const keys = await storage.idb.keys('doc:');
  let removed = 0;

  for (const key of keys) {
    // Alle fs-Prefix-Einträge sofort löschen (alte und neue IDs)
    if (key.startsWith('doc:fs-')) {
      await storage.idb.delete(key);
      removed++;
      continue;
    }

    // DOC-Timestamp-Einträge prüfen
    if (key.startsWith('doc:DOC-')) {
      const doc = await storage.idb.get<{ source?: string }>(key);
      if (doc?.source === 'filesystem' || doc?.source === 'upload') {
        await storage.idb.delete(key);
        removed++;
      }
    }
  }

  // Hashes zurücksetzen damit nächster Import sauber startet
  await storage.idb.delete('doc-file-hashes');

  return removed;
}

export async function importDocuments(
  storage: StorageService,
  files: DocFileInfo[],
  onProgress?: (p: ScanProgress) => void,
): Promise<ScanResult> {
  // Nuklear-Bereinigung: alle alten filesystem-Einträge entfernen
  const purged = await purgeFilesystemDocs(storage);
  if (purged > 0) console.log(`Cleanup: ${purged} alte Einträge entfernt`);

  const result: ScanResult = { total: files.length, imported: 0, updated: 0, unchanged: 0, errors: 0 };
  const fileHashes = await storage.idb.get<Record<string, string>>('doc-file-hashes') ?? {};
  const importedDocs: Array<{ id: string; filename: string; markdown: string; tags: string[]; hash: string }> = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    onProgress?.({ phase: 'importing', current: i + 1, total: files.length, currentFile: file.name });

    try {
      const store = storage.getDirectoryStore(file.directoryId);
      if (!store) { result.errors++; continue; }

      const content = await store.readFile(file.path);
      const hash = await hashText(content);
      const docId = `fs-${file.path}`.replace(/[^a-zA-Z0-9-_]/g, '-');

      if (fileHashes[docId] === hash) { result.unchanged++; continue; }

      const existing = await storage.idb.get(`doc:${docId}`);
      await storage.idb.set(`doc:${docId}`, {
        id: docId, filename: file.name, markdown: content,
        tags: [file.directoryLabel], source: 'filesystem',
        path: file.path, directoryId: file.directoryId,
      });
      fileHashes[docId] = hash;
      importedDocs.push({ id: docId, filename: file.name, markdown: content, tags: [file.directoryLabel], hash });

      if (existing) { result.updated++; } else { result.imported++; }
    } catch { result.errors++; }
  }

  await storage.idb.set('doc-file-hashes', fileHashes);

  // Dokumente auf File Server schreiben (wenn Datenverzeichnis verbunden)
  if (importedDocs.length > 0) {
    try {
      await saveDocumentsToFileServer(storage, importedDocs);
    } catch { /* File Server nicht verfügbar — kein Problem */ }
  }

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
    const docId = `fs-${file.path}`.replace(/[^a-zA-Z0-9-_]/g, '-');
    if (!fileHashes[docId]) newFiles++;
  }

  return { newFiles, totalFiles: files.length };
}

async function saveDocumentsToFileServer(
  storage: StorageService,
  docs: Array<{ id: string; filename: string; markdown: string; tags: string[]; hash: string }>,
): Promise<void> {
  const fs = storage.fs;
  if (!fs || fs.isReadOnly()) return;

  await fs.ensureDir(DOCS_DIR);

  let manifest: DocManifest;
  try {
    manifest = await fs.readJSON<DocManifest>(DOCS_MANIFEST);
  } catch {
    manifest = { version: 0, updatedAt: '', entries: {} };
  }

  const now = new Date().toISOString();
  for (const doc of docs) {
    await fs.writeJSON(`${DOCS_DIR}/${doc.id}.json`, {
      id: doc.id, filename: doc.filename, markdown: doc.markdown,
      tags: doc.tags, hash: doc.hash, source: 'filesystem', importedAt: now,
    });
    manifest.entries[doc.id] = {
      id: doc.id, filename: doc.filename, hash: doc.hash,
      tags: doc.tags, importedAt: now,
    };
  }

  manifest.version++;
  manifest.updatedAt = now;
  await fs.writeJSON(DOCS_MANIFEST, manifest);
  await storage.idb.set('docs-fs-version', manifest.version);
}

export async function syncDocumentsFromFileServer(
  storage: StorageService,
  onProgress?: (p: ScanProgress) => void,
): Promise<number> {
  const fs = storage.fs;
  if (!fs) return 0;

  let manifest: DocManifest;
  try {
    manifest = await fs.readJSON<DocManifest>(DOCS_MANIFEST);
  } catch {
    return 0;
  }

  const localVersion = await storage.idb.get<number>('docs-fs-version') ?? 0;
  if (manifest.version <= localVersion) return 0;

  const fileHashes = await storage.idb.get<Record<string, string>>('doc-file-hashes') ?? {};
  const missingIds: string[] = [];
  for (const [id, entry] of Object.entries(manifest.entries)) {
    if (!fileHashes[id] || fileHashes[id] !== entry.hash) missingIds.push(id);
  }

  if (missingIds.length === 0) {
    await storage.idb.set('docs-fs-version', manifest.version);
    return 0;
  }

  let loaded = 0;
  for (let i = 0; i < missingIds.length; i++) {
    const id = missingIds[i]!;
    onProgress?.({ phase: 'importing', current: i + 1, total: missingIds.length, currentFile: id });
    try {
      const doc = await fs.readJSON<{
        id: string; filename: string; markdown: string;
        tags: string[]; hash: string; source: string;
      }>(`${DOCS_DIR}/${id}.json`);
      if (!doc) continue;
      await storage.idb.set(`doc:${id}`, {
        id: doc.id, filename: doc.filename, markdown: doc.markdown,
        tags: doc.tags, source: doc.source,
      });
      fileHashes[id] = doc.hash;
      loaded++;
    } catch { /* Einzelne Datei nicht lesbar — weiter */ }
  }

  await storage.idb.set('doc-file-hashes', fileHashes);
  await storage.idb.set('docs-fs-version', manifest.version);
  onProgress?.({ phase: 'done', current: missingIds.length, total: missingIds.length, currentFile: '' });
  return loaded;
}

export async function countMissingSharedDocuments(
  storage: StorageService,
): Promise<{ missing: number; totalShared: number }> {
  const fs = storage.fs;
  if (!fs) return { missing: 0, totalShared: 0 };

  try {
    const manifest = await fs.readJSON<DocManifest>(DOCS_MANIFEST);
    if (!manifest) return { missing: 0, totalShared: 0 };

    const localVersion = await storage.idb.get<number>('docs-fs-version') ?? 0;
    if (manifest.version <= localVersion) {
      return { missing: 0, totalShared: Object.keys(manifest.entries).length };
    }

    const fileHashes = await storage.idb.get<Record<string, string>>('doc-file-hashes') ?? {};
    let missing = 0;
    for (const [id, entry] of Object.entries(manifest.entries)) {
      if (!fileHashes[id] || fileHashes[id] !== entry.hash) missing++;
    }
    return { missing, totalShared: Object.keys(manifest.entries).length };
  } catch {
    return { missing: 0, totalShared: 0 };
  }
}

async function hashText(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
