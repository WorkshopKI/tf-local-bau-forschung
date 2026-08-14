/**
 * Der Programm-Bestand des Panels „Verzeichnisse": die Liste, die Antragszahl
 * je Programm und das aktive Programm.
 *
 * Aus `ProgrammeAdminPage` herausgezogen, weil ihn seit v4.36 DREI Stellen
 * derselben Seite brauchen — die Programm-Gruppe, die Unterprogramm-Gruppe
 * (sie haengt am aktiven Programm) und die Nebenspalte. Zweimal laden hiesse,
 * zwei Staende derselben Sache nebeneinanderzustellen.
 */
import { useCallback, useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useActiveProgramm } from '@/core/hooks/useActiveProgramm';
import { ensureDefaultProgramm } from '@/core/services/csv';
import { listAntraegeByProgramm, listProgramme } from '@/core/services/csv/idb-csv';
import type { Programm } from '@/core/services/csv/types';

export interface ProgrammBestand {
  programme: Programm[];
  /** Antragszahl je Programm-Id — entscheidet, ob „Löschen" möglich ist. */
  antragCounts: Map<string, number>;
  activeProgrammId: string | null;
  /** Das aktive Programm selbst, `null` solange nichts geladen ist. */
  aktives: Programm | null;
  refresh: () => Promise<void>;
}

export function useProgrammBestand(): ProgrammBestand {
  const storage = useStorage();
  const activeProgrammId = useActiveProgramm(s => s.activeProgrammId);
  const refreshActive = useActiveProgramm(s => s.refresh);
  const [programme, setProgramme] = useState<Programm[]>([]);
  const [antragCounts, setAntragCounts] = useState<Map<string, number>>(new Map());

  const refresh = useCallback(async () => {
    await ensureDefaultProgramm(storage.idb).catch(() => undefined);
    const list = await listProgramme(storage.idb);
    setProgramme(list);
    const counts = new Map<string, number>();
    for (const p of list) {
      const a = await listAntraegeByProgramm(storage.idb, p.id);
      counts.set(p.id, a.length);
    }
    setAntragCounts(counts);
    await refreshActive(storage.idb);
  }, [storage.idb, refreshActive]);

  useEffect(() => { void refresh(); }, [refresh]);

  return {
    programme,
    antragCounts,
    activeProgrammId,
    aktives: programme.find(p => p.id === activeProgrammId) ?? null,
    refresh,
  };
}
