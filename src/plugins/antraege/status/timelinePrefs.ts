/**
 * Anzeige-Präferenzen der Verlaufs-Sichten — pro Gerät in IndexedDB (kv-Key),
 * NIE localStorage, NIE Share.
 */
import { useCallback, useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';

/**
 * Welche Verlaufs-Ansicht offen ist — die Chronik (senkrecht, Liste) oder das
 * Band (waagerecht, Bahn). Beide lesen dieselben Termine aus den Datumsspalten.
 *
 * Der Standard bleibt `chronik`: ein geänderter Default verwirft keine
 * gespeicherte Wahl, er überschreibt sie nur für die, die noch keine haben.
 *
 * **`zeitstrahl` ist mit v3.48 entfallen** — es war die Sicht auf das
 * gerätelokale Ereignis-Protokoll und blieb leer, solange diese Installation
 * noch keine Änderung mitgeschrieben hatte. Der NAME ist auf das Band übergegangen
 * (der Reiter heißt jetzt „Zeitstrahl"), der WERT nicht: `normalisiere` lässt
 * jede gespeicherte `zeitstrahl`-Wahl auf die Chronik zurückfallen, statt einen
 * Zustand ohne Render-Zweig zu hinterlassen.
 */
export type VerlaufAnsicht = 'chronik' | 'band';

/**
 * Wie die Chronik ordnet: nach **Schritt** (Matrix Kürzel × Träger) oder nach
 * **Datum** (chronologisch). Zwei Sichten auf dieselben Termine.
 *
 * Der Standard ist `schritt`: die Frage, mit der die Statussektion geöffnet
 * wird, ist „wo stehen wir, und wer fehlt noch" — und die beantwortet der
 * Vergleich über die Teilvorhaben, nicht die Zeitfolge. Wer den Hergang
 * nachlesen will, ist einen Klick entfernt.
 */
export type ChronikModus = 'schritt' | 'datum';

export interface TimelinePrefs {
  zeigeNebensaechlich: boolean;
  ansicht: VerlaufAnsicht;
  modus: ChronikModus;
}

const KEY = 'status-timeline-prefs';

export const DEFAULT_PREFS: TimelinePrefs = {
  zeigeNebensaechlich: false,
  ansicht: 'chronik',
  modus: 'schritt',
};

function normalisiere(roh: unknown): TimelinePrefs {
  const p = (roh ?? {}) as Partial<TimelinePrefs>;
  return {
    zeigeNebensaechlich: p.zeigeNebensaechlich === true,
    ansicht: p.ansicht === 'band' ? 'band' : 'chronik',
    // Bestandsstände tragen kein `modus` — sie bekommen den neuen Standard,
    // nicht die alte Zeitfolge: ein Default zu ändern verwirft keine
    // gespeicherte Wahl, er gilt für die, die noch keine haben.
    modus: p.modus === 'datum' ? 'datum' : 'schritt',
  };
}

export interface UseTimelinePrefs {
  prefs: TimelinePrefs;
  setNebensaechlich: (v: boolean) => void;
  setAnsicht: (a: VerlaufAnsicht) => void;
  setModus: (m: ChronikModus) => void;
}

export function useTimelinePrefs(): UseTimelinePrefs {
  const storage = useStorage();
  const idb = storage.idb;
  const [prefs, setPrefs] = useState<TimelinePrefs>(DEFAULT_PREFS);

  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      const gespeichert = await idb.get<TimelinePrefs>(KEY).catch(() => null);
      if (!abgebrochen && gespeichert) setPrefs(normalisiere(gespeichert));
    })();
    return () => { abgebrochen = true; };
  }, [idb]);

  const mutiere = useCallback((next: TimelinePrefs) => {
    setPrefs(next);
    void idb.set(KEY, next).catch(() => {});
  }, [idb]);

  return {
    prefs,
    setNebensaechlich: v => mutiere({ ...prefs, zeigeNebensaechlich: v }),
    setAnsicht: a => mutiere({ ...prefs, ansicht: a }),
    setModus: m => mutiere({ ...prefs, modus: m }),
  };
}
