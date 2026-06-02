/**
 * Read-only-Loader für OFFENE Übernahme-Wünsche (v2.9) — für die Markierung
 * „vorgemerkt" im Zuweisungs-Cockpit, BEVOR die PL „Übernahme-Wünsche
 * einsammeln" geklickt hat.
 *
 * Quelle: dieselben persönlichen Ordner wie der Einsammel-Schritt
 * (`collectUebernahmeWuensche` über den User-Folders-Root), aber NUR lesend —
 * kein Merge, kein Store-Write. Liefert `antragId → anonIds[]`.
 *
 * Bewusst defensiv: ist kein User-Folders-Root-Handle gepickt ODER die
 * Read-Permission noch nicht erteilt, bleibt die Map leer (kein Picker-/
 * Permission-Prompt beim bloßen Öffnen des Tabs). Die PL erteilt die Permission
 * ohnehin beim „einsammeln"-Klick; danach `reloadPending()` aufrufen.
 */
import { useCallback, useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { getUserFoldersRootHandle } from '@/core/services/infrastructure/smb-handle';
import { collectUebernahmeWuensche, buildPendingByAntrag } from '../services/uebernahme-einsammeln';
import type { AnonymMap } from '../services/anonym-map';

const EMPTY: ReadonlyMap<string, string[]> = new Map();

export function usePendingUebernahmeWuensche(anonymMap: AnonymMap): {
  /** antragId → anonIds der MAs mit offenem (noch nicht eingesammeltem) Wunsch. */
  pendingByAntrag: Map<string, string[]>;
  /** Erneut aus den persönlichen Ordnern laden (z.B. nach dem Einsammeln). */
  reloadPending: () => void;
} {
  const storage = useStorage();
  const [pendingByAntrag, setPending] = useState<Map<string, string[]>>(
    EMPTY as Map<string, string[]>,
  );
  const [tick, setTick] = useState(0);
  const reloadPending = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    const reset = (): void => { if (!cancelled) setPending(EMPTY as Map<string, string[]>); };
    void (async () => {
      try {
        const root = await getUserFoldersRootHandle(storage.idb);
        if (!root) { reset(); return; }
        // Kein Permission-Prompt beim Öffnen: nur lesen, wenn bereits gewährt.
        const queryPermission = (root as FileSystemDirectoryHandle & {
          queryPermission?: (d: { mode: 'read' }) => Promise<PermissionState>;
        }).queryPermission;
        if (queryPermission) {
          const perm = await queryPermission.call(root, { mode: 'read' });
          if (perm !== 'granted') { reset(); return; }
        }
        const batch = await collectUebernahmeWuensche(root);
        if (cancelled) return;
        setPending(buildPendingByAntrag(batch, anonymMap));
      } catch {
        reset();
      }
    })();
    return () => { cancelled = true; };
  }, [storage, anonymMap, tick]);

  return { pendingByAntrag, reloadPending };
}
