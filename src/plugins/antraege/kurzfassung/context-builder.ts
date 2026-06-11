/**
 * Baut den `KurzfassungContext` aus Verbund + lead-first sortierten TVs. EXAKT
 * die Logik aus VerbundDetail (eine Quelle → kein zweiter Prompt-Pfad zwischen
 * Einzellauf und Batch). `headerId` = Verbund-ID bzw. echtes Aktenzeichen bei
 * Solo/pseudo. Strukturelle Param-Typen, damit sowohl `Antrag` als auch
 * `AntragListItem` (beide haben `aktenzeichen` + die Display-Felder) passen.
 */
import type { KurzfassungContext } from './types';

interface VerbundLike {
  akronym?: unknown;
  titel?: unknown;
}
interface TvLike {
  aktenzeichen: string;
  akronym?: unknown;
  titel?: unknown;
  antragsteller?: unknown;
}

function strOrNull(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length > 0 ? s : null;
}

export function buildKurzfassungContext(
  verbund: VerbundLike | null,
  antraege: TvLike[],
  headerId: string,
  /** Letzter Akronym-Fallback (VerbundDetail nutzt `verbund.verbund_id`; Batch `headerId`). */
  akronymFallback: string = headerId,
): KurzfassungContext {
  const lead = antraege[0];
  const akronym = strOrNull(verbund?.akronym) ?? strOrNull(lead?.akronym) ?? akronymFallback;
  const titel = strOrNull(verbund?.titel) ?? strOrNull(lead?.titel);
  const antragsteller = strOrNull(lead?.antragsteller);
  return {
    key: headerId,
    akronym,
    titel,
    antragsteller,
    foerderkennzeichen: headerId,
    knownIds: [headerId, ...antraege.map(a => a.aktenzeichen)],
    teilvorhaben: antraege.map((tv, idx) => ({
      nr: idx + 1,
      aktenzeichen: tv.aktenzeichen,
      titel: strOrNull(tv.titel),
      antragsteller: strOrNull(tv.antragsteller),
    })),
  };
}
