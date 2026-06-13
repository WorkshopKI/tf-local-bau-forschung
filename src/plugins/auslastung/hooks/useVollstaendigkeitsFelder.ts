/**
 * Lädt die Programm-Schemas und löst daraus die Vollständigkeits-Felder
 * (D_XTEC / D_ADV) auf — egal ob als Standard- oder als Eigenes Feld gemappt
 * (siehe `vollstaendigkeit-felder.ts`). Geteilt vom Klassifizieren- + Zuweisen-Tab.
 *
 * Modul-Cache pro Programm: überlebt Re-Mounts (Tab-Wechsel) und vermeidet das
 * kurze „alles vollständig"-Flackern, das sonst entstünde, während die Schemas
 * asynchron nachladen. Ein Programm-Wechsel / CSV-Re-Import (neuer Mount) lädt
 * frisch nach.
 */
import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { listSchemasByProgramm } from '@/core/services/csv/idb-csv';
import {
  resolveVollstaendigkeitsFelder,
  DEFAULT_VOLLSTAENDIGKEITS_FELDER,
  type VollstaendigkeitsFelder,
} from '../services/klassifizierung';

const felderCache = new Map<string, VollstaendigkeitsFelder>();

/** Externer Reset (z.B. nach CSV-Re-Import mit geänderter Mapping). */
export function invalidateVollstaendigkeitsFelder(): void {
  felderCache.clear();
}

export function useVollstaendigkeitsFelder(): VollstaendigkeitsFelder {
  const storage = useStorage();
  const programmId = useActiveProgramm(s => s.activeProgrammId);
  const [felder, setFelder] = useState<VollstaendigkeitsFelder>(
    () => (programmId && felderCache.get(programmId)) || DEFAULT_VOLLSTAENDIGKEITS_FELDER,
  );

  useEffect(() => {
    if (!programmId) {
      setFelder(DEFAULT_VOLLSTAENDIGKEITS_FELDER);
      return;
    }
    const cached = felderCache.get(programmId);
    if (cached) setFelder(cached);
    let cancelled = false;
    void listSchemasByProgramm(storage.idb, programmId)
      .then(schemas => {
        if (cancelled) return;
        const resolved = resolveVollstaendigkeitsFelder(schemas);
        felderCache.set(programmId, resolved);
        setFelder(resolved);
      })
      .catch(err => {
        console.warn('[useVollstaendigkeitsFelder] Schema-Load fehlgeschlagen:', err);
      });
    return () => { cancelled = true; };
  }, [storage, programmId]);

  return felder;
}
