/**
 * Atomic Write Utility (Phase 1a, Modul D).
 *
 * Arbeitet auf Raw-FileSystemDirectoryHandle, NICHT auf bestehendem
 * FileServerStore — so bleibt der Legacy-Pfad unangetastet.
 *
 * Ablauf (siehe Architektur 11.6):
 *   1. Wenn target existiert und !skipBackup: .backup anlegen (alt überschreibt)
 *   2. Schreibe nach {filename}.tmp
 *   3. Rename {filename}.tmp → {filename}
 *
 * move() ist experimentell — immer try/catch + Polyfill-Fallback.
 */

type WritableData = Uint8Array | string | Blob;

async function navigateToDir(
  root: FileSystemDirectoryHandle,
  parts: string[],
  create: boolean,
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create });
  }
  return dir;
}

/** Parst `a/b/c/file.ext` in { dirParts: ['a','b','c'], filename: 'file.ext' }. */
function splitPath(path: string): { dirParts: string[]; filename: string } {
  const parts = path.split('/').filter(Boolean);
  const filename = parts.pop();
  if (!filename) throw new Error(`atomic-write: invalid path ${path}`);
  return { dirParts: parts, filename };
}

async function exists(dir: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

async function writeData(fh: FileSystemFileHandle, data: WritableData): Promise<void> {
  const w = await fh.createWritable();
  if (data instanceof Uint8Array) {
    await w.write(data as BufferSource);
  } else if (data instanceof Blob) {
    await w.write(data);
  } else {
    await w.write(data);
  }
  await w.close();
}

async function readFileBlob(fh: FileSystemFileHandle): Promise<Blob> {
  const f = await fh.getFile();
  return f;
}

/**
 * "Rename" via Read-Write-Delete. Nicht atomar, aber der einzige Cross-Browser-
 * kompatible Fallback für File System Access API.
 */
async function fallbackRename(
  dir: FileSystemDirectoryHandle,
  fromName: string,
  toName: string,
): Promise<void> {
  const src = await dir.getFileHandle(fromName);
  const blob = await readFileBlob(src);
  const dst = await dir.getFileHandle(toName, { create: true });
  const w = await dst.createWritable();
  await w.write(blob);
  await w.close();
  await dir.removeEntry(fromName);
}

async function rename(
  dir: FileSystemDirectoryHandle,
  fromName: string,
  toName: string,
): Promise<void> {
  const src = await dir.getFileHandle(fromName);
  // Native move() ist experimentell — Existenz-Check reicht nicht, try/catch.
  const hasMove = typeof (src as FileSystemFileHandle & { move?: (dir: FileSystemDirectoryHandle, name: string) => Promise<void> }).move === 'function';
  if (hasMove) {
    try {
      await (src as FileSystemFileHandle & { move: (dir: FileSystemDirectoryHandle, name: string) => Promise<void> }).move(dir, toName);
      return;
    } catch {
      /* fall through to polyfill */
    }
  }
  await fallbackRename(dir, fromName, toName);
}

async function removeIfExists(dir: FileSystemDirectoryHandle, name: string): Promise<void> {
  try {
    await dir.removeEntry(name);
  } catch {
    /* ignore — file didn't exist */
  }
}

/**
 * Atomar (best-effort) schreiben mit .backup-Rotation (1 Generation).
 * `skipBackup: true` für append-only Files wie audit-log.jsonl.
 */
export async function atomicWrite(
  root: FileSystemDirectoryHandle,
  path: string,
  data: WritableData,
  opts: { skipBackup?: boolean } = {},
): Promise<void> {
  const { dirParts, filename } = splitPath(path);
  const dir = await navigateToDir(root, dirParts, true);
  const tmpName = `${filename}.tmp`;
  const backupName = `${filename}.backup`;

  // Aufräumen falls vorheriger Crash .tmp hinterlassen hat.
  await removeIfExists(dir, tmpName);

  const targetExists = await exists(dir, filename);

  if (targetExists && !opts.skipBackup) {
    await removeIfExists(dir, backupName);
    await rename(dir, filename, backupName);
  } else if (opts.skipBackup) {
    // Selbstheilung: stale .backup aus frueheren Writes ohne skipBackup wegraeumen.
    await removeIfExists(dir, backupName);
  }

  // Tmp schreiben
  const tmpFh = await dir.getFileHandle(tmpName, { create: true });
  await writeData(tmpFh, data);

  // Altes Ziel entfernen, Tmp darüberziehen.
  await removeIfExists(dir, filename);
  await rename(dir, tmpName, filename);
}

export interface AtomicWriteSink {
  /** Schreibt einen Chunk ans Ende der Datei (sequentiell). */
  write: (chunk: string | BufferSource) => Promise<void>;
}

/**
 * Wie `atomicWrite`, aber der Inhalt wird vom `produce`-Callback in **Chunks**
 * in den `.tmp`-WritableStream geschrieben — für große Dateien (Snapshot-JSONL
 * bei 13k+ Antraegen), die nicht als ein einziger String/Buffer im RAM gehalten
 * werden sollen. Gleiche `.backup`-Rotation + atomarer Rename wie `atomicWrite`.
 *
 * Bei einem Fehler im `produce` wird der WritableStream verworfen und das `.tmp`
 * entfernt — das Ziel bleibt unberührt.
 */
export async function atomicWriteStream(
  root: FileSystemDirectoryHandle,
  path: string,
  produce: (sink: AtomicWriteSink) => Promise<void>,
  opts: { skipBackup?: boolean } = {},
): Promise<void> {
  const { dirParts, filename } = splitPath(path);
  const dir = await navigateToDir(root, dirParts, true);
  const tmpName = `${filename}.tmp`;
  const backupName = `${filename}.backup`;

  await removeIfExists(dir, tmpName);

  const targetExists = await exists(dir, filename);
  if (targetExists && !opts.skipBackup) {
    await removeIfExists(dir, backupName);
    await rename(dir, filename, backupName);
  } else if (opts.skipBackup) {
    await removeIfExists(dir, backupName);
  }

  const tmpFh = await dir.getFileHandle(tmpName, { create: true });
  const w = await tmpFh.createWritable();
  try {
    await produce({ write: (chunk) => w.write(chunk) });
    await w.close();
  } catch (err) {
    try { await w.abort(); } catch { /* Stream evtl. schon fehlerhaft */ }
    await removeIfExists(dir, tmpName);
    throw err;
  }

  await removeIfExists(dir, filename);
  await rename(dir, tmpName, filename);
}

/** Rein Append-Writer (kein .tmp, kein .backup). Nur für audit-log. */
export async function appendToFile(
  root: FileSystemDirectoryHandle,
  path: string,
  line: string,
): Promise<void> {
  const { dirParts, filename } = splitPath(path);
  const dir = await navigateToDir(root, dirParts, true);
  let existing = '';
  try {
    const fh = await dir.getFileHandle(filename);
    const f = await fh.getFile();
    existing = await f.text();
  } catch {
    /* new file */
  }
  const sep = existing.length > 0 && !existing.endsWith('\n') ? '\n' : '';
  const next = existing + sep + line + '\n';
  const fh = await dir.getFileHandle(filename, { create: true });
  await writeData(fh, next);
}

/**
 * Lage einer Datei beim Lesen — die Unterscheidung, die {@link readText} nicht
 * treffen kann, weil es JEDEN Fehler auf `null` abbildet.
 *
 * `leer` heißt „die Datei gibt es (noch) nicht" — ein legitimer Anfangszustand,
 * auf dem man aufbauen darf. `unlesbar` heißt „da IST etwas, es ließ sich nur
 * gerade nicht lesen" (SMB-Aussetzer, entzogenes Recht, paralleler Schreiber im
 * Rename-Fenster). Wer aus `unlesbar` ein „also leer" macht und das Ergebnis
 * zurückschreibt, löscht fremden Bestand — genau die Bug-Klasse, die dieses
 * Modul sonst verhindert (Pitfall #10/#23).
 *
 * **Regel: wer nach dem Lesen SCHREIBT, nimmt `readTextLage` und bricht bei
 * `unlesbar` ab.** Wer nur liest und mit „nichts" leben kann, nimmt `readText`.
 */
export type DateiLage =
  | { status: 'ok'; text: string }
  | { status: 'leer' }
  | { status: 'unlesbar' };

/**
 * Liest eine Datei und meldet die {@link DateiLage} statt eines zweideutigen
 * `null`. Unterschieden wird am Fehler-Namen: die File System Access API wirft
 * `NotFoundError`, wenn Datei oder Ordner nicht existieren — jeder ANDERE Fehler
 * bedeutet, dass etwas da ist, das sich nicht lesen ließ.
 */
export async function readTextLage(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<DateiLage> {
  try {
    const { dirParts, filename } = splitPath(path);
    const dir = await navigateToDir(root, dirParts, false);
    const fh = await dir.getFileHandle(filename);
    const f = await fh.getFile();
    return { status: 'ok', text: await f.text() };
  } catch (err) {
    return (err as { name?: string } | null)?.name === 'NotFoundError'
      ? { status: 'leer' }
      : { status: 'unlesbar' };
  }
}

/**
 * Datei-Inhalt oder `null`. Fehlertolerant für LESENDE Aufrufer, die mit
 * „nichts" leben können — wer anschließend schreibt, nimmt {@link readTextLage}.
 */
export async function readText(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<string | null> {
  const lage = await readTextLage(root, path);
  return lage.status === 'ok' ? lage.text : null;
}

/**
 * Nur die ersten `bytes` einer Datei. Für Dateien, aus denen eine einzelne
 * Angabe im Kopf gebraucht wird (Versionsnummer, Format-Marke) und deren
 * Volllesen über SMB unverhältnismäßig wäre. Fehlertoleranz wie {@link readText}.
 */
export async function readTextPrefix(
  root: FileSystemDirectoryHandle,
  path: string,
  bytes: number,
): Promise<string | null> {
  try {
    const { dirParts, filename } = splitPath(path);
    const dir = await navigateToDir(root, dirParts, false);
    const fh = await dir.getFileHandle(filename);
    const f = await fh.getFile();
    return await f.slice(0, bytes).text();
  } catch {
    return null;
  }
}

export async function readBinary(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<Uint8Array | null> {
  try {
    const { dirParts, filename } = splitPath(path);
    const dir = await navigateToDir(root, dirParts, false);
    const fh = await dir.getFileHandle(filename);
    const f = await fh.getFile();
    return new Uint8Array(await f.arrayBuffer());
  } catch {
    return null;
  }
}

export async function fileExists(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<boolean> {
  try {
    const { dirParts, filename } = splitPath(path);
    const dir = await navigateToDir(root, dirParts, false);
    await dir.getFileHandle(filename);
    return true;
  } catch {
    return false;
  }
}

export async function removeFile(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<void> {
  const { dirParts, filename } = splitPath(path);
  const dir = await navigateToDir(root, dirParts, false);
  await removeIfExists(dir, filename);
}

/** Listet Dateien + .backup-Indikator in einem Ordner. */
export async function listFilesWithBackupInfo(
  root: FileSystemDirectoryHandle,
  dirPath: string,
): Promise<Array<{ name: string; hasBackup: boolean }>> {
  const parts = dirPath.split('/').filter(Boolean);
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await navigateToDir(root, parts, false);
  } catch {
    return [];
  }
  const names = new Set<string>();
  const backups = new Set<string>();
  for await (const entry of (dir as FileSystemDirectoryHandle & {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }).values()) {
    if (entry.kind === 'file') {
      if (entry.name.endsWith('.backup')) backups.add(entry.name.slice(0, -'.backup'.length));
      else if (!entry.name.endsWith('.tmp')) names.add(entry.name);
    }
  }
  return [...names].sort().map(name => ({ name, hasBackup: backups.has(name) }));
}
