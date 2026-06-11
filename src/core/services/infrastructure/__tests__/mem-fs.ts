/**
 * Minimales In-Memory-`FileSystemDirectoryHandle` für Tests, kompatibel zum
 * vollen `atomic-write.ts`-Pfad (navigateToDir/getFileHandle/createWritable/
 * fallbackRename/values). KEINE `.test.ts`-Datei → wird vom Vitest-Include
 * (`*.test.ts`) nicht als Suite geladen, nur importiert.
 */

async function toBytes(chunk: unknown): Promise<Uint8Array> {
  if (typeof chunk === 'string') return new TextEncoder().encode(chunk);
  if (chunk instanceof Uint8Array) return chunk;
  if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk);
  if (chunk instanceof Blob) return new Uint8Array(await chunk.arrayBuffer());
  if (ArrayBuffer.isView(chunk)) {
    const v = chunk as ArrayBufferView;
    return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  }
  throw new Error(`mem-fs: unsupported chunk type ${typeof chunk}`);
}

class MemFile {
  data = new Uint8Array();
  constructor(public name: string) {}
  async getFile(): Promise<Blob> { return new Blob([this.data]); }
  async createWritable(): Promise<{ write: (c: unknown) => Promise<void>; close: () => Promise<void>; abort: () => Promise<void> }> {
    const chunks: Uint8Array[] = [];
    return {
      write: async (c: unknown) => { chunks.push(await toBytes(c)); },
      close: async () => {
        const total = chunks.reduce((n, c) => n + c.length, 0);
        const out = new Uint8Array(total);
        let o = 0;
        for (const c of chunks) { out.set(c, o); o += c.length; }
        this.data = out;
      },
      abort: async () => { chunks.length = 0; },
    };
  }
}

export class MemDir {
  files = new Map<string, MemFile>();
  dirs = new Map<string, MemDir>();
  readonly kind = 'directory';
  constructor(public name = 'root') {}

  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<MemDir> {
    let d = this.dirs.get(name);
    if (!d) {
      if (!opts?.create) throw new DOMException(`dir ${name} not found`, 'NotFoundError');
      d = new MemDir(name); this.dirs.set(name, d);
    }
    return d;
  }
  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MemFile> {
    let f = this.files.get(name);
    if (!f) {
      if (!opts?.create) throw new DOMException(`file ${name} not found`, 'NotFoundError');
      f = new MemFile(name); this.files.set(name, f);
    }
    return f;
  }
  async removeEntry(name: string): Promise<void> { this.files.delete(name); this.dirs.delete(name); }
  async *values(): AsyncIterableIterator<{ kind: string; name: string }> {
    for (const f of this.files.values()) yield { kind: 'file', name: f.name };
    for (const d of this.dirs.values()) yield { kind: 'directory', name: d.name };
  }
}

/** Frischer Wurzel-Handle, getypt als FileSystemDirectoryHandle. */
export function memRoot(): FileSystemDirectoryHandle {
  return new MemDir() as unknown as FileSystemDirectoryHandle;
}
