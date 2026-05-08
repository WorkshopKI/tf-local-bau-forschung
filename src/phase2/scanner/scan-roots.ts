/**
 * Rekursiver Dateibaum-Walker über den `dokumentenquelle`-Handle.
 *
 * Top-Level-Verzeichnisse sind pro Förderunterprogramm strukturiert
 * (1–10 Roots, kommen aus `runtimeConfig.scan.sub_roots`); darunter sind
 * die Dateien in beliebig verschachtelten Datums-Unterordnern verteilt.
 * Wenn `sub_roots` leer ist, ist der ganze dokumentenquelle-Handle ein Root.
 *
 * Der Walker yieldet zwischen Verzeichnissen (für UI-Responsiveness) und
 * unterstützt AbortSignal.
 */

export interface ScanFile {
  /** Reiner Dateiname, identisch zur DMS-CSV DocID. */
  filename: string;
  /** Pfad relativ zum dokumentenquelle-Handle, mit `/` als Trenner. */
  filepath: string;
  size_bytes: number;
  /** ISO-Timestamp. */
  mtime: string;
  /**
   * v1.15: ID der DMS-Source, aus der diese Datei stammt. Wird vom Scanner
   * gesetzt und vom Bulk-Loop in den ManifestEntry uebernommen.
   * Optional, weil Tests / Einzeldatei-Pfade ohne Source aufgerufen werden.
   */
  source_id?: string;
}

export interface ScanOptions {
  sub_roots?: string[];
  file_extensions: string[];   // lowercase, mit Punkt z.B. '.pdf'
  max_depth: number;
  signal?: AbortSignal;
  /** Per gescanntem Verzeichnis aufgerufen — für UI-Progress. */
  onProgress?: (info: { dir: string; filesSoFar: number }) => void;
  /**
   * v1.15: Source-ID die in jeden produzierten ScanFile geschrieben wird.
   * Optional fuer Backward-Compat (Tests/Einzeldatei-Triage). Wenn nicht
   * gesetzt: ScanFiles haben kein source_id und ManifestEntries werden
   * legacy-mappig der Default-Source zugeordnet.
   */
  source_id?: string;
}

function matchesExtension(filename: string, exts: string[]): boolean {
  const lower = filename.toLowerCase();
  for (const ext of exts) {
    if (lower.endsWith(ext.toLowerCase())) return true;
  }
  return false;
}

async function walkDir(
  dir: FileSystemDirectoryHandle,
  relPath: string,
  depth: number,
  opts: ScanOptions,
  out: ScanFile[],
): Promise<void> {
  if (opts.signal?.aborted) throw new DOMException('Scan aborted', 'AbortError');
  if (depth > opts.max_depth) return;

  // FileSystemDirectoryHandle hat keinen TS-Type für asyncIterator —
  // wir nutzen Symbol.asyncIterator über `as unknown`.
  const iter = (dir as unknown as AsyncIterable<[string, FileSystemHandle]>);
  for await (const [name, handle] of iter) {
    if (opts.signal?.aborted) throw new DOMException('Scan aborted', 'AbortError');
    const childRel = relPath ? `${relPath}/${name}` : name;
    if (handle.kind === 'directory') {
      await walkDir(handle as FileSystemDirectoryHandle, childRel, depth + 1, opts, out);
    } else if (handle.kind === 'file') {
      if (!matchesExtension(name, opts.file_extensions)) continue;
      try {
        const file = await (handle as FileSystemFileHandle).getFile();
        out.push({
          filename: name,
          filepath: childRel,
          size_bytes: file.size,
          mtime: new Date(file.lastModified).toISOString(),
          source_id: opts.source_id,
        });
      } catch (e) {
        console.warn(`[phase2/scanner] Datei nicht lesbar: ${childRel}`, e);
      }
    }
  }
  opts.onProgress?.({ dir: relPath || '<root>', filesSoFar: out.length });
  // Yield zwischen Verzeichnissen, damit UI nicht blockiert
  await new Promise(r => setTimeout(r, 0));
}

/**
 * Sammelt alle passenden Dateien unter dem dokumentenquelle-Handle.
 */
export async function scanDocSource(
  dokumentenquelle: FileSystemDirectoryHandle,
  opts: ScanOptions,
): Promise<ScanFile[]> {
  if (opts.file_extensions.length === 0) {
    throw new Error('scanDocSource: file_extensions ist leer — Scan würde nichts liefern.');
  }
  const files: ScanFile[] = [];
  const subRoots = opts.sub_roots && opts.sub_roots.length > 0 ? opts.sub_roots : [''];

  for (const sub of subRoots) {
    let rootHandle: FileSystemDirectoryHandle = dokumentenquelle;
    let relRoot = '';
    if (sub) {
      // sub kann mehrstufig sein ('a/b'), also Schritt für Schritt navigieren
      const parts = sub.split('/').filter(Boolean);
      try {
        for (const p of parts) {
          rootHandle = await rootHandle.getDirectoryHandle(p);
        }
        relRoot = parts.join('/');
      } catch (e) {
        console.warn(`[phase2/scanner] sub_root "${sub}" nicht erreichbar — übersprungen.`, e);
        continue;
      }
    }
    await walkDir(rootHandle, relRoot, 0, opts, files);
  }
  return files;
}
