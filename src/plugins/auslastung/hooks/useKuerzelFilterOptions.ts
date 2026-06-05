/**
 * Dropdown-Optionen für die Profil-Kürzel-Auswahl in der pl/dev-Variante.
 *
 * Jeder kuerzel-map-Eintrag = ein TIB-Kürzel, das in den Anträgen vorkam
 * (= „MA hat Anträge in der Datenbank"). Das `aktiv`-Flag stammt aus
 * `auslastung.json` (`mitarbeiter[anonId].aktiv`); unbekannte MAs (kein
 * Record) gelten als aktiv. Sortierung: aktiv zuerst, dann alphabetisch.
 *
 * Rückgabe `null`, wenn das Auslastungs-Modul nicht aktiv ist
 * (`features.auslastung` aus) → der Caller (`ProfilTab`) fällt auf das
 * bestehende Freitextfeld zurück. Klartext-Kürzel sind unbedenklich, weil
 * pl/dev `deAnonymisierung` haben.
 */
import { useMemo } from 'react';
import { isAuslastungEnabled } from '@/config/feature-flags';
import { useKuerzelMap } from './useKuerzelMap';
import { useAuslastungData } from './useAuslastungData';

export interface KuerzelOption {
  /** TIB-Kürzel (Klartext, NFC+upper). */
  kuerzel: string;
  /** false = ehemaliger Bearbeiter; im Dropdown standardmäßig ausgeblendet. */
  aktiv: boolean;
}

export function useKuerzelFilterOptions(): KuerzelOption[] | null {
  const enabled = isAuslastungEnabled();
  const file = useKuerzelMap(s => s.file);
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);

  return useMemo(() => {
    if (!enabled) return null;
    const opts: KuerzelOption[] = file.entries.map(e => ({
      kuerzel: e.kuerzel,
      aktiv: mitarbeiter[e.anonId]?.aktiv ?? true,
    }));
    opts.sort((a, b) => {
      if (a.aktiv !== b.aktiv) return a.aktiv ? -1 : 1;
      return a.kuerzel.localeCompare(b.kuerzel, 'de');
    });
    return opts;
  }, [enabled, file, mitarbeiter]);
}
