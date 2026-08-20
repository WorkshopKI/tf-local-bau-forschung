import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { listUnterprogramme } from '@/core/services/csv';

const EMPTY: ReadonlyMap<string, string> = new Map();

// Modul-Cache pro Programm: Unterprogramm-Labels aendern sich nur via
// Kurator-Import (selten). Einmal pro Session + Programm aus IDB laden reicht;
// ein Reload uebernimmt zwischenzeitliche Aenderungen. Vermeidet, dass jede
// EckdatenCard (eine pro TV) denselben IDB-Read ausloest.
const cache = new Map<string, ReadonlyMap<string, string>>();

/**
 * Code→Name-Map der Unterprogramme eines Programms (z.B. "138" → "ZIM
 * FuE-Projekte 2025") fuer die Detail-Anzeige: statt der nackten
 * Unterprogramm-Nummer den sprechenden Namen zeigen.
 *
 * Leere Map solange der IDB-Load laeuft oder keine Unterprogramme registriert
 * sind → der Aufrufer faellt dann auf den Code zurueck. **Ein leeres Ergebnis
 * wird nicht gecacht** — es ist ein Zeitpunkt, kein Befund (siehe unten).
 */
export function useUnterprogrammLabels(
  programmId: string | null | undefined,
): ReadonlyMap<string, string> {
  const storage = useStorage();
  const [map, setMap] = useState<ReadonlyMap<string, string>>(
    () => (programmId ? cache.get(programmId) ?? EMPTY : EMPTY),
  );

  useEffect(() => {
    if (!programmId) {
      setMap(EMPTY);
      return;
    }
    const cached = cache.get(programmId);
    if (cached) {
      setMap(cached);
      return;
    }
    let cancelled = false;
    void (async () => {
      const ups = await listUnterprogramme(storage.idb, programmId);
      const next = new Map<string, string>();
      for (const up of ups) {
        const code = typeof up.code === 'string' ? up.code.trim() : '';
        const name = typeof up.name === 'string' ? up.name.trim() : '';
        if (code && name) next.set(code, name);
      }
      // Ein LEERER Bestand ist kein Ergebnis, sondern ein Zeitpunkt (wie beim
      // Netzwerk-Index in `store.ts`): `syncProgrammSnapshot` schreibt den Store
      // über `replaceStore` mit unbedingtem `clear()`, und `unterprogramme` steht
      // NICHT in `NEVER_EMPTY_STORES`. Wer in dieses Fenster liest und das
      // Ergebnis modul-global cacht, zeigt für den Rest der Sitzung die nackte
      // Nummer statt des Namens — ohne Fehlertext und ohne Nachladen.
      if (next.size > 0) cache.set(programmId, next);
      if (!cancelled) setMap(next);
    })().catch((e: unknown) => {
      console.error('[useUnterprogrammLabels] Laden fehlgeschlagen', e);
    });
    return () => {
      cancelled = true;
    };
  }, [programmId, storage.idb]);

  return map;
}
