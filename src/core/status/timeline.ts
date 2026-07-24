/**
 * Reine Timeline-Logik (Phase 5): Prominenz-Auflösung, Lane-Zuordnung
 * (Verbund + je Teilvorhaben), Dichte-Clustering. Ohne React — die Komponente
 * konsumiert diese Funktionen.
 */
import type { MappingVersion, Prominenz } from './typen';
import { normalisiereWert } from './typen';
import type { StatusEvent } from './event-typen';
import { eventZeitMs } from './event-sort';

/** Prominenz eines Events: die des Wert-Eintrags, sonst der Feld-Default. */
export function eventProminenz(e: StatusEvent, version: MappingVersion): Prominenz {
  const w = version.werte.find(
    x => x.feldId === e.feldId && normalisiereWert(x.wert) === normalisiereWert(e.wert),
  );
  if (w) return w.prominenz;
  const f = version.felder.find(x => x.feldId === e.feldId);
  return f?.prominenzDefault ?? 'normal';
}

export interface TimelineEvent {
  event: StatusEvent;
  prominenz: Prominenz;
  ms: number;
}

export interface TimelineLanes {
  verbund: TimelineEvent[];
  tvLanes: { tvId: string; events: TimelineEvent[] }[];
}

/**
 * Filtert `ignoriert` (immer) + `nebensaechlich` (nur wenn `zeigeNebensaechlich`),
 * positioniert die Events auf der Zeitachse und teilt sie in die Verbund-Lane +
 * je eine TV-Lane. Rein.
 */
export function baueLanes(
  events: readonly StatusEvent[],
  version: MappingVersion,
  opts: { zeigeNebensaechlich: boolean },
): TimelineLanes {
  const sichtbar: TimelineEvent[] = [];
  for (const e of events) {
    const prominenz = eventProminenz(e, version);
    if (prominenz === 'ignoriert') continue;
    if (prominenz === 'nebensaechlich' && !opts.zeigeNebensaechlich) continue;
    sichtbar.push({ event: e, prominenz, ms: eventZeitMs(e) });
  }
  const verbund: TimelineEvent[] = [];
  const tvMap = new Map<string, TimelineEvent[]>();
  for (const te of sichtbar) {
    if (te.event.tvId) {
      const l = tvMap.get(te.event.tvId);
      if (l) l.push(te); else tvMap.set(te.event.tvId, [te]);
    } else {
      verbund.push(te);
    }
  }
  const nachZeit = (a: TimelineEvent, b: TimelineEvent): number => a.ms - b.ms;
  return {
    verbund: verbund.sort(nachZeit),
    tvLanes: [...tvMap.entries()]
      .map(([tvId, evs]) => ({ tvId, events: evs.sort(nachZeit) }))
      .sort((a, b) => a.tvId.localeCompare(b.tvId)),
  };
}

export interface Cluster {
  /** Zeitpunkt des ersten Events im Cluster (ms). */
  ms: number;
  events: TimelineEvent[];
}

/**
 * Fasst Events, deren Zeitpunkte näher als `schwelleMs` beieinander liegen, zu
 * einem Cluster-Punkt zusammen (Timeline-Kollisionsvermeidung). Rein.
 */
export function clustere(events: readonly TimelineEvent[], schwelleMs: number): Cluster[] {
  const sorted = [...events].sort((a, b) => a.ms - b.ms);
  const out: Cluster[] = [];
  for (const te of sorted) {
    const last = out[out.length - 1];
    if (last && te.ms - last.ms <= schwelleMs) {
      last.events.push(te);
    } else {
      out.push({ ms: te.ms, events: [te] });
    }
  }
  return out;
}
