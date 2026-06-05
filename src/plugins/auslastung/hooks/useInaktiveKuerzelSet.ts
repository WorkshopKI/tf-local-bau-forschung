/**
 * Liefert die Menge der TIB-Kürzel **inaktiver** MAs (`aktiv === false`),
 * NFC+uppercase-normalisiert. Konsumiert von der Förderanträge-/Home-Pipeline,
 * um im „alle"-Modus Anträge ehemaliger Bearbeiter auszublenden
 * (`applyInaktiveExclusion`).
 *
 * Quelle: kuerzel-map (`entries: {kuerzel, anonId}`, kuerzel bereits
 * NFC+upper) + `auslastung.json` (`mitarbeiter[anonId].aktiv`). Beide werden
 * beim App-Start via Plugin-`onInit` geladen (pl/dev).
 *
 * Außerhalb pl/dev (`features.auslastung` aus) → **leeres Set** ⇒ die
 * Exklusions-Stufe ist dort ein No-op (prod/kurator/demo unverändert).
 */
import { useMemo } from 'react';
import { isAuslastungEnabled } from '@/config/feature-flags';
import { useKuerzelMap } from './useKuerzelMap';
import { useAuslastungData } from './useAuslastungData';

const EMPTY_SET: ReadonlySet<string> = new Set();

export function useInaktiveKuerzelSet(): ReadonlySet<string> {
  const enabled = isAuslastungEnabled();
  const file = useKuerzelMap(s => s.file);
  const mitarbeiter = useAuslastungData(s => s.data.mitarbeiter);

  return useMemo(() => {
    if (!enabled) return EMPTY_SET;
    const out = new Set<string>();
    for (const e of file.entries) {
      // kuerzel-map-Einträge sind bereits NFC+upper normalisiert
      // (`bootstrapKuerzelMap` → `normalizeKuerzel`). Unbekannte MAs (kein
      // Record) gelten als aktiv → nicht ausgeblendet.
      if (mitarbeiter[e.anonId]?.aktiv === false) out.add(e.kuerzel);
    }
    return out;
  }, [enabled, file, mitarbeiter]);
}
