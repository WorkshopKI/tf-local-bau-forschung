import type { ActiveFilter, FilterDefinition } from '@/core/services/csv';
import { formatDatumsWert } from '@/core/services/csv';
import { FilterChip } from '@/components/ui/FilterChip';

interface Props {
  active: ActiveFilter[];
  definitions: FilterDefinition[];
  onRemove: (filterId: string) => void;
  /** Code→Klartext je Feld (`useFilterState.valueLabels`) — ohne sie zeigt der
   *  Chip den Rohcode, während die Facette daneben den Namen führt. */
  valueLabels?: Record<string, Record<string, string>>;
  /** Wrapper-Klassen (überschreibt den Default inkl. `mb-3`). Nutzt der Aufrufer,
   *  wenn die Chips z.B. in einer eigenen Toolbar-Zeile ohne Bodenabstand sitzen. */
  className?: string;
}

export function ActiveFilterChips({ active, definitions, onRemove, valueLabels, className = 'flex flex-wrap gap-1.5 mb-3' }: Props): React.ReactElement | null {
  if (active.length === 0) return null;
  return (
    <div className={className}>
      {active.map(af => {
        const def = definitions.find(d => d.id === af.filterId);
        if (!def) return null;
        const summary = summarize(af, def, valueLabels?.[def.feld]);
        return (
          <FilterChip
            key={af.filterId}
            label={def.name}
            value={summary}
            onRemove={() => onRemove(af.filterId)}
          />
        );
      })}
    </div>
  );
}

/**
 * Der Chip-Text eines aktiven Filters.
 *
 * `labels` ist die Code→Klartext-Karte des Feldes (`FieldValueLabels[feld]`).
 * Ohne sie stand im Chip der ROHCODE — „Richtlinie 47", „VB-Phase 3" —, während
 * die Facette daneben denselben Wert im Klartext führt: dieselbe Auswahl, zwei
 * Sprachen, und der Chip war der einzige Ort, an dem sie sich zurücknehmen lässt
 * (v4.124).
 */
function summarize(
  af: ActiveFilter, def: FilterDefinition, labels?: Record<string, string>,
): string {
  const klar = (v: string): string => labels?.[v] ?? v;
  switch (def.typ) {
    case 'single_select':
      return typeof af.value === 'string' ? klar(af.value) : '—';
    case 'multi_select': {
      const arr = Array.isArray(af.value) ? af.value as string[] : [];
      if (arr.length === 1) return klar(arr[0] ?? '') || '—';
      return `${arr.length} Werte`;
    }
    case 'boolean_ja_nein':
      return af.value === 'ja' ? 'Ja' : af.value === 'nein' ? 'Nein' : 'Beide';
    case 'date_range': {
      // Deutsch, nicht ISO — der Chip steht in derselben Zeile wie die
      // Schnellzugriffe, die dasselbe Datum lesbar zeigen.
      const r = af.value as { from?: string; to?: string };
      const from = formatDatumsWert(r.from);
      const to = formatDatumsWert(r.to);
      if (from && to) return `${from} – ${to}`;
      if (from) return `ab ${from}`;
      if (to) return `bis ${to}`;
      return '—';
    }
    case 'number_range': {
      const r = af.value as { min?: number; max?: number };
      if (r.min !== undefined && r.max !== undefined) return `${r.min} – ${r.max}`;
      if (r.min !== undefined) return `ab ${r.min}`;
      if (r.max !== undefined) return `bis ${r.max}`;
      return '—';
    }
    case 'text_contains':
      return typeof af.value === 'string' ? `"${af.value}"` : '—';
    default:
      return '—';
  }
}
