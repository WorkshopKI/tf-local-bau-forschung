/**
 * Die Wurzeln der persönlichen Ordner als React-Zustand.
 *
 * Laden ist strikt non-invasiv (`getUserFoldersRoots` + `queryUserFoldersRootPermissions`,
 * kein Prompt) — Mount- und Timer-Pfade dürfen das gefahrlos aufrufen.
 *
 * `verbinde` behandelt GENAU EINE Wurzel und löst höchstens EINEN Browser-Dialog
 * aus: unter `file://` verbraucht Chromium die User-Activation pro Prompt, eine
 * Schleife über N Wurzeln verhungerte ab der zweiten still (recurring-bug §2).
 * N Wurzeln = N Klicks. Deshalb MUSS `verbinde` aus einem Klick-Handler laufen.
 */

import { useCallback, useEffect, useState } from 'react';
import { useStorage } from './useStorage';
import { istNutzbar } from '@/core/services/personal-roots';
import {
  getUserFoldersRoots,
  queryUserFoldersRootPermissions,
  pickAndStoreUserFoldersRoot,
  refreshUserFoldersRootPermission,
  clearUserFoldersRoot,
  type UserFoldersRoot,
  type PermStateOrMissing,
} from '@/core/services/infrastructure/smb-handle';

/** Der frisch gelesene Stand — `neuLaden` gibt ihn zurueck. */
export interface WurzelStand {
  wurzeln: UserFoldersRoot[];
  zustaende: Record<string, PermStateOrMissing>;
}

export interface PersoenlicheWurzelnState {
  wurzeln: UserFoldersRoot[];
  /** Non-invasiv ermittelter Berechtigungsstand je Wurzel-Id. */
  zustaende: Record<string, PermStateOrMissing>;
  laden: boolean;
  /**
   * Laedt neu UND liefert den frischen Stand zurueck. Der Rueckgabewert ist
   * kein Komfort, sondern Pflicht fuer jeden Aufrufer, der direkt nach dem
   * Laden weiterarbeitet: `setState` wirkt erst im naechsten Render, ein
   * `await neuLaden()` gefolgt von `wurzeln` aus dem Closure liest den ALTEN
   * Stand — beim ersten Lauf das leere Array.
   */
  neuLaden: () => Promise<WurzelStand>;
  /** Verbindet oder gibt GENAU EINE Wurzel frei. Nur aus einem Klick-Handler. */
  verbinde: (root: UserFoldersRoot) => Promise<void>;
  /** Entfernt eine Wurzel (Anwendungsfall: den Alt-Ordner abräumen). */
  entferne: (root: UserFoldersRoot) => Promise<void>;
}

export function usePersoenlicheWurzeln(): PersoenlicheWurzelnState {
  const storage = useStorage();
  const [wurzeln, setWurzeln] = useState<UserFoldersRoot[]>([]);
  const [zustaende, setZustaende] = useState<Record<string, PermStateOrMissing>>({});
  const [laden, setLaden] = useState(true);

  const neuLaden = useCallback(async (): Promise<WurzelStand> => {
    try {
      const [roots, perms] = await Promise.all([
        getUserFoldersRoots(storage.idb),
        queryUserFoldersRootPermissions(storage.idb),
      ]);
      setWurzeln(roots);
      setZustaende(perms);
      return { wurzeln: roots, zustaende: perms };
    } finally {
      setLaden(false);
    }
  }, [storage]);

  useEffect(() => { void neuLaden(); }, [neuLaden]);

  const verbinde = useCallback(async (root: UserFoldersRoot): Promise<void> => {
    if (root.handle) {
      // Handle vorhanden, aber Berechtigung verfallen → EIN requestPermission.
      const perm = await refreshUserFoldersRootPermission(storage.idb, root.id);
      if (perm !== 'granted') {
        throw new Error(`Zugriff auf „${root.label}" wurde nicht erteilt. Bitte erneut versuchen.`);
      }
    } else {
      const res = await pickAndStoreUserFoldersRoot(storage.idb, root.id);
      if (!res.ok) {
        if (res.reason === 'aborted') return;
        throw new Error(res.message ?? 'Ordner-Auswahl fehlgeschlagen.');
      }
    }
    await neuLaden();
  }, [storage, neuLaden]);

  const entferne = useCallback(async (root: UserFoldersRoot): Promise<void> => {
    await clearUserFoldersRoot(storage.idb, root.id);
    await neuLaden();
  }, [storage, neuLaden]);

  return { wurzeln, zustaende, laden, neuLaden, verbinde, entferne };
}

/**
 * Nur die Wurzeln, aus denen gerade wirklich gelesen werden kann.
 *
 * Das Urteil selbst liegt in `wurzelLage.ts` — dieselbe Frage beantwortet auch
 * die Zeilen-Auswahl der UI, und zwei Kopien davon würden auseinanderlaufen.
 */
export function nurNutzbare(
  wurzeln: readonly UserFoldersRoot[],
  zustaende: Record<string, PermStateOrMissing>,
): UserFoldersRoot[] {
  return wurzeln.filter(r => istNutzbar(r, zustaende));
}
