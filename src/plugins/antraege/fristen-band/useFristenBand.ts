/**
 * Sammelt die Eingaben des {@link FristenBand} — und rechnet dabei **nichts**
 * zweimal.
 *
 * Die Frist kommt fertig aus `useZeilenVerlauf` (dort mit der Verlaufsquelle
 * fürs Haltedatum), der Stillstand aus `pruefeStillstand`, die Zieltage aus
 * `zieltageFuer`. Der Hook stellt nur zusammen.
 */
import { useMemo } from 'react';
import { findeStatusCode, type MappingVersion } from '@/core/status';
import type { FristBezug } from '@/core/status/frist-bezug';
import { pruefeStillstand, zieltageFuer, type WaechterErgebnis } from '@/core/status/waechter';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import { baueFristenBandModell, type FristenBandModell } from './fristenBandModell';
import type { VerbundMeilensteine } from '@/core/meilensteine/typen';

export interface BandQuelle {
  version: MappingVersion | null;
  frist: FristBezug | null;
  vorkommen: readonly FeldVorkommen[];
  statusRoh: unknown;
  /** ISO-Tag. */
  stichtag: string;
  journalAenderung?: string | null;
  meilensteine: VerbundMeilensteine | null;
}

export function useFristenBandModell(q: BandQuelle): FristenBandModell | null {
  return useMemo(() => {
    if (!q.version || !q.frist) return null;
    const statusCode = findeStatusCode(q.statusRoh)?.eintrag.code ?? null;
    const waechter: WaechterErgebnis = pruefeStillstand({
      version: q.version,
      vorkommen: q.vorkommen,
      statusCode,
      stichtag: q.stichtag,
      ...(q.journalAenderung !== undefined ? { journalAenderung: q.journalAenderung } : {}),
    });
    return baueFristenBandModell({
      bezug: q.frist,
      stichtag: q.stichtag,
      zieltage: zieltageFuer(q.version, statusCode),
      waechter,
      meilensteine: q.meilensteine,
    });
  }, [q.version, q.frist, q.vorkommen, q.statusRoh, q.stichtag, q.journalAenderung, q.meilensteine]);
}
