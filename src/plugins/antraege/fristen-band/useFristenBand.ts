/**
 * Sammelt die Eingaben des {@link FristenBand} — und rechnet dabei **nichts**
 * zweimal.
 *
 * Die Frist kommt fertig aus `useZeilenVerlauf` (dort mit der Verlaufsquelle
 * fürs Haltedatum), der Stillstand seit v3.38 aus {@link useZeilenWaechter}
 * (beide Reiter lesen denselben), die Zieltage aus `zieltageFuer`. Der Hook
 * stellt nur zusammen.
 */
import { useMemo } from 'react';
import { findeStatusCode, type MappingVersion } from '@/core/status';
import type { FristBezug } from '@/core/status/frist-bezug';
import { zieltageFuer, type WaechterErgebnis } from '@/core/status/waechter';
import { baueFristenBandModell, type FristenBandModell } from './fristenBandModell';
import type { VerbundMeilensteine } from '@/core/meilensteine/typen';

export interface BandQuelle {
  version: MappingVersion | null;
  frist: FristBezug | null;
  statusRoh: unknown;
  /** ISO-Tag. */
  stichtag: string;
  /** Fertig gerechnet von {@link useZeilenWaechter} — hier wird er nur gelesen. */
  waechter: WaechterErgebnis | null;
  meilensteine: VerbundMeilensteine | null;
}

export function useFristenBandModell(q: BandQuelle): FristenBandModell | null {
  return useMemo(() => {
    if (!q.version || !q.frist) return null;
    const statusCode = findeStatusCode(q.statusRoh)?.eintrag.code ?? null;
    return baueFristenBandModell({
      bezug: q.frist,
      stichtag: q.stichtag,
      zieltage: zieltageFuer(q.version, statusCode),
      waechter: q.waechter,
      meilensteine: q.meilensteine,
    });
  }, [q.version, q.frist, q.statusRoh, q.stichtag, q.waechter, q.meilensteine]);
}
