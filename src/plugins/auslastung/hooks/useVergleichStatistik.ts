/**
 * useVergleichStatistik — berechnet die Quartals-Statistik fuer ein
 * OPTIONALES Vergleichsquartal (Statistik-Uebersicht, Delta-Overlay).
 *
 * Liefert `null`, solange kein Vergleichsquartal gewaehlt ist — die O(antraege)-
 * Aggregation faellt also nur an, wenn der User aktiv vergleicht.
 *
 * Bewusst NICHT ueber `getOrComputeIndex`/`useAuslastungIndex`: dessen
 * module-globaler `cachedIndex` ist auf `config.aktuellesQuartal` gekeyt — ein
 * anderes Quartal wuerde den Cache bei jedem Render thrashen. Wir rufen die
 * reinen Service-Funktionen direkt auf, in einem eigenen `useMemo`.
 *
 * Caveat (bewusst): MA-Bestand + Kapazitaets-Config (jahresKapazitaet,
 * abschlagProzent, aktiv) sind Ist-Zustand und werden rueckwirkend auf das
 * Vergangenheits-Quartal angewendet (Naeherung). `abgemeldet` ist dagegen
 * quartalsgenau. Fuer ein vergangenes Quartal ist der Fortschritt 100 % —
 * der Vergleich zeigt also den End-Buchungsstand.
 */
import { useMemo } from 'react';
import {
  computeQuartalsAuslastung,
  computeQuartalsStatistik,
  type QuartalsStatistik,
} from '../services/kapazitaet';
import { useAuslastungData } from './useAuslastungData';
import { useAntraegeCache } from './useAntraegeCache';

export function useVergleichStatistik(
  vergleichsQuartal: string | null,
): QuartalsStatistik | null {
  const cache = useAntraegeCache();
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);
  const config = useAuslastungData(s => s.data.config);
  const zuweisungen = useAuslastungData(s => s.data.zuweisungen);

  return useMemo<QuartalsStatistik | null>(() => {
    if (!vergleichsQuartal) return null;
    const auslastungByAnon = computeQuartalsAuslastung(
      cache.antraege,
      zuweisungen,
      cache.anonymMap.toAnon,
      vergleichsQuartal,
      config.stundenProTV ?? 9,
      config.stundenProTVProTyp,
    );
    return computeQuartalsStatistik(mitarbeiter, auslastungByAnon, config, vergleichsQuartal);
  }, [vergleichsQuartal, cache.antraege, cache.anonymMap, zuweisungen, mitarbeiter, config]);
}
