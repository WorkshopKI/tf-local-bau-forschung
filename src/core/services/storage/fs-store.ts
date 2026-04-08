export class FileServerStore {
  constructor(
    private rootHandle: FileSystemDirectoryHandle,
    private mode: 'readonly' | 'readwrite' = 'readwrite',
  ) {}

  async readFile(path: string): Promise<string> {
    const fileHandle = await this.getFileHandle(path);
    const file = await fileHandle.getFile();
    return file.text();
  }

  async getFile(path: string): Promise<File> {
    const fileHandle = await this.getFileHandle(path);
    return fileHandle.getFile();
  }

  isReadOnly(): boolean {
    return this.mode === 'readonly';
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (this.mode === 'readonly') throw new Error('Write operation on read-only directory');
    const fileHandle = await this.getFileHandle(path, true);
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  async readJSON<T>(path: string): Promise<T> {
    const text = await this.readFile(path);
    return JSON.parse(text) as T;
  }

  async writeJSON(path: string, data: unknown): Promise<void> {
    await this.writeFile(path, JSON.stringify(data, null, 2));
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.getFileHandle(path);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(dir: string, extension?: string): Promise<string[]> {
    try {
      const dirHandle = await this.getDirHandle(dir);
      const files: string[] = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          if (!extension || entry.name.endsWith(extension)) {
            files.push(entry.name);
          }
        }
      }
      return files;
    } catch {
      return [];
    }
  }

  async ensureDir(path: string): Promise<FileSystemDirectoryHandle> {
    return this.getDirHandle(path, true);
  }

  private async getFileHandle(path: string, create = false): Promise<FileSystemFileHandle> {
    const parts = path.split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) throw new Error(`Invalid path: ${path}`);

    let dir = this.rootHandle;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create });
    }
    return dir.getFileHandle(fileName, { create });
  }

  async listDirectories(dir: string = '.'): Promise<string[]> {
    try {
      const dirHandle = dir === '.' ? this.rootHandle : await this.getDirHandle(dir);
      const dirs: string[] = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'directory') dirs.push(entry.name);
      }
      return dirs;
    } catch { return []; }
  }

  private async getDirHandle(path: string, create = false): Promise<FileSystemDirectoryHandle> {
    const parts = path.split('/').filter(Boolean);
    let dir = this.rootHandle;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create });
    }
    return dir;
  }
}
