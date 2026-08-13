/**
 * In-Memory-`FileSystemDirectoryHandle` für die Snapshot-Tests.
 *
 * Kein Test — nur Werkzeug (die Vitest-Includes greifen `*.test.ts`). Vorher
 * trug jede Snapshot-Testdatei ihre eigene Kopie; wer den Handle erweitert,
 * soll das an einer Stelle tun.
 *
 * `MemFile.unlesbar` bildet den Fall nach, den `readTextLage` von „fehlt"
 * unterscheidet: die Datei ist da, der Zugriff scheitert (SMB-Aussetzer,
 * gesperrte Datei).
 */

export class MemFile {
  readonly kind = 'file' as const;
  content = new Uint8Array(0);
  /** true = jeder Lesezugriff schlägt fehl. */
  unlesbar = false;
  constructor(public name: string) {}

  async getFile(): Promise<Blob> {
    if (this.unlesbar) {
      const e = new Error('konnte nicht gelesen werden');
      e.name = 'NotReadableError';
      throw e;
    }
    return new Blob([this.content]);
  }

  createWritable(): Promise<unknown> {
    const parts: Uint8Array[] = [];
    const enc = new TextEncoder();
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    return Promise.resolve({
      async write(chunk: unknown): Promise<void> {
        if (typeof chunk === 'string') parts.push(enc.encode(chunk));
        else if (chunk instanceof Blob) parts.push(new Uint8Array(await chunk.arrayBuffer()));
        else if (chunk instanceof Uint8Array) parts.push(chunk);
        else if (chunk instanceof ArrayBuffer) parts.push(new Uint8Array(chunk));
        else if (ArrayBuffer.isView(chunk)) {
          parts.push(new Uint8Array(
            chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength),
          ));
        } else throw new Error('MemFile: unsupported chunk');
      },
      async close(): Promise<void> {
        let total = 0;
        for (const p of parts) total += p.length;
        const all = new Uint8Array(total);
        let off = 0;
        for (const p of parts) { all.set(p, off); off += p.length; }
        self.content = all;
      },
      async abort(): Promise<void> { parts.length = 0; },
    });
  }
}

export function notFound(): Error {
  const e = new Error('NotFound');
  e.name = 'NotFoundError';
  return e;
}

export class MemDir {
  readonly kind = 'directory' as const;
  children = new Map<string, MemDir | MemFile>();
  constructor(public name: string) {}

  async getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<MemDir> {
    let c = this.children.get(name);
    if (!c) {
      if (!opts?.create) throw notFound();
      c = new MemDir(name);
      this.children.set(name, c);
    }
    if (c.kind !== 'directory') throw new Error('not a directory');
    return c;
  }

  async getFileHandle(name: string, opts?: { create?: boolean }): Promise<MemFile> {
    let c = this.children.get(name);
    if (!c) {
      if (!opts?.create) throw notFound();
      c = new MemFile(name);
      this.children.set(name, c);
    }
    if (c.kind !== 'file') throw new Error('not a file');
    return c;
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.children.has(name)) throw notFound();
    this.children.delete(name);
  }

  async *keys(): AsyncIterableIterator<string> {
    for (const k of this.children.keys()) yield k;
  }
}

export const asHandle = (d: MemDir): FileSystemDirectoryHandle =>
  d as unknown as FileSystemDirectoryHandle;

/** `programm/antraege/snapshot/<pid>/` — dorthin schreibt `navigateSnapshotDir`. */
export async function snapshotDir(share: MemDir, programmId: string): Promise<MemDir> {
  const programm = await share.getDirectoryHandle('programm');
  const antraege = await programm.getDirectoryHandle('antraege');
  const snap = await antraege.getDirectoryHandle('snapshot');
  return snap.getDirectoryHandle(programmId);
}
