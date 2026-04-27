import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Antrag } from '@/core/services/csv/types';
import type { ActiveFilter, ActiveFilterValue, FilterDefinition } from '@/core/services/csv';
import { computeFacetCounts } from '@/core/services/csv';
import { MultiSelectFacet } from './facets/MultiSelectFacet';
import { SingleSelectFacet } from './facets/SingleSelectFacet';
import { BooleanJaNeinFacet } from './facets/BooleanJaNeinFacet';
import { DateRangeFacet } from './facets/DateRangeFacet';
import { NumberRangeFacet } from './facets/NumberRangeFacet';
import { TextContainsFacet } from './facets/TextContainsFacet';

interface Props {
  def: FilterDefinition;
  antraege: Antrag[];
  activeFilters: ActiveFilter[];
  definitions: FilterDefinition[];
  valueLabels?: Record<string, string>;
  onChange: (value: ActiveFilterValue | null) => void;
}

export function FilterSidebarItem({ def, antraege, activeFilters, definitions, valueLabels, onChange }: Props): React.ReactElement {
  const active = activeFilters.find(a => a.filterId === def.id);
  const hasValue = !!active;

  const counts = useMemo(
    () => computeFacetCounts(antraege, activeFilters, definitions, def),
    [antraege, activeFilters, definitions, def],
  );

  // Min/Max-Datum für date_range — aus den Antraegen extrahieren, damit der User
  // auf "Ältestes/Neuestes" klicken kann statt manuell ein Datum zu tippen.
  const dateRange = useMemo(() => {
    if (def.typ !== 'date_range') return { min: undefined, max: undefined };
    let min: string | undefined;
    let max: string | undefined;
    const isoRe = /^(\d{4}-\d{2}-\d{2})/;
    for (const a of antraege) {
      const v = (a as Record<string, unknown>)[def.feld];
      if (typeof v !== 'string') continue;
      const m = v.match(isoRe);
      if (!m) continue;
      const d = m[1];
      if (!d) continue;
      if (min === undefined || d < min) min = d;
      if (max === undefined || d > max) max = d;
    }
    return { min, max };
  }, [def, antraege]);

  const totalAvailable = useMemo(() => {
    let total = 0;
    for (const n of counts.values()) total += n;
    return total;
  }, [counts]);

  // Sparse-Detection für boolean_ja_nein
  const jaCount = counts.get('ja') ?? 0;
  const isSparse = def.typ === 'boolean_ja_nein'
    && jaCount < 3
    && (antraege.length === 0 || jaCount / antraege.length < 0.05);

  const [collapsed, setCollapsed] = useState(isSparse && !hasValue);

  const disabled = !!def.config.disabled;
  const hasAnyValues = totalAvailable > 0 || def.typ === 'date_range' || def.typ === 'number_range' || def.typ === 'text_contains';

  const renderSummary = (): string | null => {
    if (!active) return null;
    switch (def.typ) {
      case 'single_select':
        return typeof active.value === 'string' ? active.value : null;
      case 'multi_select': {
        const arr = Array.isArray(active.value) ? active.value as string[] : [];
        if (arr.length === 0) return null;
        if (arr.length === 1) return arr[0] ?? null;
        return `${arr.length} Werte`;
      }
      case 'boolean_ja_nein':
        return active.value === 'ja' ? 'Ja' : active.value === 'nein' ? 'Nein' : 'Beide';
      case 'date_range': {
        const r = active.value as { from?: string; to?: string };
        if (r.from && r.to) return `${r.from} – ${r.to}`;
        if (r.from) return `ab ${r.from}`;
        if (r.to) return `bis ${r.to}`;
        return null;
      }
      case 'number_range': {
        const r = active.value as { min?: number; max?: number };
        if (r.min !== undefined && r.max !== undefined) return `${r.min} – ${r.max}`;
        if (r.min !== undefined) return `ab ${r.min}`;
        if (r.max !== undefined) return `bis ${r.max}`;
        return null;
      }
      case 'text_contains':
        return typeof active.value === 'string' ? `"${active.value}"` : null;
      default:
        return null;
    }
  };

  const summary = renderSummary();

  return (
    <div className="py-2" style={{ borderBottom: '0.5px solid var(--tf-border)' }}>
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between gap-2 py-1.5 text-left"
        disabled={disabled}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {collapsed ? (
            <ChevronRight size={14} className="text-[var(--tf-text-tertiary)] shrink-0" />
          ) : (
            <ChevronDown size={14} className="text-[var(--tf-text-tertiary)] shrink-0" />
          )}
          <span className={`text-[12.5px] truncate ${disabled ? 'text-[var(--tf-text-tertiary)] italic' : 'text-[var(--tf-text)] font-medium'}`}>
            {def.name}
          </span>
          {def.typ === 'boolean_ja_nein' && isSparse ? (
            <span className="text-[10.5px] text-[var(--tf-text-tertiary)] shrink-0">({jaCount})</span>
          ) : null}
        </div>
        {summary ? (
          <span className="text-[11px] text-[var(--tf-text-secondary)] truncate max-w-[120px]">{summary}</span>
        ) : null}
      </button>

      {disabled ? (
        <div className="mt-1 px-1.5 text-[11px] text-[var(--tf-text-tertiary)] italic">
          {def.description ?? 'Platzhalter — in späterer Phase aktiv'}
        </div>
      ) : !hasAnyValues && (def.typ === 'single_select' || def.typ === 'multi_select') ? (
        <div className="mt-1 px-1.5 text-[11px] text-[var(--tf-text-tertiary)]" title="Kein Antrag hat einen Wert für dieses Feld">
          Keine Werte
        </div>
      ) : collapsed ? null : (
        <div className="mt-2 px-0.5">
          {renderFacet(def, counts, active, valueLabels, dateRange, onChange)}
        </div>
      )}
    </div>
  );
}

function renderFacet(
  def: FilterDefinition,
  counts: Map<string, number>,
  active: ActiveFilter | undefined,
  valueLabels: Record<string, string> | undefined,
  dateRange: { min: string | undefined; max: string | undefined },
  onChange: (value: ActiveFilterValue | null) => void,
): React.ReactElement {
  switch (def.typ) {
    case 'multi_select':
      return (
        <MultiSelectFacet
          def={def}
          counts={counts}
          selected={Array.isArray(active?.value) ? (active!.value as string[]) : []}
          valueLabels={valueLabels}
          onChange={v => onChange(v.length === 0 ? null : v)}
        />
      );
    case 'single_select':
      return (
        <SingleSelectFacet
          def={def}
          counts={counts}
          selected={typeof active?.value === 'string' ? (active!.value as string) : ''}
          valueLabels={valueLabels}
          onChange={v => onChange(v || null)}
        />
      );
    case 'boolean_ja_nein':
      return (
        <BooleanJaNeinFacet
          filterId={def.id}
          counts={counts}
          selected={(active?.value as 'ja' | 'nein' | 'beide') ?? 'beide'}
          onChange={m => onChange(m === 'beide' ? null : m)}
        />
      );
    case 'date_range':
      return (
        <DateRangeFacet
          value={(active?.value as { from?: string; to?: string }) ?? {}}
          minDate={dateRange.min}
          maxDate={dateRange.max}
          onChange={r => {
            if (!r.from && !r.to) { onChange(null); return; }
            onChange(r);
          }}
        />
      );
    case 'number_range':
      return (
        <NumberRangeFacet
          value={(active?.value as { min?: number; max?: number }) ?? {}}
          onChange={r => {
            if (r.min === undefined && r.max === undefined) { onChange(null); return; }
            onChange(r);
          }}
        />
      );
    case 'text_contains':
      return (
        <TextContainsFacet
          value={typeof active?.value === 'string' ? (active!.value as string) : ''}
          onChange={v => onChange(v.trim() ? v : null)}
        />
      );
    default:
      return <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">Unbekannter Typ</div>;
  }
}
