/**
 * Schlanke, NUR-LESENDE Vorlagen-Verzeichnis-Quelle (eigener IDB-Slot, bewusst
 * NICHT in `dms-sources` gemischt). Der Kurator/Gutachter verbindet einmal ein
 * Verzeichnis; Vorlagen werden bei jedem Dialog-Öffnen LIVE gelistet (nie
 * kopiert/gecacht).
 *
 * file://-Re-Grant: Das Handle wird in IDB persistiert; die Permission muss pro
 * Session ggf. neu erteilt werden (ensureReadPermission).
 */
import type { IDBStore } from '@/core/services/storage';
import type { VorlageEintrag } from './types';

const HANDLE_KEY = 'gutachten-vorlagen-dir';

type PermState = 'granted' | 'denied' | 'prompt';
interface PermDirHandle extends FileSystemDirectoryHandle {
  queryPermission(opts: { mode: 'read' | 'readwrite' }): Promise<PermState>;
  requestPermission(opts: { mode: 'read' | 'readwrite' }): Promise<PermState>;
}

export async function getVorlagenHandle(idb: IDBStore): Promise<FileSystemDirectoryHandle | null> {
  return (await idb.get<FileSystemDirectoryHandle>(HANDLE_KEY)) ?? null;
}

/** Öffnet den Verzeichnis-Picker (read-only) und persistiert das Handle. */
export async function pickVorlagenVerzeichnis(idb: IDBStore): Promise<FileSystemDirectoryHandle | null> {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('File System Access API nicht verfügbar (falscher Browser?).');
  }
  const picker = (window as typeof window & {
    showDirectoryPicker(opts?: { mode?: 'read' | 'readwrite'; startIn?: string }): Promise<FileSystemDirectoryHandle>;
  }).showDirectoryPicker;
  try {
    const handle = await picker({ mode: 'read', startIn: 'documents' });
    await idb.set(HANDLE_KEY, handle);
    return handle;
  } catch (err) {
    if ((err as DOMException).name === 'AbortError') return null;
    throw err;
  }
}

/** Stellt sicher, dass Lese-Permission auf dem Handle besteht (ggf. Prompt). */
export async function ensureReadPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  const h = handle as PermDirHandle;
  if ((await h.queryPermission({ mode: 'read' })) === 'granted') return true;
  return (await h.requestPermission({ mode: 'read' })) === 'granted';
}

/** Listet `.docx`-Vorlagen live (mit Änderungsdatum), neueste zuerst. */
export async function listVorlagen(handle: FileSystemDirectoryHandle): Promise<VorlageEintrag[]> {
  const out: VorlageEintrag[] = [];
  for await (const entry of handle.values()) {
    if (entry.kind !== 'file') continue;
    const name = entry.name;
    if (!name.toLowerCase().endsWith('.docx') || name.startsWith('~$')) continue;
    const file = await entry.getFile();
    out.push({ name, lastModified: file.lastModified });
  }
  out.sort((a, b) => b.lastModified - a.lastModified);
  return out;
}

/** Liest eine Vorlage live als ArrayBuffer (nie gecacht). */
export async function readVorlage(handle: FileSystemDirectoryHandle, name: string): Promise<ArrayBuffer> {
  const fileHandle = await handle.getFileHandle(name);
  const file = await fileHandle.getFile();
  return file.arrayBuffer();
}
