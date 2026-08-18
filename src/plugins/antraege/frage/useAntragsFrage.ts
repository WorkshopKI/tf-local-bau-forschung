/**
 * Die Frage an die Förderantrags-Liste — der Zustand hinter dem Umschalter.
 *
 * Bindet die drei reinen Teile zusammen und tut selbst so wenig wie möglich:
 * [antragsplan-lauf.ts](./antragsplan-lauf.ts) fragt das Modell,
 * [wendeAntragsplanAn.ts](./wendeAntragsplanAn.ts) schreibt das Ergebnis in die
 * vorhandenen Slots, und die Deutungszeile liest, was dabei herauskam.
 *
 * **Scheitert der Lauf, ändert sich nichts.** Kein Filter wird angefasst, die
 * Liste bleibt stehen — sie ist deterministisch entstanden und hängt an keinem
 * Modell. Die Meldung sagt das ausdrücklich.
 *
 * **Der Modus ist sitzungslokal.** Er wird bewusst nicht persistiert: eine
 * gemerkte Frage-Einstellung empfinge den Nutzer beim nächsten Start mit einem
 * Feld, das auf eine KI-Verbindung wartet, die vielleicht gar nicht steht.
 */
import { useCallback, useRef, useState } from 'react';
import { create } from 'zustand';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { monatsWert } from '../spaltenFilterWerte';
import { useAntraegeStore } from '../store';
import { useKopfFilter } from '../kopfFilter';
import { useFilterState } from '../filter/useFilterState';
import { ermittleAntragsplan } from './antragsplan-lauf';
import type { Antragsplan } from './antragsplan';
import { wendeAntragsplanAn, type PlanWirkung } from './wendeAntragsplanAn';

interface FrageModusStore {
  /** Steht der Umschalter auf „einer Frage"? Sitzungslokal. */
  nlModus: boolean;
  setNlModus: (v: boolean) => void;
}

export const useFrageModus = create<FrageModusStore>(set => ({
  nlModus: false,
  setNlModus: (v: boolean) => set({ nlModus: v }),
}));

export interface AntragsFrageErgebnis {
  nlModus: boolean;
  setNlModus: (v: boolean) => void;
  laeuft: boolean;
  /** Klartext-Meldung eines gescheiterten Laufs. `null` = alles in Ordnung. */
  fehler: string | null;
  /** Der Plan des letzten erfolgreichen Laufs — für die Deutungszeile. */
  plan: Antragsplan | null;
  /** Was davon gewirkt hat und was nicht. */
  wirkung: PlanWirkung | null;
  /** Stellt die Frage. Läuft höchstens einmal gleichzeitig. */
  stelleFrage: (frage: string) => Promise<void>;
  /** Verwirft Deutung und Meldung — die gesetzten Filter bleiben stehen. */
  verwirfDeutung: () => void;
}

export function useAntragsFrage(): AntragsFrageErgebnis {
  const nlModus = useFrageModus(s => s.nlModus);
  const setNlModusRoh = useFrageModus(s => s.setNlModus);
  const bridge = useAIBridge();

  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [plan, setPlan] = useState<Antragsplan | null>(null);
  const [wirkung, setWirkung] = useState<PlanWirkung | null>(null);
  const laufRef = useRef<AbortController | null>(null);

  const verwirfDeutung = useCallback((): void => {
    setPlan(null);
    setWirkung(null);
    setFehler(null);
  }, []);

  // Der Wechsel zurück zu Stichworten räumt die Deutung ab — sie beschriebe
  // sonst eine Frage, die gar nicht mehr im Feld steht (dieselbe Regel wie beim
  // Frageplan: eine Legende, die etwas anderes beschreibt als die Eingabe,
  // lügt). Die GESETZTEN Filter bleiben: sie sind jetzt der Stand des Nutzers.
  const setNlModus = useCallback((v: boolean): void => {
    setNlModusRoh(v);
    if (!v) verwirfDeutung();
  }, [setNlModusRoh, verwirfDeutung]);

  const stelleFrage = useCallback(async (frage: string): Promise<void> => {
    laufRef.current?.abort();
    const ctrl = new AbortController();
    laufRef.current = ctrl;

    setLaeuft(true);
    setFehler(null);
    try {
      const heuteJahr = new Date().getFullYear();
      const res = await ermittleAntragsplan(bridge, frage, heuteJahr, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (!res.ok) {
        // Nichts anfassen. Die Liste steht, wie sie stand.
        setFehler(res.fehler);
        setPlan(null);
        setWirkung(null);
        return;
      }

      // Die Monatswerte des Bestands: das Jahr ist ein Spaltenkopf-Filter über
      // konkrete `YYYY-MM`-Werte, und ein Jahr ohne einen einzigen davon muss
      // gemeldet statt still gesetzt werden.
      const antraege = useAntraegeStore.getState().antraege;
      const monatsWerte = [...new Set(
        antraege.map(a => monatsWert(a.antragsdatum)).filter(m => m.length > 0),
      )];

      const store = useAntraegeStore.getState();
      const w = wendeAntragsplanAn(res.plan, { monatsWerte }, {
        setActiveValue: (id, v) => useFilterState.getState().setActiveValue(id, v),
        setzeKopfSpalte: (key, werte) => useKopfFilter.getState().setzeSpalte(key, werte),
        setProjektart: store.setProjektart,
        setPrecheckBucket: store.setPrecheckBucket,
        setStillstandTage: store.setStillstandTage,
        setFrageKuerzel: store.setFrageKuerzel,
        // Die Leitbegriffe reisen über den Suchtext in die Wortlaut-Stufe: das
        // Feld trägt die Frage, `useAntraegeHybridSearch` gibt sie weiter.
        setPlanTeile: teile => store.setPlanTeile(teile),
      });
      setPlan(res.plan);
      setWirkung(w);
    } finally {
      if (!ctrl.signal.aborted) setLaeuft(false);
    }
  }, [bridge]);

  return { nlModus, setNlModus, laeuft, fehler, plan, wirkung, stelleFrage, verwirfDeutung };
}
