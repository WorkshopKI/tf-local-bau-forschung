import type { Antrag, Verbund } from '@/core/services/csv/types';

/** Verbund-IDs mit diesem Prefix sind synthetisch und repraesentieren einen
 *  Standalone-Antrag (kein echter Verbund-Datensatz im IDB-Store). Die
 *  zusammengefuehrte Detail-Ansicht (`VerbundDetail`) bootstrappt sich aus dem
 *  Antrag selbst, der TV wird automatisch expandiert. */
export const PSEUDO_VERBUND_PREFIX = '__pseudo__';

export function isPseudoVerbundId(verbundId: string): boolean {
  return verbundId.startsWith(PSEUDO_VERBUND_PREFIX);
}

export function pseudoVerbundIdFor(aktenzeichen: string): string {
  return PSEUDO_VERBUND_PREFIX + aktenzeichen;
}

export function aktenzeichenFromPseudoVerbundId(verbundId: string): string {
  return verbundId.slice(PSEUDO_VERBUND_PREFIX.length);
}

/** Baut einen synthetischen Verbund aus einem einzelnen Antrag. Dadurch kann
 *  `VerbundDetail` denselben Code-Pfad fuer echte Verbuende und Standalone-
 *  Antraege nutzen — der einzige TV ist der Antrag selbst, automatisch
 *  expandiert. */
export function buildPseudoVerbund(antrag: Antrag): Verbund {
  return {
    verbund_id: pseudoVerbundIdFor(antrag.aktenzeichen),
    programm_id: antrag.programm_id,
    akronym: typeof antrag.akronym === 'string' ? antrag.akronym : undefined,
    titel: typeof antrag.titel === 'string' ? antrag.titel : undefined,
    status: antrag.status,
    teilantrags_ids: [antrag.aktenzeichen],
    _field_sources: antrag._field_sources,
    _updated_at: antrag._updated_at,
  };
}
