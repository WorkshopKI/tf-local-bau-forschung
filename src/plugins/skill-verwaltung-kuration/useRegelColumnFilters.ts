/**
 * Spalten-Header-Filter der Qualitätsregeln-Tabelle. Liefert dieselbe API-Form
 * wie die generische `useColumnFilters` (columnFilters / setColumnFilter /
 * filterCandidates / filteredRules), implementiert das Matching aber selbst —
 * weil die Spalte **Verwendet in** n:m ist (Membership statt Exact-Match, das
 * die generische Logik nicht kann). Die Filter-UI bleibt die generische
 * `ColumnFilterDropdown` der `SortableTable`.
 *
 * Kandidaten werden aus dem EINGABE-Regelsatz (vor Filter) abgeleitet, damit die
 * Optionen nicht kollabieren, sobald ein Filter aktiv ist.
 */
import { useCallback, useMemo, useState } from 'react';
import { DATA_TABLE_COLLATOR } from '@/components/data-table';
import { skillsUsingRegel, type QualitaetsRegel, type SkillRegistryFile } from '@/core/services/skill-registry';
import { TYP_LABEL } from './regelShared';

const typLabel = (r: QualitaetsRegel): string => TYP_LABEL[r.typ] ?? 'Unbekannter Typ';
const sevLabel = (r: QualitaetsRegel): string => (r.schweregrad === 'fehler' ? 'Fehler' : 'Hinweis');
const aktivLabel = (r: QualitaetsRegel): string => (r.aktiv ? 'Aktiv' : 'Inaktiv');

export interface UseRegelColumnFiltersResult {
  columnFilters: Record<string, Set<string>>;
  setColumnFilter: (key: string, values: Set<string>) => void;
  filterCandidates: Record<string, string[]>;
  filteredRules: QualitaetsRegel[];
}

export function useRegelColumnFilters(
  rules: QualitaetsRegel[],
  file: SkillRegistryFile,
): UseRegelColumnFiltersResult {
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});

  const setColumnFilter = useCallback((key: string, values: Set<string>): void => {
    setColumnFilters(prev => {
      const next = { ...prev };
      if (values.size === 0) delete next[key]; else next[key] = values;
      return next;
    });
  }, []);

  const filterCandidates = useMemo(() => {
    const typ = new Set<string>();
    const sev = new Set<string>();
    const akt = new Set<string>();
    const vw = new Set<string>();
    for (const r of rules) {
      typ.add(typLabel(r));
      sev.add(sevLabel(r));
      akt.add(aktivLabel(r));
      for (const name of skillsUsingRegel(file, r.id)) vw.add(name);
    }
    const sorted = (s: Set<string>): string[] => Array.from(s).sort(DATA_TABLE_COLLATOR.compare);
    return { typ: sorted(typ), schweregrad: sorted(sev), aktiv: sorted(akt), verwendet: sorted(vw) };
  }, [rules, file]);

  const filteredRules = useMemo(() => {
    const active = Object.entries(columnFilters).filter(([, s]) => s.size > 0);
    if (active.length === 0) return rules;
    return rules.filter(r => active.every(([key, set]) => {
      if (key === 'typ') return set.has(typLabel(r));
      if (key === 'schweregrad') return set.has(sevLabel(r));
      if (key === 'aktiv') return set.has(aktivLabel(r));
      if (key === 'verwendet') return skillsUsingRegel(file, r.id).some(n => set.has(n));
      return true;
    }));
  }, [rules, file, columnFilters]);

  return { columnFilters, setColumnFilter, filterCandidates, filteredRules };
}
