/**
 * Die Ordner-Spalten der Fördertabelle: welche kuratierten Ordner des
 * Statuskatalogs als einblendbare Spalte angeboten werden.
 *
 * Liest den In-Memory-Snapshot der aktiven Katalog-Fassung (denselben, aus dem
 * `getStatusCategory` liest) — kein IDB-Zugriff im Render-Pfad. Eine im Cockpit
 * gespeicherte Fassung wirkt hier nach dem nächsten Laden der Seite.
 *
 * Ohne das Flag `statusCockpit` gibt es keine Ordner-Spalten: die Tabelle bleibt
 * dann exakt wie zuvor.
 */
import { useMemo } from 'react';
import { isStatusCockpitEnabled } from '@/config/feature-flags';
import { getAktiveVersion, kategorienMitDatumsfeldern } from '@/core/status';

export interface KategorieSpalte {
  kategorieId: string;
  label: string;
}

export function useKategorieSpalten(): KategorieSpalte[] {
  return useMemo(() => {
    if (!isStatusCockpitEnabled()) return [];
    const version = getAktiveVersion();
    return version ? kategorienMitDatumsfeldern(version) : [];
  }, []);
}
