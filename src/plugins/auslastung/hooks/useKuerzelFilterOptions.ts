/**
 * Dropdown-Optionen für die Profil-Kürzel-Auswahl in der pl/dev-Variante.
 *
 * Quelle = **Vereinigung** zweier Quellen, damit die Optionen schon verfügbar
 * sind, sobald Anträge geladen sind — unabhängig vom kuerzel-map-Sync, der erst
 * über den Auslastungs-Cache läuft (Cold-Start-Robustheit; sonst zeigt das
 * Profil fälschlich das Freitextfeld):
 *  1. distinct `tib_kuerz` aus der geladenen Förderanträge-Slim-Liste
 *     (`useAntraegeStore.antraege`) — im Normalfluss bereits beim Home-Mount
 *     befüllt, also vor dem Öffnen von Einstellungen.
 *  2. `kuerzel-map.entries` — die persistente, kanonische Liste (nach Sync).
 *
 * `aktiv`-Flag je Kürzel: über die AnonymMap (`toAnon: Kürzel→anonId`) auf
 * `auslastung.json` (`mitarbeiter[anonId].aktiv`); Kürzel ohne Map-Eintrag
 * (neu, nur in Anträgen) gelten als aktiv. Sortierung: aktiv zuerst, dann
 * alphabetisch.
 *
 * Rückgabe `null` NUR wenn das Auslastungs-Modul aus ist (`features.auslastung`
 * false → kurator/demo) → der Caller (`ProfilTab`) zeigt das Freitextfeld. In
 * pl/dev nie `null` (auch leer = `[]`), damit der Dropdown zuverlässig
 * erscheint. Klartext-Kürzel sind unbedenklich, weil pl/dev `deAnonymisierung` haben.
 */
import { useMemo } from 'react';
import { isAuslastungEnabled } from '@/config/feature-flags';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { useKuerzelMap } from './useKuerzelMap';
import { useAuslastungData } from './useAuslastungData';
import { normalizeKuerzel } from '../services/anonym-map';
import { buildAnonymMapFromKuerzelMap } from '../services/kuerzel-map';
import { CANONICAL_TIB_KUERZ } from '../types';

export interface KuerzelOption {
  /** TIB-Kürzel (Klartext, NFC+upper). */
  kuerzel: string;
  /** false = ehemaliger Bearbeiter; im Dropdown standardmäßig ausgeblendet. */
  aktiv: boolean;
}

export function useKuerzelFilterOptions(): KuerzelOption[] | null {
  const enabled = isAuslastungEnabled();
  const antraege = useAntraegeStore(s => s.antraege);
  const file = useKuerzelMap(s => s.file);
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);

  return useMemo(() => {
    if (!enabled) return null;
    // Distinct-Kürzel aus beiden Quellen sammeln (beide NFC+upper normalisiert).
    const kuerzelSet = new Set<string>();
    for (const a of antraege) {
      const k = normalizeKuerzel((a as unknown as Record<string, unknown>)[CANONICAL_TIB_KUERZ]);
      if (k) kuerzelSet.add(k);
    }
    for (const e of file.entries) kuerzelSet.add(e.kuerzel);

    const anonymMap = buildAnonymMapFromKuerzelMap(file);
    const opts: KuerzelOption[] = [...kuerzelSet].map(kuerzel => {
      const anonId = anonymMap.toAnon.get(kuerzel);
      // Kürzel ohne Map-Eintrag (neu, nur in Anträgen) → kein anonId → aktiv.
      return { kuerzel, aktiv: mitarbeiter[anonId ?? '']?.aktiv ?? true };
    });
    opts.sort((a, b) => {
      if (a.aktiv !== b.aktiv) return a.aktiv ? -1 : 1;
      return a.kuerzel.localeCompare(b.kuerzel, 'de');
    });
    return opts;
  }, [enabled, antraege, file, mitarbeiter]);
}
