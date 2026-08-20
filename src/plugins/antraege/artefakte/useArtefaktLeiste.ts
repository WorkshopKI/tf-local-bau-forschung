/**
 * IO-Schicht der Artefakt-Leiste (Journey-Paket 2 Phase 7). Lädt die
 * `WorkflowRun`-Stände (GA je Verbund, NF je TV) + die aufgelöste GA-Schrittliste
 * und ruft die reinen VM-Builder (`artefaktLeiste.ts`). Reuse — dieselben
 * Primitive wie die GA-/NF-Sektionen (`resolveWorkflowSteps`, `getWorkflowRun`,
 * `fristErgebnisVon` — dieselbe Frist-Engine wie Liste und Spalte), damit die
 * Karten-Zahlen deckungsgleich sind.
 *
 * Nur geladen, wenn das jeweilige Feature-Flag an ist. Doppel-IDB-Reads (Leiste +
 * Sektion) sind billig (kv-`get`); es wird KEIN Run geschrieben.
 */
import { useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { loadSkillRegistry } from '@/core/services/skills';
import { erlaubeWorkflowEntwuerfe, isGutachtenWorkflowEnabled, isNfNachforderungenEnabled } from '@/config/feature-flags';
import { verbundAntragsdatum } from '@/core/services/csv/frist';
import type { Antrag, AntragListItem } from '@/core/services/csv/types';
import { fristErgebnisVon } from '../fristAnzeige';
import { resolveWorkflowSteps } from '../gutachten/active-workflow';
import { getWorkflowRun } from '../gutachten/workflow-store';
import type { WorkflowRun } from '../gutachten/types';
import {
  buildGutachtenKarte, buildNachforderungKarte, istGutachtenPhase,
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

  // Prüfungs-Gate + phasen-bewusste Frist — aus den amtlichen Daten, wie in
  // Liste/Kopf (kein zweiter Frist-Begriff). Das Gate selbst lebt seit v4.3 als
  // reines Prädikat in `artefaktKarten.ts` und fragt die Arbeitsliste, nicht den
  // Verfahrensschritt (siehe dort).
  const istFachpruefung = istGutachtenPhase(status);
  // Dieselbe Engine wie Liste und Frist-Spalte (`berechneFrist` über
  // `fristErgebnisVon`), NICHT mehr die phasenblinde Altregel `computeFristDatum`.
  // Die kannte nur „gibt es ein Basisdatum?" und rechnete die 90-Tage-Uhr auch
  // für einen längst abgelehnten Vorgang weiter: gemessen 11 003 von 12 295
  // Vorgängen, für die die Karte eine Uhr zeigte, während die Liste daneben
  // „angehalten" sagte — bei 10 122 davon lag das Datum vor dem laufenden Jahr,
  // und `formatFristKurz` schneidet das Jahr ab (v4.124).
  const fristDatum = useMemo(() => {
    const vn = tvs[0]?.vn_eingang_datum;
    const fristInput: Pick<AntragListItem, 'status' | 'antragsdatum' | 'vn_eingang_datum'> = {
      // `status` ist eine gebrandete `AntragStatusRaw`; die Engine prüft
      // intern nur den Roh-String → Cast des schmalen Verbund-Status genügt.
      status: (status ?? '') as AntragListItem['status'],
      antragsdatum: verbundAntragsdatum(tvs) ?? undefined,
      vn_eingang_datum: typeof vn === 'string' ? vn : undefined,
    };
    const erg = fristErgebnisVon(fristInput);
    // Nur eine LAUFENDE Uhr bekommt ein Datum; angehalten/unberechenbar heißt
    // hier: kein Badge, statt eines Termins, den es nicht gibt.
    return erg.zustand === 'laeuft' ? erg.zielDatum ?? null : null;
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
