/**
 * Verbünde, deren Bearbeitungsplan gefährdet oder nicht haltbar ist — für die
 * Frage der Projektleitung „Welche Verbünde reißen ihren Plan?".
 *
 * Aus derselben Meilenstein-Projektion wie das Fristen-Widget (`holeProjektion`,
 * `useFristenLage`), nicht neu gerechnet. Geschnitten auf die Richtlinien des
 * Bestandslaufs, damit der Block einen Nenner hat. Geladen erst, wenn eine Frage
 * den Bestand braucht; ohne Flag `meilensteinMonitoring` gibt es keine Aussage.
 */
import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { isMeilensteinMonitoringEnabled } from '@/config/feature-flags';
import { listProgramme, listSchemasByProgramm } from '@/core/services/csv/idb-csv';
import { freigegebeneFassung, holeProjektion, ladePlan } from '@/core/meilensteine';
import { bestandslaufMenge, istImBereich } from '@/core/status';
import type { PlanRisiko } from './bestandBlock';

export interface PlanRisikenStand {
  /** Wird noch geladen (oder ist angefragt, aber nicht fertig)? */
  laden: boolean;
  /** `null` = nicht geladen bzw. ohne Flag keine Aussage. */
  risiken: readonly PlanRisiko[] | null;
}

export function usePlanRisiken(an: boolean, stichtag: string): PlanRisikenStand {
  const idb = useStorage().idb;
  const antraege = useAntraegeStore(s => s.antraege);
  const verbundById = useAntraegeStore(s => s.verbundById);
  const flag = isMeilensteinMonitoringEnabled();
  const [stand, setStand] = useState<{ fertig: boolean; risiken: PlanRisiko[] | null }>(
    { fertig: false, risiken: null },
  );

  useEffect(() => {
    if (!an || !flag || stand.fertig) return;
    let abgebrochen = false;
    void (async () => {
      try {
        const plan = freigegebeneFassung((await ladePlan(idb)).plan);
        if (!plan) { if (!abgebrochen) setStand({ fertig: true, risiken: [] }); return; }
        // Die Richtlinie eines Verbunds steht an seinen Teilvorhaben.
        const lauf = bestandslaufMenge(null);
        const richtlinie = new Map<string, unknown>();
        for (const a of antraege) if (a.verbund_id && !richtlinie.has(a.verbund_id)) richtlinie.set(a.verbund_id, a.unterprogramm_id);
        const risiken: PlanRisiko[] = [];
        for (const p of await listProgramme(idb)) {
          const schemas = await listSchemasByProgramm(idb, p.id);
          const projektion = await holeProjektion(idb, p.id, plan, schemas, stichtag);
          if (abgebrochen) return;
          for (const v of projektion.verbuende) {
            if (v.prognose !== 'gefaehrdet' && v.prognose !== 'nichtHaltbar') continue;
            if (!istImBereich(richtlinie.get(v.verbundId), lauf)) continue;
            risiken.push({
              verbundId: v.verbundId,
              titel: verbundById.get(v.verbundId)?.akronym ?? v.verbundId,
              prognose: v.prognose === 'gefaehrdet' ? 'gefährdet' : 'nicht haltbar',
              restTage: v.restTage,
            });
          }
        }
        if (!abgebrochen) setStand({ fertig: true, risiken });
      } catch {
        // Ohne Projektion keine Aussage — die Frage wartet nicht ewig darauf.
        if (!abgebrochen) setStand({ fertig: true, risiken: null });
      }
    })();
    return () => { abgebrochen = true; };
  }, [an, flag, stand.fertig, idb, stichtag, antraege, verbundById]);

  if (!flag) return { laden: false, risiken: null };
  return { laden: an && !stand.fertig, risiken: stand.risiken };
}
