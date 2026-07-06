/**
 * IO-Schicht der Artefakt-Leiste (Journey-Paket 2 Phase 7). Lädt die
 * `WorkflowRun`-Stände (GA je Verbund, NF je TV) + die aufgelöste GA-Schrittliste
 * und ruft die reinen VM-Builder (`artefaktLeiste.ts`). Reuse — dieselben
 * Primitive wie die GA-/NF-Sektionen (`resolveWorkflowSteps`, `getWorkflowRun`,
 * `computeFristDatum`), damit die Karten-Zahlen deckungsgleich sind.
 *
 * Nur geladen, wenn das jeweilige Feature-Flag an ist. Doppel-IDB-Reads (Leiste +
 * Sektion) sind billig (kv-`get`); es wird KEIN Run geschrieben.
 */
import { useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { loadSkillRegistry } from '@/core/services/skills';
import { erlaubeWorkflowEntwuerfe, isGutachtenWorkflowEnabled, isNfNachforderungenEnabled } from '@/config/feature-flags';
import { computeFristDatum, verbundAntragsdatum } from '@/core/services/csv/frist';
import type { Antrag, AntragListItem } from '@/core/services/csv/types';
import { resolveWorkflowSteps } from '../gutachten/active-workflow';
import { getWorkflowRun } from '../gutachten/workflow-store';
import type { WorkflowRun } from '../gutachten/types';
import { statusZuStepperPosition } from '../statusZuStepperPosition';
import {
  buildGutachtenKarte, buildNachforderungKarte,
  type GutachtenKarte, type NachforderungKarte,
} from './artefaktKarten';

export interface ArtefaktLeisteState {
  loading: boolean;
  gutachten: GutachtenKarte | null;
  nachforderung: NachforderungKarte | null;
}

const LEER: ArtefaktLeisteState = { loading: false, gutachten: null, nachforderung: null };

export function useArtefaktLeiste(input: {
  /** Verbund-Scope-Key (GA-Run + Frist-Basis). */
  ctxKey: string;
  tvs: Antrag[];
  /** Amtlicher Verbund-Status (Fachprüfungs-Gate + Frist-Phase). */
  status: string | null;
}): ArtefaktLeisteState {
  const { ctxKey, tvs, status } = input;
  const storage = useStorage();
  const gaFlag = isGutachtenWorkflowEnabled();
  const nfFlag = isNfNachforderungenEnabled();

  const [state, setState] = useState<ArtefaktLeisteState>({ loading: gaFlag || nfFlag, gutachten: null, nachforderung: null });

  // Stabiler Lade-Schlüssel: Verbund-Key + TV-Aktenzeichen (Reihenfolge zählt) + Status.
  const azList = useMemo(() => tvs.map(t => t.aktenzeichen), [tvs]);
  const azKey = azList.join(',');

  // Fachprüfungs-Gate (Stepper-Station 3, nicht terminal) + phasen-bewusste Frist —
  // aus den amtlichen Daten, wie in Liste/Kopf (kein zweiter Frist-Begriff).
  const pos = statusZuStepperPosition(status);
  const istFachpruefung = pos.station === 3 && !pos.terminal;
  const fristDatum = useMemo(() => {
    const vn = tvs[0]?.vn_eingang_datum;
    const fristInput: Pick<AntragListItem, 'status' | 'antragsdatum' | 'vn_eingang_datum'> = {
      // `status` ist eine gebrandete `AntragStatusRaw`; `computeFristDatum` prüft
      // intern nur den Roh-String → Cast des schmalen Verbund-Status genügt.
      status: (status ?? '') as AntragListItem['status'],
      antragsdatum: verbundAntragsdatum(tvs) ?? undefined,
      vn_eingang_datum: typeof vn === 'string' ? vn : undefined,
    };
    return computeFristDatum(fristInput);
  }, [azKey, status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!gaFlag && !nfFlag) { setState(LEER); return; }
    let cancelled = false;
    (async () => {
      setState(s => ({ ...s, loading: true }));

      let gutachten: GutachtenKarte | null = null;
      if (gaFlag) {
        const [reg, run] = await Promise.all([
          loadSkillRegistry(storage),
          getWorkflowRun(storage.idb, ctxKey, 'ga'),
        ]);
        if (cancelled) return;
        const steps = resolveWorkflowSteps(reg.file, 'ga', { erlaubeEntwuerfe: erlaubeWorkflowEntwuerfe() })
          .filter(s => s.rolle !== 'llm_qs');
        gutachten = buildGutachtenKarte(run, steps, istFachpruefung);
      }

      let nachforderung: NachforderungKarte | null = null;
      if (nfFlag && azList.length > 0) {
        const runs = await Promise.all(azList.map(az => getWorkflowRun(storage.idb, az, 'nf')));
        if (cancelled) return;
        const map = new Map<string, WorkflowRun>();
        azList.forEach((az, i) => { const r = runs[i]; if (r) map.set(az, r); });
        nachforderung = buildNachforderungKarte({
          tvs: azList.map(az => ({ aktenzeichen: az })),
          nfRunByAz: map,
          fristDatum,
        });
      }

      if (cancelled) return;
      setState({ loading: false, gutachten, nachforderung });
    })();
    return () => { cancelled = true; };
    // storage ist Context-stabil; auf Key/Status/Flags/Frist reagieren.
  }, [ctxKey, azKey, status, gaFlag, nfFlag, istFachpruefung, fristDatum]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
