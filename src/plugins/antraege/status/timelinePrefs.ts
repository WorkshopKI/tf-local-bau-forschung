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

export interface TimelinePrefs {
  zeigeNebensaechlich: boolean;
  ansicht: VerlaufAnsicht;
}

const KEY = 'status-timeline-prefs';

export const DEFAULT_PREFS: TimelinePrefs = {
  zeigeNebensaechlich: false,
  ansicht: 'chronik',
};

function normalisiere(roh: unknown): TimelinePrefs {
  const p = (roh ?? {}) as Partial<TimelinePrefs>;
  return {
    zeigeNebensaechlich: p.zeigeNebensaechlich === true,
    ansicht: p.ansicht === 'band' ? 'band' : 'chronik',
  };
}

export interface UseTimelinePrefs {
  prefs: TimelinePrefs;
  setNebensaechlich: (v: boolean) => void;
  setAnsicht: (a: VerlaufAnsicht) => void;
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
  };
}
