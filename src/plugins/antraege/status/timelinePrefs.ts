/**
 * Anzeige-Präferenzen der Status-Timeline — pro Gerät in IndexedDB (kv-Key),
 * NIE localStorage, NIE Share. Toggles, Zeitraum-Preset, eingeklappte TV-Lanes.
 */
import { useCallback, useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';

export type ZeitraumPreset = 'gesamt' | '12m' | '90t';

export interface TimelinePrefs {
  zeigeNebensaechlich: boolean;
  preset: ZeitraumPreset;
  /** TV-IDs, deren Lane eingeklappt ist. */
  eingeklappt: string[];
}

const KEY = 'status-timeline-prefs';

export const DEFAULT_PREFS: TimelinePrefs = {
  zeigeNebensaechlich: false,
  preset: 'gesamt',
  eingeklappt: [],
};

function normalisiere(roh: unknown): TimelinePrefs {
  const p = (roh ?? {}) as Partial<TimelinePrefs>;
  return {
    zeigeNebensaechlich: p.zeigeNebensaechlich === true,
    preset: p.preset === '12m' || p.preset === '90t' ? p.preset : 'gesamt',
    eingeklappt: Array.isArray(p.eingeklappt) ? p.eingeklappt.filter(x => typeof x === 'string') : [],
  };
}

export interface UseTimelinePrefs {
  prefs: TimelinePrefs;
  setNebensaechlich: (v: boolean) => void;
  setPreset: (p: ZeitraumPreset) => void;
  toggleLane: (tvId: string) => void;
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
    setPreset: p => mutiere({ ...prefs, preset: p }),
    toggleLane: tvId => mutiere({
      ...prefs,
      eingeklappt: prefs.eingeklappt.includes(tvId)
        ? prefs.eingeklappt.filter(x => x !== tvId)
        : [...prefs.eingeklappt, tvId],
    }),
  };
}
