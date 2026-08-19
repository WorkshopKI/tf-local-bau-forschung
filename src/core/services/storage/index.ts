import { IDBStore } from './idb-store';
import { FileServerStore } from './fs-store';
import { SyncService } from '@/core/services/sync/sync-service';
import { getVariantDbName } from '@/config/runtime-config';
import type { DirectoryEntry } from '@/core/types/config';
import type { FsDirHandle } from '@/core/services/infrastructure/smb-handle';

interface ConnectedDirectory {
  entry: DirectoryEntry;
  store: FileServerStore;
}

export class StorageService {
  // Variante-getrennte IndexedDB (`teamflow-<outputFilename>`): verhindert, dass
  // prod/kurator/pl unter demselben `file://`-Origin in EINE geteilte DB schreiben.
  readonly idb = new IDBStore(getVariantDbName());
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

  /**
   * Bittet den Browser, die IndexedDB dieses Origins NICHT zu verwerfen.
   *
   * Ohne diese Anfrage ist der Speicher „best effort": Chrome darf ihn unter
   * Platzdruck jederzeit räumen. Für diese App wiegt das schwer — Identität
   * (`profile` + `onboarding-complete`) UND alle File-System-Handles liegen
   * ausschliesslich hier; ein Räumen wirft den User zurück ins Onboarding.
   *
   * Strikt best-effort: unter `file://` lehnen Browser das oft ohne User-
   * Engagement ab, und persistenter Speicher ersetzt kein Backup — gegen ein
   * zurückgesetztes Windows-/Citrix-Profil hilft er nicht (dann greift die
   * Wiederherstellung aus dem persönlichen Ordner).
   */
  private async requestPersistentStorage(): Promise<void> {
    try {
      if (!navigator.storage || typeof navigator.storage.persist !== 'function') return;
      if (await navigator.storage.persisted()) return;
      await navigator.storage.persist();
    } catch {
      /* nicht verfügbar/abgelehnt — die App funktioniert unverändert weiter. */
    }
  }

  async init(): Promise<void> {
    await this.idb.open();
    void this.requestPersistentStorage(); // nicht awaiten: darf den Boot nicht verzögern
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
    const eingehaengt = Array.from(this._directories.values()).map(d => d.entry);
    // Eingetragene, aber nicht eingehängte Verzeichnisse BLEIBEN stehen: `init`
    // hängt nur ein, was `queryPermission` gerade freigibt, und ein Speichern
    // aus dem eingehängten Stand allein hätte jedes Verzeichnis mit abgelaufenem
    // Zugriff endgültig aus der Liste geworfen. Erkennungsmerkmal ist das noch
    // vorhandene Handle — `removeDirectory` löscht es zuerst.
    const gespeichert = await this.idb.get<DirectoryEntry[]>('directories') ?? [];
    const schlafend: DirectoryEntry[] = [];
    for (const e of gespeichert) {
      if (this._directories.has(e.id)) continue;
      const handle = await this.idb.get<FileSystemDirectoryHandle>(`dir-handle:${e.id}`);
      if (handle) schlafend.push(e);
    }
    await this.idb.set('directories', [...eingehaengt, ...schlafend]);
  }

  /**
   * Eingetragene Verzeichnisse, die beim Start NICHT eingehängt werden konnten
   * — der Zugriff ist abgelaufen und muss per Klick erneuert werden.
   *
   * Bis v4.116 gab es sie in der Oberfläche gar nicht: `getDirectories()` liefert
   * nur die eingehängten, und die Karte meldete „Keine weiteren Verzeichnisse
   * verbunden" — ohne Rückweg, obwohl Eintrag und Handle noch dalagen.
   *
   * Gibt das Handle mit zurück, damit `reconnectDirectory` im Klick-Gesture
   * OHNE `await` davor laufen kann (file://-User-Activation).
   */
  async getUnmountedDirectories(): Promise<Array<{ entry: DirectoryEntry; handle: FileSystemDirectoryHandle }>> {
    const gespeichert = await this.idb.get<DirectoryEntry[]>('directories') ?? [];
    const offen: Array<{ entry: DirectoryEntry; handle: FileSystemDirectoryHandle }> = [];
    for (const entry of gespeichert) {
      if (this._directories.has(entry.id)) continue;
      const handle = await this.idb.get<FileSystemDirectoryHandle>(`dir-handle:${entry.id}`);
      if (handle) offen.push({ entry, handle });
    }
    return offen;
  }

  /**
   * Fordert den Zugriff auf ein schlafendes Verzeichnis neu an und hängt es ein.
   * MUSS aus einem User-Gesture heraus laufen und ohne `await` davor — sonst
   * hängt `requestPermission` unter `file://` stumm.
   */
  async reconnectDirectory(
    entry: DirectoryEntry,
    handle: FileSystemDirectoryHandle,
  ): Promise<boolean> {
    const mode = entry.type === 'data' ? 'readwrite' as const : 'read' as const;
    const fsMode = entry.type === 'data' ? 'readwrite' as const : 'readonly' as const;
    try {
      const permission = await (handle as FsDirHandle).requestPermission({ mode });
      if (permission !== 'granted') return false;
      this._directories.set(entry.id, {
        entry: { ...entry, folderName: handle.name },
        store: new FileServerStore(handle, fsMode),
      });
      await this.saveDirectoryEntries();
      if (entry.type === 'data') await this.syncService.processQueue();
      return true;
    } catch {
      return false;
    }
  }

}

export { IDBStore } from './idb-store';
export { FileServerStore } from './fs-store';
