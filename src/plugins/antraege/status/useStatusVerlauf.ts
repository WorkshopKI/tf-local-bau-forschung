/**
 * Lädt Status-Historie + abgeleiteten Status eines Verbunds für die Status-
 * Detailansicht (Timeline + „Warum" + nächste Schritte). Gerätelokal, read-only.
 */
import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { getVerbund, listAntraegeByVerbund } from '@/core/services/csv/idb-csv';
import {
  getAktiveVersion, ladeAktiveVersion, getStatusEvents, baueVerbundFelder,
  leiteStatusAb, aufzeichnungsGrenze,
  type MappingVersion, type StatusEvent, type AbleitungsErgebnis,
} from '@/core/status';

export interface StatusVerlauf {
  laden: boolean;
  version: MappingVersion | null;
  events: StatusEvent[];
  ableitung: AbleitungsErgebnis | null;
  /** „ab hier lückenlose Aufzeichnung" (ISO) oder null. */
  grenze: string | null;
}

const LEER: StatusVerlauf = { laden: true, version: null, events: [], ableitung: null, grenze: null };

export function useStatusVerlauf(verbundId: string | null): StatusVerlauf {
  const storage = useStorage();
  const idb = storage.idb;
  const [state, setState] = useState<StatusVerlauf>(LEER);

  useEffect(() => {
    if (!verbundId) { setState({ ...LEER, laden: false }); return; }
    let abgebrochen = false;
    setState(s => ({ ...s, laden: true }));
    void (async () => {
      try {
        const version = getAktiveVersion() ?? await ladeAktiveVersion(idb);
        const [verbund, antraege, events] = await Promise.all([
          getVerbund(idb, verbundId),
          listAntraegeByVerbund(idb, verbundId),
          getStatusEvents(idb, verbundId),
        ]);
        if (abgebrochen) return;
        const vf = baueVerbundFelder(
          version, verbundId,
          (verbund ?? {}) as unknown as Record<string, unknown>,
          antraege.map(a => ({ aktenzeichen: a.aktenzeichen, record: a as unknown as Record<string, unknown> })),
        );
        const ableitung = leiteStatusAb(version, vf.felder, vf.tvFelder, new Date().toISOString());
        setState({ laden: false, version, events, ableitung, grenze: aufzeichnungsGrenze(events) });
      } catch {
        if (!abgebrochen) setState({ ...LEER, laden: false });
      }
    })();
    return () => { abgebrochen = true; };
  }, [idb, verbundId]);

  return state;
}
