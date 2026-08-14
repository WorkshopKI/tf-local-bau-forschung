/**
 * Dropdown-Optionen für die Profil-Kürzel-Auswahl in der pl/dev-Variante.
 *
 * Diese Datei ist reine Store-Verdrahtung; die Regeln (welche Spalten, welches
 * `aktiv`, welche Reihenfolge) stehen in `kuerzelOptionen.ts`.
 *
 * Quelle = **Vereinigung** zweier Quellen, damit die Optionen schon verfügbar
 * sind, sobald Anträge geladen sind — unabhängig vom kuerzel-map-Sync, der erst
 * über den Auslastungs-Cache läuft (Cold-Start-Robustheit; sonst zeigt das
 * Profil fälschlich das Freitextfeld):
 *  1. distinct `tib_kuerz` + `bib_kuerz` aus der geladenen Förderanträge-Slim-
 *     Liste (`useAntraegeStore.antraege`) — im Normalfluss bereits beim
 *     Home-Mount befüllt, also vor dem Öffnen von Einstellungen.
 *  2. `kuerzel-map.entries` — die persistente, kanonische Liste (nach Sync).
 *
 * Rückgabe `null` NUR wenn der Dropdown aus ist (`isKuerzelDropdownEnabled()`
 * false — weder Auslastungs-Modul noch das `kuerzelDropdown`-Flag → prod/demo)
 * → der Caller (`AntraegeSichtGruppe`) zeigt das Freitextfeld. Sonst nie `null`
 * (auch leer = `[]`), damit der Dropdown zuverlässig erscheint. Klartext-Kürzel
 * sind unbedenklich — sie stehen ohnehin in der Förderanträge-Tabelle. Ohne
 * Auslastungs-Daten (kein kuerzel-map-/`mitarbeiter`-Sync) defaulten alle
 * Kürzel auf `aktiv: true`, der Dropdown speist sich aus `antraege`.
 */
import { useMemo } from 'react';
import { isKuerzelDropdownEnabled } from '@/config/feature-flags';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { useKuerzelMap } from './useKuerzelMap';
import { useAuslastungData } from './useAuslastungData';
import { buildAnonymMapFromKuerzelMap } from '../services/identitaet';
import { baueKuerzelOptionen, type KuerzelOption } from './kuerzelOptionen';

export type { KuerzelOption };

export function useKuerzelFilterOptions(): KuerzelOption[] | null {
  const enabled = isKuerzelDropdownEnabled();
  const antraege = useAntraegeStore(s => s.antraege);
  const file = useKuerzelMap(s => s.file);
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);

  return useMemo(() => {
    if (!enabled) return null;
    return baueKuerzelOptionen(
      antraege as unknown as ReadonlyArray<Record<string, unknown>>,
      file.entries.map(e => e.kuerzel),
      buildAnonymMapFromKuerzelMap(file),
      mitarbeiter,
    );
  }, [enabled, antraege, file, mitarbeiter]);
}
