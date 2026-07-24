/**
 * State-/IO-Schicht der Widerspruchs-Ansicht: lädt die RNE/ABL-Bescheide des Verbunds
 * (je TV), die zugehörigen tragenden Gründe (aus den gestempelten `werkbankPunkte` +
 * dem Werkbank-Punkte-Store) und den persistierten Abgleich-Stand.
 *
 * Rein gerätelokal — kein Share/Mirror; der Abgleich ist Arbeitsstand EINES Prüfers.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { getWorkflowRun } from '../gutachten/workflow-store';
import { ladeWerkbank } from '../werkbank/werkbank-store';
import type { WerkbankPunkt } from '../werkbank/types';
import type { KurzfassungContext } from '../kurzfassung/types';
import { ladeWiderspruch, speichereWiderspruch } from './widerspruch-store';
import { setzeNotiz, setzeZustand } from './widerspruch';
import type { WiderspruchRecord, WiderspruchZustand } from './types';

/** Bescheid-Typen, die eine Widerspruchs-Ansicht auslösen (NF ist keiner). */
export type WiderspruchTyp = 'rne' | 'abl';

/** Ein tragender Grund des Bescheids (aufgelöst zur Anzeige). */
export interface TragenderGrund {
  punktKey: string;
  text: string;
  aspektId: string | null;
}

export interface WiderspruchController {
  loading: boolean;
  /** Bescheid-Typ, sofern ein RNE/ABL-Lauf existiert (sonst null → keine Sektion). */
  bescheidTyp: WiderspruchTyp | null;
  gruende: TragenderGrund[];
  record: WiderspruchRecord | null;
  setzeGrundZustand: (punktKey: string, zustand: WiderspruchZustand) => void;
  setzeGrundNotiz: (punktKey: string, notiz: string) => void;
  setzeStellungnahme: (docId: string | undefined) => void;
}

export function useWiderspruch(ctx: KurzfassungContext): WiderspruchController {
  const storage = useStorage();
  const [loading, setLoading] = useState(true);
  const [bescheidTyp, setBescheidTyp] = useState<WiderspruchTyp | null>(null);
  const [gruende, setGruende] = useState<TragenderGrund[]>([]);
  const [record, setRecord] = useState<WiderspruchRecord | null>(null);

  const azListe = useMemo(() => ctx.teilvorhaben.map(tv => tv.aktenzeichen), [ctx.teilvorhaben]);
  const azKey = azListe.join('|');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      // RNE hat Vorrang vor ABL (falls beide existieren — im Regelfall genau einer).
      const [rneRuns, ablRuns, werkbank, wRec] = await Promise.all([
        Promise.all(azListe.map(az => getWorkflowRun(storage.idb, az, 'rne'))),
        Promise.all(azListe.map(az => getWorkflowRun(storage.idb, az, 'abl'))),
        ladeWerkbank(storage.idb, ctx.key),
        ladeWiderspruch(storage.idb, ctx.key),
      ]);
      if (cancelled) return;

      const rne = rneRuns.filter((r): r is NonNullable<typeof r> => r !== null);
      const abl = ablRuns.filter((r): r is NonNullable<typeof r> => r !== null);
      const typ: WiderspruchTyp | null = rne.length > 0 ? 'rne' : abl.length > 0 ? 'abl' : null;
      const runs = rne.length > 0 ? rne : abl;

      // Tragende Gründe = Vereinigung der gestempelten Punkt-Keys, aufgelöst über die
      // Werkbank-Punkte (Text + Aspekt). Reihenfolge = Werkbank-Reihenfolge, stabil.
      const keys = new Set(runs.flatMap(r => r.werkbankPunkte ?? []));
      const byKey = new Map(werkbank.punkte.map((p: WerkbankPunkt) => [p.key, p]));
      const g: TragenderGrund[] = werkbank.punkte
        .filter(p => keys.has(p.key))
        .map(p => ({ punktKey: p.key, text: p.text, aspektId: p.aspektId }));
      // Fallback für Keys ohne Werkbank-Punkt (gelöscht) — als roher Key, damit nichts verschwindet.
      for (const k of keys) if (!byKey.has(k)) g.push({ punktKey: k, text: '(Punkt nicht mehr im Arbeitsvorrat)', aspektId: null });

      setBescheidTyp(typ);
      setGruende(g);
      setRecord(wRec);
      setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- skalare Anker statt ctx
  }, [ctx.key, azKey, storage.idb]);

  const persist = useCallback((next: WiderspruchRecord): void => {
    setRecord(next);
    void speichereWiderspruch(storage.idb, next);
  }, [storage.idb]);

  const basis = useCallback(
    (): WiderspruchRecord => record ?? { verbundAz: ctx.key, punkte: [], schemaVersion: 1 },
    [record, ctx.key],
  );

  const setzeGrundZustand = useCallback((punktKey: string, zustand: WiderspruchZustand): void => {
    const b = basis();
    persist({ ...b, punkte: setzeZustand(b.punkte, punktKey, zustand) });
  }, [basis, persist]);

  const setzeGrundNotiz = useCallback((punktKey: string, notiz: string): void => {
    const b = basis();
    persist({ ...b, punkte: setzeNotiz(b.punkte, punktKey, notiz) });
  }, [basis, persist]);

  const setzeStellungnahme = useCallback((docId: string | undefined): void => {
    const b = basis();
    persist({ ...b, ...(docId ? { stellungnahmeDocId: docId } : { stellungnahmeDocId: undefined }) });
  }, [basis, persist]);

  return { loading, bescheidTyp, gruende, record, setzeGrundZustand, setzeGrundNotiz, setzeStellungnahme };
}
