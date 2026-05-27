/**
 * useAuslastungIndex (v2.9 + v2.11) — gemeinsamer computeQuartalsAuslastung-Memo
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
 * **v2.11 — Cache ueberlebt Unmount.** Zusaetzlich zum Provider-`useMemo` gibt
 * es einen module-globalen Closure-Cache (`cachedIndex`). Der Provider wird
 * beim Plugin-Wechsel zwangsweise unmountet (siehe FLAT_ROUTE_PLUGIN_IDS), und
 * sein `useMemo`-State ist dann weg — `getOrComputeIndex` ist die letzte
 * Verteidigungslinie und liefert das vorige Ergebnis solange die Inputs
 * referentially identisch sind (was sie bei Re-Mount sind, weil
 * `useAntraegeCache` und `useAuslastungData` Zustand-Stores sind und stabile
 * Refs zurueckgeben).
 *
 * Caveat: nur Konsumenten innerhalb von `<AuslastungIndexProvider>` koennen
 * den Hook nutzen. NeueAntraegeFuerDich auf der Homepage berechnet seinen
 * Index weiter selbst — passt, weil dort nur EIN MA betrachtet wird (User).
 */
import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import type { Antrag } from '@/core/services/csv/types';
import { computeQuartalsAuslastung, type MaQuartalsAuslastung } from '../services/quartals-auslastung';
import { computeAltlasten, type MaAltlastBucket } from '../services/altlast';
import type { Zuweisung } from '../types';
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

// ─── Module-globaler Cache (ueberlebt Komponenten-Unmount) ─────────────────

interface CachedIndex {
  antraege: readonly Antrag[];
  zuweisungen: readonly Zuweisung[];
  toAnon: ReadonlyMap<string, string>;
  quartal: string;
  stundenProTV: number;
  value: AuslastungIndex;
}
let cachedIndex: CachedIndex | null = null;

/** Liefert den Auslastungs-Index aus dem Closure-Cache wenn die Inputs
 *  referentially identisch sind (gleicher Programm-Load = gleiche Refs aus
 *  den Zustand-Stores). Sonst neu berechnen und cachen. Exportiert NUR fuer
 *  Tests — Konsumenten in der App nutzen `useAuslastungIndex`. */
export function getOrComputeIndex(
  antraege: readonly Antrag[],
  zuweisungen: readonly Zuweisung[],
  toAnon: ReadonlyMap<string, string>,
  quartal: string,
  stundenProTV: number,
): AuslastungIndex {
  if (cachedIndex
      && cachedIndex.antraege === antraege
      && cachedIndex.zuweisungen === zuweisungen
      && cachedIndex.toAnon === toAnon
      && cachedIndex.quartal === quartal
      && cachedIndex.stundenProTV === stundenProTV) {
    return cachedIndex.value;
  }
  const value: AuslastungIndex = {
    auslastungByAnon: computeQuartalsAuslastung(antraege, zuweisungen, toAnon, quartal, stundenProTV),
    altlastByAnon: computeAltlasten(antraege, toAnon, quartal, stundenProTV),
  };
  cachedIndex = { antraege, zuweisungen, toAnon, quartal, stundenProTV, value };
  return value;
}

/** Cache-Invalidierung — fuer Tests + ggf. spaeter fuer harte Reset-Pfade. */
export function invalidateAuslastungIndexCache(): void {
  cachedIndex = null;
}

// ─── Provider ──────────────────────────────────────────────────────────────

export function AuslastungIndexProvider({ children }: { children: ReactNode }): React.ReactElement {
  const cache = useAntraegeCache();
  const zuweisungen = useAuslastungData(s => s.data.zuweisungen);
  const aktuellesQuartal = useAuslastungData(s => s.data.config.aktuellesQuartal);
  const stundenProTV = useAuslastungData(s => s.data.config.stundenProTV);

  const value = useMemo<AuslastungIndex>(
    () => getOrComputeIndex(
      cache.antraege,
      zuweisungen,
      cache.anonymMap.toAnon,
      aktuellesQuartal,
      stundenProTV ?? 9,
    ),
    [cache.antraege, cache.anonymMap, zuweisungen, aktuellesQuartal, stundenProTV],
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
