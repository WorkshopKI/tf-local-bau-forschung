import { IDBStore } from './idb-store';
import { FileServerStore } from './fs-store';
import { SyncService } from '@/core/services/sync/sync-service';
import type { Vorgang } from '@/core/types/vorgang';

export class StorageService {
  readonly idb = new IDBStore();
  private _fs: FileServerStore | null = null;
  private _fsName: string | null = null;
  readonly syncService: SyncService;

  constructor() {
    this.syncService = new SyncService(
      () => this._fs,
      () => this.isFileServerConnected(),
    );
  }

  get fs(): FileServerStore | null {
    return this._fs;
  }

  async init(): Promise<void> {
    await this.idb.open();
    await this.syncService.init();
    const handle = await this.idb.get<FileSystemDirectoryHandle>('fs-handle');
    if (handle) {
      try {
        const permission = await handle.requestPermission({ mode: 'readwrite' });
        if (permission === 'granted') {
          this._fs = new FileServerStore(handle);
          this._fsName = handle.name;
          // Process any pending queue items
          await this.syncService.processQueue();
        }
      } catch {
        // Permission denied or handle invalid — continue without FS
      }
    }
  }

  async connectFileServer(): Promise<boolean> {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await this.idb.set('fs-handle', handle);
      this._fs = new FileServerStore(handle);
      this._fsName = handle.name;
      // Sync pending items now that FS is connected
      await this.syncService.processQueue();
      return true;
    } catch {
      return false;
    }
  }

  getFileServerName(): string | null {
    return this._fsName;
  }

  async disconnectFileServer(): Promise<void> {
    await this.idb.delete('fs-handle');
    this._fs = null;
  }

  isFileServerConnected(): boolean {
    return this._fs !== null;
  }

  async saveVorgang(vorgang: Vorgang): Promise<void> {
    vorgang.modified = new Date().toISOString();
    await this.idb.set(`vorgang:${vorgang.id}`, vorgang);

    if (this._fs) {
      const dir = vorgang.type === 'bauantrag' ? 'vorgaenge/bauantraege' : 'vorgaenge/forschung';
      await this.syncService.enqueue({
        id: crypto.randomUUID(),
        type: 'write',
        path: `${dir}/${vorgang.id}/meta.json`,
        data: vorgang,
        timestamp: vorgang.modified,
        retries: 0,
      });
    }
  }

  async loadVorgang(id: string): Promise<Vorgang | null> {
    return this.idb.get<Vorgang>(`vorgang:${id}`);
  }

  async listVorgaenge(type?: 'bauantrag' | 'forschung'): Promise<Vorgang[]> {
    const keys = await this.idb.keys('vorgang:');
    const results: Vorgang[] = [];
    for (const key of keys) {
      const v = await this.idb.get<Vorgang>(key);
      if (v && (!type || v.type === type)) results.push(v);
    }
    return results;
  }

  async deleteVorgang(id: string): Promise<void> {
    await this.idb.delete(`vorgang:${id}`);
  }
}

export { IDBStore } from './idb-store';
export { FileServerStore } from './fs-store';
