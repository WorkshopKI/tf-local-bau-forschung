import { useMemo } from 'react';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { useBereich } from '@/core/hooks/useBereich';
import { istImBereich } from '@/core/status/betrachtungsbereich';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import { applyInaktiveExclusion } from '@/plugins/antraege/bearbeiterFilter';
import { useInaktiveKuerzelSet } from '@/plugins/auslastung/hooks/useInaktiveKuerzelSet';
import { useShowInaktiveMasStore } from '@/plugins/antraege/useShowInaktiveMasStore';
import { countByAmpelBucket, type AmpelSchwellen } from '@/plugins/antraege/eingangAmpel';

export interface EingangAmpelCounts {
  frisch: number;
  warnung: number;
  kritisch: number;
  /** frisch + warnung + kritisch — offene Anträge mit gültigem Eingangsdatum. */
  total: number;
}

/**
 * Zählt die offenen Anträge in die drei Ampel-Buckets — die **gemeinsame**
 * Quelle für die Home-Sidebar-Karte (`EingangAmpelCard`) UND die Home-Kopfzeile
 * (`HomePage`). Beide teilen sich diesen Hook, damit die Subtitle-Zahlen IMMER
 * identisch zu den Karten-Zahlen sind (kein Drift).
 *
 * Der Bearbeiter-Filter kommt aus `useBearbeiterSicht` (billig) statt über die
 * schwere `useFilteredAntraege`-Pipeline — die Zahlen sind identisch (die Karte
 * nutzte davon ohnehin nur `bearbeiterFilter`), und der Meine/Alle-Umschalter
 * wirkt dadurch auf Kopfzeile und Karte gleichzeitig.
 *
 * `schwellen` (v2.229, optional): konfigurierbare Bucket-Grenzen aus der
 * Widget-Config. Kopfzeile UND Widget übergeben DIESELBEN Werte (aus
 * `ampelSchwellenAusConfig`) — kein Zahlen-Drift. Ohne Argument gelten die
 * bisherigen Defaults (30/90) unverändert.
 *
 * **Inaktive MAs (v4.131):** derselbe Ausschluss wie in `useDashboardData` und
 * in der Zieltabelle. Er fehlte hier — im „alle"-Modus zählte die Ampel Anträge
 * mit, die die Liste nach dem Klick ausblendet. Sichtbar wird das erst mit
 * gepflegten Auslastungs-Daten (ohne sie ist das Set leer und der Aufruf ein
 * No-op), gerechnet wurde die Zahl aber immer falsch.
 */
export function useEingangAmpelCounts(schwellen?: AmpelSchwellen): EingangAmpelCounts {
  const alleAntraege = useAntraegeStore(s => s.antraege);
  const bereichMenge = useBereich().menge;
  const { mode: bearbeiterFilter } = useBearbeiterSicht();
  const inaktiveKuerzel = useInaktiveKuerzelSet();
  const showInaktive = useShowInaktiveMasStore(s => s.showInaktive);
  // Arbeitsvorrat-Zähler ⇒ Betrachtungsbereich, wie die Liste (Pitfall #46);
  // danach der Inaktiv-Ausschluss, in derselben Reihenfolge wie im Dashboard.
  const antraege = useMemo(() => {
    const imBereich = bereichMenge === null
      ? alleAntraege
      : alleAntraege.filter(a => istImBereich(a.unterprogramm_id, bereichMenge));
    return applyInaktiveExclusion(imBereich, bearbeiterFilter.active, inaktiveKuerzel, showInaktive);
  }, [alleAntraege, bereichMenge, bearbeiterFilter.active, inaktiveKuerzel, showInaktive]);

  return useMemo(() => {
    const frisch = countByAmpelBucket(antraege, 'frisch', bearbeiterFilter, schwellen);
    const warnung = countByAmpelBucket(antraege, 'warnung', bearbeiterFilter, schwellen);
    const kritisch = countByAmpelBucket(antraege, 'kritisch', bearbeiterFilter, schwellen);
    return { frisch, warnung, kritisch, total: frisch + warnung + kritisch };
    // schwellen ist ein kleines Objekt — Werte statt Referenz als Deps.
  }, [antraege, bearbeiterFilter, schwellen?.warnschwelleTage, schwellen?.kritischSchwelleTage]);
}
