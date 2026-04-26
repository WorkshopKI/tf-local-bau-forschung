import type { Antrag, Verbund } from '../types';
import type { ActiveFilter, FilterDefinition } from './types';
import { getCanonicalLevel } from '../constants';

type Predicate = (a: Antrag) => boolean;
export type VerbundResolver = (antrag: Antrag) => Verbund | undefined;

function getValue(a: Antrag, feld: string, resolve?: VerbundResolver): unknown {
  if (resolve && getCanonicalLevel(feld) === 'verbund') {
    const v = resolve(a);
    if (v) return (v as unknown as Record<string, unknown>)[feld];
    return undefined;
  }
  return a[feld];
}

function asString(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v);
}

function asNumber(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === '';
}

function matchesAny(val: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  const low = val.toLowerCase().trim();
  for (const p of patterns) {
    if (p === '*nonempty*') {
      if (low !== '') return true;
    } else if (p.toLowerCase().trim() === low) {
      return true;
    }
  }
  return false;
}

function buildPredicate(af: ActiveFilter, def: FilterDefinition, resolveVerbund?: VerbundResolver): Predicate {
  const feld = def.feld;
  switch (def.typ) {
    case 'single_select': {
      const target = typeof af.value === 'string' ? af.value : '';
      if (!target) return () => true;
      return (a) => {
        const v = getValue(a, feld, resolveVerbund);
        if (target === '(leer)') return isEmpty(v);
        return asString(v) === target;
      };
    }
    case 'multi_select': {
      const targets = Array.isArray(af.value) ? (af.value as string[]) : [];
      if (targets.length === 0) return () => true;
      const set = new Set(targets);
      return (a) => {
        const v = getValue(a, feld, resolveVerbund);
        if (isEmpty(v)) return set.has('(leer)');
        return set.has(asString(v));
      };
    }
    case 'boolean_ja_nein': {
      const mode = af.value as 'ja' | 'nein' | 'beide';
      if (mode === 'beide' || !mode) return () => true;
      const jaPatterns = def.config.ja_werte ?? [];
      const neinPatterns = def.config.nein_werte ?? [];
      return (a) => {
        const s = asString(getValue(a, feld, resolveVerbund));
        const isJa = jaPatterns.some(p =>
          p === '*nonempty*' ? s.trim() !== '' : s.toLowerCase().trim() === p.toLowerCase().trim()
        );
        if (mode === 'ja') return isJa;
        if (neinPatterns.length > 0) {
          return matchesAny(s, neinPatterns);
        }
        return !isJa;
      };
    }
    case 'date_range': {
      const range = af.value as { from?: string; to?: string };
      if (!range || (!range.from && !range.to)) return () => true;
      return (a) => {
        const v = asString(getValue(a, feld, resolveVerbund));
        if (!v) return false;
        if (range.from && v < range.from) return false;
        if (range.to && v > range.to) return false;
        return true;
      };
    }
    case 'number_range': {
      const range = af.value as { min?: number; max?: number };
      if (!range || (range.min === undefined && range.max === undefined)) return () => true;
      return (a) => {
        const n = asNumber(getValue(a, feld, resolveVerbund));
        if (n === null) return false;
        if (range.min !== undefined && n < range.min) return false;
        if (range.max !== undefined && n > range.max) return false;
        return true;
      };
    }
    case 'text_contains': {
      const q = typeof af.value === 'string' ? af.value.trim().toLowerCase() : '';
      if (!q) return () => true;
      return (a) => asString(getValue(a, feld, resolveVerbund)).toLowerCase().includes(q);
    }
    default:
      return () => true;
  }
}

function defsById(defs: FilterDefinition[]): Map<string, FilterDefinition> {
  const m = new Map<string, FilterDefinition>();
  for (const d of defs) m.set(d.id, d);
  return m;
}

export function applyFilters(
  antraege: Antrag[],
  active: ActiveFilter[],
  defs: FilterDefinition[],
  resolveVerbund?: VerbundResolver,
): Antrag[] {
  if (active.length === 0) return antraege;
  const map = defsById(defs);
  const predicates: Predicate[] = [];
  for (const af of active) {
    const def = map.get(af.filterId);
    if (!def) continue;
    if (def.config.disabled) continue;
    predicates.push(buildPredicate(af, def, resolveVerbund));
  }
  if (predicates.length === 0) return antraege;
  return antraege.filter(a => predicates.every(p => p(a)));
}

export function applyFiltersExcept(
  antraege: Antrag[],
  active: ActiveFilter[],
  defs: FilterDefinition[],
  exceptFilterId: string,
  resolveVerbund?: VerbundResolver,
): Antrag[] {
  return applyFilters(antraege, active.filter(a => a.filterId !== exceptFilterId), defs, resolveVerbund);
}

/**
 * Berechnet Facet-Counts: wie viele Einträge matchen, wenn man diesen Filter-Wert
 * zusätzlich zu den bereits aktiven Filtern auswählt. Der Filter selbst wird aus
 * der Vorfilterung ausgenommen (damit die Counts innerhalb seiner Werte-Liste
 * nicht auf 0 kollabieren wenn bereits ein anderer Wert aus demselben Filter aktiv ist).
 */
export function computeFacetCounts(
  antraege: Antrag[],
  active: ActiveFilter[],
  defs: FilterDefinition[],
  forFilter: FilterDefinition,
): Map<string, number> {
  const pre = applyFiltersExcept(antraege, active, defs, forFilter.id);
  const counts = new Map<string, number>();
  const jaPatterns = forFilter.config.ja_werte ?? [];
  const neinPatterns = forFilter.config.nein_werte ?? [];

  for (const a of pre) {
    const v = a[forFilter.feld];

    if (forFilter.typ === 'boolean_ja_nein') {
      const s = asString(v);
      const isJa = jaPatterns.some(p =>
        p === '*nonempty*' ? s.trim() !== '' : s.toLowerCase().trim() === p.toLowerCase().trim()
      );
      if (isJa) {
        counts.set('ja', (counts.get('ja') ?? 0) + 1);
      } else if (neinPatterns.length === 0 || matchesAny(s, neinPatterns)) {
        counts.set('nein', (counts.get('nein') ?? 0) + 1);
      }
      continue;
    }

    if (isEmpty(v)) {
      if (forFilter.config.leer_bucket) {
        counts.set('(leer)', (counts.get('(leer)') ?? 0) + 1);
      }
      continue;
    }

    const key = asString(v);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function totalAfterExcept(
  antraege: Antrag[],
  active: ActiveFilter[],
  defs: FilterDefinition[],
  exceptFilterId: string,
): number {
  return applyFiltersExcept(antraege, active, defs, exceptFilterId).length;
}
