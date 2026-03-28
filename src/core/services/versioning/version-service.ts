import DiffMatchPatch from 'diff-match-patch';
import type { StorageService } from '@/core/services/storage';
import type { VersionEntry } from '@/core/types/version';

const dmp = new DiffMatchPatch();

export class VersionService {
  async createVersion(
    documentId: string,
    currentText: string,
    storage: StorageService,
    message = '',
    author = '',
  ): Promise<VersionEntry> {
    const history = await this.getHistory(documentId, storage);
    const lastVersion = history[0];
    const lastText = lastVersion
      ? await this.reconstructVersion(documentId, lastVersion.version, currentText, history)
      : '';

    const patches = dmp.patch_make(currentText, lastText);
    const patchText = dmp.patch_toText(patches);

    const entry: VersionEntry = {
      version: (lastVersion?.version ?? 0) + 1,
      timestamp: new Date().toISOString(),
      author,
      message: message || `Version ${(lastVersion?.version ?? 0) + 1}`,
      patchText,
      documentId,
    };

    history.unshift(entry);
    await storage.idb.set(`versions:${documentId}`, history);
    return entry;
  }

  async getHistory(documentId: string, storage: StorageService): Promise<VersionEntry[]> {
    return await storage.idb.get<VersionEntry[]>(`versions:${documentId}`) ?? [];
  }

  async reconstructVersion(
    _documentId: string,
    targetVersion: number,
    currentText: string,
    history?: VersionEntry[],
  ): Promise<string> {
    const entries = history ?? [];
    let text = currentText;

    // Apply reverse patches from newest to target
    for (const entry of entries) {
      if (entry.version < targetVersion) break;
      const patches = dmp.patch_fromText(entry.patchText);
      const [result] = dmp.patch_apply(patches, text);
      text = result;
    }

    return text;
  }

  getDiff(textA: string, textB: string): Array<[number, string]> {
    const diffs = dmp.diff_main(textA, textB);
    dmp.diff_cleanupSemantic(diffs);
    return diffs;
  }

  async restoreVersion(
    documentId: string,
    targetVersion: number,
    currentText: string,
    storage: StorageService,
    author = '',
  ): Promise<string> {
    const history = await this.getHistory(documentId, storage);
    const restoredText = await this.reconstructVersion(documentId, targetVersion, currentText, history);

    await this.createVersion(
      documentId,
      restoredText,
      storage,
      `Wiederhergestellt von v${targetVersion}`,
      author,
    );

    return restoredText;
  }
}

export const versionService = new VersionService();
