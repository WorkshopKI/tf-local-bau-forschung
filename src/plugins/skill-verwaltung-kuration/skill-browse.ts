/**
 * Reine Facetten-/Sortier-Funktionen für die Skill-Browse-Ansicht. Arbeiten über
 * Registry-Skills + S1-Aggregat (Nutzung/Feedback) — kein IO, kein React, damit
 * sie im Component memoisiert werden können (kein Vollscan pro Tastendruck).
 */
import {
  effektiveSkillKategorie,
  skillKategorieLabel,
  skillKategorieRang,
  SKILL_KATEGORIE_ORDER,
  type Reifegrad,
  type SkillRecord,
} from '@/core/services/skills';
import type { SkillAggregatMap } from '@/core/services/skill-feedback';

export type SkillSortKey = 'kategorie' | 'datum' | 'nutzung' | 'feedback' | 'name';

export interface SkillFacets {
  /** Reifegrad-Filter (`'alle'` = kein Filter). */
  reifegrad: Reifegrad | 'alle';
  /** Nur Skills, die diese Regel nutzen (`null` = kein Filter, „nutzt Regel X"). */
  regelId: string | null;
  /** Nur Skills dieser (effektiven) Kategorie (`null` = kein Filter). */
  kategorie: string | null;
}

export const DEFAULT_FACETS: SkillFacets = { reifegrad: 'alle', regelId: null, kategorie: null };

function reifegradOf(s: SkillRecord): Reifegrad {
  return s.reifegrad ?? 'entwurf';
}

/** Reiner Facetten-Filter (Reifegrad + „nutzt Regel X" + Kategorie). */
export function filterSkills(skills: SkillRecord[], facets: SkillFacets): SkillRecord[] {
  return skills.filter(s => {
    if (facets.reifegrad !== 'alle' && reifegradOf(s) !== facets.reifegrad) return false;
    if (facets.regelId && !s.regelIds.includes(facets.regelId)) return false;
    if (facets.kategorie && effektiveSkillKategorie(s) !== facets.kategorie) return false;
    return true;
  });
}

/** Ein Kategorie-Eintrag der Facetten-Auswahl (Key + Label + Trefferzahl). */
export interface SkillKategorieKandidat {
  key: string;
  label: string;
  count: number;
}

/**
 * Belegte Kategorien der übergebenen Skills in stabiler `SKILL_KATEGORIE_ORDER`
 * (unbekannte Kategorien stabil ans Ende). Leere Buckets fallen raus — die
 * Auswahl zeigt nur, was es tatsächlich gibt.
 */
export function skillKategorieKandidaten(skills: SkillRecord[]): SkillKategorieKandidat[] {
  const counts = new Map<string, number>();
  const labels = new Map<string, string>();
  for (const s of skills) {
    const k = effektiveSkillKategorie(s);
    counts.set(k, (counts.get(k) ?? 0) + 1);
    if (!labels.has(k)) labels.set(k, skillKategorieLabel(s));
  }
  const order = [...SKILL_KATEGORIE_ORDER];
  for (const k of counts.keys()) if (!order.includes(k)) order.push(k);
  const out: SkillKategorieKandidat[] = [];
  for (const k of order) {
    const count = counts.get(k);
    if (!count) continue;
    out.push({ key: k, label: labels.get(k) ?? k, count });
  }
  return out;
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
    case 'kategorie':
      // Fachliche Reihenfolge (SKILL_KATEGORIE_ORDER), NICHT alphabetisch nach
      // Label; innerhalb einer Kategorie stabil nach Name.
      copy.sort((a, b) => skillKategorieRang(a) - skillKategorieRang(b) || byName(a, b));
      break;
    case 'datum':
    default:
      // ISO-Strings lexikografisch = chronologisch; neueste zuerst.
      copy.sort((a, b) => (a.geaendert_am < b.geaendert_am ? 1 : a.geaendert_am > b.geaendert_am ? -1 : 0));
      break;
  }
  return copy;
}
