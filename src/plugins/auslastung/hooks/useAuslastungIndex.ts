/**
 * useAuslastungIndex (v2.9) — gemeinsamer computeQuartalsAuslastung-Memo
 * fuer alle drei Tabs des Auslastungs-Moduls.
 *
 * Bisher berechneten StatistikPanel, MitarbeiterUndKapazitaet UND
 * ZuweisungsCockpit denselben `Map<anonId, MaQuartalsAuslastung>` jeweils
 * unabhaengig (3× redundant, je ~200-500ms bei 5000 Antraegen). Mit dem
 * `AuslastungIndexProvider` auf AuslastungView-Ebene laeuft die Berechnung
 * **einmal pro Render-Cycle** — alle Konsumenten lesen denselben Wert.
 *
 * Effektiv: ~600 ms Einsparung beim Erstmount des Auslastungs-Moduls.
 *
 * Caveat: nur Konsumenten innerhalb von `<AuslastungIndexProvider>` koennen
 * den Hook nutzen. NeueAntraegeFuerDich auf der Homepage berechnet seinen
 * Index weiter selbst — passt, weil dort nur EIN MA betrachtet wird (User).
 */
import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { computeQuartalsAuslastung, type MaQuartalsAuslastung } from '../services/quartals-auslastung';
import { computeAltlasten, type MaAltlastBucket } from '../services/altlast';
import { useAuslastungData } from './useAuslastungData';
import { useAntraegeCache } from './useAntraegeCache';

export interface AuslastungIndex {
  /** Pro anonId: fest-/pending-Buckets fuer das aktuelle Quartal. */
  auslastungByAnon: Map<string, MaQuartalsAuslastung>;
  /** Pro anonId: noch offene Antraege aus den letzten 2 Quartalen (exklusiv
   *  aktuelles). Rein informativ — fliesst NICHT in `kapazitaetsScore` ein.
   *  MAs ohne Altlast erscheinen NICHT in der Map. */
  altlastByAnon: Map<string, MaAltlastBucket>;
}

const AuslastungIndexCtx = createContext<AuslastungIndex | null>(null);

export function AuslastungIndexProvider({ children }: { children: ReactNode }): React.ReactElement {
  const cache = useAntraegeCache();
  const zuweisungen = useAuslastungData(s => s.data.zuweisungen);
  const aktuellesQuartal = useAuslastungData(s => s.data.config.aktuellesQuartal);
  const stundenProTV = useAuslastungData(s => s.data.config.stundenProTV);

  const auslastungByAnon = useMemo(
    () => computeQuartalsAuslastung(
      cache.antraege,
      zuweisungen,
      cache.anonymMap.toAnon,
      aktuellesQuartal,
      stundenProTV ?? 9,
    ),
    [cache.antraege, cache.anonymMap, zuweisungen, aktuellesQuartal, stundenProTV],
  );

  const altlastByAnon = useMemo(
    () => computeAltlasten(
      cache.antraege,
      cache.anonymMap.toAnon,
      aktuellesQuartal,
      stundenProTV ?? 9,
    ),
    [cache.antraege, cache.anonymMap, aktuellesQuartal, stundenProTV],
  );

  const value = useMemo<AuslastungIndex>(
    () => ({ auslastungByAnon, altlastByAnon }),
    [auslastungByAnon, altlastByAnon],
  );
  return createElement(AuslastungIndexCtx.Provider, { value }, children);
}

/** Liest den gemeinsamen Auslastungs-Index. Wirft, wenn ausserhalb des
 *  Providers aufgerufen — das ist ein Bug, sollte nicht passieren. */
export function useAuslastungIndex(): AuslastungIndex {
  const ctx = useContext(AuslastungIndexCtx);
  if (!ctx) {
    throw new Error('useAuslastungIndex must be used within AuslastungIndexProvider');
  }
  return ctx;
}
