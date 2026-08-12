/**
 * Read-only-Loader für OFFENE Übernahme-Wünsche (v2.9) — für die Markierung
 * „vorgemerkt" im Zuweisungs-Cockpit, BEVOR die PL „Übernahme-Wünsche
 * einsammeln" geklickt hat.
 *
 * Quelle: dieselben persönlichen Ordner wie der Einsammel-Schritt
 * (`collectUebernahmeWuensche` über die Wurzeln), aber NUR lesend — kein Merge,
 * kein Store-Write. Liefert den vollen `WunschStand` (`antragId → anonIds[]` +
 * die Menge gelesener anonIds); Letztere trägt die Rückzugs-Erkennung im
 * Cockpit.
 *
 * Bewusst defensiv: `getUserFoldersRoots` + der Permissions-Check sind
 * non-invasiv, gelesen wird nur aus bereits freigegebenen Wurzeln (kein Picker-/
 * Permission-Prompt beim bloßen Öffnen des Tabs). Die PL erteilt die Permission
 * ohnehin beim „einsammeln"-Klick; danach `reloadPending()` aufrufen.
 *
 * v4.1: mehrere Wurzeln. ALLE lesen, Dubletten falten, dann EIN
 * `buildWunschStand` — sonst wäre `gelesenAnonIds` unvollständig und die
 * Rückzugs-Erkennung zöge Wünsche zurück, die es noch gibt.
 */
import { useCallback, useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import {
  getUserFoldersRoots,
  queryUserFoldersRootPermissions,
} from '@/core/services/infrastructure/smb-handle';
import { jeWurzel, juengsterGewinnt } from '@/core/services/personal-roots';
import { collectUebernahmeWuensche, buildWunschStand, type WunschStand } from '../services/onboarding';
import { normalizeKuerzel, type AnonymMap } from '../services/identitaet';
import type { PersoenlicheUebernahmeWuensche } from '../types';

const LEER: WunschStand = { byAntrag: new Map(), gelesenAnonIds: new Set() };

export function usePendingUebernahmeWuensche(anonymMap: AnonymMap): {
  /** antragId → anonIds der MAs mit offenem (noch nicht eingesammeltem) Wunsch. */
  pendingByAntrag: Map<string, string[]>;
  /** Voller Datei-Stand inkl. gelesener anonIds — Basis der Rückzugs-Erkennung
   *  (v2.290: ein zurückgezogener Wunsch verschwindet ohne Einsammel-Klick). */
  wunschStand: WunschStand;
  /** Erneut aus den persönlichen Ordnern laden (z.B. nach dem Einsammeln). */
  reloadPending: () => void;
} {
  const storage = useStorage();
  const [wunschStand, setStand] = useState<WunschStand>(LEER);
  const [tick, setTick] = useState(0);
  const reloadPending = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    const reset = (): void => { if (!cancelled) setStand(LEER); };
    void (async () => {
      try {
        // Kein Permission-Prompt beim Öffnen: nur lesen, wo bereits gewährt.
        const [wurzeln, zustaende] = await Promise.all([
          getUserFoldersRoots(storage.idb),
          queryUserFoldersRootPermissions(storage.idb),
        ]);
        const alle: PersoenlicheUebernahmeWuensche[] = [];
        await jeWurzel(wurzeln, async root => {
          if (zustaende[root.id] !== 'granted') return 0;
          const teil = await collectUebernahmeWuensche(root.handle);
          alle.push(...teil);
          return teil.length;
        });
        if (cancelled) return;
        const batch = juengsterGewinnt(alle, w => normalizeKuerzel(w.kuerzel), w => w.updatedAt);
        setStand(buildWunschStand(batch, anonymMap));
      } catch {
        reset();
      }
    })();
    return () => { cancelled = true; };
  }, [storage, anonymMap, tick]);

  return { pendingByAntrag: wunschStand.byAntrag, wunschStand, reloadPending };
}
