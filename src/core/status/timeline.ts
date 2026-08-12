/**
 * Prominenz-Auflösung für Ereignisse des gerätelokalen Protokolls. Rein, ohne
 * React.
 *
 * Bis v3.48 lagen hier auch die Lane-Zuordnung (`baueLanes`) und das
 * Dichte-Clustering (`clustere`) für die waagerechte Zeitstrahl-Ansicht. Die
 * Ansicht ist entfallen — sie zeigte das Ereignis-Protokoll und blieb leer,
 * solange eine Installation noch nichts mitgeschrieben hatte —, und mit ihr
 * ihre einzigen Aufrufer. `eventProminenz` bleibt: das Home-Widget
 * `StatusVerlaufWidget` liest es.
 */
import type { MappingVersion, Prominenz } from './typen';
import { normalisiereWert } from './typen';
import type { StatusEvent } from './event-typen';

/** Prominenz eines Events: die des Wert-Eintrags, sonst der Feld-Default. */
export function eventProminenz(e: StatusEvent, version: MappingVersion): Prominenz {
  const w = version.werte.find(
    x => x.feldId === e.feldId && normalisiereWert(x.wert) === normalisiereWert(e.wert),
  );
  if (w) return w.prominenz;
  const f = version.felder.find(x => x.feldId === e.feldId);
  return f?.prominenzDefault ?? 'normal';
}
