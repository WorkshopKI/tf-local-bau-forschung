/**
 * Reine Sortier-Logik der Status-Historie.
 *
 * Bis v3.48 stand hier auch `aufzeichnungsGrenze` („ab hier lückenlose
 * Aufzeichnung"). Sie beschriftete allein die waagerechte Zeitstrahl-Ansicht;
 * mit deren Wegfall blieb kein Leser übrig.
 */
import { parseGermanDate } from '@/core/services/csv/dateParse';
import type { StatusEvent } from './event-typen';

function alsIso(s: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s;
  return parseGermanDate(s);
}

/** Vergleichs-Zeitpunkt (ms): `datumFachlich` bevorzugt, sonst `erfasstAm`.
 *  Unparsebares `datumFachlich` fällt auf `erfasstAm` zurück. */
export function eventZeitMs(e: StatusEvent): number {
  const iso = e.datumFachlich ? alsIso(e.datumFachlich) : null;
  const ms = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isNaN(ms)) return ms;
  return new Date(e.erfasstAm).getTime();
}

/** Chronologisch (älteste zuerst). Stabiler Tie-Break: erfasstAm, dann id. */
export function sortiereEvents(events: readonly StatusEvent[]): StatusEvent[] {
  return [...events].sort((a, b) => {
    const d = eventZeitMs(a) - eventZeitMs(b);
    if (d !== 0) return d;
    const e = a.erfasstAm.localeCompare(b.erfasstAm);
    if (e !== 0) return e;
    return a.id.localeCompare(b.id);
  });
}
