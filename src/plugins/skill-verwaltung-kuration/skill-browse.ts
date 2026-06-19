/**
 * Reine Facetten-/Sortier-Funktionen für die Skill-Browse-Ansicht. Arbeiten über
 * Registry-Skills + S1-Aggregat (Nutzung/Feedback) — kein IO, kein React, damit
 * sie im Component memoisiert werden können (kein Vollscan pro Tastendruck).
 */
import type { Reifegrad, SkillRecord } from '@/core/services/skills';
import type { SkillAggregatMap } from '@/core/services/skill-feedback';

export type SkillSortKey = 'datum' | 'nutzung' | 'feedback' | 'name';

export interface SkillFacets {
  /** Reifegrad-Filter (`'alle'` = kein Filter). */
  reifegrad: Reifegrad | 'alle';
  /** Nur Skills, die diese Regel nutzen (`null` = kein Filter, „nutzt Regel X"). */
  regelId: string | null;
}

export const DEFAULT_FACETS: SkillFacets = { reifegrad: 'alle', regelId: null };

function reifegradOf(s: SkillRecord): Reifegrad {
  return s.reifegrad ?? 'entwurf';
}

/** Reiner Facetten-Filter (Reifegrad + „nutzt Regel X"). */
export function filterSkills(skills: SkillRecord[], facets: SkillFacets): SkillRecord[] {
  return skills.filter(s => {
    if (facets.reifegrad !== 'alle' && reifegradOf(s) !== facets.reifegrad) return false;
    if (facets.regelId && !s.regelIds.includes(facets.regelId)) return false;
    return true;
  });
}

function nutzungOf(map: SkillAggregatMap | null, id: string): number {
  return map?.get(id)?.nutzung ?? 0;
}

function netFeedback(map: SkillAggregatMap | null, id: string): number {
  const a = map?.get(id);
  return a ? a.up - a.down : 0;
}

/** Reine, stabile Sortierung (kopiert; mutiert das Eingabe-Array NICHT). */
export function sortSkills(
  skills: SkillRecord[],
  agg: SkillAggregatMap | null,
  sortKey: SkillSortKey,
): SkillRecord[] {
  const copy = [...skills];
  const byName = (a: SkillRecord, b: SkillRecord): number => a.name.localeCompare(b.name, 'de');
  switch (sortKey) {
    case 'name':
      copy.sort(byName);
      break;
    case 'nutzung':
      copy.sort((a, b) => nutzungOf(agg, b.id) - nutzungOf(agg, a.id) || byName(a, b));
      break;
    case 'feedback':
      copy.sort((a, b) => netFeedback(agg, b.id) - netFeedback(agg, a.id) || byName(a, b));
      break;
    case 'datum':
    default:
      // ISO-Strings lexikografisch = chronologisch; neueste zuerst.
      copy.sort((a, b) => (a.geaendert_am < b.geaendert_am ? 1 : a.geaendert_am > b.geaendert_am ? -1 : 0));
      break;
  }
  return copy;
}
