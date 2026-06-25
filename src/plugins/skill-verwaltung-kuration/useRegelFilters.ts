/**
 * Facetten-Filter der Qualitätsregeln (Einfach-Auswahl je Facette, wirkt in
 * allen Ansichten — Liste/Tabelle/Karten). Ersetzt die frühere Tabellen-nur-
 * Spalten-Filterung + Gruppierung. UX-Vorbild: Förderanträge-Quickfilter.
 *
 * Facetten:
 *  - `kategorie` „Art" (effektiveKategorie, 6 Buckets) = Inhalts-Achse,
 *  - `pruefart` = Ausführungsweg (textlich/fachlich/administrativ) = Mechanismus,
 *  - `schweregrad`, `aktiv`,
 *  - `skill` = „Verwendet in" (n:m → Membership statt Exact-Match).
 *
 * KEINE Typ-Facette: der grob gruppierte Typ verdoppelte Kategorie (deterministische
 * Regeln) bzw. Prüfart (QS-Regeln) — die Kategorie wird ja AUS typ+pruefart abgeleitet.
 * Der granulare Typ lebt nur noch in der Tabellen-Spalte (`typLabel`), nicht als Filter.
 *
 * Kein zweites typ→kategorie-Mapping (Pitfall #31): die Kategorie kommt über
 * `kategorieLabel`/`effektiveKategorie`. Filter- und Kandidaten-Logik sind als
 * reine Funktionen (`applyRegelFilters`/`computeRegelCandidates`) ausgelagert,
 * der Hook ist nur der State-Wrapper — so bleiben sie testbar.
 */
import { useCallback, useMemo, useState } from 'react';
import { DATA_TABLE_COLLATOR } from '@/components/data-table';
import {
  KATEGORIE_LABEL,
  KATEGORIE_ORDER,
  skillsUsingRegel,
  type QualitaetsRegel,
  type SkillRegistryFile,
} from '@/core/services/skills';
import {
  kategorieLabel,
  pruefartLabel,
  sevLabel,
  aktivLabel,
  PRUEFART_LABEL,
} from './regelShared';

/** Sentinel-Wert „kein Filter" — entspricht dem `defaultValue` der `CollapsibleSeg`. */
export const ALLE = 'Alle';

export type RegelFacetKey = 'kategorie' | 'pruefart' | 'schweregrad' | 'aktiv' | 'skill';

export type RegelFacetValues = Record<RegelFacetKey, string>;

export interface RegelFacetCandidate {
  label: string;
  count: number;
}

export interface UseRegelFiltersResult {
  values: RegelFacetValues;
  setValue: (key: RegelFacetKey, value: string) => void;
  resetAll: () => void;
  anyActive: boolean;
  candidates: Record<RegelFacetKey, RegelFacetCandidate[]>;
  filtered: QualitaetsRegel[];
}

const EMPTY_VALUES: RegelFacetValues = {
  kategorie: ALLE, pruefart: ALLE, schweregrad: ALLE, aktiv: ALLE, skill: ALLE,
};

/** Wert-Extraktor je 1:1-Facette (Skill ist n:m → separat in `applyRegelFilters`). */
function facetValue(key: Exclude<RegelFacetKey, 'skill'>, r: QualitaetsRegel): string {
  switch (key) {
    case 'kategorie': return kategorieLabel(r);
    case 'pruefart': return pruefartLabel(r);
    case 'schweregrad': return sevLabel(r);
    case 'aktiv': return aktivLabel(r);
  }
}

/** AND über alle aktiven (≠ „Alle") Facetten. Leerer Filter → unveränderte Liste. */
export function applyRegelFilters(
  rules: QualitaetsRegel[],
  file: SkillRegistryFile,
  values: RegelFacetValues,
): QualitaetsRegel[] {
  const active = (Object.entries(values) as [RegelFacetKey, string][]).filter(([, v]) => v !== ALLE);
  if (active.length === 0) return rules;
  return rules.filter(r => active.every(([key, v]) => {
    if (key === 'skill') return skillsUsingRegel(file, r.id).includes(v);
    return facetValue(key, r) === v;
  }));
}

/** Werte zählen, in `preferredOrder` zuerst, Rest collator-sortiert ans Ende. */
function buildCandidates(values: string[], preferredOrder: string[]): RegelFacetCandidate[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const inOrder = preferredOrder.filter(o => counts.has(o));
  const rest = Array.from(counts.keys())
    .filter(o => !preferredOrder.includes(o))
    .sort(DATA_TABLE_COLLATOR.compare);
  return [...inOrder, ...rest].map(label => ({ label, count: counts.get(label)! }));
}

/** Kandidaten + Counts je Facette aus dem (such-)gefilterten Regelsatz. */
export function computeRegelCandidates(
  rules: QualitaetsRegel[],
  file: SkillRegistryFile,
): Record<RegelFacetKey, RegelFacetCandidate[]> {
  const kat: string[] = [];
  const pruef: string[] = [];
  const sev: string[] = [];
  const akt: string[] = [];
  const skill: string[] = [];
  for (const r of rules) {
    kat.push(kategorieLabel(r));
    pruef.push(pruefartLabel(r));
    sev.push(sevLabel(r));
    akt.push(aktivLabel(r));
    for (const name of skillsUsingRegel(file, r.id)) skill.push(name);
  }
  return {
    kategorie: buildCandidates(kat, KATEGORIE_ORDER.map(k => KATEGORIE_LABEL[k]!).filter(Boolean)),
    pruefart: buildCandidates(pruef, ['textlich', 'fachlich', 'administrativ'].map(k => PRUEFART_LABEL[k]!)),
    schweregrad: buildCandidates(sev, ['Fehler', 'Hinweis']),
    aktiv: buildCandidates(akt, ['Aktiv', 'Inaktiv']),
    skill: buildCandidates(skill, []),
  };
}

export function useRegelFilters(
  rules: QualitaetsRegel[],
  file: SkillRegistryFile,
): UseRegelFiltersResult {
  const [values, setValues] = useState<RegelFacetValues>(EMPTY_VALUES);

  const setValue = useCallback((key: RegelFacetKey, value: string): void => {
    setValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetAll = useCallback((): void => setValues(EMPTY_VALUES), []);

  const candidates = useMemo(() => computeRegelCandidates(rules, file), [rules, file]);
  const filtered = useMemo(() => applyRegelFilters(rules, file, values), [rules, file, values]);
  const anyActive = useMemo(() => Object.values(values).some(v => v !== ALLE), [values]);

  return { values, setValue, resetAll, anyActive, candidates, filtered };
}
