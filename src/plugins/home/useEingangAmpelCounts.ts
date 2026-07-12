import { useMemo } from 'react';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { parseBearbeiterFilter } from '@/plugins/antraege/bearbeiterFilter';
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
 * Der Bearbeiter-Filter wird direkt aus `parseBearbeiterFilter` abgeleitet
 * (billig) statt über die schwere `useFilteredAntraege`-Pipeline — die Zahlen
 * sind identisch (die Karte nutzte davon ohnehin nur `bearbeiterFilter`).
 *
 * `schwellen` (v2.229, optional): konfigurierbare Bucket-Grenzen aus der
 * Widget-Config. Kopfzeile UND Widget übergeben DIESELBEN Werte (aus
 * `ampelSchwellenAusConfig`) — kein Zahlen-Drift. Ohne Argument gelten die
 * bisherigen Defaults (30/90) unverändert.
 */
export function useEingangAmpelCounts(schwellen?: AmpelSchwellen): EingangAmpelCounts {
  const antraege = useAntraegeStore(s => s.antraege);
  const { profile } = useProfile();
  const meinKuerzel = useMeinKuerzel();

  return useMemo(() => {
    const bearbeiterFilter = parseBearbeiterFilter(meinKuerzel, profile?.bearbeiter_inkl_begleitung);
    const frisch = countByAmpelBucket(antraege, 'frisch', bearbeiterFilter, schwellen);
    const warnung = countByAmpelBucket(antraege, 'warnung', bearbeiterFilter, schwellen);
    const kritisch = countByAmpelBucket(antraege, 'kritisch', bearbeiterFilter, schwellen);
    return { frisch, warnung, kritisch, total: frisch + warnung + kritisch };
    // schwellen ist ein kleines Objekt — Werte statt Referenz als Deps.
  }, [antraege, meinKuerzel, profile?.bearbeiter_inkl_begleitung, schwellen?.warnschwelleTage, schwellen?.kritischSchwelleTage]);
}
