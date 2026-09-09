/** Wurzeln der persoenlichen Ordner (v4.1): je Gruppe ein Slot. */
import { IDBStore } from '@/core/services/storage/idb-store';
import { SMB_HANDLE_USER_FOLDERS_ROOT, userFoldersRootSlotKey } from '../types';
import { personalRoots, PERSONAL_ROOT_LEGACY_ID, PERSONAL_ROOT_LEGACY_LABEL } from '@/config/personal-roots';
import { readAll, writeAll, pickDirectory, type FsDirHandle, type PickResult } from './kern';
import { PermStateOrMissing } from './permissions';

/**
 * Eine Wurzel, wie die App sie sieht: immer mit Beschriftung, auch wenn (noch)
 * kein Handle verbunden ist. Nicht verbundene Wurzeln SIND ein Zustand und
 * duerfen nicht stillschweigend aus der Liste fallen — bei zwei Wurzeln saehe
 * Teil-Einsammeln sonst aus wie Erfolg.
 */
export interface UserFoldersRoot {
  id: string;
  label: string;
  handle: FileSystemDirectoryHandle | null;
  /** true fuer den Alt-Slot `user-folders-root` (v2.0-Einzelwurzel). */
  legacy: boolean;
}

/**
 * Alle Wurzeln in Config-Reihenfolge, danach — falls belegt — der Alt-Slot.
 * Rein lesend: KEIN Picker, KEIN `requestPermission`, damit Mount- und
 * Timer-Pfade das gefahrlos aufrufen koennen.
 */
export async function getUserFoldersRoots(idb: IDBStore): Promise<UserFoldersRoot[]> {
  const map = await readAll(idb);
  const roots: UserFoldersRoot[] = personalRoots().map(def => ({
    id: def.id,
    label: def.label,
    handle: map[userFoldersRootSlotKey(def.id)] ?? null,
    legacy: false,
  }));
  const alt = map[SMB_HANDLE_USER_FOLDERS_ROOT];
  if (alt) {
    roots.push({
      id: PERSONAL_ROOT_LEGACY_ID,
      label: PERSONAL_ROOT_LEGACY_LABEL,
      handle: alt,
      legacy: true,
    });
  }
  return roots;
}

/** Oeffnet den Picker (read) und persistiert die Wurzel `rootId`. Ein Dialog. */
export async function pickAndStoreUserFoldersRoot(
  idb: IDBStore,
  rootId: string,
): Promise<PickResult> {
  const slot = rootId === PERSONAL_ROOT_LEGACY_ID
    ? SMB_HANDLE_USER_FOLDERS_ROOT
    : userFoldersRootSlotKey(rootId);
  const res = await pickDirectory('read', slot);
  if ('aborted' in res) return { ok: false, reason: 'aborted' };
  if ('error' in res) {
    return { ok: false, reason: res.error.includes('nicht verfügbar') ? 'unsupported' : 'error', message: res.error };
  }
  const map = await readAll(idb);
  map[slot] = res;
  await writeAll(idb, map);
  return { ok: true, handle: res };
}

/** Entfernt die Wurzel `rootId` aus der Map (auch den Alt-Slot). */
export async function clearUserFoldersRoot(idb: IDBStore, rootId: string): Promise<void> {
  const map = await readAll(idb);
  delete map[rootId === PERSONAL_ROOT_LEGACY_ID
    ? SMB_HANDLE_USER_FOLDERS_ROOT
    : userFoldersRootSlotKey(rootId)];
  await writeAll(idb, map);
}

/**
 * Non-invasiver Permission-Status ALLER Wurzeln (`queryPermission` read, KEIN
 * Gesture) als `{ rootId: state }`. Für Auto-Load-/Timer-Pfade, die die
 * Verzeichnisse sonst blind iterieren würden (→ `NotAllowedError`, wenn die
 * Permission unter `file://` nach Neustart verfallen ist). Nicht verbundene
 * Wurzeln stehen als `'missing'` drin.
 */
export async function queryUserFoldersRootPermissions(
  idb: IDBStore,
): Promise<Record<string, PermStateOrMissing>> {
  const roots = await getUserFoldersRoots(idb);
  const out: Record<string, PermStateOrMissing> = {};
  for (const root of roots) {
    if (!root.handle) { out[root.id] = 'missing'; continue; }
    try {
      out[root.id] = await (root.handle as FsDirHandle).queryPermission({ mode: 'read' });
    } catch {
      out[root.id] = 'denied';
    }
  }
  return out;
}

/**
 * Gibt GENAU EINE Wurzel (read) frei. MUSS aus einem User-Gesture-Handler
 * laufen → ein Prompt. Bewusst Singular: unter `file://` verbraucht Chromium
 * die User-Activation pro Prompt, eine Schleife ueber N Wurzeln wuerde ab der
 * zweiten still verhungern (recurring-bug §2). N Wurzeln = N Klicks.
 * No-op't bei bereits `granted` (kein Doppel-Prompt); `'missing'` ohne Handle.
 */
export async function refreshUserFoldersRootPermission(
  idb: IDBStore,
  rootId: string,
): Promise<PermStateOrMissing> {
  const roots = await getUserFoldersRoots(idb);
  const handle = roots.find(r => r.id === rootId)?.handle;
  if (!handle) return 'missing';
  try {
    const h = handle as FsDirHandle;
    if ((await h.queryPermission({ mode: 'read' })) === 'granted') return 'granted';
    return await h.requestPermission({ mode: 'read' });
  } catch {
    return 'denied';
  }
}
