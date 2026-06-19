/**
 * Aggregation (rein) der Roh-Events zu Pro-Skill-Kennzahlen. Keine IO — die
 * Leseschicht (`read.ts`) sammelt die Events und ruft `aggregate` auf.
 */
import { istUsageEvent, type SkillSignalEvent } from './types';

/** Ein Feedback-Kommentar mit Herkunft (für die Kurator-Ansicht in S2). */
export interface SkillKommentar {
  notiz: string;
  ts: string;
  userId: string;
  /** Skill-Version, auf die sich das Feedback bezog. */
  version: number;
}

/** Aggregierte Kennzahlen eines Skills über alle Nutzer. */
export interface SkillAggregat {
  /** Anzahl der `'lauf'`-Events (Grundlage „meistgenutzt"). */
  nutzung: number;
  up: number;
  down: number;
  /** ISO-Zeitstempel der jüngsten Nutzung (`null`, wenn nie genutzt). */
  letzteNutzung: string | null;
  kommentare: SkillKommentar[];
}

/** `skillId → SkillAggregat`. */
export type SkillAggregatMap = Map<string, SkillAggregat>;

function leeresAggregat(): SkillAggregat {
  return { nutzung: 0, up: 0, down: 0, letzteNutzung: null, kommentare: [] };
}

/**
 * Faltet die Vereinigung aller Nutzer-Events zu einer `skillId → SkillAggregat`-Map.
 * ISO-Zeitstempel werden lexikografisch verglichen (= chronologisch bei gleichem
 * Format). Reihenfolge-unabhängig.
 */
export function aggregate(events: SkillSignalEvent[]): SkillAggregatMap {
  const map: SkillAggregatMap = new Map();
  const ensure = (skillId: string): SkillAggregat => {
    let e = map.get(skillId);
    if (!e) {
      e = leeresAggregat();
      map.set(skillId, e);
    }
    return e;
  };
  for (const ev of events) {
    const e = ensure(ev.skillId);
    if (istUsageEvent(ev)) {
      e.nutzung += 1;
      if (e.letzteNutzung === null || ev.ts > e.letzteNutzung) e.letzteNutzung = ev.ts;
    } else {
      if (ev.rating === 'up') e.up += 1;
      else e.down += 1;
      if (ev.notiz) {
        e.kommentare.push({ notiz: ev.notiz, ts: ev.ts, userId: ev.userId, version: ev.skillVersion });
      }
    }
  }
  return map;
}
