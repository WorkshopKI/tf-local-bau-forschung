import { IDBStore } from './idb-store';
import { FileServerStore } from './fs-store';
import { SyncService } from '@/core/services/sync/sync-service';
import type { Vorgang } from '@/core/types/vorgang';
import type { DirectoryEntry } from '@/core/types/config';
import type { FsDirHandle } from '@/core/services/infrastructure/smb-handle';

interface ConnectedDirectory {
  entry: DirectoryEntry;
  store: FileServerStore;
}

export class StorageService {
  readonly idb = new IDBStore();
  private _directories = new Map<string, ConnectedDirectory>();
  readonly syncService: SyncService;

  constructor() {
    this.syncService = new SyncService(
      this.idb,
      () => this.fs,
      () => this.isFileServerConnected(),
    );
  }

  /** Backwards-compatible: first data directory */
  get fs(): FileServerStore | null {
    for (const d of this._directories.values()) {
      if (d.entry.type === 'data') return d.store;
    }
    return null;
  }

  async init(): Promise<void> {
    await this.idb.open();
    await this.syncService.init();

    // Load all saved directories
    const entries = await this.idb.get<DirectoryEntry[]>('directories') ?? [];
    for (const entry of entries) {
      const handle = await this.idb.get<FileSystemDirectoryHandle>(`dir-handle:${entry.id}`);
      if (!handle) continue;
      try {
        const fsMode = entry.type === 'data' ? 'readwrite' as const : 'readonly' as const;
        // OPFS-Handles brauchen keine User-Permission — direkt einhängen.
        if (entry.kind === 'opfs') {
          this._directories.set(entry.id, { entry: { ...entry, folderName: handle.name }, store: new FileServerStore(handle, fsMode) });
          continue;
        }
        const mode = entry.type === 'data' ? 'readwrite' as const : 'read' as const;
        // queryPermission statt requestPermission: requestPermission haengt unter file:// ohne User-Gesture
        // stumm und blockiert den Boot. Re-Connect laeuft ueber Welcome/SmbBanner per User-Gesture.
        const permission = await (handle as FsDirHandle).queryPermission({ mode });
        if (permission === 'granted') {
          this._directories.set(entry.id, { entry: { ...entry, folderName: handle.name }, store: new FileServerStore(handle, fsMode) });
        }
      } catch { /* Permission denied — skip */ }
    }

    // Legacy migration: old single fs-handle
    if (this._directories.size === 0) {
      const legacyHandle = await this.idb.get<FileSystemDirectoryHandle>('fs-handle');
      if (legacyHandle) {
        try {
          const permission = await (legacyHandle as FsDirHandle).queryPermission({ mode: 'readwrite' });
          if (permission === 'granted') {
            const id = `dir-legacy`;
            const entry: DirectoryEntry = { id, label: 'Daten', type: 'data', folderName: legacyHandle.name };
            this._directories.set(id, { entry, store: new FileServerStore(legacyHandle, 'readwrite') });
            await this.saveDirectoryEntries();
            await this.idb.set(`dir-handle:${id}`, legacyHandle);
            await this.idb.delete('fs-handle');
          }
        } catch { /* ignore */ }
      }
    }

    if (this.isFileServerConnected()) await this.syncService.processQueue();
  }

  async addDirectory(type: 'documents' | 'data' | 'models', label?: string): Promise<DirectoryEntry | null> {
    try {
      const pickerMode = type === 'data' ? 'readwrite' as const : 'read' as const;
      const handle = await window.showDirectoryPicker({ mode: pickerMode });
      const id = `dir-${Date.now()}`;
      const entry: DirectoryEntry = { id, label: label ?? handle.name, type, folderName: handle.name, kind: 'real' };
      const fsMode = type === 'data' ? 'readwrite' as const : 'readonly' as const;
      this._directories.set(id, { entry, store: new FileServerStore(handle, fsMode) });
      await this.idb.set(`dir-handle:${id}`, handle);
      await this.saveDirectoryEntries();
      if (type === 'data') await this.syncService.processQueue();
      return entry;
    } catch (err) {
      console.error('addDirectory failed:', err);
      return null;
    }
  }

  /** Erstellt ein OPFS-Sandbox-Verzeichnis (Origin Private File System).
   *  Funktioniert in iframes und ohne User-Gesture, ist aber pro Origin/Browser isoliert
   *  (kein echtes Sharing zwischen Usern oder Geräten). Nutzung: Dev/Preview-Tests. */
  async addOPFSDirectory(type: 'documents' | 'data' | 'models', label?: string): Promise<DirectoryEntry | null> {
    try {
      if (!navigator.storage || typeof navigator.storage.getDirectory !== 'function') {
        console.error('addOPFSDirectory: OPFS nicht verfügbar in diesem Browser');
        return null;
      }
      const opfsRoot = await navigator.storage.getDirectory();
      const subfolderName = `opfs-${type}`;
      const handle = await opfsRoot.getDirectoryHandle(subfolderName, { create: true });
      const id = `dir-opfs-${type}-${Date.now()}`;
      const entry: DirectoryEntry = {
        id,
        label: label ?? `${type === 'data' ? 'Daten' : type === 'documents' ? 'Dokumente' : 'Modelle'} (Sandbox)`,
        type,
        folderName: subfolderName,
        kind: 'opfs',
      };
      const fsMode = type === 'data' ? 'readwrite' as const : 'readonly' as const;
      this._directories.set(id, { entry, store: new FileServerStore(handle, fsMode) });
      await this.idb.set(`dir-handle:${id}`, handle);
      await this.saveDirectoryEntries();
      if (type === 'data') await this.syncService.processQueue();
      return entry;
    } catch (err) {
      console.error('addOPFSDirectory failed:', err);
      return null;
    }
  }

  async removeDirectory(id: string): Promise<void> {
    this._directories.delete(id);
    await this.idb.delete(`dir-handle:${id}`);
    await this.saveDirectoryEntries();
  }

  async updateDirectoryLabel(id: string, label: string): Promise<void> {
    const dir = this._directories.get(id);
    if (dir) {
      dir.entry.label = label;
      await this.saveDirectoryEntries();
    }
  }

  getDirectories(): DirectoryEntry[] {
    return Array.from(this._directories.values()).map(d => d.entry);
  }

  getDirectoryStore(id: string): FileServerStore | null {
    return this._directories.get(id)?.store ?? null;
  }

  getDocDirectories(): DirectoryEntry[] {
    return this.getDirectories().filter(d => d.type === 'documents');
  }

  getDataDirectories(): DirectoryEntry[] {
    return this.getDirectories().filter(d => d.type === 'data');
  }

  getModelDirectories(): DirectoryEntry[] {
    return this.getDirectories().filter(d => d.type === 'models');
  }

  getModelDirectoryStore(): FileServerStore | null {
    for (const d of this._directories.values()) {
      if (d.entry.type === 'models') return d.store;
    }
    return null;
  }

  isFileServerConnected(): boolean {
    return this._directories.size > 0 && this.fs !== null;
  }

  getFileServerName(): string | null {
    const first = this.getDataDirectories()[0];
    return first?.folderName ?? null;
  }

  // Legacy compat
  async connectFileServer(): Promise<boolean> {
    const entry = await this.addDirectory('data', 'Daten');
    return entry !== null;
  }

  async disconnectFileServer(): Promise<void> {
    const dataDir = this.getDataDirectories()[0];
    if (dataDir) await this.removeDirectory(dataDir.id);
  }

  private async saveDirectoryEntries(): Promise<void> {
    const entries = Array.from(this._directories.values()).map(d => d.entry);
    await this.idb.set('directories', entries);
  }

  async saveVorgang(vorgang: Vorgang): Promise<void> {
    vorgang.modified = new Date().toISOString();
    await this.idb.set(`vorgang:${vorgang.id}`, vorgang);
    if (this.fs) {
      const dir = 'antraege/bauantraege';
      await this.syncService.enqueue({ id: crypto.randomUUID(), type: 'write', path: `${dir}/${vorgang.id}/meta.json`, data: vorgang, timestamp: vorgang.modified, retries: 0 });
    }
  }

  async loadVorgang(id: string): Promise<Vorgang | null> {
    return this.idb.get<Vorgang>(`vorgang:${id}`);
  }

  async listVorgaenge(type?: 'bauantrag'): Promise<Vorgang[]> {
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
