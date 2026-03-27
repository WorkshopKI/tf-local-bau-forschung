import { IDBStore } from './idb-store';
import { FileServerStore } from './fs-store';
import type { Vorgang } from '@/core/types/vorgang';

export class StorageService {
  readonly idb = new IDBStore();
  private _fs: FileServerStore | null = null;

  get fs(): FileServerStore | null {
    return this._fs;
  }

  async init(): Promise<void> {
    await this.idb.open();
    const handle = await this.idb.get<FileSystemDirectoryHandle>('fs-handle');
    if (handle) {
      try {
        const permission = await handle.requestPermission({ mode: 'readwrite' });
        if (permission === 'granted') {
          this._fs = new FileServerStore(handle);
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
      return true;
    } catch {
      return false;
    }
  }

  async disconnectFileServer(): Promise<void> {
    await this.idb.delete('fs-handle');
    this._fs = null;
  }

  isFileServerConnected(): boolean {
    return this._fs !== null;
  }

  async saveVorgang(vorgang: Vorgang): Promise<void> {
    const existing = await this.idb.get<Vorgang>(`vorgang:${vorgang.id}`);
    if (existing && existing.modified > vorgang.modified) {
      throw new Error('Conflict: Vorgang was modified by another user');
    }
    vorgang.modified = new Date().toISOString();
    await this.idb.set(`vorgang:${vorgang.id}`, vorgang);

    if (this._fs) {
      const dir = vorgang.type === 'bauantrag' ? 'vorgaenge/bauantraege' : 'vorgaenge/forschung';
      await this._fs.writeJSON(`${dir}/${vorgang.id}/meta.json`, vorgang);
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
      if (v && (!type || v.type === type)) {
        results.push(v);
      }
    }
    return results;
  }

  async deleteVorgang(id: string): Promise<void> {
    await this.idb.delete(`vorgang:${id}`);
  }
}

export { IDBStore } from './idb-store';
export { FileServerStore } from './fs-store';
