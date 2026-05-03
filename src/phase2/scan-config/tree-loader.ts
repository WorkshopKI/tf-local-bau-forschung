/**
 * Tree-Walker fuer den Scan-Pfad-Picker im Dev-Panel.
 *
 * Gibt zu einem relativen Pfad innerhalb des Dokumentenquelle-Handles die
 * direkten Sub-Verzeichnisse zurueck. Keine Rekursion — der Picker laedt pro
 * Aufklapp-Klick eine Ebene auf einmal, damit grosse Roots nicht gleich beim
 * Oeffnen Hunderte von Dirs lesen.
 */
export interface SubdirEntry {
  /** Reiner Verzeichnis-Name (z.B. "abc"). */
  name: string;
  /** Voller Pfad relativ zum Dokumentenquelle-Root (z.B. "zim/abc"). */
  path: string;
}

async function navigateToDir(
  root: FileSystemDirectoryHandle,
  relPath: string,
): Promise<FileSystemDirectoryHandle> {
  if (!relPath) return root;
  const parts = relPath.split('/').filter(Boolean);
  let dir: FileSystemDirectoryHandle = root;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part);
  }
  return dir;
}

/**
 * Listet alle direkten Sub-Verzeichnisse unter `relPath`.
 * Sortiert alphabetisch (case-insensitive). Versteckte Eintraege (Punkt-Praefix)
 * werden uebersprungen.
 */
export async function listSubdirs(
  root: FileSystemDirectoryHandle,
  relPath: string,
): Promise<SubdirEntry[]> {
  const dir = await navigateToDir(root, relPath);
  const entries: SubdirEntry[] = [];
  const iter = dir as unknown as AsyncIterable<[string, FileSystemHandle]>;
  for await (const [name, handle] of iter) {
    if (handle.kind !== 'directory') continue;
    if (name.startsWith('.')) continue;
    entries.push({
      name,
      path: relPath ? `${relPath}/${name}` : name,
    });
  }
  entries.sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
  return entries;
}
